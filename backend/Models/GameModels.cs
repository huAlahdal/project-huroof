namespace Backend.Models;

// ─── Enums ──────────────────────────────────────────────────

public enum GamePhase
{
    Lobby,
    Idle,           // Waiting to pick a letter
    Selected,       // Letter chosen, question shown
    BetweenRounds,  // Round summary
    Win             // Game over
}

public enum PlayerRole
{
    Spectator,
    TeamOrange,
    TeamGreen,
    GameMaster
}

// ─── Hex Grid ───────────────────────────────────────────────

public class HexCell
{
    public string Id { get; set; } = "";
    public int Row { get; set; }
    public int Col { get; set; }
    public string Letter { get; set; } = "";
    public string? Owner { get; set; } // "orange" | "green" | null
    public bool IsSelected { get; set; }
}

// ─── Buzzer State ───────────────────────────────────────────

public class BuzzerState
{
    public string? BuzzedTeam { get; set; }         // "orange" | "green" | null
    public long? BuzzedAt { get; set; }
    public string? BuzzedPlayerName { get; set; }
    public string? BuzzedPlayerId { get; set; }
    public bool BuzzerLocked { get; set; }
    public int BuzzerTimerFirst { get; set; } = 5;
    public int BuzzerTimerSecond { get; set; } = 10;
    public long? PassedToOtherTeamAt { get; set; }
    public string? PassedToTeam { get; set; }       // "orange" | "green" | null — restricts buzzer to this team only
    public bool BuzzerIsOpenMode { get; set; }
    
    // Server-calculated remaining time in seconds
    public int? RemainingSeconds { get; set; }
    public string? TimerPhase { get; set; } // "first" | "second" | "expired" | "open"

    public void Reset()
    {
        BuzzedTeam = null;
        BuzzedAt = null;
        BuzzedPlayerName = null;
        BuzzedPlayerId = null;
        BuzzerLocked = false;
        PassedToOtherTeamAt = null;
        PassedToTeam = null;
        BuzzerIsOpenMode = false;
        RemainingSeconds = null;
        TimerPhase = null;
    }

    public void Open()
    {
        BuzzedTeam = null;
        BuzzedAt = null;
        BuzzedPlayerName = null;
        BuzzedPlayerId = null;
        BuzzerLocked = false;
        PassedToOtherTeamAt = null;
        PassedToTeam = null;
        BuzzerIsOpenMode = true;
        RemainingSeconds = null;
        TimerPhase = "open";
    }

    public void UpdateTimerState()
    {
        // If buzzer was passed to the other team, compute the second-phase timer
        // even if BuzzerLocked is false (unlocked for the other team to press)
        if (PassedToOtherTeamAt.HasValue)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            // If the other team already buzzed (BuzzerLocked is true), show first-phase timer for them
            if (BuzzerLocked && BuzzedAt.HasValue && BuzzedAt.Value > PassedToOtherTeamAt.Value)
            {
                var elapsedSinceBuzz = (now - BuzzedAt.Value) / 1000.0;
                if (elapsedSinceBuzz < BuzzerTimerFirst)
                {
                    TimerPhase = "first";
                    RemainingSeconds = (int)Math.Ceiling(BuzzerTimerFirst - elapsedSinceBuzz);
                }
                else
                {
                    TimerPhase = "expired";
                    RemainingSeconds = 0;
                }
                return;
            }

            // Other team hasn't buzzed yet — show second-phase countdown
            var elapsedSincePass = (now - PassedToOtherTeamAt.Value) / 1000.0;
            if (elapsedSincePass < BuzzerTimerSecond)
            {
                TimerPhase = "second";
                RemainingSeconds = (int)Math.Ceiling(BuzzerTimerSecond - elapsedSincePass);
            }
            else
            {
                TimerPhase = "open";
                RemainingSeconds = 0;
            }
            return;
        }

        if (!BuzzedAt.HasValue || !BuzzerLocked)
        {
            RemainingSeconds = null;
            TimerPhase = null;
            return;
        }

        var now2 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // No pass yet — evaluate the first timer.
        var elapsed = (now2 - BuzzedAt.Value) / 1000.0;
        if (elapsed < BuzzerTimerFirst)
        {
            TimerPhase = "first";
            RemainingSeconds = (int)Math.Ceiling(BuzzerTimerFirst - elapsed);
        }
        else
        {
            TimerPhase = "expired";
            RemainingSeconds = 0;
        }
    }
}

// ─── Player ─────────────────────────────────────────────────

public class Player
{
    public string Id { get; set; } = "";           // Generated unique ID
    public string? UserId { get; set; }              // Linked user account ID
    public string ConnectionId { get; set; } = ""; // SignalR connection ID
    public string Name { get; set; } = "";
    public PlayerRole Role { get; set; } = PlayerRole.Spectator;
    public int AnswersCount { get; set; } = 0; // Track answers within the session
}

// ─── Question ───────────────────────────────────────────────

public class SelectedQuestion
{
    public string? Letter { get; set; }
    public string? QuestionText { get; set; }
    public string? AnswerText { get; set; }
    public string? Category { get; set; }
    public string? Difficulty { get; set; }
    public bool ShowQuestion { get; set; }
}

// ─── Game Session ───────────────────────────────────────────

public class GameSession
{
    public string Id { get; set; } = "";
    public string? PasswordHash { get; set; }       // null = public session (no password)
    public string? CreatedByUserId { get; set; }    // User who created the session
    public string? HostPlayerId { get; set; }
    public int GridSize { get; set; } = 5;         // 4, 5, or 6
    public int TotalRounds { get; set; } = 2;
    public int CurrentRound { get; set; } = 1;
    public int MaxPlayersPerTeam { get; set; } = 2; // Configurable by game master
    public GamePhase Phase { get; set; } = GamePhase.Lobby;

    public List<List<HexCell>> Grid { get; set; } = new();
    public List<Player> Players { get; set; } = new();

    public int OrangeScore { get; set; }
    public int GreenScore { get; set; }

    /// <summary>IDs of questions that have been used/answered in this session (for GM reference).</summary>
    public HashSet<string> UsedQuestionIds { get; set; } = new();

    public string? SelectedCellId { get; set; }
    public SelectedQuestion Question { get; set; } = new();
    public BuzzerState Buzzer { get; set; } = new();

    public string? RoundWinner { get; set; } // "orange" | "green" | "draw" | null

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int Version { get; set; }
}

// ─── DTOs ───────────────────────────────────────────────────

public class SessionStateDto
{
    public string SessionId { get; set; } = "";
    public string? HostPlayerId { get; set; }
    public int GridSize { get; set; }
    public int TotalRounds { get; set; }
    public int CurrentRound { get; set; }
    public int MaxPlayersPerTeam { get; set; } = 2;
    public string Phase { get; set; } = "";
    public List<List<HexCell>> Grid { get; set; } = new();
    public List<PlayerDto> Players { get; set; } = new();
    public int OrangeScore { get; set; }
    public int GreenScore { get; set; }
    public string? SelectedCellId { get; set; }
    public SelectedQuestion Question { get; set; } = new();
    public BuzzerState Buzzer { get; set; } = new();
    public string? RoundWinner { get; set; }
    public HashSet<string> UsedQuestionIds { get; set; } = new();
    public int Version { get; set; }
}

public class PlayerDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public int AnswersCount { get; set; } = 0;
    public bool IsOnline { get; set; } = true;
}

public class LobbyStateDto
{
    public string SessionId { get; set; } = "";
    public string? HostPlayerId { get; set; }
    public int GridSize { get; set; }
    public int TotalRounds { get; set; }
    public int MaxPlayersPerTeam { get; set; } = 2;
    public List<PlayerDto> Players { get; set; } = new();
}
