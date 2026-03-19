import { useState } from "react";
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
    // Timer is computed in game.tsx and passed down so both floating & sidebar stay in perfect sync
    timerPhase: "first" | "second" | "expired" | "open" | null;
    timerSeconds: number;
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
    onSwapTeams?: () => void;
    usedQuestionIds?: string[];
}

//  Helpers 

const diffColor = (d: string | null) =>
    d === "easy" ? "#22c55e" : d === "medium" ? "#f59e0b" : "#ef4444";
const diffBg = (d: string | null) =>
    d === "easy" ? "rgba(34,197,94,0.12)" : d === "medium" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";
const diffLabel = (d: string | null) =>
    d === "easy" ? "سهل" : d === "medium" ? "متوسط" : d === "hard" ? "صعب" : "";

//  Collapsible Section 

function Section({
    icon, title, children, defaultOpen = true, count,
}: {
    icon: string;
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    count?: number;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
            <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setOpen((o) => !o)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{icon}</span>
                    <span className="text-sm font-bold" style={{ color: "var(--text-1)" }}>{title}</span>
                    {count !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black" style={{ background: "rgba(168,85,247,0.2)", color: "var(--accent)" }}>{count}</span>
                    )}
                </div>
                <span className="text-xs" style={{ color: "var(--text-4)", display: "inline-block", transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}></span>
            </button>
            {open && (
                <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="pt-2 space-y-2">{children}</div>
                </div>
            )}
        </div>
    );
}

//  SVG Ring Timer 

function TimerRing({ seconds, max, color }: { seconds: number; max: number; color: string }) {
    const r = 22;
    const circ = 2 * Math.PI * r;
    const dashOffset = circ * (1 - Math.max(0, max > 0 ? seconds / max : 0));
    return (
        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                <circle
                    cx="28" cy="28" r={r} fill="none"
                    stroke={color} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 0.25s linear" }}
                />
            </svg>
            <span className="font-black text-lg leading-none" style={{ color }}>{seconds > 0 ? seconds : "0"}</span>
        </div>
    );
}

//  Divider Label 

function DivLabel({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: "var(--text-4)" }}>{label}</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>
    );
}

//  Action Button 

function ActionBtn({
    children, onClick, style, disabled,
}: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: disabled ? "not-allowed" : "pointer", ...style }}
        >
            {children}
        </button>
    );
}

//  Main Component 

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
    orangeName,
    greenName,
    players,
    timerPhase,
    timerSeconds,
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
    onSwapTeams,
    usedQuestionIds,
}: GameMasterPanelProps) {

    const [showBrowser, setShowBrowser] = useState(false);
    const [switchFrom, setSwitchFrom] = useState<string | null>(null);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

    const buzzerColor = buzzedTeam === "orange" ? "#f97316" : "#22c55e";
    const otherColor = buzzedTeam === "orange" ? "#22c55e" : "#f97316";
    const buzzerTeamName = buzzedTeam === "orange" ? orangeName : buzzedTeam === "green" ? greenName : null;
    const otherTeamName = buzzedTeam === "orange" ? greenName : orangeName;

    const activeTimerColor =
        timerPhase === "second" ? otherColor
        : timerPhase === "expired" ? "#ef4444"
        : timerPhase === "open"    ? "#eab308"
        : buzzerColor;

    const hasQuestion = !!selectedLetter;

    // 
    // 1. QUESTION SECTION  always visible, top priority
    // 

    const renderQuestion = () => (
        <div
            className="rounded-2xl overflow-hidden"
            style={{
                border: hasQuestion
                    ? "1.5px solid rgba(168,85,247,0.4)"
                    : "1px solid var(--border)",
                background: hasQuestion
                    ? "linear-gradient(160deg, rgba(124,58,237,0.14), rgba(168,85,247,0.06))"
                    : "rgba(255,255,255,0.03)",
                boxShadow: hasQuestion ? "0 0 24px rgba(168,85,247,0.1)" : "none",
            }}
        >
            {hasQuestion ? (
                <div className="p-3 space-y-2.5">
                    {/* Header: letter badge + badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0"
                            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 14px rgba(168,85,247,0.5)" }}
                        >
                            {selectedLetter}
                        </div>
                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: showQuestion ? "rgba(34,197,94,0.18)" : "rgba(148,163,184,0.12)", color: showQuestion ? "#4ade80" : "var(--text-4)" }}>
                                {showQuestion ? " ظاهر" : " مخفي"}
                            </span>
                            {category && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "rgba(168,85,247,0.15)", color: "var(--accent)" }}>
                                    {category}
                                </span>
                            )}
                            {difficulty && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: diffBg(difficulty), color: diffColor(difficulty) }}>
                                    {diffLabel(difficulty)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Question text */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p className="text-[10px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-4)" }}>السؤال</p>
                        <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-1)" }}>
                            {questionText || <span style={{ color: "var(--text-4)" }}>لم يختر سؤال بعد</span>}
                        </p>
                    </div>

                    {/* Answer */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(168,85,247,0.35)" }}>
                        <p className="text-[10px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: "#a78bfa" }}>الإجابة </p>
                        <p className="text-base font-black" style={{ color: "var(--text-1)" }}>{answerText || ""}</p>
                    </div>

                    {/* Action row */}
                    <div className="grid grid-cols-4 gap-1.5">
                        <ActionBtn
                            onClick={() => onShowQuestion(!showQuestion)}
                            style={showQuestion
                                ? { background: "rgba(168,85,247,0.2)", borderColor: "rgba(168,85,247,0.4)", color: "#d8b4fe" }
                                : {}}
                        >
                            {showQuestion ? " إخفاء" : " إظهار"}
                        </ActionBtn>
                        <ActionBtn onClick={onRefreshQuestion} style={{ color: "#facc15", borderColor: "rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.08)" }}>
                             بديل
                        </ActionBtn>
                        <ActionBtn onClick={() => setShowBrowser(true)} style={{ color: "var(--accent)", borderColor: "rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.08)" }}>
                             بنك
                        </ActionBtn>
                        <ActionBtn onClick={onPickRandom} style={{ color: "#38bdf8", borderColor: "rgba(14,165,233,0.25)", background: "rgba(14,165,233,0.08)" }}>
                             عشوائي
                        </ActionBtn>
                    </div>

                    <p className="text-[10px] text-center" style={{ color: "var(--text-4)" }}>
                         اضغط على حرف في الشبكة لتغييره
                    </p>
                </div>
            ) : (
                <div className="p-4 text-center space-y-3">
                    <p className="text-3xl"></p>
                    <p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>لم يختر حرف بعد</p>
                    <button
                        className="mx-auto px-4 py-2 rounded-xl font-bold text-xs block"
                        style={{ background: "rgba(14,165,233,0.1)", border: "1.5px solid rgba(14,165,233,0.3)", color: "#38bdf8", cursor: "pointer" }}
                        onClick={onPickRandom}
                    >
                         اختر حرفا عشوائيا
                    </button>
                </div>
            )}
        </div>
    );

    // 
    // 2. AWARD SECTION  immediately below question
    // 

    const renderAward = () => (
        <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
                <button
                    className="btn-orange py-3 text-sm font-black rounded-xl active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={onAwardOrange}
                    disabled={!hasQuestion}
                >
                     {orangeName.split(" - ")[0]}
                </button>
                <button
                    className="btn-green py-3 text-sm font-black rounded-xl active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={onAwardGreen}
                    disabled={!hasQuestion}
                >
                     {greenName.split(" - ")[0]}
                </button>
            </div>
            <button
                className="w-full py-2 rounded-xl font-bold text-xs disabled:opacity-40"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)", cursor: hasQuestion ? "pointer" : "not-allowed" }}
                onClick={onSkip}
                disabled={!hasQuestion}
            >
                 تخطي الحرف
            </button>
        </div>
    );

    // 
    // 3. BUZZER STATUS  shows who buzzed, timer, and actions
    // 

    const renderBuzzer = () => {
        // Open for all  nobody buzzed yet
        if (buzzerIsOpenMode && !buzzedTeam) {
            return (
                <div className="rounded-2xl p-3.5 text-center space-y-2" style={{ background: "rgba(234,179,8,0.08)", border: "1.5px solid rgba(234,179,8,0.3)" }}>
                    <div>
                        <div className="text-xl mb-0.5"></div>
                        <p className="text-sm font-black text-yellow-400">مفتوح للجميع</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>بانتظار ضغط الجرس...</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button className="py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-2)", cursor: "pointer" }} onClick={onResetBuzzer}>
                             إغلاق
                        </button>
                        <div className="rounded-xl flex items-center justify-center text-[10px] font-bold text-yellow-500/60 border" style={{ borderColor: "rgba(234,179,8,0.2)" }}>
                            انتظار...
                        </div>
                    </div>
                </div>
            );
        }

        // Nobody buzzed and not open
        if (!buzzedTeam) {
            return (
                <div className="rounded-2xl p-3 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-4)" }}> الضاغط (ث)</label>
                            <input type="number" min={1} max={60} value={buzzerTimerFirst} onChange={(e) => onSetTimerConfig(Number(e.target.value) || 5, undefined)} className="input-field text-center text-sm w-full" style={{ padding: "0.4rem" }} />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--text-4)" }}> الآخر (ث)</label>
                            <input type="number" min={1} max={60} value={buzzerTimerSecond} onChange={(e) => onSetTimerConfig(undefined, Number(e.target.value) || 10)} className="input-field text-center text-sm w-full" style={{ padding: "0.4rem" }} />
                        </div>
                    </div>
                    <button className="w-full py-2 rounded-xl font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "rgba(234,179,8,0.10)", border: "1px solid rgba(234,179,8,0.30)", color: "#facc15", cursor: hasQuestion ? "pointer" : "not-allowed" }} onClick={onOpenBuzzer} disabled={!hasQuestion}>
                         فتح الجرس للجميع
                    </button>
                    <p className="text-xs text-center" style={{ color: "var(--text-4)" }}> بانتظار ضغط الجرس...</p>
                </div>
            );
        }

        // Active buzz — show the team whose turn it currently is
        const isSecondTeamTurn = timerPhase === "second";
        const headerColor = isSecondTeamTurn ? otherColor : buzzerColor;
        const headerName = isSecondTeamTurn ? otherTeamName : buzzerTeamName;
        const headerPlayer = isSecondTeamTurn ? null : buzzedPlayerName; // no specific player for the "other" team

        return (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${headerColor}55`, background: `linear-gradient(135deg,${headerColor}10,${headerColor}04)` }}>
                {/* Team header — switches to the other team during "second" phase */}
                <div className="px-3 pt-3 pb-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-xl">{isSecondTeamTurn ? "⏳" : "🔔"}</span>
                        <p className="text-base font-black" style={{ color: headerColor }}>{headerName}</p>
                    </div>
                    {headerPlayer && <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-2)" }}> {headerPlayer}</p>}
                </div>

                {/* Timer */}
                {timerPhase && (
                    <div className="mx-3 mb-2 rounded-xl py-2 px-3 flex items-center gap-3" style={{ background: `${activeTimerColor}10`, border: `1px solid ${activeTimerColor}30` }}>
                        <TimerRing
                            seconds={timerSeconds}
                            max={timerPhase === "first" ? buzzerTimerFirst : timerPhase === "second" ? buzzerTimerSecond : 1}
                            color={activeTimerColor}
                        />
                        <div className="flex-1 min-w-0">
                            {timerPhase === "first" && (
                                <>
                                    <p className="font-black text-xl leading-none" style={{ color: buzzerColor }}>{timerSeconds > 0 ? timerSeconds : "0"}</p>
                                    <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>وقت {buzzerTeamName}</p>
                                </>
                            )}
                            {timerPhase === "expired" && (
                                <>
                                    <p className="font-black text-sm" style={{ color: "#ef4444" }}> انتهى الوقت</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>مرر للفريق الآخر</p>
                                </>
                            )}
                            {timerPhase === "second" && (
                                <>
                                    <p className="font-black text-xl leading-none" style={{ color: otherColor }}>{timerSeconds > 0 ? timerSeconds : "0"}</p>
                                    <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>دور {otherTeamName}</p>
                                </>
                            )}
                            {timerPhase === "open" && (
                                <>
                                    <p className="font-black text-sm text-yellow-400"> مفتوح</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>للجميع</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="px-3 pb-3 flex gap-1.5">
                    <button className="flex-1 py-1.5 rounded-xl font-bold text-xs" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-2)", cursor: "pointer" }} onClick={onResetBuzzer}> تعيين</button>
                    {!passedToOtherTeamAt && <button className="flex-1 py-1.5 rounded-xl font-bold text-xs" style={{ background: buzzedTeam === "orange" ? "rgba(34,197,94,0.14)" : "rgba(249,115,22,0.14)", border: `1px solid ${buzzedTeam === "orange" ? "#22c55e40" : "#f9731640"}`, color: buzzedTeam === "orange" ? "#4ade80" : "#fb923c", cursor: "pointer" }} onClick={onPassToOtherTeam}> تمرير</button>}
                    <button className="flex-1 py-1.5 rounded-xl font-bold text-xs" style={{ background: buzzerIsOpenMode ? "rgba(234,179,8,0.22)" : "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.35)", color: "#facc15", cursor: "pointer" }} onClick={onOpenBuzzer}> فتح</button>
                </div>
            </div>
        );
    };

    // 
    // RENDER
    // 

    return (
        <>
            {showBrowser && selectedLetter && (
                <QuestionBrowser
                    letter={selectedLetter}
                    onSelectQuestion={(q) => { onSelectQuestion(q); setShowBrowser(false); }}
                    onClose={() => setShowBrowser(false)}
                    usedQuestionIds={usedQuestionIds}
                />
            )}

            <div className="space-y-3">

                {/*  1. QUESTION  */}
                {renderQuestion()}

                {/*  2. AWARD  */}
                <div className="space-y-1.5">
                    <DivLabel label="منح الخلية" />
                    {renderAward()}
                </div>

                {/*  3. BUZZER  */}
                <div className="space-y-1.5">
                    <DivLabel label="الجرس والمؤقت" />
                    {renderBuzzer()}
                </div>

                {/*  4. PLAYERS  */}
                <Section icon="" title="إدارة اللاعبين" defaultOpen={false} count={players.filter(p => p.role !== "gamemaster").length}>
                    <div className="space-y-1.5">
                        {players.map((p) => {
                            const isOrange = p.role === "teamorange";
                            const isGreen = p.role === "teamgreen";
                            const isGM = p.role === "gamemaster";
                            const isSpectator = p.role === "spectator";
                            const clr = isOrange ? "#fb923c" : isGreen ? "#4ade80" : isGM ? "#d8b4fe" : "var(--text-3)";
                            const isSelected = selectedPlayer === p.id;

                            return (
                                <div key={p.id} className="space-y-1">
                                    <button
                                        className="w-full rounded-xl px-3 py-2 text-xs font-bold transition-all"
                                        style={{
                                            background: isSelected ? "rgba(168,85,247,0.15)" : switchFrom === p.id ? "rgba(234,179,8,0.12)" : "rgba(255,255,255,0.04)",
                                            border: isSelected ? "1px solid rgba(168,85,247,0.35)" : switchFrom === p.id ? "1px solid rgba(234,179,8,0.3)" : "1px solid var(--border)",
                                            color: clr,
                                            textAlign: "right",
                                            cursor: isGM ? "default" : "pointer",
                                        }}
                                        onClick={() => {
                                            if (isGM) return;
                                            if (!switchFrom) { setSwitchFrom(p.id); setSelectedPlayer(p.id); }
                                            else if (switchFrom === p.id) { setSwitchFrom(null); setSelectedPlayer(null); }
                                            else { onSwitchPlayers?.(switchFrom, p.id); setSwitchFrom(null); setSelectedPlayer(null); }
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: isOrange ? "rgba(251,146,60,0.2)" : isGreen ? "rgba(74,222,128,0.2)" : isGM ? "rgba(216,180,254,0.2)" : "rgba(156,163,175,0.2)", border: `1.5px solid ${clr}` }}>
                                                <UserIcon className="w-3 h-3" style={{ color: clr }} />
                                            </div>
                                            <span className="flex-1 truncate text-right">{p.name}</span>
                                            <span className="text-[10px] shrink-0" style={{ color: "var(--text-4)" }}>{isGM ? "GM" : isOrange ? "" : isGreen ? "" : ""}</span>
                                        </div>
                                    </button>

                                    {!isGM && isSelected && (
                                        <div className="flex gap-1 px-1 fade-in-scale flex-wrap">
                                            {isSpectator ? (
                                                <>
                                                    <button className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ background: "rgba(251,146,60,0.2)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)", cursor: "pointer" }} onClick={() => { onMoveSpectatorToTeam?.(p.id, "teamorange"); setSelectedPlayer(null); }}> برتقالي</button>
                                                    <button className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", cursor: "pointer" }} onClick={() => { onMoveSpectatorToTeam?.(p.id, "teamgreen"); setSelectedPlayer(null); }}> أخضر</button>
                                                </>
                                            ) : (
                                                <>
                                                    {isOrange && <button className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", cursor: "pointer" }} onClick={() => { onSwitchPlayerTeam?.(p.id, "teamgreen"); setSelectedPlayer(null); setSwitchFrom(null); }}> أخضر</button>}
                                                    {isGreen && <button className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ background: "rgba(251,146,60,0.2)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)", cursor: "pointer" }} onClick={() => { onSwitchPlayerTeam?.(p.id, "teamorange"); setSelectedPlayer(null); setSwitchFrom(null); }}> برتقالي</button>}
                                                    <button className="flex-1 text-xs py-1.5 rounded-lg font-medium" style={{ background: "rgba(156,163,175,0.15)", color: "var(--text-3)", border: "1px solid rgba(156,163,175,0.25)", cursor: "pointer" }} onClick={() => { onSwitchPlayerTeam?.(p.id, "spectator"); setSelectedPlayer(null); setSwitchFrom(null); }}> مشاهد</button>
                                                </>
                                            )}
                                            <button className="text-xs py-1.5 px-2.5 rounded-lg font-medium" style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }} onClick={() => { onKickPlayer?.(p.id); setSelectedPlayer(null); setSwitchFrom(null); }}></button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {switchFrom && (
                        <div className="text-center pt-1 space-y-1">
                            <p className="text-[10px]" style={{ color: "var(--text-4)" }}>اضغط على لاعب آخر لتبديل موقعيهما</p>
                            <button className="text-[10px] px-3 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }} onClick={() => { setSwitchFrom(null); setSelectedPlayer(null); }}>إلغاء</button>
                        </div>
                    )}
                </Section>

                {/*  5. CONTROLS  */}
                <Section icon="" title="التحكم بالجلسة" defaultOpen={false}>
                    <div className="space-y-2">
                        <button className="w-full py-2.5 rounded-xl font-bold text-sm" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-1)", cursor: "pointer" }} onClick={onNextRound}>
                             الجولة التالية
                        </button>

                        <button
                            className="w-full py-2.5 rounded-xl font-bold text-sm"
                            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15", cursor: "pointer" }}
                            onClick={onSwapTeams}
                        >
                            🔄 تبديل الفرق (برتقالي ↔ أخضر)
                        </button>

                        {confirmReset ? (
                            <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                                <p className="text-xs text-center font-bold" style={{ color: "#f87171" }}> تأكيد إعادة اللعبة</p>
                                <div className="flex gap-2">
                                    <button className="flex-1 py-1.5 rounded-lg text-xs font-black" style={{ background: "#dc2626", color: "#fff", border: "none", cursor: "pointer" }} onClick={() => { onResetGame(); setConfirmReset(false); }}> نعم</button>
                                    <button className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer" }} onClick={() => setConfirmReset(false)}> إلغاء</button>
                                </div>
                            </div>
                        ) : (
                            <button className="w-full py-2 rounded-xl font-bold text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171", cursor: "pointer" }} onClick={() => setConfirmReset(true)}>
                                 إعادة اللعبة من البداية
                            </button>
                        )}

                        <div style={{ height: "1px", background: "var(--border)" }} />

                        {confirmEnd ? (
                            <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.30)" }}>
                                <p className="text-xs text-center font-bold" style={{ color: "#fca5a5" }}> هذا سيطرد جميع اللاعبين!</p>
                                <div className="flex gap-2">
                                    <button className="flex-1 py-1.5 rounded-lg text-xs font-black" style={{ background: "#991b1b", color: "#fff", border: "none", cursor: "pointer" }} onClick={() => { onEndSession(); setConfirmEnd(false); }}> إنهاء</button>
                                    <button className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer" }} onClick={() => setConfirmEnd(false)}> إلغاء</button>
                                </div>
                            </div>
                        ) : (
                            <button className="w-full py-2 rounded-xl font-bold text-xs" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.20)", color: "#fca5a5", cursor: "pointer" }} onClick={() => setConfirmEnd(true)}>
                                 إنهاء الجلسة نهائيا
                            </button>
                        )}
                    </div>
                </Section>

            </div>
        </>
    );
}