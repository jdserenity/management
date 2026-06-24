import type { BreakVariant, DeskPosture, FlowPhase, LongBreakStage, PersistedFlowState } from './flowState';
import type { SessionType, WorkoutDefinition } from './sessionTypes';
import { SESSION_DURATIONS_MINUTES, breakTimerEndAction } from './sessionProgress';

export const isActiveExerciseBreak = (
  phase: FlowPhase,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null,
  activeWorkout: WorkoutDefinition | null
): boolean =>
  phase === 'break' &&
  !!activeWorkout &&
  (breakVariant === 'short' || (breakVariant === 'long' && longBreakStage === 'exercise'));

export type BreakAdvanceResult =
  | { kind: 'long_relax'; flow: PersistedFlowState; phaseEndsAtMs: number }
  | { kind: 'start_focus'; flow: PersistedFlowState; phaseEndsAtMs: number }
  | { kind: 'finish' };

const nextPomodoroPosture = (current: DeskPosture, last: DeskPosture | null): DeskPosture => {
  if (last === null) return current;
  return last === 'sitting' ? 'standing' : 'sitting';
};

/** Same transition as break timer zero — used after Complete Workout during an exercise break. */
export const advanceBreakAfterExerciseComplete = (flow: PersistedFlowState, nowMs: number = Date.now()): BreakAdvanceResult =>
  advanceBreakWhenTimerEnds(flow, nowMs);

export const advanceBreakWhenTimerEnds = (flow: PersistedFlowState, nowMs: number = Date.now()): BreakAdvanceResult => {
  const afterBreak = breakTimerEndAction(flow.breakVariant, flow.longBreakStage, flow.nextSessionType);
  if (afterBreak === 'long_relax') {
    const relaxSec = SESSION_DURATIONS_MINUTES.longBreakRelax * 60;
    const nextFlow: PersistedFlowState = {
      ...flow,
      longBreakStage: 'relax',
      activeWorkout: null,
      workoutLogged: false,
      remainingSeconds: relaxSec,
      phasePlannedSeconds: relaxSec,
      phaseStartedAtMs: nowMs
    };
    return { kind: 'long_relax', flow: nextFlow, phaseEndsAtMs: nowMs + relaxSec * 1000 };
  }
  if (afterBreak === 'finish') return { kind: 'finish' };
  const next = flow.nextSessionType as SessionType;
  const secs = SESSION_DURATIONS_MINUTES[next] * 60;
  const nextFlow: PersistedFlowState = {
    ...flow,
    phase: 'focus',
    breakVariant: null,
    longBreakStage: null,
    activeSessionType: next,
    activeWorkout: null,
    workoutLogged: false,
    remainingSeconds: secs,
    phasePlannedSeconds: secs,
    phaseStartedAtMs: nowMs,
    nextSessionType: next === 'pomodoro' ? 'pomodoro' : null,
    pomodoroPosture: next === 'pomodoro' ? nextPomodoroPosture(flow.pomodoroPosture, flow.lastPomodoroPosture) : flow.pomodoroPosture
  };
  return { kind: 'start_focus', flow: nextFlow, phaseEndsAtMs: nowMs + secs * 1000 };
};

export const markWorkoutCompletedInFlow = (flow: PersistedFlowState): PersistedFlowState => ({
  ...flow,
  workoutLogged: true
});

export const updateBreakExerciseAmountInFlow = (
  flow: PersistedFlowState,
  index: number,
  amount: number
): PersistedFlowState => {
  if (!flow.activeWorkout || !Number.isFinite(amount)) return flow;
  const exercises = flow.activeWorkout.exercises.map((ex, i) => (i === index ? { ...ex, amount: Math.max(0, Math.round(amount)) } : ex));
  return { ...flow, activeWorkout: { ...flow.activeWorkout, exercises } };
};
