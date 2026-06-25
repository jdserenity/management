import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import Dashboard from '@/components/Dashboard';
import DailyPage from '@/components/DailyPage';
import PosturePage from '@/components/PosturePage';
import CustomizePage from '@/components/CustomizePage';
import StatsPage from '@/components/StatsPage';
import SettingsPage from '@/components/SettingsPage';
import FlowHeaderControl from '@/components/FlowHeaderControl';
import { LayoutDashboard, Camera, Settings, SlidersHorizontal, BarChart3, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
};

const navItems: NavItem[] = [
  { id: 'daily', label: 'Daily', icon: Sun, component: DailyPage },
  { id: 'work', label: 'Work', icon: LayoutDashboard, component: Dashboard },
  { id: 'posture', label: 'Posture', icon: Camera, component: PosturePage },
  { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsPage },
  { id: 'customize', label: 'Customize', icon: SlidersHorizontal, component: CustomizePage },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsPage },
];

const AppShell = () => {
  const { t } = useTranslation();
  const [activeComponentId, setActiveComponentId] = useState('daily');
  const ActiveComponent = navItems.find((item) => item.id === activeComponentId)?.component || DailyPage;
  const mainRef = useRef<HTMLElement>(null);

  const goToWork = () => setActiveComponentId('work');

  const navigate = (id: string) => {
    setActiveComponentId(id);
    mainRef.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeComponentId]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 md:px-4">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Main">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeComponentId === item.id ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-2"
              onClick={() => navigate(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {t(`nav.${item.id}`, item.label)}
            </Button>
          ))}
        </nav>
        <FlowHeaderControl onGoToWork={goToWork} />
      </header>
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
        <ActiveComponent />
      </main>
    </div>
  );
};

export default AppShell;
