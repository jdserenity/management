import { describe, expect, it } from 'vitest';
import { getStatsDayWindow } from '@/lib/dayBoundary';
import {
  buildMovementSnackLogEntry,
  buildMovementSnackSetLogEntry,
  countMovementSnacksToday,
  defaultMovementSnackEasyExercises,
  defaultMovementSnackHardExercises,
  defaultMovementSnackPrefs,
  MOVEMENT_SNACK_HARD_WORKOUT_ID,
  MOVEMENT_SNACK_EASY_WORKOUT_ID,
  normalizeMovementSnackPrefs,
  movementSnackPlanForDate,
} from './movementSnack';

describe('defaultMovementSnackPrefs', () => {
  it('has a daily goal of 4 and three moves per version', () => {
    const prefs = defaultMovementSnackPrefs();
    expect(prefs.dailyGoal).toBe(4);
    expect(prefs.hardExercises.length).toBe(3);
    expect(prefs.easyExercises.length).toBe(3);
    expect(prefs.quickLogExercises.length).toBe(5);
  });
});

describe('defaultMovementSnackHardExercises', () => {
  it('matches the spec: push-ups, squats, reverse crunches', () => {
    const hard = defaultMovementSnackHardExercises();
    expect(hard.map((e) => `${e.name}: ${e.amount} ${e.unit}`)).toEqual([
      'Push-ups: 10 reps',
      'Air squats: 20 reps',
      'Reverse crunches: 11 reps',
    ]);
  });
});

describe('defaultMovementSnackEasyExercises', () => {
  it('matches the spec: push-ups, reverse lunges, plank', () => {
    const easy = defaultMovementSnackEasyExercises();
    expect(easy.map((e) => `${e.name}: ${e.amount} ${e.unit}`)).toEqual([
      'Push-ups: 10 reps',
      'Reverse lunges: 10 reps',
      'Plank: 25 seconds',
    ]);
  });
});

describe('normalizeMovementSnackPrefs', () => {
  it('returns defaults for null and undefined', () => {
    const defaults = defaultMovementSnackPrefs();
    expect(normalizeMovementSnackPrefs(null)).toEqual(defaults);
    expect(normalizeMovementSnackPrefs(undefined)).toEqual(defaults);
  });

  it('clamps dailyGoal to a positive integer', () => {
    expect(normalizeMovementSnackPrefs({ dailyGoal: 0 }).dailyGoal).toBe(4);
    expect(normalizeMovementSnackPrefs({ dailyGoal: -3 }).dailyGoal).toBe(4);
    expect(normalizeMovementSnackPrefs({ dailyGoal: 3 }).dailyGoal).toBe(3);
    expect(normalizeMovementSnackPrefs({ dailyGoal: 3.7 }).dailyGoal).toBe(4);
  });

  it('falls back to defaults when exercise arrays are invalid', () => {
    const defaults = defaultMovementSnackPrefs();
    expect(normalizeMovementSnackPrefs({ hardExercises: [] }).hardExercises).toEqual(defaults.hardExercises);
    expect(normalizeMovementSnackPrefs({ easyExercises: [] }).easyExercises).toEqual(defaults.easyExercises);
    expect(normalizeMovementSnackPrefs({ hardExercises: [{} as any] }).hardExercises).toEqual(defaults.hardExercises);
  });

  it('accepts valid custom exercises', () => {
    const hard = [{ id: 'pushups', name: 'Push-ups', amount: 15, unit: 'reps' as const }];
    const easy = [{ id: 'plank', name: 'Plank', amount: 30, unit: 'seconds' as const }];
    const prefs = normalizeMovementSnackPrefs({ hardExercises: hard, easyExercises: easy });
    expect(prefs.hardExercises).toEqual(hard);
    expect(prefs.easyExercises).toEqual(easy);
  });
});

describe('buildMovementSnackLogEntry', () => {
  it('produces a workout log entry with the correct movement-snack workout id', () => {
    const hard = defaultMovementSnackHardExercises();
    const entry = buildMovementSnackLogEntry(hard, 'snack-1');
    expect(entry.workoutId).toBe(MOVEMENT_SNACK_HARD_WORKOUT_ID);
    expect(entry.workoutName).toBe('Movement burst · hard');
    expect(entry.exercises).toHaveLength(3);
    expect(entry.completionRatio).toBe(1);
  });

  it('labels easy snacks with a separate workout id', () => {
    const entry = buildMovementSnackLogEntry(defaultMovementSnackEasyExercises(), 'snack-e', Date.now(), true);
    expect(entry.workoutId).toBe(MOVEMENT_SNACK_EASY_WORKOUT_ID);
    expect(entry.workoutName).toBe('Movement burst · easy');
  });

  it('totals reps and timed seconds', () => {
    const exercises = [
      { id: 'a', name: 'A', amount: 10, unit: 'reps' as const },
      { id: 'b', name: 'B', amount: 30, unit: 'seconds' as const },
    ];
    const entry = buildMovementSnackLogEntry(exercises, 'snack-2');
    expect(entry.totalReps).toBe(10);
    expect(entry.totalTimedSeconds).toBe(30);
  });
});

describe('countMovementSnacksToday', () => {
  it('filters snack logs to the stats day window', () => {
    const now = Date.now();
    const { startTs } = getStatsDayWindow(now, 5);
    const insideTs = startTs + 1000;
    const outsideTs = startTs - 1000;
    const logs = [
      buildMovementSnackLogEntry(defaultMovementSnackHardExercises(), 'a', insideTs, false),
      buildMovementSnackLogEntry(defaultMovementSnackEasyExercises(), 'b', insideTs, true),
      buildMovementSnackLogEntry(defaultMovementSnackHardExercises(), 'c', outsideTs, false),
    ];
    expect(countMovementSnacksToday(logs, now, 5)).toBe(2);
  });

  it('returns 0 for an empty log list', () => {
    expect(countMovementSnacksToday([])).toBe(0);
  });

  it('counts legacy easy logs stored under the hard workout id', () => {
    const now = Date.now();
    const { startTs } = getStatsDayWindow(now, 5);
    const insideTs = startTs + 1000;
    const legacyEasy = buildMovementSnackLogEntry(defaultMovementSnackEasyExercises(), 'legacy', insideTs, true);
    legacyEasy.workoutId = MOVEMENT_SNACK_HARD_WORKOUT_ID;
    expect(countMovementSnacksToday([legacyEasy], now, 5)).toBe(1);
  });
});

describe('movement snack regimen', () => {
  it('plans two build tasks and two move tasks Monday through Saturday', () => {
    const tasks = movementSnackPlanForDate(new Date(2026, 8, 14), defaultMovementSnackPrefs().quickLogExercises);
    expect(tasks.map((task) => task.slotId)).toEqual(['move-1', 'build-push', 'move-2', 'build-abs']);
    expect(tasks.filter((task) => task.kind === 'build').every((task) => task.setCount === 3)).toBe(true);
  });

  it('plans four move tasks Sunday', () => {
    const tasks = movementSnackPlanForDate(new Date(2026, 8, 13), defaultMovementSnackPrefs().quickLogExercises);
    expect(tasks.map((task) => task.slotId)).toEqual(['move-1', 'move-2', 'move-3', 'move-4']);
  });

  it('keeps a saved regimen exercise and amount', () => {
    const defaults = defaultMovementSnackPrefs();
    const regimen = { ...defaults.regimen, Mon: defaults.regimen.Mon.map((task) => task.slotId === 'build-push' ? { ...task, exercise: { ...task.exercise, amount: 17 } } : task) };
    const tasks = movementSnackPlanForDate(new Date(2026, 8, 14), defaults.quickLogExercises, regimen);
    expect(tasks[1].exercise.amount).toBe(17);
  });

  it('logs build sets independently', () => {
    const task = movementSnackPlanForDate(new Date(2026, 8, 14), defaultMovementSnackPrefs().quickLogExercises)[1];
    const entry = buildMovementSnackSetLogEntry(task, '2026-09-14', { ...task.exercise, amount: 12 }, 2, 'set-2');
    expect(entry.movementSnack).toEqual({ day: '2026-09-14', slotId: 'build-push', kind: 'build', setNumber: 2, setCount: 3 });
    expect(entry.exercises).toEqual([{ ...task.exercise, amount: 12 }]);
  });

  it('counts three build set logs as one completed snack', () => {
    const task = movementSnackPlanForDate(new Date(2026, 8, 14), defaultMovementSnackPrefs().quickLogExercises)[0];
    const logs = [1, 2, 3].map((setNumber) => buildMovementSnackSetLogEntry(task, '2026-09-14', task.exercise, setNumber, `set-${setNumber}`, new Date(2026, 8, 14, 12).getTime()));
    expect(countMovementSnacksToday(logs, new Date(2026, 8, 14, 12).getTime(), 5)).toBe(1);
  });
});
