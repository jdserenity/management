import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { DATA_SYNC_REFRESH_EVENT } from '@mgmt/sync';
import { hasAppStorage } from '@/lib/appRuntime';

export type AppDataLoadOptions = {
  /** External bump (e.g. parent refreshKey). */
  refreshKey?: number;
  /** Poll interval; set 0/null to disable. Default 60s. */
  intervalMs?: number | null;
  /** Re-load on DATA_SYNC_REFRESH_EVENT. Default true. */
  listenSync?: boolean;
};

/**
 * Load app storage data with optional poll + sync refresh.
 * Shared by Daily trackers, Customize panels, and stretch lists.
 */
export function useAppDataLoad<T>(
  load: () => Promise<T>,
  failLabel: string,
  opts: AppDataLoadOptions = {}
): {
  data: T | null;
  loadError: string | null;
  refresh: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
  storageReady: boolean;
} {
  const { refreshKey, intervalMs = 60_000, listenSync = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const storageReady = hasAppStorage();
  const loadGen = useRef(0);

  const refresh = useCallback(async () => {
    if (!hasAppStorage()) { setLoadError(null); setData(null); return; }
    const gen = ++loadGen.current;
    try {
      setLoadError(null);
      const next = await load();
      if (gen !== loadGen.current) return;
      setData(next);
    } catch (e) {
      if (gen !== loadGen.current) return;
      console.error(e);
      setLoadError(e instanceof Error ? e.message : failLabel);
    }
  }, [load, failLabel]);

  useEffect(() => {
    void refresh();
    const poll = intervalMs != null && intervalMs > 0
      ? window.setInterval(() => void refresh(), intervalMs)
      : null;
    const onRemote = () => { void refresh(); };
    if (listenSync) window.addEventListener(DATA_SYNC_REFRESH_EVENT, onRemote);
    return () => {
      if (poll != null) window.clearInterval(poll);
      if (listenSync) window.removeEventListener(DATA_SYNC_REFRESH_EVENT, onRemote);
    };
  }, [refresh, intervalMs, listenSync]);

  useEffect(() => {
    if (refreshKey != null) void refresh();
  }, [refreshKey, refresh]);

  return { data, loadError, refresh, setData, storageReady };
}

/** @deprecated alias — prefer useAppDataLoad */
export function useFeatureFileRefresh<T>(
  load: () => Promise<T>,
  failLabel: string,
  refreshKey?: number,
  intervalMs = 60_000
) {
  const r = useAppDataLoad(load, failLabel, { refreshKey, intervalMs });
  return {
    file: r.data,
    loadError: r.loadError,
    refresh: r.refresh,
    setFile: r.setData,
    storageReady: r.storageReady
  };
}
