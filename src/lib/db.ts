import Database from '@tauri-apps/plugin-sql';

export const DB_ID = 'sqlite:mgmt.db';

let dbLoadPromise: Promise<Database> | null = null;

export const getDb = async (): Promise<Database> => {
  if (!dbLoadPromise) dbLoadPromise = Database.load(DB_ID);
  return dbLoadPromise;
};
