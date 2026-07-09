import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import FlowHeaderControl from '@/components/FlowHeaderControl';
import { cn } from '@/lib/utils';
import { companionNavItems, desktopNavItems, NAV_GO_TO_WORK, type NavItemDef } from '@/lib/navConfig';

type ShellVariant = 'desktop' | 'companion';

type MobileAppShellProps = {
  variant?: ShellVariant;
  headerEnd?: ComponentType;
};

const navForVariant = (variant: ShellVariant): NavItemDef[] =>
  variant === 'companion' ? companionNavItems() : desktopNavItems();

export default function MobileAppShell({ variant = 'desktop', headerEnd: HeaderEnd }: MobileAppShellProps) {
  const navItems = navForVariant(variant);
  const [activeComponentId, setActiveComponentId] = useState(navItems[0]?.id ?? 'daily');
  const ActiveComponent = navItems.find((item) => item.id === activeComponentId)?.component ?? navItems[0]!.component;
  const mainRef = useRef<HTMLElement>(null);

  const goToWork = () => setActiveComponentId('work');

  useEffect(() => {
    const onGoToWork = () => setActiveComponentId('work');
    window.addEventListener(NAV_GO_TO_WORK, onGoToWork);
    return () => window.removeEventListener(NAV_GO_TO_WORK, onGoToWork);
  }, []);

  const navigate = (id: string) => {
    setActiveComponentId(id);
    mainRef.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeComponentId]);

  if (variant === 'desktop') {
    return (
      <div className="plugin-shell">
        <header className="plugin-header">
          <nav className="plugin-nav" aria-label="Main">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('plugin-nav-btn', activeComponentId === item.id && 'plugin-nav-btn-active')}
                onClick={() => navigate(item.id)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <FlowHeaderControl onGoToWork={goToWork} />
        </header>
        <main ref={mainRef} className="plugin-main">
          <ActiveComponent />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header
        className="plugin-header sticky top-0 z-10 justify-between"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <h1 className="text-base font-bold tracking-tight">
          {navItems.find((item) => item.id === activeComponentId)?.label ?? 'Management'}
        </h1>
        <div className="flex items-center gap-2">
          {HeaderEnd ? <HeaderEnd /> : <FlowHeaderControl onGoToWork={goToWork} compact />}
        </div>
      </header>
      <main ref={mainRef} className="plugin-main">
        <Suspense fallback={<p className="plugin-empty">Loading…</p>}>
          <ActiveComponent />
        </Suspense>
      </main>
      <nav className="plugin-bottom-nav" aria-label="Main">
        <div className="mx-auto grid max-w-lg px-1 py-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn('plugin-bottom-nav-btn', activeComponentId === item.id && 'plugin-bottom-nav-btn-active')}
              onClick={() => navigate(item.id)}
            >
              <item.icon className={cn('h-5 w-5', activeComponentId === item.id && 'scale-110')} />
              <span className="truncate w-full text-center leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
