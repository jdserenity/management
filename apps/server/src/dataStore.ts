import type Database from 'better-sqlite3';

// ── Shape mirrors local.db columns exactly, just with user_id added ──────────

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

export class SqliteDataStore {
  constructor(private readonly db: Database.Database) {}

  getData(userId: string): UserData {
    const uid = userId;
    return {
      focusLog: this.db.prepare<[string], FocusLogRow>(
        'SELECT id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio FROM focus_log WHERE user_id=? ORDER BY completed_at DESC'
      ).all(uid),
      workoutLog: this.db.prepare<[string], WorkoutLogRow>(
        'SELECT id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio FROM workout_log WHERE user_id=? ORDER BY completed_at DESC'
      ).all(uid),
      appKv: this.db.prepare<[string], AppKvRow>(
        'SELECT key,value,updated_at FROM app_kv WHERE user_id=?'
      ).all(uid),
      nutritionConfig: (this.db.prepare<[string], NutritionConfig>(
        'SELECT tdee,protein,log_day FROM nutrition_config WHERE user_id=?'
      ).get(uid)) ?? null,
      nutritionStaples: this.db.prepare<[string], NutritionStaple>(
        'SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_staples WHERE user_id=? ORDER BY sort_order'
      ).all(uid),
      nutritionRegulars: this.db.prepare<[string], NutritionRegular>(
        'SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_regulars WHERE user_id=? ORDER BY sort_order'
      ).all(uid),
      nutritionEntries: this.db.prepare<[string], NutritionEntry>(
        'SELECT id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted FROM nutrition_entries WHERE user_id=?'
      ).all(uid),
      streakActivities: this.db.prepare<[string], StreakActivity>(
        'SELECT id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order FROM streak_activities WHERE user_id=? ORDER BY sort_order'
      ).all(uid),
      streakLogCells: this.db.prepare<[string], StreakLogCell>(
        'SELECT log_date,activity_id,state,updated_at FROM streak_log_cells WHERE user_id=?'
      ).all(uid),
      streakActivityMeta: this.db.prepare<[string], StreakActivityMeta>(
        'SELECT activity_id,start_date,pause_since,unpaused_at,reset_count FROM streak_activity_meta WHERE user_id=?'
      ).all(uid),
    };
  }

  putData(userId: string, data: UserData): void {
    const uid = userId;
    this.db.transaction(() => {
      for (const row of data.focusLog) {
        this.db.prepare(`
          INSERT INTO focus_log (id,user_id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(id,user_id) DO UPDATE SET
            session_type=excluded.session_type, completed_at=excluded.completed_at,
            duration_minutes=excluded.duration_minutes, planned_duration_minutes=excluded.planned_duration_minutes,
            completion_ratio=excluded.completion_ratio
        `).run(row.id, uid, row.session_type, row.completed_at, row.duration_minutes, row.planned_duration_minutes ?? null, row.completion_ratio ?? null);
      }

      for (const row of data.workoutLog) {
        this.db.prepare(`
          INSERT INTO workout_log (id,user_id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio)
          VALUES (?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id,user_id) DO UPDATE SET
            workout_id=excluded.workout_id, workout_name=excluded.workout_name, completed_at=excluded.completed_at,
            exercises_json=excluded.exercises_json, total_reps=excluded.total_reps,
            total_timed_seconds=excluded.total_timed_seconds, completion_ratio=excluded.completion_ratio
        `).run(row.id, uid, row.workout_id, row.workout_name, row.completed_at, row.exercises_json, row.total_reps, row.total_timed_seconds, row.completion_ratio ?? null);
      }

      for (const row of data.appKv) {
        this.db.prepare(`
          INSERT INTO app_kv (user_id,key,value,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
          WHERE excluded.updated_at >= app_kv.updated_at
        `).run(uid, row.key, row.value, row.updated_at);
      }

      if (data.nutritionConfig) {
        const nc = data.nutritionConfig;
        this.db.prepare(`
          INSERT INTO nutrition_config (user_id,tdee,protein,log_day) VALUES (?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET tdee=excluded.tdee, protein=excluded.protein, log_day=excluded.log_day
        `).run(uid, nc.tdee, nc.protein, nc.log_day);
      }

      for (const row of data.nutritionStaples) {
        this.db.prepare(`
          INSERT INTO nutrition_staples (id,user_id,name,calories,protein,ingredients_json,sort_order)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(id,user_id) DO UPDATE SET
            name=excluded.name, calories=excluded.calories, protein=excluded.protein,
            ingredients_json=excluded.ingredients_json, sort_order=excluded.sort_order
        `).run(row.id, uid, row.name, row.calories, row.protein, row.ingredients_json ?? null, row.sort_order);
      }

      for (const row of data.nutritionRegulars) {
        this.db.prepare(`
          INSERT INTO nutrition_regulars (id,user_id,name,calories,protein,ingredients_json,sort_order)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(id,user_id) DO UPDATE SET
            name=excluded.name, calories=excluded.calories, protein=excluded.protein,
            ingredients_json=excluded.ingredients_json, sort_order=excluded.sort_order
        `).run(row.id, uid, row.name, row.calories, row.protein, row.ingredients_json ?? null, row.sort_order);
      }

      for (const row of data.nutritionEntries) {
        this.db.prepare(`
          INSERT INTO nutrition_entries (id,user_id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id,user_id,log_day) DO UPDATE SET
            kind=excluded.kind, ref_id=excluded.ref_id, label=excluded.label, calories=excluded.calories,
            protein=excluded.protein, count=excluded.count, updated_at=excluded.updated_at, deleted=excluded.deleted
        `).run(row.id, uid, row.log_day, row.kind, row.ref_id ?? null, row.label, row.calories, row.protein, row.count, row.updated_at, row.deleted);
      }

      for (const row of data.streakActivities) {
        this.db.prepare(`
          INSERT INTO streak_activities (id,user_id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id,user_id) DO UPDATE SET
            name=excluded.name, description=excluded.description, frequency=excluded.frequency,
            weekly_target=excluded.weekly_target, scheduled_days_json=excluded.scheduled_days_json,
            can_fail=excluded.can_fail, archived_at=excluded.archived_at, sort_order=excluded.sort_order
        `).run(row.id, uid, row.name, row.description ?? null, row.frequency, row.weekly_target ?? null, row.scheduled_days_json ?? null, row.can_fail, row.archived_at ?? null, row.sort_order);
      }

      for (const row of data.streakLogCells) {
        this.db.prepare(`
          INSERT INTO streak_log_cells (log_date,activity_id,user_id,state,updated_at)
          VALUES (?,?,?,?,?)
          ON CONFLICT(log_date,activity_id,user_id) DO UPDATE SET
            state=excluded.state, updated_at=excluded.updated_at
        `).run(row.log_date, row.activity_id, uid, row.state, row.updated_at);
      }

      for (const row of data.streakActivityMeta) {
        this.db.prepare(`
          INSERT INTO streak_activity_meta (activity_id,user_id,start_date,pause_since,unpaused_at,reset_count)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(activity_id,user_id) DO UPDATE SET
            start_date=excluded.start_date, pause_since=excluded.pause_since,
            unpaused_at=excluded.unpaused_at, reset_count=excluded.reset_count
        `).run(row.activity_id, uid, row.start_date ?? null, row.pause_since ?? null, row.unpaused_at ?? null, row.reset_count);
      }
    })();
  }
}
