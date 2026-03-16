interface ChangeTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    cellId: string;
    currentOwner: "orange" | "green";
    currentTeamName: string;
    orangeTeamName: string;
    greenTeamName: string;
    onChangeTeam: (cellId: string, newTeam: "orange" | "green") => void;
}

export default function ChangeTeamModal({
    isOpen,
    onClose,
    cellId,
    currentOwner,
    currentTeamName,
    orangeTeamName,
    greenTeamName,
    onChangeTeam,
}: ChangeTeamModalProps) {
    if (!isOpen) return null;

    const handleTeamChange = (newTeam: "orange" | "green") => {
        onChangeTeam(cellId, newTeam);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative glass-card p-6 max-w-md w-full mx-4 fade-in-scale">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                    <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="mb-6">
                    <h3 className="text-xl font-black text-white mb-2">تغيير ملكية الخلية</h3>
                    <p className="text-white/60 text-sm">
                        الخلية {cellId} حالياً تابعة لـ
                        <span 
                            className="font-bold mr-1"
                            style={{ 
                                color: currentOwner === "orange" ? "#fb923c" : "#4ade80" 
                            }}
                        >
                            {currentTeamName}
                        </span>
                    </p>
                </div>

                {/* Team options */}
                <div className="space-y-3">
                    {/* Orange team option */}
                    <button
                        onClick={() => handleTeamChange("orange")}
                        disabled={currentOwner === "orange"}
                        className={`w-full p-4 rounded-xl border-2 transition-all ${
                            currentOwner === "orange"
                                ? "border-orange-500/30 bg-orange-500/10 cursor-not-allowed opacity-50"
                                : "border-orange-500/50 hover:border-orange-400 hover:bg-orange-500/10 hover:scale-[1.02]"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: "linear-gradient(135deg, #f97316, #ea580c)",
                                        boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)",
                                    }}
                                >
                                    <span className="text-2xl font-bold text-white">🟠</span>
                                </div>
                                <div className="text-right">
                                    <p 
                                        className="font-bold text-lg"
                                        style={{ color: "#fb923c" }}
                                    >
                                        الفريق البرتقالي
                                    </p>
                                    <p className="text-white/60 text-sm">{orangeTeamName}</p>
                                </div>
                            </div>
                            {currentOwner === "orange" && (
                                <span className="text-orange-400 text-sm font-semibold">الحالي</span>
                            )}
                        </div>
                    </button>

                    {/* Green team option */}
                    <button
                        onClick={() => handleTeamChange("green")}
                        disabled={currentOwner === "green"}
                        className={`w-full p-4 rounded-xl border-2 transition-all ${
                            currentOwner === "green"
                                ? "border-green-500/30 bg-green-500/10 cursor-not-allowed opacity-50"
                                : "border-green-500/50 hover:border-green-400 hover:bg-green-500/10 hover:scale-[1.02]"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                        boxShadow: "0 0 20px rgba(34, 197, 94, 0.4)",
                                    }}
                                >
                                    <span className="text-2xl font-bold text-white">🟢</span>
                                </div>
                                <div className="text-right">
                                    <p 
                                        className="font-bold text-lg"
                                        style={{ color: "#4ade80" }}
                                    >
                                        الفريق الأخضر
                                    </p>
                                    <p className="text-white/60 text-sm">{greenTeamName}</p>
                                </div>
                            </div>
                            {currentOwner === "green" && (
                                <span className="text-green-400 text-sm font-semibold">الحالي</span>
                            )}
                        </div>
                    </button>
                </div>

                {/* Cancel button */}
                <button
                    onClick={onClose}
                    className="w-full mt-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/70 hover:text-white font-semibold"
                >
                    إلغاء
                </button>
            </div>
        </div>
    );
}
