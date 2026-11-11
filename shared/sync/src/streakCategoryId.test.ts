import { describe, expect, it } from 'vitest';
import {
  categoryIdForSyncBind,
  resolveIncomingCategoryId,
  serverCategoryIdUpsertExpression
} from './streakCategoryId';

describe('streakCategoryId sync helpers', () => {
  it('binds null as null (sticky keep) and empty string as clear', () => {
    expect(categoryIdForSyncBind(null)).toBeNull();
    expect(categoryIdForSyncBind(undefined)).toBeNull();
    expect(categoryIdForSyncBind('')).toBe('');
    expect(categoryIdForSyncBind('french')).toBe('french');
  });

  it('preserves local membership when the incoming row omits or nulls category_id', () => {
    expect(resolveIncomingCategoryId({}, 'french')).toBe('french');
    expect(resolveIncomingCategoryId({ category_id: null }, 'french')).toBe('french');
    expect(resolveIncomingCategoryId({ category_id: undefined }, 'morning')).toBe('morning');
  });

  it('applies explicit clear and assign', () => {
    expect(resolveIncomingCategoryId({ category_id: '' }, 'french')).toBeNull();
    expect(resolveIncomingCategoryId({ category_id: 'morning' }, 'french')).toBe('morning');
  });

  it('builds sticky server upsert SQL for category_id', () => {
    expect(serverCategoryIdUpsertExpression()).toContain('excluded.category_id IS NULL');
    expect(serverCategoryIdUpsertExpression()).toContain("excluded.category_id = ''");
    expect(serverCategoryIdUpsertExpression()).toContain('THEN NULL');
  });
});
