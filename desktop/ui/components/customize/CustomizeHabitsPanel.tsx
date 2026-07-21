import { useRef, useState } from 'react';
import ActivityEditorDialog from '@/components/daily/ActivityEditorDialog';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { resetButtonLabel } from '@/lib/streak/display';
import { findInsertIndex, moveIdToInsertIndex, type RowBox } from '@/lib/streak/reorder';
import type { StreakActivity } from '@/lib/streak/types';
import { archiveStreakActivity, loadStreakState, reorderStreakActivities, resetStreakActivity, setActivityPaused, upsertStreakActivity } from '@/lib/streakDb';
import { GripVertical } from 'lucide-react';

type DragState = {
  id: string;
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
  const [drag, setDrag] = useState<DragState | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const baseIdsRef = useRef<string[] | null>(null);

  if (!storageReady) return <p className="plugin-muted text-sm">Storage is not ready yet.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!state) return <p className="plugin-muted text-sm">Loading habits…</p>;

  const activities = state.config.activities;

  const measureRows = (): RowBox[] => {
    const list = listRef.current;
    if (!list) return [];
    return [...list.querySelectorAll<HTMLElement>('[data-habit-id]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.habitId!, top: r.top, bottom: r.bottom };
    });
  };

  const clearDrag = () => {
    dragRef.current = null;
    baseIdsRef.current = null;
    setDrag(null);
  };

  const finishDrag = () => {
    const current = dragRef.current;
    const base = baseIdsRef.current;
    clearDrag();
    if (!current || !base) return;
    const next = moveIdToInsertIndex(base, current.id, current.insertIndex);
    if (!next) return;
    void reorderStreakActivities(state, next).then(setState);
  };

  const onGripPointerDown = (e: React.PointerEvent, activity: StreakActivity) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ids = activities.map((a) => a.id);
    const boxes = measureRows();
    const insertIndex = findInsertIndex(e.clientY, boxes, activity.id);
    const next: DragState = {
      id: activity.id,
      label: activity.name || activity.id,
      pointerId: e.pointerId,
      insertIndex,
      ghostX: e.clientX,
      ghostY: e.clientY,
    };
    baseIdsRef.current = ids;
    dragRef.current = next;
    setDrag(next);
  };

  const onGripPointerMove = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current || e.pointerId !== current.pointerId) return;
    const boxes = measureRows(); // DOM order is stable during drag — remeasure is safe and handles scroll
    const insertIndex = findInsertIndex(e.clientY, boxes, current.id);
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

  const others = drag ? activities.filter((a) => a.id !== drag.id) : [];

  return (
    <>
      <CustomizePanel
        title={
          <span className="flex w-full flex-wrap items-center justify-between gap-2">
            Tasks
            <button
              type="button"
              className="plugin-btn plugin-btn-primary text-sm font-semibold"
              onClick={() => { setEditingActivity(null); setIsNewActivity(true); setEditorOpen(true); }}
            >
              Add activity
            </button>
          </span>
        }
        description="Drag the grip to reorder. This order is what you see on the Daily tab."
      >
        {activities.length === 0 ? (
          <p className="plugin-empty text-sm">No tasks yet. Add an activity to show it on the Daily tab.</p>
        ) : (
          <ul ref={listRef} className="space-y-2">
            {activities.map((activity) => {
              const resetCount = state.data.activityResetCounts[activity.id] || 0;
              const isPaused = !!state.data.pausedActivities[activity.id];
              const linkBits: string[] = [];
              if (activity.necessary) linkBits.push('Necessary');
              if (activity.linkedStapleId) linkBits.push('→ staple');
              if (activity.linkedWater) linkBits.push('→ water');
              if (activity.linkedMovementBurst) linkBits.push('→ burst');
              const isDragging = drag?.id === activity.id;
              const otherIndex = others.findIndex((a) => a.id === activity.id);
              const showLineBefore = drag != null && !isDragging && drag.insertIndex === otherIndex;
              return (
                <li key={activity.id} className="relative list-none">
                  {showLineBefore ? (
                    <div className="pointer-events-none absolute -top-1.5 left-0 right-0 z-10 h-0.5 rounded-full bg-primary" aria-hidden />
                  ) : null}
                  <div
                    data-habit-id={activity.id}
                    className={`plugin-panel-flat space-y-2${isDragging ? ' opacity-40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 cursor-grab touch-none plugin-muted active:cursor-grabbing"
                        title="Drag to reorder"
                        aria-label={`Drag to reorder ${activity.name || activity.id}`}
                        onPointerDown={(e) => onGripPointerDown(e, activity)}
                        onPointerMove={onGripPointerMove}
                        onPointerUp={onGripPointerUp}
                        onPointerCancel={onGripPointerUp}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
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
                    <div className="flex flex-wrap gap-2 pl-6">
                      <button type="button" className="plugin-btn" onClick={() => { setEditingActivity(activity); setIsNewActivity(false); setEditorOpen(true); }}>Edit</button>
                      <button type="button" className="plugin-btn-ghost" onClick={() => void setActivityPaused(state, activity.id, !isPaused).then(setState)}>
                        {isPaused ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button type="button" className="plugin-btn-ghost" onClick={() => void resetStreakActivity(state, activity.id).then(setState)}>
                        {resetButtonLabel(resetCount)}
                      </button>
                      <button type="button" className="plugin-btn-ghost" onClick={() => void archiveStreakActivity(state, activity.id).then(setState)}>🗃 Archive</button>
                    </div>
                  </div>
                </li>
              );
            })}
            {drag != null && drag.insertIndex === others.length ? (
              <li className="relative list-none h-0 overflow-visible">
                <div className="pointer-events-none absolute -top-1.5 left-0 right-0 z-10 h-0.5 rounded-full bg-primary" aria-hidden />
              </li>
            ) : null}
          </ul>
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
