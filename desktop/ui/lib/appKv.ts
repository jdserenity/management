import { getDb } from '@/lib/db';

type AppKvRow = { value: string };

/** Read a single app_kv value. */
export const getAppKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<AppKvRow[]>('SELECT value FROM app_kv WHERE key = $1 LIMIT 1', [key]);
  return rows[0]?.value ?? null;
};

/** Upsert app_kv with current timestamp (drives sync). */
export const setAppKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.execute(
    'INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, value, Date.now()]
  );
};

export const deleteAppKv = async (key: string): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM app_kv WHERE key = $1', [key]);
};

export const getAppKvMany = async (keys: string[]): Promise<(string | null)[]> =>
  Promise.all(keys.map((k) => getAppKv(k)));

/** true for '1' / 'true' (case-insensitive); false for anything else when present. */
export const parseBoolLoose = (raw: string | null, defaultValue: boolean): boolean => {
  if (raw === null) return defaultValue;
  return raw === '1' || raw.toLowerCase() === 'true';
};

/** Default-on: only explicit 'false' turns off. */
export const parseBoolDefaultOn = (raw: string | null): boolean => raw !== 'false';

/** Default-off: only explicit true-ish turns on. */
export const parseBoolDefaultOff = (raw: string | null): boolean =>
  raw === 'true' || raw === '1';

export const encodeBool01 = (v: boolean): string => (v ? '1' : '0');
export const encodeBoolTrueFalse = (v: boolean): string => (v ? 'true' : 'false');

export type BoolPref = {
  load: () => Promise<boolean>;
  save: (enabled: boolean) => Promise<void>;
};

export const boolPref = (
  key: string,
  opts: {
    defaultValue: boolean;
    /** how values are written; read accepts both 1/0 and true/false */
    encode?: '01' | 'truefalse';
    /** default-on: anything except the string "false" is true when present */
    mode?: 'loose' | 'defaultOn' | 'defaultOff';
  }
): BoolPref => {
  const encode = opts.encode ?? 'truefalse';
  const mode = opts.mode ?? (opts.defaultValue ? 'defaultOn' : 'defaultOff');
  return {
    load: async () => {
      const raw = await getAppKv(key);
      if (mode === 'defaultOn') return parseBoolDefaultOn(raw);
      if (mode === 'defaultOff') return parseBoolDefaultOff(raw);
      return parseBoolLoose(raw, opts.defaultValue);
    },
    save: async (enabled) => {
      await setAppKv(key, encode === '01' ? encodeBool01(enabled) : encodeBoolTrueFalse(enabled));
    }
  };
};

export type JsonPref<T> = {
  load: () => Promise<T>;
  save: (value: T) => Promise<void>;
};

export const jsonPref = <T>(
  key: string,
  normalize: (raw: unknown) => T
): JsonPref<T> => ({
  load: async () => {
    const raw = await getAppKv(key);
    if (!raw) return normalize(null);
    try {
      return normalize(JSON.parse(raw));
    } catch {
      return normalize(null);
    }
  },
  save: async (value) => {
    await setAppKv(key, JSON.stringify(normalize(value)));
  }
});

export type IntPref = {
  load: () => Promise<number>;
  save: (n: number) => Promise<number>;
};

export const intPref = (
  key: string,
  clamp: (n: number) => number,
  defaultValue: number
): IntPref => ({
  load: async () => {
    const raw = await getAppKv(key);
    if (raw === null) return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? clamp(parsed) : defaultValue;
  },
  save: async (n) => {
    const safe = clamp(n);
    await setAppKv(key, String(safe));
    return safe;
  }
});

export type StringPref = {
  load: () => Promise<string | null>;
  save: (value: string | null) => Promise<void>;
};

/** Nullable string pref; save(null) deletes the key. */
export const stringPref = (
  key: string,
  normalize: (raw: string | null) => string | null = (r) => r
): StringPref => ({
  load: async () => normalize(await getAppKv(key)),
  save: async (value) => {
    const n = normalize(value);
    if (n === null) await deleteAppKv(key);
    else await setAppKv(key, n);
  }
});
