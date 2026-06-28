#!/usr/bin/env node
import Database from 'better-sqlite3';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_ENV_PATH = '/etc/mgmt/server.env';
/** Repo-root VPS path first; apps/server path for local dev when DB_PATH is unset. */
export const DEFAULT_DB_CANDIDATES = ['data/server.db', 'apps/server/data/server.db'];

/** @param {string} contents */
export function parseEnvFileDbPath(contents) {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== 'DB_PATH') continue;
    return trimmed.slice(eq + 1).trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
  }
  return null;
}

/** @param {{ cwd?: string, argvPath?: string, envDbPath?: string, envFileContents?: string | null, candidates?: string[], existsSync?: (p: string) => boolean }} [opts] */
export function resolveOverviewDbPath(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const exists = opts.existsSync ?? existsSync;
  const argvPath = opts.argvPath?.trim();
  if (argvPath) return path.isAbsolute(argvPath) ? argvPath : path.resolve(cwd, argvPath);
  const envDbPath = opts.envDbPath?.trim();
  if (envDbPath) return path.isAbsolute(envDbPath) ? envDbPath : path.resolve(cwd, envDbPath);
  if (opts.envFileContents != null) {
    const fromFile = parseEnvFileDbPath(opts.envFileContents);
    if (fromFile) return path.isAbsolute(fromFile) ? fromFile : path.resolve(cwd, fromFile);
  }
  const candidates = opts.candidates ?? DEFAULT_DB_CANDIDATES;
  for (const rel of candidates) {
    const abs = path.resolve(cwd, rel);
    if (exists(abs)) return abs;
  }
  return path.resolve(cwd, candidates[0]);
}

/** @param {import('better-sqlite3').Database} db */
export function listTableRowCounts(db) {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1"
  ).all().map((row) => row.name);
  return tables.map((name) => {
    const quoted = `"${String(name).replace(/"/g, '""')}"`;
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${quoted}`).get();
    return { table: name, rows: Number(row.n) };
  });
}

/** @param {number} bytes */
export function formatByteSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** @param {string} dbPath @param {{ table: string, rows: number }[]} counts @param {number} sizeBytes */
export function formatOverview(dbPath, counts, sizeBytes) {
  const width = Math.max(5, ...counts.map((c) => c.table.length));
  const lines = [`DB: ${dbPath} (${formatByteSize(sizeBytes)})`, '', `${'TABLE'.padEnd(width)}  ROWS`];
  for (const { table, rows } of counts) lines.push(`${table.padEnd(width)}  ${rows}`);
  return lines.join('\n');
}

function readServerEnvFile() {
  try {
    return readFileSync(SERVER_ENV_PATH, 'utf8');
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') return null;
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EACCES') {
      console.error(`Cannot read ${SERVER_ENV_PATH} (permission denied). Use:`);
      console.error(`  DB_PATH=$(sudo grep '^DB_PATH=' ${SERVER_ENV_PATH} | cut -d= -f2-) npm run db:server-overview`);
      process.exit(1);
    }
    throw err;
  }
}

function run() {
  const argvPath = process.argv[2];
  const envFileContents = argvPath ? null : readServerEnvFile();
  const dbPath = resolveOverviewDbPath({ argvPath, envDbPath: process.env.DB_PATH, envFileContents });
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath}`);
    console.error('Set DB_PATH, pass a path argument, or start the server once to create the file.');
    process.exit(1);
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    const counts = listTableRowCounts(db);
    console.log(formatOverview(dbPath, counts, statSync(dbPath).size));
    if (integrity !== 'ok') {
      console.error(`\nintegrity_check: ${integrity}`);
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) run();
