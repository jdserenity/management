import { afterEach, describe, expect, it, vi } from 'vitest';
import { setSyncFetchImpl, syncFetch } from './syncFetch';

describe('syncFetch', () => {
  afterEach(() => { setSyncFetchImpl(null); });

  it('aborts when the underlying fetch never settles', async () => {
    vi.useFakeTimers();
    setSyncFetchImpl((_input, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = syncFetch('http://example.test/v1/data');
    const assertion = expect(pending).rejects.toThrow('aborted');
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });
});
