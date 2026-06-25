import { describe, expect, it } from 'vitest';
import {
  defaultWorkoutCustomizePrefs,
  exerciseDefinitionTimedSeconds,
  fillsEntireExerciseBreak,
  formatTimedDuration,
  normalizeWorkoutCustomizePrefs,
  stretchHoldSecondsForPickKey,
  STRETCH_DEFAULT_SECONDS,
  STRETCH_ROLL_HOLD_SECONDS,
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

describe('stretchHoldSecondsForPickKey', () => {
  it('uses 30s for neck and hip rolls and 20s for other stretches by default', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    expect(STRETCH_DEFAULT_SECONDS).toBe(20);
    expect(STRETCH_ROLL_HOLD_SECONDS).toBe(30);
    expect(stretchHoldSecondsForPickKey('stretch-neck-roll', prefs)).toBe(30);
    expect(stretchHoldSecondsForPickKey('stretch-hip-roll', prefs)).toBe(30);
    expect(stretchHoldSecondsForPickKey('stretch-foot', prefs)).toBe(20);
    expect(stretchHoldSecondsForPickKey('stretch-butterfly', prefs)).toBe(20);
  });
});

describe('normalizeWorkoutCustomizePrefs', () => {
  it('maps legacy stretch-mobility to all stretch picks', () => {
    const prefs = normalizeWorkoutCustomizePrefs(null, ['stretch-mobility', 'push-ups']);
    expect(prefs.allowedWorkoutIds).toContain('push-ups');
    expect(prefs.allowedStretchPickKeys.length).toBe(10);
  });

  it('defaults when empty', () => {
    const prefs = normalizeWorkoutCustomizePrefs(null, null);
    expect(prefs.allowedWorkoutIds.length).toBeGreaterThan(0);
    expect(prefs.allowedStretchPickKeys.length).toBe(10);
    expect(prefs).toEqual(defaultWorkoutCustomizePrefs());
  });
});
