// src/components/daily/TrackerDeck.tsx

import { useRef, useState, type ReactNode } from 'react';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import './tracker-deck.css';

type PanelId = 'streaks' | 'tdee' | 'water';

type DeckSide = 'center' | 'left' | 'right';

const PANEL_LABELS: Record<PanelId, string> = {
  streaks: 'Streaks',
  tdee: 'TDEE',
  water: 'Water'
};

/** Which panels peek left/right when a given panel is centered. */
const PEEK_SIDES: Record<PanelId, { left: PanelId; right: PanelId }> = {
  streaks: { left: 'tdee', right: 'water' },
  tdee: { left: 'streaks', right: 'water' },
  water: { left: 'tdee', right: 'streaks' }
};

const deckSide = (panel: PanelId, active: PanelId): DeckSide => {
  if (panel === active) return 'center';
  const sides = PEEK_SIDES[active];
  if (panel === sides.left) return 'left';
  if (panel === sides.right) return 'right';
  return 'center';
};

export default function TrackerDeck() {
  const [active, setActive] = useState<PanelId>('streaks');
  const [tdeeRefreshKey, setTdeeRefreshKey] = useState(0);
  const [waterRefreshKey, setWaterRefreshKey] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const handleCrossLog = (kind: 'tdee' | 'water') => {
    if (kind === 'tdee') setTdeeRefreshKey((k) => k + 1);
    if (kind === 'water') setWaterRefreshKey((k) => k + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const delta = end - start;
    const sides = PEEK_SIDES[active];
    if (delta > 50) setActive(sides.left);
    else if (delta < -50) setActive(sides.right);
  };

  const renderCard = (panel: PanelId, content: ReactNode) => {
    const side = deckSide(panel, active);
    const isPeek = side === 'left' || side === 'right';
    return (
      <div
        key={panel}
        className={`tracker-deck-card deck-${side}`}
        onClick={isPeek ? () => setActive(panel) : undefined}
        role={isPeek ? 'button' : undefined}
        tabIndex={isPeek ? 0 : undefined}
        onKeyDown={isPeek ? (e) => { if (e.key === 'Enter' || e.key === ' ') setActive(panel); } : undefined}
        aria-label={isPeek ? `Show ${PANEL_LABELS[panel]}` : undefined}
      >
        {isPeek ? <div className="tracker-deck-peek-label">{PANEL_LABELS[panel]}</div> : null}
        <div className={`tracker-deck-card-inner${isPeek ? ' tracker-deck-card-inner-hidden' : ''}`}>{content}</div>
      </div>
    );
  };

  return (
    <div className="tracker-deck-wrap">
      <div
        className="tracker-deck-outer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="tracker-deck">
          {renderCard('streaks', <StreakSection onCrossLog={handleCrossLog} />)}
          {renderCard('tdee', <TdeeSection refreshKey={tdeeRefreshKey} />)}
          {renderCard('water', <WaterSection refreshKey={waterRefreshKey} />)}
        </div>
      </div>
    </div>
  );
}
