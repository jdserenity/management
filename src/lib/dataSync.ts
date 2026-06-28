import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import { extractUserData, pushUserData } from '@mgmt/sync';

const serverUrl = (): string | undefined => {
  const raw = import.meta.env.VITE_SERVER_URL as string | undefined;
  const v = raw?.trim();
  return v || undefined;
};

const serverToken = (): string | undefined => {
  const raw = import.meta.env.VITE_SERVER_TOKEN as string | undefined;
  const v = raw?.trim();
  return v || undefined;
};

export const pushLocalDataToServer = async (): Promise<void> => {
  const url = serverUrl();
  const token = serverToken();
  if (!url || !token) throw new Error('VITE_SERVER_URL or VITE_SERVER_TOKEN not set in this build');
  const db = await getDb();
  const data = await extractUserData(db);
  await pushUserData(url, token, data);
};

export const pushLocalDataToServerIfDesktop = async (): Promise<void> => {
  if (getAppKind() !== 'desktop') return;
  try {
    await pushLocalDataToServer();
    console.info('[data-sync] startup push ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[data-sync] startup push failed:', msg);
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      await sendNotification({ title: 'Sync failed', body: msg });
    } catch { /* notification optional */ }
  }
};
