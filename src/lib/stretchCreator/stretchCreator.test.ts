import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  BUILTIN_MORNING_STRETCH_ID,
  BUILTIN_MORNING_STRETCH_SUMMARY,
  buildStretchLogEntry,
  clampStretchDurationMinutes,
  createStretchId,
  defaultBuiltinMorningStretch,
  isStretchCompletedToday,
  isWithinScheduledStretchWindow,
  listScheduledStretches,
  normalizeStretchDefinition,
  shouldShowStretchSection,
  stretchCompletionRatio,
  stretchHideCutoffMs,
  stretchSummaryMessage,
  STRETCH_GRADIENT_IDS,
  type StretchDefinition
} from '@/lib/stretchCreator/stretchCreator';

describe('defaultBuiltinMorningStretch', () => {
  it('ships the morning stretch preset with sunrise gradient and scheduled trigger', () => {
    const stretch = defaultBuiltinMorningStretch();
    expect(stretch.id).toBe(BUILTIN_MORNING_STRETCH_ID);
    expect(stretch.builtIn).toBe(true);
    expect(stretch.workoutId).toBe('morning-stretch');
    expect(stretch.gradientId).toBe('sunrise');
    expect(stretch.trigger).toEqual({ mode: 'scheduled', hideAfterHour: 11 });
    expect(stretch.exerciseRefs.length).toBe(6);
  });
});

describe('normalizeStretchDefinition', () => {
  it('fills defaults and clamps duration', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    const normalized = normalizeStretchDefinition(
      { id: 'stretch-a', name: 'After run', gradientId: 'ocean', exerciseRefs: [{ kind: 'stretchPick', id: 'stretch-neck-roll' }] },
      prefs
    );
    expect(normalized.durationMinutes).toBe(5);
    expect(normalized.enabled).toBe(true);
    expect(normalized.trigger).toEqual({ mode: 'manual' });
    expect(normalized.exerciseRefs).toEqual([{ kind: 'stretchPick', id: 'stretch-neck-roll' }]);
  });

  it('keeps scheduled trigger with clamped hide hour', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    const normalized = normalizeStretchDefinition(
      { id: 'stretch-b', name: 'Evening', trigger: { mode: 'scheduled', hideAfterHour: 99 }, gradientId: 'forest' },
      prefs
    );
    expect(normalized.trigger).toEqual({ mode: 'scheduled', hideAfterHour: 23 });
  });

  it('rejects unknown gradient ids', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    const normalized = normalizeStretchDefinition({ id: 'x', name: 'X', gradientId: 'bogus' as never }, prefs);
    expect(normalized.gradientId).toBe('ocean');
  });
});

describe('listScheduledStretches', () => {
  it('returns enabled stretches with scheduled trigger only', () => {
    const stretches: StretchDefinition[] = [
      defaultBuiltinMorningStretch(),
      normalizeStretchDefinition({ id: 'manual-1', name: 'Manual', trigger: { mode: 'manual' }, gradientId: 'ocean' }, defaultWorkoutCustomizePrefs()),
      normalizeStretchDefinition({ id: 'sched-1', name: 'Evening', enabled: false, trigger: { mode: 'scheduled', hideAfterHour: 20 }, gradientId: 'ember' }, defaultWorkoutCustomizePrefs())
    ];
    const scheduled = listScheduledStretches(stretches);
    expect(scheduled.map((s) => s.id)).toEqual([BUILTIN_MORNING_STRETCH_ID]);
  });
});

describe('shouldShowStretchSection', () => {
  const morningStretch = defaultBuiltinMorningStretch();

  it('hides manual stretches on Daily tab', () => {
    const manual = normalizeStretchDefinition({ id: 'm', name: 'M', trigger: { mode: 'manual' }, gradientId: 'ocean' }, defaultWorkoutCustomizePrefs());
    const morning = new Date('2026-06-24T08:00:00').getTime();
    expect(shouldShowStretchSection({ stretch: manual, completedToday: false, nowTimestamp: morning })).toBe(false);
  });

  it('shows scheduled stretch before hide cutoff when enabled and not completed', () => {
    const morning = new Date('2026-06-24T08:00:00').getTime();
    const afternoon = new Date('2026-06-24T13:00:00').getTime();
    expect(shouldShowStretchSection({ stretch: morningStretch, completedToday: false, nowTimestamp: morning })).toBe(true);
    expect(shouldShowStretchSection({ stretch: morningStretch, completedToday: true, nowTimestamp: morning })).toBe(false);
    expect(shouldShowStretchSection({ stretch: { ...morningStretch, enabled: false }, completedToday: false, nowTimestamp: morning })).toBe(false);
    expect(shouldShowStretchSection({ stretch: morningStretch, completedToday: false, nowTimestamp: afternoon })).toBe(false);
  });

  it('stays visible during an active run', () => {
    const afternoon = new Date('2026-06-24T13:00:00').getTime();
    expect(shouldShowStretchSection({ stretch: morningStretch, completedToday: false, nowTimestamp: afternoon, activeRun: true })).toBe(true);
  });

  it('stays hidden at calendar midnight until stats day rolls over', () => {
    const midnight = new Date('2026-06-28T00:00:00').getTime();
    expect(shouldShowStretchSection({ stretch: morningStretch, completedToday: false, nowTimestamp: midnight, rolloverHour: 4 })).toBe(false);
    const afterRollover = new Date('2026-06-28T05:00:00').getTime();
    expect(shouldShowStretchSection({ stretch: morningStretch, completedToday: false, nowTimestamp: afterRollover, rolloverHour: 4 })).toBe(true);
  });
});

describe('isStretchCompletedToday', () => {
  it('matches workout_id for the stretch', () => {
    const now = new Date('2026-06-24T08:00:00').getTime();
    const stretch = defaultBuiltinMorningStretch();
    const entry = buildStretchLogEntry(stretch, [{ id: 'stretch-neck-roll', name: 'Neck Roll', amount: 30, unit: 'seconds' }], 's-1', now);
    expect(isStretchCompletedToday(stretch, [entry], now, 4)).toBe(true);
    expect(isStretchCompletedToday(stretch, [], now, 4)).toBe(false);
  });
});

describe('stretchCompletionRatio', () => {
  it('scales partial block time', () => {
    expect(stretchCompletionRatio(150, 5)).toBe(0.5);
    expect(stretchCompletionRatio(300, 5)).toBe(1);
  });
});

describe('stretchHideCutoffMs', () => {
  it('uses local hide-after hour', () => {
    const before = new Date('2026-06-24T10:30:00').getTime();
    const after = new Date('2026-06-24T11:30:00').getTime();
    expect(before < stretchHideCutoffMs(before, 11)).toBe(true);
    expect(after < stretchHideCutoffMs(after, 11)).toBe(false);
  });
});

describe('isWithinScheduledStretchWindow', () => {
  it('opens at stats-day rollover, not calendar midnight', () => {
    const midnight = new Date('2026-06-28T00:00:00').getTime();
    expect(isWithinScheduledStretchWindow(midnight, 4, 11)).toBe(false);
    const morning = new Date('2026-06-28T08:00:00').getTime();
    expect(isWithinScheduledStretchWindow(morning, 4, 11)).toBe(true);
    const afternoon = new Date('2026-06-28T13:00:00').getTime();
    expect(isWithinScheduledStretchWindow(afternoon, 4, 11)).toBe(false);
  });
});

describe('stretchSummaryMessage', () => {
  it('uses the morning stretch welcome copy for the built-in routine', () => {
    expect(stretchSummaryMessage(defaultBuiltinMorningStretch())).toBe(BUILTIN_MORNING_STRETCH_SUMMARY);
  });

  it('summarizes custom stretches with move count and duration', () => {
    const custom = normalizeStretchDefinition(
      { id: 'after-run', name: 'After run', gradientId: 'ocean', exerciseRefs: [{ kind: 'stretchPick', id: 'stretch-neck-roll' }, { kind: 'stretchPick', id: 'stretch-hip-roll' }] },
      defaultWorkoutCustomizePrefs()
    );
    expect(stretchSummaryMessage(custom)).toBe('2 moves · ~5 min');
  });
});

describe('createStretchId', () => {
  it('prefixes custom stretch ids', () => {
    expect(createStretchId()).toMatch(/^stretch-/);
  });
});

describe('STRETCH_GRADIENT_IDS', () => {
  it('includes preset gradients for the creator UI', () => {
    expect(STRETCH_GRADIENT_IDS).toContain('sunrise');
    expect(STRETCH_GRADIENT_IDS).toContain('ocean');
    expect(STRETCH_GRADIENT_IDS.length).toBeGreaterThanOrEqual(5);
  });
});

describe('clampStretchDurationMinutes', () => {
  it('clamps between 1 and 60', () => {
    expect(clampStretchDurationMinutes(0)).toBe(1);
    expect(clampStretchDurationMinutes(5)).toBe(5);
    expect(clampStretchDurationMinutes(90)).toBe(60);
  });
});
