let syncFetchImpl: typeof fetch | null = null;

export const setSyncFetchImpl = (impl: typeof fetch | null): void => { syncFetchImpl = impl; };

export const getSyncFetch = (): typeof fetch =>
  syncFetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
