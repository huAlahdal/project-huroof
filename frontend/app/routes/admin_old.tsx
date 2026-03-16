import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import ThemeToggle from "~/components/ThemeToggle";

const API_BASE = "http://localhost:5062";
const ADMIN_TOKEN = "Basic YWRtaW46YWRtaW4=";

interface Question { id: string; letter: string; question: string; answer: string; category: string; difficulty: string; }
interface Player { id: string; name: string; role: string; }
interface Session {
    id: string;
    hostPlayerId: string | null;
    gridSize: number;
    totalRounds: number;
    currentRound: number;
    phase: string;
    playerCount: number;
    players: Player[];
    orangeScore: number;
    greenScore: number;
    createdAt: string;
    version: number;
}

export default function AdminPage() {
    const navigate = useNavigate();
    const [isLogged, setIsLogged] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    const [view, setView] = useState<"dashboard" | "questions" | "sessions">("dashboard");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [stats, setStats] = useState({ questionCount: 0, sessionCount: 0, playerCount: 0 });
    
    const [qSearch, setQSearch] = useState("");
    const [qFilter, setQFilter] = useState({ category: "all", difficulty: "all", letter: "all" });
    const [editQ, setEditQ] = useState<Question | null>(null);
    const [formQ, setFormQ] = useState<Partial<Question>>({});
    const [showQForm, setShowQForm] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [migrating, setMigrating] = useState(false);

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
            const data = await response.json().catch(() => ({ error: "Request failed" }));
            throw new Error(data.error || "Request failed");
        }
        if (response.status === 204) return null;
        return response.json();
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [qData, sData] = await Promise.all([
                apiFetch("/api/admin/db/questions"),
                apiFetch("/api/admin/sessions")
            ]);
            setQuestions(qData);
            setSessions(sData);
            setStats({
                questionCount: qData.length,
                sessionCount: sData.length,
                playerCount: sData.reduce((sum: number, s: Session) => sum + s.playerCount, 0)
            });
        } catch (e: any) {
            setError(e.message);
        }
        setLoading(false);
    }, [apiFetch]);

    useEffect(() => {
        const logged = sessionStorage.getItem("huroof_admin") === "true";
        if (logged) {
            setIsLogged(true);
            void loadData();
        }
    }, [loadData]);

    const handleLogin = useCallback(() => {
        if (username === "admin" && password === "admin") {
            sessionStorage.setItem("huroof_admin", "true");
            setIsLogged(true);
            setError("");
            void loadData();
        } else {
            setError("Invalid credentials");
        }
    }, [username, password, loadData]);

    const handleLogout = useCallback(() => {
        sessionStorage.removeItem("huroof_admin");
        setIsLogged(false);
        setQuestions([]);
        setSessions([]);
    }, []);

    const saveQuestion = useCallback(async () => {
        if (!formQ.letter || !formQ.question || !formQ.answer) return;
        try {
            const url = editQ ? `/api/admin/db/questions/${editQ.id}` : "/api/admin/db/questions";
            await apiFetch(url, { 
                method: editQ ? "PUT" : "POST", 
                body: JSON.stringify(formQ) 
            });
            setSuccess(editQ ? "Question updated" : "Question added");
            setShowQForm(false);
            setEditQ(null);
            setFormQ({});
            await loadData();
        } catch (e: any) {
            setError(e.message);
        }
    }, [formQ, editQ, apiFetch, loadData]);

    const deleteQuestion = useCallback(async (id: string) => {
        if (!confirm("Delete this question?")) return;
        try {
            await apiFetch(`/api/admin/db/questions/${id}`, { method: "DELETE" });
            setSuccess("Question deleted");
            await loadData();
        } catch (e: any) {
            setError(e.message);
        }
    }, [apiFetch, loadData]);

    const endSession = useCallback(async (id: string) => {
        if (!confirm("End this session?")) return;
        try {
            await apiFetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
            setSuccess("Session ended");
            setSelectedSession(null);
            await loadData();
        } catch (e: any) {
            setError(e.message);
        }
    }, [apiFetch, loadData]);

    const migrateQuestions = useCallback(async () => {
        if (!confirm("Migrate all questions from JSON to database? This will replace any existing questions in the database.")) return;
        setMigrating(true);
        try {
            const result = await apiFetch("/api/admin/db/questions/migrate", { method: "POST" });
            setSuccess(`Migrated ${result.migrated} questions to database`);
            await loadData();
        } catch (e: any) {
            setError(e.message);
        }
        setMigrating(false);
    }, [apiFetch, loadData]);

    const uploadJsonFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            setError("Please select a JSON file");
            return;
        }
        
        setUploading(true);
        try {
            const text = await file.text();
            const jsonQuestions = JSON.parse(text);
            
            if (!Array.isArray(jsonQuestions)) {
                throw new Error("Invalid JSON format. Expected an array of questions.");
            }
            
            // Transform to match expected format
            const formattedQuestions = jsonQuestions.map(q => ({
                letter: q.Letter || q.letter || "",
                question: q.QuestionText || q.Question || q.question || "",
                answer: q.Answer || q.answer || "",
                category: q.Category || q.category || "عام",
                difficulty: q.Difficulty || q.difficulty || "medium"
            }));
            
            const result = await apiFetch("/api/admin/db/questions/bulk-add", {
                method: "POST",
                body: JSON.stringify(formattedQuestions)
            });
            
            setSuccess(`Successfully added ${result.count} questions. Total: ${result.total} questions in database.`);
            await loadData();
            event.target.value = ""; // Clear file input
        } catch (e: any) {
            setError(e.message || "Failed to upload file");
        }
        setUploading(false);
    }, [apiFetch, loadData]);

    const clearAllQuestions = useCallback(async () => {
        if (!confirm("Are you sure you want to delete ALL questions from the database? This action cannot be undone!")) return;
        try {
            const result = await apiFetch("/api/admin/db/questions", { method: "DELETE" });
            setSuccess(`Deleted ${result.deleted} questions from database`);
            await loadData();
        } catch (e: any) {
            setError(e.message);
        }
    }, [apiFetch, loadData]);

    const filteredQuestions = questions.filter(q => {
        if (qFilter.category !== "all" && q.category !== qFilter.category) return false;
        if (qFilter.difficulty !== "all" && q.difficulty !== qFilter.difficulty) return false;
        if (qFilter.letter !== "all" && q.letter !== qFilter.letter) return false;
        if (qSearch && !q.question.toLowerCase().includes(qSearch.toLowerCase()) && 
            !q.answer.toLowerCase().includes(qSearch.toLowerCase())) return false;
        return true;
    });

    const categories = Array.from(new Set(questions.map(q => q.category)));
    const letters = Array.from(new Set(questions.map(q => q.letter))).sort();
    const selectedSessionData = sessions.find(s => s.id === selectedSession);

    if (!isLogged) {
        return (
            <div className="game-bg min-h-screen flex items-center justify-center p-4">
                <div className="glass-card p-8 w-full max-w-md">
                    <div className="flex justify-between items-start mb-6">
                        <h1 className="text-3xl font-black" style={{ color: "var(--text-1)" }}>
                            لوحة التحكم
                        </h1>
                        <ThemeToggle />
                    </div>
                    <p className="text-sm font-semibold mb-6" style={{ color: "var(--text-2)" }}>
                        تسجيل الدخول للوصول إلى إدارة الأسئلة والجلسات
                    </p>
                    {error && (
                        <div className="mb-4 p-3 rounded-lg font-semibold text-sm" 
                             style={{ 
                                 background: "rgba(239, 68, 68, 0.15)", 
                                 border: "1px solid rgba(239, 68, 68, 0.3)", 
                                 color: "#f87171" 
                             }}>
                            {error}
                        </div>
                    )}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: "var(--text-2)" }}>
                                اسم المستخدم
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-field"
                                placeholder="أدخل اسم المستخدم"
                                dir="ltr"
                                style={{ padding: "0.75rem 1rem" }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: "var(--text-2)" }}>
                                كلمة المرور
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="أدخل كلمة المرور"
                                dir="ltr"
                                style={{ padding: "0.75rem 1rem" }}
                            />
                        </div>
                        <button
                            onClick={handleLogin}
                            className="w-full py-3 rounded-xl font-black text-lg transition-all"
                            style={{
                                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                color: "white",
                                boxShadow: "0 0 20px rgba(168, 85, 247, 0.4)"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 4px 30px rgba(168, 85, 247, 0.6)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 20px rgba(168, 85, 247, 0.4)";
                            }}
                        >
                            دخول
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="game-bg min-h-screen">
            {/* Header */}
            <div className="glass-card m-4 p-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-black" style={{ color: "var(--text-1)" }}>
                            لوحة التحكم
                        </h1>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setView("dashboard")}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                    view === "dashboard" 
                                        ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white" 
                                        : "hover:bg-purple-600/10"
                                }`}
                                style={{
                                    color: view === "dashboard" ? "white" : "var(--text-2)"
                                }}
                            >
                                نظرة عامة
                            </button>
                            <button
                                onClick={() => setView("questions")}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                    view === "questions" 
                                        ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white" 
                                        : "hover:bg-purple-600/10"
                                }`}
                                style={{
                                    color: view === "questions" ? "white" : "var(--text-2)"
                                }}
                            >
                                الأسئلة ({stats.questionCount})
                            </button>
                            <button
                                onClick={() => setView("sessions")}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                    view === "sessions" 
                                        ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white" 
                                        : "hover:bg-purple-600/10"
                                }`}
                                style={{
                                    color: view === "sessions" ? "white" : "var(--text-2)"
                                }}
                            >
                                الجلسات ({stats.sessionCount})
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 rounded-lg font-bold text-sm transition-all hover:bg-red-600/10"
                        style={{ color: "var(--text-2)" }}
                    >
                        تسجيل الخروج
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="mb-4 p-4 rounded-lg font-semibold text-sm" 
                     style={{ 
                         background: "rgba(239, 68, 68, 0.15)", 
                         border: "1px solid rgba(239, 68, 68, 0.3)", 
                         color: "#f87171" 
                     }}>
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 rounded-lg font-semibold text-sm" 
                     style={{ 
                         background: "rgba(34, 197, 94, 0.15)", 
                         border: "1px solid rgba(34, 197, 94, 0.3)", 
                         color: "#4ade80" 
                     }}>
                    {success}
                </div>
            )}
            {loading && <div className="text-center py-8" style={{ color: "var(--text-2)" }}>جاري التحميل...</div>}

            {/* Content */}
            <div className="p-4">
                {view === "dashboard" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>إجمالي الأسئلة</p>
                                    <p className="text-3xl font-black mt-2" style={{ color: "var(--text-1)" }}>{stats.questionCount}</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                     style={{ 
                                         background: "linear-gradient(135deg, #7c3aed, #a855f7)", 
                                         boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)" 
                                     }}>
                                    ❓
                                </div>
                            </div>
                        </div>
                        <div className="glass-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>الجلسات النشطة</p>
                                    <p className="text-3xl font-black mt-2" style={{ color: "var(--text-1)" }}>{stats.sessionCount}</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                     style={{ 
                                         background: "linear-gradient(135deg, #0ea5e9, #38bdf8)", 
                                         boxShadow: "0 0 20px rgba(56, 189, 248, 0.3)" 
                                     }}>
                                    🎮
                                </div>
                            </div>
                        </div>
                        <div className="glass-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>اللاعبون النشطون</p>
                                    <p className="text-3xl font-black mt-2" style={{ color: "var(--text-1)" }}>{stats.playerCount}</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                     style={{ 
                                         background: "linear-gradient(135deg, #22c55e, #4ade80)", 
                                         boxShadow: "0 0 20px rgba(74, 222, 128, 0.3)" 
                                     }}>
                                    👥
                                </div>
                            </div>
                        </div>
                        
                        <div className="md:col-span-3 glass-card p-6">
                            <h2 className="text-xl font-black mb-4" style={{ color: "var(--text-1)" }}>الجلسات الأخيرة</h2>
                            <div className="space-y-2">
                                {sessions.slice(0, 5).map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-4 rounded-xl transition-all hover:bg-purple-600/5"
                                         style={{ border: "1px solid var(--border)" }}>
                                        <div>
                                            <span className="font-bold" style={{ color: "var(--text-1)" }}>{s.id}</span>
                                            <span className="text-sm font-semibold ml-3" style={{ color: "var(--text-3)" }}>
                                                {s.playerCount} لاعب • {s.phase} • جولة {s.currentRound}/{s.totalRounds}
                                            </span>
                                        </div>
                                        <button
                                            className="text-sm font-bold transition-all hover:bg-purple-600/20 px-3 py-1 rounded-lg"
                                            style={{ color: "var(--accent)" }}
                                            onClick={() => { setView("sessions"); setSelectedSession(s.id); }}
                                        >
                                            عرض &rarr;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {view === "questions" && (
                    <div className="glass-card p-6">
                        {/* Toolbar */}
                        <div className="pb-4 mb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                            <div className="flex flex-wrap gap-3 items-center justify-between">
                                <div className="flex gap-3 flex-1">
                                    <input
                                        type="text"
                                        value={qSearch}
                                        onChange={(e) => setQSearch(e.target.value)}
                                        placeholder="🔍 بحث..."
                                        className="input-field text-sm flex-1 min-w-[200px]"
                                        style={{ padding: "0.5rem 0.875rem" }}
                                    />
                                    <select
                                        value={qFilter.letter}
                                        onChange={(e) => setQFilter(f => ({ ...f, letter: e.target.value }))}
                                        className="input-field text-sm"
                                        style={{ padding: "0.5rem 0.875rem" }}
                                    >
                                        <option value="all">كل الحروف</option>
                                        {letters.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                    <select
                                        value={qFilter.category}
                                        onChange={(e) => setQFilter(f => ({ ...f, category: e.target.value }))}
                                        className="input-field text-sm"
                                        style={{ padding: "0.5rem 0.875rem" }}
                                    >
                                        <option value="all">كل الفئات</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        value={qFilter.difficulty}
                                        onChange={(e) => setQFilter(f => ({ ...f, difficulty: e.target.value }))}
                                        className="input-field text-sm"
                                        style={{ padding: "0.5rem 0.875rem" }}
                                    >
                                        <option value="all">كل الصعوبات</option>
                                        <option value="easy">سهل</option>
                                        <option value="medium">متوسط</option>
                                        <option value="hard">صعب</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <label className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                                          style={{
                                              background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
                                              color: "white",
                                              boxShadow: "0 0 15px rgba(56, 189, 248, 0.3)"
                                          }}>
                                        {uploading ? "جاري الرفع..." : "رفع JSON"}
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={uploadJsonFile}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                    </label>
                                    <button
                                        className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all"
                                        style={{
                                            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                            color: "white",
                                            boxShadow: "0 0 15px rgba(168, 85, 247, 0.3)"
                                        }}
                                        onClick={() => { setShowQForm(true); setEditQ(null); setFormQ({ category: "عام", difficulty: "medium" }); }}
                                    >
                                        إضافة سؤال
                                    </button>
                                    <button
                                        className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all"
                                        style={{
                                            background: "linear-gradient(135deg, #22c55e, #4ade80)",
                                            color: "white",
                                            boxShadow: "0 0 15px rgba(74, 222, 128, 0.3)"
                                        }}
                                        onClick={migrateQuestions}
                                        disabled={migrating}
                                    >
                                        {migrating ? "جاري النقل..." : "نقل من JSON"}
                                    </button>
                                    <button
                                        className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all"
                                        style={{
                                            background: "linear-gradient(135deg, #ef4444, #f87171)",
                                            color: "white",
                                            boxShadow: "0 0 15px rgba(239, 68, 68, 0.3)"
                                        }}
                                        onClick={clearAllQuestions}
                                    >
                                        مسح الكل
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Question Form */}
                        {showQForm && (
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    {editQ ? "Edit Question" : "New Question"}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Letter"
                                        value={formQ.letter || ""}
                                        onChange={(e) => setFormQ(f => ({ ...f, letter: e.target.value.slice(0, 1) }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        maxLength={1}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Category"
                                        value={formQ.category || ""}
                                        onChange={(e) => setFormQ(f => ({ ...f, category: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                    <textarea
                                        placeholder="Question text"
                                        value={formQ.question || ""}
                                        onChange={(e) => setFormQ(f => ({ ...f, question: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white md:col-span-2"
                                        rows={2}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Answer"
                                        value={formQ.answer || ""}
                                        onChange={(e) => setFormQ(f => ({ ...f, answer: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                    <select
                                        value={formQ.difficulty || "medium"}
                                        onChange={(e) => setFormQ(f => ({ ...f, difficulty: e.target.value }))}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors" onClick={saveQuestion}>
                                        Save
                                    </button>
                                    <button className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-sm" onClick={() => { setShowQForm(false); setEditQ(null); setFormQ({}); }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Questions Table */}
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 px-4">
                            Showing {filteredQuestions.length} of {questions.length} questions
                        </div>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Letter</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Question</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Answer</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Difficulty</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredQuestions.map(q => (
                                        <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold">
                                                    {q.letter}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{q.question}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{q.answer}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                                    {q.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                                    q.difficulty === "easy" 
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                                        : q.difficulty === "hard"
                                                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                                }`}>
                                                    {q.difficulty}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                                                        onClick={() => { setEditQ(q); setFormQ(q); setShowQForm(true); }}
                                                    >
                                                        تعديل
                                                    </button>
                                                    <button
                                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                        onClick={() => deleteQuestion(q.id)}
                                                    >
                                                        حذف
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredQuestions.length === 0 && (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    لا توجد أسئلة
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === "sessions" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Sessions List */}
                        <div className="lg:col-span-1 glass-card p-6">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Active Sessions</h3>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                                {sessions.map(s => (
                                    <button
                                        key={s.id}
                                        className={`w-full p-4 text-left transition-colors ${
                                            selectedSession === s.id 
                                                ? "bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-600" 
                                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                        }`}
                                        onClick={() => setSelectedSession(s.id)}
                                    >
                                        <div className="font-medium text-gray-900 dark:text-white">{s.id}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {s.playerCount} players • {s.phase}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Session Details */}
                        <div className="lg:col-span-2 glass-card p-6">
                            {selectedSessionData ? (
                                <div className="p-6">
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                                <div className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">Orange Team</div>
                                                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{selectedSessionData.orangeScore}</div>
                                            </div>
                                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                                <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Green Team</div>
                                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedSessionData.greenScore}</div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Players ({selectedSessionData.playerCount})</h4>
                                            <div className="space-y-2">
                                                {selectedSessionData.players.map(p => (
                                                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                                                            {p.id === selectedSessionData.hostPlayerId && (
                                                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                                                    Host
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={`text-sm font-medium ${
                                                            p.role === "teamorange" 
                                                                ? "text-orange-600 dark:text-orange-400"
                                                                : p.role === "teamgreen"
                                                                ? "text-green-600 dark:text-green-400"
                                                                : p.role === "gamemaster"
                                                                ? "text-purple-600 dark:text-purple-400"
                                                                : "text-gray-600 dark:text-gray-400"
                                                        }`}>
                                                            {p.role === "teamorange" ? "Orange" : p.role === "teamgreen" ? "Green" : p.role === "gamemaster" ? "GM" : "Spectator"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                        <p>Select a session to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
