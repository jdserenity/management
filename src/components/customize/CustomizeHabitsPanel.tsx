import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ActivityEditorDialog from '@/components/daily/ActivityEditorDialog';
import { isTauri } from '@/lib/isTauri';
import type { StreakActivity, StreakState } from '@/lib/streak/types';
import { archiveStreakActivity, loadStreakState, upsertStreakActivity } from '@/lib/streakDb';

export default function CustomizeHabitsPanel() {
  const [state, setState] = useState<StreakState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<StreakActivity | null>(null);
  const [isNewActivity, setIsNewActivity] = useState(false);

  const refresh = useCallback(async () => {
    if (!isTauri()) { setLoadError(null); setState(null); return; }
    try {
      setLoadError(null);
      setState(await loadStreakState());
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load habits');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!isTauri()) {
    return <p className="text-sm text-muted-foreground">Run <code>npm run tauri dev</code> to edit habits.</p>;
  }
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!state) return <p className="text-sm text-muted-foreground">Loading habits…</p>;

  const activities = [...state.config.activities].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Habits</CardTitle>
          <Button size="sm" onClick={() => { setEditingActivity(null); setIsNewActivity(true); setEditorOpen(true); }}>Add activity</Button>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No habits yet. Add an activity to show it on the Daily tab.</p>
          ) : (
            <ul className="space-y-2">
              {activities.map((activity) => (
                <li key={activity.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{activity.name || activity.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.frequency === 'weekly' ? `Weekly · ${activity.weeklyTarget ?? 1}/wk` : 'Daily'}
                      {activity.description ? ` · ${activity.description}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setEditingActivity(activity); setIsNewActivity(false); setEditorOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => void archiveStreakActivity(state, activity.id).then(setState)}>Archive</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ActivityEditorDialog
        open={editorOpen}
        activity={editingActivity}
        isNew={isNewActivity}
        onClose={() => setEditorOpen(false)}
        onSave={(activity, isNew) => void upsertStreakActivity(state, activity, isNew).then(setState)}
      />
    </>
  );
}
