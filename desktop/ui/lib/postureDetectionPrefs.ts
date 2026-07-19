import { MGMT_LS } from '@/lib/mgmtLocalStorage';

export function isPostureBatterySavingModeEnabled(): boolean {
  return localStorage.getItem(MGMT_LS.batterySavingMode) !== 'false';
}

export function savePostureBatterySavingMode(enabled: boolean): void {
  localStorage.setItem(MGMT_LS.batterySavingMode, enabled.toString());
}
