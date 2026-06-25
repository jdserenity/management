#!/usr/bin/env node
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { appConfigDir } from './backup-db.mjs';

const MORNING_STRETCH_WORKOUT_ID = 'morning-stretch';
const DEFAULT_DAY_ROLLOVER_HOUR = 4;

const clampDayRolloverHour = (hour) => {
  if (!Number.isFinite(hour)) return DEFAULT_DAY_ROLLOVER_HOUR;
  const h = Math.trunc(hour);
  if (h < 0) return 0;
  if (h > 23) return 23;
  return h;
};

const getStatsDayWindow = (nowTimestamp = Date.now(), rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR) => {
  const hour = clampDayRolloverHour(rolloverHour);
  const now = new Date(nowTimestamp);
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
  const startTs = start.getTime();
  return { startTs, endTs: startTs + 24 * 60 * 60 * 1000 };
};

const configDir = appConfigDir(homedir(), process.platform);
const dbPath = join(configDir, 'local.db');
if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
const rolloverRow = db.prepare('SELECT value FROM app_kv WHERE key = ?').get('stats_day_rollover_hour_v1');
const rolloverHour = rolloverRow?.value != null ? Number.parseInt(String(rolloverRow.value), 10) : DEFAULT_DAY_ROLLOVER_HOUR;
const { startTs } = getStatsDayWindow(Date.now(), rolloverHour);
const removed = db
  .prepare('DELETE FROM workout_log WHERE workout_id = ? AND completed_at >= ?')
  .run(MORNING_STRETCH_WORKOUT_ID, startTs).changes;
db.close();
console.log(`Removed ${removed} morning stretch log row(s) for the current stats day (since ${new Date(startTs).toLocaleString()}).`);
console.log('Restart or reload the app to see the Daily morning stretch card again.');
