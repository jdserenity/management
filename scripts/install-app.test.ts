import { describe, expect, it } from 'vitest';
import { APP_NAME, applicationsDest, releaseAppPath } from './install-app.mjs';

describe('install-app paths', () => {
  it('points at the Tauri release bundle', () => {
    expect(releaseAppPath('/repo')).toBe(`/repo/src-tauri/target/release/bundle/macos/${APP_NAME}`);
  });

  it('installs to /Applications', () => {
    expect(applicationsDest()).toBe(`/Applications/${APP_NAME}`);
  });
});
