import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadCollapsedCategoryIds,
  saveCollapsedCategoryIds,
  STREAK_CATEGORY_COLLAPSED_LS_KEY,
  toggleCollapsedCategoryId
} from '@/lib/streak/categoryCollapse';

describe('categoryCollapse', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); }
    });
  });

  it('defaults to no collapsed ids', () => {
    expect([...loadCollapsedCategoryIds()]).toEqual([]);
  });

  it('round-trips collapsed ids through localStorage', () => {
    saveCollapsedCategoryIds(new Set(['french', 'morning']));
    expect(localStorage.getItem(STREAK_CATEGORY_COLLAPSED_LS_KEY)).toContain('french');
    expect([...loadCollapsedCategoryIds()].sort()).toEqual(['french', 'morning']);
  });

  it('toggles membership', () => {
    const once = toggleCollapsedCategoryId(new Set(), 'french');
    expect([...once]).toEqual(['french']);
    expect([...toggleCollapsedCategoryId(once, 'french')]).toEqual([]);
  });

  it('ignores corrupt localStorage JSON', () => {
    localStorage.setItem(STREAK_CATEGORY_COLLAPSED_LS_KEY, '{not-json');
    expect([...loadCollapsedCategoryIds()]).toEqual([]);
  });
});
