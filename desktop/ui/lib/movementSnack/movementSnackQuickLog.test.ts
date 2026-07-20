import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { cloneQuickLogDefaults } from './quickLogDefaults';
import {
  defaultQuickLogEntryForExercise,
  formatQuickLogIncrementLabel,
  listPickableCatalogExercises,
  quickLogEntryForId,
  removeQuickLogExercise,
  upsertQuickLogExercise
} from './movementSnackQuickLog';
import { defaultMovementSnackPrefs } from './movementSnack';

describe('movementSnackQuickLog', () => {
  it('formats increment labels for the burst logger buttons', () => {
    expect(formatQuickLogIncrementLabel('reps', 5)).toBe('+5');
    expect(formatQuickLogIncrementLabel('seconds', 30)).toBe('+30s');
    expect(formatQuickLogIncrementLabel('minutes', 1)).toBe('+1m');
  });

  it('upserts and removes quick log rows by exercise id', () => {
    const base = cloneQuickLogDefaults();
    const updated = upsertQuickLogExercise(base, { id: 'pushups', name: 'Push-ups', amount: 8, unit: 'reps' });
    expect(updated.find((e) => e.id === 'pushups')?.amount).toBe(8);
    expect(upsertQuickLogExercise(updated, { id: 'plank', name: 'Plank', amount: 20, unit: 'seconds' })).toHaveLength(base.length + 1);
    expect(removeQuickLogExercise(updated, 'pushups')).toHaveLength(base.length - 1);
  });

  it('finds quick log entries on prefs', () => {
    const prefs = defaultMovementSnackPrefs();
    expect(quickLogEntryForId(prefs, 'pushups')?.amount).toBe(5);
    expect(quickLogEntryForId(prefs, 'missing')).toBeUndefined();
  });

  it('lists catalog exercises from workouts and custom moves', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    const ids = listPickableCatalogExercises(prefs).map((e) => e.id);
    expect(ids).toContain('pushups');
    expect(ids).toContain('plank');
  });

  it('picks sensible defaults when adding a catalog move to quick log', () => {
    const plank = defaultQuickLogEntryForExercise({ id: 'plank', name: 'Plank', amount: 45, unit: 'seconds' });
    expect(plank.amount).toBe(30);
    const custom = defaultQuickLogEntryForExercise({ id: 'custom-1', name: 'Rows', amount: 12, unit: 'reps' });
    expect(custom.amount).toBe(10);
  });
});
