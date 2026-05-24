import { describe, expect, it } from 'vitest';
import { appConfigDir, backupDirFor, backupFileName, BUNDLE_ID } from './backup-db.mjs';

describe('backup-db paths', () => {
  it('uses bundle id in app config dir', () => {
    expect(appConfigDir('/Users/me', 'darwin')).toBe(`/Users/me/Library/Application Support/${BUNDLE_ID}`);
    expect(appConfigDir('/home/me', 'linux')).toBe(`/home/me/.config/${BUNDLE_ID}`);
    expect(appConfigDir('C:\\Users\\me', 'win32')).toContain(BUNDLE_ID);
  });

  it('puts backups beside the database', () => {
    expect(backupDirFor('/cfg')).toBe('/cfg/backups');
  });

  it('names backups with a stable timestamp prefix', () => {
    expect(backupFileName(new Date('2026-05-24T15:04:05.000Z'))).toBe('mgmt-2026-05-24T15-04-05.db');
  });
});
