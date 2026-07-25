import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createR2OffsiteUploader,
  offsiteObjectKey,
  resolveR2OffsiteConfig,
  type R2OffsiteDeps
} from './r2Offsite';

const tmpDirs: string[] = [];
const tmp = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgmt-r2-'));
  tmpDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('resolveR2OffsiteConfig', () => {
  it('returns null when any required env var is missing', () => {
    expect(resolveR2OffsiteConfig({})).toBeNull();
    expect(resolveR2OffsiteConfig({
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret'
      // missing bucket
    })).toBeNull();
  });

  it('returns config when all required vars are set', () => {
    expect(resolveR2OffsiteConfig({
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'mgmt-backups',
      R2_PREFIX: 'server/'
    })).toEqual({
      accountId: 'acct',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'mgmt-backups',
      prefix: 'server/'
    });
  });

  it('defaults prefix to empty string', () => {
    const cfg = resolveR2OffsiteConfig({
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'mgmt-backups'
    });
    expect(cfg?.prefix).toBe('');
  });
});

describe('offsiteObjectKey', () => {
  it('joins prefix and file name without double slashes', () => {
    expect(offsiteObjectKey('server-2026-07-25.db', '')).toBe('server-2026-07-25.db');
    expect(offsiteObjectKey('server-2026-07-25.db', 'backups')).toBe('backups/server-2026-07-25.db');
    expect(offsiteObjectKey('server-2026-07-25.db', 'backups/')).toBe('backups/server-2026-07-25.db');
  });
});

describe('createR2OffsiteUploader', () => {
  it('puts the local file and prunes older objects beyond retention', async () => {
    const dir = tmp();
    const local = path.join(dir, 'server-2026-07-25T15-04-05.db');
    fs.writeFileSync(local, 'snap-bytes');

    const put = vi.fn(async () => {});
    const list = vi.fn(async () => ([
      { key: 'server/server-old-1.db', lastModified: new Date('2026-07-01') },
      { key: 'server/server-old-2.db', lastModified: new Date('2026-07-02') },
      { key: 'server/server-new.db', lastModified: new Date('2026-07-25') }
    ]));
    const del = vi.fn(async () => {});
    const deps: R2OffsiteDeps = { putObject: put, listObjects: list, deleteObjects: del };

    const upload = createR2OffsiteUploader({
      accountId: 'acct',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'mgmt-backups',
      prefix: 'server/'
    }, deps);

    const result = await upload(local, { retentionDays: 2 });
    expect(put).toHaveBeenCalledWith({
      bucket: 'mgmt-backups',
      key: 'server/server-2026-07-25T15-04-05.db',
      body: expect.any(Buffer),
      contentType: 'application/octet-stream'
    });
    expect(put.mock.calls[0][0].body.toString()).toBe('snap-bytes');
    expect(list).toHaveBeenCalledWith({ bucket: 'mgmt-backups', prefix: 'server/' });
    expect(del).toHaveBeenCalledWith({
      bucket: 'mgmt-backups',
      keys: ['server/server-old-1.db']
    });
    expect(result).toEqual({
      key: 'server/server-2026-07-25T15-04-05.db',
      pruned: ['server/server-old-1.db']
    });
  });
});
