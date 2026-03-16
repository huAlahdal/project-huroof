import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import ThemeToggle from "~/components/ThemeToggle";

const API_BASE = "http://localhost:5062";
const ADMIN_TOKEN = "Basic YWRtaW46YWRtaW4=";

interface AdminQuestion { id: string; letter: string; question: string; answer: string; category: string; difficulty: string; }
interface AdminPlayer { id: string; name: string; role: string; }
interface AdminSession {
    id: string;
    hostPlayerId: string | null;
    gridSize: number;
    totalRounds: number;
    currentRound: number;
    phase: string;
    playerCount: number;
    players: AdminPlayer[];
    orangeScore: number;
    greenScore: number;
    createdAt: string;
    version: number;
}
interface AdminOverview {
    questionCount: number;
    sessionCount: number;
    playerCount: number;
    sessionsByPhase: Record<string, number>;
    latestSessions: AdminSession[];
}
interface ServerStatus {
    machineName: string;
    processId: number;
    environment: string;
    startedAtUtc: string;
    osVersion: string;
    isRestartSupported: boolean;
    availableActions: string[];
}

const ROLE_OPTIONS = [
    { value: "spectator", label: "👀 مشاهد" },
    { value: "teamorange", label: "🟠 برتقالي" },
    { value: "teamgreen", label: "🟢 أخضر" },
    { value: "gamemaster", label: "🎮 مدير اللعبة" },
] as const;

const createQuestionDraft = (): Partial<AdminQuestion> => ({ letter: "", question: "", answer: "", category: "عام", difficulty: "medium" });

export default function AdminPage() {
    const navigate = useNavigate();
    const [isLogged, setIsLogged] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [tab, setTab] = useState<"overview" | "questions" | "sessions" | "system">("overview");
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
    const [questions, setQuestions] = useState<AdminQuestion[]>([]);
    const [sessions, setSessions] = useState<AdminSession[]>([]);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [loadingQs, setLoadingQs] = useState(false);
    const [loadingSs, setLoadingSs] = useState(false);
    const [loadingSystem, setLoadingSystem] = useState(false);
    const [qSearch, setQSearch] = useState("");
    const [editingQ, setEditingQ] = useState<AdminQuestion | null>(null);
    const [editForm, setEditForm] = useState<Partial<AdminQuestion>>(createQuestionDraft());
    const [bulkMode, setBulkMode] = useState<"append" | "replace">("append");
    const [bulkText, setBulkText] = useState("");
    const [showBulk, setShowBulk] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [playerNameDrafts, setPlayerNameDrafts] = useState<Record<string, string>>({});
    const [sessionSettingsDraft, setSessionSettingsDraft] = useState<Record<string, { gridSize: number; totalRounds: number }>>({});

    const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
        const response = await fetch(`${API_BASE}${path}`, {
            ...init,
            headers: {
                Authorization: ADMIN_TOKEN,
                ...(init?.body ? { "Content-Type": "application/json" } : {}),
                ...(init?.headers || {}),
            },
        });
        if (!response.ok) {
            let message = "فشل تنفيذ الطلب";
            try {
                const data = await response.json();
                message = data.error || message;
            } catch {
            }
            throw new Error(message);
        }
        if (response.status === 204) return null;
        return response.json();
    }, []);

    const fetchOverview = useCallback(async () => {
        setLoadingOverview(true);
        try {
            setOverview(await apiFetch("/api/admin/overview"));
        } catch (e: any) {
            setError(e.message || "فشل تحميل الملخص");
        }
        setLoadingOverview(false);
    }, [apiFetch]);

    const fetchQuestions = useCallback(async () => {
        setLoadingQs(true);
        try {
            setQuestions(await apiFetch("/api/admin/questions"));
        } catch (e: any) {
            setError(e.message || "فشل تحميل الأسئلة");
        }
        setLoadingQs(false);
    }, [apiFetch]);

    const fetchSessions = useCallback(async () => {
        setLoadingSs(true);
        try {
            const data = await apiFetch("/api/admin/sessions") as AdminSession[];
            setSessions(data);
            setSessionSettingsDraft((current) => {
                const next = { ...current };
                for (const session of data) {
                    next[session.id] = next[session.id] || { gridSize: session.gridSize, totalRounds: session.totalRounds };
                }
                return next;
            });
            setPlayerNameDrafts((current) => {
                const next = { ...current };
                for (const session of data) {
                    for (const player of session.players) {
                        next[player.id] = next[player.id] ?? player.name;
                    }
                }
                return next;
            });
        } catch (e: any) {
            setError(e.message || "فشل تحميل الجلسات");
        }
        setLoadingSs(false);
    }, [apiFetch]);

    const fetchSystem = useCallback(async () => {
        setLoadingSystem(true);
        try {
            setServerStatus(await apiFetch("/api/admin/server"));
        } catch (e: any) {
            setError(e.message || "فشل تحميل حالة الخادم");
        }
        setLoadingSystem(false);
    }, [apiFetch]);

    const refreshAll = useCallback(async () => {
        await Promise.all([fetchOverview(), fetchQuestions(), fetchSessions(), fetchSystem()]);
    }, [fetchOverview, fetchQuestions, fetchSessions, fetchSystem]);

    useEffect(() => {
        const logged = sessionStorage.getItem("huroof_admin") === "true";
        if (logged) {
            setIsLogged(true);
            void refreshAll();
        }
    }, [refreshAll]);

    const handleLogin = useCallback(() => {
        if (username === "admin" && password === "admin") {
            sessionStorage.setItem("huroof_admin", "true");
            setIsLogged(true);
            setError("");
            void refreshAll();
            return;
        }
        setError("بيانات الدخول غير صحيحة");
    }, [password, refreshAll, username]);

    const handleLogout = useCallback(() => {
        sessionStorage.removeItem("huroof_admin");
        setIsLogged(false);
        setOverview(null);
        setServerStatus(null);
        setQuestions([]);
        setSessions([]);
    }, []);

    const filteredQs = useMemo(() => {
        if (!qSearch.trim()) return questions;
        const lower = qSearch.toLowerCase();
        return questions.filter((q) =>
            q.question.toLowerCase().includes(lower)
            || q.answer.toLowerCase().includes(lower)
            || q.letter.toLowerCase().includes(lower)
            || q.category.toLowerCase().includes(lower)
        );
    }, [qSearch, questions]);

    const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedSessionId) ?? null, [selectedSessionId, sessions]);

    const saveQuestion = useCallback(async () => {
        if (!editForm.letter || !editForm.question || !editForm.answer) return;
        try {
            const isNew = !editingQ;
            const url = `/api/admin/questions${isNew ? "" : `/${editingQ.id}`}`;
            await apiFetch(url, { method: isNew ? "POST" : "PUT", body: JSON.stringify(editForm) });
            setNotice(isNew ? "تمت إضافة السؤال" : "تم تحديث السؤال");
            setEditingQ(null);
            setEditForm(createQuestionDraft());
            await Promise.all([fetchQuestions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل حفظ السؤال");
        }
    }, [apiFetch, editForm, editingQ, fetchOverview, fetchQuestions]);

    const deleteQuestion = useCallback(async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا السؤال؟")) return;
        try {
            await apiFetch(`/api/admin/questions/${id}`, { method: "DELETE" });
            setNotice("تم حذف السؤال");
            await Promise.all([fetchQuestions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل حذف السؤال");
        }
    }, [apiFetch, fetchOverview, fetchQuestions]);

    const handleBulkImport = useCallback(async () => {
        const trimmed = bulkText.trim();
        if (!trimmed) return;
        let payload: Partial<AdminQuestion>[] = [];
        try {
            if (trimmed.startsWith("[")) {
                payload = JSON.parse(trimmed);
            } else {
                payload = trimmed.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
                    const parts = line.split("|").map((part) => part.trim());
                    return {
                        question: parts[0],
                        answer: parts[1],
                        letter: (parts[2] || parts[1]?.charAt(0) || "").replace(/أ|إ|آ/g, "ا"),
                        category: parts[3] || "عام",
                        difficulty: parts[4] || "medium",
                    };
                });
            }
            const path = bulkMode === "replace" ? "/api/admin/questions/import" : "/api/admin/questions/bulk";
            await apiFetch(path, { method: "POST", body: JSON.stringify(payload) });
            setNotice(bulkMode === "replace" ? "تم استبدال قاعدة الأسئلة" : "تم استيراد الأسئلة" );
            setBulkText("");
            setShowBulk(false);
            await Promise.all([fetchQuestions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل الاستيراد");
        }
    }, [apiFetch, bulkMode, bulkText, fetchOverview, fetchQuestions]);

    const updateSessionSettings = useCallback(async (sessionId: string) => {
        try {
            const draft = sessionSettingsDraft[sessionId];
            await apiFetch(`/api/admin/sessions/${sessionId}/settings`, { method: "PUT", body: JSON.stringify(draft) });
            setNotice(`تم تحديث إعدادات الجلسة ${sessionId}`);
            await Promise.all([fetchSessions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل تحديث الإعدادات");
        }
    }, [apiFetch, fetchOverview, fetchSessions, sessionSettingsDraft]);

    const startSession = useCallback(async (sessionId: string) => {
        try {
            const draft = sessionSettingsDraft[sessionId];
            await apiFetch(`/api/admin/sessions/${sessionId}/start`, { method: "POST", body: JSON.stringify(draft) });
            setNotice(`تم تشغيل الجلسة ${sessionId}`);
            await Promise.all([fetchSessions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل تشغيل الجلسة");
        }
    }, [apiFetch, fetchOverview, fetchSessions, sessionSettingsDraft]);

    const resetSession = useCallback(async (sessionId: string) => {
        try {
            await apiFetch(`/api/admin/sessions/${sessionId}/reset`, { method: "POST" });
            setNotice(`تمت إعادة الجلسة ${sessionId} إلى اللوبي`);
            await Promise.all([fetchSessions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل إعادة تعيين الجلسة");
        }
    }, [apiFetch, fetchOverview, fetchSessions]);

    const endSession = useCallback(async (sessionId: string) => {
        if (!confirm("هل تريد إنهاء هذه الجلسة نهائياً؟")) return;
        try {
            await apiFetch(`/api/admin/sessions/${sessionId}`, { method: "DELETE" });
            setNotice(`تم إنهاء الجلسة ${sessionId}`);
            if (selectedSessionId === sessionId) setSelectedSessionId(null);
            await Promise.all([fetchSessions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل إنهاء الجلسة");
        }
    }, [apiFetch, fetchOverview, fetchSessions, selectedSessionId]);

    const savePlayer = useCallback(async (sessionId: string, playerId: string, role?: string) => {
        try {
            await apiFetch(`/api/admin/sessions/${sessionId}/players/${playerId}`, {
                method: "PUT",
                body: JSON.stringify({ name: playerNameDrafts[playerId], role }),
            });
            setNotice("تم تحديث بيانات اللاعب");
            await fetchSessions();
        } catch (e: any) {
            setError(e.message || "فشل تحديث اللاعب");
        }
    }, [apiFetch, fetchSessions, playerNameDrafts]);

    const removePlayer = useCallback(async (sessionId: string, playerId: string) => {
        if (!confirm("هل تريد إزالة هذا اللاعب من الجلسة؟")) return;
        try {
            await apiFetch(`/api/admin/sessions/${sessionId}/players/${playerId}`, { method: "DELETE" });
            setNotice("تمت إزالة اللاعب");
            await Promise.all([fetchSessions(), fetchOverview()]);
        } catch (e: any) {
            setError(e.message || "فشل إزالة اللاعب");
        }
    }, [apiFetch, fetchOverview, fetchSessions]);

    const shutdownServer = useCallback(async () => {
        if (!confirm("سيتم إيقاف الخادم الحالي. هل تريد المتابعة؟")) return;
        try {
            await apiFetch("/api/admin/server/shutdown", { method: "POST" });
            setNotice("تم إرسال طلب إيقاف الخادم");
        } catch (e: any) {
            setError(e.message || "فشل إيقاف الخادم");
        }
    }, [apiFetch]);

    if (!isLogged) {
        return (
            <div className="game-bg min-h-screen flex items-center justify-center p-4">
                <div className="fixed top-4 left-4"><ThemeToggle /></div>
                <div className="glass-card w-full max-w-sm p-8 text-center fade-in-scale">
                    <div className="text-5xl mb-4">🛡️</div>
                    <h2 className="text-2xl font-black mb-2" style={{ color: "var(--text-1)" }}>مركز الإدارة</h2>
                    <p className="text-sm mb-6" style={{ color: "var(--text-3)" }}>تحكم شامل بالأسئلة والجلسات والخادم</p>
                    <div className="space-y-4 mb-6">
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" className="input-field text-center" style={{ direction: "ltr" }} />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" className="input-field text-center" style={{ direction: "ltr" }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                    </div>
                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                    <button className="btn-primary w-full py-3" onClick={handleLogin}>تسجيل الدخول</button>
                    <button className="w-full mt-4 text-sm font-semibold" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => navigate("/")}>← العودة للرئيسية</button>
                </div>
            </div>
        );
    }

    return (
        <div className="game-bg min-h-screen flex flex-col">
            <header className="flex items-center justify-between px-4 sm:px-6 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-black text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>🛡️</div>
                    <div>
                        <p className="font-black text-lg" style={{ color: "var(--text-1)" }}>مركز إدارة حروف</p>
                        <p className="text-xs font-bold" style={{ color: "var(--accent)" }}>أسئلة - جلسات - خادم</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <ThemeToggle />
                    <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void refreshAll()}>🔄 تحديث الكل</button>
                    <button className="btn-ghost px-4 py-2 text-sm" onClick={() => navigate("/")}>🏠 الرئيسية</button>
                    <button className="btn-ghost px-4 py-2 text-sm text-red-400" onClick={handleLogout}>تسجيل خروج</button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {(error || notice) && (
                        <div className="grid gap-3">
                            {error && <div className="glass-card p-4 text-sm font-bold text-red-400">{error}</div>}
                            {notice && <div className="glass-card p-4 text-sm font-bold" style={{ color: "#4ade80" }}>{notice}</div>}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-card p-5">
                            <p className="text-sm font-bold mb-1" style={{ color: "var(--text-3)" }}>إجمالي الأسئلة</p>
                            <p className="text-4xl font-black" style={{ color: "var(--accent)" }}>{overview?.questionCount ?? questions.length}</p>
                        </div>
                        <div className="glass-card p-5">
                            <p className="text-sm font-bold mb-1" style={{ color: "var(--text-3)" }}>الجلسات النشطة</p>
                            <p className="text-4xl font-black" style={{ color: "#22c55e" }}>{overview?.sessionCount ?? sessions.length}</p>
                        </div>
                        <div className="glass-card p-5">
                            <p className="text-sm font-bold mb-1" style={{ color: "var(--text-3)" }}>إجمالي اللاعبين</p>
                            <p className="text-4xl font-black" style={{ color: "#f97316" }}>{overview?.playerCount ?? sessions.reduce((sum, session) => sum + session.playerCount, 0)}</p>
                        </div>
                    </div>

                    <div className="flex gap-2 p-1 rounded-xl flex-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)", width: "fit-content" }}>
                        {[
                            ["overview", "📊 الملخص"],
                            ["questions", "📚 الأسئلة"],
                            ["sessions", "🌐 الجلسات"],
                            ["system", "🖥 النظام"],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                className="px-5 py-2 rounded-lg font-bold text-sm transition-all"
                                style={{ background: tab === value ? "var(--accent)" : "transparent", color: tab === value ? "#fff" : "var(--text-2)", border: "none", cursor: "pointer" }}
                                onClick={() => setTab(value as typeof tab)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === "overview" && (
                        <div className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
                            <div className="glass-card p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-lg" style={{ color: "var(--text-1)" }}>آخر الجلسات</h3>
                                    <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void fetchOverview()}>{loadingOverview ? "⏳" : "تحديث"}</button>
                                </div>
                                <div className="space-y-3">
                                    {(overview?.latestSessions ?? sessions).map((session) => (
                                        <button
                                            key={session.id}
                                            className="w-full glass-card p-4 text-right"
                                            style={{ border: selectedSessionId === session.id ? "1px solid var(--accent)" : "1px solid var(--border)", background: "var(--surface-hover)" }}
                                            onClick={() => { setTab("sessions"); setSelectedSessionId(session.id); }}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-black" style={{ color: "var(--accent)" }}>{session.id}</p>
                                                    <p className="text-xs" style={{ color: "var(--text-3)" }}>{session.playerCount} لاعبين - {session.phase}</p>
                                                </div>
                                                <div className="text-left text-sm" dir="ltr">
                                                    <span style={{ color: "#f97316" }}>{session.orangeScore}</span>
                                                    <span style={{ color: "var(--text-3)" }}> / </span>
                                                    <span style={{ color: "#22c55e" }}>{session.greenScore}</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="glass-card p-5 space-y-4">
                                <h3 className="font-black text-lg" style={{ color: "var(--text-1)" }}>توزيع الحالات</h3>
                                <div className="grid gap-3">
                                    {Object.entries(overview?.sessionsByPhase ?? {}).map(([phase, count]) => (
                                        <div key={phase} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                                            <span className="font-bold" style={{ color: "var(--text-2)" }}>{phase}</span>
                                            <span className="text-xl font-black" style={{ color: "var(--accent)" }}>{count}</span>
                                        </div>
                                    ))}
                                    {Object.keys(overview?.sessionsByPhase ?? {}).length === 0 && <p style={{ color: "var(--text-3)" }}>لا توجد بيانات حالياً</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "questions" && (
                        <div className="glass-card p-5 space-y-5">
                            <div className="flex flex-wrap gap-3 justify-between items-center">
                                <input type="text" value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="بحث في الأسئلة أو الإجابات أو التصنيفات" className="input-field text-sm max-w-md" />
                                <div className="flex flex-wrap gap-2">
                                    <a href={`${API_BASE}/api/admin/questions/export?token=YWRtaW46YWRtaW4=`} target="_blank" className="btn-ghost px-4 py-2 text-sm" style={{ textDecoration: "none" }}>📥 تصدير JSON</a>
                                    <button className="btn-ghost px-4 py-2 text-sm" onClick={() => setShowBulk((value) => !value)}>📦 استيراد</button>
                                    <button className="btn-primary px-4 py-2 text-sm" onClick={() => { setEditingQ(null); setEditForm({ letter: "", question: "", answer: "", category: "عام", difficulty: "medium" }); }}>➕ إضافة سؤال</button>
                                </div>
                            </div>

                            <div className="grid lg:grid-cols-[0.95fr,1.05fr] gap-5">
                                <div className="space-y-4">
                                    {(editForm.letter !== undefined || editingQ) && (
                                        <div className="glass-card p-4" style={{ border: "1px solid var(--border)" }}>
                                            <h4 className="font-black mb-4" style={{ color: "var(--text-1)" }}>{editingQ ? "تعديل السؤال" : "إضافة سؤال جديد"}</h4>
                                            <div className="grid gap-3">
                                                <input type="text" placeholder="الحرف" value={editForm.letter || ""} onChange={(e) => setEditForm((form) => ({ ...form, letter: e.target.value.slice(0, 1) }))} className="input-field text-sm" maxLength={1} />
                                                <textarea placeholder="السؤال" value={editForm.question || ""} onChange={(e) => setEditForm((form) => ({ ...form, question: e.target.value }))} className="input-field text-sm min-h-28" />
                                                <input type="text" placeholder="الإجابة" value={editForm.answer || ""} onChange={(e) => setEditForm((form) => ({ ...form, answer: e.target.value }))} className="input-field text-sm" />
                                                <input type="text" placeholder="التصنيف" value={editForm.category || ""} onChange={(e) => setEditForm((form) => ({ ...form, category: e.target.value }))} className="input-field text-sm" />
                                                <select value={editForm.difficulty || "medium"} onChange={(e) => setEditForm((form) => ({ ...form, difficulty: e.target.value }))} className="input-field text-sm">
                                                    <option value="easy">سهل</option>
                                                    <option value="medium">متوسط</option>
                                                    <option value="hard">صعب</option>
                                                </select>
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button className="btn-primary px-5 py-2 text-sm" onClick={() => void saveQuestion()} disabled={!editForm.letter || !editForm.question || !editForm.answer}>💾 حفظ</button>
                                                <button className="btn-ghost px-5 py-2 text-sm" onClick={() => { setEditingQ(null); setEditForm({}); }}>إلغاء</button>
                                            </div>
                                        </div>
                                    )}

                                    {showBulk && (
                                        <div className="glass-card p-4" style={{ border: "1px solid var(--border)" }}>
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <h4 className="font-black" style={{ color: "var(--text-1)" }}>الاستيراد الجماعي</h4>
                                                <select className="input-field text-sm max-w-40" value={bulkMode} onChange={(e) => setBulkMode(e.target.value as "append" | "replace")}>
                                                    <option value="append">إضافة</option>
                                                    <option value="replace">استبدال كامل</option>
                                                </select>
                                            </div>
                                            <p className="text-xs mb-3" style={{ color: "var(--text-3)" }}>يمكنك لصق JSON أو سطور بالنمط: السؤال | الجواب | الحرف | التصنيف | الصعوبة</p>
                                            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} className="input-field w-full min-h-48 text-sm" dir="auto" />
                                            <div className="flex gap-2 mt-3">
                                                <button className="btn-primary px-5 py-2 text-sm" onClick={() => void handleBulkImport()} disabled={!bulkText.trim()}>تنفيذ</button>
                                                <button className="btn-ghost px-5 py-2 text-sm" onClick={() => { setShowBulk(false); setBulkText(""); }}>إلغاء</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.12)" }}>
                                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                                        <h4 className="font-black" style={{ color: "var(--text-1)" }}>كل الأسئلة</h4>
                                        <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void fetchQuestions()}>{loadingQs ? "⏳" : "تحديث"}</button>
                                    </div>
                                    <div className="max-h-[70vh] overflow-auto">
                                        <table className="w-full text-right text-sm" style={{ borderCollapse: "collapse" }}>
                                            <thead style={{ position: "sticky", top: 0, background: "var(--bg-2)", zIndex: 5 }}>
                                                <tr style={{ color: "var(--text-2)", borderBottom: "1px solid var(--border)" }}>
                                                    <th className="py-3 px-3">ح</th>
                                                    <th className="py-3 px-3">السؤال</th>
                                                    <th className="py-3 px-3">الإجابة</th>
                                                    <th className="py-3 px-3">تصنيف</th>
                                                    <th className="py-3 px-3">مستوى</th>
                                                    <th className="py-3 px-3">إدارة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredQs.map((q) => (
                                                    <tr key={q.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                                        <td className="py-3 px-3 font-black" style={{ color: "var(--accent)" }}>{q.letter}</td>
                                                        <td className="py-3 px-3 font-bold" style={{ color: "var(--text-1)" }}>{q.question}</td>
                                                        <td className="py-3 px-3" style={{ color: "var(--text-2)" }}>{q.answer}</td>
                                                        <td className="py-3 px-3" style={{ color: "var(--text-3)" }}>{q.category}</td>
                                                        <td className="py-3 px-3"><span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: q.difficulty === "easy" ? "rgba(34,197,94,0.15)" : q.difficulty === "hard" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", color: q.difficulty === "easy" ? "#22c55e" : q.difficulty === "hard" ? "#ef4444" : "#f59e0b" }}>{q.difficulty}</span></td>
                                                        <td className="py-3 px-3">
                                                            <div className="flex gap-2 justify-center">
                                                                <button className="btn-ghost px-3 py-1 text-xs" onClick={() => { setEditingQ(q); setEditForm(q); setShowBulk(false); }}>✏️ تعديل</button>
                                                                <button className="btn-ghost px-3 py-1 text-xs text-red-400" onClick={() => void deleteQuestion(q.id)}>🗑 حذف</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredQs.length === 0 && <tr><td colSpan={6} className="text-center py-10" style={{ color: "var(--text-3)" }}>لا توجد نتائج</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "sessions" && (
                        <div className="grid lg:grid-cols-[0.9fr,1.1fr] gap-6">
                            <div className="glass-card p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-lg" style={{ color: "var(--text-1)" }}>الجلسات</h3>
                                    <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void fetchSessions()}>{loadingSs ? "⏳" : "تحديث"}</button>
                                </div>
                                <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
                                    {sessions.map((session) => (
                                        <button
                                            key={session.id}
                                            className="w-full text-right rounded-2xl px-4 py-4 transition-all"
                                            style={{ background: selectedSessionId === session.id ? "rgba(124,58,237,0.18)" : "var(--surface-hover)", border: selectedSessionId === session.id ? "1px solid rgba(168,85,247,0.55)" : "1px solid var(--border)" }}
                                            onClick={() => setSelectedSessionId(session.id)}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-black" style={{ color: "var(--accent)" }}>{session.id}</p>
                                                    <p className="text-xs" style={{ color: "var(--text-3)" }}>{session.phase} - {session.playerCount} لاعبين</p>
                                                </div>
                                                <div className="text-left text-xs" dir="ltr" style={{ color: "var(--text-3)" }}>v{session.version}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {sessions.length === 0 && <p style={{ color: "var(--text-3)" }}>لا توجد جلسات نشطة</p>}
                                </div>
                            </div>

                            <div className="glass-card p-5 space-y-5">
                                {!selectedSession ? (
                                    <div className="text-center py-20">
                                        <div className="text-5xl mb-4">🎮</div>
                                        <p style={{ color: "var(--text-3)" }}>اختر جلسة لعرض كل عناصر التحكم</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div>
                                                <h3 className="font-black text-xl" style={{ color: "var(--accent)" }}>{selectedSession.id}</h3>
                                                <p className="text-sm" style={{ color: "var(--text-3)" }}>{selectedSession.phase} - الجولة {selectedSession.currentRound} من {selectedSession.totalRounds}</p>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void startSession(selectedSession.id)}>▶️ بدء</button>
                                                <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void resetSession(selectedSession.id)}>↩️ للوبي</button>
                                                <button className="btn-ghost px-4 py-2 text-sm text-red-400" onClick={() => void endSession(selectedSession.id)}>⛔ إنهاء</button>
                                            </div>
                                        </div>

                                        <div className="grid sm:grid-cols-4 gap-3">
                                            <div className="glass-card p-4 text-center"><p className="text-xs" style={{ color: "var(--text-3)" }}>البرتقالي</p><p className="text-3xl font-black" style={{ color: "#f97316" }}>{selectedSession.orangeScore}</p></div>
                                            <div className="glass-card p-4 text-center"><p className="text-xs" style={{ color: "var(--text-3)" }}>الأخضر</p><p className="text-3xl font-black" style={{ color: "#22c55e" }}>{selectedSession.greenScore}</p></div>
                                            <div className="glass-card p-4 text-center"><p className="text-xs" style={{ color: "var(--text-3)" }}>اللاعبون</p><p className="text-3xl font-black" style={{ color: "var(--accent)" }}>{selectedSession.playerCount}</p></div>
                                            <div className="glass-card p-4 text-center"><p className="text-xs" style={{ color: "var(--text-3)" }}>المنشئ</p><p className="text-sm font-black" style={{ color: "var(--text-1)" }}>{selectedSession.players.find((p) => p.id === selectedSession.hostPlayerId)?.name || "-"}</p></div>
                                        </div>

                                        <div className="glass-card p-4" style={{ border: "1px solid var(--border)" }}>
                                            <h4 className="font-black mb-3" style={{ color: "var(--text-1)" }}>إعدادات الجلسة</h4>
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <label className="text-sm font-bold" style={{ color: "var(--text-2)" }}>
                                                    حجم الشبكة
                                                    <select className="input-field mt-1" value={sessionSettingsDraft[selectedSession.id]?.gridSize ?? selectedSession.gridSize} onChange={(e) => setSessionSettingsDraft((current) => ({ ...current, [selectedSession.id]: { gridSize: Number(e.target.value), totalRounds: current[selectedSession.id]?.totalRounds ?? selectedSession.totalRounds } }))}>
                                                        {[4, 5, 6].map((value) => <option key={value} value={value}>{value}×{value}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-sm font-bold" style={{ color: "var(--text-2)" }}>
                                                    عدد الجولات
                                                    <select className="input-field mt-1" value={sessionSettingsDraft[selectedSession.id]?.totalRounds ?? selectedSession.totalRounds} onChange={(e) => setSessionSettingsDraft((current) => ({ ...current, [selectedSession.id]: { gridSize: current[selectedSession.id]?.gridSize ?? selectedSession.gridSize, totalRounds: Number(e.target.value) } }))}>
                                                        {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                            <button className="btn-primary mt-4 px-5 py-2 text-sm" onClick={() => void updateSessionSettings(selectedSession.id)}>حفظ الإعدادات</button>
                                        </div>

                                        <div className="glass-card p-4" style={{ border: "1px solid var(--border)" }}>
                                            <h4 className="font-black mb-4" style={{ color: "var(--text-1)" }}>إدارة اللاعبين</h4>
                                            <div className="space-y-3">
                                                {selectedSession.players.map((player) => (
                                                    <div key={player.id} className="rounded-2xl p-4" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                                                        <div className="grid lg:grid-cols-[1fr,220px,auto] gap-3 items-center">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-black" style={{ color: selectedSession.hostPlayerId === player.id ? "#facc15" : "var(--text-1)" }}>{player.name}</span>
                                                                    {selectedSession.hostPlayerId === player.id && <span className="text-xs font-bold" style={{ color: "#facc15" }}>👑 صاحب الجلسة</span>}
                                                                </div>
                                                                <input className="input-field text-sm" value={playerNameDrafts[player.id] ?? player.name} onChange={(e) => setPlayerNameDrafts((current) => ({ ...current, [player.id]: e.target.value }))} />
                                                            </div>
                                                            <select className="input-field text-sm" value={player.role} onChange={(e) => void savePlayer(selectedSession.id, player.id, e.target.value)}>
                                                                {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                                                            </select>
                                                            <div className="flex gap-2 justify-end">
                                                                <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void savePlayer(selectedSession.id, player.id, player.role)}>💾 حفظ</button>
                                                                <button className="btn-ghost px-4 py-2 text-sm text-red-400" onClick={() => void removePlayer(selectedSession.id, player.id)}>🚫 إزالة</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === "system" && (
                        <div className="grid lg:grid-cols-[0.8fr,1.2fr] gap-6">
                            <div className="glass-card p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-lg" style={{ color: "var(--text-1)" }}>الخادم</h3>
                                    <button className="btn-ghost px-4 py-2 text-sm" onClick={() => void fetchSystem()}>{loadingSystem ? "⏳" : "تحديث"}</button>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="rounded-xl p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}><strong style={{ color: "var(--text-1)" }}>البيئة:</strong> <span style={{ color: "var(--text-3)" }}>{serverStatus?.environment || "-"}</span></div>
                                    <div className="rounded-xl p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}><strong style={{ color: "var(--text-1)" }}>الجهاز:</strong> <span style={{ color: "var(--text-3)" }}>{serverStatus?.machineName || "-"}</span></div>
                                    <div className="rounded-xl p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}><strong style={{ color: "var(--text-1)" }}>PID:</strong> <span style={{ color: "var(--text-3)" }}>{serverStatus?.processId || "-"}</span></div>
                                    <div className="rounded-xl p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}><strong style={{ color: "var(--text-1)" }}>نظام التشغيل:</strong> <span style={{ color: "var(--text-3)" }}>{serverStatus?.osVersion || "-"}</span></div>
                                    <div className="rounded-xl p-3" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}><strong style={{ color: "var(--text-1)" }}>إعادة التشغيل:</strong> <span style={{ color: "var(--text-3)" }}>{serverStatus?.isRestartSupported ? "مدعومة" : "غير مدعومة من داخل التطبيق"}</span></div>
                                </div>
                            </div>
                            <div className="glass-card p-5 space-y-4">
                                <h3 className="font-black text-lg" style={{ color: "var(--text-1)" }}>إجراءات النظام</h3>
                                <div className="rounded-2xl p-4" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)" }}>
                                    <p className="font-black mb-2" style={{ color: "#fca5a5" }}>إيقاف الخادم</p>
                                    <p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>سيتم إيقاف عملية الخادم الحالية. إعادة التشغيل تحتاج مدير عمليات خارجي أو خدمة استضافة.</p>
                                    <button className="btn-ghost px-5 py-2 text-sm text-red-400" onClick={() => void shutdownServer()}>⛔ إيقاف الخادم</button>
                                </div>
                                <div className="rounded-2xl p-4" style={{ background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
                                    <p className="font-black mb-2" style={{ color: "var(--text-1)" }}>ما الذي أضفته هنا</p>
                                    <ul className="space-y-2 text-sm" style={{ color: "var(--text-3)" }}>
                                        <li>- عرض شامل للجلسات واللاعبين.</li>
                                        <li>- تعديل أسماء وأدوار اللاعبين من لوحة الإدارة.</li>
                                        <li>- بدء الجلسات وإعادتها للوبي وإنهاؤها.</li>
                                        <li>- استيراد وإضافة واستبدال وتصدير الأسئلة.</li>
                                        <li>- تحكم مباشر بإعدادات الجلسة.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
