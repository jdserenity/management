import { getDb } from '@/lib/db';

/** ISO timestamp for sync-friendly updated_at columns. */
export const syncNow = (): string => new Date().toISOString();

/** Run an upsert/execute against the app SQLite DB. */
export const dbExecute = async (sql: string, bind: unknown[] = []): Promise<void> => {
  const db = await getDb();
  await db.execute(sql, bind);
};

/** Select rows — pass the full result type as T (e.g. `Row[]`), matching Tauri SQL `db.select<T>`. */
export const dbSelect = async <T>(sql: string, bind: unknown[] = []): Promise<T> => {
  const db = await getDb();
  return db.select<T>(sql, bind);
};

/** Soft flag coercion from SQLite plugin (bool / 0-1 / '0'-'1'). */
export const sqlFlag = (value: unknown): boolean => value === true || value === 1 || value === '1';

/** DELETE all rows, or all except the given id list (`WHERE id NOT IN (...)`). */
export const dbDeleteExceptIds = async (table: string, ids: string[], idColumn = 'id'): Promise<void> => {
  if (!ids.length) {
    await dbExecute(`DELETE FROM ${table}`);
    return;
  }
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await dbExecute(`DELETE FROM ${table} WHERE ${idColumn} NOT IN (${placeholders})`, ids);
};

/** DELETE rows for a day that are not in the given id list. */
export const dbDeleteDayExceptIds = async (
  table: string,
  day: string,
  ids: string[],
  dayColumn = 'log_day',
  idColumn = 'id'
): Promise<void> => {
  if (!ids.length) {
    await dbExecute(`DELETE FROM ${table} WHERE ${dayColumn}=$1`, [day]);
    return;
  }
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  await dbExecute(
    `DELETE FROM ${table} WHERE ${dayColumn}=$1 AND ${idColumn} NOT IN (${placeholders})`,
    [day, ...ids]
  );
};
