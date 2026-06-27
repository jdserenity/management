// src/components/DailyPage.tsx

import { useState } from 'react';
import MorningStretchSection from '@/components/daily/MorningStretchSection';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';

export default function DailyPage() {
  const [tdeeRefreshKey, setTdeeRefreshKey] = useState(0);
  const [waterRefreshKey, setWaterRefreshKey] = useState(0);

  const handleCrossLog = (kind: 'tdee' | 'water') => {
    if (kind === 'tdee') setTdeeRefreshKey((k) => k + 1);
    if (kind === 'water') setWaterRefreshKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:space-y-10">
      <MorningStretchSection />
      <StreakSection onCrossLog={handleCrossLog} />
      <TdeeSection refreshKey={tdeeRefreshKey} />
      <WaterSection refreshKey={waterRefreshKey} />
    </div>
  );
}
