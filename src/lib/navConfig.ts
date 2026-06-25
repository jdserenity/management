import type { ComponentType } from 'react';
import { Sun, LayoutDashboard, BarChart3, SlidersHorizontal, Settings, Camera } from 'lucide-react';
import DailyPage from '@/components/DailyPage';
import Dashboard from '@/components/Dashboard';
import PosturePage from '@/components/PosturePage';
import StatsPage from '@/components/StatsPage';
import CustomizePage from '@/components/CustomizePage';
import SettingsPage from '@/components/SettingsPage';
import CompanionSettingsPage from '@/components/CompanionSettingsPage';

export type NavItemDef = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
};

const allNavItems: NavItemDef[] = [
  { id: 'daily', label: 'Daily', icon: Sun, component: DailyPage },
  { id: 'work', label: 'Work', icon: LayoutDashboard, component: Dashboard },
  { id: 'posture', label: 'Posture', icon: Camera, component: PosturePage },
  { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsPage },
  { id: 'customize', label: 'Customize', icon: SlidersHorizontal, component: CustomizePage },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsPage }
];

export const desktopNavItems = (): NavItemDef[] => allNavItems;

export const companionNavItems = (): NavItemDef[] =>
  allNavItems
    .filter((item) => item.id !== 'posture')
    .map((item) => (item.id === 'settings' ? { ...item, component: CompanionSettingsPage } : item));
