import { memo, useEffect, useCallback } from "react";

interface BuzzerProps {
    team: "orange" | "green" | null;
    playerName: string;
    isLocked: boolean;
    iWon: boolean;
    iLost: boolean;
    isBuzzing: boolean;
    lockReason?: "game" | "no-question";
    onBuzz: () => void;
}

const Buzzer = memo(function Buzzer({
    team,
    playerName,
    isLocked,
    iWon,
    iLost,
    isBuzzing,
    lockReason = "game",
    onBuzz,
}: BuzzerProps) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.code === "Space" || e.code === "Enter") {
            // Don't fire if focus is in an input/textarea/button
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
            e.preventDefault();
            if (!isLocked && !isBuzzing && !iWon && !iLost && team) {
                onBuzz();
            }
        }
    }, [isLocked, isBuzzing, iWon, iLost, team, onBuzz]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);
    const isOrange = team === "orange";
    const primaryColor = isOrange ? "#f97316" : "#22c55e";
    const darkColor = isOrange ? "#ea580c" : "#16a34a";
    const teamLabel = isOrange ? "🟠 الفريق البرتقالي" : "🟢 الفريق الأخضر";

    if (!team) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-5xl mb-4">👀</div>
                    <p className="text-white/50 text-lg font-bold">أنت مُشاهد</p>
                    <p className="text-white/30 text-sm">لا يمكنك الضغط على الجرس</p>
                </div>
            </div>
        );
    }

    if (isLocked && lockReason === "no-question") {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-6xl mb-4">❓</div>
                    <p className="text-white/50 text-lg font-bold">بانتظار اختيار السؤال</p>
                    <p className="text-white/30 text-sm">سيتم تفعيل الجرس عند اختيار حرف وسؤال</p>
                </div>
            </div>
        );
    }

    if (iWon) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center fade-in-scale">
                    <div className="text-8xl mb-4" style={{ animation: "buzzerPulse 0.6s ease-in-out infinite" }}>🎉</div>
                    <p className="text-white text-3xl font-black">أنت الأول!</p>
                    <p className="text-white/60 text-lg mt-2">بانتظار قرار المقدم...</p>
                </div>
            </div>
        );
    }

    if (iLost) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center fade-in-scale">
                    <div className="text-7xl mb-4 opacity-50">😔</div>
                    <p className="text-white/60 text-2xl font-black">الفريق الآخر كان أسرع</p>
                    <p className="text-white/40 text-base mt-2">انتظر السؤال التالي</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
            {/* Player info */}
            <div className="text-center">
                <p className="text-lg font-bold" style={{ color: primaryColor }}>{teamLabel}</p>
                <p className="text-white font-black text-xl">🎮 {playerName}</p>
            </div>

            {/* Buzzer button */}
            <button
                onClick={onBuzz}
                disabled={isLocked || isBuzzing}
                className="relative"
                style={{ touchAction: "manipulation" }}
            >
                {/* Outer glow ring */}
                <div
                    className={!isLocked ? "buzzer-ripple" : ""}
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        background: `radial-gradient(circle, ${primaryColor}40 0%, transparent 70%)`,
                        transform: "scale(1.5)",
                        opacity: isLocked ? 0.2 : undefined,
                    }}
                />

                {/* Main buzzer circle */}
                <div
                    className={!isLocked ? "buzzer-ready" : ""}
                    style={{
                        position: "relative",
                        width: "14rem",
                        height: "14rem",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isLocked
                            ? "linear-gradient(145deg, #555 0%, #333 100%)"
                            : `linear-gradient(145deg, ${primaryColor} 0%, ${darkColor} 100%)`,
                        boxShadow: isLocked
                            ? "0 8px 32px rgba(0,0,0,0.4), inset 0 -4px 12px rgba(0,0,0,0.3)"
                            : `0 8px 48px ${primaryColor}80, inset 0 -4px 12px rgba(0,0,0,0.3), 0 0 100px ${primaryColor}30`,
                        border: `4px solid ${isLocked ? "#666" : primaryColor}`,
                        color: primaryColor,
                        transition: "all 0.3s ease",
                        cursor: isLocked ? "not-allowed" : "pointer",
                    }}
                >
                    <div className="text-center">
                        <span className="text-white text-6xl font-black block">
                            {isLocked ? "🔒" : "🔔"}
                        </span>
                        <span className="text-white text-xl font-black block mt-2">
                            {isLocked ? "مقفل" : "اضغط!"}
                        </span>
                    </div>
                </div>
            </button>

            <p className="text-white/30 text-xs">
                {isOrange ? "← يربط أفقياً →" : "↑ يربط عمودياً ↓"}
            </p>
            {!isLocked && !iWon && !iLost && (
                <p className="text-white/20 text-[10px]">Space / Enter للضغط بلوحة المفاتيح</p>
            )}
        </div>
    );
});

export default Buzzer;
