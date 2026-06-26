import { DEFAULT_STRETCH_PICK_KEYS, type WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { pickWorkoutForBreak, type WorkoutDefinition } from '@/lib/workoutPlanner';

export const POMODORO_EXERCISE_BREAK_INTERVAL = 2;

export const DISCREET_BREAK_WORKOUT_IDS = ['march-spot'] as const;

export const isDiscreetBreakExerciseId = (id: string): boolean => id === 'march' || id.startsWith('stretch-');

export const isDiscreetBreakWorkout = (workout: WorkoutDefinition | null | undefined): boolean =>
  !!workout && workout.exercises.length > 0 && workout.exercises.every((e) => isDiscreetBreakExerciseId(e.id));

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

export const pickBreakWorkoutFromPrefs = (
  prefs: WorkoutCustomizePrefs,
  cantExerciseMode: boolean,
  randomValue?: number
): WorkoutDefinition =>
  pickWorkoutForBreak(cantExerciseMode ? applyCantExerciseModePrefs(prefs) : prefs, randomValue);

/** Re-pick when can't-exercise mode is on but the stored break still has heavy moves. */
export const refineBreakWorkoutForCantExerciseMode = (
  workout: WorkoutDefinition | null,
  cantExerciseMode: boolean,
  prefs: WorkoutCustomizePrefs,
  randomValue?: number
): WorkoutDefinition | null => {
  if (!workout || !cantExerciseMode || isDiscreetBreakWorkout(workout)) return workout;
  return pickBreakWorkoutFromPrefs(prefs, true, randomValue);
};
