import {
  mergeExerciseOverride,
  prefsHasAtLeastOneMove,
  resolveAllowedStretchPickKeys,
  resolveAllowedWorkoutIdsFromPrefs,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';
import type { ExerciseDefinition, ExerciseUnit } from '@/lib/workoutPlanner';

/** Returns null when the patch would leave zero moves enabled. */
export type PrefsPatch = (current: WorkoutCustomizePrefs) => WorkoutCustomizePrefs | null;

export const applyPrefsPatch = (current: WorkoutCustomizePrefs, patch: PrefsPatch): WorkoutCustomizePrefs => {
  const next = patch(current);
  if (!next || !prefsHasAtLeastOneMove(next)) return current;
  return next;
};

export const patchAllowedWorkoutToggle = (workoutId: string, enabled: boolean): PrefsPatch => (current) => {
  const ids = resolveAllowedWorkoutIdsFromPrefs(current);
  const nextIds = enabled ? [...new Set([...ids, workoutId])] : ids.filter((id) => id !== workoutId);
  if (!enabled && nextIds.length === 0 && resolveAllowedStretchPickKeys(current).length === 0 && current.customExercises.length === 0) return null;
  return { ...current, allowedWorkoutIds: nextIds };
};

export const patchStretchPickToggle = (pickKey: string, enabled: boolean): PrefsPatch => (current) => {
  const keys = resolveAllowedStretchPickKeys(current);
  const nextKeys = enabled ? [...new Set([...keys, pickKey])] : keys.filter((k) => k !== pickKey);
  if (!enabled && nextKeys.length === 0 && resolveAllowedWorkoutIdsFromPrefs(current).length === 0 && current.customExercises.length === 0) return null;
  return { ...current, allowedStretchPickKeys: nextKeys };
};

export const patchRemoveCustomExercise = (exerciseId: string): PrefsPatch => (current) => {
  const nextCustom = current.customExercises.filter((e) => e.id !== exerciseId);
  if (nextCustom.length === current.customExercises.length) return null;
  if (nextCustom.length === 0 && resolveAllowedWorkoutIdsFromPrefs(current).length === 0 && resolveAllowedStretchPickKeys(current).length === 0) return null;
  const exerciseOverrides = { ...current.exerciseOverrides };
  delete exerciseOverrides[exerciseId];
  return { ...current, customExercises: nextCustom, exerciseOverrides };
};

export const withExerciseOverride = (current: WorkoutCustomizePrefs, exerciseId: string, amount: number, unit: ExerciseUnit): WorkoutCustomizePrefs => {
  if (!Number.isFinite(amount)) return current;
  return {
    ...current,
    exerciseOverrides: mergeExerciseOverride(current.exerciseOverrides, exerciseId, amount, unit)
  };
};

export const withStretchHoldSeconds = (current: WorkoutCustomizePrefs, seconds: number): WorkoutCustomizePrefs => {
  if (!Number.isFinite(seconds)) return current;
  return { ...current, stretchHoldSeconds: Math.max(1, Math.round(seconds)) };
};

export const withCustomExercise = (current: WorkoutCustomizePrefs, exercise: ExerciseDefinition): WorkoutCustomizePrefs => {
  if (!exercise.id || !exercise.name) return current;
  return {
    ...current,
    customExercises: [...current.customExercises.filter((e) => e.id !== exercise.id), exercise]
  };
};
