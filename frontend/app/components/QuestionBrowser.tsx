import { useState, useMemo, useEffect } from "react";
import type { Question } from "~/lib/questions";
import { fetchQuestionsFromBackend } from "~/lib/questions";

interface QuestionBrowserProps {
    letter: string;
    onSelectQuestion: (q: Question) => void;
    onClose: () => void;
}

const DIFFICULTY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    easy: { label: "سهل", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    medium: { label: "متوسط", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    hard: { label: "صعب", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

export default function QuestionBrowser({ letter, onSelectQuestion, onClose }: QuestionBrowserProps) {
    const [diffFilter, setDiffFilter] = useState("all");
    const [catFilter, setCatFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [letterQuestions, setLetterQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadQuestions() {
            setLoading(true);
            try {
                const questions = await fetchQuestionsFromBackend({ letter });
                setLetterQuestions(questions);
            } catch (error) {
                console.error("Failed to load questions:", error);
                setLetterQuestions([]);
            }
            setLoading(false);
        }
        void loadQuestions();
    }, [letter]);

    const filtered = useMemo(() => {
        return letterQuestions.filter((q: Question) => {
            if (diffFilter !== "all" && q.difficulty !== diffFilter) return false;
            if (catFilter !== "all" && q.category !== catFilter) return false;
            if (search && !q.question.includes(search) && !q.answer.includes(search)) return false;
            return true;
        });
    }, [letterQuestions, diffFilter, catFilter, search]);

    const categories = useMemo(() => {
        const cats = new Set(letterQuestions.map((q: Question) => q.category));
        return Array.from(cats);
    }, [letterQuestions]);

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div
                className="w-full max-w-2xl mt-8 mb-8 rounded-2xl overflow-hidden fade-in-scale"
                style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--border-strong)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    maxHeight: "85vh",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ borderBottom: "1px solid var(--border)" }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl font-black text-white shrink-0"
                            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 18px rgba(168,85,247,0.5)" }}
                        >
                            {letter}
                        </div>
                        <div>
                            <h2 className="font-black text-base" style={{ color: "var(--text-1)" }}>
                                أسئلة حرف «{letter}»
                            </h2>
                            <p className="text-xs" style={{ color: "var(--text-3)" }}>
                                {filtered.length} من {letterQuestions.length} سؤال
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold transition-all"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer" }}
                    >
                        ✕
                    </button>
                </div>

                {/* Filters */}
                <div className="px-4 py-3 shrink-0 flex flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 بحث..."
                        className="input-field text-sm"
                        style={{ flex: "1 1 160px", minWidth: 0, padding: "0.5rem 0.875rem" }}
                    />
                    <select
                        value={diffFilter}
                        onChange={(e) => setDiffFilter(e.target.value)}
                        className="input-field text-sm"
                        style={{ flex: "0 0 auto", width: "auto", padding: "0.5rem 0.875rem" }}
                    >
                        <option value="all">كل الصعوبات</option>
                        <option value="easy">سهل</option>
                        <option value="medium">متوسط</option>
                        <option value="hard">صعب</option>
                    </select>
                    <select
                        value={catFilter}
                        onChange={(e) => setCatFilter(e.target.value)}
                        className="input-field text-sm"
                        style={{ flex: "0 0 auto", width: "auto", padding: "0.5rem 0.875rem" }}
                    >
                        <option value="all">كل الفئات</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* Question list */}
                <div className="overflow-y-auto flex-1 p-3 space-y-2">
                    {loading && (
                        <div className="text-center py-10">
                            <p className="text-4xl mb-2">⏳</p>
                            <p className="text-sm font-semibold" style={{ color: "var(--text-3)" }}>جاري التحميل...</p>
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-4xl mb-2">🔍</p>
                            <p className="text-sm font-semibold" style={{ color: "var(--text-3)" }}>لا توجد أسئلة مطابقة</p>
                        </div>
                    )}
                    {!loading && filtered.map((q: Question) => {
                        const diff = DIFFICULTY_LABELS[q.difficulty] ?? DIFFICULTY_LABELS.easy;
                        return (
                            <button
                                key={q.id}
                                onClick={() => onSelectQuestion(q)}
                                className="w-full text-right rounded-xl px-4 py-3 transition-all group"
                                style={{
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    cursor: "pointer",
                                    display: "block",
                                    textAlign: "right",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 text-right">
                                        <p className="text-sm font-bold leading-relaxed" style={{ color: "var(--text-1)" }}>
                                            {q.question}
                                        </p>
                                        <p className="text-xs font-semibold mt-1" style={{ color: "var(--accent)" }}>
                                            ✅ {q.answer}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <span
                                            className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                                            style={{ background: diff.bg, color: diff.color }}
                                        >
                                            {diff.label}
                                        </span>
                                        <span className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>{q.category}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
