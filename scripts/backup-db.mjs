#!/usr/bin/env node
/**
 * Backup local.db with a consistent SQLite snapshot (includes WAL contents).
 * Prefer `sqlite3 .backup` over a plain file copy so in-flight WAL pages are not dropped.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const BUNDLE_ID = 'com.diamari.management';
const DB_NAME = 'local.db';

/** @param {string} home @param {NodeJS.Platform} platform */
export function appConfigDir(home, platform) {
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', BUNDLE_ID);
  if (platform === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
    return join(appData, BUNDLE_ID);
  }
  return join(home, '.config', BUNDLE_ID);
}

/** @param {string} configDir */
export function backupDirFor(configDir) {
  return join(configDir, 'backups');
}

/** @param {Date} [d] */
export function backupFileName(d = new Date()) {
  const stamp = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `mgmt-${stamp}.db`;
}

/**
 * @param {string} dbPath
 * @param {string} dest
 * @returns {{ ok: boolean; method: 'sqlite3-backup' | 'copyFileSync'; detail?: string }}
 */
export function backupDatabaseFile(dbPath, dest) {
  // Consistent online backup (merges WAL into the output file).
  const quotedDest = dest.replace(/'/g, "''");
  const result = spawnSync('sqlite3', [dbPath, `.backup '${quotedDest}'`], {
    encoding: 'utf8'
  });
  if (result.status === 0 && existsSync(dest)) {
    return { ok: true, method: 'sqlite3-backup' };
  }
  // Fallback if sqlite3 CLI is missing (less safe with open WAL).
  copyFileSync(dbPath, dest);
  return {
    ok: true,
    method: 'copyFileSync',
    detail: result.error?.message || result.stderr || 'sqlite3 backup failed; used file copy'
  };
}

function run() {
  const home = homedir();
  const configDir = appConfigDir(home, process.platform);
  const dbPath = join(configDir, DB_NAME);
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath} (launch the app once, or check bundle id).`);
    process.exit(1);
  }
  const outDir = backupDirFor(configDir);
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, backupFileName());
  const outcome = backupDatabaseFile(dbPath, dest);
  if (!outcome.ok) {
    console.error('Backup failed');
    process.exit(1);
  }
  console.log(dest);
  if (outcome.method === 'copyFileSync') {
    console.warn(`warning: ${outcome.detail || 'used plain copy (WAL may be incomplete)'}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) run();
