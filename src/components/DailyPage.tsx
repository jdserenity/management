// src/components/DailyPage.tsx

import DailyStretchSections from '@/components/daily/DailyStretchSections';
import TdeeSection from '@/components/daily/TdeeSection';
import StreakSection from '@/components/daily/StreakSection';

export default function DailyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:space-y-10">
      <DailyStretchSections />
      <TdeeSection />
      <StreakSection />
    </div>
  );
}
