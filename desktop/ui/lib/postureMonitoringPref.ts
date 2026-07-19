import { boolPref, getAppKv, setAppKv } from '@/lib/appKv';

export type PostureMonitoringCommand = 'start_monitoring' | 'stop_monitoring';

export const KV_POSTURE_MONITORING_ENABLED = 'posture_monitoring_enabled_v1';
const LEGACY_POSTURE_MONITORING_LS_KEY = 'mgmt_posture_monitoring_enabled';

let migratePromise: Promise<void> | null = null;

const pref = boolPref(KV_POSTURE_MONITORING_ENABLED, {
  defaultValue: false,
  mode: 'defaultOff',
  encode: 'truefalse'
});

const migrateFromLocalStorage = async (): Promise<void> => {
  const existing = await getAppKv(KV_POSTURE_MONITORING_ENABLED);
  if (existing !== null) return;
  const legacy = localStorage.getItem(LEGACY_POSTURE_MONITORING_LS_KEY);
  if (legacy !== null) {
    await setAppKv(KV_POSTURE_MONITORING_ENABLED, legacy);
    localStorage.removeItem(LEGACY_POSTURE_MONITORING_LS_KEY);
  }
};

const ensureMigrated = async (): Promise<void> => {
  if (!migratePromise) migratePromise = migrateFromLocalStorage();
  await migratePromise;
};

/** @internal vitest only */
export const resetPostureMonitoringPrefMigrationForTests = (): void => {
  migratePromise = null;
};

/** `true` only when the user has turned posture monitoring on. */
export async function isPostureMonitoringEnabledPref(): Promise<boolean> {
  await ensureMigrated();
  return pref.load();
}

export async function setPostureMonitoringEnabledPref(enabled: boolean): Promise<void> {
  await ensureMigrated();
  await pref.save(enabled);
}

/** Align Rust monitoring with saved preference (call once on app boot). */
export async function applyPostureMonitoringFromPref(
  invokeMonitoring: (cmd: PostureMonitoringCommand) => Promise<unknown>
): Promise<boolean> {
  const enabled = await isPostureMonitoringEnabledPref();
  await invokeMonitoring(enabled ? 'start_monitoring' : 'stop_monitoring');
  return enabled;
}
