import type { SqlDatabase } from '@mgmt/storage';
import { wrapWithDataSync } from '@mgmt/sync';

export type { SqlDatabase };

export const DB_ID = 'sqlite:local.db';

let registeredBackend: SqlDatabase | null = null;
let tauriLoadPromise: Promise<SqlDatabase> | null = null;

const wrapTauriDb = (db: {
  select: <T>(query: string, bind?: unknown[]) => Promise<T>;
  execute: (query: string, bind?: unknown[]) => Promise<{ lastInsertId?: number; rowsAffected: number }>;
}): SqlDatabase => {
  const base: SqlDatabase = {
    select: (query, bind) => db.select(query, bind),
    execute: async (query, bind) => {
      const result = await db.execute(query, bind);
      return { lastInsertId: result.lastInsertId ?? 0, rowsAffected: result.rowsAffected };
    }
  };
  return wrapWithDataSync(
    base,
    import.meta.env.VITE_SERVER_URL as string | undefined,
    import.meta.env.VITE_SERVER_TOKEN as string | undefined
  );
};

export const registerSqlBackend = (backend: SqlDatabase): void => {
  registeredBackend = backend;
};

export const getDb = async (): Promise<SqlDatabase> => {
  if (registeredBackend) return registeredBackend;
  if (!tauriLoadPromise) {
    tauriLoadPromise = import('@tauri-apps/plugin-sql').then(({ default: Database }) =>
      Database.load(DB_ID).then(wrapTauriDb)
    );
  }
  return tauriLoadPromise;
};
