import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  DEFAULT_ALLOWED_WORKOUT_IDS,
  mergeWorkoutExercisesIntoTotals,
  pickWorkoutForBreak,
  resolveAllowedWorkoutIds,
  sumExerciseVolume,
  SESSION_DURATIONS_MINUTES,
  type ExerciseRunAgg,
  type FocusLogEntry,
  type SessionType,
  type WorkoutDefinition,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';
import {
  type BreakVariant,
  type DeskPosture,
  type FlowPhase,
  type LongBreakStage,
  type PersistedFlowState,
  isResumableFlow
} from '@/lib/flowState';
import {
  computeCompletionRatio,
  creditFocusMinutes,
  isPhaseLongEnoughToLog,
  scaleExercisesByRatio
} from '@/lib/sessionProgress';
import {
  clearActiveFlowState,
  loadSessionStorage,
  MAX_HISTORY_ITEMS,
  persistFocusLog,
  persistWorkoutLog,
  saveActiveFlowState,
  saveAllowedWorkoutIds,
  saveLastFlowSummary,
  type LastFlowSummaryRecord
} from '@/lib/sessionDb';

export type { BreakVariant, DeskPosture, LongBreakStage };
export type Phase = FlowPhase;
export type LastFlowSummary = LastFlowSummaryRecord;

const createId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
};

const emptyExerciseTotals = (): Record<string, ExerciseRunAgg> => ({});

interface SessionContextValue {
  phase: Phase;
  breakVariant: BreakVariant | null;
  longBreakStage: LongBreakStage | null;
  activeSessionType: SessionType | null;
  remainingSeconds: number;
  nextSessionType: SessionType | null;
  setNextSessionType: (value: SessionType | null) => void;
  activeWorkout: WorkoutDefinition | null;
  workoutLogged: boolean;
  runExerciseTotals: Record<string, ExerciseRunAgg>;
  runPomodoros: number;
  runDeepWork: number;
  allowedWorkoutIds: string[];
  workoutLogs: WorkoutLogEntry[];
  focusLogs: FocusLogEntry[];
  lastSummary: LastFlowSummary | null;
  startFlow: (sessionType: SessionType) => void;
  finishFlow: () => void;
  handleWorkoutCompletion: () => void;
  handleAllowedWorkoutToggle: (workoutId: string, enabled: boolean) => void;
  updateBreakExerciseAmount: (index: number, amount: number) => void;
  pomodoroPosture: DeskPosture;
  focusDeskPosture: DeskPosture | null;
  nextDeskPostureIfPomodoro: DeskPosture | null;
  togglePomodoroDeskPosture: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [breakVariant, setBreakVariant] = useState<BreakVariant | null>(null);
  const [longBreakStage, setLongBreakStage] = useState<LongBreakStage | null>(null);
  const [activeSessionType, setActiveSessionType] = useState<SessionType | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [nextSessionType, setNextSessionType] = useState<SessionType | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDefinition | null>(null);
  const [workoutLogged, setWorkoutLogged] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [lastSummary, setLastSummary] = useState<LastFlowSummary | null>(null);
  const [allowedWorkoutIds, setAllowedWorkoutIds] = useState<string[]>(DEFAULT_ALLOWED_WORKOUT_IDS);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogEntry[]>([]);
  const [focusLogs, setFocusLogs] = useState<FocusLogEntry[]>([]);
  const [sessionStorageReady, setSessionStorageReady] = useState(false);
  const [runExerciseTotals, setRunExerciseTotals] = useState<Record<string, ExerciseRunAgg>>(() => emptyExerciseTotals());
  const [runPomodoros, setRunPomodoros] = useState(0);
  const [runDeepWork, setRunDeepWork] = useState(0);
  const [pomodoroPosture, setPomodoroPosture] = useState<DeskPosture>('sitting');

  const phasePlannedSecondsRef = useRef(0);
  const phaseEndsAtMsRef = useRef(0);
  const phaseStartedAtMsRef = useRef(0);
  const runExerciseTotalsRef = useRef<Record<string, ExerciseRunAgg>>(emptyExerciseTotals());
  const runPomodorosRef = useRef(0);
  const runDeepWorkRef = useRef(0);
  const lastPomodoroPostureRef = useRef<DeskPosture | null>(null);
  const activeWorkoutRef = useRef(activeWorkout);
  activeWorkoutRef.current = activeWorkout;
  const workoutLoggedRef = useRef(workoutLogged);
  workoutLoggedRef.current = workoutLogged;
  const flowPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processTimerEndRef = useRef<() => void>(() => {});

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const breakVariantRef = useRef(breakVariant);
  breakVariantRef.current = breakVariant;
  const longBreakStageRef = useRef(longBreakStage);
  longBreakStageRef.current = longBreakStage;
  const activeSessionTypeRef = useRef(activeSessionType);
  activeSessionTypeRef.current = activeSessionType;
  const remainingSecondsRef = useRef(remainingSeconds);
  remainingSecondsRef.current = remainingSeconds;
  const nextSessionTypeRef = useRef(nextSessionType);
  nextSessionTypeRef.current = nextSessionType;
  const allowedWorkoutIdsRef = useRef(allowedWorkoutIds);
  allowedWorkoutIdsRef.current = allowedWorkoutIds;
  const pomodoroPostureRef = useRef(pomodoroPosture);
  pomodoroPostureRef.current = pomodoroPosture;
  const runStartedAtRef = useRef(runStartedAt);
  runStartedAtRef.current = runStartedAt;

  const markPhaseStarted = useCallback(() => {
    phaseStartedAtMsRef.current = Date.now();
  }, []);

  const setPhaseTimer = useCallback((seconds: number, plannedSeconds?: number) => {
    const planned = plannedSeconds ?? seconds;
    phasePlannedSecondsRef.current = planned;
    phaseEndsAtMsRef.current = Date.now() + seconds * 1000;
    setRemainingSeconds(seconds);
  }, []);

  const buildPersistedFlow = useCallback((): PersistedFlowState => ({
    version: 1,
    phase: phaseRef.current,
    breakVariant: breakVariantRef.current,
    longBreakStage: longBreakStageRef.current,
    activeSessionType: activeSessionTypeRef.current,
    remainingSeconds: remainingSecondsRef.current,
    phasePlannedSeconds: phasePlannedSecondsRef.current,
    phaseStartedAtMs: phaseStartedAtMsRef.current,
    nextSessionType: nextSessionTypeRef.current,
    activeWorkout: activeWorkoutRef.current,
    workoutLogged: workoutLoggedRef.current,
    runStartedAt: runStartedAtRef.current,
    runPomodoros: runPomodorosRef.current,
    runDeepWork: runDeepWorkRef.current,
    runExerciseTotals: { ...runExerciseTotalsRef.current },
    pomodoroPosture: pomodoroPostureRef.current,
    lastPomodoroPosture: lastPomodoroPostureRef.current
  }), []);

  const schedulePersistFlow = useCallback(() => {
    if (flowPersistTimerRef.current) clearTimeout(flowPersistTimerRef.current);
    flowPersistTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'idle') return;
      void saveActiveFlowState(buildPersistedFlow()).catch((error) => {
        console.error('Failed to persist active flow:', error);
      });
    }, 400);
  }, [buildPersistedFlow]);

  const applyPersistedFlow = useCallback(
    (flow: PersistedFlowState) => {
      phasePlannedSecondsRef.current = flow.phasePlannedSeconds;
      phaseStartedAtMsRef.current =
        flow.phaseStartedAtMs ??
        Date.now() - Math.max(0, flow.phasePlannedSeconds - flow.remainingSeconds) * 1000;
      phaseEndsAtMsRef.current = Date.now() + flow.remainingSeconds * 1000;
      setPhase(flow.phase);
      setBreakVariant(flow.breakVariant);
      setLongBreakStage(flow.longBreakStage);
      setActiveSessionType(flow.activeSessionType);
      setRemainingSeconds(flow.remainingSeconds);
      setNextSessionType(flow.nextSessionType);
      setActiveWorkout(flow.activeWorkout);
      setWorkoutLogged(flow.workoutLogged);
      workoutLoggedRef.current = flow.workoutLogged;
      setRunStartedAt(flow.runStartedAt);
      runPomodorosRef.current = flow.runPomodoros;
      runDeepWorkRef.current = flow.runDeepWork;
      setRunPomodoros(flow.runPomodoros);
      setRunDeepWork(flow.runDeepWork);
      runExerciseTotalsRef.current = { ...flow.runExerciseTotals };
      setRunExerciseTotals(flow.runExerciseTotals);
      setPomodoroPosture(flow.pomodoroPosture);
      lastPomodoroPostureRef.current = flow.lastPomodoroPosture;
    },
    []
  );

  const applyExerciseTotals = useCallback((next: Record<string, ExerciseRunAgg>) => {
    runExerciseTotalsRef.current = next;
    setRunExerciseTotals(next);
  }, []);

  const incrementFocusCount = useCallback((sessionType: SessionType) => {
    if (sessionType === 'pomodoro') {
      runPomodorosRef.current += 1;
      setRunPomodoros(runPomodorosRef.current);
    } else {
      runDeepWorkRef.current += 1;
      setRunDeepWork(runDeepWorkRef.current);
    }
  }, []);

  const recordFocusSession = useCallback(
    (sessionType: SessionType, completionRatio: number) => {
      if (!isPhaseLongEnoughToLog(phaseStartedAtMsRef.current)) return;
      const ratio = Math.min(1, Math.max(0, completionRatio));
      if (ratio <= 0) return;
      const planned = SESSION_DURATIONS_MINUTES[sessionType];
      const entry: FocusLogEntry = {
        id: createId('focus'),
        type: sessionType,
        completedAt: Date.now(),
        plannedDurationMinutes: planned,
        completionRatio: ratio,
        durationMinutes: creditFocusMinutes(planned, ratio)
      };
      setFocusLogs((current) => [entry, ...current].slice(0, MAX_HISTORY_ITEMS));
      void persistFocusLog(entry).catch((error) => {
        console.error('Failed to persist focus log:', error);
      });
      incrementFocusCount(sessionType);
    },
    [incrementFocusCount]
  );

  const logActiveWorkoutIfNeeded = useCallback(
    (completionRatio: number) => {
      if (!isPhaseLongEnoughToLog(phaseStartedAtMsRef.current)) return;
      const workout = activeWorkoutRef.current;
      if (!workout || workoutLoggedRef.current) return;
      const ratio = Math.min(1, Math.max(0, completionRatio));
      if (ratio <= 0) return;
      const scaled = scaleExercisesByRatio(workout.exercises, ratio);
      if (scaled.length === 0) return;
      const { reps, timedSeconds } = sumExerciseVolume(scaled);
      const workoutLog: WorkoutLogEntry = {
        id: createId('workout'),
        workoutId: workout.id,
        workoutName: workout.name,
        completedAt: Date.now(),
        exercises: scaled,
        totalReps: reps,
        totalTimedSeconds: timedSeconds,
        completionRatio: ratio
      };
      setWorkoutLogs((current) => [workoutLog, ...current].slice(0, MAX_HISTORY_ITEMS));
      void persistWorkoutLog(workoutLog).catch((error) => {
        console.error('Failed to persist workout log:', error);
      });
      setWorkoutLogged(true);
      workoutLoggedRef.current = true;
      applyExerciseTotals(mergeWorkoutExercisesIntoTotals(runExerciseTotalsRef.current, scaled));
    },
    [applyExerciseTotals]
  );

  const resetToIdle = useCallback(() => {
    void clearActiveFlowState().catch((error) => {
      console.error('Failed to clear active flow:', error);
    });
    setPhase('idle');
    setBreakVariant(null);
    setLongBreakStage(null);
    setActiveSessionType(null);
    setRemainingSeconds(0);
    setNextSessionType(null);
    setActiveWorkout(null);
    setWorkoutLogged(false);
    workoutLoggedRef.current = false;
    lastPomodoroPostureRef.current = null;
    setPomodoroPosture('sitting');
    setRunStartedAt(null);
    applyExerciseTotals(emptyExerciseTotals());
    runPomodorosRef.current = 0;
    runDeepWorkRef.current = 0;
    setRunPomodoros(0);
    setRunDeepWork(0);
    phasePlannedSecondsRef.current = 0;
    phaseEndsAtMsRef.current = 0;
    phaseStartedAtMsRef.current = 0;
  }, [applyExerciseTotals]);

  const startFlow = useCallback(
    (sessionType: SessionType) => {
      const empty = emptyExerciseTotals();
      const startedAt = Date.now();
      setRunStartedAt(startedAt);
      runStartedAtRef.current = startedAt;
      setLastSummary(null);
      setPhase('focus');
      setBreakVariant(null);
      setLongBreakStage(null);
      setActiveSessionType(sessionType);
      setNextSessionType(sessionType === 'pomodoro' ? 'pomodoro' : 'pomodoro');
      setActiveWorkout(null);
      setWorkoutLogged(false);
      workoutLoggedRef.current = false;
      lastPomodoroPostureRef.current = null;
      if (sessionType === 'pomodoro') setPomodoroPosture('sitting');
      applyExerciseTotals(empty);
      runPomodorosRef.current = 0;
      runDeepWorkRef.current = 0;
      setRunPomodoros(0);
      setRunDeepWork(0);
      const secs = SESSION_DURATIONS_MINUTES[sessionType] * 60;
      markPhaseStarted();
      setPhaseTimer(secs, secs);
      schedulePersistFlow();
    },
    [applyExerciseTotals, markPhaseStarted, setPhaseTimer, schedulePersistFlow]
  );

  const finishFlow = useCallback(() => {
    if (phaseRef.current === 'focus' && activeSessionTypeRef.current) {
      const ratio = computeCompletionRatio(phasePlannedSecondsRef.current, remainingSecondsRef.current);
      recordFocusSession(activeSessionTypeRef.current, ratio);
    }
    // Stopping during a break does not log a workout (no scaled partial credit).
    const finishedAt = Date.now();
    if (runStartedAtRef.current !== null) {
      const summary: LastFlowSummary = {
        startedAt: runStartedAtRef.current,
        endedAt: finishedAt,
        pomodoros: runPomodorosRef.current,
        deepWork: runDeepWorkRef.current,
        exerciseTotals: { ...runExerciseTotalsRef.current }
      };
      setLastSummary(summary);
      void saveLastFlowSummary(summary).catch((error) => {
        console.error('Failed to persist last flow summary:', error);
      });
    }
    resetToIdle();
  }, [recordFocusSession, resetToIdle]);

  useEffect(() => {
    let cancelled = false;
    loadSessionStorage()
      .then((snapshot) => {
        if (cancelled) return;
        setAllowedWorkoutIds(snapshot.allowedWorkoutIds);
        setWorkoutLogs(snapshot.workoutLogs);
        setFocusLogs(snapshot.focusLogs);
        setLastSummary(snapshot.lastSummary);
        if (snapshot.activeFlow && isResumableFlow(snapshot.activeFlow)) {
          applyPersistedFlow(snapshot.activeFlow);
        }
      })
      .catch((error) => {
        console.error('Failed to load session storage from SQLite:', error);
      })
      .finally(() => {
        if (!cancelled) setSessionStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyPersistedFlow]);

  useEffect(() => {
    if (!sessionStorageReady) return;
    void saveAllowedWorkoutIds(allowedWorkoutIds).catch((error) => {
      console.error('Failed to save allowed workouts:', error);
    });
  }, [allowedWorkoutIds, sessionStorageReady]);

  useEffect(() => {
    if (phase === 'idle' || !sessionStorageReady) return;
    schedulePersistFlow();
  }, [
    phase,
    breakVariant,
    longBreakStage,
    activeSessionType,
    remainingSeconds,
    nextSessionType,
    activeWorkout,
    workoutLogged,
    runStartedAt,
    runPomodoros,
    runDeepWork,
    runExerciseTotals,
    pomodoroPosture,
    sessionStorageReady,
    schedulePersistFlow
  ]);

  useEffect(() => {
    if (phase === 'idle') return;
    const intervalId = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((phaseEndsAtMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(rem);
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase]);

  useEffect(() => {
    const onTimerEnd = () => {
      if (phaseRef.current === 'idle') return;
      if (remainingSecondsRef.current !== 0) return;
      if (phaseRef.current === 'focus' && activeSessionTypeRef.current) {
        const sessionType = activeSessionTypeRef.current;
        recordFocusSession(sessionType, 1);
        if (sessionType === 'pomodoro') {
          lastPomodoroPostureRef.current = pomodoroPostureRef.current;
          setActiveWorkout(pickWorkoutForBreak(allowedWorkoutIdsRef.current));
          setWorkoutLogged(false);
          workoutLoggedRef.current = false;
          setBreakVariant('short');
          setLongBreakStage(null);
          setPhase('break');
          markPhaseStarted();
          const secs = SESSION_DURATIONS_MINUTES.break * 60;
          setPhaseTimer(secs, secs);
          return;
        }
        setActiveWorkout(pickWorkoutForBreak(allowedWorkoutIdsRef.current));
        setWorkoutLogged(false);
        workoutLoggedRef.current = false;
        setBreakVariant('long');
        setLongBreakStage('exercise');
        setPhase('break');
        markPhaseStarted();
        const secs = SESSION_DURATIONS_MINUTES.break * 60;
        setPhaseTimer(secs, secs);
        return;
      }
      if (phaseRef.current === 'break') {
        if (breakVariantRef.current === 'long' && longBreakStageRef.current === 'exercise') {
          logActiveWorkoutIfNeeded(1);
          setLongBreakStage('relax');
          setActiveWorkout(null);
          setWorkoutLogged(false);
          workoutLoggedRef.current = false;
          markPhaseStarted();
          const secs = (SESSION_DURATIONS_MINUTES.longBreak - SESSION_DURATIONS_MINUTES.break) * 60;
          setPhaseTimer(secs, secs);
          return;
        }
        if (!nextSessionTypeRef.current) {
          finishFlow();
          return;
        }
        logActiveWorkoutIfNeeded(1);
        const next = nextSessionTypeRef.current;
        setPhase('focus');
        setBreakVariant(null);
        setLongBreakStage(null);
        setActiveSessionType(next);
        markPhaseStarted();
        const secs = SESSION_DURATIONS_MINUTES[next] * 60;
        setPhaseTimer(secs, secs);
        setNextSessionType(next === 'pomodoro' ? 'pomodoro' : null);
        if (next === 'pomodoro') {
          const prev = lastPomodoroPostureRef.current;
          setPomodoroPosture(prev === null ? 'sitting' : prev === 'sitting' ? 'standing' : 'sitting');
        }
        setActiveWorkout(null);
        setWorkoutLogged(false);
        workoutLoggedRef.current = false;
      }
    };
    processTimerEndRef.current = onTimerEnd;
    onTimerEnd();
  }, [
    remainingSeconds,
    recordFocusSession,
    logActiveWorkoutIfNeeded,
    finishFlow,
    setPhaseTimer,
    markPhaseStarted
  ]);

  const handleWorkoutCompletion = useCallback(() => {
    logActiveWorkoutIfNeeded(1);
  }, [logActiveWorkoutIfNeeded]);

  const handleAllowedWorkoutToggle = useCallback((workoutId: string, enabled: boolean) => {
    setAllowedWorkoutIds((current) => {
      if (enabled) return resolveAllowedWorkoutIds([...new Set([...current, workoutId])]);
      const next = current.filter((id) => id !== workoutId);
      if (next.length === 0) return current;
      return next;
    });
  }, []);

  const updateBreakExerciseAmount = useCallback((index: number, amount: number) => {
    if (!Number.isFinite(amount)) return;
    const rounded = Math.max(0, Math.round(amount));
    setActiveWorkout((w) => {
      if (!w) return w;
      const exercises = w.exercises.map((ex, i) => (i === index ? { ...ex, amount: rounded } : ex));
      return { ...w, exercises };
    });
  }, []);

  const focusDeskPosture = useMemo((): DeskPosture | null => {
    if (phase !== 'focus' || !activeSessionType) return null;
    if (activeSessionType === 'deep') return 'sitting';
    return pomodoroPosture;
  }, [phase, activeSessionType, pomodoroPosture]);

  const nextDeskPostureIfPomodoro = useMemo((): DeskPosture | null => {
    if (nextSessionType !== 'pomodoro') return null;
    if (phase === 'focus' && activeSessionType === 'pomodoro') {
      return pomodoroPosture === 'sitting' ? 'standing' : 'sitting';
    }
    if (phase === 'focus' && activeSessionType === 'deep') {
      const prev = lastPomodoroPostureRef.current;
      return prev === null ? 'sitting' : prev === 'sitting' ? 'standing' : 'sitting';
    }
    if (phase === 'break') {
      const prev = lastPomodoroPostureRef.current;
      return prev === null ? 'sitting' : prev === 'sitting' ? 'standing' : 'sitting';
    }
    return null;
  }, [nextSessionType, phase, activeSessionType, pomodoroPosture, breakVariant, longBreakStage]);

  const togglePomodoroDeskPosture = useCallback(() => {
    if (phase !== 'focus' || activeSessionType !== 'pomodoro') return;
    setPomodoroPosture((p) => (p === 'sitting' ? 'standing' : 'sitting'));
  }, [phase, activeSessionType]);

  const value = useMemo<SessionContextValue>(
    () => ({
      phase,
      breakVariant,
      longBreakStage,
      activeSessionType,
      remainingSeconds,
      nextSessionType,
      setNextSessionType,
      activeWorkout,
      workoutLogged,
      runExerciseTotals,
      runPomodoros,
      runDeepWork,
      allowedWorkoutIds,
      workoutLogs,
      focusLogs,
      lastSummary,
      startFlow,
      finishFlow,
      handleWorkoutCompletion,
      handleAllowedWorkoutToggle,
      updateBreakExerciseAmount,
      pomodoroPosture,
      focusDeskPosture,
      nextDeskPostureIfPomodoro,
      togglePomodoroDeskPosture
    }),
    [
      phase,
      breakVariant,
      longBreakStage,
      activeSessionType,
      remainingSeconds,
      nextSessionType,
      activeWorkout,
      workoutLogged,
      runExerciseTotals,
      runPomodoros,
      runDeepWork,
      allowedWorkoutIds,
      workoutLogs,
      focusLogs,
      lastSummary,
      startFlow,
      finishFlow,
      handleWorkoutCompletion,
      handleAllowedWorkoutToggle,
      updateBreakExerciseAmount,
      pomodoroPosture,
      focusDeskPosture,
      nextDeskPostureIfPomodoro,
      togglePomodoroDeskPosture
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
};
