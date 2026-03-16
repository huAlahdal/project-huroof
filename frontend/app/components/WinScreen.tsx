import { useState, useEffect } from "react";

interface WinScreenProps {
    phase: string;
    roundWinner: string | null;
    orangeName: string;
    greenName: string;
    orangeScore: number;
    greenScore: number;
    currentRound: number;
    totalRounds: number;
    isGameMaster: boolean;
    onNextRound: () => void;
    onRestart: () => void;
}

const CONFETTI_COLORS = ["#f97316", "#22c55e", "#a855f7", "#f59e0b", "#3b82f6"];

function Confetti() {
    const [particles] = useState(() =>
        Array.from({ length: 40 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: CONFETTI_COLORS[Math.floor(Math.random() * 5)],
            delay: Math.random() * 1.5,
            duration: 1.5 + Math.random() * 1.5,
            size: 8 + Math.random() * 10,
        }))
    );

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-sm confetti-particle"
                    style={{
                        left: `${p.x}%`,
                        top: "0%",
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        "--delay": `${p.delay}s`,
                        "--duration": `${p.duration}s`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}

export default function WinScreen({
    phase,
    roundWinner,
    orangeName,
    greenName,
    orangeScore,
    greenScore,
    currentRound,
    totalRounds,
    isGameMaster,
    onNextRound,
    onRestart,
}: WinScreenProps) {
    const [showDetails, setShowDetails] = useState(false);

    const isRoundEnd = phase === "betweenrounds";
    const isFinalEnd = phase === "win";
    const isTiebreaker = isRoundEnd && currentRound >= totalRounds && orangeScore === greenScore;

    useEffect(() => {
        if (isRoundEnd || isFinalEnd) {
            const t = setTimeout(() => setShowDetails(true), 800);
            return () => clearTimeout(t);
        }
        setShowDetails(false);
    }, [isRoundEnd, isFinalEnd]);

    if (!isRoundEnd && !isFinalEnd) return null;

    const winnerName = roundWinner === "orange" ? orangeName : roundWinner === "green" ? greenName : null;
    const isDraw = roundWinner === "draw";
    const winnerColor = roundWinner === "orange" ? "#f97316" : "#22c55e";

    const finalWinner = isFinalEnd
        ? orangeScore > greenScore
            ? orangeName
            : greenScore > orangeScore
                ? greenName
                : null
        : null;

    const finalWinnerColor = isFinalEnd
        ? orangeScore > greenScore ? "#f97316" : "#22c55e"
        : "#a855f7";

    return (
        <>
            <Confetti />
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 flex items-center justify-center px-4">
                <div className="glass-card w-full max-w-lg p-8 text-center shadow-2xl fade-in-scale">
                    {/* Trophy */}
                    <div className="text-7xl mb-4 logo-spin">
                        {isTiebreaker ? "⚔️" : isDraw ? "🤝" : "🏆"}
                    </div>

                    {/* Title */}
                    {isTiebreaker ? (
                        <>
                            <h1 className="text-3xl font-black text-yellow-400 mb-2">تعادل! ⚡</h1>
                            <p className="text-white/70 text-lg font-semibold mb-1">
                                النتيجة {orangeScore} - {greenScore}
                            </p>
                            <p className="text-white/50 text-base">نحتاج جولة فاصلة لتحديد الفائز!</p>
                        </>
                    ) : isDraw ? (
                        <h1 className="text-3xl font-black text-white mb-2">تعادل!</h1>
                    ) : (
                        <>
                            <p className="text-purple-300 font-semibold text-lg">
                                {isRoundEnd ? `الجولة ${currentRound}` : "اللعبة انتهت!"}
                            </p>
                            <h1
                                className="text-4xl font-black mb-1 mt-1"
                                style={{
                                    color: isFinalEnd ? finalWinnerColor : winnerColor,
                                    textShadow: `0 0 20px ${isFinalEnd ? finalWinnerColor : winnerColor}`,
                                }}
                            >
                                {isFinalEnd && finalWinner ? finalWinner : winnerName}
                            </h1>
                            <p className="text-white/70 text-xl font-semibold mb-4">
                                {isRoundEnd ? "فاز بهذه الجولة! 🎉" : "يفوز باللعبة! 🎊"}
                            </p>
                        </>
                    )}

                    {/* Scores */}
                    {showDetails && (
                        <div className="flex justify-center gap-6 my-6 fade-in">
                            {[
                                { name: orangeName, score: orangeScore, color: "#f97316" },
                                { name: greenName, score: greenScore, color: "#22c55e" },
                            ].map((t) => (
                                <div key={t.name} className="flex flex-col items-center gap-2">
                                    <div className="score-badge" style={{ color: t.color }}>
                                        {t.score}
                                    </div>
                                    <span className="text-white/70 text-sm font-semibold">{t.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Buttons — only for game master */}
                    {showDetails && isGameMaster && (
                        <div className="flex gap-3 justify-center flex-wrap fade-in">
                            {isTiebreaker && (
                                <button
                                    className="px-6 py-3 rounded-xl font-black text-white text-base"
                                    style={{
                                        background: "linear-gradient(135deg, #eab308, #ca8a04)",
                                        boxShadow: "0 4px 20px rgba(234,179,8,0.4)",
                                    }}
                                    onClick={onNextRound}
                                >
                                    ⚔️ الجولة الفاصلة
                                </button>
                            )}
                            {isRoundEnd && !isTiebreaker && currentRound < totalRounds && (
                                <button
                                    className="px-6 py-3 rounded-xl font-black text-white text-base"
                                    style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                                    onClick={onNextRound}
                                >
                                    الجولة التالية ▶
                                </button>
                            )}
                            <button
                                className="px-6 py-3 rounded-xl font-black text-white text-base bg-white/10 hover:bg-white/15 transition-colors"
                                onClick={onRestart}
                            >
                                🔄 العب مجدداً
                            </button>
                        </div>
                    )}

                    {/* Non-GM waiting message */}
                    {showDetails && !isGameMaster && (
                        <p className="text-white/40 text-sm fade-in">بانتظار قرار مدير اللعبة...</p>
                    )}
                </div>
            </div>
        </>
    );
}
