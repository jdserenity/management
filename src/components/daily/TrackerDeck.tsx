// src/components/daily/TrackerDeck.tsx

import { useRef, useState, type ReactNode } from 'react';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';
import './tracker-deck.css';

type PanelId = 'streak' | 'calories' | 'water';

const PANELS: PanelId[] = ['streak', 'calories', 'water'];

const PANEL_LABELS: Record<PanelId, string> = {
  streak: 'Habits',
  calories: 'Calories',
  water: 'Water'
};

const deckClass = (panel: PanelId, active: PanelId): string => {
  if (panel === active) return 'tracker-deck-card deck-active';
  const activeIdx = PANELS.indexOf(active);
  const panelIdx = PANELS.indexOf(panel);
  const leftIdx = (activeIdx - 1 + PANELS.length) % PANELS.length;
  const rightIdx = (activeIdx + 1) % PANELS.length;
  if (panelIdx === leftIdx) return 'tracker-deck-card deck-left';
  if (panelIdx === rightIdx) return 'tracker-deck-card deck-right';
  return 'tracker-deck-card';
};

export default function TrackerDeck() {
  const [active, setActive] = useState<PanelId>('streak');
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
    const activeIdx = PANELS.indexOf(active);
    if (delta > 50) {
      const leftIdx = (activeIdx - 1 + PANELS.length) % PANELS.length;
      setActive(PANELS[leftIdx]);
    } else if (delta < -50) {
      const rightIdx = (activeIdx + 1) % PANELS.length;
      setActive(PANELS[rightIdx]);
    }
  };

  const renderCard = (panel: PanelId, content: ReactNode) => {
    const cls = deckClass(panel, active);
    const isPeek = cls.includes('deck-left') || cls.includes('deck-right');
    return (
      <div
        key={panel}
        className={cls}
        onClick={isPeek ? () => setActive(panel) : undefined}
        role={isPeek ? 'button' : undefined}
        tabIndex={isPeek ? 0 : undefined}
        onKeyDown={isPeek ? (e) => { if (e.key === 'Enter' || e.key === ' ') setActive(panel); } : undefined}
        aria-label={isPeek ? `Show ${PANEL_LABELS[panel]}` : undefined}
      >
        <div className="tracker-deck-card-inner">{content}</div>
      </div>
    );
  };

  return (
    <div className="tracker-deck-wrap">
      <div className="tracker-deck-tabs" role="tablist" aria-label="Daily trackers">
        {PANELS.map((panel) => (
          <button
            key={panel}
            type="button"
            role="tab"
            aria-selected={active === panel}
            className={`tracker-deck-tab${active === panel ? ' tracker-deck-tab-active' : ''}`}
            onClick={() => setActive(panel)}
          >
            {PANEL_LABELS[panel]}
          </button>
        ))}
      </div>
      <div
        className="tracker-deck-outer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="tracker-deck">
          {renderCard('streak', <StreakSection onCrossLog={handleCrossLog} />)}
          {renderCard('calories', <TdeeSection refreshKey={tdeeRefreshKey} />)}
          {renderCard('water', <WaterSection refreshKey={waterRefreshKey} />)}
        </div>
      </div>
    </div>
  );
}
