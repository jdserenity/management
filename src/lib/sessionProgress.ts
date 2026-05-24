import { SESSION_DURATIONS_MINUTES, type ExerciseDefinition, type SessionType, type StoredExercise } from '@/lib/workoutPlanner';

/** Shorter phases are treated as accidental starts and are not logged. */
export const MIN_PHASE_LOG_SECONDS = 15;

export const phaseElapsedSeconds = (phaseStartedAtMs: number, nowMs: number = Date.now()): number =>
  Math.max(0, Math.floor((nowMs - phaseStartedAtMs) / 1000));

export const isPhaseLongEnoughToLog = (
  phaseStartedAtMs: number,
  minSeconds: number = MIN_PHASE_LOG_SECONDS,
  nowMs: number = Date.now()
): boolean => phaseElapsedSeconds(phaseStartedAtMs, nowMs) >= minSeconds;

/** Whole flows shorter than this are hidden from Session totals (same threshold as phase logging). */
export const isFlowLongEnoughToDisplay = (
  startedAtMs: number,
  endedAtMs: number = Date.now(),
  minSeconds: number = MIN_PHASE_LOG_SECONDS
): boolean => endedAtMs - startedAtMs >= minSeconds * 1000;

export const canConvertFocusSession = (
  phase: 'idle' | 'focus' | 'break',
  activeSessionType: SessionType | null,
  target: SessionType
): boolean => phase === 'focus' && activeSessionType !== null && activeSessionType !== target;

/** Elapsed seconds in the current focus phase from planned length and remaining time. */
export const focusElapsedSeconds = (phasePlannedSeconds: number, remainingSeconds: number): number =>
  Math.max(0, Math.min(phasePlannedSeconds, phasePlannedSeconds - Math.max(0, remainingSeconds)));

/** Deep work time left after pomodoro focus: 90 min minus elapsed focus time. */
export const remainingSecondsWhenConvertingToDeep = (elapsedSeconds: number): number => {
  const deepSec = SESSION_DURATIONS_MINUTES.deep * 60;
  return Math.max(0, deepSec - elapsedSeconds);
};

/** Pomodoro time left after deep focus: 25 min minus elapsed, or full 25 min if elapsed > 25 min. */
export const remainingSecondsWhenConvertingToPomodoro = (elapsedSeconds: number): number => {
  const pomSec = SESSION_DURATIONS_MINUTES.pomodoro * 60;
  if (elapsedSeconds > pomSec) return pomSec;
  return Math.max(0, pomSec - elapsedSeconds);
};

/** Fraction of the phase completed (0–1). `remainingSeconds` is time left in the phase. */
export const computeCompletionRatio = (plannedSeconds: number, remainingSeconds: number): number => {
  if (plannedSeconds <= 0) return 0;
  const elapsed = plannedSeconds - Math.max(0, remainingSeconds);
  return Math.min(1, Math.max(0, elapsed / plannedSeconds));
};

/** Credited focus minutes for stats from planned length and completion ratio. */
export const creditFocusMinutes = (plannedMinutes: number, completionRatio: number): number => {
  const ratio = Math.min(1, Math.max(0, completionRatio));
  if (ratio <= 0) return 0;
  const credited = Math.round(plannedMinutes * ratio);
  return credited < 1 ? 1 : credited;
};

export const scaleExercisesByRatio = (exercises: ExerciseDefinition[], completionRatio: number): ExerciseDefinition[] => {
  const ratio = Math.min(1, Math.max(0, completionRatio));
  if (ratio <= 0) return [];
  return exercises
    .map((ex) => ({ ...ex, amount: Math.max(0, Math.round(ex.amount * ratio)) }))
    .filter((ex) => ex.amount > 0);
};

export const scaleStoredExercisesByRatio = (exercises: StoredExercise[], completionRatio: number): StoredExercise[] => {
  const ratio = Math.min(1, Math.max(0, completionRatio));
  if (ratio <= 0) return [];
  return exercises
    .map((ex) => {
      if ('unit' in ex) return { ...ex, amount: Math.max(0, Math.round(ex.amount * ratio)) };
      if ('reps' in ex) return { ...ex, reps: Math.max(0, Math.round(ex.reps * ratio)) };
      return ex;
    })
    .filter((ex) => {
      if ('unit' in ex) return ex.amount > 0;
      if ('reps' in ex) return ex.reps > 0;
      return true;
    });
};
