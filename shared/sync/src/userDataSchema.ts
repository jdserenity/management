/**
 * Single description of each UserData table: columns, keys, bind order.
 * Client extract/hydrate and server SqliteDataStore both derive SQL from this.
 */
import type {
  AppKvRow,
  FocusLogRow,
  NutritionConfig,
  NutritionEntry,
  NutritionRegular,
  NutritionStaple,
  StreakActivity,
  StreakActivityMeta,
  StreakLogCell,
  UserData,
  UserDataTable,
  WaterConfig,
  WaterEntry,
  WorkoutLogRow
} from './userData';

export type TableMergeKind = 'append_only' | 'row_lww' | 'singleton';

export type UserDataTableSchema<TRow = unknown, TDeleteKey = unknown> = {
  field: UserDataTable;
  sqlTable: string;
  /** Payload columns (no user_id), bind order. */
  columns: readonly string[];
  /** Client-side / logical row keys (no user_id). Empty = server PK is user_id only. */
  rowKey: readonly string[];
  /** Index in `columns` where server inserts `user_id` (before that index). */
  serverUserIdIndex: number;
  mergeKind: TableMergeKind;
  /** true → UserData field is T | null, not T[] */
  singleton: boolean;
  orderBy?: string;
  updatedAtColumn: string | null;
  bind: (row: TRow) => unknown[];
  bindDeleteKey: (key: TDeleteKey) => unknown[];
  getRows: (data: UserData) => TRow[];
  getSingleton?: (data: UserData) => TRow | null | undefined;
};

const ph = (n: number): string => Array.from({ length: n }, () => '?').join(',');

export const placeholders = ph;

const focus: UserDataTableSchema<FocusLogRow, { id: string }> = {
  field: 'focusLog',
  sqlTable: 'focus_log',
  columns: ['id', 'session_type', 'completed_at', 'duration_minutes', 'planned_duration_minutes', 'completion_ratio'],
  rowKey: ['id'],
  serverUserIdIndex: 1,
  mergeKind: 'append_only',
  singleton: false,
  orderBy: 'completed_at DESC',
  updatedAtColumn: 'completed_at',
  bind: (r) => [r.id, r.session_type, r.completed_at, r.duration_minutes, r.planned_duration_minutes ?? null, r.completion_ratio ?? null],
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.focusLog
};

const workout: UserDataTableSchema<WorkoutLogRow, { id: string }> = {
  field: 'workoutLog',
  sqlTable: 'workout_log',
  columns: ['id', 'workout_id', 'workout_name', 'completed_at', 'exercises_json', 'total_reps', 'total_timed_seconds', 'completion_ratio'],
  rowKey: ['id'],
  serverUserIdIndex: 1,
  mergeKind: 'append_only',
  singleton: false,
  orderBy: 'completed_at DESC',
  updatedAtColumn: 'completed_at',
  bind: (r) => [r.id, r.workout_id, r.workout_name, r.completed_at, r.exercises_json, r.total_reps, r.total_timed_seconds, r.completion_ratio ?? null],
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.workoutLog
};

const appKv: UserDataTableSchema<AppKvRow, { key: string }> = {
  field: 'appKv',
  sqlTable: 'app_kv',
  columns: ['key', 'value', 'updated_at'],
  rowKey: ['key'],
  serverUserIdIndex: 0,
  mergeKind: 'row_lww',
  singleton: false,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.key, r.value, r.updated_at],
  bindDeleteKey: (k) => [k.key],
  getRows: (d) => d.appKv
};

const nutritionConfig: UserDataTableSchema<NutritionConfig, { id: 1 }> = {
  field: 'nutritionConfig',
  sqlTable: 'nutrition_config',
  columns: ['tdee', 'protein', 'log_day', 'updated_at'],
  rowKey: [],
  serverUserIdIndex: 0,
  mergeKind: 'singleton',
  singleton: true,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.tdee, r.protein, r.log_day, r.updated_at],
  bindDeleteKey: () => [],
  getRows: (d) => (d.nutritionConfig ? [d.nutritionConfig] : []),
  getSingleton: (d) => d.nutritionConfig
};

const mealBind = (r: NutritionStaple | NutritionRegular) =>
  [r.id, r.name, r.calories, r.protein, r.ingredients_json ?? null, r.sort_order, r.updated_at];

const nutritionStaples: UserDataTableSchema<NutritionStaple, { id: string }> = {
  field: 'nutritionStaples',
  sqlTable: 'nutrition_staples',
  columns: ['id', 'name', 'calories', 'protein', 'ingredients_json', 'sort_order', 'updated_at'],
  rowKey: ['id'],
  serverUserIdIndex: 1,
  mergeKind: 'row_lww',
  singleton: false,
  orderBy: 'sort_order',
  updatedAtColumn: 'updated_at',
  bind: mealBind,
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.nutritionStaples
};

const nutritionRegulars: UserDataTableSchema<NutritionRegular, { id: string }> = {
  field: 'nutritionRegulars',
  sqlTable: 'nutrition_regulars',
  columns: ['id', 'name', 'calories', 'protein', 'ingredients_json', 'sort_order', 'updated_at'],
  rowKey: ['id'],
  serverUserIdIndex: 1,
  mergeKind: 'row_lww',
  singleton: false,
  orderBy: 'sort_order',
  updatedAtColumn: 'updated_at',
  bind: mealBind,
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.nutritionRegulars
};

const nutritionEntries: UserDataTableSchema<NutritionEntry, { id: string }> = {
  field: 'nutritionEntries',
  sqlTable: 'nutrition_entries',
  columns: ['id', 'log_day', 'kind', 'ref_id', 'label', 'calories', 'protein', 'count', 'updated_at', 'deleted'],
  rowKey: ['id', 'log_day'],
  serverUserIdIndex: 1,
  mergeKind: 'row_lww',
  singleton: false,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.id, r.log_day, r.kind, r.ref_id ?? null, r.label, r.calories, r.protein, r.count, r.updated_at, r.deleted],
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.nutritionEntries
};

const streakActivities: UserDataTableSchema<StreakActivity, { id: string }> = {
  field: 'streakActivities',
  sqlTable: 'streak_activities',
  columns: [
    'id', 'name', 'description', 'frequency', 'weekly_target', 'scheduled_days_json', 'can_fail', 'necessary',
    'archived_at', 'sort_order', 'linked_staple_id', 'linked_water', 'linked_movement_burst',
    'extra_calories', 'extra_protein', 'extra_water_ml', 'updated_at'
  ],
  rowKey: ['id'],
  serverUserIdIndex: 1,
  mergeKind: 'row_lww',
  singleton: false,
  orderBy: 'sort_order',
  updatedAtColumn: 'updated_at',
  bind: (r) => [
    r.id, r.name, r.description ?? null, r.frequency, r.weekly_target ?? null, r.scheduled_days_json ?? null,
    r.can_fail, r.necessary ?? 0, r.archived_at ?? null, r.sort_order, r.linked_staple_id ?? null,
    r.linked_water ?? 0, r.linked_movement_burst ?? 0, r.extra_calories ?? null, r.extra_protein ?? null,
    r.extra_water_ml ?? null, r.updated_at
  ],
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.streakActivities
};

const streakLogCells: UserDataTableSchema<StreakLogCell, { log_date: string; activity_id: string }> = {
  field: 'streakLogCells',
  sqlTable: 'streak_log_cells',
  columns: ['log_date', 'activity_id', 'state', 'updated_at'],
  rowKey: ['log_date', 'activity_id'],
  serverUserIdIndex: 2,
  mergeKind: 'row_lww',
  singleton: false,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.log_date, r.activity_id, r.state, r.updated_at],
  bindDeleteKey: (k) => [k.log_date, k.activity_id],
  getRows: (d) => d.streakLogCells
};

const streakActivityMeta: UserDataTableSchema<StreakActivityMeta, { activity_id: string }> = {
  field: 'streakActivityMeta',
  sqlTable: 'streak_activity_meta',
  columns: ['activity_id', 'start_date', 'pause_since', 'unpaused_at', 'reset_count', 'updated_at'],
  rowKey: ['activity_id'],
  serverUserIdIndex: 1,
  mergeKind: 'row_lww',
  singleton: false,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.activity_id, r.start_date ?? null, r.pause_since ?? null, r.unpaused_at ?? null, r.reset_count, r.updated_at],
  bindDeleteKey: (k) => [k.activity_id],
  getRows: (d) => d.streakActivityMeta
};

const waterConfig: UserDataTableSchema<WaterConfig, { id: 1 }> = {
  field: 'waterConfig',
  sqlTable: 'water_config',
  columns: ['target_ml', 'log_day', 'updated_at'],
  rowKey: [],
  serverUserIdIndex: 0,
  mergeKind: 'singleton',
  singleton: true,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.target_ml, r.log_day, r.updated_at],
  bindDeleteKey: () => [],
  getRows: (d) => (d.waterConfig ? [d.waterConfig] : []),
  getSingleton: (d) => d.waterConfig
};

const waterEntries: UserDataTableSchema<WaterEntry, { id: string }> = {
  field: 'waterEntries',
  sqlTable: 'water_entries',
  columns: ['id', 'log_day', 'label', 'ml', 'count', 'updated_at', 'deleted'],
  rowKey: ['id', 'log_day'],
  serverUserIdIndex: 1,
  mergeKind: 'row_lww',
  singleton: false,
  updatedAtColumn: 'updated_at',
  bind: (r) => [r.id, r.log_day, r.label, r.ml, r.count, r.updated_at, r.deleted],
  bindDeleteKey: (k) => [k.id],
  getRows: (d) => d.waterEntries ?? []
};

/** Ordered list — delete/replace uses this order. */
export const USER_DATA_TABLE_SCHEMAS = [
  focus,
  workout,
  appKv,
  nutritionConfig,
  nutritionStaples,
  nutritionRegulars,
  nutritionEntries,
  streakActivities,
  streakLogCells,
  streakActivityMeta,
  waterConfig,
  waterEntries
] as const;

export type AnyUserDataTableSchema = (typeof USER_DATA_TABLE_SCHEMAS)[number];

export const schemaByField = Object.fromEntries(
  USER_DATA_TABLE_SCHEMAS.map((s) => [s.field, s])
) as Record<UserDataTable, AnyUserDataTableSchema>;

export const clientSelectSql = (s: AnyUserDataTableSchema): string => {
  const cols = s.columns.join(',');
  if (s.singleton) return `SELECT ${cols} FROM ${s.sqlTable} WHERE id=1`;
  const order = s.orderBy ? ` ORDER BY ${s.orderBy}` : '';
  return `SELECT ${cols} FROM ${s.sqlTable}${order}`;
};

export const clientInsertSql = (s: AnyUserDataTableSchema): string => {
  if (s.singleton) {
    const cols = ['id', ...s.columns];
    return `INSERT OR REPLACE INTO ${s.sqlTable} (${cols.join(',')}) VALUES (1,${ph(s.columns.length)})`;
  }
  return `INSERT INTO ${s.sqlTable} (${s.columns.join(',')}) VALUES (${ph(s.columns.length)})`;
};

export const serverSelectSql = (s: AnyUserDataTableSchema): string => {
  const cols = s.columns.join(',');
  const order = s.orderBy ? ` ORDER BY ${s.orderBy}` : '';
  return `SELECT ${cols} FROM ${s.sqlTable} WHERE user_id=?${order}`;
};

export const serverInsertColumns = (s: AnyUserDataTableSchema): string[] => {
  const cols = [...s.columns];
  cols.splice(s.serverUserIdIndex, 0, 'user_id');
  return cols;
};

export const serverBindInsert = (s: AnyUserDataTableSchema, row: unknown, userId: string): unknown[] => {
  const vals = [...s.bind(row as never)];
  vals.splice(s.serverUserIdIndex, 0, userId);
  return vals;
};

export const serverPlainInsertSql = (s: AnyUserDataTableSchema): string => {
  const cols = serverInsertColumns(s);
  return `INSERT INTO ${s.sqlTable} (${cols.join(',')}) VALUES (${ph(cols.length)})`;
};

/** Conflict target columns including user_id for multi-row tables. */
export const serverConflictColumns = (s: AnyUserDataTableSchema): string[] => {
  if (s.singleton || s.rowKey.length === 0) return ['user_id'];
  // Match existing schema: most tables use (id,user_id) or (key parts + user_id)
  // streak_log_cells: (log_date, activity_id, user_id)
  // nutrition_entries / water_entries: (id, user_id, log_day)
  if (s.sqlTable === 'app_kv') return ['user_id', 'key'];
  if (s.sqlTable === 'streak_log_cells') return ['log_date', 'activity_id', 'user_id'];
  if (s.sqlTable === 'nutrition_entries' || s.sqlTable === 'water_entries') return ['id', 'user_id', 'log_day'];
  if (s.sqlTable === 'streak_activity_meta') return ['activity_id', 'user_id'];
  // default: id + user_id (first rowKey is typically id)
  return [s.rowKey[0]!, 'user_id'];
};

export const serverPatchUpsertSql = (s: AnyUserDataTableSchema): string => {
  const cols = serverInsertColumns(s);
  const insert = `INSERT INTO ${s.sqlTable} (${cols.join(',')}) VALUES (${ph(cols.length)})`;
  const conflict = serverConflictColumns(s).join(',');
  if (s.mergeKind === 'append_only') {
    return `${insert} ON CONFLICT(${conflict}) DO NOTHING`;
  }
  const updatable = s.columns.filter((c) => !s.rowKey.includes(c));
  const sets = updatable.map((c) => `${c}=excluded.${c}`).join(',\n              ');
  const clock = s.updatedAtColumn ?? 'updated_at';
  return `${insert}
            ON CONFLICT(${conflict}) DO UPDATE SET
              ${sets}
            WHERE excluded.${clock} >= ${s.sqlTable}.${clock}`;
};

export const serverDeleteSql = (s: AnyUserDataTableSchema): string => {
  if (s.singleton || s.rowKey.length === 0) {
    return `DELETE FROM ${s.sqlTable} WHERE user_id=?`;
  }
  // delete key order must match bindDeleteKey + user_id first for WHERE
  if (s.sqlTable === 'streak_log_cells') {
    return `DELETE FROM ${s.sqlTable} WHERE user_id=? AND log_date=? AND activity_id=?`;
  }
  if (s.sqlTable === 'streak_activity_meta') {
    return `DELETE FROM ${s.sqlTable} WHERE user_id=? AND activity_id=?`;
  }
  if (s.sqlTable === 'app_kv') {
    return `DELETE FROM ${s.sqlTable} WHERE user_id=? AND key=?`;
  }
  // nutrition_entries / water_entries delete by id only in current server code
  if (s.rowKey[0] === 'id') {
    return `DELETE FROM ${s.sqlTable} WHERE user_id=? AND id=?`;
  }
  const parts = s.rowKey.map((k) => `${k}=?`).join(' AND ');
  return `DELETE FROM ${s.sqlTable} WHERE user_id=? AND ${parts}`;
};
