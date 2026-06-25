import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  buildMorningStretchLogEntry,
  DEFAULT_MORNING_STRETCH_EXERCISE_REFS,
  defaultMorningStretchRoutine,
  isBeforeMorningStretchHideCutoff,
  isMorningStretchCompletedToday,
  listMorningStretchCatalog,
  morningStretchCompletionRatio,
  MORNING_STRETCH_WORKOUT_ID,
  normalizeMorningStretchRoutine,
  resolveMorningStretchExercises,
  shouldShowMorningStretchSection
} from '@/lib/morningStretch/morningStretch';
import { defaultMorningStretchPrefs } from '@/lib/morningStretch/morningStretchPref';

describe('defaultMorningStretchRoutine', () => {
  it('starts with the five default stretch picks', () => {
    expect(defaultMorningStretchRoutine().exerciseRefs).toEqual(DEFAULT_MORNING_STRETCH_EXERCISE_REFS);
    expect(DEFAULT_MORNING_STRETCH_EXERCISE_REFS.map((ref) => ref.id)).toEqual([
      'stretch-lateral-shoulder',
      'stretch-neck-roll',
      'stretch-hip-roll',
      'stretch-deep-squat',
      'stretch-forward-hang'
    ]);
  });
});

describe('listMorningStretchCatalog', () => {
  it('includes enabled predefined moves, stretch picks, and custom exercises', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    prefs.customExercises = [{ id: 'custom-a', name: 'Arm circles', amount: 10, unit: 'reps' }];
    const catalog = listMorningStretchCatalog(prefs);
    expect(catalog.some((row) => row.ref.kind === 'predefined' && row.ref.id === 'push-ups')).toBe(true);
    expect(catalog.some((row) => row.ref.kind === 'stretchPick' && row.ref.id === 'stretch-neck-roll')).toBe(true);
    expect(catalog.some((row) => row.ref.kind === 'custom' && row.ref.id === 'custom-a')).toBe(true);
  });

  it('drops disabled predefined moves and stretch picks', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    prefs.allowedWorkoutIds = prefs.allowedWorkoutIds.filter((id) => id !== 'push-ups');
    prefs.allowedStretchPickKeys = prefs.allowedStretchPickKeys.filter((key) => key !== 'stretch-neck-roll');
    const catalog = listMorningStretchCatalog(prefs);
    expect(catalog.some((row) => row.ref.id === 'push-ups')).toBe(false);
    expect(catalog.some((row) => row.ref.id === 'stretch-neck-roll')).toBe(false);
  });
});

describe('normalizeMorningStretchRoutine', () => {
  it('keeps only refs still in the exercise pool', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    prefs.allowedWorkoutIds = prefs.allowedWorkoutIds.filter((id) => id !== 'push-ups');
    const routine = normalizeMorningStretchRoutine(
      {
        exerciseRefs: [
          { kind: 'predefined', id: 'push-ups' },
          { kind: 'stretchPick', id: 'stretch-neck-roll' }
        ]
      },
      prefs
    );
    expect(routine.exerciseRefs).toEqual([{ kind: 'stretchPick', id: 'stretch-neck-roll' }]);
  });
});

describe('resolveMorningStretchExercises', () => {
  it('expands stretch picks with hold seconds and predefined moves with overrides', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    prefs.exerciseOverrides['pushups'] = { amount: 5, unit: 'reps' };
    const exercises = resolveMorningStretchExercises(
      {
        exerciseRefs: [
          { kind: 'predefined', id: 'push-ups' },
          { kind: 'stretchPick', id: 'stretch-neck-roll' }
        ]
      },
      prefs
    );
    expect(exercises[0]).toMatchObject({ id: 'pushups', amount: 5, unit: 'reps' });
    expect(exercises[1]).toMatchObject({ id: 'stretch-neck-roll', amount: 30, unit: 'seconds' });
  });
});

describe('isMorningStretchCompletedToday', () => {
  it('detects a morning stretch log in the current stats day', () => {
    const now = new Date('2026-06-24T08:00:00').getTime();
    const logs = [
      buildMorningStretchLogEntry([{ id: 'stretch-neck-roll', name: 'Neck Roll', amount: 30, unit: 'seconds' }], 'ms-1', now)
    ];
    expect(isMorningStretchCompletedToday(logs, now, 4)).toBe(true);
    expect(isMorningStretchCompletedToday([], now, 4)).toBe(false);
    expect(
      isMorningStretchCompletedToday(
        [{ ...logs[0], workoutId: 'manual' }],
        now,
        4
      )
    ).toBe(false);
  });

  it('uses workout_id morning-stretch only', () => {
    expect(MORNING_STRETCH_WORKOUT_ID).toBe('morning-stretch');
  });
});

describe('shouldShowMorningStretchSection', () => {
  const prefs = defaultMorningStretchPrefs();

  it('hides when disabled, completed, or after hide cutoff', () => {
    const morning = new Date('2026-06-24T08:00:00').getTime();
    const afternoon = new Date('2026-06-24T13:00:00').getTime();
    expect(shouldShowMorningStretchSection({ prefs, completedToday: false, nowTimestamp: morning })).toBe(true);
    expect(shouldShowMorningStretchSection({ prefs, completedToday: true, nowTimestamp: morning })).toBe(false);
    expect(shouldShowMorningStretchSection({ prefs: { ...prefs, enabled: false }, completedToday: false, nowTimestamp: morning })).toBe(false);
    expect(shouldShowMorningStretchSection({ prefs, completedToday: false, nowTimestamp: afternoon })).toBe(false);
  });

  it('stays visible during an active run even after cutoff', () => {
    const afternoon = new Date('2026-06-24T13:00:00').getTime();
    expect(shouldShowMorningStretchSection({ prefs, completedToday: false, nowTimestamp: afternoon, activeRun: true })).toBe(true);
  });
});

describe('isBeforeMorningStretchHideCutoff', () => {
  it('uses local 11am default cutoff', () => {
    const before = new Date('2026-06-24T10:30:00').getTime();
    const after = new Date('2026-06-24T11:30:00').getTime();
    expect(isBeforeMorningStretchHideCutoff(before, 11)).toBe(true);
    expect(isBeforeMorningStretchHideCutoff(after, 11)).toBe(false);
  });
});

describe('morningStretchCompletionRatio', () => {
  it('scales partial block time', () => {
    expect(morningStretchCompletionRatio(150, 5)).toBe(0.5);
    expect(morningStretchCompletionRatio(300, 5)).toBe(1);
  });
});

describe('buildMorningStretchLogEntry', () => {
  it('applies completion ratio to logged exercises', () => {
    const entry = buildMorningStretchLogEntry(
      [{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }],
      'ms-1',
      Date.now(),
      0.5
    );
    expect(entry.exercises[0]).toMatchObject({ amount: 5, unit: 'reps' });
    expect(entry.completionRatio).toBe(0.5);
  });
});
