import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { invoke, on, startConnection } from "~/lib/signalr";
import { useAuth } from "~/contexts/AuthContext";
import ThemeToggle from "~/components/ThemeToggle";
import Dropdown from "~/components/Dropdown";

interface PlayerDto { id: string; name: string; role: string; }
interface LobbyState { sessionId: string; hostPlayerId: string | null; gridSize: number; totalRounds: number; maxPlayersPerTeam: number; players: PlayerDto[]; }

interface LobbyStateWire {
    SessionId?: string;
    HostPlayerId?: string | null;
    GridSize?: number;
    TotalRounds?: number;
    MaxPlayersPerTeam?: number;
    Players?: Array<{
        Id?: string;
        Name?: string;
        Role?: string;
    }>;
    error?: string;
}

function normalizeLobbyState(state: LobbyState | LobbyStateWire): LobbyState {
    if ("sessionId" in state) {
        return state;
    }

    return {
        sessionId: state.SessionId ?? "",
        hostPlayerId: state.HostPlayerId ?? null,
        gridSize: state.GridSize ?? 5,
        totalRounds: state.TotalRounds ?? 2,
        maxPlayersPerTeam: state.MaxPlayersPerTeam ?? 2,
        players: (state.Players ?? []).map((player) => ({
            id: player.Id ?? "",
            name: player.Name ?? "",
            role: player.Role ?? "spectator"
        }))
    };
}

const ROLE_EMOJI: Record<string, string> = {
    teamorange: "🟠", teamgreen: "🟢", gamemaster: "🎮", spectator: "👀",
};
const ROLE_LABEL: Record<string, string> = {
    teamorange: "برتقالي", teamgreen: "أخضر", gamemaster: "مدير اللعبة", spectator: "مشاهد",
};
const ROLE_CLASS: Record<string, string> = {
    teamorange: "orange", teamgreen: "green", gamemaster: "master", spectator: "",
};

const PLAYER_AVATARS = ["😀", "😎", "🤩", "🥸", "😏", "🤓", "😤", "🥳", "🤑", "😈", "🦊", "🐯", "🦁", "🐻", "🐼", "🐸"];
function getAvatar(name: string) {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    return PLAYER_AVATARS[Math.abs(hash) % PLAYER_AVATARS.length];
}

// User icon SVG as a component
function UserIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg className={className} style={style} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
    );
}

export default function LobbyPage() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading: authLoading, isGuest } = useAuth();
    const [lobby, setLobby] = useState<LobbyState | null>(null);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [myNameDraft, setMyNameDraft] = useState("");
    const [joinName, setJoinName] = useState("");
    const [joinPassword, setJoinPassword] = useState("");
    const [hostRenameId, setHostRenameId] = useState<string | null>(null);
    const [hostRenameDraft, setHostRenameDraft] = useState("");
    const [settingsDraft, setSettingsDraft] = useState({ gridSize: 5, totalRounds: 2, maxPlayersPerTeam: 2 });
    const [needsJoin, setNeedsJoin] = useState(false);
    const [sessionNeedsPassword, setSessionNeedsPassword] = useState(false);
    const [error, setError] = useState("");
    const [connecting, setConnecting] = useState(true);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const loadLobbyState = useCallback(async () => {
        try {
            const state = await invoke<LobbyStateWire>("GetLobbyState");
            if (!state.error) {
                setLobby(normalizeLobbyState(state));
            }
        } catch {
        }
    }, []);

    useEffect(() => {
        if (!sessionId || authLoading) return;
        if (!user) { navigate("/"); return; }
        let cancelled = false;
        const init = async () => {
            try {
                await startConnection();

                // Try to join/rejoin using JWT auth — no password needed initially
                // The backend will use our JWT to identify us
                const name = user.inGameName || "لاعب";
                const result = await invoke<{ success?: boolean; error?: string; playerId?: string }>(
                    "JoinSession", sessionId, null, name
                );
                if (!cancelled) {
                    if (result.error && result.error.includes("not found")) {
                        navigate("/");
                        return;
                    }
                    if (result.error && result.error.includes("password")) {
                        // Session requires a password — show join form
                        setSessionNeedsPassword(true);
                        setNeedsJoin(true);
                        setJoinName(name);
                    } else if (result.success) {
                        setMyPlayerId(result.playerId || null);
                        await loadLobbyState();
                    } else {
                        setError(result.error || "");
                        setNeedsJoin(true);
                        setJoinName(name);
                    }
                }
            } catch { if (!cancelled) setError("فشل الاتصال بالخادم"); }
            if (!cancelled) setConnecting(false);
        };
        init();
        return () => { cancelled = true; };
    }, [sessionId, navigate, loadLobbyState, authLoading, user]);

    useEffect(() => {
        const unsubLobby = on("LobbyUpdated", (state: unknown) => {
            setLobby(normalizeLobbyState(state as LobbyStateWire));
        });
        const unsubLobbyLower = on("lobbyupdated", (state: unknown) => {
            setLobby(normalizeLobbyState(state as LobbyStateWire));
        });
        const unsubGame = on("GameStateUpdated", (state: unknown) => {
            const s = state as { phase: string };
            if (s.phase !== "lobby") navigate(`/game/${sessionId}`);
        });
        const unsubEnd = on("SessionEnded", () => navigate("/"));
        const unsubRemoved = on("RemovedFromSession", () => {
            navigate("/");
        });
        const unsubKicked = on("KickedFromSession", (data: unknown) => {
            const kickData = data as { reason: string };
            navigate("/", { state: { kicked: true, reason: kickData.reason } });
        });
        return () => { unsubLobby(); unsubLobbyLower(); unsubGame(); unsubEnd(); unsubRemoved(); unsubKicked(); };
    }, [sessionId, navigate]);

    // Check if session doesn't exist after connection
    useEffect(() => {
        if (!connecting && !lobby && !needsJoin) {
            // If we're not connecting, not in join mode, and have no lobby data,
            // the session probably doesn't exist
            const timer = setTimeout(() => {
                if (!lobby) {
                    navigate("/");
                }
            }, 2000); // Wait 2 seconds to be sure
            return () => clearTimeout(timer);
        }
    }, [connecting, lobby, needsJoin, navigate]);

    useEffect(() => {
        if (!lobby) return;
        setSettingsDraft({ gridSize: lobby.gridSize, totalRounds: lobby.totalRounds, maxPlayersPerTeam: lobby.maxPlayersPerTeam });
    }, [lobby?.gridSize, lobby?.totalRounds, lobby?.maxPlayersPerTeam]);

    useEffect(() => {
        const currentName = lobby?.players?.find((p) => p.id === myPlayerId)?.name ?? "";
        setMyNameDraft(currentName);
    }, [lobby?.players, myPlayerId]);

    const handleJoinFromLobby = useCallback(async () => {
        if (!sessionId) return;
        const displayName = user?.inGameName || "";
        setError("");
        try {
            const result = await invoke<{ success?: boolean; error?: string; playerId?: string }>(
                "JoinSession", sessionId, joinPassword || null, displayName
            );
            if (result.success) {
                setMyPlayerId(result.playerId || null);
                await loadLobbyState();
                setNeedsJoin(false);
            } else {
                setError(result.error || "");
            }
        } catch (e: any) { setError(e.message || "فشل الاتصال"); }
    }, [sessionId, user?.inGameName, joinPassword, loadLobbyState]);

    const handleSetRole = useCallback(async (role: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("SetRole", role);
            if (!result.success) { setError(result.error || ""); setTimeout(() => setError(""), 3000); }
        } catch (e: any) { setError(e.message); }
    }, []);

    const handleUpdateMyName = useCallback(async () => {
        if (!sessionId || !myNameDraft.trim()) return;
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("UpdateMyName", myNameDraft);
            if (!result.success) {
                setError(result.error || "");
            }
        } catch (e: any) { setError(e.message || ""); }
    }, [sessionId, myNameDraft]);

    const handleLeaveSession = useCallback(async () => {
        try { await invoke("LeaveSession"); }
        catch { }
        navigate("/");
    }, [navigate]);

    const handleHostRename = useCallback(async () => {
        if (!hostRenameId || !hostRenameDraft.trim()) return;
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("RenamePlayer", hostRenameId, hostRenameDraft);
            if (result.success) {
                setHostRenameId(null);
                setHostRenameDraft("");
            } else {
                setError(result.error || "");
            }
        } catch (e: any) { setError(e.message || ""); }
    }, [hostRenameId, hostRenameDraft]);

    const handleKickPlayer = useCallback(async (playerId: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("KickPlayer", playerId);
            if (!result.success) setError(result.error || "");
            else setSelectedPlayerId(null);
        } catch (e: any) { setError(e.message || ""); }
    }, []);

    const handleSwitchTeam = useCallback(async (playerId: string, newRole: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("SwitchPlayerTeam", playerId, newRole);
            if (!result.success) setError(result.error || "");
            else setSelectedPlayerId(null);
        } catch (e: any) { setError(e.message || ""); }
    }, []);

    const handleMoveSpectator = useCallback(async (playerId: string, teamRole: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("MoveSpectatorToTeam", playerId, teamRole);
            if (!result.success) setError(result.error || "");
            else setSelectedPlayerId(null);
        } catch (e: any) { setError(e.message || ""); }
    }, []);

    const handleUpdateSettings = useCallback(async () => {
        try {
            await invoke("UpdateSettings", settingsDraft.gridSize, settingsDraft.totalRounds);
        } catch (e: any) { setError(e.message || ""); }
    }, [settingsDraft]);

    const handleUpdateMaxPlayers = useCallback(async () => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("UpdateMaxPlayersPerTeam", settingsDraft.maxPlayersPerTeam);
            if (!result.success) setError(result.error || "");
        } catch (e: any) { setError(e.message || ""); }
    }, [settingsDraft.maxPlayersPerTeam]);

    const handleStartGame = useCallback(async () => {
        try { await invoke("StartGame", null, null, null, null); }
        catch (e: any) { setError(e.message); }
    }, []);

    const handleEndSession = useCallback(async () => {
        try { await invoke("EndSession"); }
        catch { navigate("/"); }
    }, [navigate]);

    const handleChangePassword = useCallback(async () => {
        if (!sessionId) return;
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("ChangePassword", newPassword || null);
            if (result.success) {
                setNewPassword("");
                setChangingPassword(false);
                setShowPassword(false);
            } else {
                setError(result.error || "");
                setTimeout(() => setError(""), 3000);
            }
        } catch (e: any) {
            setError(e.message || "");
            setTimeout(() => setError(""), 3000);
        }
    }, [sessionId, newPassword]);

    const handleCopySessionId = useCallback(async () => {
        if (!sessionId) return;
        
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(sessionId);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                return;
            } catch (err) {
                console.log('Modern clipboard failed, trying fallback');
            }
        }
        
        // Fallback method for older browsers or non-secure contexts
        try {
            const textArea = document.createElement("textarea");
            textArea.value = sessionId;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                setError("");
                setTimeout(() => setError(""), 3000);
            }
        } catch (err) {
            setError("");
            setTimeout(() => setError(""), 3000);
        }
    }, [sessionId]);

    const players = lobby?.players ?? [];
    const myPlayer = players.find((p) => p.id === myPlayerId);
    const isHost = !!(myPlayerId && lobby?.hostPlayerId === myPlayerId);
    const isGameMaster = myPlayer?.role === "gamemaster";
    const hasGameMaster = players.some((p) => p.role === "gamemaster");
    const canControlGame = isGameMaster; // Only game master can control game
    const orangePlayers = players.filter((p) => p.role === "teamorange");
    const greenPlayers = players.filter((p) => p.role === "teamgreen");
    const spectators = players.filter((p) => p.role === "spectator");

    if (connecting) {
        return (
            <div className="game-bg min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-3 logo-spin">⏳</div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-2)" }}>جاري الاتصال...</p>
                </div>
            </div>
        );
    }

    if (needsJoin) {
        return (
            <div className="game-bg min-h-screen flex items-center justify-center px-4">
                <div className="surface-card w-full max-w-md p-8 text-center fade-in-scale">
                    <div className="text-5xl mb-4">🎮</div>
                    <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-1)" }}>انضمام للجلسة</h2>
                    <p className="text-sm mb-6" style={{ color: "var(--text-3)", direction: "ltr" }}>
                        رمز الجلسة: 
                        <span className="font-black" style={{ color: "var(--accent)" }}>{sessionId}</span>
                        <button 
                            onClick={handleCopySessionId}
                            className="mr-2 p-1 rounded hover:bg-[var(--surface-hover)] transition-all duration-200"
                            title={copied ? "تم النسخ!" : "نسخ الرمز"}
                        >
                            {copied ? (
                                <svg className="w-4 h-4 text-green-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-white/60 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            )}
                        </button>
                    </p>
                    <input
                        type="password" value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        placeholder="كلمة المرور"
                        className="input-field mb-4"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleJoinFromLobby()}
                    />
                    {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                    <button
                        className="btn-primary w-full py-4 text-xl"
                        onClick={handleJoinFromLobby}
                        disabled={!joinPassword.trim()}
                        style={{ opacity: !joinPassword.trim() ? 0.5 : 1 }}
                    >
                        ✅ انضمام
                    </button>
                    <button className="w-full mt-3 text-sm font-semibold" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }} onClick={() => navigate("/")}>
                        ← رجوع
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
{/* Header */}
            <header className="relative bg-[#1a103c] border-b border-[var(--border)]">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25">
                                H
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">حروف</h1>
                                <p className="text-xs text-white/60">لعبة الكلمات</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <button 
                                onClick={handleLeaveSession}
                                className="group relative px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white transition-all duration-200"
                            >
                                <span className="relative z-10">مغادرة</span>
                                <div className="absolute inset-0 bg-red-500/10 rounded-md border border-red-500/20 group-hover:bg-red-500/20 transition-all duration-200"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="relative max-w-6xl mx-auto px-4 py-6">
                {/* Main Content - Compact Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    
                    {/* Left Column - Session Info & Settings */}
                    <div className="lg:col-span-1 space-y-4">
                        
                        {/* Session Status Card */}
                        <div className="surface-card p-4 shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">حالة الجلسة</h2>
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                            <div className="space-y-3">
                                {/* Session ID — visible to everyone */}
                                <div className="flex items-center justify-between py-2 border-b border-white/5">
                                    <span className="text-sm text-white/60">رمز الجلسة</span>
                                    <div className="flex items-center gap-2">
                                        <code className="px-2 py-0.5 rounded-md bg-[var(--surface-hover)] text-white font-mono text-sm font-bold tracking-widest">
                                            {sessionId}
                                        </code>
                                        <button
                                            onClick={handleCopySessionId}
                                            title={copied ? "تم النسخ!" : "نسخ الرمز"}
                                            className="p-1 rounded-md bg-[var(--surface)] hover:bg-white/15 transition-all duration-200"
                                        >
                                            {copied ? (
                                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                    <span className="text-sm text-white/60">اللاعبون المتصلون</span>
                                    <span className="text-sm font-semibold text-white">{players.length}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                    <span className="text-sm text-white/60">حجم الشبكة</span>
                                    <span className="text-sm font-semibold text-white">{lobby?.gridSize ?? 5}×{lobby?.gridSize ?? 5}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-white/60">عدد الجولات</span>
                                    <span className="text-sm font-semibold text-white">{lobby?.totalRounds ?? 2}</span>
                                </div>
                            </div>
                        </div>

                        {/* Game Master Controls */}
                        {canControlGame && (
                            <>
                                {/* Session Info */}
                                <div className="surface-card p-4 shadow-xl">
                                    <h2 className="text-base font-semibold text-white mb-3">معلومات الجلسة</h2>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-white/40 uppercase tracking-wider">اسمك</label>
                                            <div className="mt-1 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={myNameDraft}
                                                    onChange={(e) => setMyNameDraft(e.target.value)}
                                                    onBlur={handleUpdateMyName}
                                                    className="flex-1 px-3 py-1.5 bg-[var(--surface)] rounded-lg text-white placeholder-white/40 text-sm border border-[var(--border)] focus:border-[var(--border-strong)] focus:outline-none"
                                                    placeholder="أدخل اسمك"
                                                />
                                                <button 
                                                    onClick={handleUpdateMyName}
                                                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-xs font-medium"
                                                >
                                                    تحديث
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/40 uppercase tracking-wider">رقم الجلسة</label>
                                            <div className="mt-1 flex items-center gap-2">
                                                <code className="flex-1 px-3 py-1.5 bg-[var(--surface)] rounded-lg text-white font-mono text-sm border border-[var(--border)]">
                                                    {sessionId}
                                                </code>
                                                <button 
                                                    onClick={handleCopySessionId}
                                                    className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all duration-200"
                                                    title={copied ? "تم النسخ!" : "نسخ الرمز"}
                                                >
                                                    {copied ? (
                                                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/40 uppercase tracking-wider">كلمة المرور</label>
                                            <div className="mt-1 flex items-center gap-2">
                                                <code className="flex-1 px-3 py-1.5 bg-[var(--surface)] rounded-lg text-white font-mono text-sm border border-[var(--border)]">
                                                    ••••••••
                                                </code>
                                            </div>
                                            {!changingPassword ? (
                                                <button 
                                                    onClick={() => setChangingPassword(true)}
                                                    className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                                                >
                                                    تغيير كلمة المرور
                                                </button>
                                            ) : (
                                                <div className="mt-2 flex gap-2">
                                                    <input 
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder="كلمة المرور الجديدة"
                                                        className="flex-1 px-3 py-1.5 bg-[var(--surface)] rounded-lg text-white placeholder-white/40 text-sm border border-[var(--border)] focus:border-[var(--border-strong)] focus:outline-none"
                                                    />
                                                    <button 
                                                        onClick={handleChangePassword}
                                                        disabled={!newPassword.trim()}
                                                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 text-xs font-medium"
                                                    >
                                                        حفظ
                                                    </button>
                                                    <button 
                                                        onClick={() => { setChangingPassword(false); setNewPassword(""); }}
                                                        className="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-white rounded-lg transition-all duration-200 border border-[var(--border)] text-xs"
                                                    >
                                                        إلغاء
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Settings */}
                                <div className="surface-card p-4 shadow-xl" style={{ overflow: "visible", zIndex: 50 }}>
                                    <h2 className="text-base font-semibold text-white mb-3">الإعدادات</h2>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-white/40 uppercase tracking-wider">حجم الشبكة</label>
                                            <div className="mt-2">
                                                <Dropdown
                                                    value={settingsDraft.gridSize.toString()}
                                                    onChange={(value) => setSettingsDraft((current) => ({ ...current, gridSize: Number(value) }))}
                                                    options={[
                                                        { value: "4", label: "4×4" },
                                                        { value: "5", label: "5×5" },
                                                        { value: "6", label: "6×6" },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/40 uppercase tracking-wider">عدد الجولات</label>
                                            <div className="mt-2">
                                                <Dropdown
                                                    value={settingsDraft.totalRounds.toString()}
                                                    onChange={(value) => setSettingsDraft((current) => ({ ...current, totalRounds: Number(value) }))}
                                                    options={[
                                                        { value: "2", label: "2 جولة" },
                                                        { value: "3", label: "3 جولات" },
                                                        { value: "4", label: "4 جولات" },
                                                        { value: "5", label: "5 جولات" },
                                                        { value: "6", label: "6 جولات" },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        {isGameMaster && (
                                            <div>
                                                <label className="text-xs text-white/40 uppercase tracking-wider">الحد الأقصى للاعبين في الفريق</label>
                                                <div className="mt-2">
                                                    <Dropdown
                                                        value={settingsDraft.maxPlayersPerTeam.toString()}
                                                        onChange={(value) => setSettingsDraft((current) => ({ ...current, maxPlayersPerTeam: Number(value) }))}
                                                        options={[
                                                            { value: "1", label: "1 لاعب" },
                                                            { value: "2", label: "2 لاعبين" },
                                                            { value: "3", label: "3 لاعبين" },
                                                            { value: "4", label: "4 لاعبين" },
                                                            { value: "5", label: "5 لاعبين" },
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <button className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium" onClick={handleUpdateSettings}>
                                            حفظ الإعدادات
                                        </button>
                                        {isGameMaster && (
                                            <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 text-sm font-medium" onClick={handleUpdateMaxPlayers}>
                                                تحديث الحد الأقصى للاعبين
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Player Profile - Only show for non-host players */}
                        {!isHost && (
                        <div className="surface-card p-4 shadow-xl">
                            <h2 className="text-base font-semibold text-white mb-3">ملفك</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-white/40 uppercase tracking-wider">اسمك</label>
                                    <div className="mt-1 flex gap-2">
                                        <input
                                            type="text"
                                            value={myNameDraft}
                                            onChange={(e) => setMyNameDraft(e.target.value)}
                                            onBlur={handleUpdateMyName}
                                            className="flex-1 px-3 py-1.5 bg-[var(--surface)] rounded-lg text-white placeholder-white/40 text-sm border border-[var(--border)] focus:border-[var(--border-strong)] focus:outline-none"
                                            placeholder="أدخل اسمك"
                                        />
                                        <button 
                                            onClick={handleUpdateMyName}
                                            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-xs font-medium"
                                        >
                                            تحديث
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 uppercase tracking-wider">دورك الحالي</label>
                                    <div className="mt-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{ROLE_EMOJI[myPlayer?.role || ""] || "❓"}</span>
                                            <span className="text-sm font-medium text-white">{ROLE_LABEL[myPlayer?.role || ""] || "غير محدد"}</span>
                                        </div>
                                    </div>
                                </div>
                                {isHost && (
                                    <div>
                                        <label className="text-xs text-white/40 uppercase tracking-wider">اختر دورك</label>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            {Object.entries(ROLE_LABEL).map(([role, label]) => {
                                                const isDisabled = role === "gamemaster" && !isGameMaster;
                                                const isSelected = myPlayer?.role === role;
                                                return (
                                                    <button
                                                        key={role}
                                                        onClick={() => handleSetRole(role)}
                                                        disabled={isDisabled}
                                                        className={`p-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                                                            isSelected
                                                                ? "bg-violet-600 text-white"
                                                                : isDisabled
                                                                ? "opacity-50 cursor-not-allowed bg-[var(--surface)] text-white/40"
                                                                : "bg-[var(--surface)] text-white/80 hover:bg-[var(--surface-hover)]"
                                                        }`}
                                                    >
                                                        <span className="ml-1">{ROLE_EMOJI[role]}</span>
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}
                    </div>

                    {/* Center Column - Players */}
                    <div className="lg:col-span-2">
                        <div className="surface-card p-4 shadow-xl">
                            <h2 className="text-lg font-semibold text-white mb-6">اللاعبون</h2>
                            
                            {/* Teams Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { 
                                        roleId: "teamorange",
                                        label: "الفريق البرتقالي", 
                                        players: orangePlayers, 
                                        color: "from-orange-500 to-red-500",
                                        borderColor: "border-orange-500/20",
                                        bgColor: "bg-orange-500/10",
                                        hoverColor: "hover:border-orange-500/50 hover:bg-orange-500/20"
                                    },
                                    { 
                                        roleId: "teamgreen",
                                        label: "الفريق الأخضر", 
                                        players: greenPlayers, 
                                        color: "from-green-500 to-emerald-500",
                                        borderColor: "border-green-500/20",
                                        bgColor: "bg-green-500/10",
                                        hoverColor: "hover:border-green-500/50 hover:bg-green-500/20"
                                    },
                                    { 
                                        roleId: "gamemaster",
                                        label: "مدير اللعبة", 
                                        players: players.filter((p) => p.role === "gamemaster"), 
                                        color: "from-violet-500 to-purple-500",
                                        borderColor: "border-violet-500/20",
                                        bgColor: "bg-violet-500/10",
                                        hoverColor: "hover:border-violet-500/50 hover:bg-violet-500/20"
                                    },
                                    { 
                                        roleId: "spectator",
                                        label: "المشاهدون", 
                                        players: spectators, 
                                        color: "from-slate-500 to-gray-500",
                                        borderColor: "border-slate-500/20",
                                        bgColor: "bg-slate-500/10",
                                        hoverColor: "hover:border-slate-500/50 hover:bg-slate-500/20"
                                    },
                                ].map((team) => {
                                    const isActive = myPlayer?.role === team.roleId;
                                    const canJoin = !isActive && !(team.roleId === "gamemaster" && hasGameMaster && !isGameMaster);
                                    
                                    return (
                                        <div 
                                            key={team.label} 
                                            className={`rounded-xl border ${team.borderColor} ${team.bgColor} p-4 transition-all duration-300 relative ${
                                                canJoin ? `cursor-pointer ${team.hoverColor} group` : ''
                                            } ${isActive ? 'ring-2 ring-white/20' : ''}`}
                                            onClick={() => {
                                                if (canJoin) handleSetRole(team.roleId);
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className={`text-sm font-semibold bg-gradient-to-r ${team.color} bg-clip-text text-transparent flex items-center gap-2`}>
                                                    {team.label}
                                                    {isActive && <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full font-normal tracking-wide">أنت هنا</span>}
                                                </h3>
                                                {canJoin && (
                                                    <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300 px-2 py-1 rounded-md bg-white/10" style={{ color: "var(--text-1)" }}>
                                                        انضمام
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-2 relative z-10">
                                            {team.players.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className={`group relative rounded-lg bg-[var(--surface)] border border-[var(--border)] p-3 transition-all duration-200 ${
                                                        isHost && p.id !== myPlayerId ? 'cursor-pointer hover:bg-[var(--surface-hover)]' : ''
                                                    }`}
                                                    onClick={(e) => {
                                                        if (isHost && p.id !== myPlayerId) {
                                                            e.stopPropagation();
                                                            setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${team.color} flex items-center justify-center shrink-0`}>
                                                            <UserIcon className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-white truncate">{p.name}</p>
                                                                {lobby?.hostPlayerId === p.id && (
                                                                    <span className="text-yellow-400" title="صاحب الجلسة">👑</span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-white/60">
                                                                {p.id === myPlayerId ? "أنت" : lobby?.hostPlayerId === p.id ? "صاحب الجلسة" : ""}
                                                            </p>
                                                        </div>
                                                        {isGameMaster && p.id !== myPlayerId && (
                                                            <span className="text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {selectedPlayerId === p.id ? '▲' : '▼'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isGameMaster && p.id !== myPlayerId && selectedPlayerId === p.id && (
                                                        <div className="flex gap-2 mt-3 fade-in-scale">
                                                            {isHost && (
                                                                <button
                                                                    className="flex-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setHostRenameId(p.id);
                                                                        setHostRenameDraft(p.name);
                                                                        setSelectedPlayerId(null);
                                                                    }}
                                                                >
                                                                    تعديل
                                                                </button>
                                                            )}
                                                            {p.role === "spectator" ? (
                                                                <>
                                                                    <button
                                                                        className="flex-1 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-medium transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMoveSpectator(p.id, "teamorange");
                                                                        }}
                                                                    >
                                                                        للبرتقالي
                                                                    </button>
                                                                    <button
                                                                        className="flex-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMoveSpectator(p.id, "teamgreen");
                                                                        }}
                                                                    >
                                                                        للأخضر
                                                                    </button>
                                                                </>
                                                            ) : p.role === "teamorange" ? (
                                                                <button
                                                                    className="flex-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSwitchTeam(p.id, "teamgreen");
                                                                    }}
                                                                >
                                                                    للأخضر
                                                                </button>
                                                            ) : p.role === "teamgreen" ? (
                                                                <button
                                                                    className="flex-1 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-xs font-medium transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSwitchTeam(p.id, "teamorange");
                                                                    }}
                                                                >
                                                                    للبرتقالي
                                                                </button>
                                                            ) : null}
                                                            <button
                                                                className="flex-1 px-3 py-1.5 bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 rounded-lg text-xs font-medium transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSwitchTeam(p.id, "spectator");
                                                                }}
                                                            >
                                                                مشاهد
                                                            </button>
                                                            <button
                                                                className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleKickPlayer(p.id);
                                                                    setSelectedPlayerId(null);
                                                                }}
                                                            >
                                                                طرد
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {team.players.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-6 gap-2 text-white/30 border-2 border-dashed border-white/5 rounded-lg transition-colors group-hover:border-white/20 group-hover:text-white/50">
                                                    <UserIcon className="w-6 h-6 mb-1 opacity-50" />
                                                    <p className="text-xs font-medium">لا يوجد لاعبون</p>
                                                    {canJoin && <p className="text-[10px] font-bold mt-1 text-white/50">انقر للانضمام</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            </div>
                        </div>

                        {/* Role Selection */}
                        {myPlayer && (
                            <div className="mt-4 surface-card p-6 shadow-xl">
                                <h2 className="text-lg font-semibold text-white mb-4">اختر دورك</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { key: "teamorange", label: "برتقالي", icon: "🟠", color: "from-orange-500 to-red-500" },
                                        { key: "teamgreen", label: "أخضر", icon: "🟢", color: "from-green-500 to-emerald-500" },
                                        { key: "gamemaster", label: "مدير", icon: "🎮", color: "from-violet-500 to-purple-500", disabled: hasGameMaster && !isGameMaster },
                                        { key: "spectator", label: "مشاهد", icon: "👀", color: "from-slate-500 to-gray-500" },
                                    ].map((role) => {
                                        const active = myPlayer.role === role.key;
                                        return (
                                            <button
                                                key={role.key}
                                                className={`relative px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                                                    role.disabled 
                                                        ? 'opacity-50 cursor-not-allowed' 
                                                        : 'cursor-pointer'
                                                } ${
                                                    active 
                                                        ? `bg-gradient-to-r ${role.color} text-white shadow-lg` 
                                                        : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-white/80 hover:text-white border border-[var(--border)]'
                                                }`}
                                                onClick={() => !role.disabled && handleSetRole(role.key)}
                                                disabled={role.disabled}
                                            >
                                                <div className="text-2xl mb-1">{role.icon}</div>
                                                <div className="text-sm">{role.label}</div>
                                                {active && (
                                                    <div className="absolute inset-0 rounded-xl bg-[var(--surface-active)] animate-pulse"></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Start Game Button */}
                        {canControlGame && lobby && players.length >= 2 && orangePlayers.length >= 1 && greenPlayers.length >= 1 && (
                            <div className="mt-6 text-center">
                                <button 
                                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold text-lg shadow-lg shadow-green-500/25 transition-all duration-200 transform hover:scale-105"
                                    onClick={handleStartGame}
                                >
                                    بدء اللعبة
                                </button>
                            </div>
                        )}
                        
                        {/* Show warning if teams are not balanced */}
                        {canControlGame && lobby && players.length >= 2 && (orangePlayers.length === 0 || greenPlayers.length === 0) && (
                            <div className="mt-6 text-center">
                                <div className="px-6 py-3 bg-yellow-500/20  border border-yellow-500/30 rounded-lg">
                                    <p className="text-yellow-400 text-sm font-medium">
                                        ⚠️ يجب أن يكون هناك لاعب واحد على الأقل في كل فريق لبدء اللعبة
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Display - More Compact */}
            {error && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-red-500/20  border border-red-500/30 rounded-lg text-red-400 text-sm font-medium animate-bounce flex items-center gap-3">
                    <span>{error}</span>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-3 py-1 bg-red-500/30 hover:bg-red-500/40 rounded-md text-xs font-semibold transition-colors"
                    >
                        إعادة المحاولة
                    </button>
                </div>
            )}
        </div>
    );
}
