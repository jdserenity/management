import {
  defaultWorkoutCustomizePrefs,
  DEFAULT_STRETCH_PICK_KEYS,
  resolveAllowedStretchPickKeys,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';

export const POMODORO_EXERCISE_BREAK_INTERVAL = 2;

export const DISCREET_BREAK_WORKOUT_IDS = ['march-spot'] as const;

/** Guided exercise on pomodoro short breaks runs every N completed pomodoros in the current chain (default 2). */
export const shouldScheduleExerciseOnPomodoroBreak = (completedPomodorosInRun: number): boolean =>
  completedPomodorosInRun > 0 && completedPomodorosInRun % POMODORO_EXERCISE_BREAK_INTERVAL === 0;

/** When "can't exercise" mode is on, breaks use walking/marching and stretches only. */
export const applyCantExerciseModePrefs = (prefs: WorkoutCustomizePrefs): WorkoutCustomizePrefs => {
  const validStretch = new Set(DEFAULT_STRETCH_PICK_KEYS);
  const userStretches = prefs.allowedStretchPickKeys.filter((k) => validStretch.has(k as (typeof DEFAULT_STRETCH_PICK_KEYS)[number]));
  const allowedStretchPickKeys = userStretches.length > 0 ? userStretches : [...DEFAULT_STRETCH_PICK_KEYS];
  const userMarch = prefs.allowedWorkoutIds.filter((id) => (DISCREET_BREAK_WORKOUT_IDS as readonly string[]).includes(id));
  const allowedWorkoutIds = userMarch.length > 0 ? userMarch : [...DISCREET_BREAK_WORKOUT_IDS];
  return {
    ...prefs,
    allowedWorkoutIds,
    allowedStretchPickKeys,
    customExercises: []
  };
};
