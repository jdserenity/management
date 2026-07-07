import { normalizeFile } from '@/lib/tdee/normalize';
import type { TdeeFile, TdeeStoredEntry } from '@/lib/tdee/types';

export const mergeEntries = (localEntries: TdeeStoredEntry[], diskEntries: TdeeStoredEntry[]): TdeeStoredEntry[] => {
  const map = new Map<string, TdeeStoredEntry>();
  for (const entry of [...(diskEntries || []), ...(localEntries || [])]) {
    const prev = map.get(entry.id);
    if (!prev || entry.updatedAt >= prev.updatedAt) map.set(entry.id, entry);
  }
  return [...map.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
};

export const applyConfigFromDisk = (target: TdeeFile, disk: TdeeFile): void => {
  if (typeof disk.tdee === 'number') target.tdee = disk.tdee;
  if (typeof disk.protein === 'number') target.protein = disk.protein;
  if (Array.isArray(disk.staples)) target.staples = disk.staples;
  if (Array.isArray(disk.regulars)) target.regulars = disk.regulars;
};

export const mergeForSave = (local: TdeeFile, disk: TdeeFile | null, currentDay: string): TdeeFile => {
  const merged = normalizeFile(local);
  merged.day = currentDay;
  const fromDisk = normalizeFile(disk || {});
  applyConfigFromDisk(merged, fromDisk);
  if (fromDisk.day === currentDay) merged.entries = mergeEntries(merged.entries, fromDisk.entries);
  return merged;
};

export const mergeIncoming = (memory: TdeeFile, disk: TdeeFile | null, currentDay: string): void => {
  const incoming = normalizeFile(disk || {});
  applyConfigFromDisk(memory, incoming);
  if (incoming.day === currentDay && memory.day === currentDay) {
    memory.entries = mergeEntries(memory.entries, incoming.entries);
  } else if (incoming.day === currentDay) {
    memory.day = currentDay;
    memory.entries = incoming.entries;
  }
  memory.day = currentDay;
};
