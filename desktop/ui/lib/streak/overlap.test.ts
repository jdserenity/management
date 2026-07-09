import { describe, expect, it } from 'vitest';
import { formatOverlapBadge, hasOverlapLogging, labelFromStapleId } from '@/lib/streak/overlap';
import type { StreakActivity } from '@/lib/streak/types';

describe('streak overlap', () => {
  const base: StreakActivity = { id: 'coffee', name: 'Coffee' };

  it('formatOverlapBadge returns null when no extras', () => {
    expect(formatOverlapBadge(base)).toBeNull();
  });

  it('formatOverlapBadge joins calories and water', () => {
    expect(formatOverlapBadge({ ...base, extraCalories: 200, extraWaterMl: 300 })).toBe('200 kcal · 300 ml');
  });

  it('formatOverlapBadge includes protein when set', () => {
    expect(formatOverlapBadge({ ...base, extraCalories: 200, extraProtein: 8, extraWaterMl: 300 })).toBe('200 kcal · 8g protein · 300 ml');
  });

  it('formatOverlapBadge shows necessary and network links', () => {
    expect(formatOverlapBadge({ ...base, necessary: true, linkedStapleId: 'olive-oil', linkedWater: true }))
      .toBe('necessary · 🍽 olive oil · 💧 water');
  });

  it('labelFromStapleId humanizes ids', () => {
    expect(labelFromStapleId('olive-oil')).toBe('olive oil');
  });

  it('hasOverlapLogging is true when any extra is set', () => {
    expect(hasOverlapLogging(base)).toBe(false);
    expect(hasOverlapLogging({ ...base, extraWaterMl: 250 })).toBe(true);
    expect(hasOverlapLogging({ ...base, linkedStapleId: 'eggs' })).toBe(true);
  });
});
