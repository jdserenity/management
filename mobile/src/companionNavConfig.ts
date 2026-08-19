import { lazy, type ComponentType } from 'react';
import { Sun, LayoutDashboard, BarChart3, SlidersHorizontal, Settings } from 'lucide-react';
import { FEATURE_WORK, isNavFeatureEnabled } from '@/lib/features';

export type NavItemDef = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
};

const DailyPage = lazy(() => import('@/components/DailyPage'));
const Dashboard = lazy(() => import('@/components/Dashboard'));
const StatsPage = lazy(() => import('@/components/StatsPage'));
const CustomizePage = lazy(() => import('@/components/CustomizePage'));
const CompanionSettingsPage = lazy(() => import('@/components/CompanionSettingsPage'));

export const companionNavItems = (): NavItemDef[] =>
  [
    { id: 'daily', label: 'Daily', icon: Sun, component: DailyPage },
    { id: 'work', label: 'Work', icon: LayoutDashboard, component: Dashboard },
    { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsPage },
    { id: 'customize', label: 'Customize', icon: SlidersHorizontal, component: CustomizePage },
    { id: 'settings', label: 'Settings', icon: Settings, component: CompanionSettingsPage }
  ].filter((item) => isNavFeatureEnabled(item.id));

// Companion build never uses desktop nav; stub avoids importing PosturePage / Tauri-only pages.
export const desktopNavItems = (): NavItemDef[] => companionNavItems();

export const NAV_GO_TO_WORK = 'mgmt-nav-go-to-work';

export const requestGoToWorkTab = (): void => {
  if (!FEATURE_WORK) return;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NAV_GO_TO_WORK));
};
