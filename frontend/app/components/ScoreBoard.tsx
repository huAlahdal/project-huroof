import { memo } from "react";
import UserIcon from "./UserIcon";

interface ScoreBoardProps {
    orangeName: string;
    greenName: string;
    orangeScore: number;
    greenScore: number;
    currentRound: number;
    totalRounds: number;
}

const ScoreBoard = memo(function ScoreBoard({
    orangeName,
    greenName,
    orangeScore,
    greenScore,
    currentRound,
    totalRounds,
}: ScoreBoardProps) {
    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Round info */}
            <div className="glass-card px-4 py-3 text-center">
                <p className="text-purple-300 text-xs font-semibold uppercase tracking-widest mb-1">الجولة</p>
                <p className="text-white font-black text-2xl">
                    {currentRound} / {totalRounds}
                </p>
            </div>

            {/* Team scores */}
            {[
                { name: orangeName, score: orangeScore, team: "orange" as const },
                { name: greenName, score: greenScore, team: "green" as const },
            ].map((t) => (
                <div key={t.team} className="glass-card px-4 py-4 text-center">
                    <div
                        className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-white text-base"
                        style={{
                            background:
                                t.team === "orange"
                                    ? "linear-gradient(135deg, #f97316, #ea580c)"
                                    : "linear-gradient(135deg, #22c55e, #16a34a)",
                            boxShadow: `0 0 14px ${t.team === "orange" ? "rgba(249,115,22,0.5)" : "rgba(34,197,94,0.5)"}`,
                        }}
                    >
                        <UserIcon className="w-5 h-5" />
                    </div>
                    <p
                        className="font-black text-base leading-tight"
                        style={{ color: t.team === "orange" ? "#fb923c" : "#4ade80" }}
                    >
                        {t.name}
                    </p>
                    <p className="text-white font-black text-3xl mt-1">{t.score}</p>
                    <p className="text-white/40 text-xs mt-1">
                        {t.team === "orange" ? "← أفقي →" : "↕ عمودي ↕"}
                    </p>
                </div>
            ))}

            {/* Win condition legend */}
            <div className="glass-card px-4 py-3">
                <p className="text-white/40 text-xs text-center font-semibold mb-2">كيفية الفوز</p>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-orange-500 shrink-0" />
                        <span className="text-white/60">يربط يميناً ويساراً</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-green-500 shrink-0" />
                        <span className="text-white/60">يربط أعلى وأسفل</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ScoreBoard;
