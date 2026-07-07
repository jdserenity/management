export type SchemaMigration = { version: number; description: string; sql: string };

/** Keep in sync with desktop/src-tauri/src/main.rs sqlite:local.db migrations (v1–v11). */
export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    description: 'create posture log table',
    sql: 'CREATE TABLE IF NOT EXISTS posture_log (id INTEGER PRIMARY KEY AUTOINCREMENT, score INTEGER NOT NULL, is_turtle_neck BOOLEAN NOT NULL, is_shoulder_misaligned BOOLEAN NOT NULL, timestamp INTEGER NOT NULL);'
  },
  {
    version: 2,
    description: 'posture_log_metrics_json',
    sql: 'ALTER TABLE posture_log ADD COLUMN metrics_json TEXT;'
  },
  {
    version: 3,
    description: 'session_focus_workout_logs_and_app_kv',
    sql: "CREATE TABLE IF NOT EXISTS focus_log (id TEXT PRIMARY KEY NOT NULL, session_type TEXT NOT NULL, completed_at INTEGER NOT NULL, duration_minutes INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workout_log (id TEXT PRIMARY KEY NOT NULL, workout_id TEXT NOT NULL, workout_name TEXT NOT NULL, completed_at INTEGER NOT NULL, exercises_json TEXT NOT NULL, total_reps INTEGER NOT NULL, total_timed_seconds INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_focus_log_completed_at ON focus_log (completed_at DESC); CREATE INDEX IF NOT EXISTS idx_workout_log_completed_at ON workout_log (completed_at DESC);"
  },
  {
    version: 4,
    description: 'partial_session_completion_columns',
    sql: 'ALTER TABLE focus_log ADD COLUMN planned_duration_minutes INTEGER; ALTER TABLE focus_log ADD COLUMN completion_ratio REAL; ALTER TABLE workout_log ADD COLUMN completion_ratio REAL; UPDATE focus_log SET planned_duration_minutes = duration_minutes, completion_ratio = 1.0 WHERE planned_duration_minutes IS NULL; UPDATE workout_log SET completion_ratio = 1.0 WHERE completion_ratio IS NULL;'
  },
  {
    version: 5,
    description: 'nutrition_tdee_tables',
    sql: "CREATE TABLE IF NOT EXISTS nutrition_config (id INTEGER PRIMARY KEY CHECK (id = 1), tdee INTEGER NOT NULL DEFAULT 0, protein INTEGER NOT NULL DEFAULT 0, log_day TEXT NOT NULL DEFAULT ''); CREATE TABLE IF NOT EXISTS nutrition_staples (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS nutrition_regulars (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS nutrition_entries (id TEXT NOT NULL, log_day TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, label TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day));"
  },
  {
    version: 6,
    description: 'streak_tracker_tables',
    sql: "CREATE TABLE IF NOT EXISTS streak_activities (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', description TEXT, frequency TEXT NOT NULL DEFAULT 'daily', weekly_target INTEGER, scheduled_days_json TEXT, can_fail INTEGER NOT NULL DEFAULT 0, archived_at TEXT, sort_order INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS streak_log_cells (log_date TEXT NOT NULL, activity_id TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (log_date, activity_id)); CREATE TABLE IF NOT EXISTS streak_activity_meta (activity_id TEXT PRIMARY KEY, start_date TEXT, pause_since TEXT, unpaused_at TEXT, reset_count INTEGER NOT NULL DEFAULT 0);"
  },
  {
    version: 7,
    description: 'nutrition_protein_real',
    sql: "CREATE TABLE nutrition_config_new (id INTEGER PRIMARY KEY CHECK (id = 1), tdee INTEGER NOT NULL DEFAULT 0, protein REAL NOT NULL DEFAULT 0, log_day TEXT NOT NULL DEFAULT ''); INSERT INTO nutrition_config_new SELECT id, tdee, CAST(protein AS REAL), log_day FROM nutrition_config; DROP TABLE nutrition_config; ALTER TABLE nutrition_config_new RENAME TO nutrition_config; CREATE TABLE nutrition_staples_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); INSERT INTO nutrition_staples_new SELECT id, name, calories, CAST(protein AS REAL), ingredients_json, sort_order FROM nutrition_staples; DROP TABLE nutrition_staples; ALTER TABLE nutrition_staples_new RENAME TO nutrition_staples; CREATE TABLE nutrition_regulars_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); INSERT INTO nutrition_regulars_new SELECT id, name, calories, CAST(protein AS REAL), ingredients_json, sort_order FROM nutrition_regulars; DROP TABLE nutrition_regulars; ALTER TABLE nutrition_regulars_new RENAME TO nutrition_regulars; CREATE TABLE nutrition_entries_new (id TEXT NOT NULL, log_day TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, label TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day)); INSERT INTO nutrition_entries_new SELECT id, log_day, kind, ref_id, label, calories, CAST(protein AS REAL), count, updated_at, deleted FROM nutrition_entries; DROP TABLE nutrition_entries; ALTER TABLE nutrition_entries_new RENAME TO nutrition_entries;"
  },
  {
    version: 8,
    description: 'water_tracker_tables',
    sql: "CREATE TABLE IF NOT EXISTS water_config (id INTEGER PRIMARY KEY CHECK (id = 1), target_ml INTEGER NOT NULL DEFAULT 2500, log_day TEXT NOT NULL DEFAULT ''); CREATE TABLE IF NOT EXISTS water_entries (id TEXT NOT NULL, log_day TEXT NOT NULL, label TEXT NOT NULL, ml INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day));"
  },
  {
    version: 9,
    description: 'streak_activity_cross_log_columns',
    sql: 'ALTER TABLE streak_activities ADD COLUMN extra_calories INTEGER; ALTER TABLE streak_activities ADD COLUMN extra_protein REAL; ALTER TABLE streak_activities ADD COLUMN extra_water_ml INTEGER;'
  },
  {
    version: 10,
    description: 'sync_row_updated_at_columns',
    sql: "ALTER TABLE streak_activities ADD COLUMN updated_at TEXT; UPDATE streak_activities SET updated_at = COALESCE(archived_at, datetime('now')) WHERE updated_at IS NULL; ALTER TABLE streak_activity_meta ADD COLUMN updated_at TEXT; UPDATE streak_activity_meta SET updated_at = COALESCE(unpaused_at, pause_since, start_date, datetime('now')) WHERE updated_at IS NULL; ALTER TABLE nutrition_staples ADD COLUMN updated_at TEXT; UPDATE nutrition_staples SET updated_at = datetime('now') WHERE updated_at IS NULL; ALTER TABLE nutrition_regulars ADD COLUMN updated_at TEXT; UPDATE nutrition_regulars SET updated_at = datetime('now') WHERE updated_at IS NULL; ALTER TABLE nutrition_config ADD COLUMN updated_at TEXT; UPDATE nutrition_config SET updated_at = COALESCE(NULLIF(log_day, '') || 'T12:00:00', datetime('now')) WHERE updated_at IS NULL; ALTER TABLE water_config ADD COLUMN updated_at TEXT; UPDATE water_config SET updated_at = COALESCE(NULLIF(log_day, '') || 'T12:00:00', datetime('now')) WHERE updated_at IS NULL;"
  },
  {
    version: 11,
    description: 'sync_outbox_table',
    sql: 'CREATE TABLE IF NOT EXISTS sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, patch_json TEXT NOT NULL, created_at INTEGER NOT NULL);'
  }
];

export const LATEST_SCHEMA_VERSION = SCHEMA_MIGRATIONS[SCHEMA_MIGRATIONS.length - 1]?.version ?? 0;
