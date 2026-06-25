import { registerSqlBackend, type SqlDatabase } from '@/lib/db';
import { createLibsqlDatabase } from '@mgmt/storage';

export const initCompanionStorage = async (): Promise<SqlDatabase> => {
  const libsqlUrl = import.meta.env.VITE_LIBSQL_URL as string | undefined;
  const db = libsqlUrl
    ? await createLibsqlDatabase(libsqlUrl, import.meta.env.VITE_LIBSQL_AUTH_TOKEN as string | undefined)
    : await import('./sqlJsStorage').then((m) => m.createCompanionSqlJsDatabase());
  registerSqlBackend(db);
  return db;
};
