/** Tauri event: system sleep, display sleep, or screen lock. */
export const FLOW_SUSPEND_EVENT = 'flow-suspend';

/** Timer heartbeat interval while a flow is active. */
export const FLOW_HEARTBEAT_MS = 1_000;

/**
 * Gap longer than this between heartbeats means the host slept, locked, or suspended JS timers.
 * Normal ticks are ~1s; allow slack for brief event-loop stalls.
 */
export const FLOW_SUSPEND_GAP_MS = 5_000;

export const flowShouldStopForHeartbeatGap = (
  lastHeartbeatMs: number | null,
  nowMs: number,
  gapMs: number = FLOW_SUSPEND_GAP_MS
): boolean => lastHeartbeatMs !== null && nowMs - lastHeartbeatMs > gapMs;
