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

const SettingsPage = () => (
  <div className="mx-auto max-w-3xl p-4 md:p-6">
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="alerts">Focus & alerts</TabsTrigger>
        <TabsTrigger value="posture">Posture</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="space-y-6">
        <SyncStatusCard />
        <ThemeSettingsCard />
        <StatsDaySettingsCard />
        <HabitsSettingsCard />
        <AppPresenceSettingsCard />
      </TabsContent>
      <TabsContent value="alerts" className="space-y-6">
        <SessionAlertSettingsCard surface="desktop" />
      </TabsContent>
      <TabsContent value="posture" className="space-y-6">
        <PostureDetectionSettingsCard />
        <PostureCameraSettingsCard />
      </TabsContent>
      <TabsContent value="about" className="space-y-6">
        <AppVersionCard />
        <UpdateSettingsCard />
      </TabsContent>
    </Tabs>
  </div>
);

export default SettingsPage;
