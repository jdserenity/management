import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_DATA_POLL_INTERVAL_MS, startUserDataPolling } from './userDataPolling';

describe('startUserDataPolling', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls pull on each interval', async () => {
    const pull = vi.fn();
    const stop = startUserDataPolling({ pull, intervalMs: 1000 });
    expect(pull).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(pull).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(pull).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(pull).toHaveBeenCalledTimes(3);
  });

  it('skips ticks while a pull is in flight', async () => {
    let release: () => void = () => {};
    const pull = vi.fn(() => new Promise<void>((r) => { release = r; }));
    startUserDataPolling({ pull, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(pull).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(pull).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pull).toHaveBeenCalledTimes(2);
  });

  it('respects shouldPoll', async () => {
    const pull = vi.fn();
    let allowed = false;
    startUserDataPolling({ pull, intervalMs: 1000, shouldPoll: () => allowed });
    await vi.advanceTimersByTimeAsync(3000);
    expect(pull).not.toHaveBeenCalled();
    allowed = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('defaults to five second interval', () => {
    expect(DEFAULT_USER_DATA_POLL_INTERVAL_MS).toBe(5000);
  });
});
