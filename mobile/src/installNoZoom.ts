/**
 * Active zoom blocking for the companion PWA.
 * The viewport meta + touch-action CSS are only hints — iOS Safari ignores
 * user-scalable=no, so pinch zoom still happens unless the zoom gestures
 * themselves are swallowed here. Scrolling and one-finger drags pass through.
 */
export const preventDefault = (e: Event): void => { e.preventDefault(); };

export const isMultiTouchZoom = (e: TouchEvent): boolean => e.touches.length > 1;

export const installNoZoom = (doc: Document = document): void => {
  // iOS pinch-zoom fires these proprietary gesture events before any touch scrolling.
  doc.addEventListener('gesturestart', preventDefault);
  doc.addEventListener('gesturechange', preventDefault);
  doc.addEventListener('gestureend', preventDefault);
  // Android Chrome pinch: a touchmove with two fingers down. Must be
  // non-passive or the browser ignores preventDefault and zooms anyway.
  doc.addEventListener('touchmove', (e: TouchEvent) => { if (isMultiTouchZoom(e)) e.preventDefault(); }, { passive: false });
  // Desktop-browser PWA windows: ctrl+wheel and ctrl +/-/0 zoom.
  doc.addEventListener('wheel', (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  doc.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
};
