#!/usr/bin/env node
/** Quick check: can this machine POST data to the sync server? */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const loadEnv = () => {
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8').split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return i === -1 ? null : [l.slice(0, i), l.slice(i + 1)]; })
      .filter(Boolean)
  );
};

const env = loadEnv();
const url = (env.VITE_SERVER_URL || '').replace(/\/$/, '');
const token = env.VITE_SERVER_TOKEN || '';
const empty = { focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null, nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [], streakActivities: [], streakLogCells: [], streakActivityMeta: [] };

if (!url || !token) {
  console.error('Set VITE_SERVER_URL and VITE_SERVER_TOKEN in .env');
  process.exit(1);
}

const res = await fetch(`${url}/v1/data`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { ...empty, appKv: [{ key: 'sync_probe_v1', value: String(Date.now()), updated_at: Date.now() }] } })
});
console.log('POST', res.status, await res.text());
const get = await fetch(`${url}/v1/data`, { headers: { Authorization: `Bearer ${token}` } });
const body = await get.json();
const probe = body?.data?.appKv?.find?.((r) => r.key === 'sync_probe_v1');
console.log('probe on server:', probe ? 'yes' : 'no');
