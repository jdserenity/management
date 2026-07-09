import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { LATEST_SCHEMA_VERSION, SCHEMA_MIGRATIONS } from './migrations';
import { runSchemaMigrations } from './runMigrations';
import type { SqlDatabase } from './types';

const wrapSqlite = (db: Database.Database): SqlDatabase => ({
  select: async <T>(query: string, bind?: unknown[]) => {
    const sql = query.replace(/\$(\d+)/g, '?');
    return (bind?.length ? db.prepare(sql).all(...bind) : db.prepare(sql).all()) as T;
  },
  execute: async (query: string, bind?: unknown[]) => {
    const sql = query.replace(/\$(\d+)/g, '?');
    const info = bind?.length ? db.prepare(sql).run(...bind) : db.prepare(sql).run();
    return { lastInsertId: Number(info.lastInsertRowid), rowsAffected: info.changes };
  }
});

const tableColumns = (db: Database.Database, table: string): string[] =>
  db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String((row as { name: string }).name));

describe('SCHEMA_MIGRATIONS', () => {
  it('has contiguous versions through the latest schema', () => {
    const versions = SCHEMA_MIGRATIONS.map((m) => m.version);
    expect(LATEST_SCHEMA_VERSION).toBe(12);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('includes water tracker and streak cross-log migrations', () => {
    expect(SCHEMA_MIGRATIONS.find((m) => m.version === 8)?.description).toBe('water_tracker_tables');
    expect(SCHEMA_MIGRATIONS.find((m) => m.version === 9)?.description).toBe('streak_activity_cross_log_columns');
  });

  it('adds updated_at to syncable tables in migration v10', async () => {
    const db = new Database(':memory:');
    await runSchemaMigrations(wrapSqlite(db));
    for (const table of ['streak_activities', 'streak_activity_meta', 'nutrition_staples', 'nutrition_regulars', 'nutrition_config', 'water_config']) {
      expect(tableColumns(db, table)).toContain('updated_at');
    }
    db.close();
  });

  it('adds necessary and link columns in migration v12', async () => {
    const db = new Database(':memory:');
    await runSchemaMigrations(wrapSqlite(db));
    const cols = tableColumns(db, 'streak_activities');
    expect(cols).toContain('necessary');
    expect(cols).toContain('linked_staple_id');
    expect(cols).toContain('linked_water');
    db.close();
  });
});
