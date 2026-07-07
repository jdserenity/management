import { getAppKind } from '@/lib/appRuntime';

export const notifyDataSyncError = async (context: string, err: unknown): Promise<void> => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[data-sync] ${context} failed:`, msg);
  if (getAppKind() !== 'desktop') return;
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    await sendNotification({ title: 'Sync failed', body: `${context}: ${msg}` });
  } catch { /* notification optional */ }
};
