import { describe, expect, it } from 'vitest';
import { findInsertIndex, moveIdToInsertIndex } from './reorder';

describe('moveIdToInsertIndex', () => {
  it('moves a later row earlier', () => {
    expect(moveIdToInsertIndex(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
  });

  it('moves an earlier row later', () => {
    expect(moveIdToInsertIndex(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves into the middle', () => {
    expect(moveIdToInsertIndex(['a', 'b', 'c', 'd'], 'd', 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveIdToInsertIndex(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('returns null when nothing would change', () => {
    expect(moveIdToInsertIndex(['a', 'b', 'c'], 'b', 1)).toBeNull();
    expect(moveIdToInsertIndex(['a', 'b'], 'a', 0)).toBeNull();
    expect(moveIdToInsertIndex(['a', 'b'], 'z', 0)).toBeNull();
  });
});

describe('findInsertIndex', () => {
  const rows = [
    { id: 'a', top: 0, bottom: 40 },
    { id: 'b', top: 40, bottom: 80 },
    { id: 'c', top: 80, bottom: 120 }
  ];

  it('returns 0 above the first other midpoint while dragging b', () => {
    expect(findInsertIndex(10, rows, 'b')).toBe(0); // above a's mid (20)
  });

  it('returns after a when past a mid but before c mid while dragging b', () => {
    expect(findInsertIndex(30, rows, 'b')).toBe(1); // past a mid → between a and c → index 1 among [a,c]
    expect(findInsertIndex(90, rows, 'b')).toBe(1); // before c mid (100)
    expect(findInsertIndex(110, rows, 'b')).toBe(2); // past c mid → end
  });

  it('works when dragging the first or last row', () => {
    // Dragging a: others are b (mid 60) and c (mid 100).
    expect(findInsertIndex(50, rows, 'a')).toBe(0);
    expect(findInsertIndex(70, rows, 'a')).toBe(1);
    expect(findInsertIndex(100, rows, 'a')).toBe(2);
    // Dragging c: others are a (mid 20) and b (mid 60).
    expect(findInsertIndex(10, rows, 'c')).toBe(0);
    expect(findInsertIndex(50, rows, 'c')).toBe(1);
    expect(findInsertIndex(100, rows, 'c')).toBe(2);
  });
  it('returns 0 for an empty others list', () => {
    expect(findInsertIndex(10, [{ id: 'only', top: 0, bottom: 40 }], 'only')).toBe(0);
  });
});
