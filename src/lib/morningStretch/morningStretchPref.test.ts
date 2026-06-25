import { describe, expect, it } from 'vitest';
import {
  clampMorningStretchDurationMinutes,
  defaultMorningStretchPrefs,
  normalizeMorningStretchPrefs
} from '@/lib/morningStretch/morningStretchPref';

describe('morningStretchPref', () => {
  it('defaults to enabled with 5 minute block and 11am hide', () => {
    expect(defaultMorningStretchPrefs()).toEqual({
      enabled: true,
      durationMinutes: 5,
      hideAfterHour: 11
    });
  });

  it('clamps duration between 1 and 60 minutes', () => {
    expect(clampMorningStretchDurationMinutes(0)).toBe(1);
    expect(clampMorningStretchDurationMinutes(5)).toBe(5);
    expect(clampMorningStretchDurationMinutes(90)).toBe(60);
  });

  it('normalizes partial prefs', () => {
    expect(normalizeMorningStretchPrefs({ enabled: false, durationMinutes: 7 })).toMatchObject({
      enabled: false,
      durationMinutes: 7,
      hideAfterHour: 11
    });
  });
});
