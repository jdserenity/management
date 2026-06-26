import { registerSqlBackend, type SqlDatabase } from '@/lib/db';
import { fetchUserData, hydrateDb, wrapWithDataSync } from '@mgmt/sync';

export const initCompanionStorage = async (): Promise<SqlDatabase> => {
  const rawDb = await import('./sqlJsStorage').then((m) => m.createCompanionSqlJsDatabase());

  const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  const serverToken = import.meta.env.VITE_SERVER_TOKEN as string | undefined;

  // Pull a fresh snapshot from the server and merge it into the local db.
  if (serverUrl && serverToken) {
    try {
      const data = await fetchUserData(serverUrl, serverToken);
      await hydrateDb(rawDb, data);
    } catch (err) {
      console.warn('[data-sync] startup hydration failed (continuing offline):', err);
    }
  }

  // Wrap the db so every write schedules a debounced push back to the server.
  const db = wrapWithDataSync(rawDb, serverUrl, serverToken);
  registerSqlBackend(db);
  return db;
};
