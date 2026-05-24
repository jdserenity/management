export const POSTURE_BASELINE_METRICS_KEY = 'mgmt_posture_baseline_v1';
export const POSTURE_BASELINE_IMAGE_STORE_KEY = 'calibratedImagePath';

export function clearPostureBaselineMetrics(): void {
  localStorage.removeItem(POSTURE_BASELINE_METRICS_KEY);
}
