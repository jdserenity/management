import { getDb } from '@/lib/db';
import { parsePersistedFlowState, type PersistedFlowState } from '@/lib/flowState';
import {
  allowedWorkoutIdsForLegacyKv,
  normalizeWorkoutCustomizePrefs,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';
import {
  DEFAULT_ALLOWED_WORKOUT_IDS,
  normalizeWorkoutLogs,
  resolveAllowedWorkoutIds,
  type FocusLogEntry,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';
import { loadMovementSnackPrefs, type MovementSnackPrefs } from '@/lib/movementSnack/movementSnackPref';

export const LEGACY_LS_KEYS = {
  allowedWorkouts: 'management_allowed_workouts',
  workoutLogs: 'management_workout_logs',
  focusLogs: 'management_focus_logs'
} as const;

export const KV_ALLOWED_WORKOUTS = 'allowed_workout_ids';
export const KV_WORKOUT_CUSTOMIZE_PREFS = 'workout_customize_prefs_v1';
export const KV_SESSION_MIGRATED = 'session_storage_migrated_v1';
export const KV_ACTIVE_FLOW = 'active_flow_state_v1';

export const MAX_HISTORY_ITEMS = 1500;

type FocusLogRow = {
  id: string;
  session_type: string;
  completed_at: number;
  duration_minutes: number;
  planned_duration_minutes: number | null;
  completion_ratio: number | null;
};

type WorkoutLogRow = {
  id: string;
  workout_id: string;
  workout_name: string;
  completed_at: number;
  exercises_json: string;
  total_reps: number;
  total_timed_seconds: number;
  completion_ratio: number | null;
};

type AppKvRow = { value: string };

export type LocalStorageSessionImport = {
  allowedWorkoutIds: string[] | null;
  workoutLogs: WorkoutLogEntry[];
  focusLogs: FocusLogEntry[];
};

const readLegacyJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to parse localStorage key ${key}:`, error);
    return fallback;
  }
};

export const normalizeFocusLogEntry = (raw: FocusLogEntry): FocusLogEntry => {
  const planned = raw.plannedDurationMinutes ?? raw.durationMinutes;
  const ratio = raw.completionRatio ?? 1;
  return { ...raw, plannedDurationMinutes: planned, completionRatio: ratio, durationMinutes: raw.durationMinutes };
};

export const readLocalStorageSessionImport = (): LocalStorageSessionImport => ({
  allowedWorkoutIds: readLegacyJson<string[] | null>(LEGACY_LS_KEYS.allowedWorkouts, null),
  workoutLogs: readLegacyJson<WorkoutLogEntry[]>(LEGACY_LS_KEYS.workoutLogs, []),
  focusLogs: readLegacyJson<FocusLogEntry[]>(LEGACY_LS_KEYS.focusLogs, [])
});

export const hasLegacyLocalStorageSessionData = (bundle: LocalStorageSessionImport): boolean =>
  bundle.allowedWorkoutIds !== null || bundle.workoutLogs.length > 0 || bundle.focusLogs.length > 0;

export const focusLogEntryFromRow = (row: FocusLogRow): FocusLogEntry => {
  const planned = row.planned_duration_minutes ?? row.duration_minutes;
  const ratio = row.completion_ratio ?? 1;
  return {
    id: row.id,
    type: row.session_type === 'deep' ? 'deep' : 'pomodoro',
    completedAt: row.completed_at,
    durationMinutes: row.duration_minutes,
    plannedDurationMinutes: planned,
    completionRatio: ratio
  };
};

export const workoutLogEntryFromRow = (row: WorkoutLogRow): WorkoutLogEntry => {
  let exercises: WorkoutLogEntry['exercises'] = [];
  try {
    exercises = JSON.parse(row.exercises_json) as WorkoutLogEntry['exercises'];
  } catch (error) {
    console.error(`Failed to parse exercises_json for workout log ${row.id}:`, error);
  }
  return {
    id: row.id,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    completedAt: row.completed_at,
    exercises,
    totalReps: row.total_reps,
    totalTimedSeconds: row.total_timed_seconds,
    completionRatio: row.completion_ratio ?? 1
  };
};

export const clearLegacyLocalStorageSessionKeys = (): void => {
  localStorage.removeItem(LEGACY_LS_KEYS.allowedWorkouts);
  localStorage.removeItem(LEGACY_LS_KEYS.workoutLogs);
  localStorage.removeItem(LEGACY_LS_KEYS.focusLogs);
};

const getKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<AppKvRow[]>('SELECT value FROM app_kv WHERE key = $1 LIMIT 1', [key]);
  return rows[0]?.value ?? null;
};

const setKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  const updatedAt = Date.now();
  await db.execute(
    'INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, value, updatedAt]
  );
};

const isSessionMigrated = async (): Promise<boolean> => {
  const flag = await getKv(KV_SESSION_MIGRATED);
  return flag === '1';
};

const markSessionMigrated = async (): Promise<void> => {
  await setKv(KV_SESSION_MIGRATED, '1');
};

export const fetchAllowedWorkoutIds = async (): Promise<string[]> => {
  const raw = await getKv(KV_ALLOWED_WORKOUTS);
  if (!raw) return resolveAllowedWorkoutIds(DEFAULT_ALLOWED_WORKOUT_IDS);
  try {
    const parsed = JSON.parse(raw) as string[];
    return resolveAllowedWorkoutIds(parsed);
  } catch (error) {
    console.error('Failed to parse allowed_workout_ids from app_kv:', error);
    return resolveAllowedWorkoutIds(DEFAULT_ALLOWED_WORKOUT_IDS);
  }
};

export const saveAllowedWorkoutIds = async (ids: string[]): Promise<void> => {
  await setKv(KV_ALLOWED_WORKOUTS, JSON.stringify(resolveAllowedWorkoutIds(ids)));
};

export const fetchWorkoutCustomizePrefs = async (): Promise<WorkoutCustomizePrefs> => {
  const legacyIds = await fetchAllowedWorkoutIds();
  const raw = await getKv(KV_WORKOUT_CUSTOMIZE_PREFS);
  if (!raw) return normalizeWorkoutCustomizePrefs(null, legacyIds);
  try {
    return normalizeWorkoutCustomizePrefs(JSON.parse(raw) as Partial<WorkoutCustomizePrefs>, legacyIds);
  } catch (error) {
    console.error('Failed to parse workout_customize_prefs from app_kv:', error);
    return normalizeWorkoutCustomizePrefs(null, legacyIds);
  }
};

export const saveWorkoutCustomizePrefs = async (prefs: WorkoutCustomizePrefs): Promise<void> => {
  const normalized = normalizeWorkoutCustomizePrefs(prefs, null);
  await setKv(KV_WORKOUT_CUSTOMIZE_PREFS, JSON.stringify(normalized));
  await setKv(KV_ALLOWED_WORKOUTS, JSON.stringify(allowedWorkoutIdsForLegacyKv(normalized)));
};

export const fetchFocusLogs = async (limit = MAX_HISTORY_ITEMS): Promise<FocusLogEntry[]> => {
  const db = await getDb();
  const rows = await db.select<FocusLogRow[]>(
    'SELECT id, session_type, completed_at, duration_minutes, planned_duration_minutes, completion_ratio FROM focus_log ORDER BY completed_at DESC LIMIT $1',
    [limit]
  );
  return rows.map(focusLogEntryFromRow);
};

export const fetchWorkoutLogs = async (limit = MAX_HISTORY_ITEMS): Promise<WorkoutLogEntry[]> => {
  const db = await getDb();
  const rows = await db.select<WorkoutLogRow[]>(
    'SELECT id, workout_id, workout_name, completed_at, exercises_json, total_reps, total_timed_seconds, completion_ratio FROM workout_log ORDER BY completed_at DESC LIMIT $1',
    [limit]
  );
  return normalizeWorkoutLogs(rows.map(workoutLogEntryFromRow));
};

export const insertFocusLog = async (entry: FocusLogEntry): Promise<void> => {
  const db = await getDb();
  const normalized = normalizeFocusLogEntry(entry);
  await db.execute(
    'INSERT OR REPLACE INTO focus_log (id, session_type, completed_at, duration_minutes, planned_duration_minutes, completion_ratio) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      normalized.id,
      normalized.type,
      normalized.completedAt,
      normalized.durationMinutes,
      normalized.plannedDurationMinutes,
      normalized.completionRatio
    ]
  );
};

export const insertWorkoutLog = async (entry: WorkoutLogEntry): Promise<void> => {
  const db = await getDb();
  const ratio = entry.completionRatio ?? 1;
  await db.execute(
    'INSERT OR REPLACE INTO workout_log (id, workout_id, workout_name, completed_at, exercises_json, total_reps, total_timed_seconds, completion_ratio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      entry.id,
      entry.workoutId,
      entry.workoutName,
      entry.completedAt,
      JSON.stringify(entry.exercises),
      entry.totalReps,
      entry.totalTimedSeconds,
      ratio
    ]
  );
};

const pruneFocusLogs = async (keep: number): Promise<void> => {
  const db = await getDb();
  await db.execute(
    `DELETE FROM focus_log WHERE id NOT IN (
      SELECT id FROM focus_log ORDER BY completed_at DESC LIMIT $1
    )`,
    [keep]
  );
};

const pruneWorkoutLogs = async (keep: number): Promise<void> => {
  const db = await getDb();
  await db.execute(
    `DELETE FROM workout_log WHERE id NOT IN (
      SELECT id FROM workout_log ORDER BY completed_at DESC LIMIT $1
    )`,
    [keep]
  );
};

const countFocusLogs = async (): Promise<number> => {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM focus_log', []);
  return rows[0]?.count ?? 0;
};

const countWorkoutLogs = async (): Promise<number> => {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM workout_log', []);
  return rows[0]?.count ?? 0;
};

const importLegacyLocalStorage = async (bundle: LocalStorageSessionImport): Promise<void> => {
  if (bundle.allowedWorkoutIds !== null) {
    await saveAllowedWorkoutIds(bundle.allowedWorkoutIds);
  }
  for (const entry of bundle.focusLogs) {
    await insertFocusLog(normalizeFocusLogEntry(entry));
  }
  for (const entry of normalizeWorkoutLogs(bundle.workoutLogs)) {
    await insertWorkoutLog(entry);
  }
  await pruneFocusLogs(MAX_HISTORY_ITEMS);
  await pruneWorkoutLogs(MAX_HISTORY_ITEMS);
  if (bundle.focusLogs.length > 0 && (await countFocusLogs()) === 0) {
    throw new Error('focus_log import produced no rows');
  }
  if (bundle.workoutLogs.length > 0 && (await countWorkoutLogs()) === 0) {
    throw new Error('workout_log import produced no rows');
  }
  clearLegacyLocalStorageSessionKeys();
};

export const migrateSessionStorageFromLocalStorageIfNeeded = async (): Promise<void> => {
  const bundle = readLocalStorageSessionImport();
  const hasLegacy = hasLegacyLocalStorageSessionData(bundle);
  const migrated = await isSessionMigrated();
  const dbEmpty = (await countFocusLogs()) === 0 && (await countWorkoutLogs()) === 0;
  if (hasLegacy && (!migrated || dbEmpty)) {
    await importLegacyLocalStorage(bundle);
  }
  if (!migrated) {
    await markSessionMigrated();
  }
};

export type SessionStorageSnapshot = {
  workoutCustomizePrefs: WorkoutCustomizePrefs;
  workoutLogs: WorkoutLogEntry[];
  focusLogs: FocusLogEntry[];
  activeFlow: PersistedFlowState | null;
  movementSnackPrefs: MovementSnackPrefs;
};

export const fetchActiveFlowState = async (): Promise<PersistedFlowState | null> => {
  const raw = await getKv(KV_ACTIVE_FLOW);
  if (!raw) return null;
  return parsePersistedFlowState(raw);
};

export const saveActiveFlowState = async (flow: PersistedFlowState): Promise<void> => {
  await setKv(KV_ACTIVE_FLOW, JSON.stringify(flow));
};

export const clearActiveFlowState = async (): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM app_kv WHERE key = $1', [KV_ACTIVE_FLOW]);
};

export const loadSessionStorage = async (): Promise<SessionStorageSnapshot> => {
  await migrateSessionStorageFromLocalStorageIfNeeded();
  const [workoutCustomizePrefs, workoutLogs, focusLogs, activeFlow, movementSnackPrefs] = await Promise.all([
    fetchWorkoutCustomizePrefs(),
    fetchWorkoutLogs(),
    fetchFocusLogs(),
    fetchActiveFlowState(),
    loadMovementSnackPrefs()
  ]);
  return { workoutCustomizePrefs, workoutLogs, focusLogs, activeFlow, movementSnackPrefs };
};

export const persistFocusLog = async (entry: FocusLogEntry): Promise<void> => {
  await insertFocusLog(entry);
  await pruneFocusLogs(MAX_HISTORY_ITEMS);
};

export const persistWorkoutLog = async (entry: WorkoutLogEntry): Promise<void> => {
  await insertWorkoutLog(entry);
  await pruneWorkoutLogs(MAX_HISTORY_ITEMS);
};

export const deleteWorkoutLogsForWorkoutIdSince = async (workoutId: string, startTs: number): Promise<number> => {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM workout_log WHERE workout_id = $1 AND completed_at >= $2',
    [workoutId, startTs]
  );
  const count = rows[0]?.count ?? 0;
  if (count > 0) {
    await db.execute('DELETE FROM workout_log WHERE workout_id = $1 AND completed_at >= $2', [workoutId, startTs]);
  }
  return count;
};
