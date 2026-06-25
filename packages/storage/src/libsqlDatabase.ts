import { createClient, type Client } from '@libsql/client';
import { toQuestionPlaceholders } from './placeholders';
import { runSchemaMigrations } from './runMigrations';
import type { SqlDatabase } from './types';

const rowToObject = (row: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = value;
  return out;
};

export class LibsqlDatabase implements SqlDatabase {
  constructor(private readonly client: Client) {}

  async select<T>(query: string, bind?: unknown[]): Promise<T> {
    const rs = await this.client.execute({ sql: toQuestionPlaceholders(query), args: bind as (string | number | null)[] | undefined });
    return rs.rows.map((row) => rowToObject(row as Record<string, unknown>)) as T;
  }

  async execute(query: string, bind?: unknown[]) {
    const rs = await this.client.execute({ sql: toQuestionPlaceholders(query), args: bind as (string | number | null)[] | undefined });
    return { lastInsertId: Number(rs.lastInsertRowid ?? 0), rowsAffected: rs.rowsAffected };
  }
}

export const createLibsqlDatabase = async (url: string, authToken?: string): Promise<SqlDatabase> => {
  const client = createClient({ url, authToken: authToken || undefined });
  const db = new LibsqlDatabase(client);
  await runSchemaMigrations(db);
  return db;
};
