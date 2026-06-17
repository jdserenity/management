import type { TdeeFile, TdeeLogEntry, TdeeStoredEntry } from '@/lib/tdee/types';

export const newEntryId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const makeEntry = (opts: {
  kind: TdeeLogEntry['kind'];
  refId?: string | null;
  label: string;
  calories: number;
  protein?: number;
  count?: number;
}): TdeeLogEntry => ({
  id: newEntryId(),
  kind: opts.kind,
  refId: opts.refId ?? null,
  label: opts.label,
  calories: Math.max(0, Math.round(opts.calories)),
  protein: Math.max(0, Math.round(opts.protein ?? 0)),
  count: Math.max(1, Math.round(opts.count ?? 1)),
  updatedAt: new Date().toISOString()
});

export const makeTombstone = (id: string): TdeeStoredEntry => ({
  id,
  deleted: true,
  updatedAt: new Date().toISOString()
});

export const isActiveEntry = (entry: TdeeStoredEntry | null | undefined): entry is TdeeLogEntry =>
  !!entry && !('deleted' in entry && entry.deleted) && typeof (entry as TdeeLogEntry).calories === 'number';

export const activeEntries = (entries: TdeeStoredEntry[] | undefined): TdeeLogEntry[] => {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isActiveEntry);
};

export const isStapleLogged = (entries: TdeeStoredEntry[], stapleId: string): boolean =>
  activeEntries(entries).some((e) => e.kind === 'staple' && e.refId === stapleId);

export const ensureCurrentDay = (state: TdeeFile, currentDay: string): void => {
  if (state.day !== currentDay) {
    state.day = currentDay;
    state.entries = [];
  }
};
