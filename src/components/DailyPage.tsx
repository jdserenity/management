// src/components/DailyPage.tsx

import MorningStretchSection from '@/components/daily/MorningStretchSection';
import TrackerDeck from '@/components/daily/TrackerDeck';

export default function DailyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-x-hidden lg:space-y-10">
      <MorningStretchSection />
      <TrackerDeck />
    </div>
  );
}
