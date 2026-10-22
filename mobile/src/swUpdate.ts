/**
 * Force the companion's service worker (the offline cache that serves the
 * installed app) to look for a new deployed version: on boot, whenever the
 * app comes back to the foreground, and every 15 minutes. Without this,
 * installed PWAs can serve a stale build for days — new fixes deploy but the
 * phone never picks them up. When a new version is found, the autoUpdate
 * registration activates it and reloads the page on its own.
 */
export const checkForServiceWorkerUpdate = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
  } catch {
    /* no service worker (dev / unsupported browser) — nothing to update */
  }
};

export const installServiceWorkerUpdateChecks = (intervalMs = 15 * 60 * 1000): void => {
  void checkForServiceWorkerUpdate();
  setInterval(() => { void checkForServiceWorkerUpdate(); }, intervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForServiceWorkerUpdate();
  });
};
