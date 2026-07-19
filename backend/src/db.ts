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
    log_day TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nutrition_staples (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL DEFAULT 0,
    ingredients_json TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
    necessary INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    linked_staple_id TEXT,
    linked_water INTEGER NOT NULL DEFAULT 0,
    linked_movement_burst INTEGER NOT NULL DEFAULT 0,
    extra_calories INTEGER,
    extra_protein REAL,
    extra_water_ml INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (activity_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS water_config (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    target_ml INTEGER NOT NULL DEFAULT 2500,
    log_day TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS water_entries (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    log_day TEXT NOT NULL,
    label TEXT NOT NULL,
    ml INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id, log_day)
  );

  -- Hard-delete markers so clients can drop rows that still exist only locally
  CREATE TABLE IF NOT EXISTS sync_tombstones (
    entity TEXT NOT NULL,
    row_key TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (entity, row_key, user_id)
  );
`;

const migrateServerSchema = (db: Database.Database): void => {
  for (const sql of [
    'ALTER TABLE streak_activities ADD COLUMN extra_calories INTEGER',
    'ALTER TABLE streak_activities ADD COLUMN extra_protein REAL',
    'ALTER TABLE streak_activities ADD COLUMN extra_water_ml INTEGER',
    'ALTER TABLE streak_activities ADD COLUMN updated_at TEXT',
    'ALTER TABLE streak_activities ADD COLUMN necessary INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE streak_activities ADD COLUMN linked_staple_id TEXT',
    'ALTER TABLE streak_activities ADD COLUMN linked_water INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE streak_activities ADD COLUMN linked_movement_burst INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE streak_activity_meta ADD COLUMN updated_at TEXT',
    'ALTER TABLE nutrition_staples ADD COLUMN updated_at TEXT',
    'ALTER TABLE nutrition_regulars ADD COLUMN updated_at TEXT',
    'ALTER TABLE nutrition_config ADD COLUMN updated_at TEXT',
    'ALTER TABLE water_config ADD COLUMN updated_at TEXT'
  ]) {
    try { db.exec(sql); } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('duplicate column')) throw error;
    }
  }
  db.exec(`
    UPDATE streak_activities SET updated_at = COALESCE(archived_at, datetime('now')) WHERE updated_at IS NULL;
    UPDATE streak_activity_meta SET updated_at = COALESCE(unpaused_at, pause_since, start_date, datetime('now')) WHERE updated_at IS NULL;
    UPDATE nutrition_staples SET updated_at = datetime('now') WHERE updated_at IS NULL;
    UPDATE nutrition_regulars SET updated_at = datetime('now') WHERE updated_at IS NULL;
    UPDATE nutrition_config SET updated_at = COALESCE(NULLIF(log_day, '') || 'T12:00:00', datetime('now')) WHERE updated_at IS NULL;
    UPDATE water_config SET updated_at = COALESCE(NULLIF(log_day, '') || 'T12:00:00', datetime('now')) WHERE updated_at IS NULL;
  `);
  // SQLite string ops truncate at NUL; rewrite tombstone keys in JS (sql.js / phone cannot store \0).
  rewriteSyncTombstoneRowKeys(db);
};

/** Replace legacy \\0 separators with U+001F so phone hydrate does not hit UNIQUE collisions. */
export const rewriteSyncTombstoneRowKeys = (db: Database.Database): number => {
  const rows = db.prepare('SELECT entity, row_key, user_id, deleted_at FROM sync_tombstones').all() as Array<{
    entity: string; row_key: string; user_id: string; deleted_at: string;
  }>;
  let changed = 0;
  const del = db.prepare('DELETE FROM sync_tombstones WHERE entity=? AND row_key=? AND user_id=?');
  const ins = db.prepare(
    'INSERT INTO sync_tombstones (entity, row_key, user_id, deleted_at) VALUES (?, ?, ?, ?) ON CONFLICT(entity, row_key, user_id) DO UPDATE SET deleted_at=excluded.deleted_at WHERE excluded.deleted_at >= sync_tombstones.deleted_at'
  );
  for (const row of rows) {
    if (!row.row_key.includes('\0')) continue;
    const next = row.row_key.replace(/\0/g, '\x1f');
    del.run(row.entity, row.row_key, row.user_id);
    ins.run(row.entity, next, row.user_id, row.deleted_at);
    changed += 1;
  }
  return changed;
};

export const openServerDb = (dbPath: string): Database.Database => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  migrateServerSchema(db);
  return db;
};

export const seedOwnerUser = (db: Database.Database, ownerId: string): void => {
  db.prepare(`
    INSERT INTO users (id, created_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(id) DO NOTHING
  `).run(ownerId);
};
