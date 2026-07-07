#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tauriConfig = path.join(repoRoot, 'desktop/src-tauri/tauri.conf.json');
const tauriArgs = ['--config', tauriConfig, ...args];

if (args[0] === 'build' && !process.env.TAURI_SIGNING_PRIVATE_KEY) {
  tauriArgs.push('--config', JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
}

const result = spawnSync('tauri', tauriArgs, { cwd: repoRoot, stdio: 'inherit', shell: false });
if (result.status !== 0) process.exit(result.status ?? 1);

if (args[0] === 'build' && process.platform === 'darwin') {
  const deploy = spawnSync('npm', ['run', 'app:deploy'], { cwd: repoRoot, stdio: 'inherit', shell: false });
  process.exit(deploy.status ?? 0);
}
