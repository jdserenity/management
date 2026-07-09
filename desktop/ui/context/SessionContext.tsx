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
import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow, isTimestampInStatsDay } from '@/lib/dayBoundary';
import { loadDayRolloverHourPref, saveDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { isCantExerciseModeEnabled, setCantExerciseModeEnabled } from '@/lib/cantExerciseModePref';
import {
  isVeryLightBreak,
  normalizeFlowForCantExerciseMode,
  resolveLongBreakExerciseStage,
  resolvePomodoroBreakKind,
  restoreExerciseBreakFromVeryLight
} from '@/lib/exerciseBreak';
import { loadPomodoroBreakChain, savePomodoroBreakChain } from '@/lib/pomodoroBreakChain';
import {
  defaultWorkoutCustomizePrefs,
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
  type ExerciseDefinition,
  type ExerciseRunAgg,
  type ExerciseUnit,
  type FocusLogEntry,
  type FocusTodayTotals,
  type SessionType,
  type WorkoutDefinition,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';
import type { BreakVariant, DeskPosture, FlowPhase, LongBreakStage, PersistedFlowState } from '@/lib/flowState';
import { isResumableFlow } from '@/lib/flowState';
import {
  clearActiveFlowState,
  loadSessionStorage,
  MAX_HISTORY_ITEMS,
  persistFocusLog,
  persistWorkoutLog,
  deleteWorkoutLogsForWorkoutIdSince,
  deleteWorkoutLogById,
  saveActiveFlowState,
  saveWorkoutCustomizePrefs
} from '@/lib/sessionDb';
import {
  applyRemoteActiveFlow,
  buildActiveFlowDocument,
  createDesktopSyncClient,
  isRemoteActiveFlow,
  isSyncViewer,
  shouldFollowRemoteFlowClear,
  syncLeaderDeviceIdFromDoc
} from '@/lib/sessionSync';
import type { SyncClient } from '@mgmt/sync';
import { createActiveFlowDocument } from '@mgmt/sync';
import {
  advanceBreakFlow,
  computeCompletionRatio,
  convertFocusFlow,
  creditFocusMinutes,
  idleFlow,
  isActiveExerciseBreak,
  isPhaseLongEnoughToLog,
  onFocusTimerEnd,
  scaleExercisesByRatio,
  SESSION_DURATIONS_MINUTES,
  startExerciseBreakFlow,
  startFocusFlow
} from '@mgmt/core';
import { MORNING_STRETCH_WORKOUT_ID } from '@/lib/morningStretch/morningStretch';
import { buildStretchLogEntry, defaultBuiltinMorningStretch, type StretchDefinition } from '@/lib/stretchCreator/stretchCreator';
import {
  buildMovementSnackLogEntry,
  countMovementSnacksToday,
  defaultMovementSnackPrefs,
  normalizeMovementSnackPrefs,
  type MovementSnackPrefs
} from '@/lib/movementSnack/movementSnack';
import { saveMovementSnackPrefs } from '@/lib/movementSnack/movementSnackPref';
import { FLOW_LID_PAUSE_EVENT, FLOW_LID_RESUME_EVENT, phaseEndsAtMsAfterLidResume } from '@/lib/flowLidPause';
import { isTauri } from '@/lib/isTauri';
import { listen } from '@tauri-apps/api/event';
import { createPrefixedId } from '@/lib/exerciseForm';
import { focusDeskPosture as resolveFocusDeskPosture, nextDeskPostureIfPomodoro as resolveNextDeskPosture, togglePomodoroPosture } from '@/lib/deskPosture';
import {
  applyPrefsPatch,
  patchAllowedWorkoutToggle,
  patchRemoveCustomExercise,
  patchStretchPickToggle,
  withCustomExercise,
  withExerciseOverride,
  withStretchHoldSeconds
} from '@/lib/workoutPrefsActions';

export type { BreakVariant, DeskPosture, LongBreakStage };
export type Phase = FlowPhase;
export type StartFlowOptions = { background?: boolean };

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
  todayMovementSnacks: number;
  movementSnackPrefs: MovementSnackPrefs;
  dayRolloverHour: number;
  setDayRolloverHour: (hour: number) => void;
  cantExerciseMode: boolean;
  setCantExerciseMode: (enabled: boolean) => void;
  startFlow: (sessionType: SessionType, options?: StartFlowOptions) => void;
  takeBackgroundFlowStart: () => boolean;
  convertFlowToDeepWork: () => void;
  convertFlowToPomodoro: () => void;
  startExerciseBreak: () => void;
  finishFlow: () => void;
  handleWorkoutCompletion: () => void;
  addManualExercise: (exercise: ExerciseDefinition) => void;
  logStretchCompletion: (stretch: StretchDefinition, exercises: ExerciseDefinition[], completionRatio?: number) => void;
  logMorningStretchCompletion: (exercises: ExerciseDefinition[], completionRatio?: number) => void;
  clearMorningStretchCompletionToday: () => void;
  updateMovementSnackPrefs: (patch: Partial<MovementSnackPrefs>) => void;
  logMovementSnackCompletion: (easy: boolean, exercises?: ExerciseDefinition[]) => void;
  removeWorkoutLog: (id: string) => void;
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

export type SessionProviderProps = {
  children: ReactNode;
  syncClient?: SyncClient;
  /** companion: phone may claim leadership during exercise breaks */
  syncMode?: 'desktop' | 'companion';
};

export const SessionProvider = ({ children, syncClient: syncClientProp, syncMode = 'desktop' }: SessionProviderProps) => {
  const [flow, setFlow] = useState<PersistedFlowState>(() => idleFlow());
  const [workoutCustomizePrefs, setWorkoutCustomizePrefs] = useState<WorkoutCustomizePrefs>(defaultWorkoutCustomizePrefs);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogEntry[]>([]);
  const [focusLogs, setFocusLogs] = useState<FocusLogEntry[]>([]);
  const [sessionStorageReady, setSessionStorageReady] = useState(false);
  const [dayRolloverHour, setDayRolloverHourState] = useState(DEFAULT_DAY_ROLLOVER_HOUR);
  const [cantExerciseMode, setCantExerciseModeState] = useState(false);
  const [movementSnackPrefs, setMovementSnackPrefsState] = useState<MovementSnackPrefs>(defaultMovementSnackPrefs);
  const [statsDayWindowStart, setStatsDayWindowStart] = useState(() => getStatsDayWindow().startTs);

  const phaseEndsAtMsRef = useRef(0);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const workoutCustomizePrefsRef = useRef(workoutCustomizePrefs);
  workoutCustomizePrefsRef.current = workoutCustomizePrefs;
  const movementSnackPrefsRef = useRef(movementSnackPrefs);
  movementSnackPrefsRef.current = movementSnackPrefs;
  const cantExerciseModeRef = useRef(cantExerciseMode);
  cantExerciseModeRef.current = cantExerciseMode;
  const dayRolloverHourRef = useRef(dayRolloverHour);
  dayRolloverHourRef.current = dayRolloverHour;
  const flowPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncClientRef = useRef<SyncClient | null>(null);
  const syncLeaderDeviceIdRef = useRef<string | null>(null);
  const lastPublishedAtMsRef = useRef(0);
  const processTimerEndRef = useRef<() => void>(() => {});
  const prevRemainingForTimerEndRef = useRef<number | null>(null);
  const flowLidPausedRef = useRef(false);
  const backgroundFlowStartRef = useRef(false);

  const applyFlow = useCallback((next: PersistedFlowState, phaseEndsAtMs?: number) => {
    const normalized = normalizeFlowForCantExerciseMode(next, cantExerciseModeRef.current);
    if (phaseEndsAtMs !== undefined) phaseEndsAtMsRef.current = phaseEndsAtMs;
    else if (normalized.phase !== 'idle') {
      phaseEndsAtMsRef.current = Date.now() + normalized.remainingSeconds * 1000;
    } else {
      phaseEndsAtMsRef.current = 0;
    }
    setFlow(normalized);
  }, []);

  const pickBreakWorkout = useCallback(() => pickWorkoutForBreak(workoutCustomizePrefsRef.current), []);

  const schedulePersistFlow = useCallback(() => {
    if (flowPersistTimerRef.current) clearTimeout(flowPersistTimerRef.current);
    flowPersistTimerRef.current = setTimeout(() => {
      const f = flowRef.current;
      if (f.phase === 'idle') return;
      void saveActiveFlowState(f).catch((error) => {
        console.error('Failed to persist active flow:', error);
      });
      const client = syncClientRef.current;
      if (!client) return;
      if (isSyncViewer(syncLeaderDeviceIdRef.current, client.deviceId)) return;
      const now = Date.now();
      const doc = buildActiveFlowDocument(f, client.deviceId, phaseEndsAtMsRef.current, now);
      lastPublishedAtMsRef.current = now;
      void client.publishActiveFlow(doc).catch((error) => {
        console.error('Failed to publish active flow to sync:', error);
      });
    }, 400);
  }, []);

  const bumpFocusCount = useCallback((sessionType: SessionType) => {
    if (sessionType === 'pomodoro') {
      setFlow((prev) => {
        const runPomodoros = prev.runPomodoros + 1;
        void savePomodoroBreakChain(runPomodoros, dayRolloverHourRef.current).catch((err) => {
          console.error('Failed to persist pomodoro break chain:', err);
        });
        return { ...prev, runPomodoros };
      });
    } else {
      setFlow((prev) => ({ ...prev, runDeepWork: prev.runDeepWork + 1 }));
    }
  }, []);

  const recordFocusSession = useCallback((sessionType: SessionType, completionRatio: number, phaseStartedAtMs: number, bumpCount = true) => {
    if (!isPhaseLongEnoughToLog(phaseStartedAtMs)) return;
    const ratio = Math.min(1, Math.max(0, completionRatio));
    if (ratio <= 0) return;
    const planned = SESSION_DURATIONS_MINUTES[sessionType];
    const entry: FocusLogEntry = {
      id: createPrefixedId('focus'),
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
    if (bumpCount) bumpFocusCount(sessionType);
  }, [bumpFocusCount]);

  const logActiveWorkoutIfNeeded = useCallback((completionRatio: number) => {
    const f = flowRef.current;
    if (!isPhaseLongEnoughToLog(f.phaseStartedAtMs)) return;
    const workout = f.activeWorkout;
    if (!workout || f.workoutLogged) return;
    const ratio = Math.min(1, Math.max(0, completionRatio));
    if (ratio <= 0) return;
    const scaled = scaleExercisesByRatio(workout.exercises, ratio);
    if (scaled.length === 0) return;
    const { reps, timedSeconds } = sumExerciseVolume(scaled);
    const workoutLog: WorkoutLogEntry = {
      id: createPrefixedId('workout'),
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
    setFlow((prev) => ({
      ...prev,
      workoutLogged: true,
      runExerciseTotals: mergeWorkoutExercisesIntoTotals(prev.runExerciseTotals, scaled)
    }));
  }, []);

  const resetToIdle = useCallback(() => {
    void clearActiveFlowState().catch((error) => {
      console.error('Failed to clear active flow:', error);
    });
    flowLidPausedRef.current = false;
    applyFlow(idleFlow(flowRef.current.pomodoroPosture));
  }, [applyFlow]);

  const startExerciseBreak = useCallback(() => {
    const veryLight = cantExerciseModeRef.current;
    const { flow: next, phaseEndsAtMs } = startExerciseBreakFlow(
      veryLight,
      veryLight ? null : pickBreakWorkout(),
      Date.now(),
      { runPomodoros: flowRef.current.runPomodoros }
    );
    applyFlow(next, phaseEndsAtMs);
    schedulePersistFlow();
  }, [applyFlow, pickBreakWorkout, schedulePersistFlow]);

  const startFlow = useCallback(
    (sessionType: SessionType, options?: StartFlowOptions) => {
      if (options?.background) backgroundFlowStartRef.current = true;
      const { flow: next, phaseEndsAtMs } = startFocusFlow(sessionType, Date.now(), {
        pomodoroPosture: flowRef.current.pomodoroPosture,
        runPomodoros: flowRef.current.runPomodoros
      });
      applyFlow(next, phaseEndsAtMs);
      schedulePersistFlow();
    },
    [applyFlow, schedulePersistFlow]
  );

  const takeBackgroundFlowStart = useCallback((): boolean => {
    if (!backgroundFlowStartRef.current) return false;
    backgroundFlowStartRef.current = false;
    return true;
  }, []);

  const convertFocusSession = useCallback(
    (target: SessionType) => {
      const result = convertFocusFlow(flowRef.current, target);
      if (!result.ok) return;
      recordFocusSession(result.priorSessionType, result.completionRatio, flowRef.current.phaseStartedAtMs);
      applyFlow(result.flow, result.phaseEndsAtMs);
      schedulePersistFlow();
    },
    [applyFlow, recordFocusSession, schedulePersistFlow]
  );

  const convertFlowToDeepWork = useCallback(() => convertFocusSession('deep'), [convertFocusSession]);
  const convertFlowToPomodoro = useCallback(() => convertFocusSession('pomodoro'), [convertFocusSession]);

  const finishFlow = useCallback(() => {
    const f = flowRef.current;
    if (f.phase === 'focus' && f.activeSessionType) {
      const ratio = computeCompletionRatio(f.phasePlannedSeconds, f.remainingSeconds);
      recordFocusSession(f.activeSessionType, ratio, f.phaseStartedAtMs);
    }
    resetToIdle();
    const client = syncClientRef.current;
    if (client) {
      syncLeaderDeviceIdRef.current = null;
      lastPublishedAtMsRef.current = Date.now();
      void client.publishActiveFlow(null).catch((error) => {
        console.error('Failed to clear remote active flow on stop:', error);
      });
    }
  }, [recordFocusSession, resetToIdle]);

  const pauseFlowForLid = useCallback(() => {
    if (syncMode !== 'desktop' || flowRef.current.phase === 'idle' || flowLidPausedRef.current) return;
    flowLidPausedRef.current = true;
    const rem = Math.max(0, Math.ceil((phaseEndsAtMsRef.current - Date.now()) / 1000));
    setFlow((prev) => ({ ...prev, remainingSeconds: rem }));
  }, [syncMode]);

  const resumeFlowFromLid = useCallback(() => {
    if (syncMode !== 'desktop' || !flowLidPausedRef.current) return;
    flowLidPausedRef.current = false;
    if (flowRef.current.phase === 'idle') return;
    phaseEndsAtMsRef.current = phaseEndsAtMsAfterLidResume(flowRef.current.remainingSeconds, Date.now());
  }, [syncMode]);

  const advanceCurrentBreak = useCallback(() => {
    const result = advanceBreakFlow(flowRef.current);
    if (result.kind === 'finish') {
      finishFlow();
      return;
    }
    applyFlow(result.flow, result.phaseEndsAtMs);
    schedulePersistFlow();
  }, [applyFlow, finishFlow, schedulePersistFlow]);

  useEffect(() => {
    const tick = () => {
      const { startTs } = getStatsDayWindow(Date.now(), dayRolloverHour);
      setStatsDayWindowStart((prev) => {
        if (prev === startTs) return prev;
        setFlow((f) => ({ ...f, runPomodoros: 0 }));
        void savePomodoroBreakChain(0, dayRolloverHour).catch((error) => {
          console.error('Failed to reset pomodoro break chain on day rollover:', error);
        });
        return startTs;
      });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [dayRolloverHour]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSessionStorage(), isCantExerciseModeEnabled(), loadDayRolloverHourPref()])
      .then(async ([snapshot, cantExerciseEnabled, rolloverHour]) => {
        if (cancelled) return;
        cantExerciseModeRef.current = cantExerciseEnabled;
        setCantExerciseModeState(cantExerciseEnabled);
        dayRolloverHourRef.current = rolloverHour;
        setDayRolloverHourState(rolloverHour);
        setStatsDayWindowStart(getStatsDayWindow(Date.now(), rolloverHour).startTs);
        workoutCustomizePrefsRef.current = snapshot.workoutCustomizePrefs;
        setWorkoutCustomizePrefs(snapshot.workoutCustomizePrefs);
        setMovementSnackPrefsState(snapshot.movementSnackPrefs);
        setWorkoutLogs(snapshot.workoutLogs);
        setFocusLogs(snapshot.focusLogs);
        if (snapshot.activeFlow && isResumableFlow(snapshot.activeFlow)) {
          applyFlow(snapshot.activeFlow);
          if (snapshot.activeFlow.remainingSeconds === 0) prevRemainingForTimerEndRef.current = -1;
        } else {
          const chain = await loadPomodoroBreakChain(rolloverHour);
          if (cancelled) return;
          setFlow((f) => ({ ...f, runPomodoros: chain }));
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
  }, [applyFlow]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const attach = (client: SyncClient) => {
      syncClientRef.current = client;
      unsub = client.subscribeActiveFlow((doc) => {
        if (!doc) {
          const wasViewer = shouldFollowRemoteFlowClear(syncLeaderDeviceIdRef.current, client.deviceId, flowRef.current.phase);
          syncLeaderDeviceIdRef.current = null;
          if (wasViewer) resetToIdle();
          return;
        }
        syncLeaderDeviceIdRef.current = syncLeaderDeviceIdFromDoc(doc);
        const f = doc.flow;
        if (
          syncMode === 'companion' &&
          f.phase === 'break' &&
          isActiveExerciseBreak(f.phase, f.breakVariant, f.longBreakStage, f.activeWorkout) &&
          doc.leaderDeviceId !== client.deviceId
        ) {
          const claimed = createActiveFlowDocument(f, client.deviceId, doc.phaseEndsAtMs);
          lastPublishedAtMsRef.current = Date.now();
          syncLeaderDeviceIdRef.current = client.deviceId;
          void client.publishActiveFlow(claimed);
        }
        if (!isRemoteActiveFlow(doc, client.deviceId)) return;
        if (doc.updatedAtMs <= lastPublishedAtMsRef.current) return;
        const wasLogged = flowRef.current.workoutLogged;
        const applied = applyRemoteActiveFlow(doc);
        phaseEndsAtMsRef.current = applied.phaseEndsAtMs;
        applyFlow(applied.flow, applied.phaseEndsAtMs);
        if (applied.flow.workoutLogged && !wasLogged) logActiveWorkoutIfNeeded(1);
      });
    };
    if (syncClientProp) attach(syncClientProp);
    else void createDesktopSyncClient().then((client) => { if (!cancelled) attach(client); });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [applyFlow, logActiveWorkoutIfNeeded, resetToIdle, syncClientProp, syncMode]);

  useEffect(() => {
    const client = syncClientRef.current;
    if (!client || !sessionStorageReady || flow.phase !== 'idle') return;
    if (isSyncViewer(syncLeaderDeviceIdRef.current, client.deviceId)) return;
    lastPublishedAtMsRef.current = Date.now();
    void client.publishActiveFlow(null).catch((error) => {
      console.error('Failed to clear remote active flow:', error);
    });
  }, [flow.phase, sessionStorageReady]);

  useEffect(() => {
    if (!sessionStorageReady) return;
    void saveWorkoutCustomizePrefs(workoutCustomizePrefs).catch((error) => {
      console.error('Failed to save workout customize prefs:', error);
    });
  }, [workoutCustomizePrefs, sessionStorageReady]);

  useEffect(() => {
    if (flow.phase === 'idle' || !sessionStorageReady) return;
    schedulePersistFlow();
  }, [flow, sessionStorageReady, schedulePersistFlow]);

  useEffect(() => {
    if (flow.phase === 'idle') return;
    const intervalId = window.setInterval(() => {
      if (flowLidPausedRef.current) return;
      const rem = Math.max(0, Math.ceil((phaseEndsAtMsRef.current - Date.now()) / 1000));
      setFlow((prev) => (prev.remainingSeconds === rem ? prev : { ...prev, remainingSeconds: rem }));
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [flow.phase]);

  useEffect(() => {
    if (syncMode !== 'desktop' || !isTauri()) return;
    let cancelled = false;
    let unlistenPause: (() => void) | undefined;
    let unlistenResume: (() => void) | undefined;
    void listen(FLOW_LID_PAUSE_EVENT, () => {
      if (!cancelled) pauseFlowForLid();
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenPause = fn;
    }).catch(console.error);
    void listen(FLOW_LID_RESUME_EVENT, () => {
      if (!cancelled) resumeFlowFromLid();
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenResume = fn;
    }).catch(console.error);
    return () => {
      cancelled = true;
      unlistenPause?.();
      unlistenResume?.();
    };
  }, [syncMode, pauseFlowForLid, resumeFlowFromLid]);

  useEffect(() => {
    processTimerEndRef.current = () => {
      const f = flowRef.current;
      if (f.phase === 'idle' || f.remainingSeconds !== 0) return;
      const syncClient = syncClientRef.current;
      if (isSyncViewer(syncLeaderDeviceIdRef.current, syncClient?.deviceId ?? '')) return;
      if (f.phase === 'focus' && f.activeSessionType) {
        recordFocusSession(f.activeSessionType, 1, f.phaseStartedAtMs, false);
        const completed = f.activeSessionType === 'pomodoro' ? f.runPomodoros + 1 : f.runPomodoros;
        const deepCount = f.activeSessionType === 'deep' ? f.runDeepWork + 1 : f.runDeepWork;
        if (f.activeSessionType === 'pomodoro') {
          void savePomodoroBreakChain(completed, dayRolloverHourRef.current).catch((err) => {
            console.error('Failed to persist pomodoro break chain:', err);
          });
        }
        const kind = f.activeSessionType === 'pomodoro'
          ? resolvePomodoroBreakKind(completed, cantExerciseModeRef.current)
          : 'relax';
        const longStage = resolveLongBreakExerciseStage(cantExerciseModeRef.current);
        const workout = pickBreakWorkout();
        const { flow: next, phaseEndsAtMs } = onFocusTimerEnd(f, {
          breakKind: f.activeSessionType === 'pomodoro' ? kind : 'relax',
          longStage,
          workout,
          nowMs: Date.now()
        });
        applyFlow({ ...next, runPomodoros: completed, runDeepWork: deepCount }, phaseEndsAtMs);
        return;
      }
      if (f.phase === 'break') {
        logActiveWorkoutIfNeeded(1);
        advanceCurrentBreak();
      }
    };
  }, [recordFocusSession, logActiveWorkoutIfNeeded, advanceCurrentBreak, pickBreakWorkout, applyFlow]);

  useEffect(() => {
    if (!sessionStorageReady || flow.phase === 'idle') {
      prevRemainingForTimerEndRef.current = flow.remainingSeconds;
      return;
    }
    const prev = prevRemainingForTimerEndRef.current;
    prevRemainingForTimerEndRef.current = flow.remainingSeconds;
    if (flow.remainingSeconds !== 0) return;
    if (prev === 0) return;
    processTimerEndRef.current();
  }, [flow.remainingSeconds, flow.phase, sessionStorageReady]);

  const handleWorkoutCompletion = useCallback(() => {
    const syncClient = syncClientRef.current;
    if (isSyncViewer(syncLeaderDeviceIdRef.current, syncClient?.deviceId ?? '')) return;
    const f = flowRef.current;
    if (!isActiveExerciseBreak(f.phase, f.breakVariant, f.longBreakStage, f.activeWorkout)) return;
    logActiveWorkoutIfNeeded(1);
    advanceCurrentBreak();
  }, [logActiveWorkoutIfNeeded, advanceCurrentBreak]);

  const addManualExercise = useCallback((exercise: ExerciseDefinition) => {
    const entry = buildManualExerciseLogEntry(exercise, createPrefixedId('workout'));
    setWorkoutLogs((current) => [entry, ...current].slice(0, MAX_HISTORY_ITEMS));
    void persistWorkoutLog(entry).catch((error) => {
      console.error('Failed to persist manual exercise:', error);
    });
    if (flowRef.current.phase !== 'idle') {
      setFlow((prev) => ({
        ...prev,
        runExerciseTotals: mergeWorkoutExercisesIntoTotals(prev.runExerciseTotals, [exercise])
      }));
    }
  }, []);

  const logStretchCompletion = useCallback((stretch: StretchDefinition, exercises: ExerciseDefinition[], completionRatio: number = 1) => {
    if (exercises.length === 0) return;
    const entry = buildStretchLogEntry(stretch, exercises, createPrefixedId('workout'), Date.now(), completionRatio);
    setWorkoutLogs((current) => [entry, ...current].slice(0, MAX_HISTORY_ITEMS));
    void persistWorkoutLog(entry).catch((error) => {
      console.error('Failed to persist stretch log:', error);
    });
  }, []);

  const logMorningStretchCompletion = useCallback((exercises: ExerciseDefinition[], completionRatio: number = 1) => {
    logStretchCompletion(defaultBuiltinMorningStretch(), exercises, completionRatio);
  }, [logStretchCompletion]);

  const clearMorningStretchCompletionToday = useCallback(() => {
    const now = Date.now();
    const { startTs } = getStatsDayWindow(now, dayRolloverHour);
    setWorkoutLogs((current) =>
      current.filter(
        (log) =>
          !(log.workoutId === MORNING_STRETCH_WORKOUT_ID && isTimestampInStatsDay(log.completedAt, now, dayRolloverHour))
      )
    );
    void deleteWorkoutLogsForWorkoutIdSince(MORNING_STRETCH_WORKOUT_ID, startTs).catch((error) => {
      console.error('Failed to clear morning stretch log:', error);
    });
  }, [dayRolloverHour]);

  const updateMovementSnackPrefs = useCallback((patch: Partial<MovementSnackPrefs>) => {
    setMovementSnackPrefsState((current) => {
      const next = normalizeMovementSnackPrefs({ ...current, ...patch });
      void saveMovementSnackPrefs(next).catch((error) => {
        console.error('Failed to save movement snack prefs:', error);
      });
      return next;
    });
  }, []);

  const logMovementSnackCompletion = useCallback((easy: boolean, exercises?: ExerciseDefinition[]) => {
    const defaults = easy ? movementSnackPrefsRef.current.easyExercises : movementSnackPrefsRef.current.hardExercises;
    const toLog = exercises && exercises.length > 0 ? exercises : defaults;
    if (toLog.length === 0) return;
    const entry = buildMovementSnackLogEntry(toLog, createPrefixedId('snack'), Date.now(), easy);
    setWorkoutLogs((current) => [entry, ...current].slice(0, MAX_HISTORY_ITEMS));
    void persistWorkoutLog(entry).catch((error) => {
      console.error('Failed to persist movement snack:', error);
    });
  }, []);

  const removeWorkoutLog = useCallback((id: string) => {
    setWorkoutLogs((current) => current.filter((log) => log.id !== id));
    void deleteWorkoutLogById(id).catch((error) => {
      console.error('Failed to delete workout log:', error);
    });
  }, []);

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

  const setCantExerciseMode = useCallback((enabled: boolean) => {
    cantExerciseModeRef.current = enabled;
    setCantExerciseModeState(enabled);
    void setCantExerciseModeEnabled(enabled).catch((error) => {
      console.error('Failed to save can\'t-exercise mode:', error);
    });
    const f = flowRef.current;
    if (f.phase !== 'break') return;
    if (enabled) {
      const normalized = normalizeFlowForCantExerciseMode(f, true);
      if (
        normalized.breakVariant !== f.breakVariant ||
        normalized.longBreakStage !== f.longBreakStage ||
        normalized.activeWorkout !== f.activeWorkout
      ) {
        applyFlow(normalized);
        schedulePersistFlow();
      }
      return;
    }
    if (!isVeryLightBreak(f.phase, f.breakVariant, f.longBreakStage)) return;
    const restored = restoreExerciseBreakFromVeryLight(f);
    applyFlow({
      ...f,
      breakVariant: restored.breakVariant,
      longBreakStage: restored.longBreakStage,
      activeWorkout: pickBreakWorkout(),
      workoutLogged: false
    });
    schedulePersistFlow();
  }, [applyFlow, pickBreakWorkout, schedulePersistFlow]);

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
  const todayMovementSnacks = useMemo(
    () => countMovementSnacksToday(workoutLogs, Date.now(), dayRolloverHour),
    [workoutLogs, dayRolloverHour, statsDayWindowStart]
  );

  const handleAllowedWorkoutToggle = useCallback((workoutId: string, enabled: boolean) => {
    setWorkoutCustomizePrefs((c) => applyPrefsPatch(c, patchAllowedWorkoutToggle(workoutId, enabled)));
  }, []);
  const handleStretchPickToggle = useCallback((pickKey: string, enabled: boolean) => {
    setWorkoutCustomizePrefs((c) => applyPrefsPatch(c, patchStretchPickToggle(pickKey, enabled)));
  }, []);
  const updateExerciseOverride = useCallback((exerciseId: string, amount: number, unit: ExerciseUnit) => {
    setWorkoutCustomizePrefs((c) => withExerciseOverride(c, exerciseId, amount, unit));
  }, []);
  const updateStretchHoldSeconds = useCallback((seconds: number) => {
    setWorkoutCustomizePrefs((c) => withStretchHoldSeconds(c, seconds));
  }, []);
  const addCustomExercise = useCallback((exercise: ExerciseDefinition) => {
    setWorkoutCustomizePrefs((c) => withCustomExercise(c, exercise));
  }, []);
  const removeCustomExercise = useCallback((exerciseId: string) => {
    setWorkoutCustomizePrefs((c) => applyPrefsPatch(c, patchRemoveCustomExercise(exerciseId)));
  }, []);

  const updateBreakExerciseAmount = useCallback((index: number, amount: number) => {
    if (!Number.isFinite(amount)) return;
    const rounded = Math.max(0, Math.round(amount));
    setFlow((prev) => {
      if (!prev.activeWorkout) return prev;
      const exercises = prev.activeWorkout.exercises.map((ex, i) => (i === index ? { ...ex, amount: rounded } : ex));
      return { ...prev, activeWorkout: { ...prev.activeWorkout, exercises } };
    });
  }, []);

  const setNextSessionType = useCallback((value: SessionType | null) => {
    setFlow((prev) => ({ ...prev, nextSessionType: value }));
  }, []);

  const focusDeskPosture = useMemo(() => resolveFocusDeskPosture(flow), [flow.phase, flow.activeSessionType, flow.pomodoroPosture]);
  const nextDeskPostureIfPomodoro = useMemo(() => resolveNextDeskPosture(flow), [flow]);
  const togglePomodoroDeskPosture = useCallback(() => { setFlow(togglePomodoroPosture); }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      phase: flow.phase,
      breakVariant: flow.breakVariant,
      longBreakStage: flow.longBreakStage,
      activeSessionType: flow.activeSessionType,
      remainingSeconds: flow.remainingSeconds,
      nextSessionType: flow.nextSessionType,
      setNextSessionType,
      activeWorkout: flow.activeWorkout,
      workoutLogged: flow.workoutLogged,
      runExerciseTotals: flow.runExerciseTotals,
      runPomodoros: flow.runPomodoros,
      runDeepWork: flow.runDeepWork,
      runStartedAt: flow.runStartedAt,
      workoutCustomizePrefs,
      workoutLogs,
      focusLogs,
      todayExerciseTotals,
      todayStretchTotals,
      focusToday,
      dayRolloverHour,
      setDayRolloverHour,
      cantExerciseMode,
      setCantExerciseMode,
      startFlow,
      takeBackgroundFlowStart,
      convertFlowToDeepWork,
      convertFlowToPomodoro,
      startExerciseBreak,
      finishFlow,
      handleWorkoutCompletion,
      addManualExercise,
      logStretchCompletion,
      logMorningStretchCompletion,
      clearMorningStretchCompletionToday,
      handleAllowedWorkoutToggle,
      handleStretchPickToggle,
      updateExerciseOverride,
      updateStretchHoldSeconds,
      addCustomExercise,
      removeCustomExercise,
      updateBreakExerciseAmount,
      pomodoroPosture: flow.pomodoroPosture,
      focusDeskPosture,
      nextDeskPostureIfPomodoro,
      togglePomodoroDeskPosture,
      sessionStorageReady,
      todayMovementSnacks,
      movementSnackPrefs,
      updateMovementSnackPrefs,
      logMovementSnackCompletion,
      removeWorkoutLog
    }),
    [
      flow,
      setNextSessionType,
      workoutCustomizePrefs,
      workoutLogs,
      focusLogs,
      todayExerciseTotals,
      todayStretchTotals,
      focusToday,
      dayRolloverHour,
      setDayRolloverHour,
      cantExerciseMode,
      setCantExerciseMode,
      startFlow,
      takeBackgroundFlowStart,
      convertFlowToDeepWork,
      convertFlowToPomodoro,
      startExerciseBreak,
      finishFlow,
      handleWorkoutCompletion,
      addManualExercise,
      logStretchCompletion,
      logMorningStretchCompletion,
      clearMorningStretchCompletionToday,
      handleAllowedWorkoutToggle,
      handleStretchPickToggle,
      updateExerciseOverride,
      updateStretchHoldSeconds,
      addCustomExercise,
      removeCustomExercise,
      updateBreakExerciseAmount,
      focusDeskPosture,
      nextDeskPostureIfPomodoro,
      togglePomodoroDeskPosture,
      sessionStorageReady,
      todayMovementSnacks,
      movementSnackPrefs,
      updateMovementSnackPrefs,
      logMovementSnackCompletion,
      removeWorkoutLog,
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
