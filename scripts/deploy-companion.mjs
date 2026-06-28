import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const companionDir = path.join(root, 'apps/companion');

const loadEnv = (file) => {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        return i === -1 ? null : [line.slice(0, i), line.slice(i + 1)];
      })
      .filter(Boolean)
  );
};

const env = { ...process.env, ...loadEnv(envPath) };
let url = env.VITE_SERVER_URL?.trim();
const token = env.VITE_SERVER_TOKEN?.trim();

if (!url || !token) {
  console.error('Missing VITE_SERVER_URL or VITE_SERVER_TOKEN in .env (repo root).');
  console.error('Example:');
  console.error('  VITE_SERVER_URL=https://mgmt.levier.cc');
  console.error('  VITE_SERVER_TOKEN=<same as SERVER_TOKEN on VPS>');
  process.exit(1);
}

if (!/^https?:\/\//i.test(url)) {
  console.error(`VITE_SERVER_URL must start with http:// or https:// (got "${url}").`);
  console.error('Companion on a phone needs https://mgmt.levier.cc (not a bare Tailscale IP).');
  process.exit(1);
}

console.log(`Building companion (API: ${url})...`);
execSync('npm run build:companion', { cwd: root, env, stdio: 'inherit' });

console.log('Deploying to Cloudflare Pages...');
execSync('npx wrangler pages deploy dist --project-name mgmt-companion --branch main', {
  cwd: companionDir,
  env,
  stdio: 'inherit'
});
