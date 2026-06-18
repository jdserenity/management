import { readFileSync } from 'node:fs';
import { clampDayRolloverHour, DEFAULT_DAY_ROLLOVER_HOUR } from '@/lib/dayBoundary';
import { getCurrentLogDay } from '@/lib/tdee/dates';
import { ensureCurrentDay } from '@/lib/tdee/entries';
import { normalizeFile } from '@/lib/tdee/normalize';
import type { TdeeFile, TdeeLogEntry, TdeeMealDef } from '@/lib/tdee/types';
import { backfillArchivedAt } from '@/lib/streak/archiveBackfill';
import { normalizeConfig, normalizeDataPayload } from '@/lib/streak/normalize';
import type { StreakActivity, StreakConfig, StreakData } from '@/lib/streak/types';

export const KV_IMPORT_TDEE = 'vault_import_tdee_v1';
export const KV_IMPORT_STREAK = 'vault_import_streak_v1';

export type ImportDb = {
  prepare: (sql: string) => {
    run: (...params: any[]) => unknown;
    get: (...params: any[]) => unknown;
  };
  exec: (sql: string) => void;
};

export const readVaultJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

export const rolloverHourFromDb = (db: ImportDb): number => {
  const row = db.prepare('SELECT value FROM app_kv WHERE key = ?').get('stats_day_rollover_hour_v1') as { value: string } | undefined;
  if (!row?.value) return DEFAULT_DAY_ROLLOVER_HOUR;
  return clampDayRolloverHour(Number.parseInt(row.value, 10));
};

const setKv = (db: ImportDb, key: string, value: string): void => {
  db.prepare(
    'INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, Date.now());
};

const saveTdee = (db: ImportDb, file: TdeeFile, currentDay: string): void => {
  const row = db.prepare('SELECT id FROM nutrition_config WHERE id = 1').get();
  if (!row) db.prepare('INSERT INTO nutrition_config (id, tdee, protein, log_day) VALUES (1, 0, 0, \'\')').run();
  db.prepare('UPDATE nutrition_config SET tdee = ?, protein = ?, log_day = ? WHERE id = 1').run(file.tdee, file.protein, currentDay);
  db.exec('DELETE FROM nutrition_staples');
  db.exec('DELETE FROM nutrition_regulars');
  db.exec('DELETE FROM nutrition_entries');
  const writeMeal = (table: 'nutrition_staples' | 'nutrition_regulars', meals: TdeeMealDef[]) => {
    const stmt = db.prepare(`INSERT INTO ${table} (id, name, calories, protein, ingredients_json, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
    meals.forEach((m, i) => {
      stmt.run(m.id, m.name, m.calories, m.protein, m.ingredients?.length ? JSON.stringify(m.ingredients) : null, i);
    });
  };
  writeMeal('nutrition_staples', file.staples);
  writeMeal('nutrition_regulars', file.regulars);
  const entryStmt = db.prepare(
    'INSERT INTO nutrition_entries (id, log_day, kind, ref_id, label, calories, protein, count, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const entry of file.entries) {
    if ('deleted' in entry && entry.deleted) {
      entryStmt.run(entry.id, currentDay, 'custom', null, '', 0, 0, 1, entry.updatedAt, 1);
      continue;
    }
    const e = entry as TdeeLogEntry;
    entryStmt.run(e.id, currentDay, e.kind, e.refId, e.label, e.calories, e.protein, e.count, e.updatedAt, 0);
  }
};

const saveStreak = (db: ImportDb, config: StreakConfig, data: Omit<StreakData, 'stats'>): void => {
  db.exec('DELETE FROM streak_activities');
  db.exec('DELETE FROM streak_log_cells');
  db.exec('DELETE FROM streak_activity_meta');
  const actStmt = db.prepare(
    'INSERT INTO streak_activities (id, name, description, frequency, weekly_target, scheduled_days_json, can_fail, archived_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let order = 0;
  const writeAct = (a: StreakActivity, archived: boolean) => {
    actStmt.run(
      a.id,
      a.name || a.id,
      a.description || null,
      a.frequency === 'weekly' ? 'weekly' : 'daily',
      a.weeklyTarget ?? null,
      a.scheduledDays?.length ? JSON.stringify(a.scheduledDays) : null,
      a.canFail ? 1 : 0,
      archived ? (a.archivedAt ?? null) : null,
      order++
    );
  };
  config.activities.forEach((a) => writeAct(a, false));
  config.archivedActivities.forEach((a) => writeAct(a, true));
  const logStmt = db.prepare('INSERT INTO streak_log_cells (log_date, activity_id, state, updated_at) VALUES (?, ?, ?, ?)');
  for (const date of Object.keys(data.logs)) {
    for (const [activityId, cell] of Object.entries(data.logs[date])) {
      if (!cell) continue;
      logStmt.run(date, activityId, cell.state, cell.updatedAt);
    }
  }
  const metaIds = new Set<string>([
    ...Object.keys(data.activityStartDates),
    ...Object.keys(data.pausedActivities),
    ...Object.keys(data.unpausedActivities),
    ...Object.keys(data.activityResetCounts)
  ]);
  const metaStmt = db.prepare(
    'INSERT INTO streak_activity_meta (activity_id, start_date, pause_since, unpaused_at, reset_count) VALUES (?, ?, ?, ?, ?)'
  );
  for (const activityId of metaIds) {
    metaStmt.run(
      activityId,
      data.activityStartDates[activityId] ?? null,
      data.pausedActivities[activityId] ?? null,
      data.unpausedActivities[activityId] ?? null,
      data.activityResetCounts[activityId] ?? 0
    );
  }
};

export const importTdeeVaultIntoDb = (db: ImportDb, raw: unknown, rolloverHour = rolloverHourFromDb(db)): void => {
  const currentDay = getCurrentLogDay(new Date(), rolloverHour);
  const file = normalizeFile(raw);
  if (file.day !== currentDay) {
    file.day = currentDay;
    file.entries = [];
  }
  ensureCurrentDay(file, currentDay);
  saveTdee(db, file, currentDay);
  setKv(db, KV_IMPORT_TDEE, new Date().toISOString());
};

export const importStreakVaultIntoDb = (db: ImportDb, configRaw: unknown, dataRaw: unknown): void => {
  const config = normalizeConfig(configRaw);
  const data = normalizeDataPayload(dataRaw);
  backfillArchivedAt(config, { ...data, stats: {} });
  saveStreak(db, config, data);
  setKv(db, KV_IMPORT_STREAK, new Date().toISOString());
};

export const isVaultImportDone = (db: ImportDb): { tdee: boolean; streak: boolean } => {
  const tdee = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(KV_IMPORT_TDEE);
  const streak = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(KV_IMPORT_STREAK);
  return { tdee: !!tdee, streak: !!streak };
};
