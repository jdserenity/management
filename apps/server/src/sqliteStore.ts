import Database from 'better-sqlite3';
import type { ActiveFlowDocument } from '@mgmt/sync';
import { mergeActiveFlowDocument } from '@mgmt/sync';
import type { ActiveFlowStore } from './store';
import { parseActiveFlowDocument } from './store';

export class SqliteActiveFlowStore implements ActiveFlowStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_flow_singleton (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        doc_json TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      )
    `);
  }

  async get(): Promise<ActiveFlowDocument | null> {
    const row = this.db
      .prepare<[], { doc_json: string }>('SELECT doc_json FROM active_flow_singleton WHERE id = 1')
      .get();
    if (!row) return null;
    return parseActiveFlowDocument(row.doc_json);
  }

  async put(doc: ActiveFlowDocument | null): Promise<ActiveFlowDocument | null> {
    if (!doc) {
      this.db.prepare('DELETE FROM active_flow_singleton WHERE id = 1').run();
      return null;
    }
    const current = await this.get();
    const merged = mergeActiveFlowDocument(current, doc);
    if (!merged) return null;
    if (current && merged.updatedAtMs < current.updatedAtMs) return current;
    this.db.prepare(`
      INSERT INTO active_flow_singleton (id, doc_json, updated_at_ms)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        doc_json = excluded.doc_json,
        updated_at_ms = excluded.updated_at_ms
      WHERE excluded.updated_at_ms >= active_flow_singleton.updated_at_ms
    `).run(JSON.stringify(merged), merged.updatedAtMs);
    return (await this.get()) ?? merged;
  }
}

export const createSqliteStore = (dbPath: string): SqliteActiveFlowStore =>
  new SqliteActiveFlowStore(dbPath);
