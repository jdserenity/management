#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { appConfigDir, backupDirFor, backupFileName } from './backup-db.mjs';
import {
  importStreakVaultIntoDb,
  importTdeeVaultIntoDb,
  isVaultImportDone,
  readVaultJson
} from '../src/lib/vaultImportSqlite.ts';

const DEFAULT_VAULT_ARCHIVE = join(
  homedir(),
  'Documents',
  'obsidian-temp',
  'obsidian vault (root)',
  'Archive'
);

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const archiveDir = process.env.VAULT_ARCHIVE_DIR || DEFAULT_VAULT_ARCHIVE;
const tdeePath = join(archiveDir, 'tdee-tracker-config.md');
const streakConfigPath = join(archiveDir, 'streak-tracker-config.md');
const streakDataPath = join(archiveDir, 'streak-tracker-data.md');

function requireFile(path: string) {
  if (!existsSync(path)) {
    console.error(`Missing vault file: ${path}`);
    process.exit(1);
  }
}

function backupDb(dbPath: string) {
  const configDir = appConfigDir(homedir(), process.platform);
  const outDir = backupDirFor(configDir);
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, backupFileName());
  copyFileSync(dbPath, dest);
  console.log(`Backup: ${dest}`);
}

function main() {
  requireFile(tdeePath);
  requireFile(streakConfigPath);
  requireFile(streakDataPath);

  const configDir = appConfigDir(homedir(), process.platform);
  const dbPath = join(configDir, 'mgmt.db');
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath} — launch the app once (npm run tauri dev), then rerun.`);
    process.exit(1);
  }

  const db = new Database(dbPath);
  const done = isVaultImportDone(db);
  if ((done.tdee || done.streak) && !force) {
    console.error('Vault import already recorded in app_kv. Pass --force to re-import.');
    process.exit(1);
  }

  backupDb(dbPath);

  const tdeeRaw = readVaultJson(tdeePath);
  const streakConfigRaw = readVaultJson(streakConfigPath);
  const streakDataRaw = readVaultJson(streakDataPath);

  db.transaction(() => {
    importTdeeVaultIntoDb(db, tdeeRaw);
    importStreakVaultIntoDb(db, streakConfigRaw, streakDataRaw);
  })();

  const tdee = db.prepare('SELECT tdee, protein FROM nutrition_config WHERE id = 1').get();
  const acts = db.prepare('SELECT COUNT(*) AS n FROM streak_activities').get() as { n: number };
  const logs = db.prepare('SELECT COUNT(*) AS n FROM streak_log_cells').get() as { n: number };
  console.log('Import complete.');
  console.log(`TDEE config: ${JSON.stringify(tdee)}`);
  console.log(`Streak activities: ${acts.n}, log cells: ${logs.n}`);
  db.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main();
