// src/components/daily/TrackerDeck.tsx

import { useRef, useState, type ReactNode } from 'react';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import './tracker-deck.css';

type PanelId = 'streaks' | 'tdee' | 'water';

type DeckSlot = 'left' | 'center' | 'right';

const PANEL_LABELS: Record<PanelId, string> = {
  streaks: 'Streaks',
  tdee: 'TDEE',
  water: 'Water'
};

/** Fixed positions — panels never move, only z-index/opacity changes. */
const PANEL_SLOT: Record<PanelId, DeckSlot> = {
  tdee: 'left',
  streaks: 'center',
  water: 'right'
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
    if (delta > 50) setActive('tdee');
    else if (delta < -50) setActive('water');
  };

  const renderPanel = (panel: PanelId, content: ReactNode) => {
    const isFront = panel === active;
    const slot = PANEL_SLOT[panel];
    return (
      <div
        key={panel}
        className={`tracker-deck-panel deck-slot-${slot}${isFront ? ' deck-front' : ' deck-back'}`}
      >
        {!isFront ? (
          <button
            type="button"
            className="tracker-deck-hit"
            aria-label={`Bring ${PANEL_LABELS[panel]} to front`}
            onClick={() => setActive(panel)}
          />
        ) : null}
        {content}
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
          {renderPanel('tdee', <TdeeSection refreshKey={tdeeRefreshKey} />)}
          {renderPanel('streaks', <StreakSection onCrossLog={handleCrossLog} />)}
          {renderPanel('water', <WaterSection refreshKey={waterRefreshKey} />)}
        </div>
      </div>
    </div>
  );
}
