import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, appSurfaceLabel } from '@/lib/appVersion';

describe('appVersion', () => {
  it('uses root package.json version at build time', () => {
    const pkgVersion = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version;
    expect(APP_VERSION).toBe(pkgVersion);
  });

  it('labels each app surface for the version card', () => {
    expect(appSurfaceLabel('desktop')).toBe('Desktop app');
    expect(appSurfaceLabel('companion')).toBe('Phone companion');
    expect(appSurfaceLabel('browser')).toBe('Browser');
  });
});
