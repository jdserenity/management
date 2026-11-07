import type { StreakActivity, StreakCategory } from '@/lib/streak/types';

export type TaskListBlock =
  | { type: 'activity'; activity: StreakActivity }
  | { type: 'category'; category: StreakCategory; activities: StreakActivity[] };

/** Walk activities in list order; emit lone rows and whole category groups at first-member position. */
export const buildInterleavedTaskBlocks = (
  activities: StreakActivity[],
  categories: StreakCategory[]
): TaskListBlock[] => {
  const byCat = new Map<string, StreakActivity[]>();
  for (const a of activities) {
    if (!a.categoryId) continue;
    const list = byCat.get(a.categoryId) ?? [];
    list.push(a);
    byCat.set(a.categoryId, list);
  }
  const catById = new Map(categories.map((c) => [c.id, c]));
  const emitted = new Set<string>();
  const blocks: TaskListBlock[] = [];
  for (const a of activities) {
    if (!a.categoryId) {
      blocks.push({ type: 'activity', activity: a });
      continue;
    }
    if (emitted.has(a.categoryId)) continue;
    emitted.add(a.categoryId);
    const category = catById.get(a.categoryId) ?? { id: a.categoryId, name: a.categoryId };
    blocks.push({ type: 'category', category, activities: byCat.get(a.categoryId) ?? [a] });
  }
  return blocks;
};

export const blockKey = (block: TaskListBlock): string =>
  block.type === 'activity' ? `a:${block.activity.id}` : `c:${block.category.id}`;

/** Flatten interleaved blocks back into a single activity order (category members stay contiguous). */
export const flattenTaskBlocks = (blocks: TaskListBlock[]): StreakActivity[] => {
  const out: StreakActivity[] = [];
  for (const block of blocks) {
    if (block.type === 'activity') out.push(block.activity);
    else out.push(...block.activities);
  }
  return out;
};

/** Move a block among other blocks; returns new activity order or null if unchanged. */
export const moveTaskBlock = (
  activities: StreakActivity[],
  categories: StreakCategory[],
  draggedKey: string,
  insertIndexAmongOthers: number
): StreakActivity[] | null => {
  const blocks = buildInterleavedTaskBlocks(activities, categories);
  const from = blocks.findIndex((b) => blockKey(b) === draggedKey);
  if (from < 0) return null;
  const dragged = blocks[from]!;
  const others = blocks.filter((_, i) => i !== from);
  const clamped = Math.max(0, Math.min(insertIndexAmongOthers, others.length));
  const nextBlocks = [...others.slice(0, clamped), dragged, ...others.slice(clamped)];
  const next = flattenTaskBlocks(nextBlocks);
  if (next.length === activities.length && next.every((a, i) => a.id === activities[i]?.id)) return null;
  return next;
};

/** Reorder members inside one category; other activities keep relative positions. */
export const reorderWithinCategory = (
  activities: StreakActivity[],
  categoryId: string,
  orderedMemberIds: string[]
): StreakActivity[] | null => {
  const members = activities.filter((a) => a.categoryId === categoryId);
  if (!members.length) return null;
  const byId = new Map(members.map((a) => [a.id, a]));
  const ordered: StreakActivity[] = [];
  for (const id of orderedMemberIds) {
    const a = byId.get(id);
    if (a) { ordered.push(a); byId.delete(id); }
  }
  for (const a of byId.values()) ordered.push(a);
  if (ordered.every((a, i) => a.id === members[i]?.id)) return null;
  let mi = 0;
  return activities.map((a) => (a.categoryId === categoryId ? ordered[mi++]! : a));
};

/**
 * Assign (or clear) an activity's category and place it at the end of that category's members
 * so the group stays contiguous. Clearing leaves the activity where it was in global order.
 */
export const withActivityCategory = (
  activities: StreakActivity[],
  activityId: string,
  categoryId: string | null
): StreakActivity[] => {
  const target = activities.find((a) => a.id === activityId);
  if (!target) return activities;
  const updated: StreakActivity = { ...target };
  if (categoryId) updated.categoryId = categoryId;
  else delete updated.categoryId;
  if (!categoryId || target.categoryId === categoryId) {
    return activities.map((a) => (a.id === activityId ? updated : a));
  }
  const without = activities.filter((a) => a.id !== activityId);
  let insertAt = without.length;
  for (let i = without.length - 1; i >= 0; i--) {
    if (without[i]!.categoryId === categoryId) { insertAt = i + 1; break; }
  }
  // No members yet: keep original index so intertwining stays stable.
  if (insertAt === without.length && !without.some((a) => a.categoryId === categoryId)) {
    const orig = activities.findIndex((a) => a.id === activityId);
    insertAt = Math.max(0, Math.min(orig, without.length));
  }
  return [...without.slice(0, insertAt), updated, ...without.slice(insertAt)];
};
