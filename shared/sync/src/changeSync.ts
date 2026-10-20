import type { SqlDatabase } from '@mgmt/storage';
import { normalizeApiUrl } from './apiUrl';
import { logSyncError, logSyncHttpFailure, logSyncInfo } from './syncLog';
import { markSyncPullResult } from './syncStatus';
import type { SyncChange, SyncChangesResponse } from './syncChanges';
import { syncFetch } from './syncFetch';
import { getRawSqlDatabase, runWithoutDataSync } from './userData';
import { clientInsertSql, schemaByField, type AnyUserDataTableSchema } from './userDataSchema';
import { withDataSyncWriteLock } from './syncWriteLock';

/**
 * Device side of the server-referee change log.
 * A device remembers one number — the last server `seq` it applied — in the
 * local-only `sync_state` table. Pulling means: ask for changes after that
 * number and write them into SQLite exactly as the server sent them. No
 * clock comparison, no snapshot merge, no wipe-and-refill outside bootstrap.
 */

const CURSOR_KEY = 'user_data_seq';

export const ensureSyncStateTable = async (db: SqlDatabase): Promise<SqlDatabase> => {
  const raw = getRawSqlDatabase(db);
  await raw.execute(
    'CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  );
  return raw;
};

export const getSyncCursor = async (db: SqlDatabase): Promise<number> => {
  const raw = await ensureSyncStateTable(db);
  const rows = await raw.select<Array<{ value: string }>>(
    'SELECT value FROM sync_state WHERE key=?',
    [CURSOR_KEY]
  );
  const n = Number(rows?.[0]?.value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export const setSyncCursor = async (db: SqlDatabase, seq: number): Promise<void> => {
  const raw = await ensureSyncStateTable(db);
  await raw.execute('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [
    CURSOR_KEY,
    String(Math.max(0, Math.floor(seq)))
  ]);
};

export const fetchSyncChanges = async (
  baseUrl: string,
  token: string,
  since: number
): Promise<SyncChangesResponse> => {
  const root = normalizeApiUrl(baseUrl);
  if (!root) throw new Error('fetchSyncChanges: missing server URL');
  const url = `${root}/v1/changes?since=${Math.max(0, Math.floor(since))}`;
  let res: Response;
  try {
    res = await syncFetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    markSyncPullResult(false, detail);
    throw new Error(`fetchSyncChanges: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('GET', url, res);
    markSyncPullResult(false, `HTTP ${res.status}`);
    throw new Error(`fetchSyncChanges: HTTP ${res.status}`);
  }
  const body = (await res.json()) as SyncChangesResponse;
  markSyncPullResult(true);
  return {
    changes: Array.isArray(body.changes) ? body.changes : [],
    currentSeq: Number(body.currentSeq ?? 0),
    snapshotRequired: Boolean(body.snapshotRequired)
  };
};

const upsertSqlFor = (s: AnyUserDataTableSchema): string =>
  clientInsertSql(s).replace(/^INSERT INTO/, 'INSERT OR REPLACE INTO');

const applyOneChange = async (raw: SqlDatabase, change: SyncChange): Promise<void> => {
  const s = schemaByField[change.entity as keyof typeof schemaByField];
  if (!s) return;
  if (change.op === 'upsert' && change.row) {
    await raw.execute(upsertSqlFor(s), s.bind(change.row as never));
    return;
  }
  if (change.op === 'delete') {
    if (s.singleton || s.rowKey.length === 0) {
      await raw.execute(`DELETE FROM ${s.sqlTable} WHERE id=1`);
      return;
    }
    const key = change.key ?? {};
    const cols = s.rowKey.filter((c) => key[c] != null);
    if (!cols.length) return;
    await raw.execute(
      `DELETE FROM ${s.sqlTable} WHERE ${cols.map((c) => `${c}=?`).join(' AND ')}`,
      cols.map((c) => key[c])
    );
  }
};

/**
 * Apply server changes in seq order and advance the cursor, atomically.
 * Runs on the raw DB under the write lock + sync suppression, so a change can
 * never land half-way through a user save or re-enter the push wrapper.
 * Returns how many changes were written.
 */
export const applySyncChanges = async (
  db: SqlDatabase,
  changes: SyncChange[],
  currentSeq: number
): Promise<number> => {
  if (!changes.length) {
    await setSyncCursor(db, currentSeq);
    return 0;
  }
  return withDataSyncWriteLock(async () => {
    const raw = await ensureSyncStateTable(db);
    return runWithoutDataSync(async () => {
      let began = false;
      try {
        try {
          await raw.execute('BEGIN');
          began = true;
        } catch { /* some drivers reject BEGIN — apply without a txn */ }
        for (const change of changes) await applyOneChange(raw, change);
        await raw.execute('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [
          CURSOR_KEY,
          String(Math.max(0, Math.floor(currentSeq)))
        ]);
        if (began) await raw.execute('COMMIT');
      } catch (err) {
        if (began) {
          try { await raw.execute('ROLLBACK'); } catch { /* ignore */ }
        }
        logSyncError('applySyncChanges failed', err, { changes: changes.length });
        throw err;
      }
      logSyncInfo('applied server changes', { count: changes.length, currentSeq });
      return changes.length;
    });
  });
};
