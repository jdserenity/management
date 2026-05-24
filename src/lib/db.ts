import Database from '@tauri-apps/plugin-sql';

export const DB_ID = 'sqlite:mgmt.db';

let dbInstance: Database | null = null;

export const getDb = async (): Promise<Database> => {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_ID);
  }
  return dbInstance;
};
