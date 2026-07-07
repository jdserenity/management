import type { WaterEntry, WaterFile, WaterStoredEntry } from '@/lib/water/types';

export const newEntryId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeMl = (n: number): number => {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? v : 0;
};

export const makeEntry = (opts: { label: string; ml: number; count?: number }): WaterEntry => ({
  id: newEntryId(),
  label: opts.label,
  ml: normalizeMl(opts.ml),
  count: Math.max(1, Math.round(opts.count ?? 1)),
  updatedAt: new Date().toISOString()
});

export const makeTombstone = (id: string): WaterStoredEntry => ({
  id,
  deleted: true,
  updatedAt: new Date().toISOString()
});

export const isActiveEntry = (entry: WaterStoredEntry | null | undefined): entry is WaterEntry =>
  !!entry && !('deleted' in entry && entry.deleted) && typeof (entry as WaterEntry).ml === 'number';

export const activeEntries = (entries: WaterStoredEntry[] | undefined): WaterEntry[] => {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isActiveEntry);
};

export const ensureCurrentDay = (state: WaterFile, currentDay: string): void => {
  if (state.day !== currentDay) {
    state.day = currentDay;
    state.entries = [];
  }
};
