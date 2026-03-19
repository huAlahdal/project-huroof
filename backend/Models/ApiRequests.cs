namespace Backend.Models;

// ─── Admin Request Models ──────────────────────────────────

public sealed record AdminSessionSettingsRequest(int? GridSize, int? TotalRounds);
public sealed record AdminSessionStartRequest(int? GridSize, int? TotalRounds, int? TimerFirst, int? TimerSecond);
public sealed record AdminPlayerUpdateRequest(string? Name, string? Role);
public sealed record AdminUserUpdateRequest(string? InGameName, string? Email, string? Username, string? Role, bool? IsActive);
public sealed record AdminResetPasswordRequest(string NewPassword);

// ─── Auth Request Models ───────────────────────────────────

public sealed record GuestRequest(string? Name);
public sealed record RegisterRequest(string Email, string InGameName, string Password);
public sealed record LoginRequest(string EmailOrUsername, string Password);
public sealed record UpdateProfileRequest(string? Username, string? InGameName, string? Email);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

// ─── Question Request Models ───────────────────────────────

public sealed record CreateQuestionRequest
{
    public string? Letter { get; init; }
    public string Question { get; init; } = "";
    public string Answer { get; init; } = "";
    public string? Category { get; init; }
    public string? Difficulty { get; init; }
}

public sealed record UpdateQuestionRequest
{
    public string? Letter { get; init; }
    public string? Question { get; init; }
    public string? Answer { get; init; }
    public string? Category { get; init; }
    public string? Difficulty { get; init; }
}
