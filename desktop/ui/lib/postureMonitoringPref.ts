import { getDb } from '@/lib/db';

export type PostureMonitoringCommand = 'start_monitoring' | 'stop_monitoring';

export const KV_POSTURE_MONITORING_ENABLED = 'posture_monitoring_enabled_v1';
const LEGACY_POSTURE_MONITORING_LS_KEY = 'mgmt_posture_monitoring_enabled';

type AppKvRow = { value: string };

let migratePromise: Promise<void> | null = null;

const getKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<AppKvRow[]>('SELECT value FROM app_kv WHERE key = $1 LIMIT 1', [key]);
  return rows[0]?.value ?? null;
};

const setKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.execute(
    'INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, value, Date.now()]
  );
};

const migrateFromLocalStorage = async (): Promise<void> => {
  const existing = await getKv(KV_POSTURE_MONITORING_ENABLED);
  if (existing !== null) return;
  const legacy = localStorage.getItem(LEGACY_POSTURE_MONITORING_LS_KEY);
  if (legacy !== null) {
    await setKv(KV_POSTURE_MONITORING_ENABLED, legacy);
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

const parseEnabled = (raw: string | null): boolean => raw !== 'false';

/** `true` when user has not turned posture monitoring off (default). */
export async function isPostureMonitoringEnabledPref(): Promise<boolean> {
  await ensureMigrated();
  return parseEnabled(await getKv(KV_POSTURE_MONITORING_ENABLED));
}

export async function setPostureMonitoringEnabledPref(enabled: boolean): Promise<void> {
  await ensureMigrated();
  await setKv(KV_POSTURE_MONITORING_ENABLED, enabled ? 'true' : 'false');
}

/** Align Rust monitoring with saved preference (call once on app boot). */
export async function applyPostureMonitoringFromPref(
  invokeMonitoring: (cmd: PostureMonitoringCommand) => Promise<unknown>,
): Promise<boolean> {
  const enabled = await isPostureMonitoringEnabledPref();
  await invokeMonitoring(enabled ? 'start_monitoring' : 'stop_monitoring');
  return enabled;
}
