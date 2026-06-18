import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';
import type { ActiveFlowDocument } from '@mgmt/sync';
import type { ActiveFlowStore } from './store';

const parseBodyDoc = (raw: unknown): ActiveFlowDocument | null => {
  if (!raw || typeof raw !== 'object') return null;
  const doc = (raw as { doc?: unknown }).doc;
  if (doc === null) return null;
  if (!doc || typeof doc !== 'object') return null;
  const row = doc as ActiveFlowDocument;
  if (row.version !== 1 || !row.flow) return null;
  return row;
};

export const createSyncApp = (store: ActiveFlowStore, apiToken: string) => {
  const app = new Hono();
  app.use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:1420', 'http://127.0.0.1:5173', 'http://127.0.0.1:1420'],
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'PUT', 'OPTIONS']
    })
  );
  app.use('/v1/*', bearerAuth({ token: apiToken }));

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/v1/active-flow', async (c) => {
    const doc = await store.get();
    return c.json({ doc });
  });

  app.put('/v1/active-flow', async (c) => {
    const body = await c.req.json();
    const doc = parseBodyDoc(body);
    if (body && typeof body === 'object' && 'doc' in body && body.doc !== null && !doc) {
      return c.json({ error: 'invalid active flow document' }, 400);
    }
    const saved = await store.put(doc);
    return c.json({ doc: saved });
  });

  return app;
};
