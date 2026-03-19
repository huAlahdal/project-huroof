namespace Backend.Models;

public class SessionPlayer
{
    public int Id { get; set; }

    public string SessionId { get; set; } = "";

    public string UserId { get; set; } = "";

    public string Role { get; set; } = "spectator"; // spectator, teamorange, teamgreen, gamemaster

    public bool IsHost { get; set; }

    public bool IsConnected { get; set; }

    public string? ConnectionId { get; set; }

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LeftAt { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
}
