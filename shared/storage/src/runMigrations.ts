import type { SqlDatabase } from './types';
import { LATEST_SCHEMA_VERSION, SCHEMA_MIGRATIONS } from './migrations';

const META_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
)`;

export const runSchemaMigrations = async (db: SqlDatabase): Promise<boolean> => {
  await db.execute(META_TABLE);
  const rows = await db.select<{ version: number }[]>('SELECT version FROM schema_migrations ORDER BY version');
  const applied = new Set(rows.map((r) => r.version));
  const now = Date.now();
  let changed = false;
  for (const migration of SCHEMA_MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    changed = true;
    const statements = migration.sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) {
      try {
        await db.execute(statement);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (migration.version === 2 && msg.includes('duplicate column')) continue;
        if (migration.version === 4 && msg.includes('duplicate column')) continue;
        throw error;
      }
    }
    await db.execute('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [migration.version, now]);
  }
  if (LATEST_SCHEMA_VERSION > 0 && applied.size === 0 && SCHEMA_MIGRATIONS.length > 0) {
    /* fresh db: versions recorded per migration above */
  }
  return changed;
};
