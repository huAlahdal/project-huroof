using Backend.Hubs;
using Backend.Models;
using Backend.Services;
using Backend.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IO.Compression;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add response compression for better performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

// Register services with optimizations
builder.Services.AddSignalR(options =>
{
    // Enable message buffering to batch small messages
    options.EnableDetailedErrors = false;
    
    // Increase max message size if needed (default is 32KB)
    options.MaximumReceiveMessageSize = 128 * 1024; // 128KB
    
    // Keep alive interval to detect disconnections faster
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    
    // Stateful reconnect for better UX
    options.MaximumParallelInvocationsPerClient = 1;
}).AddMessagePackProtocol(); // Use MessagePack for better performance
builder.Services.AddSingleton<SessionManager>();
builder.Services.AddHostedService<BuzzerWatchdog>();
builder.Services.AddSingleton<AuthService>();

// Resolve an absolute path for the SQLite DB so it works correctly on any
// deployed environment regardless of the process working directory.
// AppContext.BaseDirectory is the most reliable anchor under IIS.
var dataDir = Path.Combine(AppContext.BaseDirectory, "Data");
Directory.CreateDirectory(dataDir); // no-op if already exists
var dbPath = Path.Combine(dataDir, "huroof.db");

// Add Entity Framework with optimizations
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlite($"Data Source={dbPath}");
    
    // Performance optimizations
    options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking); // Default to no tracking
    options.EnableSensitiveDataLogging(false); // Disable in production
    options.EnableDetailedErrors(false); // Disable in production
    
    // Connection pooling is automatic with SQLite
}, ServiceLifetime.Scoped);

// ─── JWT Authentication ────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "HuroofGameDefaultSecretKey_ChangeInProduction_2026!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "huroof-backend";
var jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtIssuer,
            IssuerSigningKey = jwtKey
        };

        // Allow SignalR to receive JWT from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/gamehub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// CORS — allow all origins (SetIsOriginAllowed(_ => true) is the same as
// AllowAnyOrigin but compatible with AllowCredentials which SignalR needs)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();
var startedAtUtc = DateTime.UtcNow;

// Use response compression
app.UseResponseCompression();

// ── Bullet-proof CORS: guarantee headers on EVERY response (including 500s) ──
app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.FirstOrDefault();

    // 1. Short-circuit OPTIONS preflight immediately
    if (!string.IsNullOrEmpty(origin) &&
        context.Request.Method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = 204;
        context.Response.Headers["Access-Control-Allow-Origin"] = origin;
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
        context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept";
        context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        context.Response.Headers["Access-Control-Max-Age"] = "86400";
        context.Response.Headers["Vary"] = "Origin";
        return;
    }

    // 2. Ensure CORS headers get written even on error responses
    if (!string.IsNullOrEmpty(origin))
    {
        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey("Access-Control-Allow-Origin"))
            {
                context.Response.Headers["Access-Control-Allow-Origin"] = origin;
                context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
                context.Response.Headers["Vary"] = "Origin";
            }
            return Task.CompletedTask;
        });
    }

    await next();
});

// Global exception handler
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exceptionFeature = context.Features.Get<IExceptionHandlerPathFeature>();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        // Always include detail so you can debug on IIS
        var response = new
        {
            error = "Internal server error",
            detail = exceptionFeature?.Error?.Message,
            type = exceptionFeature?.Error?.GetType().Name
        };
        await context.Response.WriteAsJsonAsync(response);
    });
});

app.UseRouting();

// UseCors MUST go between UseRouting and UseAuthorization
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        // Migration can fail when the DB is in a half-migrated state (e.g.
        // some tables already exist from a previous failed attempt).
        // Fall back to EnsureCreated which will create any missing tables.
        Console.Error.WriteLine($"[Startup] DB migration warning: {ex.Message}");
        try
        {
            Console.Error.WriteLine("[Startup] Falling back to EnsureCreated to create missing tables...");
            db.Database.EnsureCreated();
            Console.Error.WriteLine("[Startup] EnsureCreated completed successfully.");
        }
        catch (Exception ex2)
        {
            Console.Error.WriteLine($"[Startup] EnsureCreated also failed: {ex2.Message}");
        }
    }
}

// Seed default admin user
try
{
    var authService = app.Services.GetRequiredService<AuthService>();
    await authService.SeedAdminAsync();
}
catch (Exception ex)
{
    Console.Error.WriteLine($"[Startup] Admin seed warning: {ex.Message}");
}

// ─── SignalR hub ───────────────────────────────────────────
app.MapHub<GameHub>("/gamehub");

// ─── Health check ──────────────────────────────────────────
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// ─── Auth helpers ──────────────────────────────────────────

bool IsAdmin(HttpRequest request)
{
    var user = request.HttpContext.User;
    if (user?.Identity?.IsAuthenticated != true) return false;
    return AuthService.IsAdminFromClaims(user);
}

string? GetUserId(HttpRequest request)
{
    return AuthService.GetUserIdFromClaims(request.HttpContext.User);
}

bool IsAuthenticated(HttpRequest request)
{
    return request.HttpContext.User?.Identity?.IsAuthenticated == true;
}

IResult Unauthorized() => Results.Json(new { error = "Unauthorized" }, statusCode: 401);

IResult BadRole() => Results.BadRequest(new { error = "Invalid role" });

object ToUserDto(User u) => new
{
    u.Id, u.Email, u.Username, u.InGameName,
    Role = u.Role.ToString().ToLowerInvariant(),
    u.GamesPlayed, u.GamesWon
};

object ToAdminUserDto(User u) => new
{
    u.Id, u.Email, u.Username, u.InGameName,
    Role = u.Role.ToString().ToLowerInvariant(),
    u.GamesPlayed, u.GamesWon, u.IsActive,
    u.CreatedAt, u.LastLoginAt
};

object ToQuestionDto(Question q) => new
{
    q.Id, q.Letter,
    Question = q.QuestionText,
    q.Answer, q.Category, q.Difficulty,
    q.CreatedAt, q.UpdatedAt
};

PlayerRole? ParseRole(string role)
{
    return role.ToLowerInvariant() switch
    {
        "teamorange" => PlayerRole.TeamOrange,
        "teamgreen" => PlayerRole.TeamGreen,
        "gamemaster" => PlayerRole.GameMaster,
        "spectator" => PlayerRole.Spectator,
        _ => null
    };
}

object BuildSessionSummary(GameSession s)
{
    return new
    {
        s.Id,
        s.HostPlayerId,
        s.GridSize,
        s.TotalRounds,
        s.CurrentRound,
        Phase = s.Phase.ToString().ToLowerInvariant(),
        PlayerCount = s.Players.Count,
        Players = s.Players.Select(p => new { p.Id, p.Name, Role = p.Role.ToString().ToLowerInvariant() }),
        s.OrangeScore,
        s.GreenScore,
        CreatedAt = s.CreatedAt,
        Version = s.Version
    };
}

// ═══════════════════════════════════════════════════════════
// ─── Auth Endpoints ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// ─── Guest Token ───────────────────────────────────────────

app.MapPost("/api/auth/guest", async (AuthService auth, HttpRequest req) =>
{
    var body = await req.ReadFromJsonAsync<GuestRequest>();
    var name = body?.Name?.Trim();
    if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 24)
        return Results.BadRequest(new { error = "الاسم يجب أن يكون بين 2 و 24 حرفاً" });

    var token = auth.GenerateGuestToken(name);
    return Results.Ok(new
    {
        token,
        user = new { id = (string?)null, email = (string?)null, username = (string?)null, inGameName = name, role = "guest", gamesPlayed = 0, gamesWon = 0 },
        isGuest = true
    });
});

app.MapPost("/api/auth/register", async (AuthService auth, HttpRequest req) =>
{
    var body = await req.ReadFromJsonAsync<RegisterRequest>();
    if (body == null) return Results.BadRequest(new { error = "بيانات غير صالحة" });

    var (user, error) = await auth.RegisterAsync(body.Email, body.InGameName, body.Password);
    if (user == null) return Results.BadRequest(new { error });

    var token = auth.GenerateToken(user);
    return Results.Ok(new { token, user = ToUserDto(user) });
});

app.MapPost("/api/auth/login", async (AuthService auth, HttpRequest req) =>
{
    var body = await req.ReadFromJsonAsync<LoginRequest>();
    if (body == null) return Results.BadRequest(new { error = "بيانات غير صالحة" });

    var (user, error) = await auth.LoginAsync(body.EmailOrUsername, body.Password);
    if (user == null) return Results.BadRequest(new { error });

    var token = auth.GenerateToken(user);
    return Results.Ok(new { token, user = ToUserDto(user) });
});

app.MapGet("/api/auth/me", async (AuthService auth, HttpRequest req) =>
{
    if (!IsAuthenticated(req)) return Unauthorized();
    var userId = GetUserId(req);
    if (userId == null) return Unauthorized();

    var user = await auth.GetUserByIdAsync(userId);
    if (user == null) return Results.NotFound(new { error = "المستخدم غير موجود" });

    return Results.Ok(ToUserDto(user));
});

app.MapPut("/api/auth/me", async (AuthService auth, HttpRequest req) =>
{
    if (!IsAuthenticated(req)) return Unauthorized();
    var userId = GetUserId(req);
    if (userId == null) return Unauthorized();

    var body = await req.ReadFromJsonAsync<UpdateProfileRequest>();
    if (body == null) return Results.BadRequest(new { error = "بيانات غير صالحة" });

    var (user, error) = await auth.UpdateProfileAsync(userId, body.InGameName, body.Email);
    if (user == null) return Results.BadRequest(new { error });

    var token = auth.GenerateToken(user);
    return Results.Ok(new { token, user = ToUserDto(user) });
});

app.MapPut("/api/auth/me/password", async (AuthService auth, HttpRequest req) =>
{
    if (!IsAuthenticated(req)) return Unauthorized();
    var userId = GetUserId(req);
    if (userId == null) return Unauthorized();

    var body = await req.ReadFromJsonAsync<ChangePasswordRequest>();
    if (body == null) return Results.BadRequest(new { error = "بيانات غير صالحة" });

    var error = await auth.ChangePasswordAsync(userId, body.CurrentPassword, body.NewPassword);
    if (error != null) return Results.BadRequest(new { error });

    return Results.Ok(new { success = true });
});

// ─── Active Session Check ────────────────────────────────────

app.MapGet("/api/sessions/active", (SessionManager sessions, HttpRequest req) =>
{
    if (!IsAuthenticated(req)) return Unauthorized();
    var userId = GetUserId(req);
    if (userId == null) return Unauthorized();

    var result = sessions.FindSessionByUserId(userId);
    if (result == null)
        return Results.Ok(new { inSession = false });

    var (session, player) = result.Value;
    return Results.Ok(new
    {
        inSession = true,
        sessionId = session.Id,
        phase = session.Phase.ToString().ToLowerInvariant(),
        playerId = player.Id,
        playerRole = player.Role.ToString().ToLowerInvariant(),
        playerCount = session.Players.Count(p => !string.IsNullOrEmpty(p.ConnectionId)),
        orangeScore = session.OrangeScore,
        greenScore = session.GreenScore,
    });
});

app.MapPost("/api/sessions/leave", (SessionManager sessions, HttpRequest req) =>
{
    if (!IsAuthenticated(req)) return Unauthorized();
    var userId = GetUserId(req);
    if (userId == null) return Unauthorized();

    var result = sessions.FindSessionByUserId(userId);
    if (result == null)
        return Results.Ok(new { success = true, message = "Not in any session" });

    var (session, _) = result.Value;
    var removed = sessions.RemovePlayerByUserId(session.Id, userId);
    return Results.Ok(new { success = removed, sessionId = session.Id });
});

// ─── Admin: Overview ───────────────────────────────────────

app.MapGet("/api/admin/overview", async (ApplicationDbContext db, SessionManager sessions, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var allSessions = sessions.GetAllSessions().ToList();
    var questionCount = await db.Questions.CountAsync();
    var userCount = await db.Users.CountAsync();
    return Results.Ok(new
    {
        questionCount,
        userCount,
        sessionCount = allSessions.Count,
        playerCount = allSessions.Sum(s => s.Players.Count),
        sessionsByPhase = allSessions
            .GroupBy(s => s.Phase.ToString().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.Count()),
        latestSessions = allSessions
            .OrderByDescending(s => s.CreatedAt)
            .Take(10)
            .Select(BuildSessionSummary)
    });
});

// ─── Public: Questions (for game) ─────────────────────────

// GET questions with filtering (public endpoint for game use)
app.MapGet("/api/questions", async (ApplicationDbContext db, HttpRequest req) =>
{
    var letter    = req.Query["letter"].ToString();
    var category  = req.Query["category"].ToString();
    var difficulty = req.Query["difficulty"].ToString();
    var search    = req.Query["search"].ToString();

    var query = db.Questions.AsQueryable();

    if (!string.IsNullOrWhiteSpace(letter))
        query = query.Where(q => q.Letter.ToLower() == letter.ToLower());

    if (!string.IsNullOrWhiteSpace(category))
        query = query.Where(q => q.Category.ToLower() == category.ToLower());

    if (!string.IsNullOrWhiteSpace(difficulty))
        query = query.Where(q => q.Difficulty.ToLower() == difficulty.ToLower());

    if (!string.IsNullOrWhiteSpace(search))
    {
        var s = search.ToLower();
        query = query.Where(q => q.QuestionText.ToLower().Contains(s) || q.Answer.ToLower().Contains(s));
    }

    var results = await query
        .OrderBy(q => q.Letter)
        .Select(q => new
        {
            q.Id,
            q.Letter,
            Question = q.QuestionText,
            q.Answer,
            q.Category,
            q.Difficulty
        })
        .ToListAsync();

    return Results.Ok(results);
});

// GET random question for a letter (public endpoint)
app.MapGet("/api/questions/random", async (ApplicationDbContext db, HttpRequest req) =>
{
    var letter = req.Query["letter"].ToString();
    if (string.IsNullOrWhiteSpace(letter))
        return Results.BadRequest(new { error = "Letter parameter required" });

    var questions = await db.Questions
        .Where(q => q.Letter.ToLower() == letter.ToLower())
        .Select(q => new
        {
            q.Id,
            q.Letter,
            Question = q.QuestionText,
            q.Answer,
            q.Category,
            q.Difficulty
        })
        .ToListAsync();

    if (questions.Count == 0)
        return Results.NotFound(new { error = "No questions found for this letter" });

    var random = questions[Random.Shared.Next(questions.Count)];
    return Results.Ok(random);
});

// ─── Admin: Authentication (JWT-based) ───────────────────────

app.MapPost("/api/admin/auth", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    return Results.Ok(new { success = true });
});

// ─── Admin: Questions (DB only) ────────────────────────────

// GET all questions
app.MapGet("/api/admin/questions", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var questions = await db.Questions
        .OrderBy(q => q.Letter)
        .ThenBy(q => q.Category)
        .ThenBy(q => q.Difficulty)
        .ToListAsync();
    
    return Results.Ok(questions.Select(ToQuestionDto));
});

// GET question by ID
app.MapGet("/api/admin/questions/{id}", async (string id, ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var question = await db.Questions.FindAsync(id);
    if (question == null) return Results.NotFound();
    
    return Results.Ok(ToQuestionDto(question));
});

// POST create question
app.MapPost("/api/admin/questions", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var model = await req.ReadFromJsonAsync<CreateQuestionRequest>();
    if (model == null || string.IsNullOrWhiteSpace(model.Question) || string.IsNullOrWhiteSpace(model.Answer))
        return Results.BadRequest(new { error = "Question and Answer are required" });
    
    var question = new Question
    {
        Id = Guid.NewGuid().ToString("N")[..8],
        Letter = model.Letter?.ToUpper() ?? "",
        QuestionText = model.Question,
        Answer = model.Answer,
        Category = model.Category ?? "عام",
        Difficulty = model.Difficulty ?? "medium",
        CreatedAt = DateTime.UtcNow
    };
    
    db.Questions.Add(question);
    await db.SaveChangesAsync();
    
    return Results.Created($"/api/admin/questions/{question.Id}", ToQuestionDto(question));
});

// PUT update question
app.MapPut("/api/admin/questions/{id}", async (string id, ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var question = await db.Questions.FindAsync(id);
    if (question == null) return Results.NotFound();
    
    var model = await req.ReadFromJsonAsync<UpdateQuestionRequest>();
    if (model == null) return Results.BadRequest();
    
    var updatedQuestion = new Question
    {
        Id = question.Id,
        Letter = model.Letter ?? question.Letter,
        QuestionText = model.Question ?? question.QuestionText,
        Answer = model.Answer ?? question.Answer,
        Category = model.Category ?? question.Category,
        Difficulty = model.Difficulty ?? question.Difficulty,
        CreatedAt = question.CreatedAt,
        UpdatedAt = DateTime.UtcNow
    };
    
    db.Entry(question).CurrentValues.SetValues(updatedQuestion);
    await db.SaveChangesAsync();
    
    return Results.Ok(ToQuestionDto(updatedQuestion));
});

// DELETE question
app.MapDelete("/api/admin/questions/{id}", async (string id, ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var question = await db.Questions.FindAsync(id);
    if (question == null) return Results.NotFound();
    
    db.Questions.Remove(question);
    await db.SaveChangesAsync();
    
    return Results.NoContent();
});

// POST bulk import (replace all — clears existing, then adds new)
app.MapPost("/api/admin/questions/import", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var items = await req.ReadFromJsonAsync<List<CreateQuestionRequest>>();
    if (items == null) return Results.BadRequest();
    
    // Clear existing questions first
    await db.Questions.ExecuteDeleteAsync();
    
    var questions = items.Select(model => new Question
    {
        Id = Guid.NewGuid().ToString("N")[..8],
        Letter = model.Letter?.ToUpper() ?? "",
        QuestionText = model.Question,
        Answer = model.Answer,
        Category = model.Category ?? "عام",
        Difficulty = model.Difficulty ?? "medium",
        CreatedAt = DateTime.UtcNow
    }).ToList();
    
    await db.Questions.AddRangeAsync(questions);
    await db.SaveChangesAsync();
    
    return Results.Ok(new { count = questions.Count });
});

// GET export questions as JSON file
app.MapGet("/api/admin/questions/export", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var questions = await db.Questions.OrderBy(q => q.Letter).ToListAsync();
    var json = System.Text.Json.JsonSerializer.Serialize(questions.Select(q => new
    {
        q.Id, q.Letter, Question = q.QuestionText, q.Answer, q.Category, q.Difficulty
    }), new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
    return Results.File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", "huroof-questions.json");
});

// GET categories
app.MapGet("/api/admin/questions/categories", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var categories = await db.Questions
        .AsNoTracking()
        .Select(q => q.Category)
        .Distinct()
        .OrderBy(c => c)
        .ToListAsync();
    
    return Results.Ok(categories);
});

// DELETE all questions
app.MapDelete("/api/admin/questions", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var count = await db.Questions.ExecuteDeleteAsync();
    
    return Results.Ok(new { deleted = count });
});

// ─── Admin: Users ──────────────────────────────────────────

app.MapGet("/api/admin/users", async (AuthService auth, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var users = await auth.GetAllUsersAsync();
    return Results.Ok(users.Select(ToAdminUserDto));
});

app.MapPut("/api/admin/users/{userId}", async (string userId, AuthService auth, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var body = await req.ReadFromJsonAsync<AdminUserUpdateRequest>();
    if (body == null) return Results.BadRequest();
    var (user, error) = await auth.AdminUpdateUserAsync(userId, body.InGameName, body.Email, body.Username, body.Role, body.IsActive);
    if (user == null) return Results.BadRequest(new { error });
    return Results.Ok(ToAdminUserDto(user));
});

app.MapDelete("/api/admin/users/{userId}", async (string userId, AuthService auth, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    if (userId == "admin001") return Results.BadRequest(new { error = "لا يمكن حذف المدير الرئيسي" });
    var deleted = await auth.AdminDeleteUserAsync(userId);
    if (!deleted) return Results.NotFound();
    return Results.NoContent();
});

app.MapPut("/api/admin/users/{userId}/password", async (string userId, AuthService auth, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var body = await req.ReadFromJsonAsync<AdminResetPasswordRequest>();
    if (body == null) return Results.BadRequest();
    var error = await auth.AdminResetPasswordAsync(userId, body.NewPassword);
    if (error != null) return Results.BadRequest(new { error });
    return Results.Ok(new { success = true });
});

// ─── Admin: Sessions ───────────────────────────────────────

// GET all active sessions
app.MapGet("/api/admin/sessions", (SessionManager sessions, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var all = sessions.GetAllSessions();
    return Results.Ok(all.Select(BuildSessionSummary));
});

app.MapGet("/api/admin/sessions/{id}", (string id, SessionManager sessions, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();
    return Results.Ok(SessionManager.ToStateDto(session));
});

app.MapPut("/api/admin/sessions/{id}/settings", async (string id, SessionManager sessions, IHubContext<GameHub> hub, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var body = await req.ReadFromJsonAsync<AdminSessionSettingsRequest>();
    if (body == null) return Results.BadRequest();

    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();

    sessions.UpdateSettings(id, body.GridSize, body.TotalRounds);
    session = sessions.GetSession(id)!;

    if (session.Phase == GamePhase.Lobby)
        await hub.Clients.Group(id).SendAsync("LobbyUpdated", SessionManager.ToLobbyDto(session));
    else
        await hub.Clients.Group(id).SendAsync("GameStateUpdated", SessionManager.ToStateDto(session));

    return Results.Ok(BuildSessionSummary(session));
});

app.MapPost("/api/admin/sessions/{id}/reset", async (string id, SessionManager sessions, IHubContext<GameHub> hub, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();

    sessions.ResetGame(id);
    session = sessions.GetSession(id)!;
    await hub.Clients.Group(id).SendAsync("LobbyUpdated", SessionManager.ToLobbyDto(session));
    await hub.Clients.Group(id).SendAsync("GameStateUpdated", SessionManager.ToStateDto(session));
    return Results.Ok(BuildSessionSummary(session));
});

app.MapPost("/api/admin/sessions/{id}/start", async (string id, SessionManager sessions, IHubContext<GameHub> hub, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var body = await req.ReadFromJsonAsync<AdminSessionStartRequest>();
    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();

    var success = sessions.StartGame(id, body?.GridSize, body?.TotalRounds, body?.TimerFirst, body?.TimerSecond);
    if (!success) return Results.BadRequest(new { error = "Failed to start game" });

    session = sessions.GetSession(id)!;
    await hub.Clients.Group(id).SendAsync("GameStateUpdated", SessionManager.ToStateDto(session));
    return Results.Ok(BuildSessionSummary(session));
});

app.MapPut("/api/admin/sessions/{id}/players/{playerId}", async (string id, string playerId, SessionManager sessions, IHubContext<GameHub> hub, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var body = await req.ReadFromJsonAsync<AdminPlayerUpdateRequest>();
    if (body == null) return Results.BadRequest();

    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();

    if (!string.IsNullOrWhiteSpace(body.Name))
    {
        if (!sessions.UpdatePlayerName(id, playerId, body.Name))
            return Results.NotFound();
    }

    if (!string.IsNullOrWhiteSpace(body.Role))
    {
        var parsedRole = ParseRole(body.Role);
        if (!parsedRole.HasValue) return BadRole();
        if (!sessions.SetPlayerRoleById(id, playerId, parsedRole.Value))
            return Results.BadRequest(new { error = "Failed to update player role" });
    }

    session = sessions.GetSession(id)!;
    if (session.Phase == GamePhase.Lobby)
        await hub.Clients.Group(id).SendAsync("LobbyUpdated", SessionManager.ToLobbyDto(session));
    else
        await hub.Clients.Group(id).SendAsync("GameStateUpdated", SessionManager.ToStateDto(session));

    return Results.Ok(BuildSessionSummary(session));
});

app.MapDelete("/api/admin/sessions/{id}/players/{playerId}", async (string id, string playerId, SessionManager sessions, IHubContext<GameHub> hub, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();

    var target = sessions.GetPlayerById(id, playerId);
    if (target == null) return Results.NotFound();
    var success = sessions.RemovePlayerById(id, playerId);
    if (!success) return Results.BadRequest(new { error = "Failed to remove player" });

    await hub.Clients.Client(target.ConnectionId).SendAsync("RemovedFromSession", new { sessionId = id, reason = "admin-kicked" });

    session = sessions.GetSession(id);
    if (session != null)
    {
        if (session.Phase == GamePhase.Lobby)
            await hub.Clients.Group(id).SendAsync("LobbyUpdated", SessionManager.ToLobbyDto(session));
        else
            await hub.Clients.Group(id).SendAsync("GameStateUpdated", SessionManager.ToStateDto(session));
    }

    return Results.NoContent();
});

// DELETE (end) a session as admin
app.MapDelete("/api/admin/sessions/{id}", async (string id, SessionManager sessions, IHubContext<GameHub> hub, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var session = sessions.GetSession(id);
    if (session == null) return Results.NotFound();
    await hub.Clients.Group(id).SendAsync("SessionEnded");
    sessions.DestroySession(id);
    return Results.NoContent();
});

// ─── Admin: Server ─────────────────────────────────────────

app.MapGet("/api/admin/server", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    return Results.Ok(new
    {
        machineName = Environment.MachineName,
        processId = Environment.ProcessId,
        environment = app.Environment.EnvironmentName,
        startedAtUtc,
        osVersion = Environment.OSVersion.VersionString,
        isRestartSupported = false,
        availableActions = new[] { "shutdown" }
    });
});

app.MapPost("/api/admin/server/shutdown", async (IHostApplicationLifetime lifetime, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    _ = Task.Run(async () =>
    {
        await Task.Delay(250);
        lifetime.StopApplication();
    });
    return Results.Ok(new { accepted = true, action = "shutdown" });
});

app.Run();
