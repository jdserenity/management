import { describe, expect, it } from 'vitest';
import {
  buildMixedBreakWorkout,
  buildStretchBreakExercises,
  DEFAULT_ALLOWED_WORKOUT_IDS,
  STRETCH_DEFAULT_SECONDS,
  countTodayDeepWorkSessions,
  countTodayPomodoroSessions,
  summarizeFocusLogs,
  estimateExerciseLoadSeconds,
  exerciseRepsPart,
  exerciseTimedSecondsPart,
  formatClock,
  formatExerciseAmount,
  formatExerciseRunAggLine,
  formatWallTime,
  mergeWorkoutExercisesIntoTotals,
  pickWorkoutForBreak,
  resolveAllowedWorkoutIds,
  sumExerciseVolume,
  summarizeWorkoutLogs,
  type ExerciseRunAgg,
  type FocusLogEntry,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';

describe('resolveAllowedWorkoutIds', () => {
  it('falls back to defaults when selection is empty', () => {
    expect(resolveAllowedWorkoutIds([])).toEqual(DEFAULT_ALLOWED_WORKOUT_IDS);
  });

  it('keeps only valid workout ids', () => {
    const selected = resolveAllowedWorkoutIds(['march-spot', 'unknown']);
    expect(selected).toEqual(['march-spot']);
  });
});

describe('pickWorkoutForBreak / buildMixedBreakWorkout', () => {
  it('returns a mixed break with id mixed-break', () => {
    const workout = pickWorkoutForBreak(['march-spot', 'air-squats'], 0.99);
    expect(workout.id).toBe('mixed-break');
    expect(workout.name).toContain('Mixed');
    expect(workout.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it('only uses moves from allowed templates', () => {
    const workout = pickWorkoutForBreak(['march-spot', 'push-ups'], 0.37);
    const allowedIds = new Set(['march', 'pushups']);
    expect(workout.exercises.every((e) => allowedIds.has(e.id))).toBe(true);
  });

  it('when only stretch is allowed, exercises are stretch holds', () => {
    const workout = pickWorkoutForBreak(['stretch-mobility'], 0.21);
    expect(workout.exercises.every((e) => e.id.startsWith('stretch-'))).toBe(true);
    expect(workout.exercises.every((e) => e.unit === 'seconds')).toBe(true);
  });

  it('targets about 2–3 minutes of work by load estimate', () => {
    const workout = buildMixedBreakWorkout(DEFAULT_ALLOWED_WORKOUT_IDS, 0.555);
    const load = workout.exercises.reduce((s, e) => s + estimateExerciseLoadSeconds(e), 0);
    expect(load).toBeGreaterThanOrEqual(110);
    expect(load).toBeLessThan(400);
    expect(workout.estimatedMinutes).toBeGreaterThanOrEqual(2);
    expect(workout.estimatedMinutes).toBeLessThanOrEqual(3);
  });
});

describe('buildStretchBreakExercises', () => {
  it('returns 2 or 3 rows', () => {
    for (let i = 0; i < 40; i++) {
      const ex = buildStretchBreakExercises(i * 0.029 + 0.001);
      expect(ex.length).toBeGreaterThanOrEqual(2);
      expect(ex.length).toBeLessThanOrEqual(3);
    }
  });

  it('defaults each stretch to 15 seconds', () => {
    for (let i = 0; i < 30; i++) {
      const ex = buildStretchBreakExercises(i * 0.041);
      ex.forEach((row) => {
        expect(row.amount).toBe(STRETCH_DEFAULT_SECONDS);
        expect(row.unit).toBe('seconds');
      });
    }
  });

  it('never uses stretch-fill placeholder ids', () => {
    for (let i = 0; i < 80; i++) {
      const ex = buildStretchBreakExercises(i * 0.011 + 0.002);
      expect(ex.every((e) => !e.id.startsWith('stretch-fill'))).toBe(true);
    }
  });

  it('schedules both legs when one-leg toe touch appears', () => {
    for (let i = 0; i < 250; i++) {
      const ex = buildStretchBreakExercises(i * 0.019 + 0.003);
      const hasL = ex.some((e) => e.id === 'stretch-toe-one-L');
      const hasR = ex.some((e) => e.id === 'stretch-toe-one-R');
      expect(hasL).toBe(hasR);
    }
  });
});

describe('sumExerciseVolume', () => {
  it('sums reps and timed units', () => {
    expect(sumExerciseVolume([
      { id: 'a', name: 'Squats', amount: 20, unit: 'reps' },
      { id: 'b', name: 'Hold', amount: 90, unit: 'seconds' },
      { id: 'c', name: 'March', amount: 1, unit: 'minutes' }
    ])).toEqual({ reps: 20, timedSeconds: 90 + 60 });
  });
});

describe('exercise parts (legacy)', () => {
  it('reads legacy reps shape', () => {
    expect(exerciseRepsPart({ id: 'x', name: 'Old', reps: 12 })).toBe(12);
    expect(exerciseTimedSecondsPart({ id: 'x', name: 'Old', reps: 12 })).toBe(0);
  });
});

describe('formatExerciseAmount', () => {
  it('formats units', () => {
    expect(formatExerciseAmount({ id: 'j', name: 'Jacks', amount: 30, unit: 'reps' })).toBe('30 reps');
    expect(formatExerciseAmount({ id: 's', name: 'Box', amount: 90, unit: 'seconds' })).toBe('90s');
    expect(formatExerciseAmount({ id: 'm', name: 'March', amount: 1, unit: 'minutes' })).toBe('1 min');
  });
});

describe('formatWallTime', () => {
  it('returns a non-empty string', () => {
    const s = formatWallTime(new Date(2026, 4, 14, 15, 30, 0).getTime());
    expect(s.length).toBeGreaterThan(0);
  });
});

describe('summarizeWorkoutLogs', () => {
  it('builds all-time and rolling totals', () => {
    const now = new Date(2026, 4, 14, 12, 0, 0).getTime();
    const logs: WorkoutLogEntry[] = [
      {
        id: 'w1',
        workoutId: 'march-spot',
        workoutName: '🚶‍♂️ Walking / Marching on the Spot',
        completedAt: new Date(2026, 4, 14, 9, 0, 0).getTime(),
        exercises: [],
        totalReps: 20,
        totalTimedSeconds: 60
      },
      {
        id: 'w2',
        workoutId: 'push-ups',
        workoutName: '💪 Push-ups',
        completedAt: new Date(2026, 4, 10, 9, 0, 0).getTime(),
        exercises: [],
        totalReps: 10,
        totalTimedSeconds: 0
      },
      {
        id: 'w3',
        workoutId: 'stretch-mobility',
        workoutName: '🧘 Stretching / Mobility',
        completedAt: new Date(2026, 3, 10, 9, 0, 0).getTime(),
        exercises: [],
        totalReps: 15,
        totalTimedSeconds: 120
      }
    ];
    const totals = summarizeWorkoutLogs(logs, now);
    expect(totals.totalReps).toBe(45);
    expect(totals.totalTimedSeconds).toBe(180);
    expect(totals.totalWorkouts).toBe(3);
    expect(totals.last7DaysReps).toBe(30);
    expect(totals.last7DaysTimedSeconds).toBe(60);
    expect(totals.last30DaysReps).toBe(30);
    expect(totals.last30DaysTimedSeconds).toBe(60);
    expect(totals.weekly.length).toBeGreaterThanOrEqual(2);
    expect(totals.monthly.map((point) => point.bucket)).toEqual(['2026-04', '2026-05']);
  });
});

describe('countTodayDeepWorkSessions', () => {
  it('counts only deep work sessions from today', () => {
    const now = new Date(2026, 4, 14, 18, 0, 0).getTime();
    const logs: FocusLogEntry[] = [
      { id: 'f1', type: 'deep', completedAt: new Date(2026, 4, 14, 8, 0, 0).getTime(), durationMinutes: 90, plannedDurationMinutes: 90, completionRatio: 1 },
      { id: 'f2', type: 'deep', completedAt: new Date(2026, 4, 14, 14, 0, 0).getTime(), durationMinutes: 90, plannedDurationMinutes: 90, completionRatio: 1 },
      { id: 'f3', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 16, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 },
      { id: 'f4', type: 'deep', completedAt: new Date(2026, 4, 13, 21, 0, 0).getTime(), durationMinutes: 90, plannedDurationMinutes: 90, completionRatio: 1 }
    ];
    expect(countTodayDeepWorkSessions(logs, now)).toBe(2);
  });
});

describe('summarizeFocusLogs', () => {
  it('aggregates pomodoros, deep work, and focus minutes', () => {
    const now = new Date(2026, 4, 14, 18, 0, 0).getTime();
    const logs: FocusLogEntry[] = [
      { id: 'f1', type: 'deep', completedAt: new Date(2026, 4, 14, 8, 0, 0).getTime(), durationMinutes: 90, plannedDurationMinutes: 90, completionRatio: 1 },
      { id: 'f2', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 16, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 },
      { id: 'f3', type: 'pomodoro', completedAt: new Date(2026, 4, 13, 16, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 }
    ];
    const totals = summarizeFocusLogs(logs, now);
    expect(totals.totalDeepWork).toBe(1);
    expect(totals.totalPomodoros).toBe(2);
    expect(totals.totalFocusMinutes).toBe(140);
    expect(totals.todayDeepWork).toBe(1);
    expect(totals.todayPomodoros).toBe(1);
    expect(totals.last7DaysPomodoros).toBe(2);
  });
});

describe('countTodayPomodoroSessions', () => {
  it('counts only pomodoros from today', () => {
    const now = new Date(2026, 4, 14, 18, 0, 0).getTime();
    const logs: FocusLogEntry[] = [
      { id: 'f1', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 8, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 },
      { id: 'f2', type: 'pomodoro', completedAt: new Date(2026, 4, 13, 8, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 }
    ];
    expect(countTodayPomodoroSessions(logs, now)).toBe(1);
  });
});

describe('mergeWorkoutExercisesIntoTotals', () => {
  it('accumulates the same exercise id', () => {
    let prev: Record<string, ExerciseRunAgg> = {};
    prev = mergeWorkoutExercisesIntoTotals(prev, [{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }]);
    prev = mergeWorkoutExercisesIntoTotals(prev, [{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }]);
    expect(prev.pushups.reps).toBe(20);
  });
});

describe('formatExerciseRunAggLine', () => {
  it('formats reps and timed parts', () => {
    expect(formatExerciseRunAggLine({ id: 'pushups', label: 'Push-ups', reps: 30, timedSeconds: 0 })).toBe('Push-ups · 30 pushups');
    expect(formatExerciseRunAggLine({ id: 'jacks', label: 'Jumping jacks', reps: 30, timedSeconds: 0 })).toBe('Jumping jacks · 30 reps');
    expect(formatExerciseRunAggLine({ id: 's', label: 'Shadow', reps: 0, timedSeconds: 90 })).toBe('Shadow · 90s');
    expect(formatExerciseRunAggLine({ id: 'm', label: 'March', reps: 0, timedSeconds: 120 })).toBe('March · 2 min');
  });
});

describe('formatClock', () => {
  it('formats mm:ss', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(0)).toBe('00:00');
  });
});
