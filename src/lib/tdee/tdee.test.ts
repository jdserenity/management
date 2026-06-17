import { describe, expect, it } from 'vitest';
import { getCurrentLogDay, formatLogDay } from '@/lib/tdee/dates';
import { activeEntries, isStapleLogged, makeTombstone } from '@/lib/tdee/entries';
import { mergeEntries } from '@/lib/tdee/merge';
import { normalizeFile } from '@/lib/tdee/normalize';
import {
  entryCalories,
  entryProtein,
  formatChipMacros,
  progressRatio,
  proteinRemainingDisplay,
  remainingDisplay,
  totalCalories,
  totalProtein
} from '@/lib/tdee/totals';
import fixture from '@/lib/tdee/fixtures/tdee-config.json';

describe('tdee totals', () => {
  it('totalCalories sums entries with count', () => {
    expect(
      totalCalories([
        { id: '1', kind: 'custom', refId: null, label: 'a', calories: 600, protein: 0, count: 1, updatedAt: 'x' },
        { id: '2', kind: 'custom', refId: null, label: 'b', calories: 800, protein: 30, count: 2, updatedAt: 'x' }
      ])
    ).toBe(2200);
  });

  it('totalProtein sums entries with count', () => {
    expect(
      totalProtein([
        { id: '1', kind: 'custom', refId: null, label: 'a', calories: 600, protein: 40, count: 1, updatedAt: 'x' },
        { id: '2', kind: 'custom', refId: null, label: 'b', calories: 800, protein: 30, count: 2, updatedAt: 'x' }
      ])
    ).toBe(100);
  });

  it('entryCalories defaults count to 1', () => {
    expect(entryCalories({ id: '1', kind: 'custom', refId: null, label: 'a', calories: 450, protein: 0, count: 1, updatedAt: 'x' })).toBe(450);
  });

  it('entryProtein defaults missing protein to 0', () => {
    expect(entryProtein({ id: '1', kind: 'custom', refId: null, label: 'a', calories: 450, protein: 0, count: 1, updatedAt: 'x' })).toBe(0);
    expect(entryProtein({ id: '2', kind: 'custom', refId: null, label: 'b', calories: 450, protein: 25, count: 2, updatedAt: 'x' })).toBe(50);
  });

  it('progressRatio caps at 1', () => {
    expect(progressRatio(3000, 2500)).toBe(1);
    expect(progressRatio(1250, 2500)).toBe(0.5);
  });

  it('remainingDisplay shows remaining kcal under TDEE', () => {
    const d = remainingDisplay(2000, 2500);
    expect(d.text).toBe('500 kcal remaining');
    expect(d.extraClass).toBe('');
  });

  it('remainingDisplay celebrates surplus over TDEE', () => {
    const d = remainingDisplay(2800, 2500);
    expect(d.text).toBe('💪 300 kcal over TDEE');
    expect(d.extraClass).toMatch(/tdee-remaining-surplus/);
  });

  it('proteinRemainingDisplay celebrates surplus over protein target', () => {
    const d = proteinRemainingDisplay(200, 180);
    expect(d.text).toBe('💪 20 g over target');
    expect(d.extraClass).toMatch(/tdee-remaining-surplus/);
  });

  it('formatChipMacros shows calories and protein', () => {
    expect(formatChipMacros(600, 0)).toBe('600 / 0g');
    expect(formatChipMacros(800, 45)).toBe('800 / 45g');
  });
});

describe('tdee entries', () => {
  it('activeEntries skips tombstones', () => {
    const entries = [
      { id: 'e1', kind: 'staple' as const, refId: 'x', label: 'Oil', calories: 600, protein: 0, count: 1, updatedAt: '2026-05-23T08:00:00.000Z' },
      makeTombstone('e2')
    ];
    expect(activeEntries(entries).length).toBe(1);
    expect(totalCalories(entries)).toBe(600);
  });

  it('isStapleLogged is true once staple ref is logged', () => {
    const entries = [
      { id: 'e1', kind: 'staple' as const, refId: 'olive-oil', label: 'Olive Oil', calories: 600, protein: 0, count: 1, updatedAt: '2026-05-23T08:00:00.000Z' }
    ];
    expect(isStapleLogged(entries, 'olive-oil')).toBe(true);
    expect(isStapleLogged(entries, 'other')).toBe(false);
  });

  it('mergeEntries keeps newer tombstone over active entry', () => {
    const merged = mergeEntries(
      [makeTombstone('e1')],
      [{ id: 'e1', kind: 'custom', refId: null, label: 'Custom', calories: 400, protein: 20, count: 1, updatedAt: '2026-05-23T08:00:00.000Z' }]
    );
    expect(merged.length).toBe(1);
    expect('deleted' in merged[0] && merged[0].deleted).toBe(true);
    expect(activeEntries(merged).length).toBe(0);
  });
});

describe('tdee dates', () => {
  it('getCurrentLogDay before rollover hour counts as previous day', () => {
    const now = new Date(2026, 5, 17, 3, 30, 0);
    expect(getCurrentLogDay(now, 4)).toBe('2026-06-16');
  });

  it('getCurrentLogDay after rollover hour is same calendar day', () => {
    const now = new Date(2026, 5, 17, 10, 0, 0);
    expect(getCurrentLogDay(now, 4)).toBe('2026-06-17');
  });

  it('formatLogDay pads month and day', () => {
    expect(formatLogDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('tdee normalize fixture', () => {
  it('parses vault fixture with staples and entries', () => {
    const file = normalizeFile(fixture);
    expect(file.tdee).toBe(2500);
    expect(file.protein).toBe(80);
    expect(file.staples.length).toBeGreaterThan(0);
    expect(file.regulars.length).toBeGreaterThan(0);
    expect(file.entries.length).toBeGreaterThan(0);
  });
});
