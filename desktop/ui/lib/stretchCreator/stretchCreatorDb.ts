import { getAppKv, getAppKvMany, setAppKv } from '@/lib/appKv';
import { defaultWorkoutCustomizePrefs, type WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { KV_MORNING_STRETCH_ROUTINE } from '@/lib/morningStretch/morningStretchDb';
import {
  KV_MORNING_STRETCH_DURATION_MINUTES,
  KV_MORNING_STRETCH_ENABLED,
  KV_MORNING_STRETCH_HIDE_AFTER_HOUR
} from '@/lib/morningStretch/morningStretchPref';
import {
  BUILTIN_MORNING_STRETCH_ID,
  DEFAULT_SCHEDULED_HIDE_AFTER_HOUR,
  defaultBuiltinMorningStretch,
  normalizeStretchDefinition,
  type StretchDefinition
} from '@/lib/stretchCreator/stretchCreator';

export const KV_STRETCH_DEFINITIONS = 'stretch_definitions_v1';

const migrateFromLegacyMorningStretch = async (prefs: WorkoutCustomizePrefs): Promise<StretchDefinition> => {
  const [enabledRaw, durationRaw, hideRaw, routineRaw] = await getAppKvMany([
    KV_MORNING_STRETCH_ENABLED,
    KV_MORNING_STRETCH_DURATION_MINUTES,
    KV_MORNING_STRETCH_HIDE_AFTER_HOUR,
    KV_MORNING_STRETCH_ROUTINE
  ]);
  const durationParsed = durationRaw !== null ? Number.parseInt(durationRaw, 10) : NaN;
  const hideParsed = hideRaw !== null ? Number.parseInt(hideRaw, 10) : NaN;
  let exerciseRefs = defaultBuiltinMorningStretch().exerciseRefs;
  if (routineRaw) {
    try {
      const parsed = JSON.parse(routineRaw) as { exerciseRefs?: StretchDefinition['exerciseRefs'] };
      if (Array.isArray(parsed.exerciseRefs) && parsed.exerciseRefs.length > 0) exerciseRefs = parsed.exerciseRefs;
    } catch (error) {
      console.error('Failed to parse legacy morning_stretch_routine:', error);
    }
  }
  return normalizeStretchDefinition(
    {
      ...defaultBuiltinMorningStretch(),
      enabled: enabledRaw !== 'false',
      durationMinutes: Number.isFinite(durationParsed) ? durationParsed : undefined,
      trigger: { mode: 'scheduled', hideAfterHour: Number.isFinite(hideParsed) ? hideParsed : DEFAULT_SCHEDULED_HIDE_AFTER_HOUR },
      exerciseRefs
    },
    prefs
  );
};

const normalizeCollection = (raw: unknown, prefs: WorkoutCustomizePrefs): StretchDefinition[] => {
  const parsed = Array.isArray(raw) ? raw : Array.isArray((raw as { stretches?: unknown })?.stretches) ? (raw as { stretches: unknown[] }).stretches : [];
  const normalized = parsed
    .filter((item): item is Partial<StretchDefinition> => Boolean(item && typeof item === 'object'))
    .map((item) => normalizeStretchDefinition(item, prefs));
  const builtIn = normalized.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID) ?? defaultBuiltinMorningStretch();
  const custom = normalized.filter((s) => s.id !== BUILTIN_MORNING_STRETCH_ID);
  return [builtIn, ...custom];
};

const persistLegacyMorningStretch = async (stretch: StretchDefinition): Promise<void> => {
  if (stretch.id !== BUILTIN_MORNING_STRETCH_ID) return;
  await Promise.all([
    setAppKv(KV_MORNING_STRETCH_ENABLED, stretch.enabled ? 'true' : 'false'),
    setAppKv(KV_MORNING_STRETCH_DURATION_MINUTES, String(stretch.durationMinutes)),
    setAppKv(
      KV_MORNING_STRETCH_HIDE_AFTER_HOUR,
      String(stretch.trigger.mode === 'scheduled' ? stretch.trigger.hideAfterHour : 11)
    ),
    setAppKv(KV_MORNING_STRETCH_ROUTINE, JSON.stringify({ exerciseRefs: stretch.exerciseRefs }))
  ]);
};

export const loadStretchDefinitions = async (
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): Promise<StretchDefinition[]> => {
  const raw = await getAppKv(KV_STRETCH_DEFINITIONS);
  if (!raw) {
    const migrated = await migrateFromLegacyMorningStretch(prefs);
    const collection = [migrated];
    await setAppKv(KV_STRETCH_DEFINITIONS, JSON.stringify(collection));
    return collection;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const collection = normalizeCollection(parsed, prefs);
    const rawItems = Array.isArray(parsed) ? parsed : [];
    const rawBuiltIn = rawItems.find((item) => (item as StretchDefinition)?.id === BUILTIN_MORNING_STRETCH_ID) as Partial<StretchDefinition> | undefined;
    const loadedBuiltIn = collection.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID);
    const rawLen = Array.isArray(rawBuiltIn?.exerciseRefs) ? rawBuiltIn!.exerciseRefs!.length : 0;
    if (loadedBuiltIn && loadedBuiltIn.exerciseRefs.length > rawLen) {
      await saveStretchDefinitions(collection, prefs);
    }
    return collection;
  } catch (error) {
    console.error('Failed to parse stretch_definitions from app_kv:', error);
    return [await migrateFromLegacyMorningStretch(prefs)];
  }
};

export const saveStretchDefinitions = async (
  stretches: StretchDefinition[],
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): Promise<StretchDefinition[]> => {
  const normalized = normalizeCollection(stretches, prefs);
  await setAppKv(KV_STRETCH_DEFINITIONS, JSON.stringify(normalized));
  const builtIn = normalized.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID);
  if (builtIn) await persistLegacyMorningStretch(builtIn);
  return normalized;
};

export const upsertStretchDefinition = async (
  stretch: StretchDefinition,
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): Promise<StretchDefinition[]> => {
  const current = await loadStretchDefinitions(prefs);
  const next = normalizeStretchDefinition(stretch, prefs);
  const without = current.filter((s) => s.id !== next.id);
  return saveStretchDefinitions([...without, next], prefs);
};

export const removeStretchDefinition = async (
  stretchId: string,
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): Promise<StretchDefinition[]> => {
  if (stretchId === BUILTIN_MORNING_STRETCH_ID) return loadStretchDefinitions(prefs);
  const current = await loadStretchDefinitions(prefs);
  return saveStretchDefinitions(current.filter((s) => s.id !== stretchId), prefs);
};
