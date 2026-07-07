import type { BreakVariant, FlowPhase, LongBreakStage, PersistedFlowState } from '@/lib/flowState';

export const POMODORO_EXERCISE_BREAK_INTERVAL = 2;

export const VERY_LIGHT_BREAK_EMOJI = '🫖';
export const VERY_LIGHT_BREAK_TITLE = `${VERY_LIGHT_BREAK_EMOJI} Very Light Break`;
export const VERY_LIGHT_BREAK_HINT =
  'You are in a quiet space — no stretches or exercises. Stand up for water or the bathroom, or take a quiet moment on your phone.';

export type PomodoroBreakKind = 'relax' | 'exercise' | 'very_light';
export type LongBreakExerciseStage = 'exercise' | 'very_light';

/** Guided exercise on pomodoro short breaks runs every N completed pomodoros in the current chain (default 2). */
export const shouldScheduleExerciseOnPomodoroBreak = (completedPomodorosInRun: number): boolean =>
  completedPomodorosInRun > 0 && completedPomodorosInRun % POMODORO_EXERCISE_BREAK_INTERVAL === 0;

export const resolvePomodoroBreakKind = (completedPomodorosInRun: number, cantExerciseMode: boolean): PomodoroBreakKind => {
  if (!shouldScheduleExerciseOnPomodoroBreak(completedPomodorosInRun)) return 'relax';
  return cantExerciseMode ? 'very_light' : 'exercise';
};

export const resolveLongBreakExerciseStage = (cantExerciseMode: boolean): LongBreakExerciseStage =>
  cantExerciseMode ? 'very_light' : 'exercise';

export const isVeryLightBreak = (
  phase: FlowPhase,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null
): boolean =>
  phase === 'break' &&
  (breakVariant === 'very_light' || (breakVariant === 'long' && longBreakStage === 'very_light'));

/** When can't-exercise mode is on, swap in-progress exercise breaks to very light breaks. */
export const normalizeFlowForCantExerciseMode = (
  flow: PersistedFlowState,
  cantExerciseMode: boolean
): PersistedFlowState => {
  if (!cantExerciseMode || flow.phase !== 'break') return flow;
  if (isVeryLightBreak(flow.phase, flow.breakVariant, flow.longBreakStage)) {
    return { ...flow, activeWorkout: null, workoutLogged: false };
  }
  const inExerciseBreak =
    (flow.breakVariant === 'short' && !!flow.activeWorkout) ||
    (flow.breakVariant === 'long' && flow.longBreakStage === 'exercise');
  if (!inExerciseBreak) return flow;
  if (flow.breakVariant === 'long') {
    return { ...flow, longBreakStage: 'very_light', activeWorkout: null, workoutLogged: false };
  }
  return { ...flow, breakVariant: 'very_light', activeWorkout: null, workoutLogged: false };
};

/** Restore a normal exercise break when can't-exercise mode is turned off mid very light break. */
export const restoreExerciseBreakFromVeryLight = (
  flow: PersistedFlowState
): Pick<PersistedFlowState, 'breakVariant' | 'longBreakStage'> => {
  if (flow.breakVariant === 'long' && flow.longBreakStage === 'very_light') {
    return { breakVariant: 'long', longBreakStage: 'exercise' };
  }
  return { breakVariant: 'short', longBreakStage: null };
};
