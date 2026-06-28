import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';
import type { ActiveFlowDocument } from '@mgmt/sync';
import { DataWipeRefusedError } from '@mgmt/sync';
import type { ActiveFlowStore } from './store';
import type { SqliteDataStore, UserData } from './dataStore';

const parseBodyDoc = (raw: unknown): ActiveFlowDocument | null => {
  if (!raw || typeof raw !== 'object') return null;
  const doc = (raw as { doc?: unknown }).doc;
  if (doc === null) return null;
  if (!doc || typeof doc !== 'object') return null;
  const row = doc as ActiveFlowDocument;
  if (row.version !== 1 || !row.flow) return null;
  return row;
};

export const createSyncApp = (store: ActiveFlowStore, dataStore: SqliteDataStore | null, apiToken: string, ownerId: string = 'owner') => {
  const app = new Hono();
  app.use(
    '*',
    cors({
      origin: (origin) => origin,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'PUT', 'POST', 'OPTIONS']
    })
  );
  const requireAuth = bearerAuth({ token: apiToken });
  app.use('/v1/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') return next();
    return requireAuth(c, next);
  });

  app.get('/health', (c) => c.json({ ok: true }));

  // ── Active flow (timer sync) ────────────────────────────────────────────────
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

  // ── Full user data snapshot ─────────────────────────────────────────────────
  app.get('/v1/data', (c) => {
    if (!dataStore) return c.json({ error: 'data store not available' }, 503);
    const data = dataStore.getData(ownerId);
    return c.json({ data });
  });

  app.post('/v1/data', async (c) => {
    if (!dataStore) return c.json({ error: 'data store not available' }, 503);
    const body = await c.req.json() as { data?: UserData };
    if (!body?.data || typeof body.data !== 'object') {
      return c.json({ error: 'missing data payload' }, 400);
    }
    try {
      dataStore.putData(ownerId, body.data);
    } catch (err) {
      if (err instanceof DataWipeRefusedError) {
        return c.json({ error: 'refusing empty snapshot over existing data' }, 409);
      }
      throw err;
    }
    return c.json({ ok: true });
  });

  return app;
};
