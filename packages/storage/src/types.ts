/** Matches @tauri-apps/plugin-sql Database select/execute surface used across src/lib/*Db.ts */
export interface SqlDatabase {
  select<T>(query: string, bind?: unknown[]): Promise<T>;
  execute(query: string, bind?: unknown[]): Promise<{ lastInsertId: number; rowsAffected: number }>;
}
