// src/components/DailyPage.tsx

import { useState } from 'react';
import BrandWordmark from '@/components/daily/BrandWordmark';
import DailyStretchSections from '@/components/daily/DailyStretchSections';
import StreakSection from '@/components/daily/StreakSection';
import TrackerCarousel from '@/components/daily/TrackerCarousel';

export default function DailyPage() {
  const [streakRefreshKey, setStreakRefreshKey] = useState(0);
  const [unbrokenChainActive, setUnbrokenChainActive] = useState(false);

  const handleTrackerLinkedTaskChange = () => {
    setStreakRefreshKey((k) => k + 1);
  };

  return (
    <div className="plugin-page">
      <BrandWordmark unbrokenChain={unbrokenChainActive} />
      <DailyStretchSections />
      <StreakSection
        refreshKey={streakRefreshKey}
        onUnbrokenChainModeChange={setUnbrokenChainActive}
        trackerWidget={<TrackerCarousel onTrackerLinkedTaskChange={handleTrackerLinkedTaskChange} />}
      />
    </div>
  );
}
