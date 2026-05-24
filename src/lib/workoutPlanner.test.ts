import { describe, expect, it } from 'vitest';
import {
  buildManualExerciseLogEntry,
  buildMixedBreakWorkout,
  buildStretchBreakExercises,
  DEFAULT_ALLOWED_WORKOUT_IDS,
  STRETCH_DEFAULT_SECONDS,
  countTodayDeepWorkSessions,
  countTodayPomodoroSessions,
  mergePeriodStats,
  summarizeFocusLogs,
  summarizeFocusToday,
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
  workoutBilateralPairsComplete,
  sumExerciseVolume,
  summarizeTodayExerciseTotals,
  summarizeTodayStretchTotals,
  stretchBodyRegionForId,
  formatTimedSecondsTotal,
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

  it('does not repeat the same exercise id in one break', () => {
    for (let i = 0; i < 50; i++) {
      const workout = buildMixedBreakWorkout(DEFAULT_ALLOWED_WORKOUT_IDS, i * 0.017 + 0.01);
      const ids = workout.exercises.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('always pairs left and right stretch sides in one break', () => {
    for (let i = 0; i < 80; i++) {
      const workout = buildMixedBreakWorkout(DEFAULT_ALLOWED_WORKOUT_IDS, i * 0.013 + 0.02);
      expect(workoutBilateralPairsComplete(workout.exercises)).toBe(true);
    }
  });
});

describe('summarizeTodayExerciseTotals', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayNoon = new Date('2026-05-24T12:00:00').getTime();

  it('sums only logs from the current stats day (midnight rollover)', () => {
    const logs: WorkoutLogEntry[] = [
      buildManualExerciseLogEntry({ id: 'pushups', name: 'Push-ups', amount: 5, unit: 'reps' }, 'w1', todayNoon),
      buildManualExerciseLogEntry({ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }, 'w2', todayNoon + 1000),
      buildManualExerciseLogEntry({ id: 'pushups', name: 'Push-ups', amount: 99, unit: 'reps' }, 'w3', todayNoon - dayMs)
    ];
    const totals = summarizeTodayExerciseTotals(logs, todayNoon, 0);
    expect(totals.pushups?.reps).toBe(15);
  });

  it('uses configurable rollover hour (4am default)', () => {
    const beforeRollover = new Date(2026, 4, 24, 3, 0, 0).getTime();
    const afterRollover = new Date(2026, 4, 24, 5, 0, 0).getTime();
    const logs: WorkoutLogEntry[] = [
      buildManualExerciseLogEntry({ id: 'pushups', name: 'Push-ups', amount: 5, unit: 'reps' }, 'w1', beforeRollover),
      buildManualExerciseLogEntry({ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }, 'w2', afterRollover)
    ];
    const totals = summarizeTodayExerciseTotals(logs, afterRollover, 4);
    expect(totals.pushups?.reps).toBe(10);
  });

  it('returns empty record when there are no logs today', () => {
    expect(summarizeTodayExerciseTotals([], todayNoon)).toEqual({});
  });
});

describe('summarizeTodayStretchTotals', () => {
  const todayNoon = new Date('2026-05-24T12:00:00').getTime();

  it('maps stretch ids to upper vs lower body', () => {
    expect(stretchBodyRegionForId('stretch-neck-roll')).toBe('upper');
    expect(stretchBodyRegionForId('stretch-lateral-shoulder-L')).toBe('upper');
    expect(stretchBodyRegionForId('stretch-butterfly')).toBe('lower');
    expect(stretchBodyRegionForId('pushups')).toBeNull();
  });

  it('sums all stretch seconds by region for today only', () => {
    const logs: WorkoutLogEntry[] = [
      {
        id: 'w1',
        workoutId: 'stretch-mobility',
        workoutName: 'Stretch',
        completedAt: todayNoon,
        exercises: [
          { id: 'stretch-neck-roll', name: 'Neck Roll', amount: 15, unit: 'seconds' },
          { id: 'stretch-butterfly', name: 'Butterfly', amount: 15, unit: 'seconds' },
          { id: 'stretch-quad-standing-L', name: 'Quad L', amount: 15, unit: 'seconds' }
        ],
        totalReps: 0,
        totalTimedSeconds: 45
      }
    ];
    expect(summarizeTodayStretchTotals(logs, todayNoon, 0)).toEqual({ upperBodySeconds: 15, lowerBodySeconds: 30 });
  });

  it('formats second and minute stretch totals', () => {
    expect(formatTimedSecondsTotal(0)).toBe('0');
    expect(formatTimedSecondsTotal(45)).toBe('45s');
    expect(formatTimedSecondsTotal(120)).toBe('2 min');
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

  it('schedules both sides for every bilateral stretch pick', () => {
    for (let i = 0; i < 250; i++) {
      const ex = buildStretchBreakExercises(i * 0.019 + 0.003);
      expect(workoutBilateralPairsComplete(ex)).toBe(true);
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
    const logs: FocusLogEntry[] = [
      { id: 'f1', type: 'deep', completedAt: new Date(2026, 4, 14, 8, 0, 0).getTime(), durationMinutes: 90, plannedDurationMinutes: 90, completionRatio: 1 },
      { id: 'f2', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 16, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 },
      { id: 'f3', type: 'pomodoro', completedAt: new Date(2026, 4, 13, 16, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 }
    ];
    const totals = summarizeFocusLogs(logs);
    expect(totals.totalDeepWork).toBe(1);
    expect(totals.totalPomodoros).toBe(2);
    expect(totals.totalFocusMinutes).toBe(140);
    expect(totals.weekly.length).toBeGreaterThanOrEqual(1);
    expect(totals.monthly.map((point) => point.bucket)).toEqual(['2026-05']);
  });
});

describe('summarizeFocusToday', () => {
  it('uses rollover hour for today counts', () => {
    const now = new Date(2026, 4, 14, 2, 0, 0).getTime();
    const logs: FocusLogEntry[] = [
      { id: 'f1', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 1, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 },
      { id: 'f2', type: 'pomodoro', completedAt: new Date(2026, 4, 13, 23, 0, 0).getTime(), durationMinutes: 25, plannedDurationMinutes: 25, completionRatio: 1 }
    ];
    expect(summarizeFocusToday(logs, now, 4).todayPomodoros).toBe(2);
    expect(summarizeFocusToday(logs, now, 0).todayPomodoros).toBe(1);
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

describe('mergePeriodStats', () => {
  it('merges workout and focus buckets by period key', () => {
    const merged = mergePeriodStats(
      [{ bucket: '2026-05-12', reps: 10, timedSeconds: 30, workouts: 1 }],
      [{ bucket: '2026-05-12', pomodoros: 2, deepWork: 1, focusMinutes: 50 }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.reps).toBe(10);
    expect(merged[0]?.pomodoros).toBe(2);
    expect(merged[0]?.focusMinutes).toBe(50);
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
    expect(formatExerciseRunAggLine({ id: 'pushups', label: 'Push-ups', reps: 30, timedSeconds: 0 })).toBe('Push-ups: 30');
    expect(formatExerciseRunAggLine({ id: 'jacks', label: 'Jumping jacks', reps: 30, timedSeconds: 0 })).toBe('Jumping jacks: 30');
    expect(formatExerciseRunAggLine({ id: 's', label: 'Shadow', reps: 0, timedSeconds: 90 })).toBe('Shadow: 90s');
    expect(formatExerciseRunAggLine({ id: 'm', label: 'March', reps: 0, timedSeconds: 120 })).toBe('March: 2 min');
    expect(formatExerciseRunAggLine({ id: 'pushups', label: 'Push-ups', reps: 0, timedSeconds: 0 })).toBe('Push-ups: 0');
  });
});

describe('formatClock', () => {
  it('formats mm:ss', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(0)).toBe('00:00');
  });
});
