/** How often desktop and companion pull habit/stats snapshots while the app is open. */
export const DEFAULT_USER_DATA_POLL_INTERVAL_MS = 5000;

export type UserDataPollingOpts = {
  pull: () => void | Promise<void>;
  intervalMs?: number;
  /** Skip a tick when this returns false (e.g. before local storage bootstrap finishes). */
  shouldPoll?: () => boolean;
};

/** Periodic server pull; skips overlapping ticks and coalesces in-flight requests. */
export const startUserDataPolling = (opts: UserDataPollingOpts): (() => void) => {
  const intervalMs = opts.intervalMs ?? DEFAULT_USER_DATA_POLL_INTERVAL_MS;
  let inFlight = false;
  const tick = () => {
    if (opts.shouldPoll && !opts.shouldPoll()) return;
    if (inFlight) return;
    inFlight = true;
    void Promise.resolve(opts.pull()).finally(() => { inFlight = false; });
  };
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
};
