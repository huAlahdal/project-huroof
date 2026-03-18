import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/contexts/AuthContext";
import ThemeToggle from "~/components/ThemeToggle";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading, logout, updateProfile, changePassword } = useAuth();

  // Profile form
  const [username, setUsername] = useState(user?.username || "");
  const [inGameName, setInGameName] = useState(user?.inGameName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync form fields once user data is available
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setInGameName(user.inGameName);
      setEmail(user.email);
    }
  }, [user]);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Redirect if not logged in (only after auth has finished loading)
  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [loading, user, navigate]);

  if (loading) return null;
  if (!user) return null;

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);
    const result = await updateProfile({
      username: username !== user!.username ? username : undefined,
      inGameName: inGameName !== user!.inGameName ? inGameName : undefined,
      email: email !== user!.email ? email : undefined,
    });
    if (result.success) {
      setProfileMsg({ type: "success", text: "تم تحديث الملف الشخصي" });
    } else {
      setProfileMsg({ type: "error", text: result.error || "فشل التحديث" });
    }
    setProfileLoading(false);
    setTimeout(() => setProfileMsg(null), 4000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPassMsg({ type: "error", text: "كلمتا المرور غير متطابقتين" });
      return;
    }
    if (newPassword.length < 6) {
      setPassMsg({ type: "error", text: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      return;
    }
    setPassLoading(true);
    setPassMsg(null);
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setPassMsg({ type: "success", text: "تم تغيير كلمة المرور" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } else {
      setPassMsg({ type: "error", text: result.error || "فشل تغيير كلمة المرور" });
    }
    setPassLoading(false);
    setTimeout(() => setPassMsg(null), 4000);
  }

  return (
    <div className="game-bg min-h-screen relative overflow-hidden flex flex-col items-center justify-start px-4 py-8">
      {/* Theme toggle */}
      <div className="fixed top-3 left-3 z-20">
        <ThemeToggle />
      </div>

      {/* Back */}
      <div className="fixed top-3 right-3 z-20">
        <button
          onClick={() => navigate("/")}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}
        >
          → العودة
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg w-full mt-8">
        {/* Header */}
        <div className="text-center fade-in">
          <h1 className="text-3xl font-black" style={{ color: "var(--text-1)" }}>👤 الملف الشخصي</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
            {user.username} — {user.gamesPlayed} مباريات • {user.gamesWon} فوز
          </p>
        </div>

        {/* Profile Info */}
        <form onSubmit={handleUpdateProfile} className="glass-card w-full p-5 fade-in-scale space-y-3">
          <h2 className="text-base font-black mb-2" style={{ color: "var(--text-1)" }}>تعديل الملف الشخصي</h2>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "var(--accent)" }}>البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="input-field" dir="ltr" />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "var(--accent)" }}>اسم المستخدم</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="input-field" dir="ltr" maxLength={24} />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "var(--accent)" }}>الاسم في اللعبة</label>
            <input type="text" value={inGameName} onChange={(e) => setInGameName(e.target.value)}
              className="input-field" maxLength={24} />
          </div>

          {profileMsg && (
            <div className="px-3 py-2 rounded-lg text-sm font-medium text-center"
              style={{
                background: profileMsg.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: `1px solid ${profileMsg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: profileMsg.type === "success" ? "#4ade80" : "#f87171"
              }}>
              {profileMsg.text}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-2.5 text-sm" disabled={profileLoading}>
            {profileLoading ? "⏳ جاري الحفظ..." : "💾 حفظ التغييرات"}
          </button>
        </form>

        {/* Password Change */}
        <form onSubmit={handleChangePassword} className="glass-card w-full p-5 fade-in-scale space-y-3">
          <h2 className="text-base font-black mb-2" style={{ color: "var(--text-1)" }}>تغيير كلمة المرور</h2>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "var(--accent)" }}>كلمة المرور الحالية</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field" autoComplete="current-password" />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "var(--accent)" }}>كلمة المرور الجديدة</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="input-field" autoComplete="new-password" />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: "var(--accent)" }}>تأكيد كلمة المرور الجديدة</label>
            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="input-field" autoComplete="new-password" />
          </div>

          {passMsg && (
            <div className="px-3 py-2 rounded-lg text-sm font-medium text-center"
              style={{
                background: passMsg.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: `1px solid ${passMsg.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: passMsg.type === "success" ? "#4ade80" : "#f87171"
              }}>
              {passMsg.text}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-2.5 text-sm"
            disabled={passLoading || !currentPassword || !newPassword || !confirmNewPassword}>
            {passLoading ? "⏳ جاري التغيير..." : "🔒 تغيير كلمة المرور"}
          </button>
        </form>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="btn-ghost w-full py-3 text-sm font-bold"
          style={{ color: "#f87171" }}
        >
          🚪 تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
