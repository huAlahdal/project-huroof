import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { invoke, on, startConnection } from "~/lib/signalr";
import { useAuth } from "~/contexts/AuthContext";
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
    passedToTeam: string | null;
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
    usedQuestionIds: string[];
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
        PassedToTeam?: string | null;
        BuzzerIsOpenMode?: boolean;
        RemainingSeconds?: number | null;
        TimerPhase?: string | null;
    };
    RoundWinner?: string | null;
    UsedQuestionIds?: string[];
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
    passedToTeam: null,
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
            usedQuestionIds: state.usedQuestionIds ?? [],
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
            passedToTeam: state.Buzzer?.PassedToTeam ?? null,
            buzzerIsOpenMode: state.Buzzer?.BuzzerIsOpenMode ?? false,
            remainingSeconds: state.Buzzer?.RemainingSeconds ?? null,
            timerPhase: state.Buzzer?.TimerPhase?.toLowerCase() ?? null,
        },
        roundWinner: state.RoundWinner ?? null,
        usedQuestionIds: state.UsedQuestionIds ?? [],
        version: state.Version ?? 0,
    };
}

// ─── Component ──────────────────────────────────────────────

export default function GamePage() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [state, setState] = useState<GameState | null>(null);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState("");
    const [notification, setNotification] = useState("");
    const [changeTeamModal, setChangeTeamModal] = useState<{
        isOpen: boolean;
        cellId: string;
        currentOwner: "orange" | "green";
    }>({ isOpen: false, cellId: "", currentOwner: "orange" });

    // Buzzer local state
    const [buzzerResult, setBuzzerResult] = useState<"first" | "late" | null>(null);
    const [isBuzzing, setIsBuzzing] = useState(false);

    // Timer state — computed from server timestamps so all clients stay in sync
    const [timerPhase, setTimerPhase] = useState<"first" | "second" | "expired" | "open" | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerPosition, setTimerPosition] = useState<"bottom-left" | "bottom-center" | "bottom-right" | "top-left" | "top-center" | "top-right">("bottom-right");
    const prevTimerPhaseRef = useRef<string | null>(null);
    // Holds the current interval's cancel fn so GM action handlers can stop it immediately
    const cancelTimerRef = useRef<(() => void) | null>(null);

    // Sound effects — tries /sounds/ first, then root /public, supports mp3 & wav
    const playSound = useCallback((names: string[], volume: number) => {
        // Only look in /sounds/ — root-level paths hit React Router's SSR handler in dev mode
        const paths = names.map(n => `/sounds/${n}`);
        const tryNext = (i: number) => {
            if (i >= paths.length) return;
            try {
                const audio = new Audio(paths[i]);
                audio.volume = volume;
                audio.addEventListener('error', () => tryNext(i + 1));
                audio.play().catch(() => tryNext(i + 1));
            } catch { tryNext(i + 1); }
        };
        tryNext(0);
    }, []);

    const playBuzzerSound = useCallback(() => {
        // Looks for: /sounds/buzzer.mp3, /sounds/buzzer.wav, /buzzer.mp3, /buzzer.wav
        playSound(['buzzer.mp3', 'buzzer.wav'], 0.3);
    }, [playSound]);

    const playTimerEndSound = useCallback(() => {
        // Looks for: /sounds/timeup.mp3, /sounds/timeup.wav, /sounds/timer-end.mp3 ...
        playSound(['timeup.mp3', 'timeup.wav', 'timer-end.mp3', 'timer-end.wav'], 0.5);
    }, [playSound]);

    // ─── Connection Setup ────────────────────────────────────

    useEffect(() => {
        if (!sessionId || authLoading) return;
        if (!user) { navigate("/"); return; }

        let cancelled = false;
        const init = async () => {
            try {
                await startConnection();

                const name = user.inGameName || "لاعب";
                const result = await invoke<{ success?: boolean; error?: string; playerId?: string }>(
                    "JoinSession", sessionId, null, name
                );
                if (!cancelled) {
                    if (result.error && result.error.includes("not found")) {
                        navigate("/");
                        return;
                    }
                    if (result.success) {
                        setMyPlayerId(result.playerId || null);
                        setConnected(true);
                    } else {
                        setError(result.error || "فشل الانضمام للجلسة");
                    }
                }

                if (!cancelled && !result?.success) {
                    // If we still can't join (password-protected?), go home
                    navigate("/");
                }
            } catch {
                if (!cancelled) navigate("/");
            }
        };

        init();
        return () => { cancelled = true; };
    }, [sessionId, navigate, authLoading, user]);

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
            navigate("/", { state: { kicked: true, reason: kickData.reason } });
        });

        const unsubNotification = on("Notification", (data: unknown) => {
            const { message } = data as { message: string };
            setNotification(message);
            setTimeout(() => setNotification(""), 4000);
        });

        return () => { unsubGame(); unsubLobby(); unsubEnd(); unsubKicked(); unsubNotification(); };
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
    //
    // The server computes timerPhase + remainingSeconds at broadcast time and sends
    // them in every state update. The client counts down locally from those values
    // so there is zero sensitivity to clock skew between the server and client clocks.
    // Each new SignalR update re-seeds the countdown from the fresh server values.

    useEffect(() => {
        const buzzer = state?.buzzer;

        // "Passed" state: buzzer was passed to the other team — unlocked but timer is running.
        // In this case buzzerLocked is false but passedToOtherTeamAt is set, so DON'T early-return.
        const isPassedState = !!(buzzer?.passedToOtherTeamAt && !buzzer.buzzerLocked && !buzzer.buzzerIsOpenMode);

        // No active buzz — decide whether to show "open" idle or nothing
        if ((!buzzer?.buzzerLocked || !buzzer.buzzedAt) && !isPassedState) {
            if (buzzer?.buzzerIsOpenMode) {
                prevTimerPhaseRef.current = "open";
                setTimerPhase("open");
                setTimerSeconds(0);
            } else {
                prevTimerPhaseRef.current = null;
                setTimerPhase(null);
                setTimerSeconds(0);
            }
            return;
        }

        // Server-authoritative phase + remaining seconds (computed at broadcast time)
        const serverPhase = (buzzer.timerPhase ?? null) as "first" | "second" | "expired" | "open" | null;
        const serverRemaining = buzzer.remainingSeconds ?? 0;

        // Non-countdown states — apply immediately, play transition sounds
        if (!serverPhase || serverPhase === "expired" || serverPhase === "open") {
            const prev = prevTimerPhaseRef.current;
            if (prev !== "expired" && serverPhase === "expired") playTimerEndSound();
            if (prev === "second" && serverPhase === "open") playTimerEndSound();
            prevTimerPhaseRef.current = serverPhase;
            setTimerPhase(serverPhase);
            setTimerSeconds(0);
            return;
        }

        // Active countdown — seed from server value, tick down using local time.
        // This is purely local-to-local elapsed measurement (no server clock involved)
        // so clock skew has zero effect on the displayed countdown.
        const startedAt = Date.now();
        const initialRemaining = serverRemaining;

        const tick = () => {
            const localElapsed = (Date.now() - startedAt) / 1000;
            const remaining = Math.max(0, initialRemaining - localElapsed);
            prevTimerPhaseRef.current = serverPhase;
            setTimerPhase(serverPhase);
            setTimerSeconds(Math.ceil(remaining));
        };

        tick();
        const id = setInterval(tick, 250);
        cancelTimerRef.current = () => clearInterval(id);
        return () => {
            clearInterval(id);
            cancelTimerRef.current = null;
        };
    }, [state?.buzzer.buzzerLocked, state?.buzzer.buzzedAt, state?.buzzer.passedToOtherTeamAt, state?.buzzer.buzzerIsOpenMode, state?.buzzer.timerPhase, state?.buzzer.remainingSeconds, playTimerEndSound]);

    // ─── Derived State ───────────────────────────────────────

    const myPlayer = state?.players.find((p) => p.id === myPlayerId);
    const isGameMaster = myPlayer?.role === "gamemaster";
    const myTeam = myPlayer?.role === "teamorange" ? "orange"
        : myPlayer?.role === "teamgreen" ? "green"
            : null;

    const orangePlayers = state?.players.filter((p) => p.role === "teamorange") || [];
    const greenPlayers = state?.players.filter((p) => p.role === "teamgreen") || [];
    const orangeName = "الفريق البرتقالي";
    const greenName = "الفريق الأخضر";

    // Buzzer is locked for this player if:
    // - buzzer is locked (someone buzzed), OR
    // - buzzer was passed to the other team and this player is NOT on that team
    const buzzerLockedForMe = !!(state?.buzzer.buzzerLocked || (state?.buzzer.passedToTeam && state.buzzer.passedToTeam !== myTeam));

    // ─── Actions ─────────────────────────────────────────────

    const handleBuzz = useCallback(async () => {
        if (!state || state.buzzer.buzzerLocked || isBuzzing) return;
        // Don't allow buzz if buzzer was passed to the other team
        if (state.buzzer.passedToTeam && state.buzzer.passedToTeam !== myTeam) return;
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
    }, [state?.buzzer.buzzerLocked, state?.buzzer.passedToTeam, myTeam, isBuzzing, playBuzzerSound]);

    const handleSelectCell = useCallback(async (cellId: string) => {
        if (!isGameMaster) return;
        try {
            const result = await invoke<{ success: boolean; letter?: string }>("SelectCell", cellId);
            if (result.success && result.letter) {
                // Fetch random question from backend
                const q = await fetchRandomQuestion(result.letter);
                if (q) {
                    await invoke("SetQuestion", q.letter, q.question, q.answer, q.category, q.difficulty);
                    if (q.id) await invoke("MarkQuestionUsed", q.id);
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
                    if (q.id) await invoke("MarkQuestionUsed", q.id);
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
            if (q.id) await invoke("MarkQuestionUsed", q.id);
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
        // Immediately stop the running timer so the UI reacts before the server roundtrip
        cancelTimerRef.current?.();
        cancelTimerRef.current = null;
        prevTimerPhaseRef.current = null;
        setTimerPhase(null);
        setTimerSeconds(0);
        await invoke("ResetBuzzer");
    }, []);

    const handlePassToOtherTeam = useCallback(async () => {
        // Immediately stop the running timer and optimistically show second-team countdown
        cancelTimerRef.current?.();
        cancelTimerRef.current = null;
        prevTimerPhaseRef.current = "second";
        setTimerPhase("second");
        setTimerSeconds(state?.buzzer.buzzerTimerSecond ?? 10);
        await invoke("PassToOtherTeam");
    }, [state?.buzzer.buzzerTimerSecond]);

    const handleOpenBuzzer = useCallback(async () => {
        // Immediately stop the running timer and optimistically show open-for-all state
        cancelTimerRef.current?.();
        cancelTimerRef.current = null;
        prevTimerPhaseRef.current = "open";
        setTimerPhase("open");
        setTimerSeconds(0);
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
        // Mark question as used
        if (question.id) {
            await invoke("MarkQuestionUsed", question.id);
        }
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

    const handleSwapTeams = useCallback(async () => {
        try {
            const result = await invoke<{ success?: boolean; error?: string }>("SwapTeams");
            if (result.error) {
                setError(result.error);
                setTimeout(() => setError(""), 3000);
            }
        } catch (e: any) {
            setError(e.message || "فشل تبديل الفرق");
            setTimeout(() => setError(""), 3000);
        }
    }, []);

    const handleMarkQuestionUsed = useCallback(async (questionId: string) => {
        try {
            await invoke("MarkQuestionUsed", questionId);
        } catch { /* ignore */ }
    }, []);

    const handleLeaveGame = useCallback(async () => {
        try { await invoke("LeaveSession"); }
        catch { /* ignore */ }
        navigate("/");
    }, [navigate]);

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
            {/* Team swap notification */}
            {notification && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-purple-600/95 text-white rounded-lg shadow-lg fade-in-scale flex items-center gap-3 text-center font-bold text-base">
                    <span>{notification}</span>
                </div>
            )}

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
                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
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
                                    isLocked={buzzerLockedForMe || !state.question.letter || !state.question.questionText}
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

                    {/* Mobile GM Panel */}
                    {isGameMaster && (
                        <div className="sm:hidden w-full glass-card p-3 overflow-y-auto" style={{ maxHeight: "60vh" }}>
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
                                timerPhase={timerPhase}
                                timerSeconds={timerSeconds}
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
                                onSwapTeams={handleSwapTeams}
                                usedQuestionIds={state.usedQuestionIds}
                            />
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
                                    isLocked={buzzerLockedForMe || !state.question.letter || !state.question.questionText}
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
                            timerPhase={timerPhase}
                            timerSeconds={timerSeconds}
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
                            onSwapTeams={handleSwapTeams}
                            usedQuestionIds={state.usedQuestionIds}
                        />
                    )}
                </aside>
            </div>

            {/* Buzzer announcement overlay - positioned */}
            {(buzzerAnnounce || (state.buzzer.buzzerIsOpenMode && !state.buzzer.buzzerLocked)) && (
                <div
                    className={`fixed z-40 fade-in-scale transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                        timerPosition.includes('top') ? 'top-8' : 'bottom-8'
                    } ${
                        timerPosition.includes('left') ? 'left-8' : 
                        timerPosition.includes('right') ? 'right-8' : 
                        'left-1/2 -translate-x-1/2'
                    }`}
                >
                    <div
                        className="relative overflow-hidden rounded-2xl flex flex-col min-w-[280px] sm:min-w-[340px] shadow-2xl"
                        style={{
                            background: buzzerAnnounce
                                ? `linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.95))`
                                : "linear-gradient(145deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.9))",
                            border: `1px solid ${buzzerAnnounce ? activeColor : "#eab308"}50`,
                            boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px -5px ${buzzerAnnounce ? activeColor : "#eab308"}40`,
                            backdropFilter: "blur(24px)",
                        }}
                    >
                        {/* Decorative Top Glow */}
                        <div 
                            className="absolute top-0 left-0 right-0 h-1 opacity-80"
                            style={{ background: buzzerAnnounce ? activeColor : "#eab308", boxShadow: `0 0 15px ${buzzerAnnounce ? activeColor : "#eab308"}` }}
                        />

                        {/* Open Mode State */}
                        {!buzzerAnnounce && state.buzzer.buzzerIsOpenMode && (
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-yellow-400 font-bold text-lg tracking-wide">مفتوح للجميع</span>
                                    <span className="text-slate-400 text-sm mt-0.5">بانتظار ضغط الجرس...</span>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                                    <span className="text-2xl">🔓</span>
                                </div>
                            </div>
                        )}

                        {/* Active Buzzer State */}
                        {buzzerAnnounce && (
                            <div className="flex flex-col">
                                {/* Header Info */}
                                <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/5 relative z-10">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">
                                                {timerPhase === "second" ? "⏳" : "🔔"}
                                            </span>
                                            <span 
                                                className="font-black text-xl tracking-wide uppercase" 
                                                style={{ color: timerPhase === "second" ? otherTeamColor : buzzerColor }}
                                            >
                                                {timerPhase === "second" ? otherTeamName : buzzerTeamName}
                                            </span>
                                        </div>
                                        {(!timerPhase || timerPhase === "first") && state.buzzer.buzzedPlayerName && (
                                            <span className="text-slate-300 text-sm font-medium mt-1 pr-8">
                                                اللاعب: {state.buzzer.buzzedPlayerName}
                                            </span>
                                        )}
                                        {timerPhase === "second" && (
                                            <span className="text-slate-300 text-sm font-medium mt-1 pr-8">
                                                دور الفريق الآخر
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Timer Core */}
                                {timerPhase && timerPhase !== "open" && (
                                    <div className="p-6 flex items-center justify-center relative bg-black/20">
                                        {timerPhase === "expired" ? (
                                            <div className="flex flex-col items-center gap-2 py-2">
                                                <span className="text-4xl">⛔</span>
                                                <span className="text-red-400 font-black text-xl tracking-widest uppercase">انتهى الوقت</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-6">
                                                {/* Timer Ring */}
                                                <div className="relative w-24 h-24 flex items-center justify-center">
                                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                                        <circle 
                                                            cx="48" cy="48" r="44" 
                                                            fill="none" 
                                                            stroke="currentColor" 
                                                            strokeWidth="4" 
                                                            className="text-white/5"
                                                        />
                                                        <circle 
                                                            cx="48" cy="48" r="44" 
                                                            fill="none" 
                                                            stroke={timerPhase === "second" ? otherTeamColor : buzzerColor}
                                                            strokeWidth="4" 
                                                            strokeDasharray={276}
                                                            strokeDashoffset={276 - (276 * (timerSeconds / (timerPhase === "first" ? Math.max(state.buzzer.buzzerTimerFirst || 15, timerSeconds) : Math.max(state.buzzer.buzzerTimerSecond || 10, timerSeconds))))}
                                                            strokeLinecap="round"
                                                            className="transition-all duration-1000 ease-linear"
                                                        />
                                                    </svg>
                                                    <div 
                                                        className="text-4xl font-black tabular-nums tracking-tighter z-10"
                                                        style={{ color: timerPhase === "second" ? otherTeamColor : buzzerColor }}
                                                    >
                                                        {timerSeconds}
                                                    </div>
                                                </div>
                                                
                                                {/* Timer Text */}
                                                <div className="flex flex-col justify-center">
                                                    <span className="text-slate-400 text-xs uppercase tracking-widest mb-1 font-bold">الوقت المتبقي</span>
                                                    <span 
                                                        className="text-xl font-bold"
                                                        style={{ color: timerPhase === "second" ? otherTeamColor : buzzerColor }}
                                                    >
                                                        {timerSeconds <= 5 && timerSeconds > 0 ? "أسرع!" : "ثانية"}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
