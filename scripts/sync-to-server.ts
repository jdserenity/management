/**
 * Copies all user data from local.db (the desktop SQLite) into server.db.
 * Run with: npm run sync:to-server
 *
 * Safe to run multiple times — all writes are upserts.
 * Does NOT require the server to be running.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { openServerDb, seedOwnerUser } from '../apps/server/src/db.ts';
import { SqliteDataStore } from '../apps/server/src/dataStore.ts';

const BUNDLE_ID = 'com.diamari.management';
const OWNER_USER_ID = process.env.OWNER_USER_ID ?? 'owner';

const localDbPath = (): string => {
  const home = os.homedir();
  const configDir = process.platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support', BUNDLE_ID)
    : path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, '.config'), BUNDLE_ID);
  return path.join(configDir, 'local.db');
};

const serverDbPath = (): string =>
  process.env.DB_PATH ?? path.join(process.cwd(), 'apps', 'server', 'data', 'server.db');

const src = localDbPath();
const dst = serverDbPath();

if (!fs.existsSync(src)) {
  console.error(`local.db not found at: ${src}`);
  process.exit(1);
}

console.log(`Reading from: ${src}`);
console.log(`Writing to:  ${dst}`);
console.log(`Owner user:  ${OWNER_USER_ID}`);

const local = new Database(src, { readonly: true });
const server = openServerDb(dst);
seedOwnerUser(server, OWNER_USER_ID);
const store = new SqliteDataStore(server);

// Read every table from local.db.
const data = {
  focusLog: local.prepare('SELECT id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio FROM focus_log').all() as Parameters<typeof store.putData>[1]['focusLog'],
  workoutLog: local.prepare('SELECT id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio FROM workout_log').all() as Parameters<typeof store.putData>[1]['workoutLog'],
  appKv: local.prepare('SELECT key,value,updated_at FROM app_kv').all() as Parameters<typeof store.putData>[1]['appKv'],
  nutritionConfig: (local.prepare('SELECT tdee,protein,log_day FROM nutrition_config WHERE id=1').get() ?? null) as Parameters<typeof store.putData>[1]['nutritionConfig'],
  nutritionStaples: local.prepare('SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_staples').all() as Parameters<typeof store.putData>[1]['nutritionStaples'],
  nutritionRegulars: local.prepare('SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_regulars').all() as Parameters<typeof store.putData>[1]['nutritionRegulars'],
  nutritionEntries: local.prepare('SELECT id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted FROM nutrition_entries').all() as Parameters<typeof store.putData>[1]['nutritionEntries'],
  streakActivities: local.prepare('SELECT id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order,extra_calories,extra_protein,extra_water_ml FROM streak_activities').all() as Parameters<typeof store.putData>[1]['streakActivities'],
  streakLogCells: local.prepare('SELECT log_date,activity_id,state,updated_at FROM streak_log_cells').all() as Parameters<typeof store.putData>[1]['streakLogCells'],
  streakActivityMeta: local.prepare('SELECT activity_id,start_date,pause_since,unpaused_at,reset_count FROM streak_activity_meta').all() as Parameters<typeof store.putData>[1]['streakActivityMeta'],
  waterConfig: (local.prepare('SELECT target_ml,log_day FROM water_config WHERE id=1').get() ?? null) as Parameters<typeof store.putData>[1]['waterConfig'],
  waterEntries: local.prepare('SELECT id,log_day,label,ml,count,updated_at,deleted FROM water_entries').all() as Parameters<typeof store.putData>[1]['waterEntries'],
};

store.putData(OWNER_USER_ID, data);
local.close();
server.close();

console.log('Done.');
console.log(`  focus_log:            ${data.focusLog.length} rows`);
console.log(`  workout_log:          ${data.workoutLog.length} rows`);
console.log(`  app_kv:               ${data.appKv.length} rows`);
console.log(`  nutrition_staples:    ${data.nutritionStaples.length} rows`);
console.log(`  nutrition_regulars:   ${data.nutritionRegulars.length} rows`);
console.log(`  nutrition_entries:    ${data.nutritionEntries.length} rows`);
console.log(`  streak_activities:    ${data.streakActivities.length} rows`);
console.log(`  streak_log_cells:     ${data.streakLogCells.length} rows`);
console.log(`  streak_activity_meta: ${data.streakActivityMeta.length} rows`);
console.log(`  water_entries:        ${data.waterEntries.length} rows`);
