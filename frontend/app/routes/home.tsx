import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { invoke, startConnection, resetConnection } from "~/lib/signalr";
import { useAuth, authHeaders } from "~/contexts/AuthContext";
import { API_BASE } from "~/lib/api";
import ThemeToggle from "~/components/ThemeToggle";
import HexGrid from "~/components/HexGrid";
import type { GridLayout } from "~/lib/hexUtils";

const BG_LETTERS = ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ر", "ز", "س", "ش", "ص", "ط", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
const BG_COLORS = ["#7c3aed", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#f59e0b"];

// Pre-computed stable values for scattered background hexes (prevents re-randomization on re-render)
const SCATTERED_HEXES = Array.from({ length: 45 }, (_, i) => ({
  letter: BG_LETTERS[i % BG_LETTERS.length],
  color: BG_COLORS[i % BG_COLORS.length],
  size: 30 + ((i * 17 + 7) % 50),
  top: -10 + ((i * 31 + 13) % 120),
  left: -10 + ((i * 23 + 5) % 120),
  delay: (i * 0.7) % 10,
  duration: 15 + ((i * 11) % 25),
  rotate: ((i * 37 + 11) % 60) - 30,
}));

// Mock grid to display in the background
const MOCK_GRID: GridLayout = Array.from({ length: 5 }, (_, row) =>
  Array.from({ length: 5 }, (_, col) => {
    let owner: "orange" | "green" | null = null;
    let isSelected = false;

    // Create a visual pattern reflecting the game
    if (row === 2 && col === 2) isSelected = true; // Center cell selected
    else if ((row === 1 && col === 2) || (row === 2 && col === 1) || (row === 1 && col === 1)) owner = "orange";
    else if ((row === 3 && col === 2) || (row === 2 && col === 3) || (row === 3 && col === 3)) owner = "green";

    return {
      id: `${row}-${col}`,
      row,
      col,
      letter: BG_LETTERS[(row * 5 + col) % BG_LETTERS.length],
      owner,
      isSelected,
    };
  })
);

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isGuest, loginAsGuest, logout } = useAuth();
  const [mode, setMode] = useState<"menu" | "create" | "join" | "guest-prompt">("menu");
  const [error, setError] = useState("");

  // Create form
  const [gridSize, setGridSize] = useState(5);
  const [rounds, setRounds] = useState(2);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);

  // Join form
  const [joinId, setJoinId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPass, setShowJoinPass] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinNeedsPassword, setJoinNeedsPassword] = useState<boolean | null>(null);

  // Guest form
  const [guestName, setGuestName] = useState("");
  const [guestAction, setGuestAction] = useState<"create" | "join" | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  // Active session check
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    phase: string;
    playerId: string;
    playerRole: string;
    playerCount: number;
    orangeScore: number;
    greenScore: number;
  } | null>(null);
  const [leavingSession, setLeavingSession] = useState(false);

  // Check if the user is already in a session
  const checkActiveSession = useCallback(async () => {
    if (!user) { setActiveSession(null); return; }
    try {
      const res = await fetch(`${API_BASE}/api/sessions/active`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.inSession) {
          setActiveSession({
            sessionId: data.sessionId,
            phase: data.phase,
            playerId: data.playerId,
            playerRole: data.playerRole,
            playerCount: data.playerCount,
            orangeScore: data.orangeScore,
            greenScore: data.greenScore,
          });
        } else {
          setActiveSession(null);
        }
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!authLoading) checkActiveSession();
  }, [authLoading, user]);

  async function handleLeaveSession() {
    if (!activeSession) return;
    setLeavingSession(true);
    try {
      await fetch(`${API_BASE}/api/sessions/leave`, {
        method: "POST",
        headers: authHeaders(),
      });
      setActiveSession(null);
    } catch {
      setError("فشل مغادرة الجلسة");
    }
    setLeavingSession(false);
  }

  async function handleRejoin() {
    if (!activeSession) return;
    const dest = activeSession.phase === "lobby"
      ? `/lobby/${activeSession.sessionId}`
      : `/game/${activeSession.sessionId}`;
    navigate(dest);
  }

  // Pre-fill join name from user's in-game name
  useEffect(() => {
    if (user?.inGameName && !joinName) {
      setJoinName(user.inGameName);
    }
  }, [user?.inGameName]);

  // Check if player was kicked
  useEffect(() => {
    if (location.state?.kicked) {
      const reason = location.state.reason;
      if (reason === "kicked-by-gamemaster") {
        setError("لقد تم طردك من الجلسة من قبل مدير اللعبة");
      } else {
        setError("لقد تم طردك من الجلسة");
      }
      // Clear the state so the message doesn't show again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setError(""), 5000);
    }
  }, [location.state]);

  async function handleCreate() {
    // If not logged in, show guest prompt
    if (!user) {
      setGuestAction("create");
      setMode("guest-prompt");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await resetConnection();
      await startConnection();
      const result = await invoke<{ sessionId: string }>(
        "CreateSession", password || null, gridSize, rounds
      );
      if (result.sessionId) {
        // Auto-join and go to lobby (works for both regular users and guests — name comes from user.inGameName)
        try {
          await invoke<{ success?: boolean; playerId?: string }>(
            "JoinSession", result.sessionId, password || null, user.inGameName
          );
        } catch { /* navigate anyway */ }
        setCreating(false);
        navigate(`/lobby/${result.sessionId}`);
        return;
      }
    } catch (e: any) {
      setError(e.message || "فشل إنشاء الجلسة");
    }
    setCreating(false);
  }

  async function handleGuestLogin() {
    if (!guestName.trim()) return;
    setGuestLoading(true);
    setError("");
    try {
      const res = await loginAsGuest(guestName.trim());
      if (res.success) {
        // After guest token is set, resetConnection so new token is used
        await resetConnection();
        if (guestAction === "create") {
          setMode("create");
        } else {
          setJoinName(guestName.trim());
          setMode("join");
        }
      } else {
        setError(res.error || "فشل الدخول كضيف");
      }
    } catch {
      setError("فشل الاتصال بالخادم");
    }
    setGuestLoading(false);
  }

  async function handleJoin() {
    if (!joinId.trim() || !joinName.trim()) return;
    // If session needs password and none provided, block
    if (joinNeedsPassword && !joinPassword.trim()) return;
    setJoining(true);
    setError("");
    try {
      await resetConnection();
      await startConnection();
      const result = await invoke<{ success?: boolean; error?: string; playerId?: string }>(
        "JoinSession", joinId.toUpperCase(), joinPassword || null, joinName
      );
      if (result.success) {
        navigate(`/lobby/${joinId.toUpperCase()}`);
      } else {
        setError(result.error || "فشل الانضمام");
      }
    } catch (e: any) {
      setError(e.message || "فشل الاتصال بالخادم");
    }
    setJoining(false);
  }

  // Check if session requires password when ID is entered
  async function checkSessionPassword() {
    if (joinId.trim().length < 4) return;
    try {
      await startConnection();
      const result = await invoke<{ exists: boolean; requiresPassword?: boolean }>(
        "CheckSession", joinId.toUpperCase()
      );
      if (result.exists) {
        setJoinNeedsPassword(result.requiresPassword ?? false);
      } else {
        setJoinNeedsPassword(null);
        setError("الجلسة غير موجودة");
      }
    } catch {
      setJoinNeedsPassword(null);
    }
  }

  return (
    <div className="game-bg min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Game Honeycomb Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.22] transform scale-[1.2] sm:scale-[1.3] md:scale-110 lg:scale-[1.2]"
        style={{
          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 70%)',
          zIndex: 0
        }}
      >
        <div className="w-full max-w-[1200px]">
          <HexGrid
            grid={MOCK_GRID}
            gridSize={5}
            interactive={false}
            isGameMaster={false}
            hexSize={65}
          />
        </div>
      </div>

      {/* Scattered Hexes with Letters */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {SCATTERED_HEXES.map((hex, i) => (
            <div
              key={i}
              className="absolute flex items-center justify-center font-black animate-pulse"
              style={{
                top: `${hex.top}%`,
                left: `${hex.left}%`,
                width: hex.size,
                height: hex.size * 1.15,
                animationDuration: `${hex.duration}s`,
                animationDelay: `${hex.delay}s`,
                transform: `rotate(${hex.rotate}deg)`,
                opacity: 0.35
              }}
            >
              <svg viewBox="0 0 100 115" className="absolute inset-0 w-full h-full">
                <polygon
                  points="50,2.5 97.5,28.75 97.5,86.25 50,112.5 2.5,86.25 2.5,28.75"
                  fill="var(--bg-3)"
                  stroke={hex.color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="relative z-10" style={{ color: hex.color, fontSize: hex.size * 0.45 }}>{hex.letter}</span>
            </div>
          ))}
        </div>

      {/* Theme toggle — top right */}
      <div className="fixed top-3 left-3 z-20">
        <ThemeToggle />
      </div>

      {/* Admin link */}
      <div className="fixed top-3 right-3 z-20 flex gap-2">
        {user && !isGuest && (
          <a
            href="/profile"
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}
          >
            👤 {user.inGameName}
          </a>
        )}
        {user && isGuest && (
          <span
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: "var(--bg-2)", border: "1px solid #facc15", color: "#facc15" }}
          >
            👤 ضيف: {user.inGameName}
          </span>
        )}
        {user?.role === "admin" && (
          <a
            href="/admin"
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", textDecoration: "none" }}
          >
            ⚙️ إدارة
          </a>
        )}
        {user && (
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:bg-red-500/10 hover:text-red-500"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer" }}
            title="تسجيل الخروج"
          >
            <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at center, transparent 0%, rgba(0,0,0,0.85) 100%)" }} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center home-main">
        {/* Logo */}
        <div className="text-center fade-in flex flex-col items-center w-full">
          <div className="relative group mx-auto mb-3 w-24 h-24">
              {/* Main box */}
            <div
              className="relative flex items-center justify-center w-full h-full rounded-[2.5rem] text-white shadow-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"
              style={{
                boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.2), 0 20px 40px -10px rgba(124, 58, 237, 0.5)"
              }}
            >
              <div className="relative flex items-center justify-center w-full h-full logo-spin">
                {/* Central Question Mark */}
                <span className="text-[5rem] font-black z-10 leading-none drop-shadow-xl" style={{ textShadow: "4px 4px 0px rgba(0,0,0,0.15)" }}>؟</span>
                {/* Internal Scattered Letters */}
                <span className="absolute text-5xl font-black -translate-x-5 translate-y-3 rotate-12 text-blue-200">ح</span>
                <span className="absolute text-4xl font-black translate-x-6 -translate-y-4 -rotate-[15deg] text-pink-200">س</span>
              </div>
            </div>

            {/* Scattered Floating Hexes Around Logo */}
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black leading-tight mb-1 relative z-10"
            style={{
              background: "linear-gradient(to right, #60a5fa, #a78bfa, #f472b6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.55))"
            }}
          >
            حروف و أسئلة
          </h1>
          <p className="text-sm font-medium relative z-10" style={{ color: "var(--text-2)", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>لعبة ثقافية تفاعلية للفريقين ⚔️</p>
        </div>

        {/* ── Menu ── */}
        {mode === "menu" && (
          <div className="home-menu-stack fade-in" style={{ animationDelay: "0.1s" }}>

            {/* Active session banner */}
            {activeSession && (
              <div className="home-card w-full p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔄</span>
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: "#e2d9f3" }}>لديك جلسة نشطة</p>
                    <p className="text-[11px]" style={{ color: "#a78bcc" }}>
                      الجلسة <span className="font-mono font-bold" style={{ color: "#c084fc" }}>{activeSession.sessionId}</span>
                      {" — "}
                      {activeSession.phase === "lobby" ? "في الانتظار" : activeSession.phase === "win" ? "انتهت" : "جارية"}
                      {" · "}
                      {activeSession.playerCount} لاعب
                    </p>
                  </div>
                </div>
                {activeSession.phase !== "lobby" && (
                  <div className="flex gap-3 justify-center text-xs font-bold">
                    <span style={{ color: "#fb923c" }}>🟠 {activeSession.orangeScore}</span>
                    <span style={{ color: "#6b7280" }}>—</span>
                    <span style={{ color: "#4ade80" }}>🟢 {activeSession.greenScore}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-3 text-sm" onClick={handleRejoin}>
                    🚀 العودة للجلسة
                  </button>
                  <button
                    className="btn-ghost flex-1 py-3 text-sm"
                    onClick={handleLeaveSession}
                    disabled={leavingSession}
                    style={{ borderColor: "rgba(239,68,68,0.4)", color: "#f87171" }}
                  >
                    {leavingSession ? "⏳ جاري المغادرة..." : "🚪 مغادرة الجلسة"}
                  </button>
                </div>
              </div>
            )}

            {!activeSession && (
              <div className="flex flex-col gap-2.5">
                {/* Create Session */}
                <button
                  className="home-action-btn home-action-create"
                  onClick={() => {
                    if (!user) { setGuestAction("create"); setMode("guest-prompt"); }
                    else setMode("create");
                  }}
                >🎮 إنشاء جلسة</button>

                {/* Join Session */}
                <button
                  className="home-action-btn home-action-join"
                  onClick={() => {
                    if (!user) { setGuestAction("join"); setMode("guest-prompt"); }
                    else setMode("join");
                  }}
                >🔗 انضمام لجلسة</button>
              </div>
            )}

            {/* Guest/Auth info banner */}
            {!authLoading && !user && (
              <div className="home-card home-card-muted w-full p-3.5 text-center space-y-2">
                <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>مرحباً بك في حروف و أسئلة!</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  يمكنك اللعب كضيف أو تسجيل حساب لحفظ إحصائياتك
                </p>
                <div className="flex gap-2 justify-center">
                  <a href="/login" className="home-pill-link px-4 py-1.5 text-xs font-bold transition-all"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                    🔑 تسجيل الدخول
                  </a>
                  <a href="/register" className="home-pill-link px-4 py-1.5 text-xs font-bold transition-all"
                    style={{ borderColor: "#16a34a", color: "#4ade80" }}>
                    📝 إنشاء حساب
                  </a>
                </div>
              </div>
            )}

            {isGuest && (
              <div className="home-card home-card-warning w-full p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚠️</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: "#facc15" }}>أنت تلعب كضيف</p>
                    <p className="text-[10px]" style={{ color: "#d9bf8d" }}>لن يتم حفظ إحصائياتك بعد انتهاء الجلسة.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href="/login" className="home-pill-link flex-1 py-1.5 text-[11px] font-bold text-center transition-all"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                    🔑 تسجيل الدخول
                  </a>
                  <a href="/register" className="home-pill-link flex-1 py-1.5 text-[11px] font-bold text-center transition-all"
                    style={{ borderColor: "#16a34a", color: "#4ade80" }}>
                    📝 إنشاء حساب
                  </a>
                </div>
              </div>
            )}

            {/* Error in menu mode */}
            {error && (
              <div className="px-4 py-2 rounded-lg text-red-400 text-sm font-medium text-center" style={{ background: "#2a0a0a", border: "1px solid #dc2626" }}>
                {error}
              </div>
            )}

            <div className="home-card home-card-muted w-full p-3.5">
              <h2 className="font-black text-xs text-center mb-2.5" style={{ color: "#c084fc" }}>كيف تلعب؟</h2>
              <div className="space-y-1.5">
                {[
                  ["🎲", "أنشئ جلسة أو انضم بالرمز", "#a855f7"],
                  ["👥", "اختر فريقك وعيّن مدير لعبة", "#14b8a6"],
                  ["❓", "مدير اللعبة يختار حرفاً ويطرح سؤالاً", "#f59e0b"],
                  ["⚡", "اضغط الجرس أولاً للإجابة!", "#f97316"],
                  ["🏆", "أول فريق يربط مساره يفوز", "#4ade80"],
                ].map(([icon, text, color], i) => (
                  <div key={i} className="home-tip-item" style={{ borderRight: `3px solid ${color}` }}>
                    <span className="text-sm shrink-0">{icon}</span>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Create ── */}
        {mode === "create" && (
          <div className="home-card w-full p-4 fade-in-scale">
            <h2 className="text-lg font-black text-center mb-4" style={{ color: "var(--text-1)" }}>⚙️ إنشاء جلسة جديدة</h2>

            <div className="mb-3">
              <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>حجم الشبكة</label>
              <div className="grid grid-cols-3 gap-2">
                {[4, 5, 6].map((s) => (
                  <button
                    key={s} onClick={() => setGridSize(s)}
                    className="py-2 rounded-lg font-bold text-sm transition-all"
                    style={{
                      background: gridSize === s ? "rgba(124,58,237,0.4)" : "var(--surface)",
                      border: `1.5px solid ${gridSize === s ? "var(--accent)" : "var(--border)"}`,
                      color: gridSize === s ? "var(--text-1)" : "var(--text-2)",
                      cursor: "pointer",
                    }}
                  >
                    {s}×{s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>عدد الجولات</label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 4, 6].map((r) => (
                  <button
                    key={r} onClick={() => setRounds(r)}
                    className="py-2 rounded-lg font-bold text-sm transition-all"
                    style={{
                      background: rounds === r ? "rgba(124,58,237,0.4)" : "var(--surface)",
                      border: `1.5px solid ${rounds === r ? "var(--accent)" : "var(--border)"}`,
                      color: rounds === r ? "var(--text-1)" : "var(--text-2)",
                      cursor: "pointer",
                    }}
                  >
                    {r} جولات
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>كلمة مرور الجلسة <span className="font-normal" style={{ color: "var(--text-3)" }}>(اختياري)</span></label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور"
                  className="input-field"
                  autoComplete="off"
                  style={{ paddingLeft: "2.5rem" }}
                />
                <button
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}
                  tabIndex={-1}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-500/20  border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce">
                {error}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "⏳ جاري الإنشاء..." : "🎮 إنشاء الجلسة"}
            </button>
            <button className="w-full mt-2 text-xs font-semibold transition-colors" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => { setMode("menu"); setError(""); }}>
              ← رجوع
            </button>
          </div>
        )}

        {/* ── Guest Prompt ── */}
        {mode === "guest-prompt" && (
          <div className="home-card w-full p-4 fade-in-scale text-center space-y-4">
            <div className="text-3xl">👤</div>
            <h2 className="text-lg font-black" style={{ color: "var(--text-1)" }}>
              {guestAction === "create" ? "إنشاء جلسة كضيف" : "انضمام كضيف"}
            </h2>
            
            {/* Guest limitations */}
            <div className="rounded-lg p-3 text-right" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid #facc15" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "#facc15" }}>⚠️ قيود وضع الضيف:</p>
              <ul className="space-y-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                <li>• لن يتم حفظ إحصائيات الألعاب (الانتصارات والمباريات)</li>
                <li>• لا يمكنك استعادة حسابك بعد الخروج</li>
                <li>• ينتهي الوصول بعد 24 ساعة</li>
              </ul>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>اسمك في اللعبة</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="أدخل اسمك"
                className="input-field text-center"
                maxLength={24}
                autoComplete="off"
                onKeyDown={(e) => e.key === "Enter" && guestName.trim() && handleGuestLogin()}
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleGuestLogin}
              disabled={guestLoading || !guestName.trim()}
              style={{ opacity: !guestName.trim() ? 0.5 : 1 }}
            >
              {guestLoading ? "⏳ جاري الدخول..." : "🎮 دخول كضيف"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-[10px] font-bold" style={{ color: "var(--text-4)" }}>أو</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>

            <div className="flex gap-2">
              <a href="/login" className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center transition-all"
                style={{ background: "var(--bg-2)", border: "1px solid var(--accent)", color: "var(--accent)", textDecoration: "none" }}>
                🔑 تسجيل الدخول
              </a>
              <a href="/register" className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center transition-all"
                style={{ background: "var(--bg-2)", border: "1px solid #4ade80", color: "#4ade80", textDecoration: "none" }}>
                📝 حساب جديد
              </a>
            </div>

            <button className="w-full text-xs font-semibold transition-colors" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => { setMode("menu"); setError(""); setGuestAction(null); }}>
              ← رجوع
            </button>
          </div>
        )}

        {/* ── Join ── */}
        {mode === "join" && (
          <div className="home-card w-full p-4 fade-in-scale">
            <h2 className="text-lg font-black text-center mb-4" style={{ color: "var(--text-1)" }}>🔗 انضمام لجلسة</h2>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>رمز الجلسة</label>
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => { setJoinId(e.target.value.toUpperCase()); setJoinNeedsPassword(null); }}
                  onBlur={checkSessionPassword}
                  placeholder="مثال: AB1234"
                  className="input-field text-center tracking-widest font-black text-lg"
                  style={{ direction: "ltr" }}
                  maxLength={6}
                  autoComplete="off"
                />
                {joinNeedsPassword === false && (
                  <p className="text-xs mt-1 font-medium" style={{ color: "#4ade80" }}>✓ الجلسة مفتوحة — لا تحتاج كلمة مرور</p>
                )}
              </div>
              {joinNeedsPassword !== false && (
              <div>
                <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>
                  كلمة المرور {joinNeedsPassword === null && <span className="font-normal" style={{ color: "var(--text-3)" }}>(إذا كانت الجلسة محمية)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showJoinPass ? "text" : "password"}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="input-field"
                    style={{ paddingLeft: "2.5rem" }}
                    autoComplete="off"
                  />
                  <button
                    onClick={() => setShowJoinPass((p) => !p)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-base"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}
                    tabIndex={-1}
                  >
                    {showJoinPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              )}
              <div>
                <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>اسمك في اللعبة</label>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="أدخل اسمك"
                  className="input-field"
                  maxLength={24}
                  autoComplete="off"
                />
              </div>
            </div>

            {error && (
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-500/20  border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce">
                {error}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              onClick={handleJoin}
              disabled={joining || !joinId.trim() || !joinName.trim() || (joinNeedsPassword === true && !joinPassword.trim())}
              style={{ opacity: (!joinId.trim() || !joinName.trim()) ? 0.5 : 1 }}
            >
              {joining ? "⏳ جاري الانضمام..." : "🔗 انضمام للجلسة"}
            </button>
            <button className="w-full mt-2 text-xs font-semibold transition-colors" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => { setMode("menu"); setError(""); }}>
              ← رجوع
            </button>
          </div>
        )}

        <p className="text-xs" style={{ color: "var(--text-4)" }}>حروف و أسئلة — لعبة ثقافية تفاعلية</p>
      </div>
    </div>
  );
}

