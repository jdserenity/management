// src/components/DailyPage.tsx

import { useState } from 'react';
import BrandWordmark from '@/components/daily/BrandWordmark';
import DailyStretchSections from '@/components/daily/DailyStretchSections';
import MovementSnackSection from '@/components/daily/MovementSnackSection';
import StreakSection from '@/components/daily/StreakSection';
import TdeeSection from '@/components/daily/TdeeSection';
import WaterSection from '@/components/daily/WaterSection';

export default function DailyPage() {
  const [streakRefreshKey, setStreakRefreshKey] = useState(0);

  const handleAutomaticTaskChange = () => {
    setStreakRefreshKey((k) => k + 1);
  };

  return (
    <div className="plugin-page">
      <BrandWordmark />
      <DailyStretchSections />
      <StreakSection refreshKey={streakRefreshKey} />
      <TdeeSection onAutomaticTaskChange={handleAutomaticTaskChange} />
      <WaterSection onAutomaticTaskChange={handleAutomaticTaskChange} />
      <MovementSnackSection onAutomaticTaskChange={handleAutomaticTaskChange} />
    </div>
  );
}
