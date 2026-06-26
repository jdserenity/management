import { getDb } from '@/lib/db';
import { loadDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { getCurrentLogDay } from '@/lib/tdee/dates';
import { DEFAULT_WATER_FILE } from '@/lib/water/defaults';
import { activeEntries, ensureCurrentDay, makeEntry, makeTombstone, normalizeMl } from '@/lib/water/entries';
import type { WaterEntry, WaterFile, WaterStoredEntry } from '@/lib/water/types';

type ConfigRow = { target_ml: number; log_day: string };
type EntryRow = {
  id: string;
  label: string;
  ml: number;
  count: number;
  updated_at: string;
  deleted: number;
};

const entryFromRow = (row: EntryRow): WaterStoredEntry => {
  if (row.deleted) return { id: row.id, deleted: true, updatedAt: row.updated_at };
  return {
    id: row.id,
    label: row.label,
    ml: row.ml,
    count: row.count,
    updatedAt: row.updated_at
  };
};

const ensureConfigRow = async (): Promise<void> => {
  const db = await getDb();
  const rows = await db.select<ConfigRow[]>('SELECT target_ml, log_day FROM water_config WHERE id = 1');
  if (rows.length) return;
  await db.execute('INSERT INTO water_config (id, target_ml, log_day) VALUES (1, 2500, \'\')');
};

export const loadWaterFile = async (): Promise<WaterFile> => {
  await ensureConfigRow();
  const db = await getDb();
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const configRows = await db.select<ConfigRow[]>('SELECT target_ml, log_day FROM water_config WHERE id = 1');
  const config = configRows[0] ?? { target_ml: 2500, log_day: '' };
  let entryRows: EntryRow[] = [];
  if (config.log_day === currentDay) {
    entryRows = await db.select<EntryRow[]>(
      'SELECT id, label, ml, count, updated_at, deleted FROM water_entries WHERE log_day = $1 ORDER BY updated_at',
      [currentDay]
    );
  } else if (config.log_day !== currentDay) {
    await db.execute('DELETE FROM water_entries');
    await db.execute('UPDATE water_config SET log_day = $1 WHERE id = 1', [currentDay]);
  }
  const file: WaterFile = {
    targetMl: config.target_ml,
    day: currentDay,
    entries: entryRows.map(entryFromRow)
  };
  ensureCurrentDay(file, currentDay);
  return file;
};

const saveEntries = async (day: string, entries: WaterStoredEntry[]): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM water_entries');
  for (const entry of entries) {
    if ('deleted' in entry && entry.deleted) {
      await db.execute(
        'INSERT INTO water_entries (id, log_day, label, ml, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, 1)',
        [entry.id, day, '', 0, 1, entry.updatedAt]
      );
      continue;
    }
    const e = entry as WaterEntry;
    await db.execute(
      'INSERT INTO water_entries (id, log_day, label, ml, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, 0)',
      [e.id, day, e.label, e.ml, e.count, e.updatedAt]
    );
  }
};

export const saveWaterFile = async (file: WaterFile): Promise<void> => {
  await ensureConfigRow();
  const db = await getDb();
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  ensureCurrentDay(file, currentDay);
  await db.execute('UPDATE water_config SET target_ml = $1, log_day = $2 WHERE id = 1', [normalizeMl(file.targetMl), currentDay]);
  await saveEntries(currentDay, file.entries);
};

export const addWaterEntry = async (file: WaterFile, label: string, ml: number, count = 1): Promise<WaterFile> => {
  const entry = makeEntry({ label: label.trim() || 'Water', ml, count });
  const next = { ...file, entries: [...file.entries, entry] };
  await saveWaterFile(next);
  return loadWaterFile();
};

export const removeWaterEntry = async (file: WaterFile, id: string): Promise<WaterFile> => {
  const idx = file.entries.findIndex((e) => e.id === id);
  if (idx < 0) return file;
  const entries = [...file.entries];
  entries[idx] = makeTombstone(id);
  await saveWaterFile({ ...file, entries });
  return loadWaterFile();
};

export const saveWaterTarget = async (file: WaterFile, targetMl: number): Promise<WaterFile> => {
  await saveWaterFile({ ...file, targetMl: normalizeMl(targetMl) });
  return loadWaterFile();
};

export const isWaterEmpty = (file: WaterFile): boolean =>
  file.targetMl === 0 && activeEntries(file.entries).length === 0;

export { DEFAULT_WATER_FILE };
