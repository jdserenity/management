import { describe, expect, it, afterEach } from 'vitest';
import { getAppKind, hasAppStorage, markCompanionApp } from './appRuntime';

describe('appRuntime', () => {
  afterEach(() => {
    delete (globalThis as Window & typeof globalThis).__MGMT_APP_KIND__;
  });

  it('detects companion after markCompanionApp', () => {
    markCompanionApp();
    expect(getAppKind()).toBe('companion');
    expect(hasAppStorage()).toBe(true);
  });
});
