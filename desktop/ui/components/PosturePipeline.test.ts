import { describe, expect, it, vi } from 'vitest';
import { applyInitialPostureMonitoringState } from './PosturePipeline';

describe('applyInitialPostureMonitoringState', () => {
  it('does not preload the pose model when monitoring starts disabled', async () => {
    const markMonitoring = vi.fn();
    const preloadPoseModel = vi.fn();
    const enabled = await applyInitialPostureMonitoringState({
      loadPref: async () => false,
      markMonitoring,
      preloadPoseModel,
    });

    expect(enabled).toBe(false);
    expect(markMonitoring).toHaveBeenCalledWith(false);
    expect(preloadPoseModel).not.toHaveBeenCalled();
  });

  it('preloads the pose model when monitoring starts enabled', async () => {
    const markMonitoring = vi.fn();
    const preloadPoseModel = vi.fn();
    const enabled = await applyInitialPostureMonitoringState({
      loadPref: async () => true,
      markMonitoring,
      preloadPoseModel,
    });

    expect(enabled).toBe(true);
    expect(markMonitoring).toHaveBeenCalledWith(true);
    expect(preloadPoseModel).toHaveBeenCalledTimes(1);
  });
});
