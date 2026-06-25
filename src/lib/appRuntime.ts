export type AppKind = 'desktop' | 'companion' | 'browser';

declare global {
  interface Window {
    __MGMT_APP_KIND__?: AppKind;
  }
}

const runtime = (): (Window & typeof globalThis) | undefined =>
  typeof globalThis !== 'undefined' ? (globalThis as Window & typeof globalThis) : undefined;

export const markCompanionApp = (): void => {
  const g = runtime();
  if (g) g.__MGMT_APP_KIND__ = 'companion';
};

export const getAppKind = (): AppKind => {
  const g = runtime();
  if (!g) return 'browser';
  if (g.__MGMT_APP_KIND__ === 'companion') return 'companion';
  if ('__TAURI_INTERNALS__' in g) return 'desktop';
  return 'browser';
};

export const hasAppStorage = (): boolean => getAppKind() === 'desktop' || getAppKind() === 'companion';
