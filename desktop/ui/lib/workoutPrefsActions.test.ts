import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { DEFAULT_ALLOWED_WORKOUT_IDS } from '@/lib/workoutCatalogs';
import {
  applyPrefsPatch,
  patchAllowedWorkoutToggle,
  withCustomExercise,
  withExerciseOverride,
  withStretchHoldSeconds
} from '@/lib/workoutPrefsActions';

describe('workoutPrefsActions', () => {
  it('toggles a workout id off when other moves remain', () => {
    const base = {
      ...defaultWorkoutCustomizePrefs(),
      allowedWorkoutIds: [...DEFAULT_ALLOWED_WORKOUT_IDS],
      allowedStretchPickKeys: [] as string[],
      customExercises: []
    };
    const id = DEFAULT_ALLOWED_WORKOUT_IDS[0];
    const next = applyPrefsPatch(base, patchAllowedWorkoutToggle(id, false));
    expect(next.allowedWorkoutIds).not.toContain(id);
    expect(next.allowedWorkoutIds.length).toBeGreaterThan(0);
  });

  it('adds custom exercise, override, and stretch hold', () => {
    const base = defaultWorkoutCustomizePrefs();
    const withEx = withCustomExercise(base, { id: 'c1', name: 'Dip', amount: 10, unit: 'reps' });
    expect(withEx.customExercises.some((e) => e.id === 'c1')).toBe(true);
    expect(withStretchHoldSeconds(base, 12.4).stretchHoldSeconds).toBe(12);
    const over = withExerciseOverride(base, 'pushups', 12, 'reps');
    expect(over.exerciseOverrides.pushups?.amount).toBe(12);
  });
});
