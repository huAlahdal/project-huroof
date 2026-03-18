using System.Text.Json.Serialization;

namespace Backend.Models;

public class PersistedSession
{
    public string Id { get; set; } = null!;
    public string HostPlayerId { get; set; } = null!;
    public string? CreatedByUserId { get; set; }
    public int GridSize { get; set; }
    public int TotalRounds { get; set; }
    public int CurrentRound { get; set; }
    public int MaxPlayersPerTeam { get; set; }
    public string Phase { get; set; } = null!;
    public string SerializedGrid { get; set; } = null!;
    public string SerializedPlayers { get; set; } = null!;
    public int OrangeScore { get; set; }
    public int GreenScore { get; set; }
    public string? SelectedCellId { get; set; }
    public string SerializedQuestion { get; set; } = null!;
    public string SerializedBuzzer { get; set; } = null!;
    public string? RoundWinner { get; set; }
    public int Version { get; set; }
    public string? PasswordHash { get; set; } // Optional — null means public session
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivityAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
