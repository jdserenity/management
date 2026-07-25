import { logSyncError } from './syncLog';
import { TOMBSTONE_KEY_SEP, type StreakLogCellDeleteKey, type UserDataRowPatch } from './userData';

/** Multi-habit, multi-day mass deletes look like the 2026-07-25 false-tombstone wipe — refuse to enqueue. */
export const DANGEROUS_STREAK_LOG_DELETE_MIN_ROWS = 15;
export const DANGEROUS_STREAK_LOG_DELETE_MIN_ACTIVITIES = 3;
export const DANGEROUS_STREAK_LOG_DELETE_MIN_DATES = 3;

export const isDangerousBulkStreakLogDelete = (deletes: StreakLogCellDeleteKey[]): boolean => {
  if (deletes.length < DANGEROUS_STREAK_LOG_DELETE_MIN_ROWS) return false;
  const activities = new Set(deletes.map((d) => d.activity_id));
  const dates = new Set(deletes.map((d) => d.log_date));
  return activities.size >= DANGEROUS_STREAK_LOG_DELETE_MIN_ACTIVITIES
    && dates.size >= DANGEROUS_STREAK_LOG_DELETE_MIN_DATES;
};

/** Strip dangerous bulk streakLogCells deletes (+ matching tombstones) so a bad client cannot wipe history. */
export const sanitizeDangerousBulkDeletes = (patch: UserDataRowPatch): UserDataRowPatch => {
  const deletes = patch.streakLogCells?.deletes ?? [];
  if (!isDangerousBulkStreakLogDelete(deletes)) return patch;
  logSyncError(
    'refusing dangerous bulk streakLogCells delete patch',
    new Error('bulk streak log delete blocked'),
    { deletes: deletes.length, activities: new Set(deletes.map((d) => d.activity_id)).size, dates: new Set(deletes.map((d) => d.log_date)).size }
  );
  const blockedKeys = new Set(deletes.map((d) => `${d.log_date}${TOMBSTONE_KEY_SEP}${d.activity_id}`));
  const next: UserDataRowPatch = { ...patch };
  const upserts = patch.streakLogCells?.upserts;
  if (upserts?.length) next.streakLogCells = { upserts, deletes: [] };
  else delete next.streakLogCells;
  if (patch.syncTombstones) {
    const tombUpserts = (patch.syncTombstones.upserts ?? []).filter(
      (t) => !(t.entity === 'streakLogCells' && blockedKeys.has(t.row_key))
    );
    const tombDeletes = patch.syncTombstones.deletes;
    if (tombUpserts.length || tombDeletes?.length) {
      next.syncTombstones = { upserts: tombUpserts, deletes: tombDeletes };
    } else {
      delete next.syncTombstones;
    }
  }
  return next;
};
