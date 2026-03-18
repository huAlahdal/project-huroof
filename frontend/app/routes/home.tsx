import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { invoke, startConnection, resetConnection } from "~/lib/signalr";
import { useAuth, authHeaders } from "~/contexts/AuthContext";
import { API_BASE } from "~/lib/api";
import ThemeToggle from "~/components/ThemeToggle";

const BG_LETTERS = ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ر", "ز", "س", "ش", "ص", "ط", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
const BG_COLORS = ["#7c3aed", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#f59e0b"];

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isGuest, loginAsGuest } = useAuth();
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
      {/* Background hex decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {BG_LETTERS.map((letter, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center font-black text-base select-none"
            style={{
              left: `${(i * 7.3 + 2) % 94}%`,
              top: `${(i * 11.7 + 4) % 88}%`,
              width: 52, height: 60,
              clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)",
              backgroundColor: BG_COLORS[i % BG_COLORS.length],
              color: "#fff",
              opacity: 0.06,
              animation: `hexPulse ${3 + i * 0.15}s ease-in-out ${i * 0.06}s infinite`,
            }}
          >
            {letter}
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
            style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}
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
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 75% 65% at center,transparent 0%,rgba(0,0,0,0.4) 100%)" }} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg w-full">
        {/* Logo */}
        <div className="text-center fade-in">
          <div
            className="w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center text-5xl font-black text-white shadow-2xl logo-spin"
            style={{ background: "linear-gradient(135deg,#7c3aed 0%,#a855f7 60%,#ec4899 100%)", boxShadow: "0 0 50px rgba(168,85,247,0.65)" }}
          >
            ح
          </div>
          <h1
            className="text-5xl sm:text-6xl font-black leading-tight mb-1"
            style={{ background: "linear-gradient(135deg,#f97316 0%,#a855f7 50%,#22c55e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            حروف
          </h1>
          <p className="text-sm font-medium" style={{ color: "var(--text-3)" }}>لعبة ثقافية تفاعلية للفريقين ⚔️</p>
        </div>

        {/* ── Menu ── */}
        {mode === "menu" && (
          <div className="flex flex-col gap-2 w-full fade-in" style={{ animationDelay: "0.15s" }}>

            {/* Active session banner */}
            {activeSession && (
              <div className="glass-card w-full p-4 space-y-3" style={{ border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.08)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔄</span>
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: "var(--text-1)" }}>لديك جلسة نشطة</p>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                      الجلسة <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>{activeSession.sessionId}</span>
                      {" — "}
                      {activeSession.phase === "lobby" ? "في الانتظار" : activeSession.phase === "win" ? "انتهت" : "جارية"}
                      {" · "}
                      {activeSession.playerCount} لاعب
                    </p>
                  </div>
                </div>
                {activeSession.phase !== "lobby" && (
                  <div className="flex gap-3 justify-center text-xs font-bold">
                    <span style={{ color: "#f97316" }}>🟠 {activeSession.orangeScore}</span>
                    <span style={{ color: "var(--text-3)" }}>—</span>
                    <span style={{ color: "#22c55e" }}>🟢 {activeSession.greenScore}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1 py-3 text-sm"
                    onClick={handleRejoin}
                  >
                    🚀 العودة للجلسة
                  </button>
                  <button
                    className="btn-ghost flex-1 py-3 text-sm"
                    onClick={handleLeaveSession}
                    disabled={leavingSession}
                    style={{ borderColor: "rgba(239,68,68,0.3)", color: "#f87171" }}
                  >
                    {leavingSession ? "⏳ جاري المغادرة..." : "🚪 مغادرة الجلسة"}
                  </button>
                </div>
              </div>
            )}

            {!activeSession && (
              <>
                <button className="btn-primary w-full py-4 text-lg tracking-wide" onClick={() => {
                  if (!user) { setGuestAction("create"); setMode("guest-prompt"); }
                  else setMode("create");
                }}>🎮 إنشاء جلسة</button>
                <button className="btn-ghost w-full py-3 text-sm" onClick={() => {
                  if (!user) { setGuestAction("join"); setMode("guest-prompt"); }
                  else setMode("join");
                }}>🔗 انضمام لجلسة</button>
              </>
            )}

            {/* Guest/Auth info banner */}
            {!authLoading && !user && (
              <div className="glass-card w-full p-3 mt-1 text-center space-y-2">
                <p className="text-sm font-bold" style={{ color: "var(--text-1)" }}>مرحباً بك في حروف!</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  يمكنك اللعب كضيف أو تسجيل حساب لحفظ إحصائياتك
                </p>
                <div className="flex gap-2 justify-center">
                  <a href="/login" className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(168,85,247,0.3)", color: "var(--accent)", textDecoration: "none" }}>
                    🔑 تسجيل الدخول
                  </a>
                  <a href="/register" className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", textDecoration: "none" }}>
                    📝 إنشاء حساب
                  </a>
                </div>
              </div>
            )}

            {isGuest && (
              <div className="glass-card w-full p-3 mt-1" style={{ border: "1px solid rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.08)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚠️</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: "#facc15" }}>أنت تلعب كضيف</p>
                    <p className="text-[10px]" style={{ color: "var(--text-3)" }}>لن يتم حفظ إحصائياتك بعد انتهاء الجلسة.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href="/login" className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all"
                    style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(168,85,247,0.35)", color: "var(--accent)", textDecoration: "none" }}>
                    🔑 تسجيل الدخول
                  </a>
                  <a href="/register" className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", textDecoration: "none" }}>
                    📝 إنشاء حساب
                  </a>
                </div>
              </div>
            )}

            {/* Error in menu mode */}
            {error && (
              <div className="px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg text-red-400 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <div className="glass-card w-full p-3 mt-1">
              <h2 className="font-black text-sm text-center mb-2" style={{ color: "var(--text-1)" }}>كيف تلعب؟</h2>
              <div className="space-y-1">
                {[
                  ["🎲", "أنشئ جلسة أو انضم بالرمز"],
                  ["👥", "اختر فريقك وعيّن مدير لعبة"],
                  ["❓", "مدير اللعبة يختار حرفاً ويطرح سؤالاً"],
                  ["⚡", "اضغط الجرس أولاً للإجابة!"],
                  ["🏆", "أول فريق يربط مساره يفوز"],
                ].map(([icon, text], i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-base shrink-0">{icon}</span>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Create ── */}
        {mode === "create" && (
          <div className="glass-card w-full p-4 fade-in-scale">
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
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce">
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
          <div className="glass-card w-full p-4 fade-in-scale text-center space-y-4">
            <div className="text-3xl">👤</div>
            <h2 className="text-lg font-black" style={{ color: "var(--text-1)" }}>
              {guestAction === "create" ? "إنشاء جلسة كضيف" : "انضمام كضيف"}
            </h2>
            
            {/* Guest limitations */}
            <div className="rounded-lg p-3 text-right" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
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
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "var(--accent)", textDecoration: "none" }}>
                🔑 تسجيل الدخول
              </a>
              <a href="/register" className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center transition-all"
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", textDecoration: "none" }}>
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
          <div className="glass-card w-full p-4 fade-in-scale">
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
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce">
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

        <p className="text-xs" style={{ color: "var(--text-4)" }}>حروف — لعبة ثقافية تفاعلية</p>
      </div>
    </div>
  );
}
