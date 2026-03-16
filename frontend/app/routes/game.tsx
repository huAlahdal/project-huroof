import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { invoke, on, startConnection } from "~/lib/signalr";
import { fetchRandomQuestion } from "~/lib/questions";
import type { Question } from "~/lib/questions";
import type { HexCell } from "~/lib/hexUtils";
import HexGrid from "~/components/HexGrid";
import ScoreBoard from "~/components/ScoreBoard";
import Buzzer from "~/components/Buzzer";
import GameMasterPanel from "~/components/GameMasterPanel";
import WinScreen from "~/components/WinScreen";
import PlayerList from "~/components/PlayerList";
import Dropdown from "~/components/Dropdown";
import ChangeTeamModal from "~/components/ChangeTeamModal";

// ─── Types ──────────────────────────────────────────────────

interface PlayerDto {
    id: string;
    name: string;
    role: string;
}

interface BuzzerState {
    buzzedTeam: string | null;
    buzzedAt: number | null;
    buzzedPlayerName: string | null;
    buzzedPlayerId: string | null;
    buzzerLocked: boolean;
    buzzerTimerFirst: number;
    buzzerTimerSecond: number;
    passedToOtherTeamAt: number | null;
    buzzerIsOpenMode: boolean;
    remainingSeconds: number | null;
    timerPhase: string | null;
}

interface SelectedQuestion {
    letter: string | null;
    questionText: string | null;
    answerText: string | null;
    category: string | null;
    difficulty: string | null;
    showQuestion: boolean;
}

interface GameState {
    sessionId: string;
    gridSize: number;
    totalRounds: number;
    currentRound: number;
    maxPlayersPerTeam: number;
    phase: string;
    grid: HexCell[][];
    players: PlayerDto[];
    orangeScore: number;
    greenScore: number;
    selectedCellId: string | null;
    question: SelectedQuestion;
    buzzer: BuzzerState;
    roundWinner: string | null;
    version: number;
}

interface GameStateWire {
    SessionId?: string;
    GridSize?: number;
    TotalRounds?: number;
    CurrentRound?: number;
    MaxPlayersPerTeam?: number;
    Phase?: string;
    Grid?: Array<Array<{
        Id?: string;
        Row?: number;
        Col?: number;
        Letter?: string;
        Owner?: string | null;
        IsSelected?: boolean;
    }>>;
    Players?: Array<{ Id?: string; Name?: string; Role?: string }>;
    OrangeScore?: number;
    GreenScore?: number;
    SelectedCellId?: string | null;
    Question?: {
        Letter?: string | null;
        QuestionText?: string | null;
        AnswerText?: string | null;
        Category?: string | null;
        Difficulty?: string | null;
        ShowQuestion?: boolean;
    };
    Buzzer?: {
        BuzzedTeam?: string | null;
        BuzzedAt?: number | null;
        BuzzedPlayerName?: string | null;
        BuzzedPlayerId?: string | null;
        BuzzerLocked?: boolean;
        BuzzerTimerFirst?: number;
        BuzzerTimerSecond?: number;
        PassedToOtherTeamAt?: number | null;
        BuzzerIsOpenMode?: boolean;
        RemainingSeconds?: number | null;
        TimerPhase?: string | null;
    };
    RoundWinner?: string | null;
    Version?: number;
}

const EMPTY_BUZZER_STATE: BuzzerState = {
    buzzedTeam: null,
    buzzedAt: null,
    buzzedPlayerName: null,
    buzzedPlayerId: null,
    buzzerLocked: false,
    buzzerTimerFirst: 0,
    buzzerTimerSecond: 0,
    passedToOtherTeamAt: null,
    buzzerIsOpenMode: false,
    remainingSeconds: null,
    timerPhase: null,
};

const EMPTY_SELECTED_QUESTION: SelectedQuestion = {
    letter: null,
    questionText: null,
    answerText: null,
    category: null,
    difficulty: null,
    showQuestion: false,
};

function normalizeGameState(state: GameState | GameStateWire): GameState {
    if ("sessionId" in state) {
        return {
            ...state,
            question: state.question ?? EMPTY_SELECTED_QUESTION,
            buzzer: state.buzzer ?? EMPTY_BUZZER_STATE,
            players: state.players ?? [],
            grid: state.grid ?? [],
        };
    }

    return {
        sessionId: state.SessionId ?? "",
        gridSize: state.GridSize ?? 5,
        totalRounds: state.TotalRounds ?? 2,
        currentRound: state.CurrentRound ?? 1,
        maxPlayersPerTeam: state.MaxPlayersPerTeam ?? 2,
        phase: state.Phase?.toLowerCase() ?? "lobby",
        grid: (state.Grid ?? []).map((row) =>
            row.map((cell) => ({
                id: cell.Id ?? "",
                row: cell.Row ?? 0,
                col: cell.Col ?? 0,
                letter: cell.Letter ?? "",
                owner: cell.Owner === "orange" || cell.Owner === "green" ? cell.Owner : null,
                isSelected: cell.IsSelected ?? false,
            }))
        ),
        players: (state.Players ?? []).map((player) => ({
            id: player.Id ?? "",
            name: player.Name ?? "",
            role: player.Role ?? "spectator",
        })),
        orangeScore: state.OrangeScore ?? 0,
        greenScore: state.GreenScore ?? 0,
        selectedCellId: state.SelectedCellId ?? null,
        question: {
            letter: state.Question?.Letter ?? null,
            questionText: state.Question?.QuestionText ?? null,
            answerText: state.Question?.AnswerText ?? null,
            category: state.Question?.Category ?? null,
            difficulty: state.Question?.Difficulty ?? null,
            showQuestion: state.Question?.ShowQuestion ?? false,
        },
        buzzer: {
            buzzedTeam: state.Buzzer?.BuzzedTeam ?? null,
            buzzedAt: state.Buzzer?.BuzzedAt ?? null,
            buzzedPlayerName: state.Buzzer?.BuzzedPlayerName ?? null,
            buzzedPlayerId: state.Buzzer?.BuzzedPlayerId ?? null,
            buzzerLocked: state.Buzzer?.BuzzerLocked ?? false,
            buzzerTimerFirst: state.Buzzer?.BuzzerTimerFirst ?? 0,
            buzzerTimerSecond: state.Buzzer?.BuzzerTimerSecond ?? 0,
            passedToOtherTeamAt: state.Buzzer?.PassedToOtherTeamAt ?? null,
            buzzerIsOpenMode: state.Buzzer?.BuzzerIsOpenMode ?? false,
            remainingSeconds: state.Buzzer?.RemainingSeconds ?? null,
            timerPhase: state.Buzzer?.TimerPhase?.toLowerCase() ?? null,
        },
        roundWinner: state.RoundWinner ?? null,
        version: state.Version ?? 0,
    };
}

// ─── Component ──────────────────────────────────────────────

export default function GamePage() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState<GameState | null>(null);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState("");
    const [changeTeamModal, setChangeTeamModal] = useState<{
        isOpen: boolean;
        cellId: string;
        currentOwner: "orange" | "green";
    }>({ isOpen: false, cellId: "", currentOwner: "orange" });

    // Buzzer local state
    const [buzzerResult, setBuzzerResult] = useState<"first" | "late" | null>(null);
    const [isBuzzing, setIsBuzzing] = useState(false);

    // Timer state
    const [timerPhase, setTimerPhase] = useState<"first" | "second" | "expired" | "open" | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerPosition, setTimerPosition] = useState<"bottom-left" | "bottom-center" | "bottom-right" | "top-left" | "top-center" | "top-right">("top-center");

    // Sound effects
    const playBuzzerSound = useCallback(() => {
        try {
            const audio = new Audio('/buzzer.mp3');
            audio.volume = 0.3;
            
            // Handle errors when file is not found or cannot be played
            audio.addEventListener('error', () => {
                console.log('Buzzer sound file not found or cannot be played');
            });
            
            audio.play().catch((error) => {
                console.log('Failed to play buzzer sound:', error);
            });
        } catch (error) {
            console.log('Error creating buzzer audio:', error);
        }
    }, []);

    const playTimerEndSound = useCallback(() => {
        try {
            const audio = new Audio('/timer-end.mp3');
            audio.volume = 0.5;
            
            // Handle errors when file is not found or cannot be played
            audio.addEventListener('error', () => {
                console.log('Timer end sound file not found or cannot be played');
            });
            
            audio.play().catch((error) => {
                console.log('Failed to play timer end sound:', error);
            });
        } catch (error) {
            console.log('Error creating timer end audio:', error);
        }
    }, []);

    // ─── Connection Setup ────────────────────────────────────

    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        const init = async () => {
            try {
                await startConnection();

                const storedPass = sessionStorage.getItem(`huroof_pass_${sessionId}`);
                const storedName = sessionStorage.getItem(`huroof_name_${sessionId}`);
                const storedPlayerId = sessionStorage.getItem(`huroof_playerId_${sessionId}`);

                if (storedPass && storedName) {
                    const result = await invoke<{ success?: boolean; error?: string; playerId?: string }>(
                        "JoinSession", sessionId, storedPass, storedName
                    );
                    if (!cancelled) {
                        if (result.error && result.error.includes("not found")) {
                            // Session not found, redirect to home
                            navigate("/");
                            return;
                        }
                        if (result.success) {
                            setMyPlayerId(result.playerId || storedPlayerId || null);
                            setConnected(true);
                        } else {
                            // Show error message and let user try to rejoin
                            setError(result.error || "فشل الانضمام للجلسة");
                        }
                    }
                }

                if (!cancelled && !storedPass) {
                    navigate("/");
                }
            } catch {
                if (!cancelled) navigate("/");
            }
        };

        init();
        return () => { cancelled = true; };
    }, [sessionId, navigate]);

    // ─── SignalR Events ──────────────────────────────────────

    useEffect(() => {
        const unsubGame = on("GameStateUpdated", (s: unknown) => {
            const gs = normalizeGameState(s as GameStateWire);
            setState(gs);

            // If game reset to lobby, go back
            if (gs.phase === "lobby") {
                navigate(`/lobby/${sessionId}`);
            }
        });

        const unsubLobby = on("LobbyUpdated", () => {
            navigate(`/lobby/${sessionId}`);
        });

        // Session ended by GM — everyone goes home
        const unsubEnd = on("SessionEnded", () => {
            navigate("/");
        });

        // Player was kicked
        const unsubKicked = on("KickedFromSession", (data: unknown) => {
            const kickData = data as { reason: string };
            if (sessionId) {
                sessionStorage.removeItem(`huroof_name_${sessionId}`);
                sessionStorage.removeItem(`huroof_playerId_${sessionId}`);
                sessionStorage.removeItem(`huroof_creator_${sessionId}`);
                sessionStorage.removeItem(`huroof_pass_${sessionId}`);
            }
            navigate("/", { state: { kicked: true, reason: kickData.reason } });
        });

        return () => { unsubGame(); unsubLobby(); unsubEnd(); unsubKicked(); };
    }, [sessionId, navigate]);

    // Check if session doesn't exist after connection
    useEffect(() => {
        if (connected && !state && !error) {
            // If we're connected but have no game state after 5 seconds,
            // and no error message, the session probably doesn't exist
            const timer = setTimeout(() => {
                if (!state && !error) {
                    navigate("/");
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [connected, state, error, navigate]);

    // ─── Buzzer Result Detection ─────────────────────────────

    useEffect(() => {
        if (!state) return;

        if (state.buzzer.buzzedPlayerId === myPlayerId && state.buzzer.buzzerLocked) {
            setBuzzerResult("first");
            setIsBuzzing(false);
        } else if (state.buzzer.buzzerLocked && buzzerResult !== "first") {
            if (isBuzzing) {
                setBuzzerResult("late");
                setIsBuzzing(false);
            }
        }

        if (!state.buzzer.buzzerLocked && buzzerResult) {
            setBuzzerResult(null);
        }
    }, [state?.buzzer.buzzerLocked, state?.buzzer.buzzedPlayerId, myPlayerId]);

    // ─── Timer Countdown ─────────────────────────────────────

    useEffect(() => {
        // Use server-provided timer state if available
        if (state?.buzzer.timerPhase && state?.buzzer.remainingSeconds !== null) {
            const newPhase = state.buzzer.timerPhase as "first" | "second" | "expired" | "open";
            const prevPhase = timerPhase;
            
            setTimerPhase(newPhase);
            setTimerSeconds(state.buzzer.remainingSeconds);
            
            // Play sound when timer expires
            if (prevPhase !== "expired" && newPhase === "expired") {
                playTimerEndSound();
            }
            
            // Set up interval to decrement locally for smooth countdown
            if (state.buzzer.remainingSeconds > 0 && (state.buzzer.timerPhase === "first" || state.buzzer.timerPhase === "second")) {
                const id = setInterval(() => {
                    setTimerSeconds(prev => {
                        const newVal = Math.max(0, prev - 1);
                        if (newVal === 0 && prev > 0) {
                            playTimerEndSound();
                        }
                        return newVal;
                    });
                }, 1000);
                return () => clearInterval(id);
            }
        } else {
            setTimerPhase(null);
            setTimerSeconds(0);
        }
    }, [state?.buzzer.timerPhase, state?.buzzer.remainingSeconds, state?.buzzer.buzzedAt, state?.buzzer.passedToOtherTeamAt, playTimerEndSound]);

    // ─── Derived State ───────────────────────────────────────

    const myPlayer = state?.players.find((p) => p.id === myPlayerId);
    const isGameMaster = myPlayer?.role === "gamemaster";
    const myTeam = myPlayer?.role === "teamorange" ? "orange"
        : myPlayer?.role === "teamgreen" ? "green"
            : null;

    const orangePlayers = state?.players.filter((p) => p.role === "teamorange") || [];
    const greenPlayers = state?.players.filter((p) => p.role === "teamgreen") || [];
    const orangeName = orangePlayers.length > 0 ? orangePlayers.map((p) => p.name).join(" - ") : "الفريق البرتقالي";
    const greenName = greenPlayers.length > 0 ? greenPlayers.map((p) => p.name).join(" - ") : "الفريق الأخضر";

    // ─── Actions ─────────────────────────────────────────────

    const handleBuzz = useCallback(async () => {
        if (!state || state.buzzer.buzzerLocked || isBuzzing) return;
        setIsBuzzing(true);
        playBuzzerSound();
        try {
            const result = await invoke<{ success: boolean }>("Buzz");
            if (result.success) {
                setBuzzerResult("first");
            } else {
                setBuzzerResult("late");
            }
        } catch { /* ignore */ }
        setIsBuzzing(false);
    }, [state?.buzzer.buzzerLocked, isBuzzing, playBuzzerSound]);

    const handleSelectCell = useCallback(async (cellId: string) => {
        if (!isGameMaster) return;
        try {
            const result = await invoke<{ success: boolean; letter?: string }>("SelectCell", cellId);
            if (result.success && result.letter) {
                // Fetch random question from backend
                const q = await fetchRandomQuestion(result.letter);
                if (q) {
                    await invoke("SetQuestion", q.letter, q.question, q.answer, q.category, q.difficulty);
                }
            }
        } catch { /* ignore */ }
    }, [isGameMaster]);

    const handlePickRandom = useCallback(async () => {
        try {
            const result = await invoke<{ success: boolean; letter?: string }>("PickRandomCell");
            if (result.success && result.letter) {
                const q = await fetchRandomQuestion(result.letter);
                if (q) {
                    await invoke("SetQuestion", q.letter, q.question, q.answer, q.category, q.difficulty);
                }
            }
        } catch { /* ignore */ }
    }, []);

    const handleRefreshQuestion = useCallback(async () => {
        if (!state?.question?.letter) return;
        // Fetch a new random question from backend
        const q = await fetchRandomQuestion(state.question.letter);
        if (q) {
            await invoke("SetQuestion", q.letter, q.question, q.answer, q.category, q.difficulty);
        }
    }, [state?.question]);

    const handleAward = useCallback(async (team: string) => {
        await invoke("AwardCell", team);
    }, []);

    const handleSkip = useCallback(async () => {
        await invoke("SkipCell");
    }, []);

    const handleShowQuestion = useCallback(async (show: boolean) => {
        await invoke("ShowQuestion", show);
    }, []);

    const handleResetBuzzer = useCallback(async () => {
        await invoke("ResetBuzzer");
    }, []);

    const handlePassToOtherTeam = useCallback(async () => {
        await invoke("PassToOtherTeam");
    }, []);

    const handleOpenBuzzer = useCallback(async () => {
        await invoke("OpenBuzzer");
    }, []);

    const handleNextRound = useCallback(async () => {
        await invoke("NextRound");
    }, []);

    const handleResetGame = useCallback(async () => {
        await invoke("ResetGame");
    }, []);

    const handleEndSession = useCallback(async () => {
        await invoke("EndSession");
        navigate("/");
    }, [navigate]);

    const handleChangeHexWinner = useCallback(async (cellId: string, winner: string) => {
        await invoke("ChangeHexWinner", cellId, winner);
    }, []);

    const handleOwnedCellClick = useCallback((cellId: string, currentOwner: string) => {
        // Open the change team modal
        setChangeTeamModal({
            isOpen: true,
            cellId,
            currentOwner: currentOwner as "orange" | "green"
        });
    }, [setChangeTeamModal]);

    const handleSelectQuestion = useCallback(async (question: Question) => {
        if (!state?.question?.letter) return;
        await invoke("SetQuestion", question.letter, question.question, question.answer, question.category, question.difficulty);
    }, [state?.question]);

    const handleSetTimerConfig = useCallback(async (first?: number, second?: number) => {
        await invoke("UpdateTimerConfig", first ?? null, second ?? null);
    }, []);

    const handleSwitchPlayers = useCallback(async (id1: string, id2: string) => {
        await invoke("SwitchPlayers", id1, id2);
    }, []);

    const handleKickPlayer = useCallback(async (playerId: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("KickPlayer", playerId);
            if (result.error) {
                setError(result.error);
                setTimeout(() => setError(""), 3000);
            }
        } catch (e: any) {
            setError(e.message || "فشل طرد اللاعب");
            setTimeout(() => setError(""), 3000);
        }
    }, []);

    const handleSwitchPlayerTeam = useCallback(async (playerId: string, newRole: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("SwitchPlayerTeam", playerId, newRole);
            if (result.error) {
                setError(result.error);
                setTimeout(() => setError(""), 3000);
            }
        } catch (e: any) {
            setError(e.message || "فشل تغيير الفريق");
            setTimeout(() => setError(""), 3000);
        }
    }, []);

    const handleMoveSpectatorToTeam = useCallback(async (playerId: string, teamRole: string) => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("MoveSpectatorToTeam", playerId, teamRole);
            if (result.error) {
                setError(result.error);
                setTimeout(() => setError(""), 3000);
            }
        } catch (e: any) {
            setError(e.message || "فشل نقل اللاعب");
            setTimeout(() => setError(""), 3000);
        }
    }, []);

    const handleLeaveGame = useCallback(async () => {
        try { await invoke("LeaveSession"); }
        catch { /* ignore */ }
        if (sessionId) {
            sessionStorage.removeItem(`huroof_name_${sessionId}`);
            sessionStorage.removeItem(`huroof_playerId_${sessionId}`);
            sessionStorage.removeItem(`huroof_pass_${sessionId}`);
        }
        navigate("/");
    }, [navigate, sessionId]);

    // ─── Loading ─────────────────────────────────────────────

    if (!state) {
        return (
            <div className="game-bg min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-5xl mb-4 logo-spin">ح</div>
                    <p className="text-white/70 text-lg font-bold">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    // ─── Buzzer announcement info ────────────────────────────

    const buzzerAnnounce = state.buzzer.buzzedTeam;
    const buzzerTeamName = buzzerAnnounce === "orange" ? orangeName : buzzerAnnounce === "green" ? greenName : null;
    const buzzerColor = buzzerAnnounce === "orange" ? "#f97316" : "#22c55e";
    const otherTeamName = buzzerAnnounce === "orange" ? greenName : buzzerAnnounce === "green" ? orangeName : null;
    const otherTeamColor = buzzerAnnounce === "orange" ? "#22c55e" : "#f97316";
    const activeColor =
        timerPhase === "second" ? otherTeamColor
            : timerPhase === "expired" ? "#ef4444"
                : timerPhase === "open" ? "#eab308"
                    : buzzerColor;

    const isIdle = state.phase === "idle";
    const isSelected = state.phase === "selected";

    // ─── Render ──────────────────────────────────────────────

    return (
        <div className="game-bg min-h-screen flex flex-col">
            {/* Error notification */}
            {error && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500/90 text-white rounded-lg shadow-lg fade-in-scale flex items-center gap-4">
                    <span>{error}</span>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-semibold transition-colors"
                    >
                        إعادة المحاولة
                    </button>
                </div>
            )}
            
            {/* Top bar - More compact */}
            <header className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-black text-white"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                    >
                        ح
                    </div>
                    <div>
                        <p className="font-black text-xs text-white/90">اللعبة</p>
                        <p className="text-white/30 text-[10px] font-mono hidden sm:inline" dir="ltr">{sessionId}</p>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">المؤقت:</span>
                        <Dropdown
                            value={timerPosition}
                            onChange={(value) => setTimerPosition(value as any)}
                            className="w-32"
                            options={[
                                { value: "bottom-left", label: "أسفل يسار" },
                                { value: "bottom-center", label: "أسفل وسط" },
                                { value: "bottom-right", label: "أسفل يمين" },
                                { value: "top-left", label: "أعلى يسار" },
                                { value: "top-center", label: "أعلى وسط" },
                                { value: "top-right", label: "أعلى يمين" },
                            ]}
                        />
                    </div>
                    <button 
                        className="px-2 py-1 text-xs font-semibold rounded-md transition-all hover:bg-red-600/10"
                        style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                        onClick={handleLeaveGame}
                        title="مغادرة اللعبة"
                    >
                        🚪 خروج
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => navigate("/")}>🏠</button>
                </div>
            </header>

            {/* Question banner - More compact */}
            {state.question.showQuestion && state.question.questionText && (
                <div className="flex justify-center mt-2 px-3 lg:px-5">
                    <div
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 lg:py-2.5 fade-in-scale"
                        style={{
                            background: "linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.2))",
                            border: "2px solid rgba(168,85,247,0.5)",
                            boxShadow: "0 0 30px rgba(168,85,247,0.3), inset 0 0 20px rgba(168,85,247,0.08)",
                        }}
                    >
                        {state.question.letter && (
                            <div
                                className="w-8 h-8 lg:w-10 lg:h-10 rounded-md flex items-center justify-center text-base lg:text-xl font-black text-white shrink-0"
                                style={{
                                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                                    boxShadow: "0 0 12px rgba(168,85,247,0.6)",
                                }}
                            >
                                {state.question.letter}
                            </div>
                        )}
                        <p className="text-white text-sm sm:text-base lg:text-lg font-black leading-tight max-w-2xl">
                            {state.question.questionText}
                        </p>
                        {state.question.category && (
                            <span className="inline-block px-2 py-0.5 bg-purple-900/60 text-purple-300 rounded-full text-[10px] font-semibold mr-2 shrink-0">
                                {state.question.category}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Main content - More compact */}
            <div className="flex flex-1 gap-3 p-3 lg:p-4 min-h-0 overflow-hidden">
                {/* Desktop scoreboard - More compact */}
                <aside className="hidden lg:flex w-52 xl:w-60 shrink-0 flex-col">
                    <ScoreBoard
                        orangeName={orangeName}
                        greenName={greenName}
                        orangeScore={state.orangeScore}
                        greenScore={state.greenScore}
                        currentRound={state.currentRound}
                        totalRounds={state.totalRounds}
                    />
                </aside>

                {/* Center: grid + controls - More compact */}
                <main className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    {/* Mobile scores - More compact */}
                    <div className="flex lg:hidden gap-2 w-full">
                        {[
                            { name: orangeName, score: state.orangeScore, team: "orange" },
                            { name: greenName, score: state.greenScore, team: "green" },
                        ].map((t) => (
                            <div key={t.team} className="flex-1 glass-card py-1.5 px-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: t.team === "orange" 
                                                ? "linear-gradient(135deg, #f97316, #ea580c)" 
                                                : "linear-gradient(135deg, #22c55e, #16a34a)",
                                        }}
                                    >
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold" style={{ color: t.team === "orange" ? "#fb923c" : "#4ade80" }}>
                                            {t.name}
                                        </div>
                                        <div className="text-white/40 text-[8px]">
                                            {t.team === "orange" ? "← أفقي →" : "↕ عمودي ↕"}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-lg font-black" style={{ color: t.team === "orange" ? "#fb923c" : "#4ade80" }}>
                                    {t.score}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Hex grid — hidden on small screens when buzzer needed - More compact */}
                    <div className="glass-card w-full flex-1 items-center justify-center p-2 lg:p-3 min-h-0 hidden sm:flex">
                        <HexGrid
                            grid={state.grid}
                            gridSize={state.gridSize}
                            onCellClick={isGameMaster && (isIdle || isSelected) ? handleSelectCell : undefined}
                            onOwnedCellClick={isGameMaster ? handleOwnedCellClick : undefined}
                            interactive={isGameMaster && (isIdle || isSelected)}
                            isGameMaster={isGameMaster}
                        />
                    </div>

                    {/* Mobile: show buzzer or grid - More compact */}
                    <div className="sm:hidden w-full flex-1 flex flex-col gap-2 min-h-0">
                        {/* Always show a small grid on mobile too */}
                        <div className="glass-card w-full p-1.5 flex items-center justify-center" style={{ maxHeight: "40vh" }}>
                            <HexGrid
                                grid={state.grid}
                                gridSize={state.gridSize}
                                onCellClick={isGameMaster && (isIdle || isSelected) ? handleSelectCell : undefined}
                                onOwnedCellClick={isGameMaster ? handleOwnedCellClick : undefined}
                                interactive={isGameMaster && (isIdle || isSelected)}
                                isGameMaster={isGameMaster}
                            />
                        </div>

                        {/* Mobile buzzer for non-GM */}
                        {!isGameMaster && myTeam && (
                            <div className="glass-card p-4">
                                <Buzzer
                                    team={myTeam}
                                    playerName={myPlayer?.name || ""}
                                    isLocked={state.buzzer.buzzerLocked || !state.question.letter || !state.question.questionText}
                                    lockReason={!state.question.letter || !state.question.questionText ? "no-question" : "game"}
                                    iWon={buzzerResult === "first"}
                                    iLost={buzzerResult === "late"}
                                    isBuzzing={isBuzzing}
                                    onBuzz={handleBuzz}
                                />
                            </div>
                        )}
                    </div>

                    {/* Selected cell info (for non-GM) - More compact */}
                    {isSelected && state.selectedCellId && !isGameMaster && (
                        <div className="w-full max-w-lg mx-auto glass-card px-4 py-2 text-center fade-in-scale">
                            <p className="text-purple-300 text-xs font-semibold">
                                حرف <span className="text-white font-black text-base">«{state.question.letter}»</span> — بانتظار إجابة الفرق
                            </p>
                        </div>
                    )}
                    
                    {/* Player list on mobile for non-GM */}
                    {!isGameMaster && (
                        <div className="glass-card p-3 sm:hidden">
                            <PlayerList players={state.players} />
                        </div>
                    )}
                </main>

                {/* Right side: Buzzer (desktop) + GM panel - More compact */}
                <aside className="hidden sm:flex w-72 xl:w-80 shrink-0 flex-col gap-2 overflow-y-auto">
                    {/* Desktop buzzer for non-GM - More compact */}
                    {!isGameMaster && (
                        <>
                            <div className="glass-card p-3" style={{ minHeight: "250px" }}>
                                <Buzzer
                                    team={myTeam}
                                    playerName={myPlayer?.name || ""}
                                    isLocked={state.buzzer.buzzerLocked || !state.question.letter || !state.question.questionText}
                                    lockReason={!state.question.letter || !state.question.questionText ? "no-question" : "game"}
                                    iWon={buzzerResult === "first"}
                                    iLost={buzzerResult === "late"}
                                    isBuzzing={isBuzzing}
                                    onBuzz={handleBuzz}
                                />
                            </div>
                            
                            {/* Player list for non-GM */}
                            <div className="glass-card p-3">
                                <PlayerList players={state.players} />
                            </div>
                        </>
                    )}

                    {/* GM panel — inline on same page */}
                    {isGameMaster && (
                        <GameMasterPanel
                            selectedLetter={state.question.letter}
                            questionText={state.question.questionText}
                            answerText={state.question.answerText}
                            category={state.question.category}
                            difficulty={state.question.difficulty}
                            showQuestion={state.question.showQuestion}
                            buzzedTeam={state.buzzer.buzzedTeam}
                            buzzedPlayerName={state.buzzer.buzzedPlayerName}
                            buzzerLocked={state.buzzer.buzzerLocked}
                            passedToOtherTeamAt={state.buzzer.passedToOtherTeamAt}
                            buzzerIsOpenMode={state.buzzer.buzzerIsOpenMode}
                            buzzerTimerFirst={state.buzzer.buzzerTimerFirst}
                            buzzerTimerSecond={state.buzzer.buzzerTimerSecond}
                            buzzedAt={state.buzzer.buzzedAt}
                            orangeName={orangeName}
                            greenName={greenName}
                            players={state.players}
                            onPickRandom={handlePickRandom}
                            onSelectCell={handleSelectCell}
                            onAwardOrange={() => handleAward("orange")}
                            onAwardGreen={() => handleAward("green")}
                            onSkip={handleSkip}
                            onRefreshQuestion={handleRefreshQuestion}
                            onShowQuestion={handleShowQuestion}
                            onResetBuzzer={handleResetBuzzer}
                            onPassToOtherTeam={handlePassToOtherTeam}
                            onOpenBuzzer={handleOpenBuzzer}
                            onNextRound={handleNextRound}
                            onResetGame={handleResetGame}
                            onEndSession={handleEndSession}
                            onSelectQuestion={handleSelectQuestion}
                            onSetTimerConfig={handleSetTimerConfig}
                            onSwitchPlayers={handleSwitchPlayers}
                            onKickPlayer={handleKickPlayer}
                            onSwitchPlayerTeam={handleSwitchPlayerTeam}
                            onMoveSpectatorToTeam={handleMoveSpectatorToTeam}
                            onChangeHexWinner={handleChangeHexWinner}
                        />
                    )}
                </aside>
            </div>

            {/* Buzzer announcement overlay - positioned */}
            {(buzzerAnnounce || (state.buzzer.buzzerIsOpenMode && !state.buzzer.buzzerLocked)) && (
                <div
                    className={`fixed z-30 fade-in-scale ${
                        timerPosition.includes('top') ? 'top-6' : 'bottom-6'
                    } ${
                        timerPosition.includes('left') ? 'left-6' : 
                        timerPosition.includes('right') ? 'right-6' : 
                        'left-1/2 -translate-x-1/2'
                    }`}
                >
                    <div
                        className="rounded-3xl px-8 py-6 text-center min-w-[260px] max-w-[320px]"
                        style={{
                            background: buzzerAnnounce
                                ? `linear-gradient(135deg, ${activeColor}25, ${activeColor}45, ${activeColor}25)`
                                : "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.30), rgba(234,179,8,0.15))",
                            border: `3px solid ${buzzerAnnounce ? activeColor : "#eab308"}`,
                            boxShadow: `0 8px 32px ${buzzerAnnounce ? activeColor : "#eab308"}40, 0 0 60px ${buzzerAnnounce ? activeColor : "#eab308"}20, inset 0 0 40px ${buzzerAnnounce ? activeColor : "#eab308"}10`,
                            backdropFilter: "blur(20px)",
                            transition: "all 0.4s ease-in-out",
                        }}
                    >
                        {!buzzerAnnounce && state.buzzer.buzzerIsOpenMode && (
                            <div>
                                <div className="text-3xl mb-2">🔓</div>
                                <p className="text-yellow-400 font-black text-base">مفتوح للجميع!</p>
                                <p className="text-white/40 text-xs mt-1">بانتظار ضغط الجرس...</p>
                            </div>
                        )}

                        {buzzerAnnounce && (!timerPhase || timerPhase === "first" || state.buzzer.buzzerIsOpenMode) && (
                            <>
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <span className="text-3xl">🔔</span>
                                    <p className="text-2xl font-black" style={{ color: buzzerColor }}>
                                        {buzzerTeamName}
                                    </p>
                                </div>
                                {state.buzzer.buzzedPlayerName && (
                                    <p className="text-white text-base font-bold mb-1">🎮 {state.buzzer.buzzedPlayerName}</p>
                                )}
                                <p className="text-white/50 text-xs font-semibold mb-3">ضغط الجرس أولاً!</p>
                            </>
                        )}

                        {buzzerAnnounce && !state.buzzer.buzzerIsOpenMode && timerPhase && (
                            <div
                                className="rounded-xl py-3 px-4"
                                style={{
                                    background: `${activeColor}15`,
                                    border: `1px solid ${activeColor}40`,
                                    transition: "border-color 0.4s, background 0.4s",
                                }}
                            >
                                {timerPhase === "first" && (
                                    <>
                                        <div className="text-5xl font-black" style={{ color: buzzerColor }}>
                                            {timerSeconds === 0 ? "Time is up" : timerSeconds}
                                        </div>
                                        <p className="text-white/70 text-xs font-semibold mt-1">
                                            ⏳ وقت {state.buzzer.buzzedPlayerName || buzzerTeamName}
                                        </p>
                                    </>
                                )}
                                {timerPhase === "expired" && (
                                    <>
                                        <div className="text-3xl mb-1">⛔</div>
                                        <p className="text-red-400 text-xs font-bold">انتهى الوقت!</p>
                                    </>
                                )}
                                {timerPhase === "second" && (
                                    <>
                                        <div className="text-5xl font-black" style={{ color: otherTeamColor }}>
                                            {timerSeconds === 0 ? "Time is up" : timerSeconds}
                                        </div>
                                        <p className="text-xs font-semibold mt-1" style={{ color: otherTeamColor }}>
                                            ⏳ دور {otherTeamName}
                                        </p>
                                    </>
                                )}
                                {timerPhase === "open" && (
                                    <>
                                        <div className="text-3xl mb-1">🔓</div>
                                        <p className="text-yellow-400 text-xs font-bold">مفتوح للجميع!</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Win screen */}
            <WinScreen
                phase={state.phase}
                roundWinner={state.roundWinner}
                orangeName={orangeName}
                greenName={greenName}
                orangeScore={state.orangeScore}
                greenScore={state.greenScore}
                currentRound={state.currentRound}
                totalRounds={state.totalRounds}
                isGameMaster={isGameMaster}
                onNextRound={handleNextRound}
                onRestart={handleResetGame}
            />

            {/* Change Team Modal */}
            <ChangeTeamModal
                isOpen={changeTeamModal.isOpen}
                onClose={() => setChangeTeamModal({ isOpen: false, cellId: "", currentOwner: "orange" })}
                cellId={changeTeamModal.cellId}
                currentOwner={changeTeamModal.currentOwner}
                currentTeamName={changeTeamModal.currentOwner === "orange" ? orangeName : greenName}
                orangeTeamName={orangeName}
                greenTeamName={greenName}
                onChangeTeam={handleChangeHexWinner}
            />
        </div>
    );
}
