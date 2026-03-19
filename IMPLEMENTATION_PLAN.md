# Huroof — Full Implementation Plan

> **Date**: March 18, 2026
> **Goal**: Transform Huroof from a casual prototype into a production-ready, database-driven, multi-user game platform.

---

## Overview of Changes

| Area | Current | Target |
|------|---------|--------|
| **Identity** | Anonymous (type a name) | User accounts (email, username, in-game name, password, stats) |
| **Sessions** | In-memory + JSON-blob persistence | Fully DB-backed with relational tables, optional password |
| **Questions** | Dual: JSON file + SQLite + 200+ hardcoded in frontend | DB only, no client-side data |
| **Auth** | `sessionStorage` per session | JWT tokens (localStorage) + SignalR auth |
| **Admin** | Hardcoded `admin:admin` | Admin role on user accounts |
| **Security** | SHA256 (no salt) | bcrypt, rate limiting, input validation |

---

## Phase 1 — User Accounts System

### 1.1 Database Model

```
User
├── Id              (string, PK, 8-char hex)
├── Email           (string, unique, required)
├── Username        (string, unique, required, 3-24 chars)
├── InGameName      (string, required, 2-24 chars — display name)
├── PasswordHash    (string, bcrypt)
├── Role            (enum: Player, Admin)
├── GamesPlayed     (int, default 0)
├── GamesWon        (int, default 0)
├── CreatedAt       (DateTime)
├── LastLoginAt     (DateTime)
└── IsActive        (bool, default true)
```

### 1.2 Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account (email, username, inGameName, password) |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user profile (requires JWT) |
| PUT | `/api/auth/me` | Update profile (inGameName, email) |
| PUT | `/api/auth/me/password` | Change password |

### 1.3 JWT Authentication

- Token contains: `userId`, `username`, `inGameName`, `role`
- Stored in `localStorage` on frontend
- Passed to SignalR via query string: `/gamehub?access_token=<jwt>`
- Token expiry: 7 days, refresh on each login

### 1.4 Frontend

- New `/login` and `/register` routes
- `AuthContext` provider wrapping the app
- Protected routes: home, lobby, game require auth
- Auto-redirect to `/login` if no valid token

---

## Phase 2 — Remove Client-Side Data

### 2.1 Remove QuestionStore (JSON file)

- Delete `Services/QuestionStore.cs`
- Delete `Data/questions.json`
- Remove all `/api/admin/questions` (JSON-backed) endpoints from `Program.cs`
- Keep only `/api/admin/db/questions` endpoints, rename to `/api/admin/questions`
- Remove `QuestionStore` from DI registration

### 2.2 Remove Hardcoded Frontend Questions

- Remove `DEFAULT_QUESTIONS` array (~200 questions) from `frontend/app/lib/questions.ts`
- Remove `loadCustomQuestions()`, `saveCustomQuestions()`, `getAllQuestions()` (localStorage-based)
- Remove `getRandomQuestion()` client-side fallback
- Keep only `fetchQuestionsFromBackend()` and `fetchRandomQuestion()` (API-based)
- Remove `getCategories()`, `getDifficulties()`, `getLetters()` static functions — fetch from API

### 2.3 Consolidate Question API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/questions` | Public: filtered questions for game use |
| GET | `/api/questions/random?letter=X` | Public: random question by letter |
| GET | `/api/admin/questions` | Admin: all questions with full detail |
| POST | `/api/admin/questions` | Admin: create question |
| PUT | `/api/admin/questions/{id}` | Admin: update question |
| DELETE | `/api/admin/questions/{id}` | Admin: delete question |
| POST | `/api/admin/questions/import` | Admin: bulk import |
| POST | `/api/admin/questions/bulk-add` | Admin: bulk add (append) |
| GET | `/api/admin/questions/export` | Admin: export as JSON file |
| GET | `/api/admin/questions/categories` | Admin: list categories |
| DELETE | `/api/admin/questions` | Admin: delete all |

---

## Phase 3 — Session Rework

### 3.1 Optional Session Password

**Key change**: Session password becomes **optional**.

- When creating a session, the password field can be empty/null
- If no password is set, anyone with the session ID can join directly
- The session ID is already a 6-char alphanumeric code (hard to guess)
- The host can still set a password for private sessions
- Frontend join form: password field shown only when the session requires one
- Backend: `JoinSession` skips password check if session has no password

### 3.2 Normalized Session Tables

Replace `PersistedSession` (JSON blobs) with proper relational tables:

```
GameSession (DB table)
├── Id                  (string, PK, 6-char code)
├── CreatedByUserId     (FK → User.Id)
├── PasswordHash        (string?, nullable — optional)
├── GridSize            (int)
├── TotalRounds         (int)
├── CurrentRound        (int)
├── MaxPlayersPerTeam   (int)
├── Phase               (string)
├── OrangeScore         (int)
├── GreenScore          (int)
├── SelectedCellId      (string?)
├── RoundWinner         (string?)
├── BuzzerTimerFirst    (int)
├── BuzzerTimerSecond   (int)
├── Version             (int)
├── CreatedAt           (DateTime)
├── LastActivityAt      (DateTime)
├── ExpiresAt           (DateTime)
├── Status              (enum: Active, Completed, Abandoned)
│
├── SerializedGrid      (string, JSON — kept as JSON for perf)
├── SerializedQuestion  (string, JSON)
└── SerializedBuzzer    (string, JSON)

SessionPlayer (DB table)
├── Id                  (int, PK, auto-increment)
├── SessionId           (FK → GameSession.Id)
├── UserId              (FK → User.Id)
├── Role                (string: spectator/teamorange/teamgreen/gamemaster)
├── IsHost              (bool)
├── IsConnected         (bool)
├── ConnectionId        (string? — current SignalR connection)
├── JoinedAt            (DateTime)
└── LeftAt              (DateTime?)
```

### 3.3 Session Lifecycle with Auth

- **Create Session**: Authenticated user creates session → becomes host
- **Join Session**: Authenticated user joins → server knows who they are (from JWT)
- **Reconnect**: If user refreshes, JWT identifies them → server restores their player slot
- **No more `sessionStorage`**: Remove `huroof_pass_`, `huroof_name_`, `huroof_playerId_`, `huroof_creator_`

### 3.4 SignalR Hub Changes

```
CreateSession(password?, gridSize, totalRounds)  → uses JWT userId
JoinSession(sessionId, password?)                 → uses JWT userId + inGameName
GetLobbyState()                                   → unchanged
LeaveSession()                                    → unchanged
// ... all other methods stay the same but use JWT identity
```

---

## Phase 4 — Security Improvements

### 4.1 Password Hashing
- Replace SHA256 with **BCrypt** for user passwords and session passwords
- NuGet: `BCrypt.Net-Next`

### 4.2 Admin Auth
- Remove hardcoded `admin:admin`
- Admin check uses `User.Role == Admin` from JWT claims
- Seed a default admin user on first startup

### 4.3 Input Validation
- Add FluentValidation or manual validation for all request DTOs
- Username: 3-24 chars, alphanumeric + Arabic
- Email: valid format
- InGameName: 2-24 chars
- Session password: 0-50 chars (optional)

### 4.4 Rate Limiting
- Add `Microsoft.AspNetCore.RateLimiting`
- Login: 5 attempts per minute per IP
- Register: 3 per hour per IP
- Create session: 10 per hour per user

---

## Phase 5 — Frontend Auth & Cleanup

### 5.1 Auth Context

```tsx
AuthContext
├── user: { id, username, inGameName, email, role, gamesPlayed, gamesWon } | null
├── token: string | null
├── login(email, password) → void
├── register(email, username, inGameName, password) → void
├── logout() → void
├── updateProfile(inGameName, email) → void
└── isAuthenticated: boolean
```

### 5.2 New Routes

| Route | Component | Auth Required |
|-------|-----------|---------------|
| `/login` | LoginPage | No |
| `/register` | RegisterPage | No |
| `/` | HomePage | Yes |
| `/lobby/:sessionId` | LobbyPage | Yes |
| `/game/:sessionId` | GamePage | Yes |
| `/profile` | ProfilePage | Yes |
| `/admin` | AdminPage | Yes (Admin role) |

### 5.3 Remove sessionStorage Usage

- Remove all `sessionStorage.getItem/setItem` calls for `huroof_*` keys
- Replace with: JWT provides identity, server provides session state
- Reconnection flow: connect SignalR with JWT → server auto-restores session

### 5.4 Remove Client-Side Timer Duplication

- `GameMasterPanel.tsx` has a full timer implementation that duplicates server logic
- Remove it, use only `buzzer.remainingSeconds` and `buzzer.timerPhase` from server state
- Keep only the local 1-second decrement for smooth display (already in `game.tsx`)

---

## Phase 6 — Game History & Stats

### 6.1 GameHistory Table

```
GameHistory
├── Id              (int, PK)
├── SessionId       (string)
├── UserId          (FK → User.Id)
├── Team            (string: orange/green/spectator/gamemaster)
├── Won             (bool)
├── FinalScoreOrange (int)
├── FinalScoreGreen  (int)
├── Rounds          (int)
├── CompletedAt     (DateTime)
```

### 6.2 Stats Update

- When a game ends (Phase = Win), record `GameHistory` entries for all players
- Increment `User.GamesPlayed` for all participants
- Increment `User.GamesWon` for winning team members
- Expose `/api/users/me/stats` and `/api/leaderboard` endpoints

### 6.3 Profile Page

- Show: username, in-game name, games played, games won, win rate
- Recent games list with results
- Option to change in-game name

---

## Phase 7 — Reliability & Operations

### 7.1 Logging
- Replace `Console.WriteLine` / `Console.Error.WriteLine` with `ILogger<T>`
- Add structured logging with request IDs

### 7.2 Health Checks
- Expand `/health` to check DB connectivity
- Add SignalR hub health

### 7.3 Error Handling
- Add global exception middleware with proper error responses
- Add retry logic for DB saves in `SessionManager`

### 7.4 Graceful Shutdown
- On app shutdown, save all in-memory sessions to DB immediately
- Cancel all debounce timers and flush

### 7.5 Per-Session Locking
- Replace the global `static Lock _lock` with per-session `SemaphoreSlim`
- Prevents one session's operations from blocking another

### 7.6 DB Improvements
- Add proper indexes for `User.Email`, `User.Username`
- Add composite index on `SessionPlayer(SessionId, UserId)`
- Consider connection pool size tuning for SQLite

---

## File Changes Summary

### New Files
- `backend/Models/User.cs`
- `backend/Services/AuthService.cs`
- `backend/Controllers/AuthController.cs` (or minimal API in Program.cs)
- `backend/Migrations/XXXXXX_AddUserAccounts.cs` (auto-generated)
- `backend/Migrations/XXXXXX_ReworkSessions.cs` (auto-generated)
- `frontend/app/contexts/AuthContext.tsx`
- `frontend/app/routes/login.tsx`
- `frontend/app/routes/register.tsx`
- `frontend/app/routes/profile.tsx`

### Modified Files
- `backend/Program.cs` — JWT setup, new endpoints, remove old question endpoints
- `backend/Data/ApplicationDbContext.cs` — Add User, SessionPlayer DbSets
- `backend/Models/GameModels.cs` — Link Player to User
- `backend/Services/SessionManager.cs` — Use UserId, optional password, per-session locks
- `backend/Hubs/GameHub.cs` — JWT auth, use UserId from claims
- `frontend/app/root.tsx` — Wrap with AuthContext
- `frontend/app/routes.ts` — Add new routes
- `frontend/app/routes/home.tsx` — Use auth, remove sessionStorage
- `frontend/app/routes/lobby.tsx` — Use auth, remove sessionStorage
- `frontend/app/routes/game.tsx` — Use auth, remove sessionStorage
- `frontend/app/lib/questions.ts` — Remove hardcoded questions
- `frontend/app/lib/signalr.ts` — Pass JWT in connection
- `frontend/app/lib/api.ts` — Add auth headers

### Deleted Files
- `backend/Services/QuestionStore.cs`
- `backend/Data/questions.json`

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
  │          │          │          │          │          │          │
  │          │          │          │          │          │          └─ Logging, health, tests
  │          │          │          │          │          └─ GameHistory, leaderboard, profile
  │          │          │          │          └─ AuthContext, new routes, remove sessionStorage
  │          │          │          └─ BCrypt, rate limiting, validation
  │          │          └─ Optional password, normalized tables, SignalR auth
  │          └─ Remove QuestionStore, hardcoded Qs, consolidate APIs
  └─ User model, register/login, JWT, AuthService
```

Each phase is independently deployable and testable.
