/**
 * Pure focus/break flow transitions. React applies results; no side effects here.
 */
import type { BreakVariant, DeskPosture, LongBreakStage, PersistedFlowState } from './flowState';
import type { SessionType, WorkoutDefinition, ExerciseRunAgg } from './sessionTypes';
import {
  SESSION_DURATIONS_MINUTES,
  canConvertFocusSession,
  computeCompletionRatio,
  focusElapsedSeconds,
  remainingSecondsWhenConvertingToDeep,
  remainingSecondsWhenConvertingToPomodoro
} from './sessionProgress';
import { advanceBreakWhenTimerEnds, type BreakAdvanceResult } from './breakFlow';
import type { LongBreakExerciseStage, PomodoroBreakKind } from './exerciseMode';

export const emptyExerciseTotals = (): Record<string, ExerciseRunAgg> => ({});

export const idleFlow = (pomodoroPosture: DeskPosture = 'sitting'): PersistedFlowState => ({
  version: 1,
  phase: 'idle',
  breakVariant: null,
  longBreakStage: null,
  activeSessionType: null,
  remainingSeconds: 0,
  phasePlannedSeconds: 0,
  phaseStartedAtMs: 0,
  nextSessionType: null,
  activeWorkout: null,
  workoutLogged: false,
  runStartedAt: null,
  runPomodoros: 0,
  runDeepWork: 0,
  runExerciseTotals: emptyExerciseTotals(),
  pomodoroPosture,
  lastPomodoroPosture: null
});

export type FlowTimerResult = { flow: PersistedFlowState; phaseEndsAtMs: number };

const withTimer = (flow: PersistedFlowState, seconds: number, planned: number, nowMs: number): FlowTimerResult => ({
  flow: {
    ...flow,
    remainingSeconds: seconds,
    phasePlannedSeconds: planned,
    phaseStartedAtMs: nowMs
  },
  phaseEndsAtMs: nowMs + seconds * 1000
});

const nextPomodoroPosture = (last: DeskPosture | null): DeskPosture =>
  last === null ? 'sitting' : last === 'sitting' ? 'standing' : 'sitting';

export const startFocusFlow = (
  sessionType: SessionType,
  nowMs: number = Date.now(),
  opts: { pomodoroPosture?: DeskPosture; runPomodoros?: number } = {}
): FlowTimerResult => {
  const secs = SESSION_DURATIONS_MINUTES[sessionType] * 60;
  const pomodoroPosture = opts.pomodoroPosture ?? 'sitting';
  return withTimer(
    {
      ...idleFlow(sessionType === 'pomodoro' ? 'sitting' : pomodoroPosture),
      phase: 'focus',
      activeSessionType: sessionType,
      nextSessionType: 'pomodoro',
      runStartedAt: nowMs,
      runPomodoros: opts.runPomodoros ?? 0,
      pomodoroPosture: sessionType === 'pomodoro' ? 'sitting' : pomodoroPosture
    },
    secs,
    secs,
    nowMs
  );
};

export const startExerciseBreakFlow = (
  veryLight: boolean,
  workout: WorkoutDefinition | null,
  nowMs: number = Date.now(),
  opts: { runPomodoros?: number } = {}
): FlowTimerResult => {
  const secs = SESSION_DURATIONS_MINUTES.break * 60;
  return withTimer(
    {
      ...idleFlow(),
      phase: 'break',
      breakVariant: veryLight ? 'very_light' : 'short',
      longBreakStage: null,
      activeWorkout: veryLight ? null : workout,
      workoutLogged: false,
      runStartedAt: nowMs,
      runPomodoros: opts.runPomodoros ?? 0,
      runExerciseTotals: emptyExerciseTotals()
    },
    secs,
    secs,
    nowMs
  );
};

export type ConvertFocusResult =
  | { ok: false }
  | { ok: true; flow: PersistedFlowState; phaseEndsAtMs: number; priorSessionType: SessionType; completionRatio: number };

export const convertFocusFlow = (
  flow: PersistedFlowState,
  target: SessionType,
  nowMs: number = Date.now()
): ConvertFocusResult => {
  if (!canConvertFocusSession(flow.phase, flow.activeSessionType, target)) return { ok: false };
  const prior = flow.activeSessionType!;
  const elapsed = focusElapsedSeconds(flow.phasePlannedSeconds, flow.remainingSeconds);
  const ratio = computeCompletionRatio(flow.phasePlannedSeconds, flow.remainingSeconds);
  const planned = SESSION_DURATIONS_MINUTES[target] * 60;
  const remaining =
    target === 'deep' ? remainingSecondsWhenConvertingToDeep(elapsed) : remainingSecondsWhenConvertingToPomodoro(elapsed);
  let pomodoroPosture = flow.pomodoroPosture;
  if (target === 'pomodoro') pomodoroPosture = nextPomodoroPosture(flow.lastPomodoroPosture);
  const next = withTimer(
    {
      ...flow,
      activeSessionType: target,
      nextSessionType: 'pomodoro',
      pomodoroPosture
    },
    remaining,
    planned,
    nowMs
  );
  return { ok: true, ...next, priorSessionType: prior, completionRatio: ratio };
};

export const onFocusTimerEnd = (
  flow: PersistedFlowState,
  opts: {
    breakKind: PomodoroBreakKind;
    longStage: LongBreakExerciseStage;
    workout: WorkoutDefinition | null;
    nowMs?: number;
  }
): FlowTimerResult => {
  const nowMs = opts.nowMs ?? Date.now();
  const secs = SESSION_DURATIONS_MINUTES.break * 60;
  const sessionType = flow.activeSessionType;
  if (sessionType === 'pomodoro') {
    let breakVariant: BreakVariant = 'short';
    let activeWorkout: WorkoutDefinition | null = null;
    if (opts.breakKind === 'exercise') {
      breakVariant = 'short';
      activeWorkout = opts.workout;
    } else if (opts.breakKind === 'very_light') {
      breakVariant = 'very_light';
    }
    return withTimer(
      {
        ...flow,
        phase: 'break',
        breakVariant,
        longBreakStage: null,
        activeWorkout,
        workoutLogged: false,
        lastPomodoroPosture: flow.pomodoroPosture
      },
      secs,
      secs,
      nowMs
    );
  }
  // deep → long break
  return withTimer(
    {
      ...flow,
      phase: 'break',
      breakVariant: 'long',
      longBreakStage: opts.longStage,
      activeWorkout: opts.longStage === 'exercise' ? opts.workout : null,
      workoutLogged: false
    },
    secs,
    secs,
    nowMs
  );
};

export const advanceBreakFlow = (flow: PersistedFlowState, nowMs: number = Date.now()): BreakAdvanceResult =>
  advanceBreakWhenTimerEnds(flow, nowMs);

export const applyPhaseEndsAt = (flow: PersistedFlowState, phaseEndsAtMs: number, nowMs: number = Date.now()): PersistedFlowState => ({
  ...flow,
  remainingSeconds: Math.max(0, Math.ceil((phaseEndsAtMs - nowMs) / 1000))
});

export type { BreakAdvanceResult, LongBreakStage };
