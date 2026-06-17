// src/components/DailyPage.tsx

import TdeeSection from '@/components/daily/TdeeSection';
import StreakSection from '@/components/daily/StreakSection';

export default function DailyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <TdeeSection />
      <StreakSection />
    </div>
  );
}
