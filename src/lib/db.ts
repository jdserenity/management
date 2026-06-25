import type { SqlDatabase } from '@mgmt/storage';
import Database from '@tauri-apps/plugin-sql';

export type { SqlDatabase };

export const DB_ID = 'sqlite:mgmt.db';

let registeredBackend: SqlDatabase | null = null;
let tauriLoadPromise: Promise<SqlDatabase> | null = null;

const wrapTauriDb = (db: Database): SqlDatabase => ({
  select: (query, bind) => db.select(query, bind),
  execute: async (query, bind) => {
    const result = await db.execute(query, bind);
    return { lastInsertId: result.lastInsertId ?? 0, rowsAffected: result.rowsAffected };
  }
});

export const registerSqlBackend = (backend: SqlDatabase): void => {
  registeredBackend = backend;
};

export const getDb = async (): Promise<SqlDatabase> => {
  if (registeredBackend) return registeredBackend;
  if (!tauriLoadPromise) tauriLoadPromise = Database.load(DB_ID).then(wrapTauriDb);
  return tauriLoadPromise;
};
