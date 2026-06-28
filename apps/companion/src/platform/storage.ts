import { registerSqlBackend, type SqlDatabase } from '@/lib/db';
import { fetchUserData, hydrateDb, wrapWithDataSync } from '@mgmt/sync';

export const COMPANION_DATA_REFRESH = 'mgmt-companion-data-refresh';

const PULL_DEBOUNCE_MS = 800;

let companionRawDb: SqlDatabase | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let pullInFlight: Promise<boolean> | null = null;
/** Resolves after the first server pull attempt on this boot (success, failure, or skipped). */
let initialPullPromise: Promise<boolean> | null = null;

const serverCreds = () => ({
  serverUrl: import.meta.env.VITE_SERVER_URL as string | undefined,
  serverToken: import.meta.env.VITE_SERVER_TOKEN as string | undefined
});

export const pullCompanionSnapshotFromServer = async (): Promise<boolean> => {
  if (!companionRawDb) return false;
  const { serverUrl, serverToken } = serverCreds();
  if (!serverUrl || !serverToken) return false;
  if (pullInFlight) return pullInFlight;
  pullInFlight = (async () => {
    try {
      const data = await fetchUserData(serverUrl, serverToken);
      await hydrateDb(companionRawDb!, data);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMPANION_DATA_REFRESH));
      return true;
    } catch (err) {
      console.warn('[data-sync] companion pull failed:', err);
      return false;
    } finally {
      pullInFlight = null;
    }
  })();
  return pullInFlight;
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
  initialPullPromise = null;
};

export const onCompanionDataRefresh = (listener: () => void): (() => void) => {
  window.addEventListener(COMPANION_DATA_REFRESH, listener);
  return () => window.removeEventListener(COMPANION_DATA_REFRESH, listener);
};

export const initCompanionStorage = async (): Promise<SqlDatabase> => {
  const rawDb = await import('./sqlJsStorage').then((m) => m.createCompanionSqlJsDatabase());
  companionRawDb = rawDb;
  initialPullPromise = pullCompanionSnapshotFromServer();
  const db = wrapWithDataSync(
    rawDb,
    () => ({
      serverUrl: serverCreds().serverUrl,
      token: serverCreds().serverToken
    }),
    2000,
    undefined,
    async () => { if (initialPullPromise) await initialPullPromise; }
  );
  registerSqlBackend(db);
  return db;
};
