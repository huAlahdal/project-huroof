import { memo, useMemo } from "react";

interface PlayerDto {
    id: string;
    name: string;
    role: string;
}

interface PlayerListProps {
    players: PlayerDto[];
    showTitle?: boolean;
}

// User icon component
function UserIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg className={className} style={style} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
    );
}

const ROLE_EMOJI: Record<string, string> = {
    teamorange: "🟠",
    teamgreen: "🟢",
    gamemaster: "🎮",
    spectator: "👀",
};

const ROLE_LABEL: Record<string, string> = {
    teamorange: "الفريق البرتقالي",
    teamgreen: "الفريق الأخضر",
    gamemaster: "مدير اللعبة",
    spectator: "مشاهد",
};

const PlayerList = memo(function PlayerList({ players, showTitle = true }: PlayerListProps) {
    const orangePlayers = useMemo(() => players.filter((p) => p.role === "teamorange"), [players]);
    const greenPlayers = useMemo(() => players.filter((p) => p.role === "teamgreen"), [players]);
    const spectators = useMemo(() => players.filter((p) => p.role === "spectator"), [players]);
    const gameMaster = useMemo(() => players.find((p) => p.role === "gamemaster"), [players]);

    return (
        <div className="space-y-3">
            {showTitle && <h3 className="text-sm font-semibold text-white/80 mb-2">اللاعبون</h3>}
            
            {gameMaster && (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{
                             background: "rgba(216, 180, 254, 0.2)",
                             border: "1px solid #d8b4fe",
                         }}
                    >
                        <UserIcon className="w-3 h-3" style={{ color: "#d8b4fe" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-purple-400/70 mb-1">{ROLE_LABEL.gamemaster}</p>
                        <div 
                            className="px-2 py-1 rounded-md text-xs font-medium truncate"
                            style={{
                                background: "rgba(216, 180, 254, 0.15)",
                                border: "1px solid rgba(216, 180, 254, 0.3)",
                                color: "#d8b4fe"
                            }}
                        >
                            {gameMaster.name}
                        </div>
                    </div>
                </div>
            )}

            {orangePlayers.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs text-orange-400 font-semibold mb-2">{ROLE_LABEL.teamorange}</p>
                    {orangePlayers.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                 style={{
                                     background: "rgba(251, 146, 60, 0.2)",
                                     border: "1px solid #fb923c",
                                 }}
                            >
                                <UserIcon className="w-3 h-3" style={{ color: "#fb923c" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div 
                                    className="px-2 py-1 rounded-md text-xs font-medium truncate"
                                    style={{
                                        background: "rgba(251, 146, 60, 0.15)",
                                        border: "1px solid rgba(251, 146, 60, 0.3)",
                                        color: "#fb923c"
                                    }}
                                >
                                    {p.name}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {greenPlayers.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs text-green-400 font-semibold mb-2">{ROLE_LABEL.teamgreen}</p>
                    {greenPlayers.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                 style={{
                                     background: "rgba(74, 222, 128, 0.2)",
                                     border: "1px solid #4ade80",
                                 }}
                            >
                                <UserIcon className="w-3 h-3" style={{ color: "#4ade80" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div 
                                    className="px-2 py-1 rounded-md text-xs font-medium truncate"
                                    style={{
                                        background: "rgba(74, 222, 128, 0.15)",
                                        border: "1px solid rgba(74, 222, 128, 0.3)",
                                        color: "#4ade80"
                                    }}
                                >
                                    {p.name}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {spectators.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-semibold mb-2">{ROLE_LABEL.spectator}</p>
                    {spectators.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                 style={{
                                     background: "rgba(156, 163, 175, 0.2)",
                                     border: "1px solid #9ca3af",
                                 }}
                            >
                                <UserIcon className="w-3 h-3" style={{ color: "#9ca3af" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div 
                                    className="px-2 py-1 rounded-md text-xs font-medium truncate"
                                    style={{
                                        background: "rgba(156, 163, 175, 0.15)",
                                        border: "1px solid rgba(156, 163, 175, 0.3)",
                                        color: "#9ca3af"
                                    }}
                                >
                                    {p.name}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default PlayerList;
