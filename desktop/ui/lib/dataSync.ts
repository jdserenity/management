import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import {
  getBuildTimeSyncCreds,
  pullAndMergeUserData,
  pushUserDataDiff,
  emptyUserData,
  extractUserData,
  runBidirectionalInitialSync,
  startUserDataPolling,
  type BidirectionalSyncResult
} from '@mgmt/sync';
import { notifyDataSyncError } from '@/lib/dataSyncNotify';
import { finishDataSyncBootstrap, resetDataSyncBootstrapForTests } from '@/lib/dataSyncBootstrap';

const PULL_DEBOUNCE_MS = 800;

let initialSyncPromise: Promise<BidirectionalSyncResult | void> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let stopDataPolling: (() => void) | null = null;

const creds = () => getBuildTimeSyncCreds();

export const pushLocalDataToServer = async (): Promise<void> => {
  const { serverUrl, serverToken } = creds();
  if (!serverUrl || !serverToken) throw new Error('Sync server not configured (set VITE_SERVER_URL and VITE_SERVER_TOKEN in .env before build)');
  const db = await getDb();
  const data = await extractUserData(db);
  await pushUserDataDiff(serverUrl, serverToken, emptyUserData(), data);
};

/** Force a merge pull from the VPS (use after phone has uploaded recovery data). */
export const pullAndMergeFromServer = async (): Promise<boolean> => {
  if (getAppKind() !== 'desktop') return false;
  const { serverUrl, serverToken } = creds();
  const db = await getDb();
  const ok = await pullAndMergeUserData({ logLabel: 'desktop', db, serverUrl, serverToken });
  if (!ok && serverUrl && serverToken) await notifyDataSyncError('foreground pull', new Error('pull failed'));
  return ok;
};

const scheduleForegroundPull = (): void => {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    pullTimer = null;
    void pullAndMergeFromServer().catch(() => {});
  }, PULL_DEBOUNCE_MS);
};

export const startDesktopForegroundPull = (): (() => void) => {
  if (getAppKind() !== 'desktop' || typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleForegroundPull();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', scheduleForegroundPull);
  stopDataPolling?.();
  stopDataPolling = startUserDataPolling({ pull: () => { void pullAndMergeFromServer(); } });
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', scheduleForegroundPull);
    if (pullTimer) clearTimeout(pullTimer);
    stopDataPolling?.();
    stopDataPolling = null;
  };
};

export const runDesktopInitialSync = async (): Promise<BidirectionalSyncResult | void> => {
  if (initialSyncPromise) return initialSyncPromise;
  initialSyncPromise = (async () => {
    if (getAppKind() !== 'desktop') return;
    try {
      const { serverUrl, serverToken } = creds();
      if (!serverUrl || !serverToken) {
        console.warn('[data-sync] skipped: set VITE_SERVER_URL and VITE_SERVER_TOKEN in .env before build');
        return;
      }
      const db = await getDb();
      const result = await runBidirectionalInitialSync({ logLabel: 'desktop', db, serverUrl, serverToken });
      if (!result.pullOk && !result.skipped && result.reason === 'pull-failed') {
        await notifyDataSyncError('startup pull', new Error(result.pullError ?? 'pull failed'));
      }
      return result;
    } catch (err) {
      await notifyDataSyncError('startup sync', err);
    } finally {
      finishDataSyncBootstrap();
    }
  })();
  return initialSyncPromise;
};

/** @internal test hook */
export const resetDesktopDataSyncForTests = (): void => {
  initialSyncPromise = null;
  pullTimer = null;
  stopDataPolling?.();
  stopDataPolling = null;
  resetDataSyncBootstrapForTests();
};
