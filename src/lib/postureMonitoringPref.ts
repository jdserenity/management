import { MGMT_LS } from '@/lib/mgmtLocalStorage';

/** `true` when user has not turned posture monitoring off (default). */
export function isPostureMonitoringEnabledPref(): boolean {
  return localStorage.getItem(MGMT_LS.postureMonitoringEnabled) !== 'false';
}

export function setPostureMonitoringEnabledPref(enabled: boolean): void {
  localStorage.setItem(MGMT_LS.postureMonitoringEnabled, enabled ? 'true' : 'false');
}
