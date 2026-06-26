import type { SqlDatabase } from '@mgmt/storage';

// ── Row types — mirror local.db columns (no user_id) ──────────────────────────

export interface FocusLogRow {
  id: string; session_type: string; completed_at: number;
  duration_minutes: number; planned_duration_minutes: number | null; completion_ratio: number | null;
}
export interface WorkoutLogRow {
  id: string; workout_id: string; workout_name: string; completed_at: number;
  exercises_json: string; total_reps: number; total_timed_seconds: number; completion_ratio: number | null;
}
export interface AppKvRow { key: string; value: string; updated_at: number; }
export interface NutritionConfig { tdee: number; protein: number; log_day: string; }
export interface NutritionStaple {
  id: string; name: string; calories: number; protein: number;
  ingredients_json: string | null; sort_order: number;
}
export interface NutritionRegular {
  id: string; name: string; calories: number; protein: number;
  ingredients_json: string | null; sort_order: number;
}
export interface NutritionEntry {
  id: string; log_day: string; kind: string; ref_id: string | null;
  label: string; calories: number; protein: number; count: number;
  updated_at: string; deleted: number;
}
export interface StreakActivity {
  id: string; name: string; description: string | null; frequency: string;
  weekly_target: number | null; scheduled_days_json: string | null;
  can_fail: number; archived_at: string | null; sort_order: number;
}
export interface StreakLogCell { log_date: string; activity_id: string; state: string; updated_at: string; }
export interface StreakActivityMeta {
  activity_id: string; start_date: string | null; pause_since: string | null;
  unpaused_at: string | null; reset_count: number;
}

export interface UserData {
  focusLog: FocusLogRow[];
  workoutLog: WorkoutLogRow[];
  appKv: AppKvRow[];
  nutritionConfig: NutritionConfig | null;
  nutritionStaples: NutritionStaple[];
  nutritionRegulars: NutritionRegular[];
  nutritionEntries: NutritionEntry[];
  streakActivities: StreakActivity[];
  streakLogCells: StreakLogCell[];
  streakActivityMeta: StreakActivityMeta[];
}

// ── Read all data from a local-schema db (no user_id columns) ─────────────────

export const extractUserData = async (db: SqlDatabase): Promise<UserData> => ({
  focusLog: await db.select('SELECT id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio FROM focus_log ORDER BY completed_at DESC'),
  workoutLog: await db.select('SELECT id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio FROM workout_log ORDER BY completed_at DESC'),
  appKv: await db.select('SELECT key,value,updated_at FROM app_kv'),
  nutritionConfig: await db.select<NutritionConfig[]>('SELECT tdee,protein,log_day FROM nutrition_config WHERE id=1').then((r) => r[0] ?? null),
  nutritionStaples: await db.select('SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_staples ORDER BY sort_order'),
  nutritionRegulars: await db.select('SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_regulars ORDER BY sort_order'),
  nutritionEntries: await db.select('SELECT id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted FROM nutrition_entries'),
  streakActivities: await db.select('SELECT id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order FROM streak_activities ORDER BY sort_order'),
  streakLogCells: await db.select('SELECT log_date,activity_id,state,updated_at FROM streak_log_cells'),
  streakActivityMeta: await db.select('SELECT activity_id,start_date,pause_since,unpaused_at,reset_count FROM streak_activity_meta'),
});

// ── Write a UserData snapshot into a local-schema db (upsert, never deletes) ──

export const hydrateDb = async (db: SqlDatabase, data: UserData): Promise<void> => {
  for (const r of data.focusLog) {
    await db.execute(
      'INSERT INTO focus_log (id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session_type=excluded.session_type,completed_at=excluded.completed_at,duration_minutes=excluded.duration_minutes,planned_duration_minutes=excluded.planned_duration_minutes,completion_ratio=excluded.completion_ratio',
      [r.id, r.session_type, r.completed_at, r.duration_minutes, r.planned_duration_minutes ?? null, r.completion_ratio ?? null]
    );
  }
  for (const r of data.workoutLog) {
    await db.execute(
      'INSERT INTO workout_log (id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET workout_id=excluded.workout_id,workout_name=excluded.workout_name,completed_at=excluded.completed_at,exercises_json=excluded.exercises_json,total_reps=excluded.total_reps,total_timed_seconds=excluded.total_timed_seconds,completion_ratio=excluded.completion_ratio',
      [r.id, r.workout_id, r.workout_name, r.completed_at, r.exercises_json, r.total_reps, r.total_timed_seconds, r.completion_ratio ?? null]
    );
  }
  for (const r of data.appKv) {
    await db.execute(
      'INSERT INTO app_kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE excluded.updated_at>=app_kv.updated_at',
      [r.key, r.value, r.updated_at]
    );
  }
  if (data.nutritionConfig) {
    const nc = data.nutritionConfig;
    await db.execute(
      'INSERT INTO nutrition_config (id,tdee,protein,log_day) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET tdee=excluded.tdee,protein=excluded.protein,log_day=excluded.log_day',
      [nc.tdee, nc.protein, nc.log_day]
    );
  }
  for (const r of data.nutritionStaples) {
    await db.execute(
      'INSERT INTO nutrition_staples (id,name,calories,protein,ingredients_json,sort_order) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,calories=excluded.calories,protein=excluded.protein,ingredients_json=excluded.ingredients_json,sort_order=excluded.sort_order',
      [r.id, r.name, r.calories, r.protein, r.ingredients_json ?? null, r.sort_order]
    );
  }
  for (const r of data.nutritionRegulars) {
    await db.execute(
      'INSERT INTO nutrition_regulars (id,name,calories,protein,ingredients_json,sort_order) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,calories=excluded.calories,protein=excluded.protein,ingredients_json=excluded.ingredients_json,sort_order=excluded.sort_order',
      [r.id, r.name, r.calories, r.protein, r.ingredients_json ?? null, r.sort_order]
    );
  }
  for (const r of data.nutritionEntries) {
    await db.execute(
      'INSERT INTO nutrition_entries (id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id,log_day) DO UPDATE SET kind=excluded.kind,ref_id=excluded.ref_id,label=excluded.label,calories=excluded.calories,protein=excluded.protein,count=excluded.count,updated_at=excluded.updated_at,deleted=excluded.deleted WHERE excluded.updated_at>=nutrition_entries.updated_at',
      [r.id, r.log_day, r.kind, r.ref_id ?? null, r.label, r.calories, r.protein, r.count, r.updated_at, r.deleted]
    );
  }
  for (const r of data.streakActivities) {
    await db.execute(
      'INSERT INTO streak_activities (id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,frequency=excluded.frequency,weekly_target=excluded.weekly_target,scheduled_days_json=excluded.scheduled_days_json,can_fail=excluded.can_fail,archived_at=excluded.archived_at,sort_order=excluded.sort_order',
      [r.id, r.name, r.description ?? null, r.frequency, r.weekly_target ?? null, r.scheduled_days_json ?? null, r.can_fail, r.archived_at ?? null, r.sort_order]
    );
  }
  for (const r of data.streakLogCells) {
    await db.execute(
      'INSERT INTO streak_log_cells (log_date,activity_id,state,updated_at) VALUES (?,?,?,?) ON CONFLICT(log_date,activity_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at WHERE excluded.updated_at>=streak_log_cells.updated_at',
      [r.log_date, r.activity_id, r.state, r.updated_at]
    );
  }
  for (const r of data.streakActivityMeta) {
    await db.execute(
      'INSERT INTO streak_activity_meta (activity_id,start_date,pause_since,unpaused_at,reset_count) VALUES (?,?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET start_date=excluded.start_date,pause_since=excluded.pause_since,unpaused_at=excluded.unpaused_at,reset_count=excluded.reset_count',
      [r.activity_id, r.start_date ?? null, r.pause_since ?? null, r.unpaused_at ?? null, r.reset_count]
    );
  }
};

// ── HTTP helpers ───────────────────────────────────────────────────────────────

const authHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});

export const fetchUserData = async (baseUrl: string, token: string): Promise<UserData> => {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/data`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`fetchUserData: HTTP ${res.status}`);
  const body = (await res.json()) as { data: UserData };
  return body.data;
};

export const pushUserData = async (baseUrl: string, token: string, data: UserData): Promise<void> => {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/data`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ data })
  });
  if (!res.ok) throw new Error(`pushUserData: HTTP ${res.status}`);
};

// ── Sync-aware db wrapper ──────────────────────────────────────────────────────
// Wraps any SqlDatabase so that writes trigger a debounced push to the server.
// If serverUrl/token are not provided the wrapper is a pass-through.

export const wrapWithDataSync = (
  db: SqlDatabase,
  serverUrl: string | undefined,
  token: string | undefined,
  debounceMs = 2000
): SqlDatabase => {
  if (!serverUrl || !token) return db;
  const url = serverUrl; const tok = token;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void extractUserData(db).then((data) => pushUserData(url, tok, data)).catch((err) => {
        console.warn('[data-sync] push failed:', err);
      });
    }, debounceMs);
  };
  return {
    select: (q, bind) => db.select(q, bind),
    execute: async (q, bind) => {
      const result = await db.execute(q, bind);
      scheduleSync();
      return result;
    }
  };
};
