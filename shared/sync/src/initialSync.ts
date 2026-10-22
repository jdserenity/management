import type { SqlDatabase } from '@mgmt/storage';
import { applySyncChanges, fetchSyncChanges, getSyncCursor, setSyncCursor } from './changeSync';
import { dispatchDataSyncRefresh } from './dataSyncEvents';
import { logSyncError, logSyncInfo, summarizeUserDataCounts } from './syncLog';
import { drainSyncOutbox } from './syncOutbox';
import { extractUserData, fetchUserDataWithSeq, hydrateDb, pushUserDataDiff } from './userData';
import { totalUserDataRows } from './userDataSafety';
import { markSyncPullResult } from './syncStatus';

export type BidirectionalSyncResult = {
  pullOk: boolean;
  pushOk: boolean;
  skipped: boolean;
  reason?: 'no-creds' | 'no-db' | 'pull-failed';
  pullError?: string;
  pushError?: string;
  counts?: Record<string, number>;
};

export type BidirectionalSyncOpts = {
  logLabel: string;
  db: SqlDatabase;
  serverUrl?: string;
  serverToken?: string;
  unreachableMessage?: (serverUrl: string) => string;
};

let lastSyncWarning: string | null = null;

export const getSyncWarning = (): string | null => lastSyncWarning;

export const resetSyncWarningForTests = (): void => { lastSyncWarning = null; };

const defaultUnreachable = (serverUrl: string): string =>
  `Cannot reach ${serverUrl} from this device. ` +
  'If curl /health works on the VPS but not here, this network’s DNS probably cannot resolve the hostname — try DNS 1.1.1.1 on this device.';

const sameUserData = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * One-time convergence onto the server-referee model (new device, upgraded
 * device with no cursor, or the server restarted its change log):
 * upload local rows as a patch — the server's patch guards decide what
 * survives — then adopt the server's final snapshot and cursor verbatim.
 * This is the ONLY path that rewrites local tables from a snapshot.
 */
const bootstrapFromServer = async (
  db: SqlDatabase,
  serverUrl: string,
  serverToken: string
): Promise<{ pushOk: boolean }> => {
  let local = await extractUserData(db);
  let pushOk = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = await fetchUserDataWithSeq(serverUrl, serverToken);
    if (totalUserDataRows(local) > 0) {
      try {
        // Upserts only: this device may be stale, so rows the server has that
        // it lacks are other devices' data — never deletions. The snapshot
        // adoption below then brings this device up to date.
        await pushUserDataDiff(serverUrl, serverToken, snapshot.data, local, { upsertsOnly: true });
      } catch (err) {
        // Do not adopt the snapshot over local rows the server never received.
        logSyncError('bootstrap upload failed; keeping local data', err);
        return { pushOk: false };
      }
    }
    const finalSnapshot = totalUserDataRows(local) > 0
      ? await fetchUserDataWithSeq(serverUrl, serverToken)
      : snapshot;
    const localNow = await extractUserData(db);
    if (!sameUserData(local, localNow) && attempt === 0) {
      // A save landed while the snapshot was in flight — loop once to upload it too.
      local = localNow;
      continue;
    }
    if (!sameUserData(localNow, finalSnapshot.data)) {
      await hydrateDb(db, finalSnapshot.data);
    }
    await setSyncCursor(db, finalSnapshot.seq);
    return { pushOk };
  }
  return { pushOk };
};

/**
 * Normal sync: push queued local patches, then apply the server's numbered
 * changes after this device's cursor. The server is the only referee — this
 * device never merges two snapshots or compares clocks.
 */
const syncViaChangeLog = async (
  db: SqlDatabase,
  serverUrl: string,
  serverToken: string
): Promise<{ pushOk: boolean; bootstrapped: boolean }> => {
  await drainSyncOutbox(db, serverUrl, serverToken);
  const cursor = await getSyncCursor(db);
  if (cursor === 0) {
    const { pushOk } = await bootstrapFromServer(db, serverUrl, serverToken);
    return { pushOk, bootstrapped: true };
  }
  const resp = await fetchSyncChanges(serverUrl, serverToken, cursor);
  const needsBootstrap =
    resp.snapshotRequired ||
    resp.currentSeq < cursor ||
    resp.changes.some((c) => c.op === 'snapshot' || c.entity === '__snapshot__');
  if (needsBootstrap) {
    const { pushOk } = await bootstrapFromServer(db, serverUrl, serverToken);
    return { pushOk, bootstrapped: true };
  }
  if (resp.changes.length > 0) {
    await applySyncChanges(db, resp.changes, resp.currentSeq);
  } else if (resp.currentSeq !== cursor) {
    await setSyncCursor(db, resp.currentSeq);
  }
  // Pull only counts as successful once changes are applied locally.
  markSyncPullResult(true);
  return { pushOk: true, bootstrapped: false };
};

/** Pull server changes, upload queued local patches, converge on the server's final state. */
export const runBidirectionalInitialSync = async (opts: BidirectionalSyncOpts): Promise<BidirectionalSyncResult> => {
  const { logLabel, db, serverUrl, serverToken } = opts;
  const unreachable = opts.unreachableMessage ?? defaultUnreachable;
  if (!serverUrl || !serverToken) {
    const msg = 'Sync is not configured in this build (missing server URL or token).';
    lastSyncWarning = msg;
    logSyncError(`${logLabel} initial sync skipped`, new Error('missing VITE_SERVER_URL or VITE_SERVER_TOKEN'), {
      hasUrl: Boolean(serverUrl),
      hasToken: Boolean(serverToken)
    });
    return { pullOk: false, pushOk: false, skipped: true, reason: 'no-creds', pullError: msg };
  }
  logSyncInfo(`${logLabel} initial sync starting`, { serverUrl });
  let outcome: { pushOk: boolean; bootstrapped: boolean };
  try {
    outcome = await syncViaChangeLog(db, serverUrl, serverToken);
  } catch (err) {
    const msg = unreachable(serverUrl);
    lastSyncWarning = msg;
    logSyncError(`${logLabel} initial sync: pull failed`, err, { serverUrl });
    return { pullOk: false, pushOk: false, skipped: false, reason: 'pull-failed', pullError: msg };
  }
  dispatchDataSyncRefresh();
  const counts = summarizeUserDataCounts(await extractUserData(db));
  if (!outcome.pushOk) {
    const msg = 'Downloaded from server but upload failed. New changes on this device may not sync.';
    lastSyncWarning = msg;
    logSyncError(`${logLabel} initial sync: pull ok, push failed`, new Error(msg), { counts });
    return { pullOk: true, pushOk: false, skipped: false, counts, pushError: msg };
  }
  lastSyncWarning = null;
  logSyncInfo(`${logLabel} initial sync complete`, { counts, bootstrapped: outcome.bootstrapped });
  return { pullOk: true, pushOk: true, skipped: false, counts };
};

/** Foreground pull (poll / refocus): same change-log path; never merges snapshots. */
export const pullAndMergeUserData = async (opts: BidirectionalSyncOpts): Promise<boolean> => {
  const { db, serverUrl, serverToken, logLabel } = opts;
  if (!serverUrl || !serverToken) return false;
  try {
    const { bootstrapped } = await syncViaChangeLog(db, serverUrl, serverToken);
    dispatchDataSyncRefresh();
    logSyncInfo(`${logLabel} foreground pull complete`, {
      bootstrapped,
      ...summarizeUserDataCounts(await extractUserData(db))
    });
    return true;
  } catch (err) {
    // Visible in Settings → Sync health instead of a silent stuck state.
    markSyncPullResult(false, err instanceof Error ? err.message : String(err));
    logSyncError(`${logLabel} foreground pull failed`, err, { serverUrl });
    return false;
  }
};