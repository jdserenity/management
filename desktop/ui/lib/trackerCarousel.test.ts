import { describe, expect, it } from 'vitest';
import { carouselDragOffsetPx, slideIndexForSwipe } from '@/lib/trackerCarousel';

describe('slideIndexForSwipe', () => {
  it('swiping left advances to the next slide and swiping right goes back', () => {
    expect(slideIndexForSwipe(0, 200, 100, 2)).toBe(1);
    expect(slideIndexForSwipe(1, 100, 200, 2)).toBe(0);
    expect(slideIndexForSwipe(1, 200, 100, 3)).toBe(2);
    expect(slideIndexForSwipe(2, 100, 200, 3)).toBe(1);
  });

  it('ignores small drags that were probably taps or scrolls', () => {
    expect(slideIndexForSwipe(0, 200, 170, 2)).toBe(0);
    expect(slideIndexForSwipe(1, 100, 130, 2)).toBe(1);
  });

  it('clamps at the first and last slide instead of wrapping around', () => {
    expect(slideIndexForSwipe(0, 100, 200, 2)).toBe(0);
    expect(slideIndexForSwipe(1, 200, 100, 2)).toBe(1);
    expect(slideIndexForSwipe(0, 100, 200, 3)).toBe(0);
    expect(slideIndexForSwipe(2, 200, 100, 3)).toBe(2);
  });
});

describe('carouselDragOffsetPx', () => {
  it('follows the finger one-to-one in the middle of the carousel', () => {
    expect(carouselDragOffsetPx(0, -60, 2)).toBe(-60);
    expect(carouselDragOffsetPx(1, 60, 2)).toBe(60);
    expect(carouselDragOffsetPx(1, -40, 3)).toBe(-40);
  });

  it('rubber-bands past the first and last slide so the panel resists instead of flying away', () => {
    expect(carouselDragOffsetPx(0, 100, 2)).toBe(35);
    expect(carouselDragOffsetPx(1, -100, 2)).toBe(-35);
    expect(carouselDragOffsetPx(2, -100, 3)).toBe(-35);
  });
});
