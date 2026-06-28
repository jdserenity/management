#!/usr/bin/env node
import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DB_REL = 'data/server.db';

/** @param {string} [cwd] */
export const serverDbPath = (cwd = process.cwd()) => path.resolve(cwd, SERVER_DB_REL);

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

function run() {
  const dbPath = serverDbPath();
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath}`);
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
