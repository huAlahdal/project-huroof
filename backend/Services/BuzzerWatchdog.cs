using Backend.Hubs;
using Backend.Models;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Services;

/// <summary>
/// Background service that watches active game sessions and automatically transitions
/// the buzzer state when timers expire — without requiring a client action.
///
/// Handles two cases:
///   A) passedToOtherTeamAt + second timer expired → auto-open buzzer for everyone
///   B) buzzerIsOpenMode + someone buzzed + first timer expired → re-open for everyone
/// </summary>
public class BuzzerWatchdog : BackgroundService
{
    private readonly SessionManager _sessions;
    private readonly IHubContext<GameHub> _hub;
    private readonly ILogger<BuzzerWatchdog> _logger;

    public BuzzerWatchdog(SessionManager sessions, IHubContext<GameHub> hub, ILogger<BuzzerWatchdog> logger)
    {
        _sessions = sessions;
        _hub = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BuzzerWatchdog started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(1000, stoppingToken);
                await CheckAllSessionsAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "BuzzerWatchdog error on tick");
            }
        }

        _logger.LogInformation("BuzzerWatchdog stopped");
    }

    private async Task CheckAllSessionsAsync(CancellationToken ct)
    {
        // Snapshot to avoid mutation during iteration
        var sessions = _sessions.GetAllSessions().ToList();

        foreach (var session in sessions)
        {
            if (ct.IsCancellationRequested) break;
            if (session.Phase != GamePhase.Selected) continue;

            if (_sessions.TryAutoOpenBuzzer(session.Id))
            {
                try
                {
                    // Re-fetch the session after state change to get updated state
                    var updated = _sessions.GetSession(session.Id);
                    if (updated != null)
                    {
                        var state = SessionManager.ToStateDto(updated);
                        await _hub.Clients.Group(session.Id).SendAsync("GameStateUpdated", state, ct);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to broadcast auto-open for session {SessionId}", session.Id);
                }
            }
        }
    }
}
