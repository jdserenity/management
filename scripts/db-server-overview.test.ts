import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  formatByteSize,
  formatOverview,
  listTableRowCounts,
  SERVER_DB_REL,
  serverDbPath,
} from './db-server-overview.mjs';

describe('db-server-overview', () => {
  it('uses data/server.db under cwd', () => {
    expect(SERVER_DB_REL).toBe('data/server.db');
    expect(serverDbPath('/repo')).toBe('/repo/data/server.db');
  });

  it('lists row counts for every user table', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE focus_log (id TEXT);');
    db.prepare("INSERT INTO users (id) VALUES ('owner')").run();
    db.prepare("INSERT INTO focus_log (id) VALUES ('a'), ('b')").run();
    expect(listTableRowCounts(db)).toEqual([
      { table: 'focus_log', rows: 2 },
      { table: 'users', rows: 1 },
    ]);
    db.close();
  });

  it('formats overview output', () => {
    const text = formatOverview('/repo/data/server.db', [{ table: 'users', rows: 1 }], 2048);
    expect(text).toContain('DB: /repo/data/server.db (2.0 KB)');
    expect(text).toContain('users  1');
  });

  it('formats byte sizes', () => {
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(1536)).toBe('1.5 KB');
    expect(formatByteSize(2 * 1024 ** 2)).toBe('2.0 MB');
  });
});
