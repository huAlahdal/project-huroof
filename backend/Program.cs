using Backend.Hubs;
using Backend.Models;
using Backend.Services;
using Backend.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Diagnostics;
using System.IO.Compression;

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
builder.Services.AddSingleton<QuestionStore>();

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

// CORS for frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri))
                return false;

            var host = originUri.Host;
            return host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                   host.Equals("0.0.0.0", StringComparison.OrdinalIgnoreCase) ||
                   host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                   host.Equals("huroof.ddns.net", StringComparison.OrdinalIgnoreCase) ||
                   host.StartsWith("192.168.", StringComparison.OrdinalIgnoreCase) ||
                   host.StartsWith("10.", StringComparison.OrdinalIgnoreCase) ||
                   host.StartsWith("172.", StringComparison.OrdinalIgnoreCase);
        })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Use response compression
app.UseResponseCompression();

// Apply CORS headers for all responses, including error responses
app.UseCors();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        // Manually apply CORS headers here because the exception handler inner
        // pipeline does NOT pass through the outer UseCors() middleware.
        var origin = context.Request.Headers.Origin.FirstOrDefault();
        if (!string.IsNullOrEmpty(origin))
        {
            context.Response.Headers["Access-Control-Allow-Origin"] = origin;
            context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
            context.Response.Headers["Access-Control-Allow-Headers"] = "*";
            context.Response.Headers["Access-Control-Allow-Methods"] = "*";
            context.Response.Headers["Vary"] = "Origin";
        }

        var exceptionFeature = context.Features.Get<IExceptionHandlerPathFeature>();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        // Always include detail so deployment issues are diagnosable.
        // Remove or gate on IsDevelopment() once stable.
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Internal server error",
            detail = exceptionFeature?.Error?.Message,
            type = exceptionFeature?.Error?.GetType().Name
        });
    });
});

using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        // Log but don't crash the app — DB may already be up to date
        Console.Error.WriteLine($"[Startup] DB migration warning: {ex.Message}");
    }
}

// ─── SignalR hub ───────────────────────────────────────────
app.MapHub<GameHub>("/gamehub");

// ─── Health check ──────────────────────────────────────────
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// ─── Admin auth helper ─────────────────────────────────────
const string AdminUser = "admin";
const string AdminPass = "admin";

bool IsAdmin(HttpRequest request)
{
    var auth = request.Headers.Authorization.FirstOrDefault();
    
    // Fallback to query string ?token=... for direct links like export
    if (string.IsNullOrEmpty(auth) && request.Query.TryGetValue("token", out var tokenVal))
    {
        auth = $"Basic {tokenVal}";
    }
    
    if (string.IsNullOrEmpty(auth)) return false;
    // Expect "Basic base64(user:pass)"
    if (!auth.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase)) return false;
    try
    {
        var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(auth[6..]));
        var parts = decoded.Split(':', 2);
        return parts.Length == 2 && parts[0] == AdminUser && parts[1] == AdminPass;
    }
    catch { return false; }
}

IResult Unauthorized() => Results.Json(new { error = "Unauthorized" }, statusCode: 401);

IResult BadRole() => Results.BadRequest(new { error = "Invalid role" });

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

// ─── Admin: Overview ───────────────────────────────────────

app.MapGet("/api/admin/overview", (QuestionStore store, SessionManager sessions, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var allSessions = sessions.GetAllSessions().ToList();
    return Results.Ok(new
    {
        questionCount = store.GetAll().Count,
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

    var query = db.Questions.AsNoTracking().AsQueryable();

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
        .AsNoTracking()
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

// ─── Admin: Authentication ───────────────────────────────────

app.MapPost("/api/admin/auth", (HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    return Results.Ok(new { success = true });
});

// ─── Admin: Questions ──────────────────────────────────────

// GET all questions
app.MapGet("/api/admin/questions", (QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    return Results.Ok(store.GetAll());
});

// POST create question
app.MapPost("/api/admin/questions", async (QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var q = await req.ReadFromJsonAsync<QuestionItem>();
    if (q == null) return Results.BadRequest();
    var created = store.Add(q);
    return Results.Created($"/api/admin/questions/{created.Id}", created);
});

// POST bulk import (replace all)
app.MapPost("/api/admin/questions/import", async (QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var items = await req.ReadFromJsonAsync<List<QuestionItem>>();
    if (items == null) return Results.BadRequest();
    store.ImportAll(items);
    return Results.Ok(new { count = items.Count });
});

// POST bulk add (append)
app.MapPost("/api/admin/questions/bulk", async (QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var items = await req.ReadFromJsonAsync<List<QuestionItem>>();
    if (items == null) return Results.BadRequest();
    var count = store.BulkAdd(items);
    return Results.Ok(new { count });
});

// PUT update question
app.MapPut("/api/admin/questions/{id}", async (string id, QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var q = await req.ReadFromJsonAsync<QuestionItem>();
    if (q == null) return Results.BadRequest();
    var updated = q with { Id = id };
    return store.Update(updated) ? Results.Ok(updated) : Results.NotFound();
});

// DELETE question
app.MapDelete("/api/admin/questions/{id}", (string id, QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    return store.Delete(id) ? Results.NoContent() : Results.NotFound();
});

// GET export questions as JSON file
app.MapGet("/api/admin/questions/export", (QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    var json = System.Text.Json.JsonSerializer.Serialize(store.GetAll(), new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
    return Results.File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", "huroof-questions.json");
});

// ─── Database-backed Questions API ───────────────────────────

// GET all questions from database (with caching)
app.MapGet("/api/admin/db/questions", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var questions = await db.Questions
        .AsNoTracking() // Performance: no change tracking needed for read-only
        .OrderBy(q => q.Letter)
        .ThenBy(q => q.Category)
        .ThenBy(q => q.Difficulty)
        .ToListAsync();
    
    return Results.Ok(questions.Select(q => new
    {
        q.Id,
        q.Letter,
        Question = q.QuestionText,
        q.Answer,
        q.Category,
        q.Difficulty,
        q.CreatedAt,
        q.UpdatedAt
    }));
});

// GET question by ID from database
app.MapGet("/api/admin/db/questions/{id}", async (string id, ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var question = await db.Questions.FindAsync(id);
    if (question == null) return Results.NotFound();
    
    return Results.Ok(new
    {
        question.Id,
        question.Letter,
        Question = question.QuestionText,
        question.Answer,
        question.Category,
        question.Difficulty,
        question.CreatedAt,
        question.UpdatedAt
    });
});

// POST create new question in database
app.MapPost("/api/admin/db/questions", async (ApplicationDbContext db, HttpRequest req) =>
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
    
    return Results.Created($"/api/admin/db/questions/{question.Id}", new
    {
        question.Id,
        question.Letter,
        Question = question.QuestionText,
        question.Answer,
        question.Category,
        question.Difficulty,
        question.CreatedAt,
        question.UpdatedAt
    });
});

// PUT update question in database
app.MapPut("/api/admin/db/questions/{id}", async (string id, ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var question = await db.Questions.FindAsync(id);
    if (question == null) return Results.NotFound();
    
    var model = await req.ReadFromJsonAsync<UpdateQuestionRequest>();
    if (model == null) return Results.BadRequest();
    
    // Create a new question record with updated values
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
    
    // Update the entity
    db.Entry(question).CurrentValues.SetValues(updatedQuestion);
    await db.SaveChangesAsync();
    
    return Results.Ok(new
    {
        updatedQuestion.Id,
        updatedQuestion.Letter,
        Question = updatedQuestion.QuestionText,
        updatedQuestion.Answer,
        updatedQuestion.Category,
        updatedQuestion.Difficulty,
        updatedQuestion.CreatedAt,
        updatedQuestion.UpdatedAt
    });
});

// DELETE question from database
app.MapDelete("/api/admin/db/questions/{id}", async (string id, ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var question = await db.Questions.FindAsync(id);
    if (question == null) return Results.NotFound();
    
    db.Questions.Remove(question);
    await db.SaveChangesAsync();
    
    return Results.NoContent();
});

// POST bulk add (append) - adds questions without replacing existing ones
app.MapPost("/api/admin/db/questions/bulk-add", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var items = await req.ReadFromJsonAsync<List<CreateQuestionRequest>>();
    if (items == null) return Results.BadRequest();
    
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
    
    return Results.Ok(new { count = questions.Count, total = await db.Questions.CountAsync() });
});

// POST bulk import questions to database
app.MapPost("/api/admin/db/questions/import", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var items = await req.ReadFromJsonAsync<List<CreateQuestionRequest>>();
    if (items == null) return Results.BadRequest();
    
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

// GET categories from database (optimized)
app.MapGet("/api/admin/db/questions/categories", async (ApplicationDbContext db, HttpRequest req) =>
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

// POST migrate from JSON to database
app.MapPost("/api/admin/db/questions/migrate", async (ApplicationDbContext db, QuestionStore store, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    // Get all questions from JSON store
    var jsonQuestions = store.GetAll();
    
    // Check if database already has questions
    var existingCount = await db.Questions.CountAsync();
    if (existingCount > 0)
    {
        return Results.BadRequest(new { error = $"Database already has {existingCount} questions. Clear it first." });
    }
    
    // Convert to database entities
    var dbQuestions = jsonQuestions.Select(q => new Question
    {
        Id = q.Id,
        Letter = q.Letter,
        QuestionText = q.Question,
        Answer = q.Answer,
        Category = q.Category,
        Difficulty = q.Difficulty,
        CreatedAt = DateTime.UtcNow
    }).ToList();
    
    await db.Questions.AddRangeAsync(dbQuestions);
    await db.SaveChangesAsync();
    
    return Results.Ok(new { 
        migrated = dbQuestions.Count,
        message = "Successfully migrated questions from JSON to database"
    });
});

// DELETE all questions from database
app.MapDelete("/api/admin/db/questions", async (ApplicationDbContext db, HttpRequest req) =>
{
    if (!IsAdmin(req)) return Unauthorized();
    
    var count = await db.Questions.CountAsync();
    db.Questions.RemoveRange(db.Questions);
    await db.SaveChangesAsync();
    
    return Results.Ok(new { deleted = count });
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
        startedAtUtc = DateTime.UtcNow,
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

public sealed record AdminSessionSettingsRequest(int? GridSize, int? TotalRounds);
public sealed record AdminSessionStartRequest(int? GridSize, int? TotalRounds, int? TimerFirst, int? TimerSecond);
public sealed record AdminPlayerUpdateRequest(string? Name, string? Role);

// Question API request models
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
