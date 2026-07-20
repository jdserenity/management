import { describe, expect, it } from 'vitest';
import { findDropTargetId, moveIdBefore } from './reorder';

describe('moveIdBefore', () => {
  it('drops a later row onto an earlier one', () => {
    expect(moveIdBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('drops an earlier row onto a later one', () => {
    expect(moveIdBefore(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('returns null when nothing would change', () => {
    expect(moveIdBefore(['a', 'b'], 'a', 'a')).toBeNull();
    expect(moveIdBefore(['a', 'b'], 'z', 'a')).toBeNull();
  });
});

describe('findDropTargetId', () => {
  const rows = [
    { id: 'a', top: 0, bottom: 40 },
    { id: 'b', top: 40, bottom: 80 },
    { id: 'c', top: 80, bottom: 120 }
  ];

  it('returns the row under the pointer', () => {
    expect(findDropTargetId(10, rows)).toBe('a');
    expect(findDropTargetId(55, rows)).toBe('b');
    expect(findDropTargetId(100, rows)).toBe('c');
  });

  it('clamps above/below the list to the nearest end', () => {
    expect(findDropTargetId(-20, rows)).toBe('a');
    expect(findDropTargetId(200, rows)).toBe('c');
  });

  it('returns null for an empty list', () => {
    expect(findDropTargetId(10, [])).toBeNull();
  });
});
