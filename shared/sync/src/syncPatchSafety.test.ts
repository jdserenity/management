import { describe, expect, it, vi } from 'vitest';
import {
  DANGEROUS_STREAK_LOG_DELETE_MIN_ROWS,
  isDangerousBulkStreakLogDelete,
  sanitizeDangerousBulkDeletes
} from './syncPatchSafety';
import { TOMBSTONE_KEY_SEP } from './userData';

describe('isDangerousBulkStreakLogDelete', () => {
  it('allows a single-activity reset-sized delete list', () => {
    const deletes = Array.from({ length: 40 }, (_, i) => ({
      log_date: `2026-05-${String((i % 28) + 1).padStart(2, '0')}`,
      activity_id: 'wake-up'
    }));
    expect(isDangerousBulkStreakLogDelete(deletes)).toBe(false);
  });

  it('flags multi-habit multi-day mass deletes', () => {
    const deletes = [];
    for (let d = 1; d <= 10; d++) {
      for (const activity_id of ['wake-up', 'water', 'work']) {
        deletes.push({ log_date: `2026-05-${String(d).padStart(2, '0')}`, activity_id });
      }
    }
    expect(deletes.length).toBeGreaterThanOrEqual(DANGEROUS_STREAK_LOG_DELETE_MIN_ROWS);
    expect(isDangerousBulkStreakLogDelete(deletes)).toBe(true);
  });
});

describe('sanitizeDangerousBulkDeletes', () => {
  it('strips deletes and matching tombstones from a dangerous patch', () => {
    const deletes = [];
    for (let d = 1; d <= 10; d++) {
      for (const activity_id of ['wake-up', 'water', 'work']) {
        deletes.push({ log_date: `2026-05-${String(d).padStart(2, '0')}`, activity_id });
      }
    }
    const patch = sanitizeDangerousBulkDeletes({
      streakLogCells: {
        upserts: [{ log_date: '2026-07-25', activity_id: 'jog', state: 'success', updated_at: 'x' }],
        deletes
      },
      syncTombstones: {
        upserts: deletes.map((d) => ({
          entity: 'streakLogCells',
          row_key: `${d.log_date}${TOMBSTONE_KEY_SEP}${d.activity_id}`,
          deleted_at: '2026-07-25T18:52:21.178Z'
        }))
      }
    });
    expect(patch.streakLogCells?.deletes ?? []).toEqual([]);
    expect(patch.streakLogCells?.upserts).toHaveLength(1);
    expect(patch.syncTombstones?.upserts ?? []).toEqual([]);
  });

  it('leaves a normal uncheck patch alone', () => {
    const patch = {
      streakLogCells: { deletes: [{ log_date: '2026-07-25', activity_id: 'water' }], upserts: [] as never[] }
    };
    expect(sanitizeDangerousBulkDeletes(patch)).toEqual(patch);
  });
});
