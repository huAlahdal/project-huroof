import { useState, useEffect, useCallback } from "react";
import { invoke, on, startConnection } from "~/lib/signalr";
import ThemeToggle from "~/components/ThemeToggle";
import Dropdown from "~/components/Dropdown";

import { API_BASE } from "../lib/api";

const API_BASE_URL = API_BASE;
const ADMIN_TOKEN = "Basic YWRtaW46YWRtaW4=";

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
    players: { id: string; name: string; role: string }[];
}

interface Stats {
    questionCount: number;
    activeSessions: number;
    totalPlayers: number;
}

export default function AdminPage() {
    const [isLogged, setIsLogged] = useState(false);
    const [password, setPassword] = useState("");
    const [view, setView] = useState<"questions" | "sessions" | "stats">("questions");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [stats, setStats] = useState<Stats>({ questionCount: 0, activeSessions: 0, totalPlayers: 0 });
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

    const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers: {
                Authorization: ADMIN_TOKEN,
                ...(init?.body ? { "Content-Type": "application/json" } : {}),
                ...(init?.headers || {}),
            },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [qRes, sRes, stRes] = await Promise.all([
                apiFetch("/api/admin/db/questions"),
                apiFetch("/api/admin/sessions"),
                apiFetch("/api/admin/overview"),
            ]);
            setQuestions(qRes);
            setSessions(sRes);
            setStats({
                questionCount: stRes.questionCount,
                activeSessions: stRes.sessionCount,
                totalPlayers: stRes.playerCount,
            });
        } catch (e: any) {
            setError(e.message);
            setTimeout(() => setError(""), 5000);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        if (isLogged) loadData();
    }, [isLogged, loadData]);

    const handleLogin = async () => {
        try {
            const res = await apiFetch("/api/admin/auth", { method: "POST", body: JSON.stringify({ password }) });
            if (res.success) setIsLogged(true);
            else setError("كلمة المرور خاطئة");
        } catch (e: any) {
            setError(e.message);
        }
    };

    const logout = () => {
        setIsLogged(false);
        setPassword("");
    };

    const saveQuestion = async () => {
        if (!formQ.letter || !formQ.question || !formQ.answer) {
            setError("املأ جميع الحقول المطلوبة");
            return;
        }
        try {
            if (editQ) {
                await apiFetch(`/api/admin/db/questions/${editQ.id}`, {
                    method: "PUT",
                    body: JSON.stringify(formQ),
                });
                setSuccess("تم تحديث السؤال");
            } else {
                await apiFetch("/api/admin/db/questions", {
                    method: "POST",
                    body: JSON.stringify(formQ),
                });
                setSuccess("تم إضافة السؤال");
            }
            setShowQForm(false);
            setEditQ(null);
            setFormQ({});
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e: any) {
            setError(e.message);
            setTimeout(() => setError(""), 3000);
        }
    };

    const deleteQuestion = async (id: string) => {
        if (!confirm("حذف هذا السؤال؟")) return;
        try {
            await apiFetch(`/api/admin/db/questions/${id}`, { method: "DELETE" });
            setSuccess("تم حذف السؤال");
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e: any) {
            setError(e.message);
            setTimeout(() => setError(""), 3000);
        }
    };

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
            const questions = JSON.parse(text);
            
            if (!Array.isArray(questions)) {
                throw new Error("Invalid JSON format. Expected an array of questions.");
            }
            
            const validQuestions = questions.filter((q: any) => 
                q.letter && q.question && q.answer && q.category && q.difficulty
            );
            
            if (validQuestions.length === 0) {
                throw new Error("No valid questions found in the file.");
            }
            
            await apiFetch("/api/admin/db/questions/import", {
                method: "POST",
                body: JSON.stringify(questions),
            });
            
            setSuccess(`تم استيراد ${questions.length} سؤال`);
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e: any) {
            setError(e.message);
            setTimeout(() => setError(""), 3000);
        } finally {
            setUploading(false);
        }
    }, [apiFetch, loadData]);

    const migrateQuestions = async () => {
        if (!confirm("نقل جميع الأسئلة من JSON إلى قاعدة البيانات؟")) return;
        setMigrating(true);
        try {
            const res = await apiFetch("/api/admin/db/questions/migrate", { method: "POST" });
            setSuccess(`تم نقل ${res.migrated} سؤال`);
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e: any) {
            setError(e.message);
            setTimeout(() => setError(""), 3000);
        } finally {
            setMigrating(false);
        }
    };

    const clearAllQuestions = async () => {
        if (!confirm("حذف جميع الأسئلة؟")) return;
        try {
            await apiFetch("/api/admin/db/questions", { method: "DELETE" });
            setSuccess("تم حذف جميع الأسئلة");
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e: any) {
            setError(e.message);
            setTimeout(() => setError(""), 3000);
        }
    };

    const endSession = async (id: string) => {
        if (!confirm("End this session?")) return;
        try {
            await apiFetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
            setSuccess("Session ended");
            setSelectedSession(null);
            await loadData();
        } catch (e: any) {
            setError(e.message);
        }
    };

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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
                <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8 w-full max-w-md shadow-xl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-purple-500/25">
                            🛡️
                        </div>
                        <h2 className="text-2xl font-bold text-white">لوحة التحكم</h2>
                        <p className="text-white/60 mt-2">أدخل كلمة المرور للوصول</p>
                    </div>
                    <div className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-white/20 focus:outline-none"
                            placeholder="أدخل كلمة المرور"
                            dir="ltr"
                        />
                        <button
                            onClick={handleLogin}
                            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition-all duration-200 shadow-lg shadow-violet-500/25"
                        >
                            دخول
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all duration-200 border border-white/10"
                        >
                            🏠 العودة للرئيسية
                        </button>
                    </div>
                    {error && (
                        <div className="mt-4 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
            {/* Animated background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
            </div>

            {/* Header */}
            <header className="relative backdrop-blur-xl bg-white/5 border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25">
                                🛡️
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">لوحة التحكم</h1>
                                <p className="text-xs text-white/60">إدارة الأسئلة والجلسات</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <button 
                                className="group relative px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white transition-all duration-200"
                                onClick={logout}
                            >
                                <span className="relative z-10">تسجيل الخروج</span>
                                <div className="absolute inset-0 bg-red-500/10 rounded-md border border-red-500/20 group-hover:bg-red-500/20 transition-all duration-200"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="relative max-w-6xl mx-auto px-4 py-6">
                {/* Error/Success Messages - More Compact */}
                {error && (
                    <div className="mb-4 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 px-4 py-2 bg-green-500/20 backdrop-blur-xl border border-green-500/30 rounded-lg text-green-400 text-sm font-medium animate-bounce">
                        {success}
                    </div>
                )}

                {/* View Toggle */}
                <div className="mb-4 flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
                    {[
                        { key: "questions", label: "الأسئلة", icon: "❓" },
                        { key: "sessions", label: "الجلسات", icon: "🎮" },
                        { key: "stats", label: "الإحصائيات", icon: "📊" },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setView(tab.key as any)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                view === tab.key 
                                    ? "bg-violet-600 text-white shadow-lg" 
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            <span className="ml-1">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Questions View */}
                {view === "questions" && (
                    <div className="space-y-4">
                        {/* Search and Filters */}
                        <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                            <div className="flex flex-wrap gap-3 items-center justify-between">
                                <div className="flex gap-3 flex-1">
                                    <input
                                        type="text"
                                        value={qSearch}
                                        onChange={(e) => setQSearch(e.target.value)}
                                        placeholder="🔍 بحث..."
                                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:border-white/20 focus:outline-none flex-1 min-w-[200px]"
                                    />
                                    <Dropdown
                                        value={qFilter.letter}
                                        onChange={(value) => setQFilter(f => ({ ...f, letter: value }))}
                                        options={[
                                            { value: "all", label: "كل الحروف" },
                                            ...letters.map(l => ({ value: l, label: l }))
                                        ]}
                                        placeholder="كل الحروف"
                                        className="min-w-[120px]"
                                    />
                                    <Dropdown
                                        value={qFilter.category}
                                        onChange={(value) => setQFilter(f => ({ ...f, category: value }))}
                                        options={[
                                            { value: "all", label: "كل الفئات" },
                                            ...categories.map(c => ({ value: c, label: c }))
                                        ]}
                                        placeholder="كل الفئات"
                                        className="min-w-[120px]"
                                    />
                                    <Dropdown
                                        value={qFilter.difficulty}
                                        onChange={(value) => setQFilter(f => ({ ...f, difficulty: value }))}
                                        options={[
                                            { value: "all", label: "كل الصعوبات" },
                                            { value: "easy", label: "سهل" },
                                            { value: "medium", label: "متوسط" },
                                            { value: "hard", label: "صعب" }
                                        ]}
                                        placeholder="كل الصعوبات"
                                        className="min-w-[120px]"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <label className="px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200">
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
                                        className="px-3 py-1.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white transition-all duration-200"
                                        onClick={() => { setShowQForm(true); setEditQ(null); setFormQ({ category: "عام", difficulty: "medium" }); }}
                                    >
                                        إضافة سؤال
                                    </button>
                                    <button
                                        className="px-3 py-1.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
                                        onClick={migrateQuestions}
                                        disabled={migrating}
                                    >
                                        {migrating ? "جاري النقل..." : "نقل من JSON"}
                                    </button>
                                    <button
                                        className="px-3 py-1.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
                                        onClick={clearAllQuestions}
                                    >
                                        مسح الكل
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Question Form */}
                        {showQForm && (
                            <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                                <h3 className="text-base font-semibold text-white mb-3">
                                    {editQ ? "تعديل السؤال" : "سؤال جديد"}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الحرف</label>
                                        <input
                                            type="text"
                                            value={formQ.letter || ""}
                                            onChange={(e) => setFormQ(f => ({ ...f, letter: e.target.value.slice(0, 1) }))}
                                            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:border-white/20 focus:outline-none"
                                            placeholder="أ"
                                            maxLength={1}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الفئة</label>
                                        <input
                                            type="text"
                                            value={formQ.category || ""}
                                            onChange={(e) => setFormQ(f => ({ ...f, category: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:border-white/20 focus:outline-none"
                                            placeholder="عام"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">نص السؤال</label>
                                        <input
                                            type="text"
                                            value={formQ.question || ""}
                                            onChange={(e) => setFormQ(f => ({ ...f, question: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:border-white/20 focus:outline-none"
                                            placeholder="نص السؤال"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">نص الإجابة</label>
                                        <input
                                            type="text"
                                            value={formQ.answer || ""}
                                            onChange={(e) => setFormQ(f => ({ ...f, answer: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm focus:border-white/20 focus:outline-none"
                                            placeholder="نص الإجابة"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 uppercase tracking-wider mb-1">الصعوبة</label>
                                        <Dropdown
                                            value={formQ.difficulty || "medium"}
                                            onChange={(value) => setFormQ(f => ({ ...f, difficulty: value }))}
                                            options={[
                                                { value: "easy", label: "سهل" },
                                                { value: "medium", label: "متوسط" },
                                                { value: "hard", label: "صعب" }
                                            ]}
                                            placeholder="اختر الصعوبة"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={saveQuestion}
                                        className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                                    >
                                        حفظ
                                    </button>
                                    <button 
                                        onClick={() => { setShowQForm(false); setEditQ(null); setFormQ({}); }}
                                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all duration-200 border border-white/10 text-sm"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Questions Table */}
                        <div className="text-sm font-medium text-white/60 mb-3">
                            عرض {filteredQuestions.length} من {questions.length} سؤال
                        </div>
                        <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 shadow-xl overflow-hidden">
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="bg-white/5 border-b border-white/10">
                                        <tr>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">حرف</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">السؤال</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الإجابة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الفئة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الصعوبة</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-white/60 uppercase tracking-wider">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredQuestions.map(q => (
                                            <tr key={q.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 font-bold text-xs">
                                                        {q.letter}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-white text-sm">{q.question}</td>
                                                <td className="px-3 py-2 text-white/80 text-sm">{q.answer}</td>
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                                                        {q.category}
                                                    </span>
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
                                                        <button
                                                            onClick={() => { setEditQ(q); setFormQ(q); setShowQForm(true); }}
                                                            className="px-2 py-1 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                        >
                                                            تعديل
                                                        </button>
                                                        <button
                                                            onClick={() => deleteQuestion(q.id)}
                                                            className="px-2 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                        >
                                                            حذف
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {filteredQuestions.length === 0 && (
                            <div className="text-center py-6 text-white/40">
                                لا توجد أسئلة
                            </div>
                        )}
                    </div>
                )}

                {/* Sessions View */}
                {view === "sessions" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Sessions List */}
                        <div className="lg:col-span-1">
                            <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                                <h2 className="text-base font-semibold text-white mb-3">الجلسات النشطة</h2>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                                    {sessions.map(s => (
                                        <button
                                            key={s.id}
                                            className={`w-full p-3 text-right transition-all rounded-lg ${
                                                selectedSession === s.id 
                                                    ? "bg-violet-500/20 border-2 border-violet-500/30" 
                                                    : "hover:bg-white/5 border-2 border-transparent"
                                            }`}
                                            onClick={() => setSelectedSession(s.id)}
                                        >
                                            <div className="font-bold text-white text-sm">{s.id}</div>
                                            <div className="text-xs text-white/60 mt-1">
                                                {s.playerCount} لاعب • {s.phase}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Session Details */}
                        <div className="lg:col-span-2">
                            {selectedSessionData ? (
                                <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold text-base text-white">
                                            تفاصيل الجلسة: {selectedSessionData.id}
                                        </h3>
                                        <button
                                            onClick={() => endSession(selectedSessionData.id)}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                                        >
                                            إنهاء الجلسة
                                        </button>
                                    </div>

                                    {/* Scores */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 rounded-lg text-center bg-orange-500/10 border border-orange-500/20">
                                            <div className="text-sm font-bold mb-1 text-orange-400">الالفريق البرتقالي</div>
                                            <div className="text-2xl font-black text-orange-400">{selectedSessionData.orangeScore}</div>
                                        </div>
                                        <div className="p-3 rounded-lg text-center bg-green-500/10 border border-green-500/20">
                                            <div className="text-sm font-bold mb-1 text-green-400">الالفريق الأخضر</div>
                                            <div className="text-2xl font-black text-green-400">{selectedSessionData.greenScore}</div>
                                        </div>
                                    </div>

                                    {/* Players */}
                                    <div>
                                        <h4 className="font-bold mb-2 text-white text-sm">
                                            اللاعبون ({selectedSessionData.playerCount})
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedSessionData.players.map(p => (
                                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-white/10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white text-sm">{p.name}</span>
                                                        {p.id === selectedSessionData.hostPlayerId && (
                                                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-violet-500/20 text-violet-400">
                                                                صاحب الجلسة
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-white/60">
                                                        {p.role === "teamorange" ? "🟠 برتقالي" :
                                                         p.role === "teamgreen" ? "🟢 أخضر" :
                                                         p.role === "gamemaster" ? "🎮 مدير" : "👀 مشاهد"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-8 shadow-xl text-center">
                                    <p className="text-white/60">اختر جلسة لعرض التفاصيل</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Stats View */}
                {view === "stats" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-white">إجمالي الأسئلة</h3>
                                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-xl">
                                    ❓
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.questionCount}</p>
                        </div>
                        <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-white">الجلسات النشطة</h3>
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-xl">
                                    🎮
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.activeSessions}</p>
                        </div>
                        <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 shadow-xl">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-white">إجمالي اللاعبين</h3>
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">
                                    👥
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-white">{stats.totalPlayers}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
