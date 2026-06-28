import { registerSqlBackend, type SqlDatabase } from '@/lib/db';
import {
  dispatchDataSyncRefresh,
  extractUserData,
  fetchUserData,
  hydrateDb,
  hydrateDbFromServer,
  logSyncError,
  logSyncInfo,
  mergeUserData,
  pushUserData,
  summarizeUserDataCounts,
  totalUserDataRows,
  wrapWithDataSync
} from '@mgmt/sync';

export const COMPANION_DATA_REFRESH = 'mgmt-companion-data-refresh';

const PULL_DEBOUNCE_MS = 800;

const notifyDataRefresh = (): void => {
  dispatchDataSyncRefresh();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMPANION_DATA_REFRESH));
};

export type CompanionSyncResult = {
  pullOk: boolean;
  pushOk: boolean;
  skipped: boolean;
  reason?: 'no-creds' | 'no-db' | 'pull-failed';
  pullError?: string;
  pushError?: string;
  counts?: Record<string, number>;
};

let companionRawDb: SqlDatabase | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let pullInFlight: Promise<boolean> | null = null;
/** Resolves after runCompanionInitialSync finishes (pull + optional push). Gates debounced pushes. */
let initialSyncPromise: Promise<CompanionSyncResult> | null = null;
let resolveSyncBootstrap: (() => void) | null = null;
let syncBootstrapGate: Promise<void>;
const resetSyncBootstrapGate = (): void => {
  syncBootstrapGate = new Promise<void>((resolve) => { resolveSyncBootstrap = resolve; });
};
resetSyncBootstrapGate();
let lastSyncWarning: string | null = null;

const serverCreds = () => ({
  serverUrl: import.meta.env.VITE_SERVER_URL as string | undefined,
  serverToken: import.meta.env.VITE_SERVER_TOKEN as string | undefined
});

export const getCompanionSyncWarning = (): string | null => lastSyncWarning;

const unreachableHint = (serverUrl: string): string =>
  `Cannot reach ${serverUrl} from this device. ` +
  'If curl /health works on the VPS but not here, this network’s DNS probably cannot resolve the hostname — try DNS 1.1.1.1 on this device.';

export const pullCompanionSnapshotFromServer = async (): Promise<boolean> => {
  if (!companionRawDb) {
    logSyncError('companion pull skipped: local database not open', new Error('no companion db'));
    return false;
  }
  const { serverUrl, serverToken } = serverCreds();
  if (!serverUrl || !serverToken) {
    logSyncError('companion pull skipped: missing build-time sync credentials', new Error('no VITE_SERVER_URL or VITE_SERVER_TOKEN'), {
      hasUrl: Boolean(serverUrl),
      hasToken: Boolean(serverToken)
    });
    return false;
  }
  if (pullInFlight) return pullInFlight;
  pullInFlight = (async () => {
    try {
      const localBefore = await extractUserData(companionRawDb!);
      const serverData = await fetchUserData(serverUrl, serverToken);
      const localRows = totalUserDataRows(localBefore);
      const serverRows = totalUserDataRows(serverData);
      if (localRows === 0 && serverRows === 0) return true;
      if (localRows === 0 && serverRows > 0) {
        await hydrateDbFromServer(companionRawDb!, serverData, localBefore);
      } else if (serverRows === 0 && localRows > 0) {
        return true;
      } else {
        const merged = mergeUserData(localBefore, serverData);
        await hydrateDb(companionRawDb!, merged);
        await pushUserData(serverUrl, serverToken, merged);
      }
      notifyDataRefresh();
      return true;
    } catch (err) {
      logSyncError('companion pull failed', err, { serverUrl });
      return false;
    } finally {
      pullInFlight = null;
    }
  })();
  return pullInFlight;
};

export const pushCompanionSnapshotToServer = async (): Promise<boolean> => {
  if (!companionRawDb) {
    logSyncError('companion push skipped: local database not open', new Error('no companion db'));
    return false;
  }
  const { serverUrl, serverToken } = serverCreds();
  if (!serverUrl || !serverToken) {
    logSyncError('companion push skipped: missing build-time sync credentials', new Error('no VITE_SERVER_URL or VITE_SERVER_TOKEN'));
    return false;
  }
  try {
    const data = await extractUserData(companionRawDb);
    await pushUserData(serverUrl, serverToken, data);
    return true;
  } catch (err) {
    logSyncError('companion push failed', err, { serverUrl });
    return false;
  }
};

/** Pull then optionally push — upload local data only when it would help, never wipe the server. */
export const runCompanionInitialSync = async (): Promise<CompanionSyncResult> => {
  if (initialSyncPromise) return initialSyncPromise;
  initialSyncPromise = (async () => {
    try {
      const { serverUrl, serverToken } = serverCreds();
      if (!serverUrl || !serverToken) {
        const msg = 'Sync is not configured in this build (missing server URL or token).';
        lastSyncWarning = msg;
        logSyncError('companion initial sync skipped', new Error('missing VITE_SERVER_URL or VITE_SERVER_TOKEN'), {
          hasUrl: Boolean(serverUrl),
          hasToken: Boolean(serverToken)
        });
        return { pullOk: false, pushOk: false, skipped: true, reason: 'no-creds', pullError: msg };
      }
      if (!companionRawDb) {
        const msg = 'Local storage is not ready yet.';
        lastSyncWarning = msg;
        return { pullOk: false, pushOk: false, skipped: true, reason: 'no-db', pullError: msg };
      }
      logSyncInfo('companion initial sync starting', { serverUrl });
      const localBefore = await extractUserData(companionRawDb);
      const localRows = totalUserDataRows(localBefore);
      let serverData;
      try {
        serverData = await fetchUserData(serverUrl, serverToken);
      } catch (err) {
        const msg = unreachableHint(serverUrl);
        lastSyncWarning = msg;
        logSyncError('companion initial sync: pull failed', err, { serverUrl, localRows });
        return { pullOk: false, pushOk: false, skipped: false, reason: 'pull-failed', pullError: msg };
      }
      const serverRows = totalUserDataRows(serverData);
      let pushOk = true;
      if (localRows === 0 && serverRows === 0) {
        logSyncInfo('companion initial sync: both sides empty');
      } else if (localRows === 0 && serverRows > 0) {
        await hydrateDbFromServer(companionRawDb, serverData, localBefore);
        notifyDataRefresh();
        logSyncInfo('companion initial sync: pulled server data', { serverRows });
      } else if (serverRows === 0 && localRows > 0) {
        logSyncInfo('companion initial sync: uploading local data (server was empty)', { localRows });
        pushOk = await pushCompanionSnapshotToServer();
      } else {
        const merged = mergeUserData(localBefore, serverData);
        await hydrateDb(companionRawDb, merged);
        try {
          await pushUserData(serverUrl, serverToken, merged);
        } catch (err) {
          pushOk = false;
          logSyncError('companion initial sync: merge push failed', err, { serverUrl });
        }
        notifyDataRefresh();
        logSyncInfo('companion initial sync: merged and uploaded', { localRows, serverRows, merged: summarizeUserDataCounts(merged) });
      }
      const counts = summarizeUserDataCounts(await extractUserData(companionRawDb));
      if (!pushOk) {
        const msg = 'Downloaded from server but upload failed. New changes on this device may not sync.';
        lastSyncWarning = msg;
        logSyncError('companion initial sync: pull ok, push failed', new Error(msg), { counts });
        return { pullOk: true, pushOk: false, skipped: false, counts, pushError: msg };
      }
      lastSyncWarning = null;
      logSyncInfo('companion initial sync complete', { counts, serverRows, localRows });
      return { pullOk: true, pushOk, skipped: false, counts };
    } finally {
      resolveSyncBootstrap?.();
    }
  })();
  return initialSyncPromise;
};

const scheduleForegroundPull = (): void => {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    pullTimer = null;
    void pullCompanionSnapshotFromServer();
  }, PULL_DEBOUNCE_MS);
};

/** Pull server snapshot when the PWA returns to the foreground (tab focus, app switch-back). */
export const startCompanionForegroundPull = (): (() => void) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleForegroundPull();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) scheduleForegroundPull();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('focus', scheduleForegroundPull);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('focus', scheduleForegroundPull);
    if (pullTimer) clearTimeout(pullTimer);
  };
};

/** @internal test hook */
export const resetCompanionStorageForTests = (): void => {
  companionRawDb = null;
  pullTimer = null;
  pullInFlight = null;
  initialSyncPromise = null;
  lastSyncWarning = null;
  resetSyncBootstrapGate();
};

export const onCompanionDataRefresh = (listener: () => void): (() => void) => {
  window.addEventListener(COMPANION_DATA_REFRESH, listener);
  return () => window.removeEventListener(COMPANION_DATA_REFRESH, listener);
};

export const initCompanionStorage = async (): Promise<SqlDatabase> => {
  const rawDb = await import('./sqlJsStorage').then((m) => m.createCompanionSqlJsDatabase());
  companionRawDb = rawDb;
  const db = wrapWithDataSync(
    rawDb,
    () => ({
      serverUrl: serverCreds().serverUrl,
      token: serverCreds().serverToken
    }),
    2000,
    (err) => { logSyncError('companion debounced push failed', err); },
    async () => { await syncBootstrapGate; }
  );
  registerSqlBackend(db);
  return db;
};
