import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs, normalizeWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  buildManualExerciseLogEntry,
  buildMixedBreakWorkout,
  buildStretchBreakExercises,
  DEFAULT_ALLOWED_WORKOUT_IDS,
  countTodayDeepWorkSessions,
  countTodayPomodoroSessions,
  focusEntryCountsAsSession,
  formatMonthBucketLabel,
  formatMonthChartLabel,
  formatTimedMovementHeadline,
  formatWeekBucketLabel,
  formatWeekChartLabel,
  fillPeriodSeries,
  listNonZeroExerciseTotals,
  mergePeriodStats,
  periodMoveMinutes,
  recentWeekBucketKeys,
  SESSION_COUNT_MIN_RATIO,
  summarizeExerciseTotalsAllTime,
  summarizeExerciseTotalsForWeekBucket,
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
  stretchPickToExercises,
  STRETCH_PICK_CATALOG,
  formatTimedSecondsTotal,
  isStretchExerciseId,
  listTodayWorkoutExerciseTotals,
  listTodayMovementTotals,
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
  const prefsMarchSquats = normalizeWorkoutCustomizePrefs({
    allowedWorkoutIds: ['march-spot', 'air-squats'],
    allowedStretchPickKeys: [],
    exerciseOverrides: {},
    stretchHoldSeconds: 20,
    customExercises: []
  }, null);
  const prefsMarchPush = normalizeWorkoutCustomizePrefs({
    allowedWorkoutIds: ['march-spot', 'push-ups'],
    allowedStretchPickKeys: [],
    exerciseOverrides: {},
    stretchHoldSeconds: 20,
    customExercises: []
  }, null);
  const prefsStretchOnly = normalizeWorkoutCustomizePrefs({
    allowedWorkoutIds: [],
    allowedStretchPickKeys: ['stretch-butterfly', 'stretch-neck-roll'],
    exerciseOverrides: {},
    stretchHoldSeconds: 20,
    customExercises: []
  }, null);
  const prefsDefault = defaultWorkoutCustomizePrefs();

  it('returns a mixed break with id mixed-break', () => {
    const workout = pickWorkoutForBreak(prefsMarchSquats, 0.99);
    expect(workout.id).toBe('mixed-break');
    expect(workout.name).toContain('Mixed');
    expect(workout.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it('only uses moves from allowed templates', () => {
    const workout = pickWorkoutForBreak(prefsMarchPush, 0.37);
    const allowedIds = new Set(['march', 'pushups']);
    expect(workout.exercises.every((e) => allowedIds.has(e.id))).toBe(true);
  });

  it('when only stretch is allowed, exercises are stretch holds', () => {
    const workout = pickWorkoutForBreak(prefsStretchOnly, 0.21);
    expect(workout.exercises.every((e) => e.id.startsWith('stretch-'))).toBe(true);
    expect(workout.exercises.every((e) => e.unit === 'seconds')).toBe(true);
  });

  it('targets about 2–3 minutes of work by load estimate', () => {
    const workout = buildMixedBreakWorkout(prefsDefault, 0.555);
    const load = workout.exercises.reduce((s, e) => s + estimateExerciseLoadSeconds(e), 0);
    expect(load).toBeGreaterThanOrEqual(110);
    expect(load).toBeLessThan(400);
    expect(workout.estimatedMinutes).toBeGreaterThanOrEqual(2);
    expect(workout.estimatedMinutes).toBeLessThanOrEqual(3);
  });

  it('does not repeat the same exercise id in one break', () => {
    for (let i = 0; i < 50; i++) {
      const workout = buildMixedBreakWorkout(prefsDefault, i * 0.017 + 0.01);
      const ids = workout.exercises.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('always pairs left and right stretch sides in one break', () => {
    for (let i = 0; i < 80; i++) {
      const workout = buildMixedBreakWorkout(prefsDefault, i * 0.013 + 0.02);
      expect(workoutBilateralPairsComplete(workout.exercises)).toBe(true);
    }
  });

  it('applies exercise overrides from prefs', () => {
    const prefs = normalizeWorkoutCustomizePrefs({
      allowedWorkoutIds: ['push-ups'],
      allowedStretchPickKeys: [],
      exerciseOverrides: { pushups: { amount: 5, unit: 'reps' } },
      stretchHoldSeconds: 20,
      customExercises: []
    }, null);
    const workout = pickWorkoutForBreak(prefs, 0.42);
    expect(workout.exercises.length).toBeGreaterThan(0);
    expect(workout.exercises.every((e) => e.id === 'pushups' && e.amount === 5)).toBe(true);
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
    expect(stretchBodyRegionForId('arm-rolls')).toBe('upper');
    expect(stretchBodyRegionForId('stretch-butterfly')).toBe('lower');
    expect(stretchBodyRegionForId('stretch-foot')).toBe('lower');
    expect(stretchBodyRegionForId('stretch-forward-hang')).toBe('lower');
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

  it('uses per-stretch default hold times', () => {
    for (let i = 0; i < 30; i++) {
      const ex = buildStretchBreakExercises(i * 0.041);
      ex.forEach((row) => {
        expect([20, 30]).toContain(row.amount);
        expect(row.unit).toBe('seconds');
      });
    }
    const neckPick = STRETCH_PICK_CATALOG.find((row) => row.key === 'stretch-neck-roll')!.pick;
    expect(stretchPickToExercises(neckPick, 30)[0]?.amount).toBe(30);
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
    expect(formatExerciseAmount({ id: 's', name: 'Box', amount: 90, unit: 'seconds' })).toBe('1 min 30s');
    expect(formatExerciseAmount({ id: 'm', name: 'March', amount: 1, unit: 'minutes' })).toBe('60s');
    expect(formatExerciseAmount({ id: 'm2', name: 'March', amount: 2, unit: 'minutes' })).toBe('2 min');
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

  it('does not count partial sessions below 75% toward session totals', () => {
    const logs: FocusLogEntry[] = [
      { id: 'f1', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 8, 0, 0).getTime(), durationMinutes: 12, plannedDurationMinutes: 25, completionRatio: 0.5 },
      { id: 'f2', type: 'pomodoro', completedAt: new Date(2026, 4, 14, 9, 0, 0).getTime(), durationMinutes: 20, plannedDurationMinutes: 25, completionRatio: 0.8 }
    ];
    const totals = summarizeFocusLogs(logs);
    expect(totals.totalPomodoros).toBe(1);
    expect(totals.totalFocusMinutes).toBe(32);
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

describe('focusEntryCountsAsSession', () => {
  it('requires completion at or above SESSION_COUNT_MIN_RATIO', () => {
    expect(SESSION_COUNT_MIN_RATIO).toBe(0.75);
    expect(focusEntryCountsAsSession({ id: 'a', type: 'pomodoro', completedAt: 0, durationMinutes: 1, plannedDurationMinutes: 25, completionRatio: 0.74 })).toBe(false);
    expect(focusEntryCountsAsSession({ id: 'b', type: 'pomodoro', completedAt: 0, durationMinutes: 19, plannedDurationMinutes: 25, completionRatio: 0.75 })).toBe(true);
  });
});

describe('per-exercise period totals', () => {
  const logs: WorkoutLogEntry[] = [
    {
      id: 'w1',
      workoutId: 'push-ups',
      workoutName: 'Push-ups',
      completedAt: new Date(2026, 4, 14, 9, 0, 0).getTime(),
      exercises: [{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }],
      totalReps: 10,
      totalTimedSeconds: 0
    },
    {
      id: 'w2',
      workoutId: 'manual',
      workoutName: 'Manual',
      completedAt: new Date(2026, 4, 10, 9, 0, 0).getTime(),
      exercises: [{ id: 'jacks', name: 'Jumping jacks', amount: 20, unit: 'reps' }],
      totalReps: 20,
      totalTimedSeconds: 0
    }
  ];

  it('aggregates exercises for a week bucket and omits zero rows', () => {
    const weekBucket = '2026-05-11';
    const totals = summarizeExerciseTotalsForWeekBucket(logs, weekBucket);
    expect(totals.pushups?.reps).toBe(10);
    expect(totals.jacks).toBeUndefined();
    expect(listNonZeroExerciseTotals(totals).map((row) => row.id)).toEqual(['pushups']);
  });

  it('aggregates all-time exercise totals', () => {
    const totals = summarizeExerciseTotalsAllTime(logs);
    expect(listNonZeroExerciseTotals(totals).map((row) => row.id).sort()).toEqual(['jacks', 'pushups']);
  });
});

describe('bucket labels', () => {
  it('formats week and month buckets for display', () => {
    expect(formatWeekBucketLabel('2026-05-12')).toContain('May');
    expect(formatWeekBucketLabel('2026-05-12')).toContain('2026');
    expect(formatMonthBucketLabel('2026-05')).toBe('May 2026');
    expect(formatWeekChartLabel('2026-05-12')).toContain('May');
    expect(formatMonthChartLabel('2026-05')).toBe('May');
  });
});

describe('period series helpers', () => {
  const now = new Date(2026, 4, 14, 12, 0, 0).getTime();

  it('fills recent week buckets with zero points when missing', () => {
    const keys = recentWeekBucketKeys(now, 3);
    expect(keys).toHaveLength(3);
    const filled = fillPeriodSeries(keys, [{ bucket: keys[2]!, pomodoros: 2, deepWork: 0, focusMinutes: 50, reps: 0, timedSeconds: 0, workouts: 1 }]);
    expect(filled[0]?.pomodoros).toBe(0);
    expect(filled[2]?.pomodoros).toBe(2);
  });

  it('formats timed movement as hours and minutes', () => {
    expect(formatTimedMovementHeadline(0)).toBe('0m');
    expect(formatTimedMovementHeadline(2505)).toBe('42m');
    expect(formatTimedMovementHeadline(8100)).toBe('2h 15m');
  });

  it('derives movement minutes for chart values', () => {
    expect(periodMoveMinutes({ bucket: 'x', pomodoros: 0, deepWork: 0, focusMinutes: 0, reps: 0, timedSeconds: 120, workouts: 0 })).toBe(2);
    expect(periodMoveMinutes({ bucket: 'x', pomodoros: 0, deepWork: 0, focusMinutes: 0, reps: 0, timedSeconds: 2505, workouts: 0 })).toBe(42);
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
    expect(formatExerciseRunAggLine({ id: 's', label: 'Shadow', reps: 0, timedSeconds: 90 })).toBe('Shadow: 1 min 30s');
    expect(formatExerciseRunAggLine({ id: 'm', label: 'March', reps: 0, timedSeconds: 120 })).toBe('March: 2 min');
    expect(formatExerciseRunAggLine({ id: 't', label: 'Hold', reps: 0, timedSeconds: 60 })).toBe('Hold: 60s');
    expect(formatExerciseRunAggLine({ id: 'pushups', label: 'Push-ups', reps: 0, timedSeconds: 0 })).toBe('Push-ups: 0');
  });
});

describe('formatClock', () => {
  it('formats mm:ss', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(0)).toBe('00:00');
  });
});

describe('isStretchExerciseId / listTodayWorkoutExerciseTotals', () => {
  it('treats stretch ids as stretches and lists strength moves separately', () => {
    expect(isStretchExerciseId('stretch-neck-roll')).toBe(true);
    expect(isStretchExerciseId('pushups')).toBe(false);
    const totals: Record<string, ExerciseRunAgg> = {
      pushups: { id: 'pushups', label: 'Push-ups', reps: 20, timedSeconds: 0 },
      'stretch-neck-roll': { id: 'stretch-neck-roll', label: 'Neck Roll', reps: 0, timedSeconds: 30 }
    };
    expect(listTodayWorkoutExerciseTotals(totals).map((a) => a.id)).toEqual(['pushups']);
  });
});

describe('listTodayMovementTotals', () => {
  it('rolls arm rolls into upper body stretching, not a separate exercise row', () => {
    const exerciseTotals: Record<string, ExerciseRunAgg> = {
      pushups: { id: 'pushups', label: 'Push-ups', reps: 10, timedSeconds: 0 },
      'arm-rolls': { id: 'arm-rolls', label: 'Arm rolls', reps: 0, timedSeconds: 30 }
    };
    const rows = listTodayMovementTotals(exerciseTotals, { upperBodySeconds: 30, lowerBodySeconds: 0 });
    expect(rows.map((r) => r.label)).toEqual(['Push-ups', 'Upper body stretching']);
    expect(rows.some((r) => r.id === 'arm-rolls')).toBe(false);
  });

  it('merges strength moves with upper/lower stretch rollups', () => {
    const exerciseTotals: Record<string, ExerciseRunAgg> = {
      pushups: { id: 'pushups', label: 'Push-ups', reps: 20, timedSeconds: 0 },
      squats: { id: 'squats', label: 'Air squats', reps: 40, timedSeconds: 0 }
    };
    const rows = listTodayMovementTotals(exerciseTotals, { upperBodySeconds: 200, lowerBodySeconds: 90 });
    expect(rows.map((r) => r.label)).toEqual([
      'Air squats',
      'Lower body stretching',
      'Push-ups',
      'Upper body stretching'
    ]);
    expect(rows.find((r) => r.id === '__stretch-upper')?.timedSeconds).toBe(200);
    expect(rows.find((r) => r.id === '__stretch-lower')?.timedSeconds).toBe(90);
  });
});
