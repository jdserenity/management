import { describe, expect, it } from 'vitest';
import {
  defaultWorkoutCustomizePrefs,
  exerciseDefinitionTimedSeconds,
  fillsEntireExerciseBreak,
  formatTimedDuration,
  normalizeWorkoutCustomizePrefs,
  timedExerciseNeedsFillBreakConfirm
} from '@/lib/workoutCustomize';

describe('formatTimedDuration', () => {
  it('shows 60s for exactly one minute', () => {
    expect(formatTimedDuration(60)).toBe('60s');
  });

  it('shows min and sec above one minute', () => {
    expect(formatTimedDuration(75)).toBe('1 min 15s');
    expect(formatTimedDuration(120)).toBe('2 min');
  });

  it('shows seconds below one minute', () => {
    expect(formatTimedDuration(45)).toBe('45s');
  });
});

describe('fillsEntireExerciseBreak', () => {
  it('uses three minute budget minus stretch hold', () => {
    expect(fillsEntireExerciseBreak(164, 15)).toBe(false);
    expect(fillsEntireExerciseBreak(165, 15)).toBe(true);
    expect(fillsEntireExerciseBreak(180, 15)).toBe(true);
  });
});

describe('timedExerciseNeedsFillBreakConfirm', () => {
  it('ignores rep-based exercises', () => {
    expect(timedExerciseNeedsFillBreakConfirm({ id: 'p', name: 'Push', amount: 200, unit: 'reps' }, 15)).toBe(false);
  });

  it('confirms long timed exercises', () => {
    expect(timedExerciseNeedsFillBreakConfirm({ id: 's', name: 'Hold', amount: 165, unit: 'seconds' }, 15)).toBe(true);
    expect(timedExerciseNeedsFillBreakConfirm({ id: 'm', name: 'March', amount: 3, unit: 'minutes' }, 15)).toBe(true);
    expect(exerciseDefinitionTimedSeconds({ id: 'm', name: 'March', amount: 3, unit: 'minutes' })).toBe(180);
  });
});

describe('normalizeWorkoutCustomizePrefs', () => {
  it('maps legacy stretch-mobility to all stretch picks', () => {
    const prefs = normalizeWorkoutCustomizePrefs(null, ['stretch-mobility', 'push-ups']);
    expect(prefs.allowedWorkoutIds).toContain('push-ups');
    expect(prefs.allowedStretchPickKeys.length).toBe(8);
  });

  it('defaults when empty', () => {
    const prefs = normalizeWorkoutCustomizePrefs(null, null);
    expect(prefs.allowedWorkoutIds.length).toBeGreaterThan(0);
    expect(prefs.allowedStretchPickKeys.length).toBe(8);
    expect(prefs).toEqual(defaultWorkoutCustomizePrefs());
  });
});
