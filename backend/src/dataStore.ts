import type Database from 'better-sqlite3';
import {
  assertSafeSnapshotPush,
  totalUserDataRows,
  USER_DATA_TABLE_SCHEMAS,
  serverBindInsert,
  serverDeleteSql,
  serverPatchUpsertSql,
  serverPlainInsertSql,
  serverSelectSql,
  normalizeSyncTombstones,
  normalizeTombstoneRowKey,
  sanitizeDangerousBulkDeletes,
  tombstoneRowKey,
  TOMBSTONE_KEY_SEP,
  type SyncTombstone,
  type UserData,
  type UserDataRowPatch,
  type UserDataTable
} from '@mgmt/sync';

export type {
  UserData,
  UserDataRowPatch,
  FocusLogRow,
  WorkoutLogRow,
  AppKvRow,
  NutritionConfig,
  NutritionStaple,
  NutritionRegular,
  NutritionEntry,
  StreakActivity,
  StreakLogCell,
  StreakActivityMeta,
  WaterConfig,
  WaterEntry
} from '@mgmt/sync';

const tombstoneMapKey = (entity: string, rowKey: string): string =>
  `${entity}${TOMBSTONE_KEY_SEP}${rowKey}`;

const deleteRowKeyForSchema = (sqlTable: string, key: Record<string, unknown>): string => {
  if (sqlTable === 'streak_log_cells') {
    return tombstoneRowKey(String(key.log_date ?? ''), String(key.activity_id ?? ''));
  }
  if (sqlTable === 'streak_activity_meta') return String(key.activity_id ?? '');
  if (sqlTable === 'app_kv') return String(key.key ?? '');
  if (sqlTable === 'sync_tombstones') return normalizeTombstoneRowKey(String(key.row_key ?? ''));
  if ('id' in key) return String(key.id ?? '');
  return Object.values(key).map((v) => String(v ?? '')).join(TOMBSTONE_KEY_SEP);
};

export class SqliteDataStore {
  constructor(private readonly db: Database.Database) {}

  getData(userId: string): UserData {
    const out = {} as UserData;
    for (const s of USER_DATA_TABLE_SCHEMAS) {
      const sql = serverSelectSql(s);
      if (s.singleton) {
        const row = this.db.prepare(sql).get(userId) ?? null;
        (out as Record<string, unknown>)[s.field] = row;
      } else {
        (out as Record<string, unknown>)[s.field] = this.db.prepare(sql).all(userId);
      }
    }
    out.syncTombstones = normalizeSyncTombstones(out.syncTombstones);
    return out;
  }

  putData(userId: string, data: UserData): void {
    const existingRows = totalUserDataRows(this.getData(userId));
    const normalized: UserData = {
      ...data,
      syncTombstones: normalizeSyncTombstones(data.syncTombstones)
    };
    assertSafeSnapshotPush(normalized, existingRows);
    this.db.transaction(() => {
      for (const s of USER_DATA_TABLE_SCHEMAS) {
        this.db.prepare(`DELETE FROM ${s.sqlTable} WHERE user_id=?`).run(userId);
      }
      for (const s of USER_DATA_TABLE_SCHEMAS) {
        const insert = this.db.prepare(serverPlainInsertSql(s));
        for (const row of s.getRows(normalized)) {
          insert.run(...serverBindInsert(s, row, userId));
        }
      }
    })();
  }

  putDataPatch(userId: string, rowPatch: UserDataRowPatch): void {
    const safePatch = sanitizeDangerousBulkDeletes(rowPatch);
    this.db.transaction(() => {
      // Tombstones first so versioned deletes can read deleted_at in the same transaction.
      const tombSchema = USER_DATA_TABLE_SCHEMAS.find((s) => s.sqlTable === 'sync_tombstones')!;
      const tombPatch = safePatch.syncTombstones;
      if (tombPatch?.upserts?.length) {
        const upsert = this.db.prepare(serverPatchUpsertSql(tombSchema));
        for (const row of normalizeSyncTombstones(tombPatch.upserts)) {
          upsert.run(...serverBindInsert(tombSchema, row, userId));
        }
      }

      const tombByKey = new Map<string, string>();
      const existingTombs = this.db.prepare(
        'SELECT entity, row_key, deleted_at FROM sync_tombstones WHERE user_id=?'
      ).all(userId) as SyncTombstone[];
      for (const t of normalizeSyncTombstones(existingTombs)) {
        tombByKey.set(tombstoneMapKey(t.entity, t.row_key), t.deleted_at);
      }

      for (const s of USER_DATA_TABLE_SCHEMAS) {
        const patch = safePatch[s.field as UserDataTable] as
          | { upserts?: unknown[]; deletes?: unknown[]; set?: unknown | null }
          | undefined;
        if (!patch) continue;

        if (s.singleton) {
          if (patch.set !== undefined) {
            if (patch.set) {
              this.db.prepare(serverPatchUpsertSql(s)).run(...serverBindInsert(s, patch.set, userId));
            } else {
              this.db.prepare(serverDeleteSql(s)).run(userId);
            }
          }
          continue;
        }

        if (s.sqlTable === 'sync_tombstones') {
          if (patch.deletes) {
            const del = this.db.prepare(serverDeleteSql(s));
            for (const key of patch.deletes) {
              const normalizedKey =
                key && typeof key === 'object' && 'row_key' in key
                  ? { ...(key as object), row_key: normalizeTombstoneRowKey(String((key as { row_key: string }).row_key)) }
                  : key;
              del.run(userId, ...s.bindDeleteKey(normalizedKey as never));
            }
          }
          continue;
        }

        if (patch.deletes) {
          const clock = s.updatedAtColumn;
          for (const key of patch.deletes) {
            const normalizedKey = key as Record<string, unknown>;
            const binds = s.bindDeleteKey(normalizedKey as never);
            if (clock) {
              const rowKey = deleteRowKeyForSchema(s.sqlTable, normalizedKey);
              const deletedAt = tombByKey.get(tombstoneMapKey(s.field, rowKey));
              // Stale delete without a tombstone clock, or older than the row, must not win.
              if (!deletedAt) continue;
              this.db.prepare(
                `DELETE FROM ${s.sqlTable} WHERE user_id=? AND ${s.rowKey.map((c) => `${c}=?`).join(' AND ')} AND ${clock} <= ?`
              ).run(userId, ...binds, deletedAt);
            } else {
              this.db.prepare(serverDeleteSql(s)).run(userId, ...binds);
            }
          }
        }
        if (patch.upserts) {
          const upsert = this.db.prepare(serverPatchUpsertSql(s));
          for (const row of patch.upserts) {
            upsert.run(...serverBindInsert(s, row, userId));
          }
        }
      }
    })();
  }
}
