#!/usr/bin/env node
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_NAME = 'Management.app';

/** @param {string} repoRoot */
export function releaseAppPath(repoRoot) {
  return join(repoRoot, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', APP_NAME);
}

export function applicationsDest() {
  return join('/', 'Applications', APP_NAME);
}

function run() {
  if (process.platform !== 'darwin') {
    console.error('app:install is macOS only.');
    process.exit(1);
  }
  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const src = releaseAppPath(repoRoot);
  const dest = applicationsDest();
  if (!existsSync(src)) {
    console.error(`No build at ${src}. Run: npm run tauri build`);
    process.exit(1);
  }
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(dest);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) run();
