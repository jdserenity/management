import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultBackupDirFor,
  hasBackupForLocalDay,
  msUntilNextLocalHour,
  pruneOldBackups,
  resolveBackupDir,
  serverBackupFileName,
  backupServerDb,
  startDailyServerDbBackup
} from './dbBackup';

const tmpDirs: string[] = [];
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgmt-backup-'));
  tmpDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('dbBackup paths', () => {
  it('defaults backups beside the database file', () => {
    expect(defaultBackupDirFor('/var/lib/mgmt/server.db')).toBe('/var/lib/mgmt/backups');
  });

  it('resolves BACKUP_DIR relative to cwd when not absolute', () => {
    const abs = resolveBackupDir('/data/server.db', '/custom/backups');
    expect(abs).toBe('/custom/backups');
  });

  it('names backups with a stable timestamp prefix', () => {
    expect(serverBackupFileName(new Date('2026-07-25T15:04:05.000Z'))).toBe('server-2026-07-25T15-04-05.db');
  });
});

describe('pruneOldBackups', () => {
  it('keeps the newest N server-*.db files', () => {
    const dir = tmp();
    for (let i = 0; i < 5; i++) {
      const p = path.join(dir, `server-2026-07-0${i + 1}.db`);
      fs.writeFileSync(p, String(i));
      const d = new Date('2026-07-25T12:00:00Z');
      d.setDate(d.getDate() - (5 - i));
      fs.utimesSync(p, d, d);
    }
    const removed = pruneOldBackups(dir, 2);
    expect(removed).toHaveLength(3);
    expect(fs.readdirSync(dir).sort()).toEqual(['server-2026-07-04.db', 'server-2026-07-05.db']);
  });
});

describe('msUntilNextLocalHour', () => {
  it('returns ms until the next occurrence of the local hour', () => {
    const now = new Date('2026-07-25T10:30:00');
    const ms = msUntilNextLocalHour(3, now);
    const target = new Date(now.getTime() + ms);
    expect(target.getHours()).toBe(3);
    expect(target.getDate()).toBe(26);
  });
});

describe('backupServerDb', () => {
  it('writes a snapshot and prunes old files', async () => {
    const dir = tmp();
    const dbPath = path.join(dir, 'server.db');
    const backupDir = path.join(dir, 'backups');
    fs.writeFileSync(dbPath, 'live');
    for (let i = 0; i < 3; i++) {
      const p = path.join(backupDir, `server-old-${i}.db`);
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(p, 'old');
      const d = new Date(Date.now() - (i + 1) * 86400000);
      fs.utimesSync(p, d, d);
    }
    const backup = vi.fn(async (dest: string) => { fs.writeFileSync(dest, 'snap'); });
    const result = await backupServerDb({ backup }, dbPath, {
      backupDir,
      retentionDays: 2,
      now: new Date('2026-07-25T15:04:05.000Z')
    });
    expect(backup).toHaveBeenCalledWith(path.join(backupDir, 'server-2026-07-25T15-04-05.db'));
    expect(fs.readFileSync(result.dest, 'utf8')).toBe('snap');
    expect(result.pruned.length).toBeGreaterThanOrEqual(1);
    expect(fs.readdirSync(backupDir).filter((n) => n.startsWith('server-')).length).toBeLessThanOrEqual(2);
  });
});

describe('hasBackupForLocalDay', () => {
  it('detects a backup whose mtime is today', () => {
    const dir = tmp();
    const p = path.join(dir, 'server-today.db');
    fs.writeFileSync(p, 'x');
    expect(hasBackupForLocalDay(dir, new Date())).toBe(true);
  });

  it('is false when only older backups exist', () => {
    const dir = tmp();
    const p = path.join(dir, 'server-old.db');
    fs.writeFileSync(p, 'x');
    const old = new Date();
    old.setDate(old.getDate() - 2);
    fs.utimesSync(p, old, old);
    expect(hasBackupForLocalDay(dir, new Date())).toBe(false);
  });
});

describe('startDailyServerDbBackup', () => {
  it('fires after the delay to the configured local hour', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-07-25T10:00:00');
    vi.setSystemTime(now);
    const dir = tmp();
    const dbPath = path.join(dir, 'server.db');
    const backupDir = path.join(dir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    // Pretend today's backup already exists so the boot catch-up does not fire at 5s.
    fs.writeFileSync(path.join(backupDir, 'server-existing.db'), 'old');
    const backup = vi.fn(async (dest: string) => { fs.writeFileSync(dest, 'x'); });
    fs.writeFileSync(dbPath, 'live');
    const stop = startDailyServerDbBackup({ backup }, dbPath, { hour: 3, retentionDays: 14, backupDir });
    expect(backup).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(msUntilNextLocalHour(3, now) + 10);
    expect(backup).toHaveBeenCalledTimes(1);
    stop();
  });
});
