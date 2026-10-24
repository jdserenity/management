import { useRef, useState, type TouchEvent } from 'react';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import MovementSnackSection from '@/components/daily/MovementSnackSection';
import { carouselDragOffsetPx, slideIndexForSwipe } from '@/lib/trackerCarousel';
import './tracker-carousel.css';

const SLIDE_COUNT = 3;
const SLIDE_LABELS = ['Food', 'Water', 'Build'];
/** Finger travel (px) before we decide whether a touch is a horizontal drag or a vertical scroll. */
const DIRECTION_LOCK_PX = 8;

type Props = {
  onTrackerLinkedTaskChange?: () => void;
};

/** Food, Water, and Build share one slot on Daily. Touch devices drag between them (the panel follows the finger); desktop gets minimal side arrows. All slides stay mounted so half-typed entries survive switching. */
export default function TrackerCarousel({ onTrackerLinkedTaskChange }: Props) {
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const touch = useRef<{ startX: number; startY: number; horizontal: boolean | null }>({ startX: 0, startY: 0, horizontal: null });
  const dragging = dragPx !== 0;

  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touch.current = { startX: t.clientX, startY: t.clientY, horizontal: null };
  };

  const handleTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touch.current.startX;
    const dy = t.clientY - touch.current.startY;
    if (touch.current.horizontal === null && (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX)) {
      // Commit to one direction per touch: horizontal drags move the panel,
      // vertical touches are page scrolls and must never flip the slide.
      touch.current.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (touch.current.horizontal) setDragPx(carouselDragOffsetPx(index, dx, SLIDE_COUNT));
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX;
    if (touch.current.horizontal && endX != null) {
      setIndex((i) => slideIndexForSwipe(i, touch.current.startX, endX, SLIDE_COUNT));
    }
    touch.current.horizontal = null;
    setDragPx(0);
  };

  return (
    <div className="tracker-carousel">
      <button
        type="button"
        className="tracker-carousel-arrow tracker-carousel-arrow-prev"
        aria-label="Switch panel"
        onClick={() => setIndex((i) => (i + 1) % SLIDE_COUNT)}
      >
        ‹
      </button>
      <div
        className="tracker-carousel-viewport"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="tracker-carousel-track"
          style={{
            transform: `translateX(calc(-${index * 100}% + ${dragPx}px))`,
            transition: dragging ? 'none' : undefined
          }}
        >
          <div className="tracker-carousel-slide" aria-hidden={index !== 0}>
            <TdeeSection onTrackerLinkedTaskChange={onTrackerLinkedTaskChange} />
          </div>
          <div className="tracker-carousel-slide" aria-hidden={index !== 1}>
            <WaterSection onTrackerLinkedTaskChange={onTrackerLinkedTaskChange} />
          </div>
          <div className="tracker-carousel-slide" aria-hidden={index !== 2}>
            <MovementSnackSection onTrackerLinkedTaskChange={onTrackerLinkedTaskChange} />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="tracker-carousel-arrow tracker-carousel-arrow-next"
        aria-label="Switch panel"
        onClick={() => setIndex((i) => (i + 1) % SLIDE_COUNT)}
      >
        ›
      </button>
      <div className="tracker-carousel-dots" role="tablist" aria-label="Daily trackers">
        {SLIDE_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === i}
            aria-label={`Show ${label}`}
            className={`tracker-carousel-dot${index === i ? ' tracker-carousel-dot-active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
