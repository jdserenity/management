let syncFetchImpl: typeof fetch | null = null;

export const SYNC_FETCH_TIMEOUT_MS = 12_000;

export const setSyncFetchImpl = (impl: typeof fetch | null): void => { syncFetchImpl = impl; };

export const getSyncFetch = (): typeof fetch =>
  syncFetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));

/** Sync HTTP with a hard timeout so slow DNS / unreachable hosts do not block the UI for minutes. */
export const syncFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const fetchFn = getSyncFetch();
  if (init?.signal) return fetchFn(input, init);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SYNC_FETCH_TIMEOUT_MS);
  try {
    return await fetchFn(input, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[data-sync] request timed out', { url: String(input), timeoutMs: SYNC_FETCH_TIMEOUT_MS });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
