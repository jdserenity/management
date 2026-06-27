import { describe, expect, it } from 'vitest';
import { getStatsDayWindow } from '@/lib/dayBoundary';
import {
  parsePomodoroBreakChainRecord,
  pomodoroBreakChainForDay
} from './pomodoroBreakChain';

describe('pomodoroBreakChain', () => {
  const hour = 4;
  const dayStart = getStatsDayWindow(1_700_000_000_000, hour).startTs;

  it('parses a stored chain record', () => {
    expect(parsePomodoroBreakChainRecord(JSON.stringify({ completedPomodoros: 1, statsDayStartTs: dayStart }))).toEqual({
      completedPomodoros: 1,
      statsDayStartTs: dayStart
    });
    expect(parsePomodoroBreakChainRecord('bad')).toBeNull();
  });

  it('returns zero when the stats day does not match', () => {
    const record = { completedPomodoros: 1, statsDayStartTs: dayStart };
    expect(pomodoroBreakChainForDay(record, hour, dayStart + 60_000)).toBe(1);
    expect(pomodoroBreakChainForDay(record, hour, dayStart - 86_400_000)).toBe(0);
    expect(pomodoroBreakChainForDay(null, hour, dayStart)).toBe(0);
  });
});
