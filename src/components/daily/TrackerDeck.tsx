// src/components/daily/TrackerDeck.tsx

import { useRef, useState, type ReactNode } from 'react';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import './tracker-deck.css';

type PanelId = 'streaks' | 'tdee' | 'water';

const PANEL_LABELS: Record<PanelId, string> = {
  streaks: 'Streaks',
  tdee: 'TDEE',
  water: 'Water'
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

  const renderPanel = (panel: PanelId, slot: 'left' | 'center' | 'right', content: ReactNode) => {
    const isFront = panel === active;
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
        <div className="tracker-deck-panel-body">{content}</div>
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
          {renderPanel('tdee', 'left', <TdeeSection refreshKey={tdeeRefreshKey} />)}
          {renderPanel('streaks', 'center', <StreakSection onCrossLog={handleCrossLog} />)}
          {renderPanel('water', 'right', <WaterSection refreshKey={waterRefreshKey} />)}
        </div>
      </div>
    </div>
  );
}
