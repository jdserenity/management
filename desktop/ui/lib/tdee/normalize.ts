import { mealTotalsFromIngredients, normalizeCalories, normalizeIngredients, normalizeMacro } from '@/lib/tdee/ingredients';
import type { TdeeFile, TdeeMealDef, TdeeStoredEntry } from '@/lib/tdee/types';

const isMealDef = (item: unknown): item is TdeeMealDef =>
  !!item &&
  typeof item === 'object' &&
  typeof (item as TdeeMealDef).id === 'string' &&
  typeof (item as TdeeMealDef).name === 'string' &&
  typeof (item as TdeeMealDef).calories === 'number';

const isEntryKind = (kind: unknown): kind is 'staple' | 'regular' | 'custom' =>
  kind === 'staple' || kind === 'regular' || kind === 'custom';

export const normalizeMealDef = (item: TdeeMealDef): TdeeMealDef => {
  const ingredients = normalizeIngredients(item.ingredients);
  if (ingredients.length) {
    const totals = mealTotalsFromIngredients(ingredients);
    return { id: item.id, name: item.name, ...totals, ingredients };
  }
  return {
    id: item.id,
    name: item.name,
    calories: normalizeCalories(item.calories),
    protein: normalizeMacro(typeof item.protein === 'number' ? item.protein : 0)
  };
};

const isLogEntry = (item: unknown): boolean =>
  !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && typeof (item as { calories?: unknown }).calories === 'number';

const normalizeEntry = (item: Record<string, unknown>): TdeeStoredEntry => {
  const count = typeof item.count === 'number' && item.count > 0 ? Math.round(item.count) : 1;
  const kind = isEntryKind(item.kind) ? item.kind : 'custom';
  return {
    id: item.id as string,
    kind,
    refId: typeof item.refId === 'string' ? item.refId : null,
    label: typeof item.label === 'string' ? item.label : 'Custom',
    calories: normalizeCalories(item.calories as number),
    protein: normalizeMacro(typeof item.protein === 'number' ? item.protein : 0),
    count,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString()
  };
};

const normalizeStoredEntry = (item: unknown): TdeeStoredEntry | null => {
  if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') return null;
  const o = item as Record<string, unknown>;
  if (o.deleted) {
    return {
      id: o.id as string,
      deleted: true,
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date(0).toISOString()
    };
  }
  if (!isLogEntry(item)) return null;
  return normalizeEntry(o);
};

export const normalizeFile = (raw: unknown): TdeeFile => {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    tdee: typeof data.tdee === 'number' && data.tdee >= 0 ? data.tdee : 0,
    protein: typeof data.protein === 'number' && data.protein >= 0 ? data.protein : 0,
    staples: Array.isArray(data.staples) ? data.staples.filter(isMealDef).map(normalizeMealDef) : [],
    regulars: Array.isArray(data.regulars) ? data.regulars.filter(isMealDef).map(normalizeMealDef) : [],
    day: typeof data.day === 'string' ? data.day : '',
    entries: Array.isArray(data.entries) ? data.entries.map(normalizeStoredEntry).filter((x): x is TdeeStoredEntry => x !== null) : []
  };
};
