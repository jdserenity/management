import { createClient, type Client } from '@libsql/client';
import type { ActiveFlowDocument } from '@mgmt/sync';
import { mergeActiveFlowDocument } from '@mgmt/sync';
import type { ActiveFlowStore } from './store';
import { parseActiveFlowDocument } from './store';

export class LibsqlActiveFlowStore implements ActiveFlowStore {
  constructor(private readonly client: Client) {}

  async init(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS active_flow_singleton (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        doc_json TEXT NOT NULL,
        updated_at_ms INTEGER NOT NULL
      )
    `);
  }

  async get(): Promise<ActiveFlowDocument | null> {
    const rs = await this.client.execute('SELECT doc_json FROM active_flow_singleton WHERE id = 1');
    const raw = rs.rows[0]?.doc_json;
    if (typeof raw !== 'string') return null;
    return parseActiveFlowDocument(raw);
  }

  async put(doc: ActiveFlowDocument | null): Promise<ActiveFlowDocument | null> {
    if (!doc) {
      await this.client.execute('DELETE FROM active_flow_singleton WHERE id = 1');
      return null;
    }
    const current = await this.get();
    const merged = mergeActiveFlowDocument(current, doc);
    if (!merged) return null;
    if (current && merged.updatedAtMs < current.updatedAtMs) return current;
    await this.client.execute({
      sql: `INSERT INTO active_flow_singleton (id, doc_json, updated_at_ms)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              doc_json = excluded.doc_json,
              updated_at_ms = excluded.updated_at_ms
            WHERE excluded.updated_at_ms >= active_flow_singleton.updated_at_ms`,
      args: [JSON.stringify(merged), merged.updatedAtMs]
    });
    return (await this.get()) ?? merged;
  }
}

export const createLibsqlStore = async (url: string, authToken?: string): Promise<LibsqlActiveFlowStore> => {
  const client = createClient({ url, authToken: authToken || undefined });
  const store = new LibsqlActiveFlowStore(client);
  await store.init();
  return store;
};
