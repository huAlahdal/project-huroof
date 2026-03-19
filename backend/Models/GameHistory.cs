namespace Backend.Models;

public class GameHistory
{
    public int Id { get; set; }

    public string SessionId { get; set; } = "";

    public string UserId { get; set; } = "";

    public string Team { get; set; } = ""; // orange, green, spectator, gamemaster

    public bool Won { get; set; }

    public int FinalScoreOrange { get; set; }

    public int FinalScoreGreen { get; set; }

    public int Rounds { get; set; }

    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
