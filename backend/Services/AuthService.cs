using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Services;

public class AuthService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly string _jwtSecret;
    private readonly string _jwtIssuer;

    public AuthService(IServiceProvider serviceProvider, IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _jwtSecret = config["Jwt:Secret"] ?? "HuroofGameDefaultSecretKey_ChangeInProduction_2026!";
        _jwtIssuer = config["Jwt:Issuer"] ?? "huroof-backend";
    }

    // ─── Registration ───────────────────────────────────────

    public async Task<(User? user, string? error)> RegisterAsync(string email, string inGameName, string password)
    {
        // Validation
        email = email.Trim().ToLowerInvariant();
        inGameName = inGameName.Trim();

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || !email.Contains('.'))
            return (null, "البريد الإلكتروني غير صالح");

        if (string.IsNullOrWhiteSpace(inGameName) || inGameName.Length < 2 || inGameName.Length > 24)
            return (null, "الاسم في اللعبة يجب أن يكون بين 2 و 24 حرفاً");

        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
            return (null, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        if (await db.Users.AnyAsync(u => u.Email == email))
            return (null, "البريد الإلكتروني مسجل مسبقاً");

        // Auto-derive a unique username from the email prefix
        var baseUsername = System.Text.RegularExpressions.Regex.Replace(
            email.Split('@')[0], @"[^a-zA-Z0-9_]", "");
        if (baseUsername.Length < 2) baseUsername = "user";
        if (baseUsername.Length > 20) baseUsername = baseUsername[..20];

        var username = baseUsername;
        var suffix = 1;
        while (await db.Users.AnyAsync(u => u.Username.ToLower() == username.ToLower()))
            username = baseUsername + suffix++;

        var user = new User
        {
            Id = Guid.NewGuid().ToString("N")[..8],
            Email = email,
            Username = username,
            InGameName = inGameName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Player,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return (user, null);
    }

    // ─── Login ──────────────────────────────────────────────

    public async Task<(User? user, string? error)> LoginAsync(string emailOrUsername, string password)
    {
        if (string.IsNullOrWhiteSpace(emailOrUsername) || string.IsNullOrWhiteSpace(password))
            return (null, "البريد الإلكتروني/اسم المستخدم وكلمة المرور مطلوبان");

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var normalized = emailOrUsername.Trim().ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Email == normalized || u.Username.ToLower() == normalized);

        if (user == null)
            return (null, "بيانات الدخول غير صحيحة");

        if (!user.IsActive)
            return (null, "الحساب معطّل");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return (null, "بيانات الدخول غير صحيحة");

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        db.Users.Update(user);
        await db.SaveChangesAsync();

        return (user, null);
    }

    // ─── JWT Token ──────────────────────────────────────────

    public string GenerateToken(User user)
    {
        return CreateJwt(
        [
            new(ClaimTypes.NameIdentifier, user.Id),
            new("username", user.Username),
            new("inGameName", user.InGameName),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString())
        ], TimeSpan.FromDays(7));
    }

    // ─── Get User By ID ─────────────────────────────────────

    public async Task<User?> GetUserByIdAsync(string userId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
    }

    // ─── Update Profile ─────────────────────────────────────

    public async Task<(User? user, string? error)> UpdateProfileAsync(string userId, string? inGameName, string? email)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FindAsync(userId);
        if (user == null) return (null, "المستخدم غير موجود");

        if (!string.IsNullOrWhiteSpace(inGameName))
        {
            inGameName = inGameName.Trim();
            if (inGameName.Length < 2 || inGameName.Length > 24)
                return (null, "الاسم داخل اللعبة يجب أن يكون بين 2 و 24 حرفاً");
            user.InGameName = inGameName;
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            email = email.Trim().ToLowerInvariant();
            if (!email.Contains('@') || !email.Contains('.'))
                return (null, "البريد الإلكتروني غير صالح");

            if (await db.Users.AnyAsync(u => u.Email == email && u.Id != userId))
                return (null, "البريد الإلكتروني مسجل مسبقاً");

            user.Email = email;
        }

        db.Users.Update(user);
        await db.SaveChangesAsync();

        return (user, null);
    }

    // ─── Change Password ────────────────────────────────────

    public async Task<string?> ChangePasswordAsync(string userId, string currentPassword, string newPassword)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FindAsync(userId);
        if (user == null) return "المستخدم غير موجود";

        if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            return "كلمة المرور الحالية غير صحيحة";

        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
            return "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل";

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        db.Users.Update(user);
        await db.SaveChangesAsync();

        return null; // success
    }

    // ─── Seed Admin ─────────────────────────────────────────

    public async Task SeedAdminAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        const string adminEmail = "admin@admin.com";
        const string adminUsername = "admin";

        var existing = await db.Users.FirstOrDefaultAsync(u =>
            u.Email == adminEmail || u.Username == adminUsername);

        if (existing != null)
        {
            // Only fix role/active status if needed — don’t reset password on every startup
            if (existing.Role != UserRole.Admin || !existing.IsActive)
            {
                existing.Role = UserRole.Admin;
                existing.IsActive = true;
                db.Users.Update(existing);
                await db.SaveChangesAsync();
            }
            return;
        }

        var admin = new User
        {
            Id = "admin001",
            Email = adminEmail,
            Username = adminUsername,
            InGameName = "مدير النظام",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Huroof1144"),
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
            IsActive = true
        };

        db.Users.Add(admin);
        await db.SaveChangesAsync();
    }

    // ─── Guest Token ────────────────────────────────────────

    public string GenerateGuestToken(string guestName)
    {
        var guestId = "guest_" + Guid.NewGuid().ToString("N")[..8];
        return CreateJwt(
        [
            new(ClaimTypes.NameIdentifier, guestId),
            new("username", guestName),
            new("inGameName", guestName),
            new(ClaimTypes.Email, ""),
            new(ClaimTypes.Role, "Guest")
        ], TimeSpan.FromHours(24));
    }

    /// <summary>Shared JWT creation logic used by both registered and guest tokens.</summary>
    private string CreateJwt(List<Claim> claims, TimeSpan expiry)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _jwtIssuer,
            audience: _jwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.Add(expiry),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ─── Admin: User Management ─────────────────────────────

    public async Task<List<User>> GetAllUsersAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Users.AsNoTracking().OrderByDescending(u => u.CreatedAt).ToListAsync();
    }

    public async Task<(User? user, string? error)> AdminUpdateUserAsync(string userId, string? inGameName, string? email, string? username, string? role, bool? isActive)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = await db.Users.FindAsync(userId);
        if (user == null) return (null, "المستخدم غير موجود");

        if (!string.IsNullOrWhiteSpace(inGameName)) user.InGameName = inGameName.Trim();
        if (!string.IsNullOrWhiteSpace(email))
        {
            email = email.Trim().ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.Email == email && u.Id != userId))
                return (null, "البريد الإلكتروني مسجل مسبقاً");
            user.Email = email;
        }
        if (!string.IsNullOrWhiteSpace(username))
        {
            var lower = username.Trim().ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.Username.ToLower() == lower && u.Id != userId))
                return (null, "اسم المستخدم مستخدم مسبقاً");
            user.Username = username.Trim();
        }
        if (!string.IsNullOrWhiteSpace(role))
        {
            if (Enum.TryParse<UserRole>(role, true, out var parsedRole))
                user.Role = parsedRole;
        }
        if (isActive.HasValue) user.IsActive = isActive.Value;

        db.Users.Update(user);
        await db.SaveChangesAsync();
        return (user, null);
    }

    public async Task<bool> AdminDeleteUserAsync(string userId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        if (user == null) return false;
        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<string?> AdminResetPasswordAsync(string userId, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
            return "كلمة المرور يجب أن تكون 4 أحرف على الأقل";
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.FindAsync(userId);
        if (user == null) return "المستخدم غير موجود";
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        db.Users.Update(user);
        await db.SaveChangesAsync();
        return null;
    }

    // ─── Helpers ────────────────────────────────────────────

    public static string? GetUserIdFromClaims(ClaimsPrincipal? principal)
    {
        return principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    public static bool IsAdminFromClaims(ClaimsPrincipal? principal)
    {
        return principal?.FindFirst(ClaimTypes.Role)?.Value == UserRole.Admin.ToString();
    }
}
