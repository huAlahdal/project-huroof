import { useState, useEffect } from "react";
import QuestionBrowser from "./QuestionBrowser";
import UserIcon from "./UserIcon";
import type { Question } from "~/lib/questions";

interface GameMasterPanelProps {
    selectedLetter: string | null;
    questionText: string | null;
    answerText: string | null;
    category: string | null;
    difficulty: string | null;
    showQuestion: boolean;
    buzzedTeam: string | null;
    buzzedPlayerName: string | null;
    buzzerLocked: boolean;
    passedToOtherTeamAt: number | null;
    buzzerIsOpenMode: boolean;
    buzzerTimerFirst: number;
    buzzerTimerSecond: number;
    buzzedAt: number | null;
    orangeName: string;
    greenName: string;
    players: { id: string; name: string; role: string }[];
    onPickRandom: () => void;
    onSelectCell: (id: string) => void;
    onSelectQuestion: (q: Question) => void;
    onAwardOrange: () => void;
    onAwardGreen: () => void;
    onSkip: () => void;
    onRefreshQuestion: () => void;
    onShowQuestion: (show: boolean) => void;
    onResetBuzzer: () => void;
    onPassToOtherTeam: () => void;
    onOpenBuzzer: () => void;
    onNextRound: () => void;
    onResetGame: () => void;
    onEndSession: () => void;
    onSetTimerConfig: (first?: number, second?: number) => void;
    onSwitchPlayers: (id1: string, id2: string) => void;
    onKickPlayer?: (playerId: string) => void;
    onSwitchPlayerTeam?: (playerId: string, newRole: string) => void;
    onMoveSpectatorToTeam?: (playerId: string, teamRole: string) => void;
    onChangeHexWinner?: (cellId: string, winner: string) => void;
}

const diffColor = (d: string | null) =>
    d === "easy" ? "#22c55e" : d === "medium" ? "#f59e0b" : "#ef4444";
const diffLabel = (d: string | null) =>
    d === "easy" ? "سهل" : d === "medium" ? "متوسط" : d === "hard" ? "صعب" : "";

function Section({
    icon, title, children, defaultOpen = true,
}: { icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="gm-section">
            <div className="gm-section-header" onClick={() => setOpen((o) => !o)}>
                <span style={{ color: "var(--text-2)" }}>{icon} {title}</span>
                <span style={{ color: "var(--text-4)", fontSize: "0.75rem", transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
            </div>
            {open && <div className="gm-section-body space-y-2">{children}</div>}
        </div>
    );
}

function BtnRow({ children }: { children: React.ReactNode }) {
    return <div className="flex gap-2">{children}</div>;
}

export default function GameMasterPanel({
    selectedLetter,
    questionText,
    answerText,
    category,
    difficulty,
    showQuestion,
    buzzedTeam,
    buzzedPlayerName,
    buzzerLocked,
    passedToOtherTeamAt,
    buzzerIsOpenMode,
    buzzerTimerFirst,
    buzzerTimerSecond,
    buzzedAt,
    orangeName,
    greenName,
    players,
    onPickRandom,
    onSelectCell,
    onSelectQuestion,
    onAwardOrange,
    onAwardGreen,
    onSkip,
    onRefreshQuestion,
    onShowQuestion,
    onResetBuzzer,
    onPassToOtherTeam,
    onOpenBuzzer,
    onNextRound,
    onResetGame,
    onEndSession,
    onSetTimerConfig,
    onSwitchPlayers,
    onKickPlayer,
    onSwitchPlayerTeam,
    onMoveSpectatorToTeam,
    onChangeHexWinner,
}: GameMasterPanelProps) {

    const [showBrowser, setShowBrowser] = useState(false);

    // Timer state for GM panel
    const [timerPhase, setTimerPhase] = useState<"first" | "second" | "expired" | "open" | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(0);

    // Timer effect — computed from server timestamps so both GM and players see the same value
    useEffect(() => {
        if (buzzedAt && buzzerLocked) {
            const firstDuration = buzzerTimerFirst ?? 5;
            const secondDuration = buzzerTimerSecond ?? 10;

            const tick = () => {
                const elapsed = (Date.now() - buzzedAt!) / 1000;
                if (elapsed < firstDuration) {
                    setTimerPhase("first");
                    setTimerSeconds(Math.ceil(firstDuration - elapsed));
                } else if (!passedToOtherTeamAt) {
                    setTimerPhase("expired");
                    setTimerSeconds(0);
                } else {
                    const elapsedSincePass = (Date.now() - passedToOtherTeamAt) / 1000;
                    if (elapsedSincePass < secondDuration) {
                        setTimerPhase("second");
                        setTimerSeconds(Math.ceil(secondDuration - elapsedSincePass));
                    } else {
                        setTimerPhase("open");
                        setTimerSeconds(0);
                    }
                }
            };

            tick();
            const id = setInterval(tick, 250);
            return () => clearInterval(id);
        } else {
            setTimerPhase(null);
            setTimerSeconds(0);
        }
    }, [buzzedAt, buzzerLocked, buzzerTimerFirst, buzzerTimerSecond, passedToOtherTeamAt]);

    const [switchFrom, setSwitchFrom] = useState<string | null>(null);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

    const buzzerTeamName = buzzedTeam === "orange" ? orangeName : buzzedTeam === "green" ? greenName : null;
    const otherTeamName = buzzedTeam === "orange" ? greenName : orangeName;

    return (
        <>
            {/* Question Browser Modal */}
            {showBrowser && selectedLetter && (
                <QuestionBrowser
                    letter={selectedLetter}
                    onSelectQuestion={(q) => { onSelectQuestion(q); setShowBrowser(false); }}
                    onClose={() => setShowBrowser(false)}
                />
            )}

            <div className="space-y-2">

                {/* ── Question & Letter ─────────────────────── */}
                <Section icon="❓" title="السؤال الحالي" defaultOpen={true}>
                    {selectedLetter ? (
                        <div className="space-y-3">
                            {/* Letter Badge & Status */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div
                                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-4xl font-black text-white shrink-0"
                                    style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 24px rgba(168,85,247,0.5)" }}
                                >
                                    {selectedLetter}
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-3 py-1 rounded-full text-xs font-black" style={{ background: showQuestion ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.2)", color: showQuestion ? "#4ade80" : "var(--text-3)" }}>
                                            {showQuestion ? "✓ ظاهر" : "✗ مخفي"}
                                        </span>
                                        {category && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(168,85,247,0.15)", color: "var(--accent)" }}>
                                                {category}
                                            </span>
                                        )}
                                        {difficulty && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${diffColor(difficulty)}15`, color: diffColor(difficulty) }}>
                                                {diffLabel(difficulty)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Question & Answer - Compact Cards */}
                            <div className="space-y-2">
                                <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                                    <p className="text-[10px] font-bold mb-1 uppercase tracking-wide" style={{ color: "var(--text-4)" }}>السؤال</p>
                                    <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-1)" }}>
                                        {questionText || <span style={{ color: "var(--text-4)" }}>لم يُختر سؤال</span>}
                                    </p>
                                </div>
                                <div className="rounded-lg p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(168,85,247,0.25)" }}>
                                    <p className="text-[10px] font-bold mb-1 uppercase tracking-wide" style={{ color: "var(--accent)" }}>الإجابة</p>
                                    <p className="text-base font-black" style={{ color: "var(--text-1)" }}>
                                        {answerText || "—"}
                                    </p>
                                </div>
                            </div>

                            {/* Compact Actions */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <button
                                    className="py-2.5 rounded-lg font-bold text-xs transition-all"
                                    style={{
                                        background: showQuestion ? "rgba(168,85,247,0.25)" : "var(--surface)",
                                        border: `1.5px solid ${showQuestion ? "rgba(168,85,247,0.5)" : "var(--border)"}`,
                                        color: showQuestion ? "#d8b4fe" : "var(--text-2)",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => onShowQuestion(!showQuestion)}
                                >
                                    {showQuestion ? "👁 إخفاء" : "👁‍🗨 إظهار"}
                                </button>
                                <button
                                    className="py-2.5 rounded-lg font-bold text-xs transition-all"
                                    style={{ background: "rgba(234,179,8,0.1)", border: "1.5px solid rgba(234,179,8,0.3)", color: "#facc15", cursor: "pointer" }}
                                    onClick={onRefreshQuestion}
                                >
                                    🔄 بديل
                                </button>
                                <button
                                    className="py-2.5 rounded-lg font-bold text-xs transition-all"
                                    style={{ background: "rgba(168,85,247,0.12)", border: "1.5px solid rgba(168,85,247,0.3)", color: "var(--accent)", cursor: "pointer" }}
                                    onClick={() => setShowBrowser(true)}
                                >
                                    📋 بنك
                                </button>
                            </div>
                            <p className="text-xs text-center" style={{ color: "var(--text-4)" }}>💡 اضغط على حرف في الشبكة لتغييره</p>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-4xl mb-2">📍</p>
                            <p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>اضغط على حرف في الشبكة للبدء</p>
                        </div>
                    )}
                </Section>

                {/* ── Buzzer ─────────────────────────────────── */}
                <Section icon="🔔" title="الجرس" defaultOpen={true}>
                    {buzzedTeam ? (
                        <div
                            className="rounded-xl p-3 text-center fade-in-scale"
                            style={{
                                background: buzzedTeam === "orange" ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)",
                                border: `1.5px solid ${buzzedTeam === "orange" ? "#f97316" : "#22c55e"}`,
                            }}
                        >
                            <p className="text-lg font-black" style={{ color: buzzedTeam === "orange" ? "#fb923c" : "#4ade80" }}>
                                🔔 {buzzerTeamName}
                            </p>
                            {buzzedPlayerName && (
                                <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-2)" }}>🎮 {buzzedPlayerName}</p>
                            )}
                            {timerPhase && (
                                <div className="mt-2">
                                    {timerPhase === "first" && (
                                        <div className="text-2xl font-black" style={{ color: buzzedTeam === "orange" ? "#f97316" : "#22c55e" }}>
                                            {timerSeconds === 0 ? "Time is up" : timerSeconds}
                                        </div>
                                    )}
                                    {timerPhase === "expired" && (
                                        <div className="text-sm font-bold text-red-400">
                                            ⏰ انتهى الوقت!
                                        </div>
                                    )}
                                    {timerPhase === "second" && (
                                        <div className="text-2xl font-black" style={{ color: buzzedTeam === "orange" ? "#22c55e" : "#f97316" }}>
                                            {timerSeconds === 0 ? "Time is up" : timerSeconds}
                                        </div>
                                    )}
                                    {timerPhase === "open" && (
                                        <div className="text-sm font-bold text-yellow-400">
                                            🔓 مفتوح للجميع
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface)" }}>
                            <p className="text-xs" style={{ color: "var(--text-3)" }}>⏳ بانتظار ضغط الجرس...</p>
                        </div>
                    )}

                    <BtnRow>
                        <button
                            className="flex-1 py-2 rounded-xl font-bold text-xs transition-all"
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer" }}
                            onClick={onResetBuzzer}
                        >
                            🔄 إعادة تعيين
                        </button>
                        <button
                            className="flex-1 py-2 rounded-xl font-bold text-xs transition-all"
                            style={{ background: buzzerIsOpenMode ? "rgba(234,179,8,0.25)" : "rgba(234,179,8,0.10)", border: "1px solid rgba(234,179,8,0.4)", color: "#facc15", cursor: "pointer" }}
                            onClick={onOpenBuzzer}
                        >
                            {buzzerIsOpenMode ? "🔓 مفتوح" : "🔓 فتح للجميع"}
                        </button>
                    </BtnRow>

                    {buzzedTeam && !passedToOtherTeamAt && (
                        <button
                            className="w-full py-2 rounded-xl font-bold text-xs"
                            style={{
                                background: buzzedTeam === "orange" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                                border: `1px solid ${buzzedTeam === "orange" ? "#22c55e44" : "#f9731644"}`,
                                color: buzzedTeam === "orange" ? "#4ade80" : "#fb923c",
                                cursor: "pointer",
                            }}
                            onClick={onPassToOtherTeam}
                        >
                            ➡️ تمرير إلى {otherTeamName}
                        </button>
                    )}
                </Section>

                {/* ── Award ──────────────────────────────────── */}
                <Section icon="⚖️" title="منح الخلية">
                    <BtnRow>
                        <button className="btn-orange flex-1 py-2.5 text-xs" onClick={onAwardOrange}>✅ {orangeName}</button>
                        <button className="btn-green flex-1 py-2.5 text-xs" onClick={onAwardGreen}>✅ {greenName}</button>
                    </BtnRow>
                    <button
                        className="w-full py-2 rounded-xl font-bold text-xs"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer" }}
                        onClick={onSkip}
                    >
                        ⏭ تخطي
                    </button>
                </Section>

                {/* ── Timer ──────────────────────────────────── */}
                <Section icon="⏱" title="المؤقت" defaultOpen={false}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
                                الفريق الضاغط (ث)
                            </label>
                            <input
                                type="number" min={1} max={60} value={buzzerTimerFirst}
                                onChange={(e) => onSetTimerConfig(Number(e.target.value) || 5, undefined)}
                                className="input-field text-center text-sm"
                                style={{ padding: "0.5rem" }}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>
                                الفريق الآخر (ث)
                            </label>
                            <input
                                type="number" min={1} max={60} value={buzzerTimerSecond}
                                onChange={(e) => onSetTimerConfig(undefined, Number(e.target.value) || 10)}
                                className="input-field text-center text-sm"
                                style={{ padding: "0.5rem" }}
                            />
                        </div>
                    </div>
                </Section>

                {/* ── Game Controls ──────────────────────────── */}
                <Section icon="⚙️" title="التحكم" defaultOpen={false}>
                    <BtnRow>
                        <button
                            className="flex-1 py-2 rounded-xl font-bold text-xs"
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer" }}
                            onClick={onNextRound}
                        >
                            ⏭ الجولة التالية
                        </button>
                        <button
                            className="flex-1 py-2 rounded-xl font-bold text-xs"
                            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer" }}
                            onClick={onResetGame}
                        >
                            🔄 إعادة اللعبة
                        </button>
                    </BtnRow>

                    {!confirmEnd ? (
                        <button
                            className="w-full py-2 rounded-xl font-bold text-xs"
                            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#f87171", cursor: "pointer" }}
                            onClick={() => setConfirmEnd(true)}
                        >
                            🚪 إنهاء الجلسة
                        </button>
                    ) : (
                        <BtnRow>
                            <button
                                className="flex-1 py-2 rounded-xl font-bold text-xs"
                                style={{ background: "#dc2626", color: "#fff", cursor: "pointer", border: "none" }}
                                onClick={() => { onEndSession(); setConfirmEnd(false); }}
                            >
                                ✅ تأكيد
                            </button>
                            <button
                                className="flex-1 py-2 rounded-xl font-bold text-xs"
                                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer" }}
                                onClick={() => setConfirmEnd(false)}
                            >
                                ❌ إلغاء
                            </button>
                        </BtnRow>
                    )}
                </Section>

                {/* ── Players ────────────────────────────────── */}
                <Section icon="👥" title="اللاعبون" defaultOpen={false}>
                    <p className="text-[10px]" style={{ color: "var(--text-4)" }}>إدارة الفرق والمشاهدين</p>
                    <div className="space-y-1.5">
                        {players.map((p) => {
                            const isOrange = p.role === "teamorange";
                            const isGreen = p.role === "teamgreen";
                            const isGM = p.role === "gamemaster";
                            const isSpectator = p.role === "spectator";
                            const clr = isOrange ? "#fb923c" : isGreen ? "#4ade80" : isGM ? "#d8b4fe" : "var(--text-3)";
                            const isSelected = switchFrom === p.id;
                            
                            return (
                                <div key={p.id} className="space-y-1">
                                    <button
                                        className="w-full rounded-xl px-3 py-2 text-xs font-bold transition-all"
                                        style={{
                                            background: isSelected ? "rgba(168, 85, 247, 0.15)" : 
                                                       selectedPlayer === p.id ? "rgba(168, 85, 247, 0.1)" : "var(--input-bg)",
                                            border: isSelected ? "1px solid rgba(168, 85, 247, 0.3)" : 
                                                   selectedPlayer === p.id ? "1px solid rgba(168, 85, 247, 0.2)" : "1px solid var(--input-border)",
                                            color: clr,
                                            textAlign: "right",
                                        }}
                                        onClick={() => {
                                            if (isGM) return; // Can't select GM
                                            if (!switchFrom) setSwitchFrom(p.id);
                                            else if (switchFrom === p.id) setSwitchFrom(null);
                                            else { onSwitchPlayers?.(switchFrom, p.id); setSwitchFrom(null); }
                                            setSelectedPlayer(selectedPlayer === p.id ? null : p.id);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                                                 style={{
                                                     background: isOrange ? "rgba(251, 146, 60, 0.2)"
                                                               : isGreen ? "rgba(74, 222, 128, 0.2)"
                                                               : isGM ? "rgba(216, 180, 254, 0.2)"
                                                               : "rgba(156, 163, 175, 0.2)",
                                                     border: `1px solid ${clr}`,
                                                 }}
                                            >
                                                <UserIcon className="w-3 h-3" style={{ color: clr }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div 
                                                    className="px-2 py-1 rounded-md text-xs font-medium truncate"
                                                    style={{
                                                        background: isOrange ? "rgba(251, 146, 60, 0.15)"
                                                                      : isGreen ? "rgba(74, 222, 128, 0.15)"
                                                                      : isGM ? "rgba(216, 180, 254, 0.15)"
                                                                      : "rgba(156, 163, 175, 0.15)",
                                                        border: `1px solid ${isOrange ? "rgba(251, 146, 60, 0.3)"
                                                                      : isGreen ? "rgba(74, 222, 128, 0.3)"
                                                                      : isGM ? "rgba(216, 180, 254, 0.3)"
                                                                      : "rgba(156, 163, 175, 0.3)"}`,
                                                        color: clr
                                                    }}
                                                >
                                                    {p.name}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    
                                    {/* Player management buttons - show only when selected */}
                                    {!isGM && selectedPlayer === p.id && (
                                        <div className="flex gap-1 px-2 fade-in-scale">
                                            {isSpectator ? (
                                                <>
                                                    <button
                                                        className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                                        style={{ background: "rgba(251, 146, 60, 0.2)", color: "#fb923c", border: "1px solid rgba(251, 146, 60, 0.3)" }}
                                                        onClick={() => { onMoveSpectatorToTeam?.(p.id, "teamorange"); setSelectedPlayer(null); }}
                                                    >
                                                        للبرتقالي
                                                    </button>
                                                    <button
                                                        className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                                        style={{ background: "rgba(74, 222, 128, 0.2)", color: "#4ade80", border: "1px solid rgba(74, 222, 128, 0.3)" }}
                                                        onClick={() => { onMoveSpectatorToTeam?.(p.id, "teamgreen"); setSelectedPlayer(null); }}
                                                    >
                                                        للأخضر
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {isOrange && (
                                                        <button
                                                            className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                                            style={{ background: "rgba(74, 222, 128, 0.2)", color: "#4ade80", border: "1px solid rgba(74, 222, 128, 0.3)" }}
                                                            onClick={() => { onSwitchPlayerTeam?.(p.id, "teamgreen"); setSelectedPlayer(null); }}
                                                        >
                                                            للأخضر
                                                        </button>
                                                    )}
                                                    {isGreen && (
                                                        <button
                                                            className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                                            style={{ background: "rgba(251, 146, 60, 0.2)", color: "#fb923c", border: "1px solid rgba(251, 146, 60, 0.3)" }}
                                                            onClick={() => { onSwitchPlayerTeam?.(p.id, "teamorange"); setSelectedPlayer(null); }}
                                                        >
                                                            للبرتقالي
                                                        </button>
                                                    )}
                                                    <button
                                                        className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                                        style={{ background: "rgba(156, 163, 175, 0.2)", color: "var(--text-3)", border: "1px solid rgba(156, 163, 175, 0.3)" }}
                                                        onClick={() => { onSwitchPlayerTeam?.(p.id, "spectator"); setSelectedPlayer(null); }}
                                                    >
                                                        مشاهد
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                className="text-xs py-1.5 px-3 rounded-lg font-medium transition-all hover:scale-105"
                                                style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                                                onClick={() => { onKickPlayer?.(p.id); setSelectedPlayer(null); }}
                                            >
                                                طرد
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Section>

            </div>
        </>
    );
}
