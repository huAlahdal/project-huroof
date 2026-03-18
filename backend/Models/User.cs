using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public enum UserRole
{
    Player,
    Admin
}

public class User
{
    public string Id { get; set; } = "";

    [Required]
    [MaxLength(100)]
    public string Email { get; set; } = "";

    [Required]
    [MaxLength(24)]
    public string Username { get; set; } = "";

    [Required]
    [MaxLength(24)]
    public string InGameName { get; set; } = "";

    [Required]
    public string PasswordHash { get; set; } = "";

    public UserRole Role { get; set; } = UserRole.Player;

    public int GamesPlayed { get; set; }
    public int GamesWon { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;

    public bool IsActive { get; set; } = true;
}
