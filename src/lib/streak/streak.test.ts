import { describe, expect, it } from 'vitest';
import { buildActivityCatalog, getActiveActivitiesForDay, parseScheduledDays } from '@/lib/streak/activityCatalog';
import { clearActivityLogs, incrementResetCount, mergeResetCounts } from '@/lib/streak/activityReset';
import { backfillArchivedAt } from '@/lib/streak/archiveBackfill';
import { getISOWeekStart, isDateInWeek } from '@/lib/streak/dates';
import { getDayCompletionCounts, isDayComplete, isPerfectHeatmapCell } from '@/lib/streak/heatmapHelpers';
import { heatmapMonthSpans, weekColumnMonthFromDates } from '@/lib/streak/heatmapLayout';
import { makeDeletionCell, makeLogCell, getLogState } from '@/lib/streak/logs';
import { mergeLogs, mergeState } from '@/lib/streak/merge';
import { normalizeConfig } from '@/lib/streak/normalize';
import { pausedStateFromVault, mergePausedOnIncoming } from '@/lib/streak/pauseSync';
import { calculateStats } from '@/lib/streak/stats';
import { currentStreakFireEmojiClass, streakDisplayTier } from '@/lib/streak/streakDisplay';
import type { StreakActivityStats, StreakConfig, StreakData } from '@/lib/streak/types';
import configFixture from '@/lib/streak/fixtures/streak-config.json';

const statsOf = (data: { stats: Record<string, StreakActivityStats> }, id: string): StreakActivityStats =>
  data.stats[id];

describe('streak stats', () => {
  it('only counts successes on or after activity start date', () => {
    const data: StreakData = {
      logs: {
        '2026-01-01': { a: { state: 'success', updatedAt: 'x' } },
        '2026-05-10': { a: { state: 'success', updatedAt: 'x' } },
        '2026-05-11': { a: { state: 'success', updatedAt: 'x' } }
      },
      stats: {},
      activityStartDates: { a: '2026-05-10' },
      pausedActivities: {},
      unpausedActivities: {},
      activityResetCounts: {}
    };
    const map = { a: { id: 'a', frequency: 'daily' as const } };
    calculateStats(data, 'a', map, '04:00');
    expect(statsOf(data, 'a').totalSuccesses).toBe(2);
    expect(statsOf(data, 'a').totalDays).toBeGreaterThanOrEqual(2);
    expect(statsOf(data, 'a').totalSuccesses).toBeLessThanOrEqual(statsOf(data, 'a').totalDays);
  });

  it('counts consecutive successes for longest streak', () => {
    const data: StreakData = {
      logs: {
        '2026-05-10': { a: { state: 'success', updatedAt: 'x' } },
        '2026-05-11': { a: { state: 'success', updatedAt: 'x' } },
        '2026-05-12': { a: { state: 'failed', updatedAt: 'x' } },
        '2026-05-13': { a: { state: 'success', updatedAt: 'x' } }
      },
      stats: {},
      activityStartDates: { a: '2026-05-10' },
      pausedActivities: {},
      unpausedActivities: {},
      activityResetCounts: {}
    };
    calculateStats(data, 'a', { a: { id: 'a', frequency: 'daily' } }, '04:00');
    expect(statsOf(data, 'a').longestStreak).toBe(2);
  });
});

describe('mergeLogs', () => {
  it('newer updatedAt wins for same day and activity', () => {
    const merged = mergeLogs(
      { '2026-05-20': { a: makeLogCell('success', '2026-05-20T10:00:00.000Z')! } },
      { '2026-05-20': { a: makeLogCell('failed', '2026-05-20T12:00:00.000Z')! } },
      { mode: 'incoming', today: '2026-05-20' }
    );
    expect(merged['2026-05-20']!.a!.state).toBe('failed');
  });

  it('local wins on tie for incoming today', () => {
    const t = '2026-05-20T12:00:00.000Z';
    const merged = mergeLogs(
      { '2026-05-20': { a: makeLogCell('success', t)! } },
      { '2026-05-20': { a: makeLogCell('failed', t)! } },
      { mode: 'incoming', today: '2026-05-20' }
    );
    const day = merged['2026-05-20'];
    expect(day && day.a && day.a.state).toBe('success');
  });

  it('remote deletion tombstone with newer updatedAt wins on today', () => {
    const merged = mergeLogs(
      { '2026-05-20': { a: makeLogCell('success', '2026-05-20T10:00:00.000Z')! } },
      { '2026-05-20': { a: makeDeletionCell('2026-05-20T12:00:00.000Z') } },
      { mode: 'incoming', today: '2026-05-20' }
    );
    expect(getLogState(merged['2026-05-20']?.a)).toBeNull();
  });
});

describe('mergeState skipActivityIds', () => {
  it('does not merge remote logs for reset activity', () => {
    const local = { logs: {}, activityStartDates: {}, pausedActivities: {}, unpausedActivities: {}, activityResetCounts: { x: 1 } };
    const remote = {
      logs: { '2026-01-01': { x: makeLogCell('success', '2026-01-02T00:00:00.000Z')! } },
      activityStartDates: { x: '2026-01-01' },
      pausedActivities: {},
      unpausedActivities: {},
      activityResetCounts: { x: 0 }
    };
    const merged = mergeState({ local, remote, mode: 'save', today: '2026-05-20', skipActivityIds: new Set(['x']) });
    expect(merged.logs).toEqual({});
    expect(merged.activityResetCounts.x).toBe(1);
  });
});

describe('pause-sync', () => {
  it('loads pauses from vault', () => {
    expect(pausedStateFromVault({ a: '2026-05-10' }, {})).toEqual({ a: '2026-05-10' });
  });

  it('skips pause when unpaused tombstone is on or after pause date', () => {
    expect(pausedStateFromVault({ a: '2026-05-10' }, { a: '2026-05-10' })).toEqual({});
    expect(pausedStateFromVault({ a: '2026-05-10' }, { a: '2026-05-12' })).toEqual({});
  });

  it('does not restore stale file pause after local unpause', () => {
    expect(mergePausedOnIncoming({}, { a: '2026-05-12' }, { a: '2026-05-10' }, {})).toEqual({
      pausedActivities: {},
      unpausedActivities: { a: '2026-05-12' }
    });
  });
});

describe('activity-reset', () => {
  it('removes all log entries for the activity', () => {
    const logs = {
      '2026-05-10': { a: 'success' as const, b: 'failed' as const },
      '2026-05-11': { a: 'success' as const }
    };
    expect(clearActivityLogs(logs as never, 'a')).toEqual({ '2026-05-10': { b: 'failed' } });
  });

  it('increments reset count', () => {
    expect(incrementResetCount({}, 'a')).toEqual({ a: 1 });
    expect(incrementResetCount({ a: 1 }, 'a')).toEqual({ a: 2 });
  });

  it('mergeResetCounts keeps higher count', () => {
    expect(mergeResetCounts({ a: 3, b: 1 }, { a: 2, c: 4 })).toEqual({ a: 3, b: 1, c: 4 });
  });
});

describe('activity-catalog', () => {
  it('merges active, archived, and log-only activity ids', () => {
    const config = { activities: [{ id: 'a' }], archivedActivities: [{ id: 'b' }] };
    const data = { logs: { '2026-05-01': { c: { state: 'success' as const, updatedAt: 'x' } } }, activityStartDates: { d: '2026-05-01' }, pausedActivities: {}, unpausedActivities: {}, activityResetCounts: {}, stats: {} };
    const ids = buildActivityCatalog(config, data).map((a) => a.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('parseScheduledDays maps day names', () => {
    expect(parseScheduledDays(['Mon', 'Fri'])).toEqual([1, 5]);
  });

  it('log-only activities do not count after last log day', () => {
    const data = {
      logs: {
        '2026-03-05': { 'br-lesson': { state: 'success' as const, updatedAt: 'x' } },
        '2026-05-20': { 'wake-up': { state: 'success' as const, updatedAt: 'x' } }
      },
      activityStartDates: { 'wake-up': '2026-02-12' },
      pausedActivities: {},
      unpausedActivities: {},
      activityResetCounts: {},
      stats: {}
    };
    const catalog = buildActivityCatalog({ activities: [{ id: 'wake-up' }], archivedActivities: [] }, data);
    const active = getActiveActivitiesForDay(catalog, data, '2026-05-20').map((a) => a.id);
    expect(active.includes('br-lesson')).toBe(false);
    expect(active.includes('wake-up')).toBe(true);
  });
});

describe('heatmap', () => {
  it('isDateInWeek', () => {
    expect(isDateInWeek('2026-05-18', '2026-05-20')).toBe(true);
    expect(isDateInWeek('2026-05-18', '2026-05-17')).toBe(false);
  });

  it('isPerfectHeatmapCell', () => {
    expect(isPerfectHeatmapCell(3, 3)).toBe(true);
    expect(isPerfectHeatmapCell(0, 0)).toBe(false);
    expect(isPerfectHeatmapCell(2, 3)).toBe(false);
  });

  it('isDayComplete ignores activities not started yet', () => {
    const daily = [{ id: 'a' }, { id: 'b' }];
    const data = {
      logs: { '2026-05-20': { a: { state: 'success' as const, updatedAt: 'x' } } },
      activityStartDates: { a: '2026-05-01', b: '2026-05-21' },
      pausedActivities: {},
      unpausedActivities: {},
      activityResetCounts: {},
      stats: {}
    };
    expect(getDayCompletionCounts(data, daily, '2026-05-20').historicalCount).toBe(1);
    expect(isDayComplete(data, daily, '2026-05-20')).toBe(true);
  });
});

describe('heatmap layout', () => {
  it('groups consecutive week columns by month', () => {
    expect(heatmapMonthSpans([0, 0, 1, 1, 1, 2])).toEqual([
      { name: 'Jan', weekCount: 2 },
      { name: 'Feb', weekCount: 3 },
      { name: 'Mar', weekCount: 1 }
    ]);
  });

  it('weekColumnMonthFromDates uses first dated cell', () => {
    expect(weekColumnMonthFromDates([null, '2026-02-10'])).toBe(1);
  });
});

describe('streak display', () => {
  it('streakDisplayTier thresholds', () => {
    expect(streakDisplayTier(5, 'current')).toBe('none');
    expect(streakDisplayTier(6, 'current')).toBe('mid');
    expect(streakDisplayTier(10, 'current')).toBe('gold');
    expect(streakDisplayTier(10, 'longest')).toBe('silver');
  });

  it('currentStreakFireEmojiClass thresholds', () => {
    expect(currentStreakFireEmojiClass(4)).toBeNull();
    expect(currentStreakFireEmojiClass(5)).toMatch(/small/);
    expect(currentStreakFireEmojiClass(10)).toBe('streak-streak-emoji');
  });
});

describe('archive backfill', () => {
  it('sets archivedAt to day after last log', () => {
    const config: StreakConfig = { activities: [], archivedActivities: [{ id: 'school' }] };
    const data = { logs: { '2026-05-01': { school: { state: 'success' as const, updatedAt: 'x' } } }, activityStartDates: {}, pausedActivities: {}, unpausedActivities: {}, activityResetCounts: {}, stats: {} };
    expect(backfillArchivedAt(config, data)).toBe(true);
    expect(config.archivedActivities[0].archivedAt).toBe('2026-05-02');
  });
});

describe('normalize config fixture', () => {
  it('parses vault streak config', () => {
    const config = normalizeConfig(configFixture);
    expect(config.activities.length).toBeGreaterThan(0);
    const weekly = config.activities.find((a) => a.id === 'goals-review');
    expect(weekly?.frequency).toBe('weekly');
    expect(weekly?.scheduledDays).toContain('Sun');
  });
});

describe('dates iso week', () => {
  it('getISOWeekStart returns Monday', () => {
    expect(getISOWeekStart('2026-05-20')).toBe('2026-05-18');
  });
});
