/** Minimum horizontal touch travel (px) before a drag counts as a slide swipe instead of a tap/scroll. */
export const CAROUSEL_SWIPE_THRESHOLD_PX = 40;

/** Slide to show after a horizontal swipe; clamps at the ends instead of wrapping around. */
export const slideIndexForSwipe = (current: number, startX: number, endX: number, slideCount: number): number => {
  const delta = startX - endX;
  if (Math.abs(delta) < CAROUSEL_SWIPE_THRESHOLD_PX) return current;
  const next = delta > 0 ? current + 1 : current - 1;
  return Math.min(Math.max(next, 0), slideCount - 1);
};
