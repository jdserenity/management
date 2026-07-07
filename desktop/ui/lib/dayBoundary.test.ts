import { describe, expect, it } from 'vitest';
import {
  clampDayRolloverHour,
  DEFAULT_DAY_ROLLOVER_HOUR,
  formatDayRolloverHourLabel,
  getStatsDayWindow,
  isTimestampInStatsDay
} from '@/lib/dayBoundary';

describe('getStatsDayWindow', () => {
  it('defaults rollover to 4am', () => {
    expect(DEFAULT_DAY_ROLLOVER_HOUR).toBe(4);
  });

  it('before rollover hour counts as previous stats day', () => {
    const now = new Date(2026, 4, 24, 3, 30, 0).getTime();
    const { startTs, endTs } = getStatsDayWindow(now, 4);
    expect(new Date(startTs).getDate()).toBe(23);
    expect(new Date(startTs).getHours()).toBe(4);
    expect(now).toBeGreaterThanOrEqual(startTs);
    expect(now).toBeLessThan(endTs);
  });

  it('at and after rollover hour counts as current stats day', () => {
    const atFour = new Date(2026, 4, 24, 4, 0, 0).getTime();
    const after = new Date(2026, 4, 24, 10, 0, 0).getTime();
    const win = getStatsDayWindow(atFour, 4);
    expect(new Date(win.startTs).getDate()).toBe(24);
    expect(isTimestampInStatsDay(atFour, after, 4)).toBe(true);
  });
});

describe('clampDayRolloverHour', () => {
  it('clamps invalid values to default or range', () => {
    expect(clampDayRolloverHour(NaN)).toBe(DEFAULT_DAY_ROLLOVER_HOUR);
    expect(clampDayRolloverHour(-1)).toBe(0);
    expect(clampDayRolloverHour(24)).toBe(23);
    expect(clampDayRolloverHour(4)).toBe(4);
  });
});

describe('formatDayRolloverHourLabel', () => {
  it('returns a non-empty label', () => {
    expect(formatDayRolloverHourLabel(4).length).toBeGreaterThan(0);
  });
});
