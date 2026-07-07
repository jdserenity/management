import { describe, expect, it } from 'vitest';
import {
  focusLogEntryFromRow,
  hasLegacyLocalStorageSessionData,
  workoutLogEntryFromRow,
  type LocalStorageSessionImport
} from '@/lib/sessionDb';

describe('focusLogEntryFromRow', () => {
  it('maps deep sessions', () => {
    expect(
      focusLogEntryFromRow({
        id: 'focus-1',
        session_type: 'deep',
        completed_at: 1_700_000_000_000,
        duration_minutes: 90,
        planned_duration_minutes: 90,
        completion_ratio: 1
      })
    ).toEqual({
      id: 'focus-1',
      type: 'deep',
      completedAt: 1_700_000_000_000,
      durationMinutes: 90,
      plannedDurationMinutes: 90,
      completionRatio: 1
    });
  });

  it('defaults unknown session types to pomodoro', () => {
    expect(
      focusLogEntryFromRow({
        id: 'focus-2',
        session_type: 'unknown',
        completed_at: 42,
        duration_minutes: 25,
        planned_duration_minutes: null,
        completion_ratio: null
      }).type
    ).toBe('pomodoro');
  });
});

describe('workoutLogEntryFromRow', () => {
  it('parses exercises_json', () => {
    const entry = workoutLogEntryFromRow({
      id: 'workout-1',
      workout_id: 'push-ups',
      workout_name: 'Push-ups',
      completed_at: 99,
      exercises_json: JSON.stringify([{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }]),
      total_reps: 10,
      total_timed_seconds: 0,
      completion_ratio: 1
    });
    expect(entry.workoutId).toBe('push-ups');
    expect(entry.exercises).toHaveLength(1);
    expect(entry.totalReps).toBe(10);
  });

  it('returns empty exercises when json is invalid', () => {
    const entry = workoutLogEntryFromRow({
      id: 'workout-2',
      workout_id: 'march-spot',
      workout_name: 'March',
      completed_at: 1,
      exercises_json: '{not json',
      total_reps: 0,
      total_timed_seconds: 60,
      completion_ratio: null
    });
    expect(entry.exercises).toEqual([]);
  });
});

describe('hasLegacyLocalStorageSessionData', () => {
  it('is false for an empty import bundle', () => {
    const bundle: LocalStorageSessionImport = {
      allowedWorkoutIds: null,
      workoutLogs: [],
      focusLogs: []
    };
    expect(hasLegacyLocalStorageSessionData(bundle)).toBe(false);
  });

  it('is true when any legacy bucket has data', () => {
    expect(
      hasLegacyLocalStorageSessionData({
        allowedWorkoutIds: ['march-spot'],
        workoutLogs: [],
        focusLogs: []
      })
    ).toBe(true);
    expect(
      hasLegacyLocalStorageSessionData({
        allowedWorkoutIds: null,
        workoutLogs: [],
        focusLogs: [{ id: 'f1', type: 'pomodoro', completedAt: 1, durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 }]
      })
    ).toBe(true);
  });
});
