import { describe, expect, it } from 'vitest';
import { formatNearestHalfHourLabel } from './nearestHalfHour';

/** Local date with wall-clock h:m (avoids UTC ambiguity in tests). */
const atLocal = (hour: number, minute: number): number => {
  const d = new Date(2026, 5, 15, hour, minute, 0, 0);
  return d.getTime();
};

describe('formatNearestHalfHourLabel', () => {
  it('rounds down to the hour when within 15 minutes past', () => {
    expect(formatNearestHalfHourLabel(atLocal(12, 7))).toBe('12pm');
    expect(formatNearestHalfHourLabel(atLocal(12, 0))).toBe('12pm');
    expect(formatNearestHalfHourLabel(atLocal(12, 14))).toBe('12pm');
  });

  it('rounds to :30 when 15–44 minutes past the hour', () => {
    expect(formatNearestHalfHourLabel(atLocal(14, 23))).toBe('2:30pm');
    expect(formatNearestHalfHourLabel(atLocal(14, 15))).toBe('2:30pm');
    expect(formatNearestHalfHourLabel(atLocal(14, 44))).toBe('2:30pm');
  });

  it('rounds up to the next hour when 45+ minutes past', () => {
    expect(formatNearestHalfHourLabel(atLocal(14, 45))).toBe('3pm');
    expect(formatNearestHalfHourLabel(atLocal(11, 50))).toBe('12pm');
    expect(formatNearestHalfHourLabel(atLocal(23, 50))).toBe('12am');
  });

  it('formats morning times with am', () => {
    expect(formatNearestHalfHourLabel(atLocal(9, 5))).toBe('9am');
    expect(formatNearestHalfHourLabel(atLocal(9, 30))).toBe('9:30am');
  });
});
