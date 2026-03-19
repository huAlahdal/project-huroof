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

  const winRate = user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0;

  return (
    <div className="game-bg min-h-screen relative overflow-hidden flex flex-col items-center justify-start px-4 py-12" dir="rtl">
      {/* Theme toggle */}
      <div className="fixed top-4 left-4 z-20">
        <ThemeToggle />
      </div>

      {/* Back */}
      <div className="fixed top-4 right-4 z-20">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 shadow-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <span>→</span> العودة للرئيسية
        </button>
      </div>

      <div className="relative z-10 w-full max-w-6xl mt-8 fade-in">
        {/* Page Title */}
        <div className="mb-8 text-right">
          <h1 className="text-4xl md:text-5xl font-black mb-2" style={{ color: "var(--text-1)" }}>
            إعدادات الحساب
          </h1>
          <p className="text-lg" style={{ color: "var(--text-3)" }}>
            قم بإدارة تفاصيل حسابك وإحصائياتك
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT/RIGHT ALIGN: Since dir="rtl", grid order is naturally RTL. Let's make "Sidebar" (stats) span 4 cols, "Content" span 8. */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* User Profile Card */}
            <div className="glass-card p-8 flex flex-col items-center text-center relative overflow-hidden group">
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-full h-24" style={{ background: "linear-gradient(135deg, var(--accent), transparent)", opacity: 0.2 }}></div>
              
              <div className="relative w-32 h-32 rounded-full mb-4 shadow-2xl flex items-center justify-center text-5xl font-black transition-transform group-hover:scale-105"
                style={{ background: "var(--surface-hover)", border: "4px solid var(--accent)", color: "var(--accent)" }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              
              <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-1)" }}>{user.inGameName || user.username}</h2>
              <p className="text-sm font-medium px-3 py-1 rounded-full mb-6" style={{ background: "var(--surface)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
                @{user.username}
              </p>

              {/* Stats Grid */}
              <div className="w-full grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl flex flex-col items-center justify-center" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                  <span className="text-3xl font-black mb-1" style={{ color: "var(--accent)" }}>{user.gamesPlayed}</span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>المباريات</span>
                </div>
                <div className="p-4 rounded-2xl flex flex-col items-center justify-center" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                  <span className="text-3xl font-black mb-1 text-green-500">{user.gamesWon}</span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>الفوز</span>
                </div>
                <div className="col-span-2 p-4 rounded-2xl flex flex-row items-center justify-between px-6" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                  <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>الإجابات الصحيحة</span>
                  <span className="text-2xl font-black text-blue-400">{user.correctAnswers || 0}</span>
                </div>
                <div className="col-span-2 p-4 rounded-2xl flex flex-row items-center justify-between px-6" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                  <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>نسبة الفوز</span>
                  <span className="text-2xl font-black" style={{ color: "var(--text-1)" }}>{winRate}%</span>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="glass-card p-4">
              <button
                onClick={() => logout()}
                className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all hover:bg-red-500/10 hover:text-red-500"
                style={{ color: "#f87171", border: "1px solid rgba(248, 113, 113, 0.2)" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                تسجيل الخروج
              </button>
            </div>
            
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Profile Info */}
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-hover)", color: "var(--accent)" }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black" style={{ color: "var(--text-1)" }}>المعلومات الشخصية</h2>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold px-1" style={{ color: "var(--text-2)" }}>اسم المستخدم</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      className="input-field w-full py-3 px-4" dir="ltr" maxLength={24} />
                    <p className="text-xs px-1" style={{ color: "var(--text-4)" }}>المعرف الفريد الخاص بك</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold px-1" style={{ color: "var(--text-2)" }}>الاسم في اللعبة</label>
                    <input type="text" value={inGameName} onChange={(e) => setInGameName(e.target.value)}
                      className="input-field w-full py-3 px-4" maxLength={24} />
                    <p className="text-xs px-1" style={{ color: "var(--text-4)" }}>الاسم الذي يظهر للاعبين الآخرين</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold px-1" style={{ color: "var(--text-2)" }}>البريد الإلكتروني</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-field w-full py-3 px-4 text-left" dir="ltr" />
                </div>

                {profileMsg && (
                  <div className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                    style={{
                      background: profileMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${profileMsg.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                      color: profileMsg.type === "success" ? "#4ade80" : "#f87171"
                    }}>
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {profileMsg.type === "success" 
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      }
                    </svg>
                    {profileMsg.text}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button type="submit" className="btn-primary py-3 px-8 text-sm font-bold shadow-lg" disabled={profileLoading}>
                    {profileLoading ? "⏳ جاري الحفظ..." : "حفظ التغييرات"}
                  </button>
                </div>
              </form>
            </div>

            {/* Password Change */}
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-hover)", color: "var(--text-2)" }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black" style={{ color: "var(--text-1)" }}>تحديث كلمة المرور</h2>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold px-1" style={{ color: "var(--text-2)" }}>كلمة المرور الحالية</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field w-full py-3 px-4 text-left" dir="ltr" autoComplete="current-password" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold px-1" style={{ color: "var(--text-2)" }}>كلمة المرور الجديدة</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field w-full py-3 px-4 text-left" dir="ltr" autoComplete="new-password" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold px-1" style={{ color: "var(--text-2)" }}>تأكيد كلمة المرور</label>
                    <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="input-field w-full py-3 px-4 text-left" dir="ltr" autoComplete="new-password" />
                  </div>
                </div>

                {passMsg && (
                  <div className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                    style={{
                      background: passMsg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${passMsg.type === "success" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                      color: passMsg.type === "success" ? "#4ade80" : "#f87171"
                    }}>
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {passMsg.type === "success" 
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      }
                    </svg>
                    {passMsg.text}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button type="submit" className="btn-primary py-3 px-8 text-sm font-bold shadow-lg"
                    disabled={passLoading || !currentPassword || !newPassword || !confirmNewPassword}>
                    {passLoading ? "⏳ جاري التحديث..." : "تحديث كلمة المرور"}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
