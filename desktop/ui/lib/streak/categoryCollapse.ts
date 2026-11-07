/** Per-device only — open/closed category folders do not sync across phone and desktop. */
export const STREAK_CATEGORY_COLLAPSED_LS_KEY = 'mgmt_streak_category_collapsed_v1';

export const loadCollapsedCategoryIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STREAK_CATEGORY_COLLAPSED_LS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && !!id));
  } catch {
    return new Set();
  }
};

export const saveCollapsedCategoryIds = (ids: Set<string>): void => {
  try {
    localStorage.setItem(STREAK_CATEGORY_COLLAPSED_LS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
};

export const toggleCollapsedCategoryId = (ids: Set<string>, categoryId: string): Set<string> => {
  const next = new Set(ids);
  if (next.has(categoryId)) next.delete(categoryId);
  else next.add(categoryId);
  return next;
};
