import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { DATA_SYNC_REFRESH_EVENT } from '@mgmt/sync';
import { hasAppStorage } from '@/lib/appRuntime';

/** Load/refresh a daily feature file (TDEE, water, …) with sync + interval ticks. */
export function useFeatureFileRefresh<T>(
  load: () => Promise<T>,
  failLabel: string,
  refreshKey?: number,
  intervalMs = 60_000
): {
  file: T | null;
  loadError: string | null;
  refresh: () => Promise<void>;
  setFile: Dispatch<SetStateAction<T | null>>;
  storageReady: boolean;
} {
  const [file, setFile] = useState<T | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const storageReady = hasAppStorage();

  const refresh = useCallback(async () => {
    if (!hasAppStorage()) { setLoadError(null); setFile(null); return; }
    try {
      setLoadError(null);
      setFile(await load());
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : failLabel);
    }
  }, [load, failLabel]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), intervalMs);
    const onRemote = () => { void refresh(); };
    window.addEventListener(DATA_SYNC_REFRESH_EVENT, onRemote);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(DATA_SYNC_REFRESH_EVENT, onRemote);
    };
  }, [refresh, intervalMs]);

  useEffect(() => {
    if (refreshKey != null) void refresh();
  }, [refreshKey, refresh]);

  return { file, loadError, refresh, setFile, storageReady };
}
