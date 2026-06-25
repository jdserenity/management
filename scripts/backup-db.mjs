#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  copyFileSync(dbPath, dest);
  console.log(dest);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) run();
