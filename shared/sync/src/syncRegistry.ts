import type { UserDataTable } from './userData';

/** SQLite table names in local.db (from shared/storage migrations). */
export type LocalDbTable =
  | 'posture_log'
  | 'focus_log'
  | 'workout_log'
  | 'app_kv'
  | 'nutrition_config'
  | 'nutrition_staples'
  | 'nutrition_regulars'
  | 'nutrition_entries'
  | 'streak_activities'
  | 'streak_log_cells'
  | 'streak_activity_meta'
  | 'water_config'
  | 'water_entries'
  | 'sync_tombstones';

/** Server-only tables (not in UserData snapshot). */
export type ServerOnlyTable = 'active_flow_singleton' | 'users';

export type SyncScope = 'shared' | 'desktop_only';

export type SyncMergeKind =
  | 'row_lww' // last-write-wins on updatedAtColumn
  | 'append_only' // insert-only logs; completed_at is the version clock
  | 'singleton'; // one row per user (nutrition_config, water_config)

export interface SyncTableDef {
  sqlTable: LocalDbTable;
  scope: SyncScope;
  userDataField: UserDataTable | null;
  rowKey: string[];
  /** Column used for conflict resolution. null = missing today; Step 2 migration adds it. */
  updatedAtColumn: string | null;
  mergeKind: SyncMergeKind;
}

export const LOCAL_DB_TABLES: LocalDbTable[] = [
  'posture_log',
  'focus_log',
  'workout_log',
  'app_kv',
  'nutrition_config',
  'nutrition_staples',
  'nutrition_regulars',
  'nutrition_entries',
  'streak_activities',
  'streak_log_cells',
  'streak_activity_meta',
  'water_config',
  'water_entries',
  'sync_tombstones'
];

export const SYNC_TABLE_REGISTRY: Record<LocalDbTable, SyncTableDef> = {
  posture_log: {
    sqlTable: 'posture_log',
    scope: 'desktop_only',
    userDataField: null,
    rowKey: ['id'],
    updatedAtColumn: 'timestamp',
    mergeKind: 'append_only'
  },
  focus_log: {
    sqlTable: 'focus_log',
    scope: 'shared',
    userDataField: 'focusLog',
    rowKey: ['id'],
    updatedAtColumn: 'completed_at',
    mergeKind: 'append_only'
  },
  workout_log: {
    sqlTable: 'workout_log',
    scope: 'shared',
    userDataField: 'workoutLog',
    rowKey: ['id'],
    updatedAtColumn: 'completed_at',
    mergeKind: 'append_only'
  },
  app_kv: {
    sqlTable: 'app_kv',
    scope: 'shared',
    userDataField: 'appKv',
    rowKey: ['key'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  nutrition_config: {
    sqlTable: 'nutrition_config',
    scope: 'shared',
    userDataField: 'nutritionConfig',
    rowKey: ['id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'singleton'
  },
  nutrition_staples: {
    sqlTable: 'nutrition_staples',
    scope: 'shared',
    userDataField: 'nutritionStaples',
    rowKey: ['id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  nutrition_regulars: {
    sqlTable: 'nutrition_regulars',
    scope: 'shared',
    userDataField: 'nutritionRegulars',
    rowKey: ['id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  nutrition_entries: {
    sqlTable: 'nutrition_entries',
    scope: 'shared',
    userDataField: 'nutritionEntries',
    rowKey: ['id', 'log_day'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  streak_activities: {
    sqlTable: 'streak_activities',
    scope: 'shared',
    userDataField: 'streakActivities',
    rowKey: ['id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  streak_log_cells: {
    sqlTable: 'streak_log_cells',
    scope: 'shared',
    userDataField: 'streakLogCells',
    rowKey: ['log_date', 'activity_id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  streak_activity_meta: {
    sqlTable: 'streak_activity_meta',
    scope: 'shared',
    userDataField: 'streakActivityMeta',
    rowKey: ['activity_id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  water_config: {
    sqlTable: 'water_config',
    scope: 'shared',
    userDataField: 'waterConfig',
    rowKey: ['id'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'singleton'
  },
  water_entries: {
    sqlTable: 'water_entries',
    scope: 'shared',
    userDataField: 'waterEntries',
    rowKey: ['id', 'log_day'],
    updatedAtColumn: 'updated_at',
    mergeKind: 'row_lww'
  },
  sync_tombstones: {
    sqlTable: 'sync_tombstones',
    scope: 'shared',
    userDataField: 'syncTombstones',
    rowKey: ['entity', 'row_key'],
    updatedAtColumn: 'deleted_at',
    mergeKind: 'row_lww'
  }
};

/** app_kv keys that sync across desktop + companion. */
export const SHARED_APP_KV_KEYS = [
  'movement_snack_prefs_v1',
  'workout_customize_prefs_v1',
  'stretch_definitions_v1',
  'cant_exercise_mode_v1',
  'pomodoro_break_chain_v1',
  'stats_day_rollover_hour_v1',
  'streak_heatmap_color_v1',
  'session_alert_sound_v1',
  'session_alert_countdown_sound_v1',
  'session_alert_notify_v1',
  'morning_stretch_routine_v1',
  'morning_stretch_enabled_v1',
  'morning_stretch_duration_minutes_v1',
  'morning_stretch_hide_after_hour_v1'
] as const;

/** app_kv keys that stay on one device (never uploaded). */
export const DESKTOP_ONLY_APP_KV_KEYS = [
  'posture_monitoring_enabled_v1',
  'app_presence_mode_v1',
  'hide_to_menu_bar_on_close_v1',
  'session_alert_focus_window_v1',
  'session_alert_dock_bounce_v1',
  'session_tray_timer_v1',
  'session_storage_migrated_v1',
  'active_flow_state_v1',
  'vault_import_tdee_v1',
  'vault_import_streak_v1'
] as const;

export type SharedAppKvKey = (typeof SHARED_APP_KV_KEYS)[number];
export type DesktopOnlyAppKvKey = (typeof DESKTOP_ONLY_APP_KV_KEYS)[number];

/** Data stored outside app_kv / UserData that never syncs. */
export const DESKTOP_ONLY_STORAGE = {
  localStorageKeys: [
    'mgmt_posture_baseline_v1',
    'mgmt_ls_camera_index',
    'mgmt_ls_battery_saving',
    'mgmt_ls_monitoring_interval',
    'mgmt_ls_notification_frequency',
    'mgmt_ls_turtle_neck_sensitivity',
    'mgmt_ls_shoulder_sensitivity',
    'mgmt_sync_device_id_v1'
  ],
  tauriStoreFiles: ['.settings.dat'],
  notes: ['Camera/detection prefs use MGMT_LS keys in mgmtLocalStorage.ts; posture baseline is localStorage.']
} as const;

const sharedAppKvSet = new Set<string>(SHARED_APP_KV_KEYS);
const desktopOnlyAppKvSet = new Set<string>(DESKTOP_ONLY_APP_KV_KEYS);

export const getSyncTableDef = (sqlTable: string): SyncTableDef | undefined =>
  (SYNC_TABLE_REGISTRY as Record<string, SyncTableDef>)[sqlTable];

export const isLocalDbTable = (sqlTable: string): sqlTable is LocalDbTable =>
  LOCAL_DB_TABLES.includes(sqlTable as LocalDbTable);

export const isSyncableSqlTable = (sqlTable: string): boolean => {
  const def = getSyncTableDef(sqlTable);
  return def?.scope === 'shared';
};

export const isSyncableAppKvKey = (key: string): boolean => {
  if (desktopOnlyAppKvSet.has(key)) return false;
  if (sharedAppKvSet.has(key)) return true;
  return false;
};

export const isDesktopOnlyAppKvKey = (key: string): boolean => desktopOnlyAppKvSet.has(key);

export const userDataFieldForSqlTable = (sqlTable: string): UserDataTable | null =>
  getSyncTableDef(sqlTable)?.userDataField ?? null;

export const sharedUserDataTables = (): UserDataTable[] =>
  Object.values(SYNC_TABLE_REGISTRY)
    .filter((def) => def.scope === 'shared' && def.userDataField)
    .map((def) => def.userDataField as UserDataTable);

export const tablesMissingUpdatedAt = (): LocalDbTable[] =>
  Object.values(SYNC_TABLE_REGISTRY)
    .filter((def) => def.scope === 'shared' && def.updatedAtColumn == null)
    .map((def) => def.sqlTable);

const QUERY_TABLE_PATTERNS: Array<{ pattern: RegExp; table: LocalDbTable }> = LOCAL_DB_TABLES.map((table) => ({
  pattern: new RegExp(`\\b${table}\\b`, 'i'),
  table
}));

export const inferLocalDbTablesFromSql = (query: string): LocalDbTable[] => {
  if (!/^\s*(insert|update|delete|replace)\b/i.test(query)) return [];
  const tables: LocalDbTable[] = [];
  for (const entry of QUERY_TABLE_PATTERNS) {
    if (entry.pattern.test(query)) tables.push(entry.table);
  }
  return tables;
};

export const inferSyncUserDataTablesFromSql = (query: string): UserDataTable[] => {
  const tables = inferLocalDbTablesFromSql(query)
    .filter(isSyncableSqlTable)
    .map((t) => userDataFieldForSqlTable(t))
    .filter((t): t is UserDataTable => t != null);
  return [...new Set(tables)];
};
