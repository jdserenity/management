let resolveSyncBootstrap: (() => void) | null = null;
let syncBootstrapGate: Promise<void>;

export const resetDataSyncBootstrapForTests = (): void => {
  syncBootstrapGate = new Promise<void>((resolve) => { resolveSyncBootstrap = resolve; });
};

resetDataSyncBootstrapForTests();

/** Debounced pushes wait until startup pull/merge finishes. */
export const awaitDataSyncBootstrap = (): Promise<void> => syncBootstrapGate;

export const finishDataSyncBootstrap = (): void => {
  resolveSyncBootstrap?.();
};
