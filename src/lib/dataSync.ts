import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import {
  dispatchDataSyncRefresh,
  extractUserData,
  fetchUserData,
  hydrateDb,
  hydrateDbFromServer,
  logSyncInfo,
  mergeUserData,
  pushUserData,
  summarizeUserDataCounts,
  totalUserDataRows
} from '@mgmt/sync';
import { notifyDataSyncError } from '@/lib/dataSyncNotify';
import { loadSyncServerConfig } from '@/lib/syncServerConfig';

import { finishDataSyncBootstrap, resetDataSyncBootstrapForTests } from '@/lib/dataSyncBootstrap';

const PULL_DEBOUNCE_MS = 800;

let initialSyncPromise: Promise<void> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;

export const pushLocalDataToServer = async (): Promise<void> => {
  const { serverUrl, serverToken } = await loadSyncServerConfig();
  if (!serverUrl || !serverToken) throw new Error('Sync server not configured (sync-server.json or VITE_SERVER_*)');
  const db = await getDb();
  const data = await extractUserData(db);
  await pushUserData(serverUrl, serverToken, data);
};

const pullAndMergeFromServer = async (): Promise<void> => {
  const { serverUrl, serverToken } = await loadSyncServerConfig();
  if (!serverUrl || !serverToken) return;
  const db = await getDb();
  const localBefore = await extractUserData(db);
  let serverData;
  try {
    serverData = await fetchUserData(serverUrl, serverToken);
  } catch (err) {
    await notifyDataSyncError('foreground pull', err);
    return;
  }
  const localRows = totalUserDataRows(localBefore);
  const serverRows = totalUserDataRows(serverData);
  if (localRows === 0 && serverRows === 0) return;
  if (localRows === 0 && serverRows > 0) {
    await hydrateDbFromServer(db, serverData, localBefore);
  } else if (serverRows === 0 && localRows > 0) {
    return;
  } else {
    const merged = mergeUserData(localBefore, serverData);
    await hydrateDb(db, merged);
    await pushUserData(serverUrl, serverToken, merged);
  }
  dispatchDataSyncRefresh();
  logSyncInfo('desktop foreground pull complete', summarizeUserDataCounts(await extractUserData(db)));
};

const scheduleForegroundPull = (): void => {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    pullTimer = null;
    void pullAndMergeFromServer();
  }, PULL_DEBOUNCE_MS);
};

export const startDesktopForegroundPull = (): (() => void) => {
  if (getAppKind() !== 'desktop' || typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleForegroundPull();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', scheduleForegroundPull);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', scheduleForegroundPull);
    if (pullTimer) clearTimeout(pullTimer);
  };
};

export const runDesktopInitialSync = async (): Promise<void> => {
  if (initialSyncPromise) return initialSyncPromise;
  initialSyncPromise = (async () => {
    if (getAppKind() !== 'desktop') return;
    try {
      const { serverUrl, serverToken } = await loadSyncServerConfig();
      if (!serverUrl || !serverToken) {
        console.warn('[data-sync] skipped: no server URL/token in sync-server.json or build env');
        return;
      }
      const db = await getDb();
      const localBefore = await extractUserData(db);
      const localRows = totalUserDataRows(localBefore);
      logSyncInfo('desktop initial sync starting', { serverUrl, localRows });
      let serverData;
      try {
        serverData = await fetchUserData(serverUrl, serverToken);
      } catch (err) {
        await notifyDataSyncError('startup pull', err);
        return;
      }
      const serverRows = totalUserDataRows(serverData);
      if (localRows === 0 && serverRows === 0) {
        logSyncInfo('desktop initial sync: both sides empty');
        return;
      }
      if (localRows === 0 && serverRows > 0) {
        await hydrateDbFromServer(db, serverData, localBefore);
        dispatchDataSyncRefresh();
        logSyncInfo('desktop initial sync: pulled server data', { serverRows });
        return;
      }
      if (serverRows === 0 && localRows > 0) {
        await pushUserData(serverUrl, serverToken, localBefore);
        logSyncInfo('desktop initial sync: uploaded local data (server was empty)', { localRows });
        return;
      }
      const merged = mergeUserData(localBefore, serverData);
      await hydrateDb(db, merged);
      await pushUserData(serverUrl, serverToken, merged);
      dispatchDataSyncRefresh();
      logSyncInfo('desktop initial sync: merged and uploaded', {
        localRows,
        serverRows,
        merged: summarizeUserDataCounts(merged)
      });
    } catch (err) {
      await notifyDataSyncError('startup sync', err);
    } finally {
      finishDataSyncBootstrap();
    }
  })();
  return initialSyncPromise;
};

/** @deprecated use runDesktopInitialSync */
export const pushLocalDataToServerIfDesktop = runDesktopInitialSync;

/** @internal test hook */
export const resetDesktopDataSyncForTests = (): void => {
  initialSyncPromise = null;
  pullTimer = null;
  resetDataSyncBootstrapForTests();
};
