import { registerSqlBackend, type SqlDatabase } from '@/lib/db';
import {
  extractUserData,
  getBuildTimeSyncCreds,
  logSyncError,
  pullAndMergeUserData,
  pushUserData,
  runBidirectionalInitialSync,
  startUserDataPolling,
  type BidirectionalSyncResult,
  wrapWithDataSync
} from '@mgmt/sync';

export const COMPANION_DATA_REFRESH = 'mgmt-companion-data-refresh';

const PULL_DEBOUNCE_MS = 800;

export type CompanionSyncResult = BidirectionalSyncResult;

let companionRawDb: SqlDatabase | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let stopDataPolling: (() => void) | null = null;
let pullInFlight: Promise<boolean> | null = null;
let initialSyncPromise: Promise<CompanionSyncResult> | null = null;
let resolveSyncBootstrap: (() => void) | null = null;
let syncBootstrapGate: Promise<void>;
const resetSyncBootstrapGate = (): void => {
  syncBootstrapGate = new Promise<void>((resolve) => { resolveSyncBootstrap = resolve; });
};
resetSyncBootstrapGate();

const serverCreds = () => getBuildTimeSyncCreds();

export { getSyncWarning as getCompanionSyncWarning } from '@mgmt/sync';

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
  pullInFlight = pullAndMergeUserData({ logLabel: 'companion', db: companionRawDb, serverUrl, serverToken })
    .finally(() => { pullInFlight = null; });
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

export const runCompanionInitialSync = async (): Promise<CompanionSyncResult> => {
  if (initialSyncPromise) return initialSyncPromise;
  initialSyncPromise = (async () => {
    try {
      const { serverUrl, serverToken } = serverCreds();
      if (!companionRawDb) {
        return { pullOk: false, pushOk: false, skipped: true, reason: 'no-db', pullError: 'Local storage is not ready yet.' };
      }
      return await runBidirectionalInitialSync({ logLabel: 'companion', db: companionRawDb, serverUrl, serverToken });
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
  stopDataPolling?.();
  stopDataPolling = startUserDataPolling({
    pull: () => pullCompanionSnapshotFromServer(),
    shouldPoll: () => companionRawDb !== null
  });
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('focus', scheduleForegroundPull);
    if (pullTimer) clearTimeout(pullTimer);
    stopDataPolling?.();
    stopDataPolling = null;
  };
};

/** @internal test hook */
export const resetCompanionStorageForTests = (): void => {
  companionRawDb = null;
  pullTimer = null;
  stopDataPolling?.();
  stopDataPolling = null;
  pullInFlight = null;
  initialSyncPromise = null;
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
    () => {
      const { serverUrl, serverToken } = serverCreds();
      return { serverUrl, token: serverToken };
    },
    2000,
    (err) => { logSyncError('companion debounced push failed', err); },
    async () => { await syncBootstrapGate; }
  );
  registerSqlBackend(db);
  return db;
};
