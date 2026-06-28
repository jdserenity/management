import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DB_CANDIDATES,
  formatByteSize,
  formatOverview,
  listTableRowCounts,
  parseEnvFileDbPath,
  resolveOverviewDbPath,
} from './db-server-overview.mjs';

describe('db-server-overview', () => {
  it('reads DB_PATH from env file contents', () => {
    expect(parseEnvFileDbPath('# comment\nDB_PATH=/var/lib/mgmt/server.db\n')).toBe('/var/lib/mgmt/server.db');
    expect(parseEnvFileDbPath('DB_PATH=./data/server.db\r\n')).toBe('./data/server.db');
  });

  it('resolves path from argv, env, env file, then first existing candidate', () => {
    const cwd = '/repo';
    expect(resolveOverviewDbPath({ cwd, argvPath: '/abs/server.db' })).toBe('/abs/server.db');
    expect(resolveOverviewDbPath({ cwd, envDbPath: 'data/x.db' })).toBe('/repo/data/x.db');
    expect(resolveOverviewDbPath({ cwd, envFileContents: 'DB_PATH=/etc/mgmt/server.db\n' })).toBe('/etc/mgmt/server.db');
    expect(resolveOverviewDbPath({
      cwd,
      existsSync: (p) => p === '/repo/data/server.db'
    })).toBe('/repo/data/server.db');
    expect(resolveOverviewDbPath({
      cwd,
      existsSync: (p) => p === '/repo/apps/server/data/server.db'
    })).toBe('/repo/apps/server/data/server.db');
    expect(resolveOverviewDbPath({ cwd, existsSync: () => false })).toBe(`/repo/${DEFAULT_DB_CANDIDATES[0]}`);
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
    const text = formatOverview('/data/server.db', [{ table: 'users', rows: 1 }], 2048);
    expect(text).toContain('DB: /data/server.db (2.0 KB)');
    expect(text).toContain('users  1');
  });

  it('formats byte sizes', () => {
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(1536)).toBe('1.5 KB');
    expect(formatByteSize(2 * 1024 ** 2)).toBe('2.0 MB');
  });
});
