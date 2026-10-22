import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForServiceWorkerUpdate, installServiceWorkerUpdateChecks } from './swUpdate';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('service worker update checks', () => {
  it('asks the registration to check for a new version', async () => {
    const update = vi.fn(async () => {});
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => ({ update })) } });
    await checkForServiceWorkerUpdate();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('survives browsers without service workers', async () => {
    vi.stubGlobal('navigator', {});
    await expect(checkForServiceWorkerUpdate()).resolves.toBeUndefined();
  });

  it('checks on install and again when the app becomes visible', async () => {
    vi.useFakeTimers();
    const update = vi.fn(async () => {});
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn(async () => ({ update })) } });
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn((type: string, fn: () => void) => { listeners[type] = fn; })
    });
    installServiceWorkerUpdateChecks();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    listeners.visibilitychange?.();
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(3);
  });
});
