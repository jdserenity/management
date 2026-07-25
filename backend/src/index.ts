import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createSyncApp } from './app';
import { createSqliteStore } from './sqliteStore';
import { SqliteDataStore } from './dataStore';
import { openServerDb, seedOwnerUser } from './db';
import { resolveDbPath } from './dbPath';
import { resolveBackupDir, startDailyServerDbBackup } from './dbBackup';
import { createR2OffsiteUploader, resolveR2OffsiteConfig } from './r2Offsite';

const port = Number(process.env.PORT ?? 8787);
const apiToken = process.env.SERVER_TOKEN ?? 'dev-token';
const ownerId = process.env.OWNER_USER_ID ?? 'owner';
const dbPath = resolveDbPath(process.env.DB_PATH);
const backupDir = resolveBackupDir(dbPath, process.env.BACKUP_DIR);
const r2Config = resolveR2OffsiteConfig();
const offsite = r2Config ? createR2OffsiteUploader(r2Config) : undefined;

const db = openServerDb(dbPath);
seedOwnerUser(db, ownerId);

const flowStore = createSqliteStore(db);
const dataStore = new SqliteDataStore(db);
const app = createSyncApp(flowStore, dataStore, apiToken, ownerId);

const stopDailyBackup = startDailyServerDbBackup(db, dbPath, { backupDir, offsite });

const server = serve({ fetch: app.fetch, port }, (info) => {
  const offsiteLabel = r2Config ? `r2://${r2Config.bucket}/${r2Config.prefix}` : 'off';
  console.log(`server listening on http://localhost:${info.port} (db: ${dbPath}; backups: ${backupDir}; offsite: ${offsiteLabel})`);
}) as Server;

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use — server is probably already running. Stop it or set PORT.`);
    process.exit(1);
  }
  throw err;
});

const shutdown = () => {
  stopDailyBackup();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
