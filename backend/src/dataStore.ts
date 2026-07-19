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
    this.db.transaction(() => {
      for (const s of USER_DATA_TABLE_SCHEMAS) {
        const patch = rowPatch[s.field as UserDataTable] as
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

        if (patch.deletes) {
          const del = this.db.prepare(serverDeleteSql(s));
          for (const key of patch.deletes) {
            const normalizedKey =
              s.sqlTable === 'sync_tombstones' && key && typeof key === 'object' && 'row_key' in key
                ? { ...(key as object), row_key: normalizeTombstoneRowKey(String((key as { row_key: string }).row_key)) }
                : key;
            del.run(userId, ...s.bindDeleteKey(normalizedKey as never));
          }
        }
        if (patch.upserts) {
          const upsert = this.db.prepare(serverPatchUpsertSql(s));
          const rows =
            s.sqlTable === 'sync_tombstones'
              ? normalizeSyncTombstones(patch.upserts as never)
              : patch.upserts;
          for (const row of rows) {
            upsert.run(...serverBindInsert(s, row, userId));
          }
        }
      }
    })();
  }
}
