import { describe, expect, it } from 'vitest';
import {
  buildInterleavedTaskBlocks,
  flattenTaskBlocks,
  moveTaskBlock,
  reorderWithinCategory,
  withActivityCategory
} from '@/lib/streak/categories';
import type { StreakActivity, StreakCategory } from '@/lib/streak/types';

const act = (id: string, categoryId?: string): StreakActivity => ({
  id,
  name: id,
  frequency: 'daily',
  ...(categoryId ? { categoryId } : {})
});

const cats: StreakCategory[] = [
  { id: 'french', name: 'French' },
  { id: 'morning', name: 'Morning' }
];

describe('buildInterleavedTaskBlocks', () => {
  it('intertwines uncategorized rows with category groups', () => {
    const activities = [
      act('a'),
      act('fr1', 'french'),
      act('fr2', 'french'),
      act('b'),
      act('m1', 'morning'),
      act('c')
    ];
    const blocks = buildInterleavedTaskBlocks(activities, cats);
    expect(blocks.map((b) => (b.type === 'activity' ? b.activity.id : b.category.id))).toEqual([
      'a', 'french', 'b', 'morning', 'c'
    ]);
    expect(blocks[1]).toMatchObject({ type: 'category', activities: [{ id: 'fr1' }, { id: 'fr2' }] });
  });

  it('uses a fallback name when the category row is missing', () => {
    const blocks = buildInterleavedTaskBlocks([act('x', 'orphan')], []);
    expect(blocks).toEqual([{ type: 'category', category: { id: 'orphan', name: 'orphan' }, activities: [act('x', 'orphan')] }]);
  });
});

describe('moveTaskBlock', () => {
  it('moves a category block past neighboring uncategorized tasks', () => {
    const activities = [act('a'), act('fr1', 'french'), act('fr2', 'french'), act('b')];
    const next = moveTaskBlock(activities, cats, 'c:french', 2);
    expect(next?.map((a) => a.id)).toEqual(['a', 'b', 'fr1', 'fr2']);
  });

  it('returns null when the block order is unchanged', () => {
    const activities = [act('a'), act('fr1', 'french')];
    expect(moveTaskBlock(activities, cats, 'a:a', 0)).toBeNull();
  });
});

describe('reorderWithinCategory / withActivityCategory', () => {
  it('reorders only members of one category', () => {
    const activities = [act('a'), act('fr1', 'french'), act('fr2', 'french'), act('b')];
    const next = reorderWithinCategory(activities, 'french', ['fr2', 'fr1']);
    expect(next?.map((a) => a.id)).toEqual(['a', 'fr2', 'fr1', 'b']);
  });

  it('appends a newly categorized task after existing members', () => {
    const activities = [act('a'), act('fr1', 'french'), act('b')];
    const next = withActivityCategory(activities, 'b', 'french');
    expect(next.map((a) => ({ id: a.id, categoryId: a.categoryId }))).toEqual([
      { id: 'a', categoryId: undefined },
      { id: 'fr1', categoryId: 'french' },
      { id: 'b', categoryId: 'french' }
    ]);
  });

  it('clears category without reshuffling neighbors', () => {
    const activities = [act('a'), act('fr1', 'french'), act('b')];
    const next = withActivityCategory(activities, 'fr1', null);
    expect(next.map((a) => a.id)).toEqual(['a', 'fr1', 'b']);
    expect(next[1]?.categoryId).toBeUndefined();
  });

  it('round-trips flatten after build', () => {
    const activities = [act('a'), act('fr1', 'french'), act('fr2', 'french'), act('b')];
    expect(flattenTaskBlocks(buildInterleavedTaskBlocks(activities, cats)).map((a) => a.id)).toEqual(
      activities.map((a) => a.id)
    );
  });
});
