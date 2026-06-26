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

/** Side slots when a given panel is in front. */
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
    const isBack = side === 'left' || side === 'right';
    return (
      <div
        key={panel}
        className={`tracker-deck-card deck-${side}`}
        onClick={isBack ? () => setActive(panel) : undefined}
        role={isBack ? 'button' : undefined}
        tabIndex={isBack ? 0 : undefined}
        onKeyDown={isBack ? (e) => { if (e.key === 'Enter' || e.key === ' ') setActive(panel); } : undefined}
        aria-label={isBack ? `Bring ${PANEL_LABELS[panel]} to front` : undefined}
      >
        <div className="tracker-deck-card-inner">{content}</div>
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
