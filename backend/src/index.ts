import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createSyncApp } from './app';
import { createSqliteStore } from './sqliteStore';
import { SqliteDataStore } from './dataStore';
import { openServerDb, seedOwnerUser } from './db';
import { resolveDbPath } from './dbPath';
import { resolveBackupDir, startDailyServerDbBackup } from './dbBackup';

const port = Number(process.env.PORT ?? 8787);
const apiToken = process.env.SERVER_TOKEN ?? 'dev-token';
const ownerId = process.env.OWNER_USER_ID ?? 'owner';
const dbPath = resolveDbPath(process.env.DB_PATH);
const backupDir = resolveBackupDir(dbPath, process.env.BACKUP_DIR);

const db = openServerDb(dbPath);
seedOwnerUser(db, ownerId);

const flowStore = createSqliteStore(db);
const dataStore = new SqliteDataStore(db);
const app = createSyncApp(flowStore, dataStore, apiToken, ownerId);

const stopDailyBackup = startDailyServerDbBackup(db, dbPath, { backupDir });

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port} (db: ${dbPath}; backups: ${backupDir})`);
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
