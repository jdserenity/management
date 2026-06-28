export type SyncServerCreds = { serverUrl?: string; serverToken?: string };

const trimOpt = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
};

/** Sync server URL and token baked in at build time from root `.env` (`VITE_SERVER_*`). */
export const getBuildTimeSyncCreds = (): SyncServerCreds => ({
  serverUrl: trimOpt(import.meta.env.VITE_SERVER_URL),
  serverToken: trimOpt(import.meta.env.VITE_SERVER_TOKEN)
});
