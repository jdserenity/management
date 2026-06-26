import type { ExerciseDefinition, SessionType, StoredExercise } from './sessionTypes';
import type { BreakVariant, FlowPhase, LongBreakStage } from './flowState';

export const SESSION_DURATIONS_MINUTES = {
  pomodoro: 25,
  deep: 90,
  break: 5,
  longBreak: 15,
  longBreakRelax: 10
} as const;

export const showSessionChainControls = (phase: FlowPhase): boolean => phase === 'focus' || phase === 'break';

export type BreakTimerEndAction = 'long_relax' | 'start_focus' | 'finish';

export const breakTimerEndAction = (
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null,
  nextSessionType: SessionType | null
): BreakTimerEndAction => {
  if (breakVariant === 'long' && (longBreakStage === 'exercise' || longBreakStage === 'very_light')) return 'long_relax';
  if (!nextSessionType) return 'finish';
  return 'start_focus';
};

export const MIN_PHASE_LOG_SECONDS = 15;

export const phaseElapsedSeconds = (phaseStartedAtMs: number, nowMs: number = Date.now()): number =>
  Math.max(0, Math.floor((nowMs - phaseStartedAtMs) / 1000));

export const isPhaseLongEnoughToLog = (
  phaseStartedAtMs: number,
  minSeconds: number = MIN_PHASE_LOG_SECONDS,
  nowMs: number = Date.now()
): boolean => phaseElapsedSeconds(phaseStartedAtMs, nowMs) >= minSeconds;

export const canConvertFocusSession = (
  phase: 'idle' | 'focus' | 'break',
  activeSessionType: SessionType | null,
  target: SessionType
): boolean => phase === 'focus' && activeSessionType !== null && activeSessionType !== target;

export const focusElapsedSeconds = (phasePlannedSeconds: number, remainingSeconds: number): number =>
  Math.max(0, Math.min(phasePlannedSeconds, phasePlannedSeconds - Math.max(0, remainingSeconds)));

export const remainingSecondsWhenConvertingToDeep = (elapsedSeconds: number): number => {
  const deepSec = SESSION_DURATIONS_MINUTES.deep * 60;
  return Math.max(0, deepSec - elapsedSeconds);
};

export const remainingSecondsWhenConvertingToPomodoro = (elapsedSeconds: number): number => {
  const pomSec = SESSION_DURATIONS_MINUTES.pomodoro * 60;
  if (elapsedSeconds > pomSec) return pomSec;
  return Math.max(0, pomSec - elapsedSeconds);
};

export const computeCompletionRatio = (plannedSeconds: number, remainingSeconds: number): number => {
  if (plannedSeconds <= 0) return 0;
  const elapsed = plannedSeconds - Math.max(0, remainingSeconds);
  return Math.min(1, Math.max(0, elapsed / plannedSeconds));
};

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
