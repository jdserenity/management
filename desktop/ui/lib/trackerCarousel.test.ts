import { describe, expect, it } from 'vitest';
import { slideIndexForSwipe } from '@/lib/trackerCarousel';

describe('slideIndexForSwipe', () => {
  it('swiping left advances to the next slide and swiping right goes back', () => {
    expect(slideIndexForSwipe(0, 200, 100, 2)).toBe(1);
    expect(slideIndexForSwipe(1, 100, 200, 2)).toBe(0);
  });

  it('ignores small drags that were probably taps or scrolls', () => {
    expect(slideIndexForSwipe(0, 200, 170, 2)).toBe(0);
    expect(slideIndexForSwipe(1, 100, 130, 2)).toBe(1);
  });

  it('clamps at the first and last slide instead of wrapping around', () => {
    expect(slideIndexForSwipe(0, 100, 200, 2)).toBe(0);
    expect(slideIndexForSwipe(1, 200, 100, 2)).toBe(1);
  });
});
