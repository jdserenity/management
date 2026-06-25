import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const defaultDbPath = (): string => path.join(packageRoot, 'data', 'server.db');

export const resolveDbPath = (raw?: string): string => {
  const value = raw?.trim();
  const abs = value
    ? path.isAbsolute(value) ? value : path.resolve(process.cwd(), value)
    : defaultDbPath();
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
};
