import { getAppKind } from '@/lib/appRuntime';

export interface SyncServerConfig {
  serverUrl?: string;
  serverToken?: string;
}

const SYNC_STORE = 'sync-server.json';

let cached: SyncServerConfig | null = null;
let loadPromise: Promise<SyncServerConfig> | null = null;

export const resetSyncServerConfigForTests = (): void => { cached = null; loadPromise = null; };

const trimOpt = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
};

const fromBuildEnv = (): SyncServerConfig => ({
  serverUrl: trimOpt(import.meta.env.VITE_SERVER_URL),
  serverToken: trimOpt(import.meta.env.VITE_SERVER_TOKEN)
});

export const loadSyncServerConfig = async (): Promise<SyncServerConfig> => {
  if (cached) return cached;
  if (!loadPromise) {
    loadPromise = (async () => {
      if (getAppKind() !== 'desktop') {
        cached = fromBuildEnv();
        return cached;
      }
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load(SYNC_STORE, { autoSave: false, defaults: {} });
        const fromStore: SyncServerConfig = {
          serverUrl: trimOpt(await store.get('serverUrl')),
          serverToken: trimOpt(await store.get('serverToken'))
        };
        if (fromStore.serverUrl && fromStore.serverToken) {
          cached = fromStore;
          return cached;
        }
        const env = fromBuildEnv();
        if (env.serverUrl && env.serverToken) {
          await store.set('serverUrl', env.serverUrl);
          await store.set('serverToken', env.serverToken);
          await store.save();
          cached = env;
          return cached;
        }
        cached = fromStore;
        return cached;
      } catch {
        cached = fromBuildEnv();
        return cached;
      }
    })();
  }
  return loadPromise;
};

export const getSyncServerCreds = async (): Promise<SyncServerConfig> => loadSyncServerConfig();

export const saveSyncServerConfig = async (config: SyncServerConfig): Promise<void> => {
  if (getAppKind() !== 'desktop') return;
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load(SYNC_STORE, { autoSave: false, defaults: {} });
  const serverUrl = trimOpt(config.serverUrl);
  const serverToken = trimOpt(config.serverToken);
  if (serverUrl) await store.set('serverUrl', serverUrl);
  else await store.delete('serverUrl');
  if (serverToken) await store.set('serverToken', serverToken);
  else await store.delete('serverToken');
  await store.save();
  cached = { serverUrl, serverToken };
  loadPromise = Promise.resolve(cached);
};
