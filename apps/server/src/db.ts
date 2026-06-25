import Database from 'better-sqlite3';

/** All DDL for server.db. Idempotent — safe to run on every startup. */
const SCHEMA_SQL = `
  -- ── Active session (existing, no user scoping — shared timer state) ──────────
  CREATE TABLE IF NOT EXISTS active_flow_singleton (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    doc_json TEXT NOT NULL,
    updated_at_ms INTEGER NOT NULL
  );

  -- ── Identity ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Focus & movement logs ────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS focus_log (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    session_type TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    planned_duration_minutes INTEGER,
    completion_ratio REAL,
    PRIMARY KEY (id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_focus_log_user ON focus_log (user_id, completed_at DESC);

  CREATE TABLE IF NOT EXISTS workout_log (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    workout_id TEXT NOT NULL,
    workout_name TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    exercises_json TEXT NOT NULL,
    total_reps INTEGER NOT NULL,
    total_timed_seconds INTEGER NOT NULL,
    completion_ratio REAL,
    PRIMARY KEY (id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_workout_log_user ON workout_log (user_id, completed_at DESC);

  -- ── App key-value store ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS app_kv (
    user_id TEXT NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );

  -- ── Nutrition ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS nutrition_config (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    tdee INTEGER NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    log_day TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS nutrition_staples (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL DEFAULT 0,
    ingredients_json TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS nutrition_regulars (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL DEFAULT 0,
    ingredients_json TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS nutrition_entries (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    log_day TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT,
    label TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL DEFAULT 0,
    count INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id, log_day)
  );

  -- ── Streak / habits ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS streak_activities (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL DEFAULT '',
    description TEXT,
    frequency TEXT NOT NULL DEFAULT 'daily',
    weekly_target INTEGER,
    scheduled_days_json TEXT,
    can_fail INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS streak_log_cells (
    log_date TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    state TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (log_date, activity_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS streak_activity_meta (
    activity_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    start_date TEXT,
    pause_since TEXT,
    unpaused_at TEXT,
    reset_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (activity_id, user_id)
  );
`;

export const openServerDb = (dbPath: string): Database.Database => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
};

export const seedOwnerUser = (db: Database.Database, ownerId: string): void => {
  db.prepare(`
    INSERT INTO users (id, created_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(id) DO NOTHING
  `).run(ownerId);
};
