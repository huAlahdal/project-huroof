import { memo } from "react";
import UserIcon from "./UserIcon";

interface ScoreBoardProps {
    orangeName: string;
    greenName: string;
    orangeScore: number;
    greenScore: number;
    currentRound: number;
    totalRounds: number;
    orangeHexes?: number;
    greenHexes?: number;
    selectedLetter?: string | null;
}

const ScoreBoard = memo(function ScoreBoard({
    orangeName,
    greenName,
    orangeScore,
    greenScore,
    currentRound,
    totalRounds,
    orangeHexes,
    greenHexes,
    selectedLetter,
}: ScoreBoardProps) {
    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Round info + selected letter */}
            <div className="surface-card px-4 py-3 text-center">
                <p className="text-purple-300 text-xs font-semibold uppercase tracking-widest mb-1">الجولة</p>
                <p className="text-white font-black text-2xl">
                    {currentRound} / {totalRounds}
                </p>
                {selectedLetter && (
                    <div className="mt-2 flex items-center justify-center gap-2">
                        <span className="text-xs text-white/40 font-semibold">الحرف المختار</span>
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black text-white"
                            style={{
                                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                boxShadow: "0 0 14px rgba(168,85,247,0.6)",
                            }}
                        >
                            {selectedLetter}
                        </div>
                    </div>
                )}
            </div>

            {/* Team scores */}
            {[
                { name: orangeName, score: orangeScore, team: "orange" as const, hexes: orangeHexes, dir: "← أفقي →" },
                { name: greenName, score: greenScore, team: "green" as const, hexes: greenHexes, dir: "↕ عمودي ↕" },
            ].map((t) => (
                <div key={t.team} className="surface-card px-4 py-4 text-center">
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

                    {/* Hex count pill */}
                    {t.hexes !== undefined && (
                        <div className="mt-2 flex items-center justify-center gap-1">
                            <div
                                className="px-2.5 py-0.5 rounded-full text-xs font-black"
                                style={{
                                    background: t.team === "orange" ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)",
                                    color: t.team === "orange" ? "#fb923c" : "#4ade80",
                                    border: `1px solid ${t.team === "orange" ? "rgba(249,115,22,0.3)" : "rgba(34,197,94,0.3)"}`,
                                }}
                            >
                                {t.hexes} خلية
                            </div>
                        </div>
                    )}

                    <p className="text-white/40 text-xs mt-2">{t.dir}</p>
                </div>
            ))}

            {/* Win condition legend */}
            <div className="surface-card px-4 py-3">
                <p className="text-white/40 text-xs text-center font-semibold mb-2">كيفية الفوز</p>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                        <div className="flex gap-0.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-orange-500 opacity-60" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                        </div>
                        <span className="text-orange-300/80 font-semibold">يربط يميناً ويساراً</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                        <div className="flex flex-col gap-0.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-green-500 opacity-60" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
                        </div>
                        <span className="text-green-300/80 font-semibold">يربط أعلى وأسفل</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ScoreBoard;
