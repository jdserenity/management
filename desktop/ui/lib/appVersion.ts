import type { AppKind } from '@/lib/appRuntime';

/** Baked in at build time from root package.json (see vite.config.ts). */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

export const appSurfaceLabel = (kind: AppKind): string => {
  if (kind === 'companion') return 'Phone companion';
  if (kind === 'desktop') return 'Desktop app';
  return 'Browser';
};
