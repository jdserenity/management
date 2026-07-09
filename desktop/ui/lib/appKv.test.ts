import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  boolPref,
  deleteAppKv,
  getAppKv,
  intPref,
  jsonPref,
  setAppKv,
  stringPref
} from './appKv';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async (_sql: string, params: [string]) => {
      const v = store.get(params[0]);
      return v === undefined ? [] : [{ value: v }];
    },
    execute: async (sql: string, params: unknown[]) => {
      if (sql.startsWith('DELETE')) {
        store.delete(params[0] as string);
        return { rowsAffected: 1 };
      }
      store.set(params[0] as string, params[1] as string);
      return { rowsAffected: 1 };
    }
  })
}));

describe('appKv', () => {
  beforeEach(() => store.clear());

  it('get/set/delete round-trip', async () => {
    expect(await getAppKv('k')).toBeNull();
    await setAppKv('k', 'v');
    expect(await getAppKv('k')).toBe('v');
    await deleteAppKv('k');
    expect(await getAppKv('k')).toBeNull();
  });

  it('boolPref defaultOff + truefalse encode', async () => {
    const p = boolPref('b', { defaultValue: false, mode: 'defaultOff', encode: 'truefalse' });
    expect(await p.load()).toBe(false);
    await p.save(true);
    expect(store.get('b')).toBe('true');
    expect(await p.load()).toBe(true);
  });

  it('boolPref defaultOn treats unset as true', async () => {
    const p = boolPref('b', { defaultValue: true, mode: 'defaultOn', encode: 'truefalse' });
    expect(await p.load()).toBe(true);
    await p.save(false);
    expect(store.get('b')).toBe('false');
    expect(await p.load()).toBe(false);
  });

  it('jsonPref normalizes', async () => {
    const p = jsonPref<{ n: number }>('j', (raw) => {
      if (raw && typeof raw === 'object' && typeof (raw as { n?: unknown }).n === 'number') {
        return { n: (raw as { n: number }).n };
      }
      return { n: 0 };
    });
    expect(await p.load()).toEqual({ n: 0 });
    await p.save({ n: 3 });
    expect(JSON.parse(store.get('j')!)).toEqual({ n: 3 });
  });

  it('intPref clamps on save', async () => {
    const p = intPref('i', (n) => Math.min(23, Math.max(0, n)), 4);
    expect(await p.load()).toBe(4);
    expect(await p.save(99)).toBe(23);
    expect(await p.load()).toBe(23);
  });

  it('stringPref deletes on null', async () => {
    const p = stringPref('s', (r) => (r === '' ? null : r));
    await p.save('x');
    expect(await p.load()).toBe('x');
    await p.save(null);
    expect(store.has('s')).toBe(false);
  });
});
