import AppVersionCard from '@/components/settings/AppVersionCard';
import SyncStatusCard from '@/components/SyncStatusCard';
import StatsDaySettingsCard from '@/components/settings/StatsDaySettingsCard';
import HabitsSettingsCard from '@/components/settings/HabitsSettingsCard';
import SessionAlertSettingsCard from '@/components/settings/SessionAlertSettingsCard';

export default function CompanionSettingsPage() {
  return (
    <div className="plugin-page space-y-3">
      <SyncStatusCard />
      <StatsDaySettingsCard />
      <SessionAlertSettingsCard surface="companion" />
      <HabitsSettingsCard />
      <AppVersionCard />
    </div>
  );
}
