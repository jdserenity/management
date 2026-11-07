import { useRef, useState } from 'react';
import ActivityEditorDialog from '@/components/daily/ActivityEditorDialog';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import {
  blockKey,
  buildInterleavedTaskBlocks,
  moveTaskBlock,
  reorderWithinCategory,
  type TaskListBlock
} from '@/lib/streak/categories';
import { resetButtonLabel } from '@/lib/streak/display';
import { findInsertIndex, moveIdToInsertIndex, type RowBox } from '@/lib/streak/reorder';
import { TRACKER_LINKED_STREAK_TASKS } from '@/lib/streak/trackerLinkedTasks';
import type { StreakActivity, StreakCategory } from '@/lib/streak/types';
import {
  archiveStreakActivity,
  deleteStreakCategory,
  loadStreakState,
  reorderStreakActivities,
  reorderStreakCategories,
  resetStreakActivity,
  setActivityPaused,
  setTrackerLinkedStreakTaskEnabled,
  upsertStreakActivity,
  upsertStreakCategory
} from '@/lib/streakDb';
import { GripVertical } from 'lucide-react';

type DragKind = 'block' | 'member';

type DragState = {
  kind: DragKind;
  key: string;
  categoryId?: string;
  label: string;
  pointerId: number;
  insertIndex: number;
  ghostX: number;
  ghostY: number;
};

export default function CustomizeHabitsPanel() {
  const { data: state, loadError, setData: setState, storageReady } = useAppDataLoad(
    loadStreakState,
    'Failed to load habits',
    { intervalMs: null }
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<StreakActivity | null>(null);
  const [isNewActivity, setIsNewActivity] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const baseKeysRef = useRef<string[] | null>(null);

  if (!storageReady) return <p className="plugin-muted text-sm">Storage is not ready yet.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!state) return <p className="plugin-muted text-sm">Loading habits…</p>;

  const activities = state.config.activities;
  const categories = state.config.categories;
  const blocks = buildInterleavedTaskBlocks(activities, categories);
  const usedCategoryIds = new Set(activities.map((a) => a.categoryId).filter(Boolean) as string[]);
  const emptyCategories = categories.filter((c) => !usedCategoryIds.has(c.id));

  const measureSelector = (selector: string): RowBox[] => {
    const list = listRef.current;
    if (!list) return [];
    return [...list.querySelectorAll<HTMLElement>(selector)].map((el) => {
      const r = el.getBoundingClientRect();
      const id = el.dataset.blockKey || el.dataset.habitId || '';
      return { id, top: r.top, bottom: r.bottom };
    });
  };

  const clearDrag = () => {
    dragRef.current = null;
    baseKeysRef.current = null;
    setDrag(null);
  };

  const finishDrag = () => {
    const current = dragRef.current;
    const base = baseKeysRef.current;
    clearDrag();
    if (!current || !base) return;
    if (current.kind === 'block') {
      const next = moveTaskBlock(activities, categories, current.key, current.insertIndex);
      if (!next) return;
      void reorderStreakActivities(state, next.map((a) => a.id)).then(setState);
      return;
    }
    if (!current.categoryId) return;
    const nextIds = moveIdToInsertIndex(base, current.key, current.insertIndex);
    if (!nextIds) return;
    const nextActs = reorderWithinCategory(activities, current.categoryId, nextIds);
    if (!nextActs) return;
    void reorderStreakActivities(state, nextActs.map((a) => a.id)).then(setState);
  };

  const onBlockPointerDown = (e: React.PointerEvent, key: string, label: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const keys = blocks.map(blockKey);
    const boxes = measureSelector('[data-block-key]');
    const insertIndex = findInsertIndex(e.clientY, boxes, key);
    const next: DragState = {
      kind: 'block',
      key,
      label,
      pointerId: e.pointerId,
      insertIndex,
      ghostX: e.clientX,
      ghostY: e.clientY
    };
    baseKeysRef.current = keys;
    dragRef.current = next;
    setDrag(next);
  };

  const onMemberPointerDown = (e: React.PointerEvent, activity: StreakActivity) => {
    if (e.button !== 0 || !activity.categoryId) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const memberIds = activities.filter((a) => a.categoryId === activity.categoryId).map((a) => a.id);
    const boxes = measureSelector(`[data-habit-id][data-member-category="${activity.categoryId}"]`);
    const insertIndex = findInsertIndex(e.clientY, boxes, activity.id);
    const next: DragState = {
      kind: 'member',
      key: activity.id,
      categoryId: activity.categoryId,
      label: activity.name || activity.id,
      pointerId: e.pointerId,
      insertIndex,
      ghostX: e.clientX,
      ghostY: e.clientY
    };
    baseKeysRef.current = memberIds;
    dragRef.current = next;
    setDrag(next);
  };

  const onGripPointerMove = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current || e.pointerId !== current.pointerId) return;
    const boxes = current.kind === 'block'
      ? measureSelector('[data-block-key]')
      : measureSelector(`[data-habit-id][data-member-category="${current.categoryId}"]`);
    const insertIndex = findInsertIndex(e.clientY, boxes, current.key);
    if (
      insertIndex === current.insertIndex &&
      e.clientX === current.ghostX &&
      e.clientY === current.ghostY
    ) return;
    const next = { ...current, insertIndex, ghostX: e.clientX, ghostY: e.clientY };
    dragRef.current = next;
    setDrag(next);
  };

  const onGripPointerUp = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current || e.pointerId !== current.pointerId) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    finishDrag();
  };

  const renderActivityActions = (activity: StreakActivity) => {
    const resetCount = state.data.activityResetCounts[activity.id] || 0;
    const isPaused = !!state.data.pausedActivities[activity.id];
    return (
      <div className="flex flex-wrap gap-2 pl-6">
        <button type="button" className="plugin-btn" onClick={() => { setEditingActivity(activity); setIsNewActivity(false); setEditorOpen(true); }}>Edit</button>
        {activity.trackerLinkedKind ? <button type="button" className="plugin-btn-ghost" onClick={() => void setTrackerLinkedStreakTaskEnabled(state, activity.trackerLinkedKind!, activity.enabled === false).then(setState)}>
          {activity.enabled === false ? 'Turn on' : 'Turn off'}
        </button> : <button type="button" className="plugin-btn-ghost" onClick={() => void setActivityPaused(state, activity.id, !isPaused).then(setState)}>
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>}
        {!activity.trackerLinkedKind ? <button type="button" className="plugin-btn-ghost" onClick={() => void resetStreakActivity(state, activity.id).then(setState)}>
          {resetButtonLabel(resetCount)}
        </button> : null}
        {!activity.trackerLinkedKind ? <button type="button" className="plugin-btn-ghost" onClick={() => void archiveStreakActivity(state, activity.id).then(setState)}>🗃 Archive</button> : null}
      </div>
    );
  };

  const renderActivityCard = (activity: StreakActivity, opts?: { memberCategory?: string; showBlockGrip?: boolean; blockKeyAttr?: string }) => {
    const isPaused = !!state.data.pausedActivities[activity.id];
    const linkBits: string[] = [];
    if (activity.necessary) linkBits.push('Necessary');
    if (activity.trackerLinkedKind) linkBits.push(`Tracker-linked ${activity.trackerLinkedKind}`);
    if (activity.enabled === false) linkBits.push('Off');
    const isDragging = drag?.kind === 'member' && drag.key === activity.id
      || (opts?.showBlockGrip && drag?.kind === 'block' && drag.key === opts.blockKeyAttr);
    const gripDown = opts?.memberCategory
      ? (e: React.PointerEvent) => onMemberPointerDown(e, activity)
      : opts?.showBlockGrip && opts.blockKeyAttr
        ? (e: React.PointerEvent) => onBlockPointerDown(e, opts.blockKeyAttr!, activity.name || activity.id)
        : undefined;
    return (
      <div
        key={activity.id}
        data-habit-id={activity.id}
        data-member-category={opts?.memberCategory}
        data-block-key={opts?.blockKeyAttr}
        className={`plugin-panel-flat space-y-2${isDragging ? ' opacity-40' : ''}`}
      >
        <div className="flex items-start gap-2">
          {gripDown ? (
            <button
              type="button"
              className="mt-0.5 shrink-0 cursor-grab touch-none plugin-muted active:cursor-grabbing"
              title="Drag to reorder"
              aria-label={`Drag to reorder ${activity.name || activity.id}`}
              onPointerDown={gripDown}
              onPointerMove={onGripPointerMove}
              onPointerUp={onGripPointerUp}
              onPointerCancel={onGripPointerUp}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : <span className="mt-0.5 w-4 shrink-0" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{activity.name || activity.id}</p>
            <p className="plugin-muted text-xs">
              {activity.frequency === 'weekly' ? `Weekly · ${activity.weeklyTarget ?? 1}/wk` : 'Daily'}
              {isPaused ? ' · Paused' : ''}
              {linkBits.length ? ` · ${linkBits.join(' · ')}` : ''}
              {activity.description ? ` · ${activity.description}` : ''}
            </p>
          </div>
        </div>
        {renderActivityActions(activity)}
      </div>
    );
  };

  const renderCategoryHeader = (category: StreakCategory, memberCount: number, asBlock: boolean) => {
    const key = `c:${category.id}`;
    const isDragging = drag?.kind === 'block' && drag.key === key;
    return (
      <div
        data-block-key={asBlock ? key : undefined}
        className={`flex flex-wrap items-center gap-2 border-b border-border pb-2${isDragging ? ' opacity-40' : ''}`}
      >
        {asBlock ? (
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none plugin-muted active:cursor-grabbing"
            title="Drag category"
            aria-label={`Drag category ${category.name}`}
            onPointerDown={(e) => onBlockPointerDown(e, key, category.name)}
            onPointerMove={onGripPointerMove}
            onPointerUp={onGripPointerUp}
            onPointerCancel={onGripPointerUp}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        {renamingId === category.id ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void upsertStreakCategory(state, { id: category.id, name: renameValue }, false).then(setState);
              setRenamingId(null);
            }}
          >
            <input className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <button type="submit" className="plugin-btn text-sm">Save</button>
            <button type="button" className="plugin-btn-ghost text-sm" onClick={() => setRenamingId(null)}>Cancel</button>
          </form>
        ) : (
          <>
            <p className="min-w-0 flex-1 font-semibold">{category.name}</p>
            <span className="plugin-muted text-xs">{memberCount ? `${memberCount} task${memberCount === 1 ? '' : 's'}` : 'Empty'}</span>
            <button type="button" className="plugin-btn-ghost text-sm" onClick={() => { setRenamingId(category.id); setRenameValue(category.name); }}>Rename</button>
            <button type="button" className="plugin-btn-ghost text-sm" onClick={() => {
              if (!window.confirm(`Delete category “${category.name}”? Tasks inside become uncategorized.`)) return;
              void deleteStreakCategory(state, category.id).then(setState);
            }}>Delete</button>
          </>
        )}
      </div>
    );
  };

  const insertLine = (show: boolean) =>
    show ? <div className="pointer-events-none relative z-10 -my-1 h-0.5 rounded-full bg-primary" aria-hidden /> : null;

  const othersForDrag = (): string[] => {
    if (!drag) return [];
    if (drag.kind === 'block') return blocks.map(blockKey).filter((k) => k !== drag.key);
    return activities.filter((a) => a.categoryId === drag.categoryId && a.id !== drag.key).map((a) => a.id);
  };
  const others = othersForDrag();

  const showLineBeforeKey = (key: string): boolean => {
    if (!drag) return false;
    if (drag.kind === 'block' && drag.key === key) return false;
    if (drag.kind === 'member' && drag.key === key) return false;
    const idx = others.indexOf(key);
    return idx >= 0 && drag.insertIndex === idx;
  };

  const renderBlock = (block: TaskListBlock) => {
    const key = blockKey(block);
    if (block.type === 'activity') {
      return (
        <div key={key} className="relative space-y-2">
          {insertLine(showLineBeforeKey(key))}
          {renderActivityCard(block.activity, { showBlockGrip: true, blockKeyAttr: key })}
        </div>
      );
    }
    return (
      <div key={key} className="relative space-y-2 rounded-md border border-border/60 p-2">
        {insertLine(showLineBeforeKey(key))}
        {renderCategoryHeader(block.category, block.activities.length, true)}
        {block.activities.map((activity) => {
          const showMemberLine = drag?.kind === 'member' && drag.categoryId === block.category.id && showLineBeforeKey(activity.id);
          return (
            <div key={activity.id} className="relative">
              {insertLine(!!showMemberLine)}
              {renderActivityCard(activity, { memberCategory: block.category.id })}
            </div>
          );
        })}
        {drag?.kind === 'member' && drag.categoryId === block.category.id && drag.insertIndex === others.length
          ? insertLine(true)
          : null}
      </div>
    );
  };

  return (
    <>
      <CustomizePanel
        title={
          <span className="flex w-full flex-wrap items-center justify-between gap-2">
            Tasks
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                className="plugin-btn text-sm font-semibold"
                onClick={() => {
                  const name = newCategoryName.trim() || window.prompt('Category name');
                  if (!name?.trim()) return;
                  void upsertStreakCategory(state, { name: name.trim() }, true).then((next) => {
                    setState(next);
                    setNewCategoryName('');
                  });
                }}
              >
                Add category
              </button>
              <button
                type="button"
                className="plugin-btn plugin-btn-primary text-sm font-semibold"
                onClick={() => { setEditingActivity(null); setIsNewActivity(true); setEditorOpen(true); }}
              >
                Add activity
              </button>
            </span>
          </span>
        }
        description="Drag grips to reorder lone tasks and whole categories. Drag inside a category to reorder its tasks. Tracker-linked tasks are gray on Daily and complete only when their goal is reached."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className="min-w-[10rem] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const name = newCategoryName.trim();
              if (!name) return;
              void upsertStreakCategory(state, { name }, true).then((next) => {
                setState(next);
                setNewCategoryName('');
              });
            }}
          />
        </div>
        {TRACKER_LINKED_STREAK_TASKS.filter((task) => !activities.some((activity) => activity.trackerLinkedKind === task.kind)).length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {TRACKER_LINKED_STREAK_TASKS.filter((task) => !activities.some((activity) => activity.trackerLinkedKind === task.kind)).map((task) => (
              <button key={task.kind} type="button" className="plugin-btn" onClick={() => void setTrackerLinkedStreakTaskEnabled(state, task.kind, true).then(setState)}>
                Add {task.name}
              </button>
            ))}
          </div>
        ) : null}
        {activities.length === 0 && categories.length === 0 ? (
          <p className="plugin-empty text-sm">No tasks yet. Add an activity to show it on the Daily tab.</p>
        ) : (
          <div ref={listRef} className="space-y-3">
            {blocks.map(renderBlock)}
            {drag?.kind === 'block' && drag.insertIndex === others.length ? insertLine(true) : null}
            {emptyCategories.length ? (
              <div className="space-y-2 pt-2">
                <p className="plugin-muted text-xs">Empty categories</p>
                {emptyCategories.map((category, index) => (
                  <div key={category.id} className="space-y-2 rounded-md border border-dashed border-border/60 p-2">
                    {renderCategoryHeader(category, 0, false)}
                    <div className="flex gap-2 pl-6">
                      {index > 0 ? (
                        <button type="button" className="plugin-btn-ghost text-sm" onClick={() => {
                          const ids = emptyCategories.map((c) => c.id);
                          const swapped = [...ids];
                          [swapped[index - 1], swapped[index]] = [swapped[index]!, swapped[index - 1]!];
                          const full = [...categories.filter((c) => usedCategoryIds.has(c.id)).map((c) => c.id), ...swapped];
                          void reorderStreakCategories(state, full).then(setState);
                        }}>Move up</button>
                      ) : null}
                      {index < emptyCategories.length - 1 ? (
                        <button type="button" className="plugin-btn-ghost text-sm" onClick={() => {
                          const ids = emptyCategories.map((c) => c.id);
                          const swapped = [...ids];
                          [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
                          const full = [...categories.filter((c) => usedCategoryIds.has(c.id)).map((c) => c.id), ...swapped];
                          void reorderStreakCategories(state, full).then(setState);
                        }}>Move down</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </CustomizePanel>

      {drag ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs truncate rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-md"
          style={{ left: drag.ghostX + 12, top: drag.ghostY, transform: 'translateY(-50%)' }}
        >
          {drag.label}
        </div>
      ) : null}

      <ActivityEditorDialog
        open={editorOpen}
        activity={editingActivity}
        isNew={isNewActivity}
        categories={categories}
        onClose={() => setEditorOpen(false)}
        onSave={(activity, isNew) => {
          void upsertStreakActivity(state, activity, isNew)
            .then(setState)
            .catch((e) => console.error('Failed to save activity:', e));
        }}
      />
    </>
  );
}
