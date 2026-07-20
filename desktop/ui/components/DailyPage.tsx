// src/components/DailyPage.tsx

import { useState } from 'react';
import BrandWordmark from '@/components/daily/BrandWordmark';
import DailyStretchSections from '@/components/daily/DailyStretchSections';
import MovementSnackSection from '@/components/daily/MovementSnackSection';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';

export default function DailyPage() {
  const [tdeeRefreshKey, setTdeeRefreshKey] = useState(0);
  const [waterRefreshKey, setWaterRefreshKey] = useState(0);
  const [streakRefreshKey, setStreakRefreshKey] = useState(0);

  const handleCrossLog = (kind: 'tdee' | 'water' | 'movement') => {
    if (kind === 'tdee') setTdeeRefreshKey((k) => k + 1);
    if (kind === 'water') setWaterRefreshKey((k) => k + 1);
    // Movement burst list lives in SessionContext — no key needed; streak already updated.
  };

  const handleLinkedTaskComplete = () => {
    setStreakRefreshKey((k) => k + 1);
  };

  return (
    <div className="plugin-page space-y-6 lg:space-y-8">
      <BrandWordmark />
      <DailyStretchSections />
      <StreakSection refreshKey={streakRefreshKey} onCrossLog={handleCrossLog} />
      <TdeeSection refreshKey={tdeeRefreshKey} onLinkedTaskComplete={handleLinkedTaskComplete} />
      <WaterSection refreshKey={waterRefreshKey} onLinkedTaskComplete={handleLinkedTaskComplete} />
      <MovementSnackSection onLinkedTaskComplete={handleLinkedTaskComplete} />
    </div>
  );
}
