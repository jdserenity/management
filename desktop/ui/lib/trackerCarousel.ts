/** Minimum horizontal touch travel (px) before a drag counts as a slide swipe instead of a tap/scroll. */
export const CAROUSEL_SWIPE_THRESHOLD_PX = 40;

/** Arrow / wrap navigation: step by ±1 and wrap (first←→last). Works for any slideCount ≥ 1. */
export const wrapSlideIndex = (current: number, step: number, slideCount: number): number => {
  if (slideCount <= 0) return 0;
  return ((current + step) % slideCount + slideCount) % slideCount;
};

/** Slide to show after a horizontal swipe; clamps at the ends instead of wrapping around. */
export const slideIndexForSwipe = (current: number, startX: number, endX: number, slideCount: number): number => {
  const delta = startX - endX;
  if (Math.abs(delta) < CAROUSEL_SWIPE_THRESHOLD_PX) return current;
  const next = delta > 0 ? current + 1 : current - 1;
  return Math.min(Math.max(next, 0), slideCount - 1);
};

/**
 * How far the track visually follows the finger during a drag, in pixels.
 * One-to-one mid-carousel; dragging past the first/last slide is damped
 * (rubber-banded) so the panel resists instead of sliding into empty space.
 */
export const carouselDragOffsetPx = (current: number, deltaX: number, slideCount: number): number => {
  const pastFirst = current === 0 && deltaX > 0;
  const pastLast = current === slideCount - 1 && deltaX < 0;
  return pastFirst || pastLast ? Math.round(deltaX * 0.35) : deltaX;
};
