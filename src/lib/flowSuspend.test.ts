import { describe, expect, it } from 'vitest';
import {
  FLOW_SUSPEND_GAP_MS,
  flowShouldStopForHeartbeatGap
} from './flowSuspend';

describe('flowShouldStopForHeartbeatGap', () => {
  it('returns false when no heartbeat yet', () => {
    expect(flowShouldStopForHeartbeatGap(null, 10_000)).toBe(false);
  });

  it('returns false within the gap tolerance', () => {
    const t = 1_000_000;
    expect(flowShouldStopForHeartbeatGap(t, t + FLOW_SUSPEND_GAP_MS)).toBe(false);
    expect(flowShouldStopForHeartbeatGap(t, t + 3_000)).toBe(false);
  });

  it('returns true when heartbeat gap exceeds tolerance', () => {
    const t = 1_000_000;
    expect(flowShouldStopForHeartbeatGap(t, t + FLOW_SUSPEND_GAP_MS + 1)).toBe(true);
    expect(flowShouldStopForHeartbeatGap(t, t + 60_000)).toBe(true);
  });
});
