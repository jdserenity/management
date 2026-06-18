import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import tdeeFixture from '../../test/fixtures/refactor1/tdee-config.json';
import streakConfigFixture from '../../test/fixtures/refactor1/streak-config.json';
import streakDataFixture from '../../test/fixtures/refactor1/streak-data.json';
import {
  importStreakVaultIntoDb,
  importTdeeVaultIntoDb,
  isVaultImportDone,
  KV_IMPORT_STREAK,
  KV_IMPORT_TDEE
} from '@/lib/vaultImportSqlite';

const SCHEMA_SQL = `
CREATE TABLE app_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE nutrition_config (id INTEGER PRIMARY KEY CHECK (id = 1), tdee INTEGER NOT NULL DEFAULT 0, protein INTEGER NOT NULL DEFAULT 0, log_day TEXT NOT NULL DEFAULT '');
CREATE TABLE nutrition_staples (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE nutrition_regulars (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE nutrition_entries (id TEXT NOT NULL, log_day TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, label TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day));
CREATE TABLE streak_activities (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', description TEXT, frequency TEXT NOT NULL DEFAULT 'daily', weekly_target INTEGER, scheduled_days_json TEXT, can_fail INTEGER NOT NULL DEFAULT 0, archived_at TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE streak_log_cells (log_date TEXT NOT NULL, activity_id TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (log_date, activity_id));
CREATE TABLE streak_activity_meta (activity_id TEXT PRIMARY KEY, start_date TEXT, pause_since TEXT, unpaused_at TEXT, reset_count INTEGER NOT NULL DEFAULT 0);
INSERT INTO nutrition_config (id, tdee, protein, log_day) VALUES (1, 0, 0, '');
`;

const memDb = () => {
  const db = new Database(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
};

describe('vaultImportSqlite', () => {
  it('imports TDEE config and staples into sqlite tables', () => {
    const db = memDb();
    importTdeeVaultIntoDb(db, tdeeFixture);
    const config = db.prepare('SELECT tdee, protein FROM nutrition_config WHERE id = 1').get() as { tdee: number; protein: number };
    expect(config.tdee).toBeGreaterThan(0);
    const staples = db.prepare('SELECT COUNT(*) AS n FROM nutrition_staples').get() as { n: number };
    expect(staples.n).toBeGreaterThan(0);
    expect(isVaultImportDone(db).tdee).toBe(true);
    const kv = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(KV_IMPORT_TDEE) as { value: string };
    expect(kv.value).toBeTruthy();
  });

  it('imports streak config, logs, and meta', () => {
    const db = memDb();
    importStreakVaultIntoDb(db, streakConfigFixture, streakDataFixture);
    const acts = db.prepare('SELECT COUNT(*) AS n FROM streak_activities').get() as { n: number };
    expect(acts.n).toBeGreaterThan(0);
    const logs = db.prepare('SELECT COUNT(*) AS n FROM streak_log_cells').get() as { n: number };
    expect(logs.n).toBeGreaterThan(0);
    expect(isVaultImportDone(db).streak).toBe(true);
    const kv = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(KV_IMPORT_STREAK) as { value: string };
    expect(kv.value).toBeTruthy();
  });
});
