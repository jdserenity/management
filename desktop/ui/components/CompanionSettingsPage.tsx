import AppVersionCard from '@/components/settings/AppVersionCard';
import SyncStatusCard from '@/components/SyncStatusCard';
import StatsDaySettingsCard from '@/components/settings/StatsDaySettingsCard';
import HabitsSettingsCard from '@/components/settings/HabitsSettingsCard';
import SessionAlertSettingsCard from '@/components/settings/SessionAlertSettingsCard';
import { FEATURE_WORK } from '@/lib/features';

export default function CompanionSettingsPage() {
  return (
    <div className="plugin-page space-y-3">
      <SyncStatusCard />
      <StatsDaySettingsCard />
      {FEATURE_WORK ? <SessionAlertSettingsCard surface="companion" /> : null}
      <HabitsSettingsCard />
      <AppVersionCard />
    </div>
  );
}
