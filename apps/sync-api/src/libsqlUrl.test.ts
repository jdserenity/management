import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveLibsqlUrl } from './libsqlUrl';

describe('resolveLibsqlUrl', () => {
  it('uses an absolute file path under sync-api/data by default', () => {
    const url = resolveLibsqlUrl();
    expect(url.startsWith('file:')).toBe(true);
    const filePath = url.slice('file:'.length);
    expect(path.isAbsolute(filePath)).toBe(true);
    expect(filePath).toContain(`${path.sep}apps${path.sep}sync-api${path.sep}data${path.sep}local.db`);
    expect(fs.existsSync(path.dirname(filePath))).toBe(true);
  });

  it('creates parent dirs for relative file URLs from cwd', () => {
    const rel = 'file:apps/sync-api/data/test-local.db';
    const url = resolveLibsqlUrl(rel);
    const filePath = url.slice('file:'.length);
    expect(fs.existsSync(path.dirname(filePath))).toBe(true);
  });
});
