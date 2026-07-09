import { describe, expect, it } from 'vitest';
import { activeEntries, makeEntry, makeTombstone } from '@/lib/water/entries';
import {
  entryMl,
  formatLitres,
  formatWaterLabel,
  litresToMl,
  mlToLitres,
  progressRatio,
  remainingDisplay,
  totalWater
} from '@/lib/water/totals';

describe('water totals', () => {
  it('totalWater sums entries with count', () => {
    expect(
      totalWater([
        { id: '1', label: 'glass', ml: 250, count: 1, updatedAt: 'x' },
        { id: '2', label: 'bottle', ml: 500, count: 2, updatedAt: 'x' }
      ])
    ).toBe(1250);
  });

  it('entryMl defaults count to 1', () => {
    expect(entryMl({ id: '1', label: 'glass', ml: 300, count: 1, updatedAt: 'x' })).toBe(300);
  });

  it('progressRatio caps at 1', () => {
    expect(progressRatio(3000, 2500)).toBe(1);
    expect(progressRatio(1250, 2500)).toBe(0.5);
  });

  it('remainingDisplay shows remaining ml under target', () => {
    const d = remainingDisplay(2000, 2500);
    expect(d.text).toBe('500 ml remaining');
    expect(d.extraClass).toBe('');
  });

  it('remainingDisplay marks exact goal as success (green)', () => {
    const d = remainingDisplay(2500, 2500);
    expect(d.text).toBe('0 ml remaining');
    expect(d.extraClass).toBe(' water-remaining-done');
  });

  it('remainingDisplay celebrates surplus over target', () => {
    const d = remainingDisplay(2800, 2500);
    expect(d.text).toBe('💧 300 ml over target');
    expect(d.extraClass).toBe(' water-remaining-surplus');
  });

  it('formatWaterLabel uses L for round liters', () => {
    expect(formatWaterLabel(1000)).toBe('1 L');
    expect(formatWaterLabel(250)).toBe('250 ml');
  });

  it('formatLitres shows daily totals and goals in litres', () => {
    expect(formatLitres(2000)).toBe('2 L');
    expect(formatLitres(2500)).toBe('2.5 L');
    expect(formatLitres(1250)).toBe('1.25 L');
  });

  it('litresToMl and mlToLitres round-trip storage', () => {
    expect(litresToMl(2.5)).toBe(2500);
    expect(mlToLitres(2500)).toBe(2.5);
  });

  it('activeEntries filters tombstones', () => {
    const entries = [
      makeEntry({ label: 'a', ml: 100 }),
      makeTombstone('gone')
    ];
    expect(activeEntries(entries)).toHaveLength(1);
  });
});
