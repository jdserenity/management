import { dbExecute, dbSelect, dbDeleteDayExceptIds, syncNow } from '@/lib/sqlWrite';
import { loadCurrentFeatureDay } from '@/lib/featureDay';
import { activeEntries, ensureCurrentDay, makeEntry, makeTombstone, normalizeMl } from '@/lib/water/entries';
import { DEFAULT_WATER_FILE, type WaterEntry, type WaterFile, type WaterStoredEntry } from '@/lib/water/types';

type ConfigRow = { target_ml: number; log_day: string; updated_at: string };
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

const upsertWaterConfig = async (targetMl: number, logDay: string, updatedAt = syncNow()): Promise<void> => {
  await dbExecute(
    `INSERT INTO water_config (id, target_ml, log_day, updated_at) VALUES (1, $1, $2, $3)
     ON CONFLICT(id) DO UPDATE SET target_ml=excluded.target_ml, log_day=excluded.log_day, updated_at=excluded.updated_at`,
    [targetMl, logDay, updatedAt]
  );
};

const upsertWaterEntry = async (day: string, entry: WaterStoredEntry, updatedAt?: string): Promise<void> => {
  if ('deleted' in entry && entry.deleted) {
    await dbExecute(
      `INSERT INTO water_entries (id, log_day, label, ml, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, 1)
       ON CONFLICT(id, log_day) DO UPDATE SET updated_at=excluded.updated_at, deleted=1`,
      [entry.id, day, '', 0, 1, updatedAt ?? entry.updatedAt]
    );
    return;
  }
  const e = entry as WaterEntry;
  const ts = updatedAt ?? e.updatedAt;
  await dbExecute(
    `INSERT INTO water_entries (id, log_day, label, ml, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, 0)
     ON CONFLICT(id, log_day) DO UPDATE SET
       label=excluded.label,
       ml=excluded.ml,
       count=excluded.count,
       updated_at=excluded.updated_at,
       deleted=0`,
    [e.id, day, e.label, e.ml, e.count, ts]
  );
};

const ensureConfigRow = async (): Promise<void> => {
  const rows = await dbSelect<ConfigRow[]>('SELECT target_ml, log_day, updated_at FROM water_config WHERE id = 1');
  if (rows.length) return;
  await upsertWaterConfig(2500, '');
};

export const loadWaterFile = async (): Promise<WaterFile> => {
  await ensureConfigRow();
  const { day: currentDay } = await loadCurrentFeatureDay();
  const configRows = await dbSelect<ConfigRow[]>('SELECT target_ml, log_day, updated_at FROM water_config WHERE id = 1');
  const config = configRows[0] ?? { target_ml: 2500, log_day: '', updated_at: syncNow() };
  let entryRows: EntryRow[] = [];
  if (config.log_day === currentDay) {
    entryRows = await dbSelect<EntryRow[]>(
      'SELECT id, label, ml, count, updated_at, deleted FROM water_entries WHERE log_day = $1 ORDER BY updated_at',
      [currentDay]
    );
  } else if (config.log_day !== currentDay) {
    await upsertWaterConfig(config.target_ml, currentDay);
  }
  const file: WaterFile = {
    targetMl: config.target_ml,
    day: currentDay,
    entries: entryRows.map(entryFromRow)
  };
  ensureCurrentDay(file, currentDay);
  return file;
};

const saveEntriesForDay = async (day: string, entries: WaterStoredEntry[]): Promise<void> => {
  const ids: string[] = [];
  for (const entry of entries) {
    ids.push(entry.id);
    await upsertWaterEntry(day, entry);
  }
  await dbDeleteDayExceptIds('water_entries', day, ids);
};

export const saveWaterFile = async (file: WaterFile): Promise<void> => {
  await ensureConfigRow();
  const { day: currentDay } = await loadCurrentFeatureDay();
  ensureCurrentDay(file, currentDay);
  await upsertWaterConfig(normalizeMl(file.targetMl), currentDay);
  await saveEntriesForDay(currentDay, file.entries);
};

export const addWaterEntry = async (file: WaterFile, label: string, ml: number, count = 1): Promise<WaterFile> => {
  void file;
  const entry = makeEntry({ label: label.trim() || 'Water', ml, count });
  const { day: currentDay } = await loadCurrentFeatureDay();
  await upsertWaterEntry(currentDay, entry);
  return loadWaterFile();
};

export const removeWaterEntry = async (file: WaterFile, id: string): Promise<WaterFile> => {
  const idx = file.entries.findIndex((e) => e.id === id);
  if (idx < 0) return file;
  const { day: currentDay } = await loadCurrentFeatureDay();
  await upsertWaterEntry(currentDay, makeTombstone(id));
  return loadWaterFile();
};

export const saveWaterTarget = async (file: WaterFile, targetMl: number): Promise<WaterFile> => {
  void file;
  const { day: currentDay } = await loadCurrentFeatureDay();
  await upsertWaterConfig(normalizeMl(targetMl), currentDay);
  return loadWaterFile();
};

export const isWaterEmpty = (file: WaterFile): boolean =>
  file.targetMl === 0 && activeEntries(file.entries).length === 0;

export { DEFAULT_WATER_FILE };
