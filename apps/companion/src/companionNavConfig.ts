import type { ComponentType } from 'react';
import { Sun, LayoutDashboard, BarChart3, SlidersHorizontal, Settings } from 'lucide-react';
import DailyPage from '@/components/DailyPage';
import Dashboard from '@/components/Dashboard';
import StatsPage from '@/components/StatsPage';
import CustomizePage from '@/components/CustomizePage';
import CompanionSettingsPage from '@/components/CompanionSettingsPage';

export type NavItemDef = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
};

export const companionNavItems = (): NavItemDef[] => [
  { id: 'daily', label: 'Daily', icon: Sun, component: DailyPage },
  { id: 'work', label: 'Work', icon: LayoutDashboard, component: Dashboard },
  { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsPage },
  { id: 'customize', label: 'Customize', icon: SlidersHorizontal, component: CustomizePage },
  { id: 'settings', label: 'Settings', icon: Settings, component: CompanionSettingsPage }
];

// Companion build never uses desktop nav; stub avoids importing PosturePage / Tauri-only pages.
export const desktopNavItems = (): NavItemDef[] => companionNavItems();

export const NAV_GO_TO_WORK = 'mgmt-nav-go-to-work';

export const requestGoToWorkTab = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NAV_GO_TO_WORK));
};
