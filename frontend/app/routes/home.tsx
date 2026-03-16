import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { invoke, startConnection } from "~/lib/signalr";
import ThemeToggle from "~/components/ThemeToggle";

const BG_LETTERS = ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ر", "ز", "س", "ش", "ص", "ط", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
const BG_COLORS = ["#7c3aed", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#f59e0b"];

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"menu" | "create" | "join" | "created">("menu");
  const [error, setError] = useState("");

  // Create form
  const [gridSize, setGridSize] = useState(5);
  const [rounds, setRounds] = useState(2);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);

  // Created info
  const [createdSessionId, setCreatedSessionId] = useState("");
  const [copied, setCopied] = useState(false);

  // Join form
  const [joinId, setJoinId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPass, setShowJoinPass] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

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
    if (!password.trim()) return;
    setCreating(true);
    setError("");
    try {
      await startConnection();
      const result = await invoke<{ sessionId: string }>("CreateSession", password, gridSize, rounds);
      if (result.sessionId) {
        sessionStorage.setItem(`huroof_pass_${result.sessionId}`, password);
        sessionStorage.setItem(`huroof_creator_${result.sessionId}`, "true");
        setCreatedSessionId(result.sessionId);
        setMode("created");
      }
    } catch (e: any) {
      setError(e.message || "فشل إنشاء الجلسة");
    }
    setCreating(false);
  }

  async function handleJoinAsCreator() {
    const sid = createdSessionId;
    if (!joinName.trim()) return;
    try {
      const result = await invoke<{ success?: boolean; playerId?: string }>(
        "JoinSession", sid, password, joinName
      );
      if (result.success) {
        sessionStorage.setItem(`huroof_name_${sid}`, joinName);
        sessionStorage.setItem(`huroof_playerId_${sid}`, result.playerId || "");
        navigate(`/lobby/${sid}`);
      }
    } catch { navigate(`/lobby/${sid}`); }
  }

  async function handleJoin() {
    if (!joinId.trim() || !joinPassword.trim() || !joinName.trim()) return;
    setJoining(true);
    setError("");
    try {
      await startConnection();
      const result = await invoke<{ success?: boolean; error?: string; playerId?: string }>(
        "JoinSession", joinId.toUpperCase(), joinPassword, joinName
      );
      if (result.success) {
        sessionStorage.setItem(`huroof_pass_${joinId.toUpperCase()}`, joinPassword);
        sessionStorage.setItem(`huroof_name_${joinId.toUpperCase()}`, joinName);
        sessionStorage.setItem(`huroof_playerId_${joinId.toUpperCase()}`, result.playerId || "");
        navigate(`/lobby/${joinId.toUpperCase()}`);
      } else {
        setError(result.error || "فشل الانضمام");
      }
    } catch (e: any) {
      setError(e.message || "فشل الاتصال بالخادم");
    }
    setJoining(false);
  }

  function copySessionId() {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(createdSessionId)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                // Fallback for older browsers
                fallbackCopy();
            });
    } else {
        // Direct fallback for browsers without clipboard API
        fallbackCopy();
    }
    
    function fallbackCopy() {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = createdSessionId;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy session ID:', err);
        }
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
      <div className="fixed top-3 right-3 z-20">
        <a
          href="/admin"
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", textDecoration: "none" }}
        >
          ⚙️ إدارة
        </a>
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
            <button className="btn-primary w-full py-4 text-lg tracking-wide" onClick={() => setMode("create")}>🎮 إنشاء جلسة</button>
            <button className="btn-ghost w-full py-3 text-sm" onClick={() => setMode("join")}>🔗 انضمام لجلسة</button>

            <div className="glass-card w-full p-3 mt-1">
              <h2 className="font-black text-sm text-center mb-2" style={{ color: "var(--text-1)" }}>كيف تلعب؟</h2>
              <div className="space-y-1">
                {[
                  ["🎲", "أنشئ جلسة أو انضم بالرمز وكلمة المرور"],
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
              <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>كلمة مرور الجلسة</label>
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
              disabled={creating || !password.trim()}
              style={{ opacity: !password.trim() ? 0.5 : 1 }}
            >
              {creating ? "⏳ جاري الإنشاء..." : "🎮 إنشاء الجلسة"}
            </button>
            <button className="w-full mt-2 text-xs font-semibold transition-colors" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => { setMode("menu"); setError(""); }}>
              ← رجوع
            </button>
          </div>
        )}

        {/* ── Created Session Info ── */}
        {mode === "created" && (
          <div className="glass-card w-full p-4 fade-in-scale text-center space-y-3">
            <div className="text-3xl">🎉</div>
            <h2 className="text-lg font-black" style={{ color: "var(--text-1)" }}>تم إنشاء الجلسة!</h2>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>شارك الرمز وكلمة المرور مع اللاعبين</p>

            {/* Session ID */}
            <div className="rounded-xl p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)" }}>
              <p className="text-xs font-bold mb-1" style={{ color: "var(--text-3)" }}>رمز الجلسة</p>
              <p className="text-3xl font-black tracking-widest mb-2" style={{ color: "var(--accent)", fontFamily: "monospace", direction: "ltr" }}>
                {createdSessionId}
              </p>
              <button
                className="btn-ghost px-4 py-1.5 text-xs"
                onClick={copySessionId}
              >
                {copied ? "✅ تم النسخ!" : "📋 نسخ الرمز"}
              </button>
            </div>

            {/* Password */}
            <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-3)" }}>كلمة المرور</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-lg font-black tracking-widest" style={{ color: "var(--text-1)", fontFamily: showPass ? "inherit" : "monospace", letterSpacing: showPass ? "0.1em" : "0.3em" }}>
                  {showPass ? password : "•".repeat(password.length)}
                </p>
                <button
                  onClick={() => setShowPass((p) => !p)}
                  className="text-lg"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Creator Name Input - More compact */}
            <div className="rounded-lg p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
              <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>اسمك في اللعبة</label>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="أدخل اسمك"
                className="input-field text-center"
                maxLength={24}
                autoComplete="off"
                onKeyDown={(e) => e.key === "Enter" && joinName.trim() && handleJoinAsCreator()}
              />
            </div>

            <button 
              className="btn-primary w-full py-3 text-base" 
              onClick={handleJoinAsCreator}
              disabled={!joinName.trim()}
              style={{ opacity: !joinName.trim() ? 0.5 : 1 }}
            >
              🚀 الدخول للغرفة
            </button>
            <button className="w-full mt-2 text-xs font-semibold transition-colors" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => { setMode("menu"); setError(""); }}>
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
                  onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                  placeholder="مثال: AB1234"
                  className="input-field text-center tracking-widest font-black text-lg"
                  style={{ direction: "ltr" }}
                  maxLength={6}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showJoinPass ? "text" : "password"}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="إذا كانت الجلسة محمية"
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
              disabled={joining || !joinId.trim() || !joinPassword.trim() || !joinName.trim()}
              style={{ opacity: (!joinId.trim() || !joinPassword.trim() || !joinName.trim()) ? 0.5 : 1 }}
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
