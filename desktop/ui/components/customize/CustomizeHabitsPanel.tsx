import { useCallback, useEffect, useState } from 'react';
import ActivityEditorDialog from '@/components/daily/ActivityEditorDialog';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';
import { DATA_SYNC_REFRESH_EVENT } from '@mgmt/sync';
import { hasAppStorage } from '@/lib/appRuntime';
import { resetButtonLabel } from '@/lib/streak/display';
import type { StreakActivity, StreakState } from '@/lib/streak/types';
import { archiveStreakActivity, loadStreakState, reorderStreakActivities, resetStreakActivity, setActivityPaused, upsertStreakActivity } from '@/lib/streakDb';
import { GripVertical } from 'lucide-react';

export default function CustomizeHabitsPanel() {
  const [state, setState] = useState<StreakState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<StreakActivity | null>(null);
  const [isNewActivity, setIsNewActivity] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasAppStorage()) { setLoadError(null); setState(null); return; }
    try {
      setLoadError(null);
      setState(await loadStreakState());
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load habits');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onRemoteRefresh = () => { void refresh(); };
    window.addEventListener(DATA_SYNC_REFRESH_EVENT, onRemoteRefresh);
    return () => window.removeEventListener(DATA_SYNC_REFRESH_EVENT, onRemoteRefresh);
  }, [refresh]);

  if (!hasAppStorage()) return <p className="plugin-muted text-sm">Storage is not ready yet.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!state) return <p className="plugin-muted text-sm">Loading habits…</p>;

  const activities = state.config.activities;

  const handleDropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = activities.map((a) => a.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragId(null);
    void reorderStreakActivities(state, next).then(setState);
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
        description="Drag to reorder. This order is what you see on the Daily tab."
      >
        {activities.length === 0 ? (
          <p className="plugin-empty text-sm">No habits yet. Add an activity to show it on the Daily tab.</p>
        ) : (
          <ul className="space-y-2">
            {activities.map((activity) => {
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
                  className={`plugin-panel-flat space-y-2${dragId === activity.id ? ' opacity-60 ring-2 ring-primary/40' : ''}`}
                  draggable
                  onDragStart={() => setDragId(activity.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOn(activity.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 cursor-grab plugin-muted" title="Drag to reorder" aria-hidden>
                      <GripVertical className="h-4 w-4" />
                    </span>
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
