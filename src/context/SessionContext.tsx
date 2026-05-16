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

const ALLOWED_WORKOUTS_KEY = 'management_allowed_workouts';
const WORKOUT_LOGS_KEY = 'management_workout_logs';
const FOCUS_LOGS_KEY = 'management_focus_logs';
const MAX_HISTORY_ITEMS = 1500;

type Phase = 'idle' | 'focus' | 'break';

export type BreakVariant = 'short' | 'long';

export type LongBreakStage = 'exercise' | 'relax';

export type DeskPosture = 'sitting' | 'standing';

export interface LastFlowSummary {
  startedAt: number;
  endedAt: number;
  pomodoros: number;
  deepWork: number;
  exerciseTotals: Record<string, ExerciseRunAgg>;
}

const createId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
};

const readStoredData = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to parse local storage key ${key}:`, error);
    return fallback;
  }
};

const normalizeWorkoutLogs = (raw: WorkoutLogEntry[]): WorkoutLogEntry[] =>
  raw.map((log) => {
    const exercises = log.exercises ?? [];
    const vol = sumExerciseVolume(exercises);
    return {
      ...log,
      exercises,
      totalReps: typeof log.totalReps === 'number' ? log.totalReps : vol.reps,
      totalTimedSeconds: typeof log.totalTimedSeconds === 'number' ? log.totalTimedSeconds : vol.timedSeconds
    };
  });

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
  const [allowedWorkoutIds, setAllowedWorkoutIds] = useState<string[]>(
    () => resolveAllowedWorkoutIds(readStoredData<string[]>(ALLOWED_WORKOUTS_KEY, DEFAULT_ALLOWED_WORKOUT_IDS))
  );
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogEntry[]>(
    () => normalizeWorkoutLogs(readStoredData<WorkoutLogEntry[]>(WORKOUT_LOGS_KEY, []))
  );
  const [focusLogs, setFocusLogs] = useState<FocusLogEntry[]>(
    () => readStoredData<FocusLogEntry[]>(FOCUS_LOGS_KEY, [])
  );
  const [runExerciseTotals, setRunExerciseTotals] = useState<Record<string, ExerciseRunAgg>>(() => emptyExerciseTotals());
  const runExerciseTotalsRef = useRef<Record<string, ExerciseRunAgg>>(emptyExerciseTotals());
  const [runPomodoros, setRunPomodoros] = useState(0);
  const [runDeepWork, setRunDeepWork] = useState(0);
  const runPomodorosRef = useRef(0);
  const runDeepWorkRef = useRef(0);
  const lastPomodoroPostureRef = useRef<DeskPosture | null>(null);
  const [pomodoroPosture, setPomodoroPosture] = useState<DeskPosture>('sitting');

  useEffect(() => {
    localStorage.setItem(ALLOWED_WORKOUTS_KEY, JSON.stringify(allowedWorkoutIds));
  }, [allowedWorkoutIds]);

  useEffect(() => {
    localStorage.setItem(WORKOUT_LOGS_KEY, JSON.stringify(workoutLogs));
  }, [workoutLogs]);

  useEffect(() => {
    localStorage.setItem(FOCUS_LOGS_KEY, JSON.stringify(focusLogs));
  }, [focusLogs]);

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

  const startFlow = useCallback((sessionType: SessionType) => {
    const empty = emptyExerciseTotals();
    setRunStartedAt(Date.now());
    setLastSummary(null);
    setPhase('focus');
    setBreakVariant(null);
    setLongBreakStage(null);
    setActiveSessionType(sessionType);
    setRemainingSeconds(SESSION_DURATIONS_MINUTES[sessionType] * 60);
    setNextSessionType(sessionType === 'pomodoro' ? 'pomodoro' : 'pomodoro');
    setActiveWorkout(null);
    setWorkoutLogged(false);
    lastPomodoroPostureRef.current = null;
    if (sessionType === 'pomodoro') {
      setPomodoroPosture('sitting');
    }
    applyExerciseTotals(empty);
    runPomodorosRef.current = 0;
    runDeepWorkRef.current = 0;
    setRunPomodoros(0);
    setRunDeepWork(0);
  }, [applyExerciseTotals]);

  const finishFlow = useCallback(() => {
    const finishedAt = Date.now();
    if (runStartedAt !== null) {
      setLastSummary({
        startedAt: runStartedAt,
        endedAt: finishedAt,
        pomodoros: runPomodorosRef.current,
        deepWork: runDeepWorkRef.current,
        exerciseTotals: { ...runExerciseTotalsRef.current }
      });
    }
    setPhase('idle');
    setBreakVariant(null);
    setLongBreakStage(null);
    setActiveSessionType(null);
    setRemainingSeconds(0);
    setNextSessionType(null);
    setActiveWorkout(null);
    setWorkoutLogged(false);
    lastPomodoroPostureRef.current = null;
    setPomodoroPosture('sitting');
    setRunStartedAt(null);
    applyExerciseTotals(emptyExerciseTotals());
    runPomodorosRef.current = 0;
    runDeepWorkRef.current = 0;
    setRunPomodoros(0);
    setRunDeepWork(0);
  }, [runStartedAt, applyExerciseTotals]);

  useEffect(() => {
    if (phase === 'idle') return;
    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase]);

  useEffect(() => {
    if (remainingSeconds !== 0) return;
    if (phase === 'focus' && activeSessionType) {
      const completedAt = Date.now();
      const newFocusLog: FocusLogEntry = {
        id: createId('focus'),
        type: activeSessionType,
        completedAt,
        durationMinutes: SESSION_DURATIONS_MINUTES[activeSessionType]
      };
      setFocusLogs((current) => [newFocusLog, ...current].slice(0, MAX_HISTORY_ITEMS));
      incrementFocusCount(activeSessionType);
      if (activeSessionType === 'pomodoro') {
        lastPomodoroPostureRef.current = pomodoroPosture;
        setActiveWorkout(pickWorkoutForBreak(allowedWorkoutIds));
        setWorkoutLogged(false);
        setBreakVariant('short');
        setLongBreakStage(null);
        setPhase('break');
        setRemainingSeconds(SESSION_DURATIONS_MINUTES.break * 60);
        return;
      }
      setActiveWorkout(pickWorkoutForBreak(allowedWorkoutIds));
      setWorkoutLogged(false);
      setBreakVariant('long');
      setLongBreakStage('exercise');
      setPhase('break');
      setRemainingSeconds(SESSION_DURATIONS_MINUTES.break * 60);
      return;
    }
    if (phase === 'break') {
      if (breakVariant === 'long' && longBreakStage === 'exercise') {
        setLongBreakStage('relax');
        setActiveWorkout(null);
        setWorkoutLogged(false);
        setRemainingSeconds((SESSION_DURATIONS_MINUTES.longBreak - SESSION_DURATIONS_MINUTES.break) * 60);
        return;
      }
      if (!nextSessionType) {
        finishFlow();
        return;
      }
      setPhase('focus');
      setBreakVariant(null);
      setLongBreakStage(null);
      setActiveSessionType(nextSessionType);
      setRemainingSeconds(SESSION_DURATIONS_MINUTES[nextSessionType] * 60);
      setNextSessionType(nextSessionType === 'pomodoro' ? 'pomodoro' : null);
      if (nextSessionType === 'pomodoro') {
        const prev = lastPomodoroPostureRef.current;
        setPomodoroPosture(prev === null ? 'sitting' : prev === 'sitting' ? 'standing' : 'sitting');
      }
      setActiveWorkout(null);
      setWorkoutLogged(false);
      return;
    }
  }, [remainingSeconds, phase, activeSessionType, allowedWorkoutIds, nextSessionType, breakVariant, longBreakStage, pomodoroPosture, incrementFocusCount, finishFlow]);

  const handleWorkoutCompletion = useCallback(() => {
    if (!activeWorkout || workoutLogged) return;
    const { reps, timedSeconds } = sumExerciseVolume(activeWorkout.exercises);
    const workoutLog: WorkoutLogEntry = {
      id: createId('workout'),
      workoutId: activeWorkout.id,
      workoutName: activeWorkout.name,
      completedAt: Date.now(),
      exercises: activeWorkout.exercises,
      totalReps: reps,
      totalTimedSeconds: timedSeconds
    };
    setWorkoutLogs((current) => [workoutLog, ...current].slice(0, MAX_HISTORY_ITEMS));
    setWorkoutLogged(true);
    const nextTotals = mergeWorkoutExercisesIntoTotals(runExerciseTotalsRef.current, activeWorkout.exercises);
    applyExerciseTotals(nextTotals);
  }, [activeWorkout, workoutLogged, applyExerciseTotals]);

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
