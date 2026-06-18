import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createSyncApp } from './app';
import { createLibsqlStore } from './libsqlStore';
import { resolveLibsqlUrl } from './libsqlUrl';

const port = Number(process.env.PORT ?? 8787);
const apiToken = process.env.SYNC_API_TOKEN ?? 'dev-token';
const libsqlUrl = resolveLibsqlUrl(process.env.LIBSQL_URL);
const libsqlAuthToken = process.env.LIBSQL_AUTH_TOKEN ?? undefined;

const store = await createLibsqlStore(libsqlUrl, libsqlAuthToken);
const app = createSyncApp(store, apiToken);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`sync-api listening on http://localhost:${info.port}`);
}) as Server;

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use — sync-api is probably already running. Stop it or set PORT.`);
    process.exit(1);
  }
  throw err;
});
