import { describe, expect, it } from 'vitest';
import { phaseEndsAtMsAfterLidResume } from './flowLidPause';

describe('phaseEndsAtMsAfterLidResume', () => {
  it('extends the phase end from remaining seconds at resume time', () => {
    expect(phaseEndsAtMsAfterLidResume(90, 1_000_000)).toBe(1_000_000 + 90_000);
    expect(phaseEndsAtMsAfterLidResume(0, 5_000)).toBe(5_000);
  });
});
