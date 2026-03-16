using Microsoft.AspNetCore.SignalR;
using Backend.Models;
using Backend.Services;

namespace Backend.Hubs;

public class GameHub : Hub
{
    private readonly SessionManager _sessions;

    public GameHub(SessionManager sessions)
    {
        _sessions = sessions;
    }

    // ─── Session Lifecycle ──────────────────────────────────

    public async Task<object> CreateSession(string password, int gridSize, int totalRounds)
    {
        var session = _sessions.CreateSession(password, gridSize, totalRounds);
        return new { sessionId = session.Id };
    }

    public async Task<object> JoinSession(string sessionId, string password, string playerName)
    {
        if (!_sessions.ValidatePassword(sessionId, password))
            return new { error = "Invalid session ID or password" };

        var session = _sessions.GetSession(sessionId);
        if (session == null)
            return new { error = "Session not found" };

        var player = _sessions.AddPlayer(sessionId, Context.ConnectionId, playerName);
        if (player == null)
            return new { error = "Failed to join session" };

        _sessions.TrackConnection(Context.ConnectionId, sessionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

        // Broadcast updated lobby to all in session
        if (session.Phase == GamePhase.Lobby)
        {
            var lobbyState = SessionManager.ToLobbyDto(session);
            await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
        }
        else
        {
            var gameState = SessionManager.ToStateDto(session);
            await Clients.Caller.SendAsync("GameStateUpdated", gameState);
            // Also send updated game state to all players to refresh the player list
            await Clients.OthersInGroup(sessionId).SendAsync("GameStateUpdated", gameState);
        }

        return new { success = true, playerId = player.Id, sessionId };
    }

    public async Task<object> GetLobbyState()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null)
        {
            Console.WriteLine("[GetLobbyState] Connection not in any session");
            return new { error = "Not in a session" };
        }

        var session = _sessions.GetSession(sessionId);
        if (session == null)
        {
            Console.WriteLine($"[GetLobbyState] Session {sessionId} not found");
            return new { error = "Session not found" };
        }

        Console.WriteLine($"[GetLobbyState] Session {sessionId} has {session.Players.Count} players");
        var lobbyDto = SessionManager.ToLobbyDto(session);
        Console.WriteLine($"[GetLobbyState] Lobby DTO has {lobbyDto.Players.Count} players");
        
        return lobbyDto;
    }

    public async Task<object> UpdateMyName(string playerName)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };

        var player = _sessions.GetPlayerByConnection(sessionId, Context.ConnectionId);
        if (player == null) return new { error = "Player not found" };

        var success = _sessions.UpdatePlayerName(sessionId, player.Id, playerName);
        if (!success) return new { error = "Failed to update name" };

        await BroadcastLobbyOrGame(sessionId);
        return new { success = true };
    }

    public async Task<object> ChangePassword(string newPassword)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };

        if (!IsHost(sessionId)) return new { error = "Not host" };

        var success = _sessions.UpdateSessionPassword(sessionId, newPassword);
        if (!success) return new { error = "Failed to update password" };

        await BroadcastLobbyOrGame(sessionId);
        return new { success = true };
    }

    public async Task<object> RenamePlayer(string playerId, string playerName)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsHost(sessionId)) return new { error = "Not host" };

        var success = _sessions.UpdatePlayerName(sessionId, playerId, playerName);
        if (!success) return new { error = "Failed to rename player" };

        await BroadcastLobbyOrGame(sessionId);
        return new { success = true };
    }

    public async Task<object> KickPlayer(string playerId)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsHost(sessionId) && !IsGameMaster(sessionId)) return new { error = "Only host or game master can kick players" };

        var me = _sessions.GetPlayerByConnection(sessionId, Context.ConnectionId);
        if (me?.Id == playerId) return new { error = "Cannot kick yourself" };

        var target = _sessions.GetPlayerById(sessionId, playerId);
        if (target == null) return new { error = "Player not found" };

        // Game master cannot kick other game master
        if (IsGameMaster(sessionId) && target.Role == PlayerRole.GameMaster)
            return new { error = "Cannot kick game master" };

        var success = _sessions.KickPlayer(sessionId, playerId);
        if (!success) return new { error = "Failed to kick player" };

        await Clients.Client(target.ConnectionId).SendAsync("KickedFromSession", new { sessionId, reason = IsGameMaster(sessionId) ? "kicked-by-gamemaster" : "kicked" });
        await BroadcastLobbyOrGame(sessionId);
        return new { success = true };
    }

    public async Task<object> LeaveSession()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { success = true };

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
        var success = _sessions.RemovePlayer(sessionId, Context.ConnectionId);
        _sessions.UntrackConnection(Context.ConnectionId);

        var session = _sessions.GetSession(sessionId);
        if (session != null)
        {
            await BroadcastLobbyOrGame(sessionId);
        }

        return new { success };
    }

    // ─── Role Management ────────────────────────────────────

    public async Task<object> SetRole(string role)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };

        var playerRole = role switch
        {
            "teamorange" => PlayerRole.TeamOrange,
            "teamgreen" => PlayerRole.TeamGreen,
            "gamemaster" => PlayerRole.GameMaster,
            _ => PlayerRole.Spectator
        };

        var success = _sessions.SetPlayerRole(sessionId, Context.ConnectionId, playerRole);
        if (!success) return new { error = "Cannot set role (game master slot taken)" };

        var session = _sessions.GetSession(sessionId)!;

        if (session.Phase == GamePhase.Lobby)
        {
            var lobbyState = SessionManager.ToLobbyDto(session);
            await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
        }
        else
        {
            var gameState = SessionManager.ToStateDto(session);
            await Clients.Group(sessionId).SendAsync("GameStateUpdated", gameState);
        }

        return new { success = true };
    }

    public async Task<object> SwitchPlayers(string playerId1, string playerId2)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        var success = _sessions.SwitchPlayers(sessionId, playerId1, playerId2);
        if (!success) return new { error = "Failed to switch" };

        await BroadcastState(sessionId);
        return new { success = true };
    }

    // ─── Game Flow ──────────────────────────────────────────

    public async Task<object> StartGame(int? gridSize, int? totalRounds, int? timerFirst, int? timerSecond)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        var success = _sessions.StartGame(sessionId, gridSize, totalRounds, timerFirst, timerSecond);
        if (!success) return new { error = "Failed to start game" };

        await BroadcastState(sessionId);
        return new { success = true };
    }

    public async Task<object> SelectCell(string cellId)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        var cell = _sessions.SelectCell(sessionId, cellId);
        if (cell == null) return new { error = "Cannot select cell" };

        await BroadcastState(sessionId);
        return new { success = true, letter = cell.Letter };
    }

    public async Task<object> PickRandomCell()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        var cell = _sessions.PickRandomCell(sessionId);
        if (cell == null) return new { error = "No available cells" };

        await BroadcastState(sessionId);
        return new { success = true, letter = cell.Letter };
    }

    public async Task SetQuestion(string letter, string questionText, string answerText,
                                   string? category, string? difficulty)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;
        if (!IsGameMaster(sessionId)) return;

        _sessions.SetQuestion(sessionId, letter, questionText, answerText, category, difficulty);
        await BroadcastState(sessionId);
    }

    public async Task ShowQuestion(bool show)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;
        if (!IsGameMaster(sessionId)) return;

        _sessions.SetShowQuestion(sessionId, show);
        await BroadcastState(sessionId);
    }

    public async Task<object> AwardCell(string team)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        var winner = _sessions.AwardCell(sessionId, team);
        _sessions.ResetBuzzer(sessionId);
        await BroadcastState(sessionId);
        return new { success = true, winner };
    }

    public async Task<object> SkipCell()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        _sessions.AwardCell(sessionId, "skip");
        _sessions.ResetBuzzer(sessionId);
        await BroadcastState(sessionId);
        return new { success = true };
    }

    public async Task<object> ChangeHexWinner(string cellId, string winner)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        var success = _sessions.ChangeHexWinner(sessionId, cellId, winner);
        if (!success) return new { error = "Cell not found or invalid" };
        
        await BroadcastState(sessionId);
        return new { success = true };
    }

    public async Task RefreshQuestion()
    {
        // This is handled client-side (question bank is in frontend)
        // GM picks a new question and sends it via SetQuestion
    }

    public async Task<object> NextRound()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        _sessions.NextRound(sessionId);
        await BroadcastState(sessionId);
        return new { success = true };
    }

    public async Task<object> ResetGame()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Not game master" };

        _sessions.ResetGame(sessionId);

        var session = _sessions.GetSession(sessionId)!;
        var lobbyState = SessionManager.ToLobbyDto(session);
        // Send both events so game.tsx can navigate back to lobby
        await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
        var gameState = SessionManager.ToStateDto(session);
        await Clients.Group(sessionId).SendAsync("GameStateUpdated", gameState);
        return new { success = true };
    }

    public async Task<object> EndSession()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!CanManageSession(sessionId)) return new { error = "Not allowed" };

        // Notify everyone in the session that it's ending
        await Clients.Group(sessionId).SendAsync("SessionEnded");

        // Destroy the session
        _sessions.DestroySession(sessionId);

        return new { success = true };
    }

    // ─── Buzzer ─────────────────────────────────────────────

    public async Task<object> Buzz()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };

        var player = _sessions.GetPlayerByConnection(sessionId, Context.ConnectionId);
        if (player == null) return new { error = "Player not found" };

        var success = _sessions.Buzz(sessionId, Context.ConnectionId, player.Name);
        await BroadcastState(sessionId);
        return new { success };
    }

    public async Task ResetBuzzer()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;
        if (!IsGameMaster(sessionId)) return;

        _sessions.ResetBuzzer(sessionId);
        await BroadcastState(sessionId);
    }

    public async Task PassToOtherTeam()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;
        if (!IsGameMaster(sessionId)) return;

        _sessions.PassToOtherTeam(sessionId);
        await BroadcastState(sessionId);
    }

    public async Task OpenBuzzer()
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;
        if (!IsGameMaster(sessionId)) return;

        _sessions.OpenBuzzer(sessionId);
        await BroadcastState(sessionId);
    }

    public async Task UpdateTimerConfig(int? timerFirst, int? timerSecond)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;
        if (!IsGameMaster(sessionId)) return;

        _sessions.UpdateTimerConfig(sessionId, timerFirst, timerSecond);
        await BroadcastState(sessionId);
    }

    public async Task UpdateSettings(int? gridSize, int? totalRounds)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return;

        var session = _sessions.GetSession(sessionId);
        if (session == null) return;
        if (!IsGameMaster(sessionId)) return; // Only game master can update settings

        _sessions.UpdateSettings(sessionId, gridSize, totalRounds);

        session = _sessions.GetSession(sessionId)!;
        if (session.Phase == GamePhase.Lobby)
        {
            var lobbyState = SessionManager.ToLobbyDto(session);
            await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
        }
        else
        {
            await BroadcastState(sessionId);
        }
    }

    public async Task<object> UpdateMaxPlayersPerTeam(int maxPlayers)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Only game master can change max players" };

        var success = _sessions.UpdateMaxPlayersPerTeam(sessionId, maxPlayers);
        if (!success) return new { error = "Failed to update max players (invalid value or teams exceed limit)" };

        var session = _sessions.GetSession(sessionId)!;
        if (session.Phase == GamePhase.Lobby)
        {
            var lobbyState = SessionManager.ToLobbyDto(session);
            await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
        }
        else
        {
            await BroadcastState(sessionId);
        }

        return new { success = true };
    }

    public async Task<object> SwitchPlayerTeam(string playerId, string newRole)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Only game master can switch teams" };

        if (!Enum.TryParse<PlayerRole>(newRole, true, out var role))
            return new { error = "Invalid role" };

        var success = _sessions.SwitchPlayerTeam(sessionId, playerId, role);
        if (!success) return new { error = "Failed to switch team (team might be full)" };

        var session = _sessions.GetSession(sessionId);
        if (session != null)
        {
            if (session.Phase == GamePhase.Lobby)
            {
                var lobbyState = SessionManager.ToLobbyDto(session);
                await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
            }
            else
            {
                await BroadcastState(sessionId);
            }
        }

        return new { success = true };
    }

    public async Task<object> MoveSpectatorToTeam(string playerId, string teamRole)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId == null) return new { error = "Not in a session" };
        if (!IsGameMaster(sessionId)) return new { error = "Only game master can move spectators" };

        if (!Enum.TryParse<PlayerRole>(teamRole, true, out var role))
            return new { error = "Invalid role" };

        var success = _sessions.MoveSpectatorToTeam(sessionId, playerId, role);
        if (!success) return new { error = "Failed to move player (team might be full)" };

        var session = _sessions.GetSession(sessionId);
        if (session != null)
        {
            if (session.Phase == GamePhase.Lobby)
            {
                var lobbyState = SessionManager.ToLobbyDto(session);
                await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
            }
            else
            {
                await BroadcastState(sessionId);
            }
        }

        return new { success = true };
    }

    // ─── Disconnect ─────────────────────────────────────────

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var sessionId = _sessions.GetSessionForConnection(Context.ConnectionId);
        if (sessionId != null)
        {
            var session = _sessions.GetSession(sessionId);
            var wasGameMaster = session?.Players.Any(p => p.ConnectionId == Context.ConnectionId && p.Role == PlayerRole.GameMaster) ?? false;
            
            var sessionEnded = _sessions.RemovePlayer(sessionId, Context.ConnectionId);
            _sessions.UntrackConnection(Context.ConnectionId);

            if (sessionEnded)
            {
                // Game master left - session ended
                await Clients.Group(sessionId).SendAsync("SessionEnded");
            }
            else if (session != null)
            {
                // Regular player left
                if (session.Phase == GamePhase.Lobby)
                {
                    var lobbyState = SessionManager.ToLobbyDto(session);
                    await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
                }
                else
                {
                    await BroadcastState(sessionId);
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ─── Helpers ────────────────────────────────────────────

    private bool IsGameMaster(string sessionId)
    {
        var player = _sessions.GetPlayerByConnection(sessionId, Context.ConnectionId);
        return player?.Role == PlayerRole.GameMaster;
    }

    private bool IsHost(string sessionId)
    {
        return _sessions.IsHost(sessionId, Context.ConnectionId);
    }

    private bool CanManageSession(string sessionId)
    {
        return IsHost(sessionId) || IsGameMaster(sessionId);
    }

    private async Task BroadcastLobbyOrGame(string sessionId)
    {
        var session = _sessions.GetSession(sessionId);
        if (session == null) return;

        if (session.Phase == GamePhase.Lobby)
        {
            var lobbyState = SessionManager.ToLobbyDto(session);
            await Clients.Group(sessionId).SendAsync("LobbyUpdated", lobbyState);
            return;
        }

        await BroadcastState(sessionId);
    }

    private async Task BroadcastState(string sessionId)
    {
        var session = _sessions.GetSession(sessionId);
        if (session == null) return;

        var state = SessionManager.ToStateDto(session);
        await Clients.Group(sessionId).SendAsync("GameStateUpdated", state);
    }
}
