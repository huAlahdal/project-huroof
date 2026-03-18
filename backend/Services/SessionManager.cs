using System.Collections.Concurrent;
using System.Text.Json;
using Backend.Models;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class SessionManager
{
    private readonly ConcurrentDictionary<string, GameSession> _sessions = new();
    private readonly IServiceProvider _serviceProvider;
    private static readonly Lock _lock = new();
    private readonly Timer _cleanupTimer;
    private readonly ConcurrentDictionary<string, PersistedSession> _persistedCache = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _pendingDeletions = new();

    // 28 Arabic letters used in the game
    private static readonly string[] ArabicLetters =
    [
        "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز",
        "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل",
        "م", "ن", "ه", "و", "ي"
    ];

    // ─── Constructor ───────────────────────────────────────

    public SessionManager(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
        
        // Load persisted sessions on startup
        _ = Task.Run(LoadPersistedSessionsAsync);
        
        // Setup cleanup timer to run every 5 minutes
        _cleanupTimer = new Timer(CleanupExpiredSessions, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
    }

    // ─── Session Lifecycle ──────────────────────────────────

    public GameSession CreateSession(string? password, int gridSize, int totalRounds, string? createdByUserId = null)
    {
        var session = new GameSession
        {
            Id = GenerateSessionId(),
            PasswordHash = string.IsNullOrWhiteSpace(password) ? null : HashPassword(password),
            CreatedByUserId = createdByUserId,
            GridSize = Math.Clamp(gridSize, 4, 6),
            TotalRounds = Math.Clamp(totalRounds, 2, 6),
            MaxPlayersPerTeam = 4,
            Phase = GamePhase.Lobby,
            Grid = [],
            Players = [],
            OrangeScore = 0,
            GreenScore = 0,
            Question = new(),
            Buzzer = new(),
            Version = 1
        };

        _sessions.TryAdd(session.Id, session);
       
       // Save to database immediately for new sessions
       _ = Task.Run(() => SaveSessionAsync(session));
       
       return session;
    }

    public GameSession? GetSession(string sessionId)
    {
        var session = _sessions.GetValueOrDefault(sessionId);
        if (session != null)
        {
            // Update timer state before returning
            session.Buzzer.UpdateTimerState();
        }
        return session;
    }

    public IEnumerable<GameSession> GetAllSessions()
    {
        return _sessions.Values;
    }

    /// <summary>Find the first active session containing a player with the given userId (registered user or guest ID).</summary>
    public (GameSession session, Player player)? FindSessionByUserId(string userId)
    {
        foreach (var session in _sessions.Values)
        {
            var player = session.Players.FirstOrDefault(p => p.UserId == userId);
            if (player != null)
                return (session, player);
        }
        return null;
    }

    /// <summary>Remove a player from a session by userId. Returns true if found and removed.</summary>
    public bool RemovePlayerByUserId(string sessionId, string userId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.UserId == userId);
            if (player == null) return false;

            _connectionToSession.TryRemove(player.ConnectionId, out _);

            // Keep as placeholder (empty connection) so they can rejoin with same role,
            // or just remove entirely for a clean leave
            session.Players.Remove(player);

            // Reassign host if needed
            if (session.HostPlayerId == player.Id && session.Players.Count > 0)
            {
                var newHost = session.Players.FirstOrDefault(p => !string.IsNullOrEmpty(p.ConnectionId))
                              ?? session.Players.FirstOrDefault();
                if (newHost != null) session.HostPlayerId = newHost.Id;
            }

            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool HasPassword(string sessionId)
    {
        var session = GetSession(sessionId);
        return session?.PasswordHash != null;
    }

    public bool ValidatePassword(string sessionId, string? password)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;
        // No password set → anyone with the ID can join
        if (session.PasswordHash == null) return true;
        if (string.IsNullOrEmpty(password)) return false;
        return BCrypt.Net.BCrypt.Verify(password, session.PasswordHash);
    }

    // ─── Player Management ──────────────────────────────────

    public Player? AddPlayer(string sessionId, string connectionId, string name, string? userId = null)
    {
        var session = GetSession(sessionId);
        if (session == null) return null;

        lock (_lock)
        {
            var normalizedName = NormalizePlayerName(name);

            // Check if player already exists by connection
            var existing = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (existing != null)
            {
                existing.Name = normalizedName;
                IncrementVersionAndSave(session);
                return existing;
            }

            // Check if user is already in this session (same userId)
            if (!string.IsNullOrEmpty(userId))
            {
                var existingByUser = session.Players.FirstOrDefault(p => p.UserId == userId);
                if (existingByUser != null)
                {
                    // Cancel any pending deletion since someone is reconnecting
                    if (_pendingDeletions.TryRemove(sessionId, out var cts))
                        cts.Cancel();

                    // Clean up old connection 
                    if (!string.IsNullOrEmpty(existingByUser.ConnectionId))
                    {
                        _connectionToSession.TryRemove(existingByUser.ConnectionId, out _);
                    }

                    // Reassign connection and update name
                    existingByUser.ConnectionId = connectionId;
                    existingByUser.Name = normalizedName;

                    IncrementVersionAndSave(session);
                    return existingByUser;
                }
            }

            // Check if player was previously in the session (by name and empty connection)
            var previousPlayer = session.Players.FirstOrDefault(p => 
                p.Name.Equals(normalizedName, StringComparison.OrdinalIgnoreCase) && 
                p.ConnectionId == "");
            
            PlayerRole role = PlayerRole.Spectator;
            string playerId = Guid.NewGuid().ToString("N")[..8];
            
            if (previousPlayer != null)
            {
                // Restore the player's previous role and ID
                role = previousPlayer.Role;
                playerId = previousPlayer.Id;
                // Remove the placeholder player
                session.Players.Remove(previousPlayer);
            }

            var player = new Player
            {
                Id = playerId,
                ConnectionId = connectionId,
                Name = normalizedName,
                Role = role,
                UserId = userId
            };

            session.Players.Add(player);
            if (string.IsNullOrWhiteSpace(session.HostPlayerId) || 
                !session.Players.Any(p => p.Id == session.HostPlayerId && !string.IsNullOrEmpty(p.ConnectionId)))
            {
                // If there's no host with an active connection, make this player the host
                session.HostPlayerId = player.Id;
            }
            IncrementVersionAndSave(session);
            return player;
        }
    }

    public bool RemovePlayer(string sessionId, string connectionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        Player? removedPlayer = null;
        lock (_lock)
        {
            removedPlayer = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (removedPlayer != null)
            {
                // Untrack the connection
                _connectionToSession.TryRemove(connectionId, out _);
                
                // Instead of removing the player, just clear their connection ID
                // This preserves their role and allows them to reconnect
                removedPlayer.ConnectionId = "";
                
                if (removedPlayer.Id == session.HostPlayerId)
                    session.HostPlayerId = session.Players.FirstOrDefault(p => !string.IsNullOrEmpty(p.ConnectionId))?.Id;
                IncrementVersionAndSave(session);
            }

            // If all players have disconnected, schedule a delayed deletion
            // to allow page refreshes to reconnect within a grace period
            if (session.Players.All(p => string.IsNullOrEmpty(p.ConnectionId)))
            {
                ScheduleSessionDeletion(sessionId, delaySeconds: 30);
            }
        }

        return removedPlayer != null;
    }

    private void ScheduleSessionDeletion(string sessionId, int delaySeconds)
    {
        // Cancel any existing pending deletion
        if (_pendingDeletions.TryRemove(sessionId, out var existing))
            existing.Cancel();

        var cts = new CancellationTokenSource();
        _pendingDeletions[sessionId] = cts;

        _ = Task.Delay(TimeSpan.FromSeconds(delaySeconds), cts.Token).ContinueWith(t =>
        {
            if (t.IsCanceled) return;
            _pendingDeletions.TryRemove(sessionId, out _);
            var session = GetSession(sessionId);
            if (session != null && session.Players.All(p => string.IsNullOrEmpty(p.ConnectionId)))
            {
                _sessions.TryRemove(sessionId, out _);
            }
        }, TaskScheduler.Default);
    }

    public Player? GetPlayerByConnection(string sessionId, string connectionId)
    {
        var session = GetSession(sessionId);
        return session?.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
    }

    public Player? GetPlayerById(string sessionId, string playerId)
    {
        var session = GetSession(sessionId);
        return session?.Players.FirstOrDefault(p => p.Id == playerId);
    }

    public bool IsHost(string sessionId, string connectionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        var player = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
        return player != null && player.Id == session.HostPlayerId;
    }

    public bool UpdatePlayerName(string sessionId, string playerId, string name)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return false;

            player.Name = NormalizePlayerName(name);
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool UpdateSessionPassword(string sessionId, string? newPassword)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            session.PasswordHash = string.IsNullOrWhiteSpace(newPassword) ? null : HashPassword(newPassword);
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool UpdateMaxPlayersPerTeam(string sessionId, int maxPlayers)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            // Validate max players (between 1 and 10)
            if (maxPlayers < 1 || maxPlayers > 10) return false;

            // Check if current teams exceed the new limit
            var orangeCount = session.Players.Count(p => p.Role == PlayerRole.TeamOrange);
            var greenCount = session.Players.Count(p => p.Role == PlayerRole.TeamGreen);
            
            if (orangeCount > maxPlayers || greenCount > maxPlayers)
                return false;

            session.MaxPlayersPerTeam = maxPlayers;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    // ─── Player Management (Game Master only) ─────────────────

    public bool KickPlayer(string sessionId, string playerId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null || player.Role == PlayerRole.GameMaster) return false;

            session.Players.RemoveAll(p => p.Id == playerId);
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool SwitchPlayerTeam(string sessionId, string playerId, PlayerRole newRole)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null || player.Role == PlayerRole.GameMaster) return false;
            if (!CanJoinTeam(session, newRole)) return false;

            player.Role = newRole;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool MoveSpectatorToTeam(string sessionId, string playerId, PlayerRole teamRole)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null || player.Role != PlayerRole.Spectator) return false;
            if (!CanJoinTeam(session, teamRole)) return false;

            player.Role = teamRole;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    /// <summary>Check if a team role can accept another player without exceeding the limit.</summary>
    private static bool CanJoinTeam(GameSession session, PlayerRole role)
    {
        if (role != PlayerRole.TeamOrange && role != PlayerRole.TeamGreen) return true;
        var count = session.Players.Count(p => p.Role == role);
        return count < session.MaxPlayersPerTeam;
    }

    public bool RemovePlayerById(string sessionId, string playerId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return false;

            var removed = session.Players.RemoveAll(p => p.Id == playerId);
            if (removed == 0) return false;

            _connectionToSession.TryRemove(player.ConnectionId, out _);

            if (player.Id == session.HostPlayerId)
                session.HostPlayerId = session.Players.FirstOrDefault()?.Id;

            if (session.Players.Count == 0)
            {
                _sessions.TryRemove(sessionId, out _);
            }
            else
            {
                IncrementVersionAndSave(session);
            }

            return true;
        }
    }

    public bool SetPlayerRole(string sessionId, string connectionId, PlayerRole role)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player == null) return false;

            // Only one game master allowed
            if (role == PlayerRole.GameMaster)
            {
                var currentGm = session.Players.FirstOrDefault(p => p.Role == PlayerRole.GameMaster);
                if (currentGm != null && currentGm.ConnectionId != connectionId)
                    return false;
            }

            player.Role = role;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool SetPlayerRoleById(string sessionId, string playerId, PlayerRole role)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var player = session.Players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return false;

            if (role == PlayerRole.GameMaster)
            {
                var currentGm = session.Players.FirstOrDefault(p => p.Role == PlayerRole.GameMaster && p.Id != playerId);
                if (currentGm != null)
                    return false;
            }

            player.Role = role;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool SwitchPlayers(string sessionId, string playerId1, string playerId2)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var p1 = session.Players.FirstOrDefault(p => p.Id == playerId1);
            var p2 = session.Players.FirstOrDefault(p => p.Id == playerId2);
            if (p1 == null || p2 == null) return false;

            (p1.Role, p2.Role) = (p2.Role, p1.Role);
            IncrementVersionAndSave(session);
            return true;
        }
    }

    // ─── Game Flow ──────────────────────────────────────────

    public bool StartGame(string sessionId, int? gridSize = null, int? totalRounds = null,
                          int? timerFirst = null, int? timerSecond = null)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            // Check that both teams have at least one player
            var orangePlayers = session.Players.Count(p => p.Role == PlayerRole.TeamOrange);
            var greenPlayers = session.Players.Count(p => p.Role == PlayerRole.TeamGreen);
            
            if (orangePlayers == 0 || greenPlayers == 0)
                return false;

            if (gridSize.HasValue) session.GridSize = Math.Clamp(gridSize.Value, 4, 6);
            if (totalRounds.HasValue) session.TotalRounds = Math.Clamp(totalRounds.Value, 2, 6);
            if (timerFirst.HasValue) session.Buzzer.BuzzerTimerFirst = Math.Clamp(timerFirst.Value, 1, 60);
            if (timerSecond.HasValue) session.Buzzer.BuzzerTimerSecond = Math.Clamp(timerSecond.Value, 1, 60);

            session.Grid = CreateGrid(session.GridSize);
            session.Phase = GamePhase.Idle;
            session.CurrentRound = 1;
            session.OrangeScore = 0;
            session.GreenScore = 0;
            session.SelectedCellId = null;
            session.Question = new SelectedQuestion();
            session.Buzzer.Reset();
            session.RoundWinner = null;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public HexCell? SelectCell(string sessionId, string cellId)
    {
        var session = GetSession(sessionId);
        if (session == null) return null;
        if (session.Phase != GamePhase.Idle && session.Phase != GamePhase.Selected) return null;

        lock (_lock)
        {
            var cell = FlatGrid(session).FirstOrDefault(c => c.Id == cellId);
            if (cell == null || cell.Owner != null) return null;

            // Clear previous selection
            foreach (var c in FlatGrid(session))
                c.IsSelected = false;

            cell.IsSelected = true;
            session.SelectedCellId = cellId;
            session.Phase = GamePhase.Selected;
            IncrementVersionAndSave(session);
            return cell;
        }
    }

    public HexCell? PickRandomCell(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return null;
        if (session.Phase != GamePhase.Idle && session.Phase != GamePhase.Selected) return null;

        lock (_lock)
        {
            var available = FlatGrid(session).Where(c => c.Owner == null).ToList();
            if (available.Count == 0) return null;

            var cell = available[Random.Shared.Next(available.Count)];

            foreach (var c in FlatGrid(session))
                c.IsSelected = false;

            cell.IsSelected = true;
            session.SelectedCellId = cell.Id;
            session.Phase = GamePhase.Selected;
            IncrementVersionAndSave(session);
            return cell;
        }
    }

    public void SetQuestion(string sessionId, string letter, string questionText,
                            string answerText, string? category, string? difficulty)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            session.Question = new SelectedQuestion
            {
                Letter = letter,
                QuestionText = questionText,
                AnswerText = answerText,
                Category = category,
                Difficulty = difficulty,
                ShowQuestion = session.Question.ShowQuestion
            };
            IncrementVersionAndSave(session);
        }
    }

    public void SetShowQuestion(string sessionId, bool show)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            session.Question.ShowQuestion = show;
            IncrementVersionAndSave(session);
        }
    }

    public string? AwardCell(string sessionId, string team)
    {
        var session = GetSession(sessionId);
        if (session == null || session.Phase != GamePhase.Selected || session.SelectedCellId == null)
            return null;

        lock (_lock)
        {
            var cell = FlatGrid(session).FirstOrDefault(c => c.Id == session.SelectedCellId);
            if (cell == null) return null;

            // Clear selection
            foreach (var c in FlatGrid(session))
                c.IsSelected = false;

            if (team != "skip")
            {
                cell.Owner = team;

                // Check win
                if (CheckWin(session.Grid, team, session.GridSize))
                {
                    session.RoundWinner = team;
                    if (team == "orange") session.OrangeScore++;
                    else session.GreenScore++;

                    if (session.CurrentRound >= session.TotalRounds)
                    {
                        // Check tiebreaker
                        if (session.OrangeScore == session.GreenScore)
                        {
                            session.Phase = GamePhase.BetweenRounds;
                        }
                        else
                        {
                            session.Phase = GamePhase.Win;
                        }
                    }
                    else
                    {
                        session.Phase = GamePhase.BetweenRounds;
                    }

                    session.SelectedCellId = null;
                    session.Question = new SelectedQuestion();
                    IncrementVersionAndSave(session);
                    return session.RoundWinner;
                }
            }

            // Check if all cells claimed
            var allClaimed = FlatGrid(session).All(c => c.Owner != null);
            if (allClaimed)
            {
                session.RoundWinner = "draw";
                if (session.CurrentRound >= session.TotalRounds)
                {
                    if (session.OrangeScore == session.GreenScore)
                        session.Phase = GamePhase.BetweenRounds;
                    else
                        session.Phase = GamePhase.Win;
                }
                else
                {
                    session.Phase = GamePhase.BetweenRounds;
                }
                session.SelectedCellId = null;
                session.Question = new SelectedQuestion();
                IncrementVersionAndSave(session);
                return "draw";
            }

            // Continue playing
            session.Phase = GamePhase.Idle;
            session.SelectedCellId = null;
            session.Question = new SelectedQuestion();
            IncrementVersionAndSave(session);
            return null; // No winner yet
        }
    }

    public bool ChangeHexWinner(string sessionId, string cellId, string winner)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            var cell = FlatGrid(session).FirstOrDefault(c => c.Id.Equals(cellId, StringComparison.OrdinalIgnoreCase));
            if (cell == null) return false;

            var previousRoundWinner = session.RoundWinner;

            // Set new owner
            cell.Owner = winner;

            // Check for win conditions
            if (CheckWin(session.Grid, winner, session.GridSize))
            {
                session.RoundWinner = winner;

                if (previousRoundWinner != winner)
                {
                    if (previousRoundWinner == "orange")
                        session.OrangeScore = Math.Max(0, session.OrangeScore - 1);
                    else if (previousRoundWinner == "green")
                        session.GreenScore = Math.Max(0, session.GreenScore - 1);

                    if (winner == "orange")
                        session.OrangeScore++;
                    else if (winner == "green")
                        session.GreenScore++;
                }

                if (session.CurrentRound >= session.TotalRounds)
                {
                    if (session.OrangeScore == session.GreenScore)
                        session.Phase = GamePhase.BetweenRounds;
                    else
                        session.Phase = GamePhase.Win;
                }
                else
                {
                    session.Phase = GamePhase.BetweenRounds;
                }
            }
            else if (previousRoundWinner == "orange" || previousRoundWinner == "green")
            {
                if (previousRoundWinner == "orange")
                    session.OrangeScore = Math.Max(0, session.OrangeScore - 1);
                else if (previousRoundWinner == "green")
                    session.GreenScore = Math.Max(0, session.GreenScore - 1);

                session.RoundWinner = null;
            }

            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool NextRound(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            session.Grid = CreateGrid(session.GridSize);
            session.CurrentRound++;
            session.Phase = GamePhase.Idle;
            session.SelectedCellId = null;
            session.Question = new SelectedQuestion();
            session.Buzzer.Reset();
            session.RoundWinner = null;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public bool ResetGame(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            session.Phase = GamePhase.Lobby;
            session.Grid = new List<List<HexCell>>();
            session.CurrentRound = 1;
            session.OrangeScore = 0;
            session.GreenScore = 0;
            session.SelectedCellId = null;
            session.Question = new SelectedQuestion();
            session.Buzzer.Reset();
            session.RoundWinner = null;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    // ─── Buzzer ─────────────────────────────────────────────

    public bool Buzz(string sessionId, string connectionId, string? playerName)
    {
        var session = GetSession(sessionId);
        if (session == null) return false;

        lock (_lock)
        {
            if (session.Buzzer.BuzzerLocked) return false;

            var player = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player == null) return false;

            var team = player.Role == PlayerRole.TeamOrange ? "orange"
                     : player.Role == PlayerRole.TeamGreen ? "green"
                     : null;
            if (team == null) return false;

            session.Buzzer.BuzzedTeam = team;
            session.Buzzer.BuzzedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            session.Buzzer.BuzzedPlayerName = playerName ?? player.Name;
            session.Buzzer.BuzzedPlayerId = player.Id;
            session.Buzzer.BuzzerLocked = true;
            IncrementVersionAndSave(session);
            return true;
        }
    }

    public void ResetBuzzer(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            session.Buzzer.Reset();
            IncrementVersionAndSave(session);
        }
    }

    public void PassToOtherTeam(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            session.Buzzer.PassedToOtherTeamAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            IncrementVersionAndSave(session);
        }
    }

    public void OpenBuzzer(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return;
        
        // Only allow buzzer to open when a letter is selected
        if (session.Phase != GamePhase.Selected) return;

        lock (_lock)
        {
            // Use the Open method which properly resets the buzzer state
            session.Buzzer.Open();
            IncrementVersionAndSave(session);
        }
    }

    public void UpdateTimerConfig(string sessionId, int? timerFirst, int? timerSecond)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            if (timerFirst.HasValue) session.Buzzer.BuzzerTimerFirst = Math.Clamp(timerFirst.Value, 1, 60);
            if (timerSecond.HasValue) session.Buzzer.BuzzerTimerSecond = Math.Clamp(timerSecond.Value, 1, 60);
            IncrementVersionAndSave(session);
        }
    }

    public void UpdateSettings(string sessionId, int? gridSize, int? totalRounds)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            if (gridSize.HasValue) session.GridSize = Math.Clamp(gridSize.Value, 4, 6);
            if (totalRounds.HasValue) session.TotalRounds = Math.Clamp(totalRounds.Value, 2, 6);
            IncrementVersionAndSave(session);
        }
    }

    // ─── Grid Generation ────────────────────────────────────

    public static List<List<HexCell>> CreateGrid(int size)
    {
        var totalCells = size * size;
        var letters = new List<string>();

        // Fill with Arabic letters, cycling if grid > 25
        while (letters.Count < totalCells)
        {
            letters.AddRange(ArabicLetters);
        }

        // Take exactly what we need and shuffle
        var selected = letters.Take(totalCells).ToList();
        var rng = Random.Shared;
        for (int i = selected.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (selected[i], selected[j]) = (selected[j], selected[i]);
        }

        var grid = new List<List<HexCell>>();
        for (int row = 0; row < size; row++)
        {
            var rowList = new List<HexCell>();
            for (int col = 0; col < size; col++)
            {
                rowList.Add(new HexCell
                {
                    Id = $"{row}-{col}",
                    Row = row,
                    Col = col,
                    Letter = selected[row * size + col],
                    Owner = null,
                    IsSelected = false
                });
            }
            grid.Add(rowList);
        }

        return grid;
    }

    // ─── Win Check (BFS) ────────────────────────────────────

    public static bool CheckWin(List<List<HexCell>> grid, string team, int gridSize)
    {
        if (team == "orange")
        {
            // Orange: connect left (col=0) to right (col=gridSize-1)
            var starts = grid.SelectMany(r => r)
                .Where(c => c.Col == 0 && c.Owner == "orange").ToList();
            return BfsReach(grid, starts, "orange", c => c.Col == gridSize - 1, gridSize);
        }
        else
        {
            // Green: connect top (row=0) to bottom (row=gridSize-1)
            var starts = grid[0].Where(c => c.Owner == "green").ToList();
            return BfsReach(grid, starts, "green", c => c.Row == gridSize - 1, gridSize);
        }
    }

    private static bool BfsReach(List<List<HexCell>> grid, List<HexCell> starts,
                                 string team, Func<HexCell, bool> goal, int gridSize)
    {
        var visited = new HashSet<string>();
        var queue = new Queue<HexCell>();

        foreach (var s in starts)
        {
            visited.Add(s.Id);
            queue.Enqueue(s);
        }

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (goal(current)) return true;

            foreach (var (nr, nc) in GetNeighbors(current.Row, current.Col, gridSize))
            {
                var neighbor = grid[nr][nc];
                if (!visited.Contains(neighbor.Id) && neighbor.Owner == team)
                {
                    visited.Add(neighbor.Id);
                    queue.Enqueue(neighbor);
                }
            }
        }

        return false;
    }

    private static IEnumerable<(int, int)> GetNeighbors(int row, int col, int gridSize)
    {
        var isOddRow = row % 2 == 1;
        (int, int)[] directions = isOddRow
            ? [(-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0), (1, 1)]
            : [(-1, -1), (-1, 0), (0, -1), (0, 1), (1, -1), (1, 0)];

        foreach (var (dr, dc) in directions)
        {
            var nr = row + dr;
            var nc = col + dc;
            if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize)
                yield return (nr, nc);
        }
    }

    // ─── DTO Conversion ─────────────────────────────────────

    public static SessionStateDto ToStateDto(GameSession session)
    {
        return new SessionStateDto
        {
            SessionId = session.Id,
            HostPlayerId = session.HostPlayerId,
            GridSize = session.GridSize,
            TotalRounds = session.TotalRounds,
            CurrentRound = session.CurrentRound,
            MaxPlayersPerTeam = session.MaxPlayersPerTeam,
            Phase = session.Phase.ToString().ToLowerInvariant(),
            Grid = session.Grid,
            Players = session.Players.Select(p => new PlayerDto
            {
                Id = p.Id,
                Name = p.Name,
                Role = p.Role.ToString().ToLowerInvariant()
            }).ToList(),
            OrangeScore = session.OrangeScore,
            GreenScore = session.GreenScore,
            SelectedCellId = session.SelectedCellId,
            Question = session.Question,
            Buzzer = session.Buzzer,
            RoundWinner = session.RoundWinner,
            Version = session.Version
        };
    }

    public static LobbyStateDto ToLobbyDto(GameSession session)
    {
        return new LobbyStateDto
        {
            SessionId = session.Id,
            HostPlayerId = session.HostPlayerId,
            GridSize = session.GridSize,
            TotalRounds = session.TotalRounds,
            MaxPlayersPerTeam = session.MaxPlayersPerTeam,
            Players = session.Players.Select(p => new PlayerDto
            {
                Id = p.Id,
                Name = p.Name,
                Role = p.Role.ToString().ToLowerInvariant()
            }).ToList()
        };
    }

    // ─── Connection Tracking ────────────────────────────────

    // Find which session a connection belongs to
    private readonly ConcurrentDictionary<string, string> _connectionToSession = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _saveTokens = new();

    public void TrackConnection(string connectionId, string sessionId)
    {
        _connectionToSession[connectionId] = sessionId;
    }

    public string? GetSessionForConnection(string connectionId)
    {
        return _connectionToSession.GetValueOrDefault(connectionId);
    }

    public void UntrackConnection(string connectionId)
    {
        _connectionToSession.TryRemove(connectionId, out _);
    }

    public void DestroySession(string sessionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        lock (_lock)
        {
            // Untrack all player connections
            foreach (var player in session.Players)
            {
                _connectionToSession.TryRemove(player.ConnectionId, out _);
            }
        }

        RemoveSessionAndDelete(sessionId, session);
    }

    // ─── Persistence Methods ───────────────────────────────

    private async Task LoadPersistedSessionsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        try
        {
            // Clear all sessions on backend restart
            await dbContext.PersistedSessions.ExecuteDeleteAsync();
            Console.WriteLine("[SessionManager] Cleared all persisted sessions on startup.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SessionManager] Error clearing persisted sessions: {ex.Message}");
        }
    }

    private async Task SaveSessionAsync(GameSession session)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        // Try to get from cache first to avoid database query
        var persisted = _persistedCache.GetValueOrDefault(session.Id);
        var isNew = persisted == null;
        
        if (persisted == null)
        {
            persisted = new PersistedSession
            {
                Id = session.Id,
                CreatedAt = DateTime.UtcNow
            };
            _persistedCache[session.Id] = persisted;
        }
        
        // Update all fields
        persisted.HostPlayerId = session.HostPlayerId ?? "";
        persisted.GridSize = session.GridSize;
        persisted.TotalRounds = session.TotalRounds;
        persisted.CurrentRound = session.CurrentRound;
        persisted.MaxPlayersPerTeam = session.MaxPlayersPerTeam;
        persisted.Phase = session.Phase.ToString().ToLowerInvariant();
        persisted.SerializedGrid = JsonSerializer.Serialize(session.Grid);
        persisted.SerializedPlayers = JsonSerializer.Serialize(session.Players);
        persisted.OrangeScore = session.OrangeScore;
        persisted.GreenScore = session.GreenScore;
        persisted.SelectedCellId = session.SelectedCellId;
        persisted.SerializedQuestion = JsonSerializer.Serialize(session.Question);
        persisted.SerializedBuzzer = JsonSerializer.Serialize(session.Buzzer);
        persisted.RoundWinner = session.RoundWinner;
        persisted.Version = session.Version;
        persisted.PasswordHash = session.PasswordHash;
        persisted.LastActivityAt = DateTime.UtcNow;
        persisted.ExpiresAt = DateTime.UtcNow.AddHours(2);
        
        // Use AsNoTracking for reads and explicit Update for writes to avoid tracking overhead
        if (isNew)
        {
            dbContext.PersistedSessions.Add(persisted);
        }
        else
        {
            dbContext.PersistedSessions.Update(persisted);
        }
        
        await dbContext.SaveChangesAsync();
    }

    private async Task DeletePersistedSessionAsync(string sessionId)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        // Remove from cache
        _persistedCache.TryRemove(sessionId, out _);
        
        // Use ExecuteDeleteAsync for better performance (EF Core 7+)
        await dbContext.PersistedSessions
            .Where(s => s.Id == sessionId)
            .ExecuteDeleteAsync();
    }

    private void CleanupExpiredSessions(object? state)
    {
        _ = CleanupExpiredSessionsAsync();
    }

    private async Task CleanupExpiredSessionsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        
        var expiredIds = await dbContext.PersistedSessions
            .Where(s => s.ExpiresAt <= DateTime.UtcNow)
            .Select(s => s.Id)
            .ToListAsync();
        
        foreach (var expiredId in expiredIds)
        {
            _sessions.TryRemove(expiredId, out _);
            _persistedCache.TryRemove(expiredId, out _);
        }
        
        if (expiredIds.Count > 0)
        {
            await dbContext.PersistedSessions
                .Where(s => s.ExpiresAt <= DateTime.UtcNow)
                .ExecuteDeleteAsync();
        }
    }

    // ─── Helpers ────────────────────────────────────────────

    /// <summary>Flatten the 2D grid into a single enumerable. Avoids repeated SelectMany calls.</summary>
    private static IEnumerable<HexCell> FlatGrid(GameSession session) =>
        session.Grid.SelectMany(r => r);

    private void IncrementVersionAndSave(GameSession session)
    {
        session.Version++;
        
        // Cancel any pending save for this session
        if (_saveTokens.TryRemove(session.Id, out var oldToken))
        {
            oldToken.Cancel();
        }
        
        // Create a new cancellation token
        var newToken = new CancellationTokenSource();
        _saveTokens[session.Id] = newToken;
        
        // Debounce save - wait 500ms before actually saving
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(500, newToken.Token);
                if (!newToken.Token.IsCancellationRequested)
                {
                    await SaveSessionAsync(session);
                }
            }
            catch (OperationCanceledException) { /* Debounce cancelled — expected */ }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[SessionManager] Error saving session {session.Id}: {ex.Message}");
            }
            finally
            {
                _saveTokens.TryRemove(session.Id, out _);
                newToken.Dispose();
            }
        });
    }

    private void RemoveSessionAndDelete(string sessionId, GameSession session)
    {
        // Cancel any pending save
        if (_saveTokens.TryRemove(session.Id, out var token))
        {
            token.Cancel();
            token.Dispose();
        }
        
        _sessions.TryRemove(sessionId, out _);
        _ = Task.Run(() => DeletePersistedSessionAsync(sessionId));
    }

    private static string GenerateSessionId()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var id = new char[6];
        for (int i = 0; i < 6; i++)
            id[i] = chars[Random.Shared.Next(chars.Length)];
        return new string(id);
    }

    private static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    private static string NormalizePlayerName(string name)
    {
        var normalized = (name ?? string.Empty).Trim();
        if (normalized.Length == 0) return "لاعب";
        if (normalized.Length > 24) return normalized[..24];
        return normalized;
    }
}
