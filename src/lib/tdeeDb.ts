import { getDb } from '@/lib/db';
import { loadDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { getCurrentLogDay } from '@/lib/tdee/dates';
import { DEFAULT_TDEE_FILE } from '@/lib/tdee/defaults';
import { activeEntries, ensureCurrentDay, makeEntry, makeTombstone } from '@/lib/tdee/entries';
import { normalizeCalories, normalizeMacro } from '@/lib/tdee/ingredients';
import { normalizeFile, normalizeMealDef } from '@/lib/tdee/normalize';
import type { TdeeFile, TdeeLogEntry, TdeeMealDef, TdeeStoredEntry } from '@/lib/tdee/types';

type ConfigRow = { tdee: number; protein: number; log_day: string };
type MealRow = { id: string; name: string; calories: number; protein: number; ingredients_json: string | null; sort_order: number };
type EntryRow = {
  id: string;
  kind: string;
  ref_id: string | null;
  label: string;
  calories: number;
  protein: number;
  count: number;
  updated_at: string;
  deleted: number;
};

const mealFromRow = (row: MealRow): TdeeMealDef => {
  const meal: TdeeMealDef = {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: row.protein
  };
  if (row.ingredients_json) {
    try {
      const parsed = JSON.parse(row.ingredients_json);
      if (Array.isArray(parsed) && parsed.length) meal.ingredients = parsed;
    } catch { /* ignore */ }
  }
  return normalizeMealDef(meal);
};

const entryFromRow = (row: EntryRow): TdeeStoredEntry => {
  if (row.deleted) return { id: row.id, deleted: true, updatedAt: row.updated_at };
  return {
    id: row.id,
    kind: row.kind as TdeeLogEntry['kind'],
    refId: row.ref_id,
    label: row.label,
    calories: row.calories,
    protein: row.protein,
    count: row.count,
    updatedAt: row.updated_at
  };
};

const ensureConfigRow = async (): Promise<void> => {
  const db = await getDb();
  const rows = await db.select<ConfigRow[]>('SELECT tdee, protein, log_day FROM nutrition_config WHERE id = 1');
  if (rows.length) return;
  await db.execute('INSERT INTO nutrition_config (id, tdee, protein, log_day) VALUES (1, 0, 0, \'\')');
};

export const loadTdeeFile = async (): Promise<TdeeFile> => {
  await ensureConfigRow();
  const db = await getDb();
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const configRows = await db.select<ConfigRow[]>('SELECT tdee, protein, log_day FROM nutrition_config WHERE id = 1');
  const config = configRows[0] ?? { tdee: 0, protein: 0, log_day: '' };
  const stapleRows = await db.select<MealRow[]>('SELECT id, name, calories, protein, ingredients_json, sort_order FROM nutrition_staples ORDER BY sort_order, name');
  const regularRows = await db.select<MealRow[]>('SELECT id, name, calories, protein, ingredients_json, sort_order FROM nutrition_regulars ORDER BY sort_order, name');
  let entryRows: EntryRow[] = [];
  if (config.log_day === currentDay) {
    entryRows = await db.select<EntryRow[]>(
      'SELECT id, kind, ref_id, label, calories, protein, count, updated_at, deleted FROM nutrition_entries WHERE log_day = $1 ORDER BY updated_at',
      [currentDay]
    );
  } else if (config.log_day !== currentDay) {
    await db.execute('DELETE FROM nutrition_entries');
    await db.execute('UPDATE nutrition_config SET log_day = $1 WHERE id = 1', [currentDay]);
  }
  const file: TdeeFile = {
    tdee: config.tdee,
    protein: config.protein,
    staples: stapleRows.map(mealFromRow),
    regulars: regularRows.map(mealFromRow),
    day: currentDay,
    entries: entryRows.map(entryFromRow)
  };
  ensureCurrentDay(file, currentDay);
  return file;
};

const saveMeals = async (table: 'nutrition_staples' | 'nutrition_regulars', meals: TdeeMealDef[]): Promise<void> => {
  const db = await getDb();
  await db.execute(`DELETE FROM ${table}`);
  for (let i = 0; i < meals.length; i++) {
    const m = meals[i];
    const ingredientsJson = m.ingredients?.length ? JSON.stringify(m.ingredients) : null;
    await db.execute(
      `INSERT INTO ${table} (id, name, calories, protein, ingredients_json, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
      [m.id, m.name, m.calories, m.protein, ingredientsJson, i]
    );
  }
};

const saveEntries = async (day: string, entries: TdeeStoredEntry[]): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM nutrition_entries');
  for (const entry of entries) {
    if ('deleted' in entry && entry.deleted) {
      await db.execute(
        'INSERT INTO nutrition_entries (id, log_day, kind, ref_id, label, calories, protein, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)',
        [entry.id, day, 'custom', null, '', 0, 0, 1, entry.updatedAt]
      );
      continue;
    }
    const e = entry as TdeeLogEntry;
    await db.execute(
      'INSERT INTO nutrition_entries (id, log_day, kind, ref_id, label, calories, protein, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)',
      [e.id, day, e.kind, e.refId, e.label, e.calories, e.protein, e.count, e.updatedAt]
    );
  }
};

export const saveTdeeFile = async (file: TdeeFile): Promise<void> => {
  await ensureConfigRow();
  const db = await getDb();
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const normalized = normalizeFile(file);
  ensureCurrentDay(normalized, currentDay);
  await db.execute('UPDATE nutrition_config SET tdee = $1, protein = $2, log_day = $3 WHERE id = 1', [
    normalized.tdee,
    normalized.protein,
    currentDay
  ]);
  await saveMeals('nutrition_staples', normalized.staples);
  await saveMeals('nutrition_regulars', normalized.regulars);
  await saveEntries(currentDay, normalized.entries);
};

export const importTdeeVaultJson = async (raw: unknown): Promise<TdeeFile> => {
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const file = normalizeFile(raw);
  if (file.day !== currentDay) {
    file.day = currentDay;
    file.entries = [];
  }
  await saveTdeeFile(file);
  return loadTdeeFile();
};

export const addTdeeEntry = async (file: TdeeFile, entry: TdeeLogEntry): Promise<TdeeFile> => {
  const next = { ...file, entries: [...file.entries, entry] };
  await saveTdeeFile(next);
  return loadTdeeFile();
};

export const removeTdeeEntry = async (file: TdeeFile, id: string): Promise<TdeeFile> => {
  const idx = file.entries.findIndex((e) => e.id === id);
  if (idx < 0) return file;
  const entries = [...file.entries];
  entries[idx] = makeTombstone(id);
  await saveTdeeFile({ ...file, entries });
  return loadTdeeFile();
};

export const addStapleEntry = async (file: TdeeFile, staple: TdeeMealDef): Promise<TdeeFile> => {
  const entry = makeEntry({
    kind: 'staple',
    refId: staple.id,
    label: staple.name,
    calories: staple.calories,
    protein: staple.protein
  });
  return addTdeeEntry(file, entry);
};

export const addRegularEntry = async (
  file: TdeeFile,
  regular: TdeeMealDef,
  calories: number,
  protein: number,
  count: number
): Promise<TdeeFile> => {
  const entry = makeEntry({
    kind: 'regular',
    refId: regular.id,
    label: regular.name,
    calories,
    protein,
    count
  });
  return addTdeeEntry(file, entry);
};

export const upsertTdeeRegular = async (file: TdeeFile, meal: TdeeMealDef, isNew: boolean): Promise<TdeeFile> => {
  const regulars = upsertMeal(file.regulars, meal, isNew);
  await saveTdeeFile({ ...file, regulars });
  return loadTdeeFile();
};

export const removeTdeeRegular = async (file: TdeeFile, id: string): Promise<TdeeFile> => {
  const regulars = removeMeal(file.regulars, id);
  await saveTdeeFile({ ...file, regulars });
  return loadTdeeFile();
};

export const upsertTdeeStaple = async (file: TdeeFile, meal: TdeeMealDef, isNew: boolean): Promise<TdeeFile> => {
  const staples = upsertMeal(file.staples, meal, isNew);
  await saveTdeeFile({ ...file, staples });
  return loadTdeeFile();
};

export const removeTdeeStaple = async (file: TdeeFile, id: string): Promise<TdeeFile> => {
  const staples = removeMeal(file.staples, id);
  await saveTdeeFile({ ...file, staples });
  return loadTdeeFile();
};

export const updateTdeeTargets = async (file: TdeeFile, tdee: number, protein: number): Promise<TdeeFile> => {
  await saveTdeeFile({ ...file, tdee: normalizeCalories(tdee), protein: normalizeMacro(protein) });
  return loadTdeeFile();
};

export const addCustomEntry = async (
  file: TdeeFile,
  label: string,
  calories: number,
  protein: number,
  count: number
): Promise<TdeeFile> => {
  const entry = makeEntry({
    kind: 'custom',
    label: label.trim() || 'One-Off',
    calories,
    protein,
    count
  });
  return addTdeeEntry(file, entry);
};

export const isTdeeEmpty = (file: TdeeFile): boolean =>
  file.tdee === 0 &&
  file.protein === 0 &&
  file.staples.length === 0 &&
  file.regulars.length === 0 &&
  activeEntries(file.entries).length === 0;

export { DEFAULT_TDEE_FILE };
