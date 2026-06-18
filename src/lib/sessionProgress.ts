export {
  SESSION_DURATIONS_MINUTES,
  showSessionChainControls,
  breakTimerEndAction,
  MIN_PHASE_LOG_SECONDS,
  phaseElapsedSeconds,
  isPhaseLongEnoughToLog,
  canConvertFocusSession,
  focusElapsedSeconds,
  remainingSecondsWhenConvertingToDeep,
  remainingSecondsWhenConvertingToPomodoro,
  computeCompletionRatio,
  creditFocusMinutes,
  scaleExercisesByRatio,
  scaleStoredExercisesByRatio
} from '@mgmt/core';
export type { BreakTimerEndAction } from '@mgmt/core';
