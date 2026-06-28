import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import { extractUserData, pushUserData } from '@mgmt/sync';
import { notifyDataSyncError } from '@/lib/dataSyncNotify';
import { loadSyncServerConfig } from '@/lib/syncServerConfig';

export const pushLocalDataToServer = async (): Promise<void> => {
  const { serverUrl, serverToken } = await loadSyncServerConfig();
  if (!serverUrl || !serverToken) throw new Error('Sync server not configured (sync-server.json)');
  const db = await getDb();
  const data = await extractUserData(db);
  await pushUserData(serverUrl, serverToken, data);
};

export const pushLocalDataToServerIfDesktop = async (): Promise<void> => {
  if (getAppKind() !== 'desktop') return;
  try {
    await pushLocalDataToServer();
    console.info('[data-sync] startup push ok');
  } catch (err) {
    await notifyDataSyncError('startup push', err);
  }
};
