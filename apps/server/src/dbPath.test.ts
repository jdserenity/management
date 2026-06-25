import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDbPath } from './dbPath';

describe('resolveDbPath', () => {
  it('returns an absolute path under apps/server/data by default', () => {
    const p = resolveDbPath();
    expect(path.isAbsolute(p)).toBe(true);
    expect(p).toContain(`${path.sep}apps${path.sep}server${path.sep}data${path.sep}server.db`);
    expect(fs.existsSync(path.dirname(p))).toBe(true);
  });

  it('resolves a relative path from cwd', () => {
    const p = resolveDbPath('apps/server/data/test.db');
    expect(path.isAbsolute(p)).toBe(true);
    expect(fs.existsSync(path.dirname(p))).toBe(true);
  });

  it('passes through an absolute path unchanged', () => {
    const abs = path.join(process.cwd(), 'apps/server/data/abs.db');
    const p = resolveDbPath(abs);
    expect(p).toBe(abs);
  });
});
