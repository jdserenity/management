import { useRef, useState } from 'react';
import ActivityEditorDialog from '@/components/daily/ActivityEditorDialog';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { resetButtonLabel } from '@/lib/streak/display';
import { findDropTargetId, moveIdBefore, type RowBox } from '@/lib/streak/reorder';
import type { StreakActivity } from '@/lib/streak/types';
import { archiveStreakActivity, loadStreakState, reorderStreakActivities, resetStreakActivity, setActivityPaused, upsertStreakActivity } from '@/lib/streakDb';
import { GripVertical } from 'lucide-react';

export default function CustomizeHabitsPanel() {
  const { data: state, loadError, setData: setState, storageReady } = useAppDataLoad(
    loadStreakState,
    'Failed to load habits',
    { intervalMs: null }
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<StreakActivity | null>(null);
  const [isNewActivity, setIsNewActivity] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const baseIdsRef = useRef<string[] | null>(null);
  const boxesRef = useRef<RowBox[]>([]);
  const previewIdsRef = useRef<string[] | null>(null);

  if (!storageReady) return <p className="plugin-muted text-sm">Storage is not ready yet.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!state) return <p className="plugin-muted text-sm">Loading habits…</p>;

  const activities = state.config.activities;
  const byId = new Map(activities.map((a) => [a.id, a]));
  const orderedIds = previewIds ?? activities.map((a) => a.id);
  const displayActivities = orderedIds.map((id) => byId.get(id)).filter((a): a is StreakActivity => !!a);

  const measureRows = (): RowBox[] => {
    const list = listRef.current;
    if (!list) return [];
    return [...list.querySelectorAll<HTMLElement>('[data-habit-id]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.habitId!, top: r.top, bottom: r.bottom };
    });
  };

  const clearDrag = () => {
    dragIdRef.current = null;
    baseIdsRef.current = null;
    boxesRef.current = [];
    previewIdsRef.current = null;
    setDragId(null);
    setPreviewIds(null);
  };

  const finishDrag = () => {
    const next = previewIdsRef.current;
    const base = baseIdsRef.current;
    clearDrag();
    if (!next || !base) return;
    if (next.length === base.length && next.every((id, i) => id === base[i])) return;
    void reorderStreakActivities(state, next).then(setState);
  };

  const onGripPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ids = activities.map((a) => a.id);
    dragIdRef.current = id;
    baseIdsRef.current = ids;
    boxesRef.current = measureRows(); // freeze hit targets so live preview does not flicker
    previewIdsRef.current = ids;
    setDragId(id);
    setPreviewIds(ids);
  };

  const onGripPointerMove = (e: React.PointerEvent) => {
    const from = dragIdRef.current;
    const base = baseIdsRef.current;
    if (!from || !base) return;
    const target = findDropTargetId(e.clientY, boxesRef.current);
    if (!target) return;
    // Always rebase from the order at drag-start (not the live preview) to avoid swap flicker.
    const next = moveIdBefore(base, from, target) ?? base;
    if (previewIdsRef.current && next.every((id, i) => id === previewIdsRef.current![i])) return;
    previewIdsRef.current = next;
    setPreviewIds(next);
  };

  const onGripPointerUp = (e: React.PointerEvent) => {
    if (!dragIdRef.current) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    finishDrag();
  };

  return (
    <>
      <CustomizePanel
        title={
          <span className="flex w-full flex-wrap items-center justify-between gap-2">
            Habits
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
          <p className="plugin-empty text-sm">No habits yet. Add an activity to show it on the Daily tab.</p>
        ) : (
          <ul ref={listRef} className="space-y-2">
            {displayActivities.map((activity) => {
              const resetCount = state.data.activityResetCounts[activity.id] || 0;
              const isPaused = !!state.data.pausedActivities[activity.id];
              const linkBits: string[] = [];
              if (activity.necessary) linkBits.push('Necessary');
              if (activity.linkedStapleId) linkBits.push('→ staple');
              if (activity.linkedWater) linkBits.push('→ water');
              if (activity.linkedMovementBurst) linkBits.push('→ burst');
              return (
                <li
                  key={activity.id}
                  data-habit-id={activity.id}
                  className={`plugin-panel-flat space-y-2${dragId === activity.id ? ' opacity-60 ring-2 ring-primary/40' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 cursor-grab touch-none plugin-muted active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label={`Drag to reorder ${activity.name || activity.id}`}
                      onPointerDown={(e) => onGripPointerDown(e, activity.id)}
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
                </li>
              );
            })}
          </ul>
        )}
      </CustomizePanel>

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
