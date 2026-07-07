import { describe, expect, it } from 'vitest';
import { SCHEMA_MIGRATIONS } from '@mgmt/storage';
import {
  DESKTOP_ONLY_APP_KV_KEYS,
  LOCAL_DB_TABLES,
  SHARED_APP_KV_KEYS,
  SYNC_TABLE_REGISTRY,
  inferSyncUserDataTablesFromSql,
  isSyncableAppKvKey,
  isSyncableSqlTable,
  sharedUserDataTables,
  tablesMissingUpdatedAt,
  userDataFieldForSqlTable
} from './syncRegistry';
import { USER_DATA_TABLES } from './userData';

const extractTablesFromMigrations = (): string[] => {
  const names = new Set<string>();
  const re = /(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|DROP TABLE|RENAME TO)\s+(\w+)/gi;
  for (const migration of SCHEMA_MIGRATIONS) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(migration.sql)) !== null) {
      const name = match[1];
      if (!name.endsWith('_new')) names.add(name);
    }
  }
  return [...names].sort();
};

describe('syncRegistry', () => {
  it('classifies every local.db table from schema migrations', () => {
    const migrationTables = extractTablesFromMigrations();
    expect(migrationTables.sort()).toEqual([...LOCAL_DB_TABLES].sort());
    for (const table of LOCAL_DB_TABLES) {
      expect(SYNC_TABLE_REGISTRY[table]).toBeDefined();
    }
  });

  it('marks posture_log desktop-only and habits shared', () => {
    expect(isSyncableSqlTable('posture_log')).toBe(false);
    expect(isSyncableSqlTable('streak_activities')).toBe(true);
    expect(userDataFieldForSqlTable('streak_activities')).toBe('streakActivities');
  });

  it('maps every USER_DATA_TABLES entry to a shared sql table', () => {
    for (const field of USER_DATA_TABLES) {
      expect(sharedUserDataTables()).toContain(field);
    }
  });

  it('lists no shared tables missing updated_at after migration v10', () => {
    expect(tablesMissingUpdatedAt()).toEqual([]);
  });

  it('does not overlap shared and desktop-only app_kv keys', () => {
    const shared = new Set<string>(SHARED_APP_KV_KEYS);
    for (const key of DESKTOP_ONLY_APP_KV_KEYS) {
      expect(shared.has(key)).toBe(false);
    }
  });

  it('classifies known app_kv keys', () => {
    expect(isSyncableAppKvKey('stretch_definitions_v1')).toBe(true);
    expect(isSyncableAppKvKey('posture_monitoring_enabled_v1')).toBe(false);
    expect(isSyncableAppKvKey('unknown_future_key')).toBe(false);
  });

  it('infers sync tables from streak archive SQL', () => {
    const tables = inferSyncUserDataTablesFromSql(
      'INSERT INTO streak_activities (id,name,archived_at) VALUES (?,?,?)'
    );
    expect(tables).toEqual(['streakActivities']);
  });

  it('ignores posture_log mutations for user-data sync', () => {
    const tables = inferSyncUserDataTablesFromSql(
      'INSERT INTO posture_log (score,is_turtle_neck,is_shoulder_misaligned,timestamp) VALUES (?,?,?,?)'
    );
    expect(tables).toEqual([]);
  });
});
