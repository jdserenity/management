import type { Database, SqlJsStatic } from 'sql.js';
import { toQuestionPlaceholders } from './placeholders';
import { runSchemaMigrations } from './runMigrations';
import type { SqlDatabase } from './types';

const IDB_NAME = 'mgmt-companion-sql';
const IDB_STORE = 'db';
const IDB_KEY = 'mgmt.db';

const openIdb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const loadBytes = async (): Promise<Uint8Array | null> => {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const saveBytes = async (data: Uint8Array): Promise<void> => {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export class SqlJsDatabase implements SqlDatabase {
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private db: Database) {}

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void saveBytes(this.db.export()).catch((error) => console.error('Failed to persist companion SQLite:', error));
    }, 400);
  }

  async select<T>(query: string, bind?: unknown[]): Promise<T> {
    const stmt = this.db.prepare(toQuestionPlaceholders(query));
    try {
      if (bind?.length) stmt.bind(bind);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  }

  async execute(query: string, bind?: unknown[]) {
    this.db.run(toQuestionPlaceholders(query), bind as (string | number | null)[] | undefined);
    this.schedulePersist();
    const changes = this.db.getRowsModified();
    const lastId = this.db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0];
    return { lastInsertId: Number(lastId ?? 0), rowsAffected: changes };
  }

  async flush(): Promise<void> {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    await saveBytes(this.db.export());
  }
}

export type SqlJsInit = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

export const createSqlJsDatabase = async (initSqlJs: SqlJsInit, wasmUrl: string): Promise<SqlJsDatabase> => {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const existing = await loadBytes();
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  const wrapped = new SqlJsDatabase(db);
  await runSchemaMigrations(wrapped);
  await wrapped.flush();
  return wrapped;
};
