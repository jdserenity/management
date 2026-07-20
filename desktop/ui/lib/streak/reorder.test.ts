import { describe, expect, it } from 'vitest';
import { moveIdBefore, moveIdInOrder } from './reorder';

describe('moveIdInOrder', () => {
  it('moves an id down by one', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('moves an id up by one', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
  });

  it('returns null at the ends or for unknown ids', () => {
    expect(moveIdInOrder(['a', 'b'], 'a', -1)).toBeNull();
    expect(moveIdInOrder(['a', 'b'], 'b', 1)).toBeNull();
    expect(moveIdInOrder(['a', 'b'], 'z', 1)).toBeNull();
  });
});

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
