using System.ComponentModel.DataAnnotations;

namespace Backend.Models;

public class Question
{
    public string Id { get; init; } = "";
    
    [Required]
    [MaxLength(1)]
    public string Letter { get; init; } = "";
    
    [Required]
    public string QuestionText { get; init; } = "";
    
    [Required]
    public string Answer { get; init; } = "";
    
    [Required]
    [MaxLength(50)]
    public string Category { get; init; } = "عام";
    
    [Required]
    public string Difficulty { get; init; } = "medium";
    
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; init; }
}
