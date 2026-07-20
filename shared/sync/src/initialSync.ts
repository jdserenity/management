import type { SqlDatabase } from '@mgmt/storage';
import { dispatchDataSyncRefresh } from './dataSyncEvents';
import { logSyncError, logSyncInfo, summarizeUserDataCounts } from './syncLog';
import { drainSyncOutbox } from './syncOutbox';
import { extractUserData, fetchUserData, hydrateDb, hydrateDbFromServer, pushUserDataDiff, emptyUserData, type UserData } from './userData';
import { mergeUserData } from './mergeUserData';
import { totalUserDataRows } from './userDataSafety';

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

const sameUserData = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Merge a pull snapshot with the server, then fold in any local writes that landed while the
 * network fetch was in flight (so hydrate does not wipe a just-saved streak edit).
 */
const mergePullWithLocalNow = async (
  db: SqlDatabase,
  localBefore: UserData,
  serverData: UserData
): Promise<{ merged: UserData; localNow: UserData }> => {
  const localNow = await extractUserData(db);
  const remoteMerged = mergeUserData(localBefore, serverData);
  const merged = sameUserData(localBefore, localNow)
    ? remoteMerged
    : mergeUserData(remoteMerged, localNow);
  return { merged, localNow };
};

const applyPullMerge = async (
  db: SqlDatabase,
  serverUrl: string,
  serverToken: string,
  localBefore: UserData,
  serverData: UserData
): Promise<void> => {
  const { merged, localNow } = await mergePullWithLocalNow(db, localBefore, serverData);
  if (!sameUserData(localNow, merged)) await hydrateDb(db, merged);
  if (!sameUserData(serverData, merged)) await pushUserDataDiff(serverUrl, serverToken, serverData, merged);
};

export const getSyncWarning = (): string | null => lastSyncWarning;

export const resetSyncWarningForTests = (): void => { lastSyncWarning = null; };

const defaultUnreachable = (serverUrl: string): string =>
  `Cannot reach ${serverUrl} from this device. ` +
  'If curl /health works on the VPS but not here, this network’s DNS probably cannot resolve the hostname — try DNS 1.1.1.1 on this device.';

/** Pull server snapshot, merge with local when both have rows, push when needed. */
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
  // Push pending local patches (including archive / tombstones) before merge so we don't lose them to LWW races.
  await drainSyncOutbox(db, serverUrl, serverToken);
  const localBefore = await extractUserData(db);
  const localRows = totalUserDataRows(localBefore);
  let serverData;
  try {
    serverData = await fetchUserData(serverUrl, serverToken);
  } catch (err) {
    const msg = unreachable(serverUrl);
    lastSyncWarning = msg;
    logSyncError(`${logLabel} initial sync: pull failed`, err, { serverUrl, localRows });
    return { pullOk: false, pushOk: false, skipped: false, reason: 'pull-failed', pullError: msg };
  }
  const serverRows = totalUserDataRows(serverData);
  let pushOk = true;
  if (localRows === 0 && serverRows === 0) {
    logSyncInfo(`${logLabel} initial sync: both sides empty`);
  } else if (localRows === 0 && serverRows > 0) {
    await hydrateDbFromServer(db, serverData, localBefore);
    dispatchDataSyncRefresh();
    logSyncInfo(`${logLabel} initial sync: pulled server data`, { serverRows });
  } else if (serverRows === 0 && localRows > 0) {
    logSyncInfo(`${logLabel} initial sync: uploading local data (server was empty)`, { localRows });
    try {
      await pushUserDataDiff(serverUrl, serverToken, emptyUserData(), localBefore);
    } catch (err) {
      pushOk = false;
      logSyncError(`${logLabel} initial sync: push failed`, err, { serverUrl });
    }
  } else {
    try {
      await applyPullMerge(db, serverUrl, serverToken, localBefore, serverData);
    } catch (err) {
      pushOk = false;
      logSyncError(`${logLabel} initial sync: merge push failed`, err, { serverUrl });
    }
    dispatchDataSyncRefresh();
    logSyncInfo(`${logLabel} initial sync: merged and uploaded`, {
      localRows,
      serverRows,
      merged: summarizeUserDataCounts(await extractUserData(db))
    });
  }
  const counts = summarizeUserDataCounts(await extractUserData(db));
  if (!pushOk) {
    const msg = 'Downloaded from server but upload failed. New changes on this device may not sync.';
    lastSyncWarning = msg;
    logSyncError(`${logLabel} initial sync: pull ok, push failed`, new Error(msg), { counts });
    return { pullOk: true, pushOk: false, skipped: false, counts, pushError: msg };
  }
  lastSyncWarning = null;
  logSyncInfo(`${logLabel} initial sync complete`, { counts, serverRows, localRows });
  return { pullOk: true, pushOk, skipped: false, counts };
};

/** Foreground pull: merge when both sides have data; never push when server is empty. */
export const pullAndMergeUserData = async (opts: BidirectionalSyncOpts): Promise<boolean> => {
  const { db, serverUrl, serverToken, logLabel } = opts;
  if (!serverUrl || !serverToken) return false;
  try {
    await drainSyncOutbox(db, serverUrl, serverToken);
    const localBefore = await extractUserData(db);
    const serverData = await fetchUserData(serverUrl, serverToken);
    const localRows = totalUserDataRows(localBefore);
    const serverRows = totalUserDataRows(serverData);
    if (localRows === 0 && serverRows === 0) return true;
    if (localRows === 0 && serverRows > 0) {
      await hydrateDbFromServer(db, serverData, localBefore);
    } else if (serverRows === 0 && localRows > 0) {
      return true;
    } else {
      await applyPullMerge(db, serverUrl, serverToken, localBefore, serverData);
    }
    dispatchDataSyncRefresh();
    logSyncInfo(`${logLabel} foreground pull complete`, summarizeUserDataCounts(await extractUserData(db)));
    return true;
  } catch (err) {
    logSyncError(`${logLabel} foreground pull failed`, err, { serverUrl });
    return false;
  }
};
