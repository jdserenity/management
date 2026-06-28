import { describe, expect, it } from 'vitest';
import type { UserData } from './userData';
import {
  assertSafeSnapshotPush,
  DataWipeRefusedError,
  isUserDataEmpty,
  totalUserDataRows
} from './userDataSafety';

const emptyData = (): UserData => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

describe('userDataSafety', () => {
  it('treats all-empty snapshot as empty', () => {
    expect(isUserDataEmpty(emptyData())).toBe(true);
    expect(totalUserDataRows(emptyData())).toBe(0);
  });

  it('counts config rows and table rows', () => {
    const data: UserData = {
      ...emptyData(),
      appKv: [{ key: 'k', value: 'v', updated_at: 1 }],
      nutritionConfig: { tdee: 2000, protein: 150, log_day: '2026-06-28' },
      waterConfig: { target_ml: 2500, log_day: '2026-06-28' }
    };
    expect(totalUserDataRows(data)).toBe(3);
    expect(isUserDataEmpty(data)).toBe(false);
  });

  it('refuses empty push over existing data', () => {
    expect(() => assertSafeSnapshotPush(emptyData(), 1)).toThrow(DataWipeRefusedError);
    expect(() => assertSafeSnapshotPush(emptyData(), 0)).not.toThrow();
  });

  it('allows non-empty push over existing data', () => {
    const incoming = { ...emptyData(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    expect(() => assertSafeSnapshotPush(incoming, 5)).not.toThrow();
  });
});
