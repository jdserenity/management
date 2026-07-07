import { getDb } from '@/lib/db';
import { loadDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { getCurrentLogDay } from '@/lib/tdee/dates';
import { DEFAULT_TDEE_FILE } from '@/lib/tdee/defaults';
import { activeEntries, ensureCurrentDay, makeEntry, makeTombstone } from '@/lib/tdee/entries';
import { normalizeCalories, normalizeMacro } from '@/lib/tdee/ingredients';
import { upsertMeal } from '@/lib/tdee/meals';
import { normalizeFile, normalizeMealDef } from '@/lib/tdee/normalize';
import type { TdeeFile, TdeeLogEntry, TdeeMealDef, TdeeStoredEntry } from '@/lib/tdee/types';

type ConfigRow = { tdee: number; protein: number; log_day: string; updated_at: string };
type MealRow = { id: string; name: string; calories: number; protein: number; ingredients_json: string | null; sort_order: number; updated_at: string };
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

const syncNow = (): string => new Date().toISOString();

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

const upsertConfig = async (tdee: number, protein: number, logDay: string, updatedAt = syncNow()): Promise<void> => {
  const db = await getDb();
  await db.execute(
    `INSERT INTO nutrition_config (id, tdee, protein, log_day, updated_at) VALUES (1, $1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET tdee=excluded.tdee, protein=excluded.protein, log_day=excluded.log_day, updated_at=excluded.updated_at`,
    [tdee, protein, logDay, updatedAt]
  );
};

const upsertMealRow = async (
  table: 'nutrition_staples' | 'nutrition_regulars',
  meal: TdeeMealDef,
  sortOrder: number,
  updatedAt = syncNow()
): Promise<void> => {
  const db = await getDb();
  const ingredientsJson = meal.ingredients?.length ? JSON.stringify(meal.ingredients) : null;
  await db.execute(
    `INSERT INTO ${table} (id, name, calories, protein, ingredients_json, sort_order, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       calories=excluded.calories,
       protein=excluded.protein,
       ingredients_json=excluded.ingredients_json,
       sort_order=excluded.sort_order,
       updated_at=excluded.updated_at`,
    [meal.id, meal.name, meal.calories, meal.protein, ingredientsJson, sortOrder, updatedAt]
  );
};

const deleteMealRow = async (table: 'nutrition_staples' | 'nutrition_regulars', id: string): Promise<void> => {
  const db = await getDb();
  await db.execute(`DELETE FROM ${table} WHERE id=$1`, [id]);
};

const deleteMealsNotIn = async (table: 'nutrition_staples' | 'nutrition_regulars', ids: string[]): Promise<void> => {
  const db = await getDb();
  if (!ids.length) {
    await db.execute(`DELETE FROM ${table}`);
    return;
  }
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await db.execute(`DELETE FROM ${table} WHERE id NOT IN (${placeholders})`, ids);
};

const upsertNutritionEntry = async (day: string, entry: TdeeStoredEntry, updatedAt?: string): Promise<void> => {
  const db = await getDb();
  if ('deleted' in entry && entry.deleted) {
    await db.execute(
      `INSERT INTO nutrition_entries (id, log_day, kind, ref_id, label, calories, protein, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
       ON CONFLICT(id, log_day) DO UPDATE SET updated_at=excluded.updated_at, deleted=1`,
      [entry.id, day, 'custom', null, '', 0, 0, 1, updatedAt ?? entry.updatedAt]
    );
    return;
  }
  const e = entry as TdeeLogEntry;
  const ts = updatedAt ?? e.updatedAt;
  await db.execute(
    `INSERT INTO nutrition_entries (id, log_day, kind, ref_id, label, calories, protein, count, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
     ON CONFLICT(id, log_day) DO UPDATE SET
       kind=excluded.kind,
       ref_id=excluded.ref_id,
       label=excluded.label,
       calories=excluded.calories,
       protein=excluded.protein,
       count=excluded.count,
       updated_at=excluded.updated_at,
       deleted=0`,
    [e.id, day, e.kind, e.refId, e.label, e.calories, e.protein, e.count, ts]
  );
};

const ensureConfigRow = async (): Promise<void> => {
  const db = await getDb();
  const rows = await db.select<ConfigRow[]>('SELECT tdee, protein, log_day, updated_at FROM nutrition_config WHERE id = 1');
  if (rows.length) return;
  await upsertConfig(0, 0, '');
};

export const loadTdeeFile = async (): Promise<TdeeFile> => {
  await ensureConfigRow();
  const db = await getDb();
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const configRows = await db.select<ConfigRow[]>('SELECT tdee, protein, log_day, updated_at FROM nutrition_config WHERE id = 1');
  const config = configRows[0] ?? { tdee: 0, protein: 0, log_day: '', updated_at: syncNow() };
  const stapleRows = await db.select<MealRow[]>('SELECT id, name, calories, protein, ingredients_json, sort_order, updated_at FROM nutrition_staples ORDER BY sort_order, name');
  const regularRows = await db.select<MealRow[]>('SELECT id, name, calories, protein, ingredients_json, sort_order, updated_at FROM nutrition_regulars ORDER BY sort_order, name');
  let entryRows: EntryRow[] = [];
  if (config.log_day === currentDay) {
    entryRows = await db.select<EntryRow[]>(
      'SELECT id, kind, ref_id, label, calories, protein, count, updated_at, deleted FROM nutrition_entries WHERE log_day = $1 ORDER BY updated_at',
      [currentDay]
    );
  } else if (config.log_day !== currentDay) {
    await upsertConfig(config.tdee, config.protein, currentDay);
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
  const updatedAt = syncNow();
  const ids: string[] = [];
  for (let i = 0; i < meals.length; i++) {
    ids.push(meals[i].id);
    await upsertMealRow(table, meals[i], i, updatedAt);
  }
  await deleteMealsNotIn(table, ids);
};

const saveEntriesForDay = async (day: string, entries: TdeeStoredEntry[]): Promise<void> => {
  const ids: string[] = [];
  for (const entry of entries) {
    ids.push(entry.id);
    await upsertNutritionEntry(day, entry);
  }
  const db = await getDb();
  if (!ids.length) {
    await db.execute('DELETE FROM nutrition_entries WHERE log_day=$1', [day]);
    return;
  }
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  await db.execute(`DELETE FROM nutrition_entries WHERE log_day=$1 AND id NOT IN (${placeholders})`, [day, ...ids]);
};

export const saveTdeeFile = async (file: TdeeFile): Promise<void> => {
  await ensureConfigRow();
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const normalized = normalizeFile(file);
  ensureCurrentDay(normalized, currentDay);
  await upsertConfig(normalized.tdee, normalized.protein, currentDay);
  await saveMeals('nutrition_staples', normalized.staples);
  await saveMeals('nutrition_regulars', normalized.regulars);
  await saveEntriesForDay(currentDay, normalized.entries);
};

export const addTdeeEntry = async (file: TdeeFile, entry: TdeeLogEntry): Promise<TdeeFile> => {
  void file;
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  await upsertNutritionEntry(currentDay, entry);
  return loadTdeeFile();
};

export const removeTdeeEntry = async (file: TdeeFile, id: string): Promise<TdeeFile> => {
  const idx = file.entries.findIndex((e) => e.id === id);
  if (idx < 0) return file;
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  await upsertNutritionEntry(currentDay, makeTombstone(id));
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
  const idx = regulars.findIndex((m) => m.id === meal.id);
  if (idx >= 0) await upsertMealRow('nutrition_regulars', regulars[idx], idx);
  return loadTdeeFile();
};

export const removeTdeeRegular = async (file: TdeeFile, id: string): Promise<TdeeFile> => {
  if (!file.regulars.some((m) => m.id === id)) return file;
  await deleteMealRow('nutrition_regulars', id);
  return loadTdeeFile();
};

export const upsertTdeeStaple = async (file: TdeeFile, meal: TdeeMealDef, isNew: boolean): Promise<TdeeFile> => {
  const staples = upsertMeal(file.staples, meal, isNew);
  const idx = staples.findIndex((m) => m.id === meal.id);
  if (idx >= 0) await upsertMealRow('nutrition_staples', staples[idx], idx);
  return loadTdeeFile();
};

export const removeTdeeStaple = async (file: TdeeFile, id: string): Promise<TdeeFile> => {
  if (!file.staples.some((m) => m.id === id)) return file;
  await deleteMealRow('nutrition_staples', id);
  return loadTdeeFile();
};

export const updateTdeeTargets = async (file: TdeeFile, tdee: number, protein: number): Promise<TdeeFile> => {
  void file;
  const rolloverHour = await loadDayRolloverHourPref();
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  await upsertConfig(normalizeCalories(tdee), normalizeMacro(protein), currentDay);
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
