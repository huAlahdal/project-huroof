import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "~/contexts/AuthContext";
import ThemeToggle from "~/components/ThemeToggle";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !inGameName.trim() || !password.trim()) return;
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setLoading(true);
    setError("");
    const result = await register(email.trim(), inGameName.trim(), password);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "فشل إنشاء الحساب");
    }
    setLoading(false);
  }

  const isValid = email.trim() && inGameName.trim() && password.trim();

  return (
    <div className="game-bg min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Theme toggle */}
      <div className="fixed top-3 left-3 z-20">
        <ThemeToggle />
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 75% 65% at center,transparent 0%,rgba(0,0,0,0.4) 100%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full">
        {/* Logo */}
        <div className="text-center fade-in">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-3 flex items-center justify-center text-4xl font-black text-white shadow-2xl logo-spin"
            style={{ background: "linear-gradient(135deg,#7c3aed 0%,#a855f7 60%,#ec4899 100%)", boxShadow: "0 0 40px rgba(168,85,247,0.55)" }}
          >
            ح
          </div>
          <h1
            className="text-4xl font-black leading-tight mb-1"
            style={{ background: "linear-gradient(135deg,#f97316 0%,#a855f7 50%,#22c55e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            إنشاء حساب
          </h1>
        </div>

        {/* Register form */}
        <form onSubmit={handleRegister} className="surface-card w-full p-5 fade-in-scale space-y-3">
          <div>
            <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="input-field"
              autoComplete="email"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>الاسم في اللعبة</label>
            <input
              type="text"
              value={inGameName}
              onChange={(e) => setInGameName(e.target.value)}
              placeholder="الاسم الذي سيظهر للاعبين"
              className="input-field"
              maxLength={24}
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1.5" style={{ color: "var(--accent)" }}>كلمة المرور</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                className="input-field"
                autoComplete="new-password"
                style={{ paddingLeft: "2.5rem" }}
              />
              <button
                type="button"
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
            <div className="px-3 py-2 rounded-lg text-sm font-medium text-center"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-3 text-base"
            disabled={loading || !isValid}
            style={{ opacity: !isValid ? 0.5 : 1 }}
          >
            {loading ? "⏳ جاري الإنشاء..." : "✨ إنشاء حساب"}
          </button>

          <p className="text-center text-sm" style={{ color: "var(--text-3)" }}>
            لديك حساب؟{" "}
            <Link to="/login" className="font-bold" style={{ color: "var(--accent)" }}>
              تسجيل الدخول
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
