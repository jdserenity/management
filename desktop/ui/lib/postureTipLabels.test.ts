import { describe, expect, it } from 'vitest';
import { postureTipLabel } from './postureTipLabels';

describe('postureTipLabel', () => {
  it('maps known tip keys to English copy', () => {
    expect(postureTipLabel('tip1')).toContain('neck');
    expect(postureTipLabel('motivation.excellent')).toContain('Excellent');
  });

  it('returns the key when unknown', () => {
    expect(postureTipLabel('custom-tip')).toBe('custom-tip');
  });
});
