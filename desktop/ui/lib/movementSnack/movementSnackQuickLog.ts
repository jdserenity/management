import { applyExerciseOverride, type WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { PREDEFINED_WORKOUTS } from '@/lib/workoutCatalogs';
import type { ExerciseDefinition, ExerciseUnit } from '@/lib/workoutTypes';
import type { MovementSnackPrefs } from './movementSnack';
import { cloneQuickLogDefaults, DEFAULT_MOVEMENT_QUICK_LOG_EXERCISES } from './quickLogDefaults';

/** Default one-tap increments on Daily → movement burst logger (+ panel). */
export const defaultMovementQuickLogExercises = (): ExerciseDefinition[] => cloneQuickLogDefaults();

export const quickLogEntryForId = (prefs: MovementSnackPrefs, exerciseId: string): ExerciseDefinition | undefined =>
  prefs.quickLogExercises.find((e) => e.id === exerciseId);

export const upsertQuickLogExercise = (list: ExerciseDefinition[], entry: ExerciseDefinition): ExerciseDefinition[] => {
  const index = list.findIndex((e) => e.id === entry.id);
  if (index < 0) return [...list, entry];
  const next = [...list];
  next[index] = entry;
  return next;
};

export const removeQuickLogExercise = (list: ExerciseDefinition[], exerciseId: string): ExerciseDefinition[] =>
  list.filter((e) => e.id !== exerciseId);

export const defaultQuickLogEntryForExercise = (exercise: ExerciseDefinition): ExerciseDefinition => {
  const preset = DEFAULT_MOVEMENT_QUICK_LOG_EXERCISES.find((row) => row.id === exercise.id);
  if (preset) return { ...preset, name: exercise.name };
  if (exercise.unit === 'reps') {
    return { id: exercise.id, name: exercise.name, amount: Math.min(10, Math.max(1, exercise.amount)), unit: 'reps' };
  }
  if (exercise.unit === 'seconds') {
    return { id: exercise.id, name: exercise.name, amount: Math.min(30, Math.max(5, exercise.amount)), unit: 'seconds' };
  }
  return { id: exercise.id, name: exercise.name, amount: 1, unit: 'minutes' };
};

export const listPickableCatalogExercises = (workoutPrefs: WorkoutCustomizePrefs): ExerciseDefinition[] => {
  const seen = new Set<string>();
  const rows: ExerciseDefinition[] = [];
  const push = (ex: ExerciseDefinition) => {
    if (seen.has(ex.id)) return;
    seen.add(ex.id);
    rows.push(applyExerciseOverride(ex, workoutPrefs.exerciseOverrides));
  };
  PREDEFINED_WORKOUTS.filter((w) => w.id !== 'stretch-mobility').forEach((w) => w.exercises.forEach(push));
  workoutPrefs.customExercises.forEach(push);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
};

export const formatQuickLogIncrementLabel = (unit: ExerciseUnit, amount: number): string => {
  if (unit === 'reps') return `+${amount}`;
  if (unit === 'seconds') return `+${amount}s`;
  return `+${amount}m`;
};
