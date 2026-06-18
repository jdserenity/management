import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const defaultLocalDbFile = (): string => path.join(packageRoot, 'data', 'local.db');

export const ensureDbParentDir = (dbFilePath: string): void => {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
};

/** Resolve LIBSQL_URL for local dev; creates the parent dir for file: URLs. */
export const resolveLibsqlUrl = (raw?: string): string => {
  const value = raw?.trim();
  if (!value) {
    const dbFile = defaultLocalDbFile();
    ensureDbParentDir(dbFile);
    return `file:${dbFile}`;
  }
  if (value.startsWith('file:')) {
    const filePath = value.slice('file:'.length);
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    ensureDbParentDir(abs);
    return `file:${abs}`;
  }
  return value;
};
