import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { countdownToneHz, scheduleCountdownBeeps } from '@/lib/sessionSounds';

describe('sessionSounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('countdown tones descend from 5 to 1', () => {
    expect(countdownToneHz(5)).toBeGreaterThan(countdownToneHz(4));
    expect(countdownToneHz(4)).toBeGreaterThan(countdownToneHz(3));
    expect(countdownToneHz(3)).toBeGreaterThan(countdownToneHz(2));
    expect(countdownToneHz(2)).toBeGreaterThan(countdownToneHz(1));
  });

  it('scheduleCountdownBeeps fires each second from start down to 1', () => {
    const ticks: number[] = [];
    scheduleCountdownBeeps(3, (s) => ticks.push(s));
    vi.runAllTimers();
    expect(ticks).toEqual([3, 2, 1]);
  });
});
