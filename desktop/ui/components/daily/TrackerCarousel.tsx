import { useRef, useState, type TouchEvent } from 'react';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import { slideIndexForSwipe } from '@/lib/trackerCarousel';
import './tracker-carousel.css';

const SLIDES = [
  { id: 'food', label: 'Food' },
  { id: 'water', label: 'Water' }
] as const;

type Props = {
  onTrackerLinkedTaskChange?: () => void;
};

/** Food and Water share one slot on Daily; swipe (or tap the labels/dots) to switch between them. Both slides stay mounted so half-typed entries survive switching. */
export default function TrackerCarousel({ onTrackerLinkedTaskChange }: Props) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX != null) setIndex((i) => slideIndexForSwipe(i, touchStartX.current!, endX, SLIDES.length));
    touchStartX.current = null;
  };

  return (
    <div className="tracker-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="tracker-carousel-tabs" role="tablist" aria-label="Food and water">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={index === i}
            className={`tracker-carousel-tab${index === i ? ' tracker-carousel-tab-active' : ''}`}
            onClick={() => setIndex(i)}
          >
            {slide.label}
          </button>
        ))}
        <span className="tracker-carousel-dots" aria-hidden>
          {SLIDES.map((slide, i) => (
            <span key={slide.id} className={`tracker-carousel-dot${index === i ? ' tracker-carousel-dot-active' : ''}`} />
          ))}
        </span>
      </div>
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
    </div>
  );
}
