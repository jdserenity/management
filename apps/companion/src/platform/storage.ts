import { registerSqlBackend, type SqlDatabase } from '@/lib/db';
import {
  extractUserData,
  fetchUserData,
  hydrateDb,
  logSyncError,
  logSyncInfo,
  pushUserData,
  summarizeUserDataCounts,
  wrapWithDataSync
} from '@mgmt/sync';

export const COMPANION_DATA_REFRESH = 'mgmt-companion-data-refresh';

const PULL_DEBOUNCE_MS = 800;

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
/** Resolves after runCompanionInitialSync finishes (pull + push). Gates debounced pushes. */
let initialSyncPromise: Promise<CompanionSyncResult> | null = null;
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
      const data = await fetchUserData(serverUrl, serverToken);
      await hydrateDb(companionRawDb!, data);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMPANION_DATA_REFRESH));
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

/** Pull then push — same peer sync pattern as desktop startup. */
export const runCompanionInitialSync = async (): Promise<CompanionSyncResult> => {
  if (initialSyncPromise) return initialSyncPromise;
  initialSyncPromise = (async () => {
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
    const pullOk = await pullCompanionSnapshotFromServer();
    if (!pullOk) {
      const msg = unreachableHint(serverUrl);
      lastSyncWarning = msg;
      return { pullOk: false, pushOk: false, skipped: false, reason: 'pull-failed', pullError: msg };
    }
    const counts = summarizeUserDataCounts(await extractUserData(companionRawDb));
    const pushOk = await pushCompanionSnapshotToServer();
    if (!pushOk) {
      const msg = 'Downloaded from server but upload failed. New changes on this device may not sync.';
      lastSyncWarning = msg;
      logSyncError('companion initial sync: pull ok, push failed', new Error(msg), { counts });
      return { pullOk: true, pushOk: false, skipped: false, counts, pushError: msg };
    }
    lastSyncWarning = null;
    logSyncInfo('companion initial sync complete', { counts });
    return { pullOk: true, pushOk: true, skipped: false, counts };
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
    async () => { if (initialSyncPromise) await initialSyncPromise; }
  );
  registerSqlBackend(db);
  return db;
};
