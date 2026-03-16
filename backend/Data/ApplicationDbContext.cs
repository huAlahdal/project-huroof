using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }
    
    public DbSet<Question> Questions { get; set; } = null!;
    public DbSet<PersistedSession> PersistedSessions { get; set; } = null!;
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.Entity<Question>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();
                
            entity.Property(e => e.Letter)
                .IsRequired()
                .HasMaxLength(1);
                
            entity.Property(e => e.QuestionText)
                .IsRequired();
                
            entity.Property(e => e.Answer)
                .IsRequired();
                
            entity.Property(e => e.Category)
                .IsRequired()
                .HasMaxLength(50)
                .HasDefaultValue("عام");
                
            entity.Property(e => e.Difficulty)
                .IsRequired()
                .HasDefaultValue("medium");
                
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("datetime('now')");
                
            // Performance indexes for common queries
            entity.HasIndex(e => e.Letter);
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.Difficulty);
            entity.HasIndex(e => new { e.Letter, e.Category });
        });
        
        modelBuilder.Entity<PersistedSession>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Id)
                .HasMaxLength(10);
                
            entity.Property(e => e.HostPlayerId)
                .IsRequired()
                .HasMaxLength(8);
                
            entity.Property(e => e.Phase)
                .IsRequired()
                .HasMaxLength(20);
                
            entity.Property(e => e.SerializedGrid)
                .IsRequired();
                
            entity.Property(e => e.SerializedPlayers)
                .IsRequired();
                
            entity.Property(e => e.SerializedQuestion)
                .IsRequired();
                
            entity.Property(e => e.SerializedBuzzer)
                .IsRequired();
                
            entity.Property(e => e.PasswordHash)
                .IsRequired()
                .HasMaxLength(64);
                
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("datetime('now')");
                
            entity.Property(e => e.LastActivityAt)
                .HasDefaultValueSql("datetime('now')");
                
            entity.HasIndex(e => e.ExpiresAt);
            entity.HasIndex(e => e.LastActivityAt);
            entity.HasIndex(e => e.Phase);
        });
    }
}
