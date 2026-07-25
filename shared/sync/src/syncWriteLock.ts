/** Mutual exclusion for syncable SQLite writes (hydrate vs user mutations). */

let writeLockTail: Promise<void> = Promise.resolve();

/**
 * Run `fn` while holding the data-sync write lock.
 * Concurrent callers queue; nested calls are not supported (hydrate must use the raw DB).
 */
export const withDataSyncWriteLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  let release!: () => void;
  const waitForTurn = writeLockTail;
  writeLockTail = new Promise<void>((resolve) => { release = resolve; });
  await waitForTurn;
  try {
    return await fn();
  } finally {
    release();
  }
};
