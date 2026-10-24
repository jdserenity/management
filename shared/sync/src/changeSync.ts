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
  // Do NOT mark the pull successful here: fetching is not syncing. The caller
  // marks success only after the changes are actually applied locally —
  // otherwise the status card says "Last pull: Just now" while every apply
  // failed and nothing ever arrived (2026-10-22 incident).
  return {
    changes: Array.isArray(body.changes) ? body.changes : [],
    currentSeq: Number(body.currentSeq ?? 0),
    snapshotRequired: Boolean(body.snapshotRequired)
  };
};

const upsertSqlFor = (s: AnyUserDataTableSchema): string =>
  clientInsertSql(s).replace(/^INSERT INTO/, 'INSERT OR REPLACE INTO');

/** Multi-row version of the client insert for batched upserts (non-singleton tables). */
const groupedUpsertSqlFor = (s: AnyUserDataTableSchema, rowCount: number): string => {
  const base = upsertSqlFor(s);
  const oneRow = base.slice(base.lastIndexOf('VALUES') + 'VALUES'.length).trim();
  return `${base.slice(0, base.lastIndexOf('VALUES'))}VALUES ${Array.from({ length: rowCount }, () => oneRow).join(',')}`;
};

const applyDeleteChange = async (raw: SqlDatabase, s: AnyUserDataTableSchema, change: SyncChange): Promise<void> => {
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
};

const applyOneChange = async (raw: SqlDatabase, change: SyncChange): Promise<void> => {
  const s = schemaByField[change.entity as keyof typeof schemaByField];
  if (!s) return;
  if (change.op === 'upsert' && change.row) {
    await raw.execute(upsertSqlFor(s), s.bind(change.row as never));
    return;
  }
  if (change.op === 'delete') await applyDeleteChange(raw, s, change);
};

/**
 * Execute one chunk's changes in seq order. Consecutive upserts to the same
 * table coalesce into a single multi-row statement — over the Tauri bridge
 * every statement is an IPC round-trip, so 1,500 individual inserts become
 * a handful of statements and no transaction stays open long.
 */
const executeChunkChanges = async (raw: SqlDatabase, chunk: SyncChange[]): Promise<void> => {
  let i = 0;
  while (i < chunk.length) {
    const change = chunk[i]!;
    const s = schemaByField[change.entity as keyof typeof schemaByField];
    if (s && !s.singleton && change.op === 'upsert' && change.row) {
      const rows: Record<string, unknown>[] = [change.row];
      let j = i + 1;
      while (j < chunk.length && chunk[j]!.entity === change.entity && chunk[j]!.op === 'upsert' && chunk[j]!.row) {
        rows.push(chunk[j]!.row!);
        j++;
      }
      const binds = rows.flatMap((r) => s.bind(r as never) as unknown[]);
      await raw.execute(groupedUpsertSqlFor(s, rows.length), binds);
      i = j;
      continue;
    }
    await applyOneChange(raw, change);
    i++;
  }
};

/** Changes per transaction. Small enough that a hang/failure loses little and the write lock is never held long. */
export const SYNC_APPLY_CHUNK_SIZE = 200;

const applyChunk = async (
  db: SqlDatabase,
  chunk: SyncChange[],
  cursorAfter: number
): Promise<void> => {
  await withDataSyncWriteLock(async () => {
    const raw = await ensureSyncStateTable(db);
    await runWithoutDataSync(async () => {
      // No BEGIN/COMMIT: Tauri's plugin-sql uses a sqlx pool (several connections
      // to the same file). Separate BEGIN then INSERT then COMMIT often run on
      // *different* connections, so the BEGIN stays open on one connection and
      // every other write hits SQLITE_BUSY ("database is locked (5)") — the
      // desktop-open + phone-edit failure mode. Upserts are idempotent
      // (INSERT OR REPLACE); the JS write lock serializes writers; cursor is
      // saved after the chunk so a crash mid-chunk just re-applies on next poll.
      await executeChunkChanges(raw, chunk);
      await raw.execute('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [
        CURSOR_KEY,
        String(Math.max(0, Math.floor(cursorAfter)))
      ]);
    });
  });
};

/**
 * Apply server changes in seq order, in chunks of SYNC_APPLY_CHUNK_SIZE.
 * The cursor is saved after every chunk, so progress is never all-or-nothing:
 * a crash or hang mid-batch keeps earlier chunks, and the next poll resumes
 * where this one stopped instead of retrying thousands of changes across the
 * IPC bridge. The write lock is released between chunks so user writes are
 * never queued behind a big pull. Chunks are NOT wrapped in BEGIN/COMMIT —
 * Tauri plugin-sql's sqlx pool makes that lock the DB (see applyChunk).
 * If a chunk fails, its changes are retried one-by-one to isolate the bad
 * row; the cursor stops before that row and the error is rethrown (callers
 * surface it in sync status) rather than silently swallowing the batch.
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
  let applied = 0;
  for (let start = 0; start < changes.length; start += SYNC_APPLY_CHUNK_SIZE) {
    const chunk = changes.slice(start, start + SYNC_APPLY_CHUNK_SIZE);
    const isLast = start + chunk.length >= changes.length;
    const cursorAfter = isLast ? currentSeq : chunk[chunk.length - 1]!.seq;
    try {
      await applyChunk(db, chunk, cursorAfter);
      applied += chunk.length;
    } catch (chunkErr) {
      // Isolate: retry this chunk one change at a time so one poison row
      // cannot block every other change behind it forever.
      logSyncError('applySyncChanges chunk failed; isolating', chunkErr, { chunk: chunk.length });
      for (const change of chunk) {
        try {
          await applyChunk(db, [change], change.seq);
          applied += 1;
        } catch (err) {
          logSyncError('applySyncChanges failed on change', err, { seq: change.seq, entity: change.entity, op: change.op });
          throw err;
        }
      }
      if (isLast) await setSyncCursor(db, currentSeq);
    }
  }
  logSyncInfo('applied server changes', { count: applied, currentSeq });
  return applied;
};
