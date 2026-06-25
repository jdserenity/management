import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import FlowHeaderControl from '@/components/FlowHeaderControl';
import { cn } from '@/lib/utils';
import { companionNavItems, desktopNavItems, type NavItemDef } from '@/lib/navConfig';
import { useTranslation } from 'react-i18next';

type ShellVariant = 'desktop' | 'companion';

type MobileAppShellProps = {
  variant?: ShellVariant;
  headerEnd?: ComponentType;
};

const navForVariant = (variant: ShellVariant): NavItemDef[] =>
  variant === 'companion' ? companionNavItems() : desktopNavItems();

export default function MobileAppShell({ variant = 'desktop', headerEnd: HeaderEnd }: MobileAppShellProps) {
  const { t } = useTranslation();
  const navItems = navForVariant(variant);
  const [activeComponentId, setActiveComponentId] = useState(navItems[0]?.id ?? 'daily');
  const ActiveComponent = navItems.find((item) => item.id === activeComponentId)?.component ?? navItems[0]!.component;
  const mainRef = useRef<HTMLElement>(null);

  const goToWork = () => setActiveComponentId('work');

  const navigate = (id: string) => {
    setActiveComponentId(id);
    mainRef.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeComponentId]);

  if (variant === 'desktop') {
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
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-sm font-semibold tracking-tight">
          {navItems.find((item) => item.id === activeComponentId)?.label ?? 'Management'}
        </h1>
        <div className="flex items-center gap-2">
          {HeaderEnd ? <HeaderEnd /> : <FlowHeaderControl onGoToWork={goToWork} compact />}
        </div>
      </header>
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ActiveComponent />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 pb-[env(safe-area-inset-bottom)]"
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors',
                activeComponentId === item.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => navigate(item.id)}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
