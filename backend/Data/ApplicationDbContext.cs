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
    public DbSet<User> Users { get; set; } = null!;
    
    // Future features — tables exist via migrations but are not yet used by any service
    public DbSet<SessionPlayer> SessionPlayers { get; set; } = null!;
    public DbSet<GameHistory> GameHistories { get; set; } = null!;
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // ─── User ───────────────────────────────────────────
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Id)
                .HasMaxLength(8)
                .ValueGeneratedNever();
                
            entity.Property(e => e.Email)
                .IsRequired()
                .HasMaxLength(100);
                
            entity.Property(e => e.Username)
                .IsRequired()
                .HasMaxLength(24);
                
            entity.Property(e => e.InGameName)
                .IsRequired()
                .HasMaxLength(24);
                
            entity.Property(e => e.PasswordHash)
                .IsRequired();
                
            entity.Property(e => e.Role)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(10)
                .HasDefaultValue(UserRole.Player);
                
            entity.Property(e => e.GamesPlayed)
                .HasDefaultValue(0);
                
            entity.Property(e => e.GamesWon)
                .HasDefaultValue(0);
                
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true);
                
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("datetime('now')");
                
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Username).IsUnique();
        });
        
        // ─── SessionPlayer ──────────────────────────────────
        modelBuilder.Entity<SessionPlayer>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();
            
            entity.Property(e => e.SessionId)
                .IsRequired()
                .HasMaxLength(10);
                
            entity.Property(e => e.UserId)
                .IsRequired()
                .HasMaxLength(8);
                
            entity.Property(e => e.Role)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("spectator");
                
            entity.Property(e => e.IsHost)
                .HasDefaultValue(false);
                
            entity.Property(e => e.IsConnected)
                .HasDefaultValue(false);
                
            entity.Property(e => e.JoinedAt)
                .HasDefaultValueSql("datetime('now')");
                
            entity.HasIndex(e => new { e.SessionId, e.UserId }).IsUnique();
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.UserId);
            
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ─── GameHistory ────────────────────────────────────
        modelBuilder.Entity<GameHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();
                
            entity.Property(e => e.SessionId)
                .IsRequired()
                .HasMaxLength(10);
                
            entity.Property(e => e.UserId)
                .IsRequired()
                .HasMaxLength(8);
                
            entity.Property(e => e.Team)
                .IsRequired()
                .HasMaxLength(20);
                
            entity.Property(e => e.CompletedAt)
                .HasDefaultValueSql("datetime('now')");
                
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.CompletedAt);
            
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // ─── Question ───────────────────────────────────────
        modelBuilder.Entity<Question>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            entity.Property(e => e.Id)
                .ValueGeneratedNever();
                
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
        
        // ─── PersistedSession ───────────────────────────────
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
                .HasMaxLength(100); // nullable now — optional password
                
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
