import { useRef, useState, type TouchEvent } from 'react';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import { slideIndexForSwipe } from '@/lib/trackerCarousel';
import './tracker-carousel.css';

const SLIDE_COUNT = 2;

type Props = {
  onTrackerLinkedTaskChange?: () => void;
};

/** Food and Water share one slot on Daily. Touch devices swipe between them; desktop gets minimal side arrows. Both slides stay mounted so half-typed entries survive switching. */
export default function TrackerCarousel({ onTrackerLinkedTaskChange }: Props) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX != null) setIndex((i) => slideIndexForSwipe(i, touchStartX.current!, endX, SLIDE_COUNT));
    touchStartX.current = null;
  };

  return (
    <div className="tracker-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <button
        type="button"
        className="tracker-carousel-arrow tracker-carousel-arrow-prev"
        aria-label="Previous panel"
        disabled={index === 0}
        onClick={() => setIndex((i) => Math.max(0, i - 1))}
      >
        ‹
      </button>
      <div className="tracker-carousel-viewport">
        <div className="tracker-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          <div className="tracker-carousel-slide" aria-hidden={index !== 0}>
            <TdeeSection onTrackerLinkedTaskChange={onTrackerLinkedTaskChange} />
          </div>
          <div className="tracker-carousel-slide" aria-hidden={index !== 1}>
            <WaterSection onTrackerLinkedTaskChange={onTrackerLinkedTaskChange} />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="tracker-carousel-arrow tracker-carousel-arrow-next"
        aria-label="Next panel"
        disabled={index === SLIDE_COUNT - 1}
        onClick={() => setIndex((i) => Math.min(SLIDE_COUNT - 1, i + 1))}
      >
        ›
      </button>
    </div>
  );
}
