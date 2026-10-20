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
  type SyncChange,
  type SyncChangesResponse,
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

type AnyTableSchema = (typeof USER_DATA_TABLE_SCHEMAS)[number];

/** Canonical change-log key for a row: singleton → '1', else rowKey column values joined by U+001F. */
const changeRowKey = (s: AnyTableSchema, rowOrKey: Record<string, unknown>): string => {
  if (s.singleton || s.rowKey.length === 0) return '1';
  return s.rowKey.map((c) => String(rowOrKey[c] ?? '')).join(TOMBSTONE_KEY_SEP);
};

export class SqliteDataStore {
  constructor(private readonly db: Database.Database) {}

  getCurrentSeq(userId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM sync_changes WHERE user_id=?')
      .get(userId) as { seq: number };
    return Number(row?.seq ?? 0);
  }

  /** Numbered changes after `since`, oldest first. `snapshotRequired` when the log no longer reaches back to `since`. */
  getChanges(userId: string, since: number): SyncChangesResponse {
    const currentSeq = this.getCurrentSeq(userId);
    const oldest = this.db
      .prepare('SELECT MIN(seq) AS seq FROM sync_changes WHERE user_id=?')
      .get(userId) as { seq: number | null };
    const rows = this.db
      .prepare('SELECT seq, entity, row_key, op, row_json, key_json FROM sync_changes WHERE user_id=? AND seq>? ORDER BY seq')
      .all(userId, since) as Array<{ seq: number; entity: string; row_key: string; op: string; row_json: string | null; key_json: string | null }>;
    return {
      changes: rows.map((r) => ({
        seq: r.seq,
        entity: r.entity as SyncChange['entity'],
        rowKey: r.row_key,
        op: r.op as SyncChange['op'],
        row: r.row_json ? (JSON.parse(r.row_json) as Record<string, unknown>) : null,
        ...(r.key_json ? { key: JSON.parse(r.key_json) as Record<string, unknown> } : {})
      })),
      currentSeq,
      snapshotRequired: since > 0 && oldest.seq != null && oldest.seq > since + 1
    };
  }

  /** Re-read the row the server actually holds after a patch step (a stale upsert may have been refused). */
  private readFinalRow(s: AnyTableSchema, userId: string, rowOrKey: Record<string, unknown>): Record<string, unknown> | null {
    const cols = s.columns.join(',');
    if (s.singleton || s.rowKey.length === 0) {
      return (this.db.prepare(`SELECT ${cols} FROM ${s.sqlTable} WHERE user_id=?`).get(userId) ?? null) as Record<string, unknown> | null;
    }
    const where = s.rowKey.map((c) => `${c}=?`).join(' AND ');
    const binds = s.rowKey.map((c) => rowOrKey[c] ?? null);
    return (this.db.prepare(`SELECT ${cols} FROM ${s.sqlTable} WHERE user_id=? AND ${where}`).get(userId, ...binds) ?? null) as Record<string, unknown> | null;
  }

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
      // A full replace invalidates every device cursor: restart the log with a snapshot marker.
      this.db.prepare('DELETE FROM sync_changes WHERE user_id=?').run(userId);
      this.db
        .prepare("INSERT INTO sync_changes (user_id, entity, row_key, op) VALUES (?, '__snapshot__', '', 'snapshot')")
        .run(userId);
    })();
  }

  putDataPatch(userId: string, rowPatch: UserDataRowPatch): void {
    const safePatch = sanitizeDangerousBulkDeletes(rowPatch);
    this.db.transaction(() => {
      // Final server state per touched row, in touch order — becomes the change log for this patch.
      const pending = new Map<string, Omit<SyncChange, 'seq'>>();
      const record = (s: AnyTableSchema, rowOrKey: Record<string, unknown>): void => {
        const finalRow = this.readFinalRow(s, userId, rowOrKey);
        const rowKey = changeRowKey(s, finalRow ?? rowOrKey);
        const mapKey = `${s.field}${TOMBSTONE_KEY_SEP}${rowKey}`;
        pending.delete(mapKey);
        if (finalRow) {
          pending.set(mapKey, { entity: s.field as SyncChange['entity'], rowKey, op: 'upsert', row: finalRow });
        } else {
          const key: Record<string, unknown> = {};
          for (const c of s.rowKey) key[c] = rowOrKey[c] ?? null;
          pending.set(mapKey, { entity: s.field as SyncChange['entity'], rowKey, op: 'delete', row: null, key });
        }
      };

      // Tombstones first so versioned deletes can read deleted_at in the same transaction.
      const tombSchema = USER_DATA_TABLE_SCHEMAS.find((s) => s.sqlTable === 'sync_tombstones')!;
      const tombPatch = safePatch.syncTombstones;
      if (tombPatch?.upserts?.length) {
        const upsert = this.db.prepare(serverPatchUpsertSql(tombSchema));
        for (const row of normalizeSyncTombstones(tombPatch.upserts)) {
          upsert.run(...serverBindInsert(tombSchema, row, userId));
          record(tombSchema, row as unknown as Record<string, unknown>);
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
              record(s, patch.set as Record<string, unknown>);
            } else {
              this.db.prepare(serverDeleteSql(s)).run(userId);
              record(s, {});
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
              record(s, normalizedKey as Record<string, unknown>);
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
              if (!deletedAt) { record(s, normalizedKey); continue; }
              // serverDeleteSql's WHERE matches bindDeleteKey (e.g. entries delete
              // by id only, not the full (id, log_day) row key) — building the
              // WHERE from rowKey instead under-binds and throws.
              this.db.prepare(
                `${serverDeleteSql(s)} AND ${clock} <= ?`
              ).run(userId, ...binds, deletedAt);
            } else {
              this.db.prepare(serverDeleteSql(s)).run(userId, ...binds);
            }
            record(s, normalizedKey);
          }
        }
        if (patch.upserts) {
          const upsert = this.db.prepare(serverPatchUpsertSql(s));
          for (const row of patch.upserts) {
            upsert.run(...serverBindInsert(s, row, userId));
            record(s, row as Record<string, unknown>);
          }
        }
      }

      const insertChange = this.db.prepare(
        'INSERT INTO sync_changes (user_id, entity, row_key, op, row_json, key_json) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const change of pending.values()) {
        insertChange.run(
          userId,
          change.entity,
          change.rowKey,
          change.op,
          change.row ? JSON.stringify(change.row) : null,
          change.key ? JSON.stringify(change.key) : null
        );
      }
    })();
  }
}
