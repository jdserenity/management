import AppVersionCard from '@/components/settings/AppVersionCard';
import SyncStatusCard from '@/components/SyncStatusCard';
import StatsDaySettingsCard from '@/components/settings/StatsDaySettingsCard';
import HabitsSettingsCard from '@/components/settings/HabitsSettingsCard';
import SessionAlertSettingsCard from '@/components/settings/SessionAlertSettingsCard';

export default function CompanionSettingsPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <SyncStatusCard />
      <StatsDaySettingsCard />
      <SessionAlertSettingsCard surface="companion" />
      <HabitsSettingsCard />
      <AppVersionCard />
    </div>
  );
}
