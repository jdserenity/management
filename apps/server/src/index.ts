import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createSyncApp } from './app';
import { createSqliteStore } from './sqliteStore';
import { resolveDbPath } from './dbPath';

const port = Number(process.env.PORT ?? 8787);
const apiToken = process.env.SERVER_TOKEN ?? 'dev-token';
const dbPath = resolveDbPath(process.env.DB_PATH);

const store = createSqliteStore(dbPath);
const app = createSyncApp(store, apiToken);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`);
}) as Server;

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use — server is probably already running. Stop it or set PORT.`);
    process.exit(1);
  }
  throw err;
});
