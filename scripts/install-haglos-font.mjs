#!/usr/bin/env node
/**
 * Fetches Haglos (personal-use demo) and copies Haglos-Regular.otf into desktop/ui/assets/fonts/.
 * License: free for personal use only — commercial license from Vultype if needed.
 * The OTF is not committed (redistribution restricted); builds must run this script first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'desktop/ui/assets/fonts');
const dest = path.join(outDir, 'Haglos-Regular.otf');
const licenseDest = path.join(outDir, 'HAGLOS-LICENSE.txt');

const DOWNLOAD_URLS = [
  // dafont is the reliable CI/source; 1001fonts often blocks automated fetch.
  'https://dl.dafont.com/dl/?f=haglos',
  'https://www.1001fonts.com/download/font/haglos.zip',
  'https://dl.1001freefonts.net/alphanumeric-data/h/haglos.zip'
];

function findOtf(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (name.toLowerCase().endsWith('.otf')) return full;
    }
  }
  return null;
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mgmt-font-install/1.0)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('response too small');
  fs.writeFileSync(filePath, buf);
}

async function main() {
  if (fs.existsSync(dest)) {
    console.log('Already installed:', dest);
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(tmpdir(), `haglos-${Date.now()}.zip`);
  const extractDir = path.join(tmpdir(), `haglos-extract-${Date.now()}`);
  let lastErr;
  for (const url of DOWNLOAD_URLS) {
    try {
      console.log('Trying', url);
      await downloadToFile(url, zipPath);
      fs.mkdirSync(extractDir, { recursive: true });
      execFileSync('unzip', ['-o', zipPath, '-d', extractDir], { stdio: 'inherit' });
      const otf = findOtf(extractDir);
      if (!otf) throw new Error('no .otf in zip');
      fs.copyFileSync(otf, dest);
      if (!fs.existsSync(licenseDest)) {
        fs.writeFileSync(
          licenseDest,
          'Haglos by Vultype Co — personal use per 1001Fonts FFP; commercial license required from vultypefont.com\n'
        );
      }
      console.log('Installed', dest);
      return;
    } catch (e) {
      lastErr = e;
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
    }
  }
  console.error('Could not download Haglos automatically.', lastErr?.message ?? lastErr);
  console.error('Download from https://www.1001fonts.com/haglos-font.html and save as:', dest);
  process.exit(1);
}

main();
