import { describe, expect, it, beforeEach, vi } from 'vitest';
import { clearPostureBaselineMetrics, POSTURE_BASELINE_METRICS_KEY } from './postureBaseline';

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
  return store;
}

describe('postureBaseline', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('clears saved baseline metrics from localStorage', () => {
    localStorage.setItem(POSTURE_BASELINE_METRICS_KEY, '{"capturedAt":1}');
    clearPostureBaselineMetrics();
    expect(localStorage.getItem(POSTURE_BASELINE_METRICS_KEY)).toBeNull();
  });

  it('is safe when baseline metrics were never saved', () => {
    expect(() => clearPostureBaselineMetrics()).not.toThrow();
    expect(localStorage.getItem(POSTURE_BASELINE_METRICS_KEY)).toBeNull();
  });
});
