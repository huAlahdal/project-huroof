import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import ThemeToggle from "~/components/ThemeToggle";
import Dropdown from "~/components/Dropdown";
import { useAuth, authHeaders } from "~/contexts/AuthContext";
import { API_BASE } from "../lib/api";

const API_BASE_URL = API_BASE;

// ─── Types ──────────────────────────────────────────────────

interface Question {
    id: string;
    letter: string;
    question: string;
    answer: string;
    category: string;
    difficulty: string;
}

interface Session {
    id: string;
    playerCount: number;
    phase: string;
    orangeScore: number;
    greenScore: number;
    hostPlayerId: string;
    gridSize?: number;
    totalRounds?: number;
    players: { id: string; name: string; role: string; connectionId?: string }[];
}

interface AdminUser {
    id: string;
    email: string;
    username: string;
    inGameName: string;
    role: string;
    gamesPlayed: number;
    gamesWon: number;
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
}

interface Stats {
    questionCount: number;
    userCount: number;
    activeSessions: number;
    totalPlayers: number;
}

type ViewTab = "questions" | "sessions" | "users" | "stats";

// ─── Component ──────────────────────────────────────────────

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [view, setView] = useState<ViewTab>("stats");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [stats, setStats] = useState<Stats>({ questionCount: 0, userCount: 0, activeSessions: 0, totalPlayers: 0 });
    const [qSearch, setQSearch] = useState("");
    const [qFilter, setQFilter] = useState({ letter: "all", category: "all", difficulty: "all" });
    const [formQ, setFormQ] = useState<Partial<Question>>({});
    const [showQForm, setShowQForm] = useState(false);
    const [editQ, setEditQ] = useState<Question | null>(null);
    const [uploading, setUploading] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Users tab state
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [userForm, setUserForm] = useState<Partial<AdminUser>>({});
    const [showUserForm, setShowUserForm] = useState(false);
    const [resetPwUser, setResetPwUser] = useState<AdminUser | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [userSearch, setUserSearch] = useState("");

    // ─── API helpers ────────────────────────────────────────

    const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
        const hdrs = authHeaders();
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers: {
                ...hdrs,
                ...(init?.headers || {}),
            },
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            let msg = `HTTP ${response.status}`;
            try { const j = JSON.parse(text); if (j.error) msg = j.error; } catch { if (text) msg += `: ${text}`; }
            throw new Error(msg);
        }
        if (response.status === 204) return null;
        return response.json();
    }, []);

    const flash = (msg: string, type: "error" | "success") => {
        if (type === "error") { setError(msg); setTimeout(() => setError(""), 5000); }
        else { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }
    };

    // ─── Data loaders ───────────────────────────────────────

    const loadOverview = useCallback(async () => {
        try {
            const res = await apiFetch("/api/admin/overview");
            setStats({
                questionCount: res.questionCount,
                userCount: res.userCount,
                activeSessions: res.sessionCount,
                totalPlayers: res.playerCount,
            });
        } catch { /* ignore */ }
    }, [apiFetch]);

    const loadQuestions = useCallback(async () => {
        try {
            const res = await apiFetch("/api/admin/questions");
            setQuestions(res);
        } catch (e: any) { flash(e.message, "error"); }
    }, [apiFetch]);

    const loadSessions = useCallback(async () => {
        try {
            const res = await apiFetch("/api/admin/sessions");
            setSessions(res);
        } catch (e: any) { flash(e.message, "error"); }
    }, [apiFetch]);

    const loadUsers = useCallback(async () => {
        try {
            const res = await apiFetch("/api/admin/users");
            setUsers(res);
        } catch (e: any) { flash(e.message, "error"); }
    }, [apiFetch]);

    const loadData = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadOverview(), loadQuestions(), loadSessions(), loadUsers()]);
        setLoading(false);
    }, [loadOverview, loadQuestions, loadSessions, loadUsers]);

    // ─── Auth gate ──────────────────────────────────────────

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate("/login");
            return;
        }
        if (user.role !== "admin") {
            navigate("/");
            return;
        }
        loadData();
    }, [authLoading, user]);

    // ─── Question Actions ───────────────────────────────────

    const saveQuestion = async () => {
        if (!formQ.letter || !formQ.question || !formQ.answer) {
            flash("املأ جميع الحقول المطلوبة", "error");
            return;
        }
        try {
            if (editQ) {
                await apiFetch(`/api/admin/questions/${editQ.id}`, { method: "PUT", body: JSON.stringify(formQ) });
                flash("تم تحديث السؤال", "success");
            } else {
                await apiFetch("/api/admin/questions", { method: "POST", body: JSON.stringify(formQ) });
                flash("تم إضافة السؤال", "success");
            }
            setShowQForm(false); setEditQ(null); setFormQ({});
            await loadQuestions();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
    };

    const deleteQuestion = async (id: string) => {
        if (!confirm("حذف هذا السؤال؟")) return;
        try {
            await apiFetch(`/api/admin/questions/${id}`, { method: "DELETE" });
            flash("تم حذف السؤال", "success");
            await loadQuestions();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
    };

    const uploadJsonFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith(".json")) { flash("اختر ملف JSON", "error"); return; }
        setUploading(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error("يجب أن يحتوي الملف على مصفوفة أسئلة");
            // Normalize PascalCase or camelCase field names
            const normalized = data.map((q: any) => ({
                letter:     q.letter     ?? q.Letter,
                question:   q.question   ?? q.Question,
                answer:     q.answer     ?? q.Answer,
                category:   q.category   ?? q.Category,
                difficulty: q.difficulty ?? q.Difficulty,
                id:         q.id         ?? q.Id,
            }));
            const valid = normalized.filter((q: any) => q.letter && q.question && q.answer && q.category && q.difficulty);
            if (valid.length === 0) throw new Error("لا توجد أسئلة صالحة في الملف");
            await apiFetch("/api/admin/questions/import", { method: "POST", body: JSON.stringify(normalized) });
            flash(`تم استيراد ${normalized.length} سؤال`, "success");
            await loadQuestions();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
        finally { setUploading(false); }
    }, [apiFetch, loadQuestions, loadOverview]);

    const migrateQuestions = async () => {
        if (!confirm("نقل جميع الأسئلة من JSON إلى قاعدة البيانات؟")) return;
        setMigrating(true);
        try {
            const res = await apiFetch("/api/admin/questions/migrate", { method: "POST" });
            flash(`تم نقل ${res?.migrated ?? 0} سؤال`, "success");
            await loadQuestions();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
        finally { setMigrating(false); }
    };

    const clearAllQuestions = async () => {
        if (!confirm("حذف جميع الأسئلة؟ لا يمكن التراجع!")) return;
        try {
            await apiFetch("/api/admin/questions", { method: "DELETE" });
            flash("تم حذف جميع الأسئلة", "success");
            await loadQuestions();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
    };

    // ─── Session Actions ────────────────────────────────────

    const endSession = async (id: string) => {
        if (!confirm("إنهاء هذه الجلسة؟")) return;
        try {
            await apiFetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
            flash("تم إنهاء الجلسة", "success");
            setSelectedSession(null);
            await loadSessions();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
    };

    const resetSession = async (id: string) => {
        if (!confirm("إعادة تعيين هذه الجلسة؟")) return;
        try {
            await apiFetch(`/api/admin/sessions/${id}/reset`, { method: "POST" });
            flash("تم إعادة تعيين الجلسة", "success");
            await loadSessions();
        } catch (e: any) { flash(e.message, "error"); }
    };

    const kickPlayer = async (sessionId: string, playerId: string) => {
        if (!confirm("طرد هذا اللاعب؟")) return;
        try {
            await apiFetch(`/api/admin/sessions/${sessionId}/players/${playerId}`, { method: "DELETE" });
            flash("تم طرد اللاعب", "success");
            await loadSessions();
        } catch (e: any) { flash(e.message, "error"); }
    };

    // ─── User Actions ───────────────────────────────────────

    const saveUser = async () => {
        if (!editingUser) return;
        try {
            await apiFetch(`/api/admin/users/${editingUser.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    inGameName: userForm.inGameName,
                    email: userForm.email,
                    username: userForm.username,
                    role: userForm.role,
                    isActive: userForm.isActive,
                }),
            });
            flash("تم تحديث المستخدم", "success");
            setShowUserForm(false); setEditingUser(null); setUserForm({});
            await loadUsers();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm("حذف هذا المستخدم نهائياً؟")) return;
        try {
            await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
            flash("تم حذف المستخدم", "success");
            await loadUsers();
            await loadOverview();
        } catch (e: any) { flash(e.message, "error"); }
    };

    const resetPassword = async () => {
        if (!resetPwUser || !newPassword) return;
        try {
            await apiFetch(`/api/admin/users/${resetPwUser.id}/password`, {
                method: "PUT",
                body: JSON.stringify({ newPassword }),
            });
            flash("تم إعادة تعيين كلمة المرور", "success");
            setResetPwUser(null); setNewPassword("");
        } catch (e: any) { flash(e.message, "error"); }
    };

    // ─── Computed ───────────────────────────────────────────

    const filteredQuestions = questions.filter(q => {
        if (qFilter.category !== "all" && q.category !== qFilter.category) return false;
        if (qFilter.difficulty !== "all" && q.difficulty !== qFilter.difficulty) return false;
        if (qFilter.letter !== "all" && q.letter !== qFilter.letter) return false;
        if (qSearch && !q.question.toLowerCase().includes(qSearch.toLowerCase()) &&
            !q.answer.toLowerCase().includes(qSearch.toLowerCase())) return false;
        return true;
    });

    const filteredUsers = users.filter(u => {
        if (!userSearch) return true;
        const s = userSearch.toLowerCase();
        return u.username.toLowerCase().includes(s) ||
            u.email.toLowerCase().includes(s) ||
            u.inGameName.toLowerCase().includes(s) ||
            u.id.toLowerCase().includes(s);
    });

    const categories = Array.from(new Set(questions.map(q => q.category)));
    const letters = Array.from(new Set(questions.map(q => q.letter))).sort();
    const selectedSessionData = sessions.find(s => s.id === selectedSession);

    // ─── Auth loading / gate ────────────────────────────────

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
                <div className="text-white/60 text-lg">جار التحميل...</div>
            </div>
        );
    }

    if (!user || user.role !== "admin") return null;

    // ─── Render ─────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
{/* Header */}
            <header className="relative bg-[#1a103c] border-b border-[var(--border)]">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25">
                                🛡️
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">لوحة التحكم</h1>
                                <p className="text-xs text-white/60">إدارة كاملة — {user.inGameName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {loading && <span className="text-xs text-white/40 animate-pulse">جار التحميل...</span>}
                            <button onClick={loadData} className="px-3 py-1.5 text-sm font-medium text-white/60 hover:text-white bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition-all">🔄</button>
                            <ThemeToggle />
                            <button onClick={() => navigate("/")} className="px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition-all">
                                🏠
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="relative max-w-7xl mx-auto px-4 py-6">
                {/* Messages */}
                {error && (
                    <div className="mb-4 px-4 py-2 bg-red-500/20  border border-red-500/30 rounded-lg text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 px-4 py-2 bg-green-500/20  border border-green-500/30 rounded-lg text-green-400 text-sm font-medium">
                        {success}
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-4 flex flex-wrap gap-2 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] w-fit">
                    {([
                        { key: "stats", label: "نظرة عامة", icon: "📊" },
                        { key: "questions", label: "الأسئلة", icon: "❓" },
                        { key: "sessions", label: "الجلسات", icon: "🎮" },
                        { key: "users", label: "المستخدمون", icon: "👥" },
                    ] as { key: ViewTab; label: string; icon: string }[]).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setView(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                view === tab.key
                                    ? "bg-violet-600 text-white shadow-lg"
                                    : "text-white/60 hover:text-white hover:bg-[var(--surface)]"
                            }`}
                        >
                            <span className="ml-1">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ───────── Stats View ───────── */}
                {view === "stats" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "الأسئلة", value: stats.questionCount, icon: "❓", bg: "bg-violet-500/20" },
                                { label: "المستخدمون", value: stats.userCount, icon: "👥", bg: "bg-blue-500/20" },
                                { label: "الجلسات النشطة", value: stats.activeSessions, icon: "🎮", bg: "bg-green-500/20" },
                                { label: "اللاعبون المتصلون", value: stats.totalPlayers, icon: "🎯", bg: "bg-orange-500/20" },
                            ].map((s) => (
                                <div key={s.label} className="surface-card p-4 shadow-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-white/80">{s.label}</h3>
                                        <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center text-xl`}>
                                            {s.icon}
                                        </div>
                                    </div>
                                    <p className="text-3xl font-bold text-white">{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ───────── Questions View ───────── */}
                {view === "questions" && (
                    <div className="space-y-4">
                        {/* Search & Filters */}
                        <div className="surface-card p-4 shadow-xl">
                            <div className="flex flex-wrap gap-3 items-center justify-between">
                                <div className="flex flex-wrap gap-3 flex-1">
                                    <input
                                        type="text"
                                        value={qSearch}
                                        onChange={(e) => setQSearch(e.target.value)}
                                        placeholder="🔍 بحث..."
                                        className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-white/40 text-sm focus:border-[var(--border-strong)] focus:outline-none flex-1 min-w-[160px]"
                                    />
                                    <Dropdown
                                        value={qFilter.letter}
                                        onChange={(value) => setQFilter(f => ({ ...f, letter: value }))}
                                        options={[{ value: "all", label: "كل الحروف" }, ...letters.map(l => ({ value: l, label: l }))]}
                                        placeholder="كل الحروف"
                                        className="min-w-[110px]"
                                    />
                                    <Dropdown
                                        value={qFilter.category}
                                        onChange={(value) => setQFilter(f => ({ ...f, category: value }))}
                                        options={[{ value: "all", label: "كل الفئات" }, ...categories.map(c => ({ value: c, label: c }))]}
                                        placeholder="كل الفئات"
                                        className="min-w-[110px]"
                                    />
                                    <Dropdown
                                        value={qFilter.difficulty}
                                        onChange={(value) => setQFilter(f => ({ ...f, difficulty: value }))}
                                        options={[
                                            { value: "all", label: "كل الصعوبات" },
                                            { value: "easy", label: "سهل" },
                                            { value: "medium", label: "متوسط" },
                                            { value: "hard", label: "صعب" },
                                        ]}
                                        placeholder="كل الصعوبات"
                                        className="min-w-[110px]"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <label className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer bg-blue-600 hover:bg-blue-700 text-white transition-all">
                                        {uploading ? "جاري..." : "📥 رفع JSON"}
                                        <input type="file" accept=".json" onChange={uploadJsonFile} className="hidden" disabled={uploading} />
                                    </label>
                                    <button onClick={() => { setShowQForm(true); setEditQ(null); setFormQ({ category: "عام", difficulty: "medium" }); }} className="px-3 py-1.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white transition-all">
                                        ➕ إضافة سؤال
                                    </button>
                                    <button onClick={migrateQuestions} disabled={migrating} className="px-3 py-1.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition-all">
                                        {migrating ? "جاري..." : "📤 نقل من JSON"}
                                    </button>
                                    <button onClick={clearAllQuestions} className="px-3 py-1.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-all">
                                        🗑️ مسح الكل
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Question Form */}
                        {showQForm && (
                            <div className="surface-card p-4 shadow-xl">
                                <h3 className="text-base font-semibold text-white mb-3">
                                    {editQ ? "تعديل السؤال" : "سؤال جديد"}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الحرف</label>
                                        <input type="text" value={formQ.letter || ""} onChange={(e) => setFormQ(f => ({ ...f, letter: e.target.value.slice(0, 1) }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-white/40 text-sm focus:border-[var(--border-strong)] focus:outline-none" placeholder="أ" maxLength={1} />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الفئة</label>
                                        <input type="text" value={formQ.category || ""} onChange={(e) => setFormQ(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-white/40 text-sm focus:border-[var(--border-strong)] focus:outline-none" placeholder="عام" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">نص السؤال</label>
                                        <input type="text" value={formQ.question || ""} onChange={(e) => setFormQ(f => ({ ...f, question: e.target.value }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-white/40 text-sm focus:border-[var(--border-strong)] focus:outline-none" placeholder="نص السؤال" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">نص الإجابة</label>
                                        <input type="text" value={formQ.answer || ""} onChange={(e) => setFormQ(f => ({ ...f, answer: e.target.value }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-white/40 text-sm focus:border-[var(--border-strong)] focus:outline-none" placeholder="نص الإجابة" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الصعوبة</label>
                                        <Dropdown
                                            value={formQ.difficulty || "medium"}
                                            onChange={(value) => setFormQ(f => ({ ...f, difficulty: value }))}
                                            options={[
                                                { value: "easy", label: "سهل" },
                                                { value: "medium", label: "متوسط" },
                                                { value: "hard", label: "صعب" },
                                            ]}
                                            placeholder="اختر الصعوبة"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={saveQuestion} className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all text-sm font-medium">حفظ</button>
                                    <button onClick={() => { setShowQForm(false); setEditQ(null); setFormQ({}); }} className="px-4 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-white rounded-lg transition-all border border-[var(--border)] text-sm">إلغاء</button>
                                </div>
                            </div>
                        )}

                        {/* Questions Table */}
                        <div className="text-sm font-medium text-white/60 mb-1">
                            عرض {filteredQuestions.length} من {questions.length} سؤال
                        </div>
                        <div className="surface-card overflow-hidden">
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">حرف</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">السؤال</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الإجابة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الفئة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الصعوبة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredQuestions.map(q => (
                                            <tr key={q.id} className="hover:bg-[var(--surface)] transition-colors">
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 font-bold text-xs">{q.letter}</span>
                                                </td>
                                                <td className="px-3 py-2 text-white text-sm max-w-[200px] truncate">{q.question}</td>
                                                <td className="px-3 py-2 text-white/80 text-sm max-w-[150px] truncate">{q.answer}</td>
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">{q.category}</span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                                        q.difficulty === "easy" ? "bg-green-500/20 text-green-400" :
                                                        q.difficulty === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                                                        "bg-red-500/20 text-red-400"
                                                    }`}>
                                                        {q.difficulty === "easy" ? "سهل" : q.difficulty === "medium" ? "متوسط" : "صعب"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-1">
                                                        <button onClick={() => { setEditQ(q); setFormQ(q); setShowQForm(true); }} className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">تعديل</button>
                                                        <button onClick={() => deleteQuestion(q.id)} className="px-2 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">حذف</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {filteredQuestions.length === 0 && (
                            <div className="text-center py-6 text-white/40">لا توجد أسئلة</div>
                        )}
                    </div>
                )}

                {/* ───────── Sessions View ───────── */}
                {view === "sessions" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Sessions List */}
                        <div className="lg:col-span-1">
                            <div className="surface-card p-4 shadow-xl">
                                <h2 className="text-base font-semibold text-white mb-3">الجلسات النشطة ({sessions.length})</h2>
                                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                                    {sessions.length === 0 && <p className="text-center text-white/40 text-sm py-4">لا توجد جلسات نشطة</p>}
                                    {sessions.map(s => (
                                        <button
                                            key={s.id}
                                            className={`w-full p-3 text-right transition-all rounded-lg ${
                                                selectedSession === s.id
                                                    ? "bg-violet-500/20 border-2 border-violet-500/30"
                                                    : "hover:bg-[var(--surface)] border-2 border-transparent"
                                            }`}
                                            onClick={() => setSelectedSession(s.id)}
                                        >
                                            <div className="font-bold text-white text-sm font-mono">{s.id}</div>
                                            <div className="text-xs text-white/60 mt-1">
                                                {s.playerCount} لاعب • {s.phase} • 🟠{s.orangeScore} — 🟢{s.greenScore}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Session Details */}
                        <div className="lg:col-span-2">
                            {selectedSessionData ? (
                                <div className="surface-card p-4 shadow-xl space-y-4">
                                    <div className="flex flex-wrap justify-between items-start gap-2">
                                        <h3 className="font-bold text-base text-white">جلسة: <span className="font-mono">{selectedSessionData.id}</span></h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => resetSession(selectedSessionData.id)} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-all">🔄 إعادة تعيين</button>
                                            <button onClick={() => endSession(selectedSessionData.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all">🗑️ إنهاء</button>
                                        </div>
                                    </div>

                                    {/* Scores */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg text-center bg-orange-500/10 border border-orange-500/20">
                                            <div className="text-sm font-bold mb-1 text-orange-400">الفريق البرتقالي</div>
                                            <div className="text-2xl font-black text-orange-400">{selectedSessionData.orangeScore}</div>
                                        </div>
                                        <div className="p-3 rounded-lg text-center bg-green-500/10 border border-green-500/20">
                                            <div className="text-sm font-bold mb-1 text-green-400">الفريق الأخضر</div>
                                            <div className="text-2xl font-black text-green-400">{selectedSessionData.greenScore}</div>
                                        </div>
                                    </div>

                                    {/* Players */}
                                    <div>
                                        <h4 className="font-bold mb-2 text-white text-sm">اللاعبون ({selectedSessionData.playerCount})</h4>
                                        <div className="space-y-2">
                                            {selectedSessionData.players.map(p => (
                                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--surface)] transition-colors border border-[var(--border)]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-sm">{p.name}</span>
                                                        {p.id === selectedSessionData.hostPlayerId && (
                                                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-violet-500/20 text-violet-400">المضيف</span>
                                                        )}
                                                        <span className="text-xs text-white/60">
                                                            {p.role === "teamorange" ? "🟠" : p.role === "teamgreen" ? "🟢" : p.role === "gamemaster" ? "🎮" : "👀"}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => kickPlayer(selectedSessionData.id, p.id)}
                                                        className="px-2 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                    >
                                                        طرد
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="surface-card p-8 shadow-xl text-center">
                                    <p className="text-white/60">اختر جلسة لعرض التفاصيل</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ───────── Users View ───────── */}
                {view === "users" && (
                    <div className="space-y-4">
                        {/* Search */}
                        <div className="surface-card p-4 shadow-xl">
                            <input
                                type="text"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="🔍 بحث بالاسم أو البريد أو المعرف..."
                                className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white placeholder-white/40 text-sm focus:border-[var(--border-strong)] focus:outline-none"
                            />
                        </div>

                        {/* User Edit Form */}
                        {showUserForm && editingUser && (
                            <div className="surface-card p-4 shadow-xl">
                                <h3 className="text-base font-semibold text-white mb-3">تعديل المستخدم: {editingUser.username}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">اسم المستخدم</label>
                                        <input type="text" value={userForm.username || ""} onChange={(e) => setUserForm(f => ({ ...f, username: e.target.value }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-sm focus:border-[var(--border-strong)] focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الاسم داخل اللعبة</label>
                                        <input type="text" value={userForm.inGameName || ""} onChange={(e) => setUserForm(f => ({ ...f, inGameName: e.target.value }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-sm focus:border-[var(--border-strong)] focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">البريد الإلكتروني</label>
                                        <input type="text" value={userForm.email || ""} onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-sm focus:border-[var(--border-strong)] focus:outline-none" dir="ltr" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الدور</label>
                                        <Dropdown
                                            value={userForm.role || "User"}
                                            onChange={(value) => setUserForm(f => ({ ...f, role: value }))}
                                            options={[
                                                { value: "User", label: "مستخدم" },
                                                { value: "Admin", label: "مدير" },
                                            ]}
                                            placeholder="اختر الدور"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={userForm.isActive ?? true}
                                                onChange={(e) => setUserForm(f => ({ ...f, isActive: e.target.checked }))}
                                                className="w-4 h-4 rounded bg-[var(--surface-hover)] border-[var(--border-strong)] text-violet-600 focus:ring-violet-500"
                                            />
                                            <span className="text-sm text-white">نشط</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={saveUser} className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all text-sm font-medium">حفظ</button>
                                    <button onClick={() => { setShowUserForm(false); setEditingUser(null); setUserForm({}); }} className="px-4 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-white rounded-lg transition-all border border-[var(--border)] text-sm">إلغاء</button>
                                </div>
                            </div>
                        )}

                        {/* Password Reset Modal */}
                        {resetPwUser && (
                            <div className="bg-[#1a103c] rounded-xl border border-amber-500/30 p-4 shadow-xl">
                                <h3 className="text-base font-semibold text-amber-400 mb-3">إعادة تعيين كلمة المرور: {resetPwUser.username}</h3>
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">كلمة المرور الجديدة</label>
                                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-sm focus:border-[var(--border-strong)] focus:outline-none" dir="ltr" placeholder="6 أحرف على الأقل" />
                                    </div>
                                    <button onClick={resetPassword} disabled={newPassword.length < 6} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all">تغيير</button>
                                    <button onClick={() => { setResetPwUser(null); setNewPassword(""); }} className="px-4 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-white rounded-lg border border-[var(--border)] text-sm transition-all">إلغاء</button>
                                </div>
                            </div>
                        )}

                        {/* Users Table */}
                        <div className="text-sm font-medium text-white/60 mb-1">
                            {filteredUsers.length} مستخدم
                        </div>
                        <div className="surface-card overflow-hidden">
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الاسم</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">المستخدم</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">البريد</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الدور</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الألعاب</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الحالة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-[var(--surface)] transition-colors">
                                                <td className="px-3 py-2 text-white text-sm font-medium">{u.inGameName}</td>
                                                <td className="px-3 py-2 text-white/80 text-sm font-mono">{u.username}</td>
                                                <td className="px-3 py-2 text-white/60 text-sm" dir="ltr">{u.email}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                                        u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                                                    }`}>
                                                        {u.role === "admin" ? "مدير" : "مستخدم"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-white/60 text-sm">{u.gamesPlayed} / {u.gamesWon}W</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                                        u.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                    }`}>
                                                        {u.isActive ? "نشط" : "معطل"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => { setEditingUser(u); setUserForm(u); setShowUserForm(true); }}
                                                            className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                        >
                                                            تعديل
                                                        </button>
                                                        <button
                                                            onClick={() => { setResetPwUser(u); setNewPassword(""); }}
                                                            className="px-2 py-1 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                                                        >
                                                            كلمة المرور
                                                        </button>
                                                        {u.id !== "admin001" && (
                                                            <button
                                                                onClick={() => deleteUser(u.id)}
                                                                className="px-2 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                            >
                                                                حذف
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {filteredUsers.length === 0 && (
                            <div className="text-center py-6 text-white/40">لا يوجد مستخدمون</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
