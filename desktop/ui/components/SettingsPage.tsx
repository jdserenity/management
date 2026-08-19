import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SyncStatusCard from '@/components/SyncStatusCard';
import ThemeSettingsCard from '@/components/settings/ThemeSettingsCard';
import StatsDaySettingsCard from '@/components/settings/StatsDaySettingsCard';
import HabitsSettingsCard from '@/components/settings/HabitsSettingsCard';
import AppPresenceSettingsCard from '@/components/settings/AppPresenceSettingsCard';
import SessionAlertSettingsCard from '@/components/settings/SessionAlertSettingsCard';
import PostureDetectionSettingsCard from '@/components/settings/PostureDetectionSettingsCard';
import PostureCameraSettingsCard from '@/components/settings/PostureCameraSettingsCard';
import AppVersionCard from '@/components/settings/AppVersionCard';
import UpdateSettingsCard from '@/components/settings/UpdateSettingsCard';
import { FEATURE_POSTURE, FEATURE_WORK } from '@/lib/features';
import { SETTINGS_TAB_LABELS, desktopSettingsTabs } from '@/lib/settingsPageLayout';

const SettingsPage = () => {
  const tabs = desktopSettingsTabs();
  return (
    <div className="plugin-page">
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((id) => (
            <TabsTrigger key={id} value={id}>{SETTINGS_TAB_LABELS[id]}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general" className="space-y-3">
          <SyncStatusCard />
          <ThemeSettingsCard />
          <StatsDaySettingsCard />
          <HabitsSettingsCard />
          <AppPresenceSettingsCard />
        </TabsContent>
        {FEATURE_WORK ? (
          <TabsContent value="alerts" className="space-y-3">
            <SessionAlertSettingsCard surface="desktop" />
          </TabsContent>
        ) : null}
        {FEATURE_POSTURE ? (
          <TabsContent value="posture" className="space-y-3">
            <PostureDetectionSettingsCard />
            <PostureCameraSettingsCard />
          </TabsContent>
        ) : null}
        <TabsContent value="about" className="space-y-3">
          <AppVersionCard />
          <UpdateSettingsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
