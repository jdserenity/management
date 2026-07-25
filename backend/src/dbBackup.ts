import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

export const DEFAULT_BACKUP_RETENTION_DAYS = 14;

/** Directory for server.db snapshots (sibling backups/ next to the DB file). */
export const defaultBackupDirFor = (dbPath: string): string =>
  path.join(path.dirname(dbPath), 'backups');

export const resolveBackupDir = (dbPath: string, backupDirEnv?: string): string => {
  const raw = backupDirEnv?.trim();
  if (!raw) return defaultBackupDirFor(dbPath);
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
};

export const serverBackupFileName = (d = new Date()): string => {
  const stamp = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `server-${stamp}.db`;
};

/** Keep the newest `keep` backup files; delete older server-*.db entries. */
export const pruneOldBackups = (backupDir: string, keep = DEFAULT_BACKUP_RETENTION_DAYS): string[] => {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs.readdirSync(backupDir)
    .filter((name) => /^server-.*\.db$/i.test(name))
    .map((name) => {
      const full = path.join(backupDir, name);
      return { name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  const removed: string[] = [];
  for (const file of files.slice(Math.max(0, keep))) {
    fs.unlinkSync(file.full);
    removed.push(file.full);
  }
  return removed;
};

export const msUntilNextLocalHour = (hour: number, now = new Date()): number => {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(hour);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
};

type BackupDb = Pick<Database.Database, 'backup'>;

/** Snapshot open server.db into backupDir; prune to retention days. */
export const backupServerDb = async (
  db: BackupDb,
  dbPath: string,
  opts: { backupDir?: string; retentionDays?: number; now?: Date } = {}
): Promise<{ dest: string; pruned: string[] }> => {
  const backupDir = opts.backupDir ?? defaultBackupDirFor(dbPath);
  const retentionDays = opts.retentionDays ?? DEFAULT_BACKUP_RETENTION_DAYS;
  fs.mkdirSync(backupDir, { recursive: true });
  const dest = path.join(backupDir, serverBackupFileName(opts.now ?? new Date()));
  await db.backup(dest);
  const pruned = pruneOldBackups(backupDir, retentionDays);
  return { dest, pruned };
};

/** True if backupDir already has a server-*.db whose mtime is on the same local calendar day as `now`. */
export const hasBackupForLocalDay = (backupDir: string, now = new Date()): boolean => {
  if (!fs.existsSync(backupDir)) return false;
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  for (const name of fs.readdirSync(backupDir)) {
    if (!/^server-.*\.db$/i.test(name)) continue;
    const mt = new Date(fs.statSync(path.join(backupDir, name)).mtimeMs);
    if (mt.getFullYear() === y && mt.getMonth() === m && mt.getDate() === d) return true;
  }
  return false;
};

/** Schedule a daily backup at local `hour` (default 3 AM). Also takes one snapshot soon after boot if none exists for today. Returns a cancel function. */
export const startDailyServerDbBackup = (
  db: BackupDb,
  dbPath: string,
  opts: {
    backupDir?: string;
    retentionDays?: number;
    hour?: number;
    log?: (msg: string, extra?: Record<string, unknown>) => void;
  } = {}
): (() => void) => {
  const hour = opts.hour ?? 3;
  const backupDir = opts.backupDir ?? defaultBackupDirFor(dbPath);
  const log = opts.log ?? ((msg, extra) => { console.log(`[db-backup] ${msg}`, extra ?? ''); });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let bootTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const run = async () => {
    try {
      const result = await backupServerDb(db, dbPath, {
        backupDir,
        retentionDays: opts.retentionDays
      });
      log('ok', { dest: result.dest, pruned: result.pruned.length });
    } catch (err) {
      log('failed', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      void run().finally(scheduleNext);
    }, msUntilNextLocalHour(hour));
  };

  scheduleNext();
  if (!hasBackupForLocalDay(backupDir)) {
    bootTimer = setTimeout(() => { void run(); }, 5_000);
  }
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (bootTimer) clearTimeout(bootTimer);
    timer = null;
    bootTimer = null;
  };
};
