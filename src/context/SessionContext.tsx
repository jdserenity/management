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
import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow } from '@/lib/dayBoundary';
import { loadDayRolloverHourPref, saveDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import {
  defaultWorkoutCustomizePrefs,
  mergeExerciseOverride,
  prefsHasAtLeastOneMove,
  resolveAllowedStretchPickKeys,
  resolveAllowedWorkoutIdsFromPrefs,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';
import {
  buildManualExerciseLogEntry,
  mergeWorkoutExercisesIntoTotals,
  pickWorkoutForBreak,
  sumExerciseVolume,
  summarizeFocusToday,
  summarizeTodayExerciseTotals,
  summarizeTodayStretchTotals,
  type TodayStretchTotals,
  SESSION_DURATIONS_MINUTES,
  type ExerciseDefinition,
  type ExerciseRunAgg,
  type ExerciseUnit,
  type FocusLogEntry,
  type FocusTodayTotals,
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
  breakTimerEndAction,
  canConvertFocusSession,
  computeCompletionRatio,
  creditFocusMinutes,
  focusElapsedSeconds,
  isPhaseLongEnoughToLog,
  remainingSecondsWhenConvertingToDeep,
  remainingSecondsWhenConvertingToPomodoro,
  scaleExercisesByRatio
} from '@/lib/sessionProgress';
import {
  clearActiveFlowState,
  loadSessionStorage,
  MAX_HISTORY_ITEMS,
  persistFocusLog,
  persistWorkoutLog,
  saveActiveFlowState,
  saveWorkoutCustomizePrefs
} from '@/lib/sessionDb';
import {
  applyRemoteActiveFlow,
  buildActiveFlowDocument,
  createDesktopSyncClient,
  isRemoteActiveFlow,
  isSyncViewer,
  syncLeaderDeviceIdFromDoc
} from '@/lib/sessionSync';
import type { SyncClient } from '@mgmt/sync';

export type { BreakVariant, DeskPosture, LongBreakStage };
export type Phase = FlowPhase;

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
  runStartedAt: number | null;
  workoutCustomizePrefs: WorkoutCustomizePrefs;
  workoutLogs: WorkoutLogEntry[];
  focusLogs: FocusLogEntry[];
  todayExerciseTotals: Record<string, ExerciseRunAgg>;
  todayStretchTotals: TodayStretchTotals;
  focusToday: FocusTodayTotals;
  dayRolloverHour: number;
  setDayRolloverHour: (hour: number) => void;
  startFlow: (sessionType: SessionType) => void;
  convertFlowToDeepWork: () => void;
  convertFlowToPomodoro: () => void;
  startExerciseBreak: () => void;
  finishFlow: () => void;
  handleWorkoutCompletion: () => void;
  addManualExercise: (exercise: ExerciseDefinition) => void;
  handleAllowedWorkoutToggle: (workoutId: string, enabled: boolean) => void;
  handleStretchPickToggle: (pickKey: string, enabled: boolean) => void;
  updateExerciseOverride: (exerciseId: string, amount: number, unit: ExerciseUnit) => void;
  updateStretchHoldSeconds: (seconds: number) => void;
  addCustomExercise: (exercise: ExerciseDefinition) => void;
  removeCustomExercise: (exerciseId: string) => void;
  updateBreakExerciseAmount: (index: number, amount: number) => void;
  pomodoroPosture: DeskPosture;
  focusDeskPosture: DeskPosture | null;
  nextDeskPostureIfPomodoro: DeskPosture | null;
  togglePomodoroDeskPosture: () => void;
  sessionStorageReady: boolean;
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
  const [workoutCustomizePrefs, setWorkoutCustomizePrefs] = useState<WorkoutCustomizePrefs>(defaultWorkoutCustomizePrefs);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogEntry[]>([]);
  const [focusLogs, setFocusLogs] = useState<FocusLogEntry[]>([]);
  const [sessionStorageReady, setSessionStorageReady] = useState(false);
  const [dayRolloverHour, setDayRolloverHourState] = useState(DEFAULT_DAY_ROLLOVER_HOUR);
  const [statsDayWindowStart, setStatsDayWindowStart] = useState(() => getStatsDayWindow().startTs);
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
  const syncClientRef = useRef<SyncClient | null>(null);
  const syncLeaderDeviceIdRef = useRef<string | null>(null);
  const lastPublishedAtMsRef = useRef(0);
  const processTimerEndRef = useRef<() => void>(() => {});
  const prevRemainingForTimerEndRef = useRef<number | null>(null);

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
  const workoutCustomizePrefsRef = useRef(workoutCustomizePrefs);
  workoutCustomizePrefsRef.current = workoutCustomizePrefs;
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
      const flow = buildPersistedFlow();
      void saveActiveFlowState(flow).catch((error) => {
        console.error('Failed to persist active flow:', error);
      });
      const client = syncClientRef.current;
      if (!client) return;
      if (isSyncViewer(syncLeaderDeviceIdRef.current, client.deviceId)) return;
      const now = Date.now();
      const doc = buildActiveFlowDocument(flow, client.deviceId, phaseEndsAtMsRef.current, now);
      lastPublishedAtMsRef.current = now;
      void client.publishActiveFlow(doc).catch((error) => {
        console.error('Failed to publish active flow to sync:', error);
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

  const startExerciseBreak = useCallback(() => {
    const empty = emptyExerciseTotals();
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    runStartedAtRef.current = startedAt;
    phaseRef.current = 'break';
    breakVariantRef.current = 'short';
    longBreakStageRef.current = null;
    activeSessionTypeRef.current = null;
    nextSessionTypeRef.current = null;
    setPhase('break');
    setBreakVariant('short');
    setLongBreakStage(null);
    setActiveSessionType(null);
    setNextSessionType(null);
    setActiveWorkout(pickWorkoutForBreak(workoutCustomizePrefsRef.current));
    setWorkoutLogged(false);
    workoutLoggedRef.current = false;
    applyExerciseTotals(empty);
    runPomodorosRef.current = 0;
    runDeepWorkRef.current = 0;
    setRunPomodoros(0);
    setRunDeepWork(0);
    markPhaseStarted();
    const secs = SESSION_DURATIONS_MINUTES.break * 60;
    setPhaseTimer(secs, secs);
    schedulePersistFlow();
  }, [applyExerciseTotals, markPhaseStarted, setPhaseTimer, schedulePersistFlow]);

  const startFlow = useCallback(
    (sessionType: SessionType) => {
      const empty = emptyExerciseTotals();
      const startedAt = Date.now();
      setRunStartedAt(startedAt);
      runStartedAtRef.current = startedAt;
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

  const convertFocusSession = useCallback(
    (target: SessionType) => {
      const current = activeSessionTypeRef.current;
      if (!canConvertFocusSession(phaseRef.current, current, target)) return;
      const elapsed = focusElapsedSeconds(phasePlannedSecondsRef.current, remainingSecondsRef.current);
      const ratio = computeCompletionRatio(phasePlannedSecondsRef.current, remainingSecondsRef.current);
      recordFocusSession(current!, ratio);
      const planned = SESSION_DURATIONS_MINUTES[target] * 60;
      const remaining =
        target === 'deep' ? remainingSecondsWhenConvertingToDeep(elapsed) : remainingSecondsWhenConvertingToPomodoro(elapsed);
      setActiveSessionType(target);
      setNextSessionType('pomodoro');
      if (target === 'pomodoro') {
        const prev = lastPomodoroPostureRef.current;
        setPomodoroPosture(prev === null ? 'sitting' : prev === 'sitting' ? 'standing' : 'sitting');
      }
      markPhaseStarted();
      setPhaseTimer(remaining, planned);
      schedulePersistFlow();
    },
    [recordFocusSession, markPhaseStarted, setPhaseTimer, schedulePersistFlow]
  );

  const convertFlowToDeepWork = useCallback(() => convertFocusSession('deep'), [convertFocusSession]);
  const convertFlowToPomodoro = useCallback(() => convertFocusSession('pomodoro'), [convertFocusSession]);

  const finishFlow = useCallback(() => {
    if (phaseRef.current === 'focus' && activeSessionTypeRef.current) {
      const ratio = computeCompletionRatio(phasePlannedSecondsRef.current, remainingSecondsRef.current);
      recordFocusSession(activeSessionTypeRef.current, ratio);
    }
    // Stopping during a break does not log a workout (no scaled partial credit).
    resetToIdle();
  }, [recordFocusSession, resetToIdle]);

  useEffect(() => {
    let cancelled = false;
    void loadDayRolloverHourPref()
      .then((hour) => {
        if (!cancelled) {
          setDayRolloverHourState(hour);
          setStatsDayWindowStart(getStatsDayWindow(Date.now(), hour).startTs);
        }
      })
      .catch((error) => {
        console.error('Failed to load day rollover hour:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const { startTs } = getStatsDayWindow(Date.now(), dayRolloverHour);
      setStatsDayWindowStart((prev) => (prev === startTs ? prev : startTs));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [dayRolloverHour]);

  useEffect(() => {
    let cancelled = false;
    loadSessionStorage()
      .then((snapshot) => {
        if (cancelled) return;
        setWorkoutCustomizePrefs(snapshot.workoutCustomizePrefs);
        setWorkoutLogs(snapshot.workoutLogs);
        setFocusLogs(snapshot.focusLogs);
        if (snapshot.activeFlow && isResumableFlow(snapshot.activeFlow)) {
          applyPersistedFlow(snapshot.activeFlow);
          if (snapshot.activeFlow.remainingSeconds === 0) prevRemainingForTimerEndRef.current = -1;
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
    const client = createDesktopSyncClient();
    syncClientRef.current = client;
    return client.subscribeActiveFlow((doc) => {
      syncLeaderDeviceIdRef.current = syncLeaderDeviceIdFromDoc(doc);
      if (!doc) return;
      if (!isRemoteActiveFlow(doc, client.deviceId)) return;
      if (doc.updatedAtMs <= lastPublishedAtMsRef.current) return;
      const wasLogged = workoutLoggedRef.current;
      const applied = applyRemoteActiveFlow(doc);
      phaseEndsAtMsRef.current = applied.phaseEndsAtMs;
      applyPersistedFlow(applied.flow);
      if (applied.flow.workoutLogged && !wasLogged) logActiveWorkoutIfNeeded(1);
    });
  }, [applyPersistedFlow, logActiveWorkoutIfNeeded]);

  useEffect(() => {
    const client = syncClientRef.current;
    if (!client || !sessionStorageReady || phase !== 'idle') return;
    if (isSyncViewer(syncLeaderDeviceIdRef.current, client.deviceId)) return;
    lastPublishedAtMsRef.current = Date.now();
    void client.publishActiveFlow(null).catch((error) => {
      console.error('Failed to clear remote active flow:', error);
    });
  }, [phase, sessionStorageReady]);

  useEffect(() => {
    if (!sessionStorageReady) return;
    void saveWorkoutCustomizePrefs(workoutCustomizePrefs).catch((error) => {
      console.error('Failed to save workout customize prefs:', error);
    });
  }, [workoutCustomizePrefs, sessionStorageReady]);

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
    processTimerEndRef.current = () => {
      if (phaseRef.current === 'idle') return;
      if (remainingSecondsRef.current !== 0) return;
      const syncClient = syncClientRef.current;
      if (isSyncViewer(syncLeaderDeviceIdRef.current, syncClient?.deviceId ?? '')) return;
      if (phaseRef.current === 'focus' && activeSessionTypeRef.current) {
        const sessionType = activeSessionTypeRef.current;
        recordFocusSession(sessionType, 1);
        if (sessionType === 'pomodoro') {
          lastPomodoroPostureRef.current = pomodoroPostureRef.current;
          setActiveWorkout(pickWorkoutForBreak(workoutCustomizePrefsRef.current));
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
        setActiveWorkout(pickWorkoutForBreak(workoutCustomizePrefsRef.current));
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
        const afterBreak = breakTimerEndAction(breakVariantRef.current, longBreakStageRef.current, nextSessionTypeRef.current);
        if (afterBreak === 'long_relax') {
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
        if (afterBreak === 'finish') {
          finishFlow();
          return;
        }
        logActiveWorkoutIfNeeded(1);
        const next = nextSessionTypeRef.current!;
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
  }, [recordFocusSession, logActiveWorkoutIfNeeded, finishFlow, setPhaseTimer, markPhaseStarted]);

  useEffect(() => {
    if (!sessionStorageReady || phase === 'idle') {
      prevRemainingForTimerEndRef.current = remainingSeconds;
      return;
    }
    const prev = prevRemainingForTimerEndRef.current;
    prevRemainingForTimerEndRef.current = remainingSeconds;
    if (remainingSeconds !== 0) return;
    if (prev === 0) return;
    processTimerEndRef.current();
  }, [remainingSeconds, phase, sessionStorageReady]);

  const handleWorkoutCompletion = useCallback(() => {
    logActiveWorkoutIfNeeded(1);
  }, [logActiveWorkoutIfNeeded]);

  const addManualExercise = useCallback(
    (exercise: ExerciseDefinition) => {
      const entry = buildManualExerciseLogEntry(exercise, createId('workout'));
      setWorkoutLogs((current) => [entry, ...current].slice(0, MAX_HISTORY_ITEMS));
      void persistWorkoutLog(entry).catch((error) => {
        console.error('Failed to persist manual exercise:', error);
      });
      if (phaseRef.current !== 'idle') {
        applyExerciseTotals(mergeWorkoutExercisesIntoTotals(runExerciseTotalsRef.current, [exercise]));
      }
    },
    [applyExerciseTotals]
  );

  const setDayRolloverHour = useCallback((hour: number) => {
    void saveDayRolloverHourPref(hour)
      .then((saved) => {
        setDayRolloverHourState(saved);
        setStatsDayWindowStart(getStatsDayWindow(Date.now(), saved).startTs);
      })
      .catch((error) => {
        console.error('Failed to save day rollover hour:', error);
      });
  }, []);

  const todayExerciseTotals = useMemo(
    () => summarizeTodayExerciseTotals(workoutLogs, Date.now(), dayRolloverHour),
    [workoutLogs, dayRolloverHour, statsDayWindowStart]
  );

  const todayStretchTotals = useMemo(
    () => summarizeTodayStretchTotals(workoutLogs, Date.now(), dayRolloverHour),
    [workoutLogs, dayRolloverHour, statsDayWindowStart]
  );

  const focusToday = useMemo(
    () => summarizeFocusToday(focusLogs, Date.now(), dayRolloverHour),
    [focusLogs, dayRolloverHour, statsDayWindowStart]
  );

  const patchWorkoutPrefs = useCallback((patch: (current: WorkoutCustomizePrefs) => WorkoutCustomizePrefs | null) => {
    setWorkoutCustomizePrefs((current) => {
      const next = patch(current);
      if (!next || !prefsHasAtLeastOneMove(next)) return current;
      return next;
    });
  }, []);

  const handleAllowedWorkoutToggle = useCallback((workoutId: string, enabled: boolean) => {
    patchWorkoutPrefs((current) => {
      const ids = resolveAllowedWorkoutIdsFromPrefs(current);
      const nextIds = enabled ? [...new Set([...ids, workoutId])] : ids.filter((id) => id !== workoutId);
      if (!enabled && nextIds.length === 0 && resolveAllowedStretchPickKeys(current).length === 0 && current.customExercises.length === 0) return null;
      return { ...current, allowedWorkoutIds: nextIds };
    });
  }, [patchWorkoutPrefs]);

  const handleStretchPickToggle = useCallback((pickKey: string, enabled: boolean) => {
    patchWorkoutPrefs((current) => {
      const keys = resolveAllowedStretchPickKeys(current);
      const nextKeys = enabled ? [...new Set([...keys, pickKey])] : keys.filter((k) => k !== pickKey);
      if (!enabled && nextKeys.length === 0 && resolveAllowedWorkoutIdsFromPrefs(current).length === 0 && current.customExercises.length === 0) return null;
      return { ...current, allowedStretchPickKeys: nextKeys };
    });
  }, [patchWorkoutPrefs]);

  const updateExerciseOverride = useCallback((exerciseId: string, amount: number, unit: ExerciseUnit) => {
    if (!Number.isFinite(amount)) return;
    setWorkoutCustomizePrefs((current) => ({
      ...current,
      exerciseOverrides: mergeExerciseOverride(current.exerciseOverrides, exerciseId, amount, unit)
    }));
  }, []);

  const updateStretchHoldSeconds = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds)) return;
    const rounded = Math.max(1, Math.round(seconds));
    setWorkoutCustomizePrefs((current) => ({ ...current, stretchHoldSeconds: rounded }));
  }, []);

  const addCustomExercise = useCallback((exercise: ExerciseDefinition) => {
    if (!exercise.id || !exercise.name) return;
    setWorkoutCustomizePrefs((current) => ({
      ...current,
      customExercises: [...current.customExercises.filter((e) => e.id !== exercise.id), exercise]
    }));
  }, []);

  const removeCustomExercise = useCallback((exerciseId: string) => {
    patchWorkoutPrefs((current) => {
      const nextCustom = current.customExercises.filter((e) => e.id !== exerciseId);
      if (nextCustom.length === current.customExercises.length) return null;
      if (nextCustom.length === 0 && resolveAllowedWorkoutIdsFromPrefs(current).length === 0 && resolveAllowedStretchPickKeys(current).length === 0) return null;
      const exerciseOverrides = { ...current.exerciseOverrides };
      delete exerciseOverrides[exerciseId];
      return { ...current, customExercises: nextCustom, exerciseOverrides };
    });
  }, [patchWorkoutPrefs]);

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
      runStartedAt,
      workoutCustomizePrefs,
      workoutLogs,
      focusLogs,
      todayExerciseTotals,
      todayStretchTotals,
      focusToday,
      dayRolloverHour,
      setDayRolloverHour,
      startFlow,
      convertFlowToDeepWork,
      convertFlowToPomodoro,
      startExerciseBreak,
      finishFlow,
      handleWorkoutCompletion,
      addManualExercise,
      handleAllowedWorkoutToggle,
      handleStretchPickToggle,
      updateExerciseOverride,
      updateStretchHoldSeconds,
      addCustomExercise,
      removeCustomExercise,
      updateBreakExerciseAmount,
      pomodoroPosture,
      focusDeskPosture,
      nextDeskPostureIfPomodoro,
      togglePomodoroDeskPosture,
      sessionStorageReady
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
      runStartedAt,
      workoutCustomizePrefs,
      workoutLogs,
      focusLogs,
      todayExerciseTotals,
      todayStretchTotals,
      focusToday,
      dayRolloverHour,
      setDayRolloverHour,
      startFlow,
      convertFlowToDeepWork,
      convertFlowToPomodoro,
      startExerciseBreak,
      finishFlow,
      handleWorkoutCompletion,
      addManualExercise,
      handleAllowedWorkoutToggle,
      handleStretchPickToggle,
      updateExerciseOverride,
      updateStretchHoldSeconds,
      addCustomExercise,
      removeCustomExercise,
      updateBreakExerciseAmount,
      pomodoroPosture,
      focusDeskPosture,
      nextDeskPostureIfPomodoro,
      togglePomodoroDeskPosture,
      sessionStorageReady,
      statsDayWindowStart
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
};
