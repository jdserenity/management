// src/components/daily/ActivityEditorDialog.tsx

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { hasAppStorage } from '@/lib/appRuntime';
import type { StreakActivity } from '@/lib/streak/types';
import { loadTdeeFile } from '@/lib/tdeeDb';
import type { TdeeMealDef } from '@/lib/tdee/types';

type Props = {
  open: boolean;
  activity: StreakActivity | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (activity: StreakActivity, isNew: boolean) => void;
};

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'activity';

export default function ActivityEditorDialog({ open, activity, isNew, onClose, onSave }: Props) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [weeklyTarget, setWeeklyTarget] = useState('1');
  const [scheduledDays, setScheduledDays] = useState('Sun');
  const [necessary, setNecessary] = useState(false);
  const [linkedStapleId, setLinkedStapleId] = useState('');
  const [linkedWater, setLinkedWater] = useState(false);
  const [extraCalories, setExtraCalories] = useState('');
  const [extraProtein, setExtraProtein] = useState('');
  const [extraWaterMl, setExtraWaterMl] = useState('');
  const [staples, setStaples] = useState<TdeeMealDef[]>([]);

  useEffect(() => {
    if (!open) return;
    setId(activity?.id || '');
    setName(activity?.name || '');
    setDescription(activity?.description || '');
    setFrequency(activity?.frequency === 'weekly' ? 'weekly' : 'daily');
    setWeeklyTarget(String(activity?.weeklyTarget ?? 1));
    setScheduledDays((activity?.scheduledDays || ['Sun']).join(', '));
    setNecessary(!!activity?.necessary);
    setLinkedStapleId(activity?.linkedStapleId || '');
    setLinkedWater(!!activity?.linkedWater);
    setExtraCalories(activity?.extraCalories ? String(activity.extraCalories) : '');
    setExtraProtein(activity?.extraProtein ? String(activity.extraProtein) : '');
    setExtraWaterMl(activity?.extraWaterMl ? String(activity.extraWaterMl) : '');
    if (hasAppStorage()) {
      void loadTdeeFile()
        .then((file) => setStaples(file.staples || []))
        .catch(() => setStaples([]));
    } else {
      setStaples([]);
    }
  }, [open, activity]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const actId = (isNew ? slugify(trimmedName) : id.trim()) || slugify(trimmedName);
    const parsed: StreakActivity = {
      id: actId,
      name: trimmedName,
      frequency,
      // Always send explicit flags so a save never "forgets" to clear/set them.
      necessary,
      linkedWater,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(frequency === 'weekly' ? {
        weeklyTarget: Math.max(1, parseInt(weeklyTarget, 10) || 1),
        scheduledDays: scheduledDays.split(',').map((d) => d.trim()).filter(Boolean)
      } : {}),
      ...(linkedStapleId.trim() ? { linkedStapleId: linkedStapleId.trim() } : {}),
      ...(Number(extraCalories) > 0 ? { extraCalories: Math.round(Number(extraCalories)) } : {}),
      ...(Number(extraProtein) > 0 ? { extraProtein: Number(extraProtein) } : {}),
      ...(Number(extraWaterMl) > 0 ? { extraWaterMl: Math.round(Number(extraWaterMl)) } : {})
    };
    onSave(parsed, isNew);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add activity' : 'Edit activity'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {!isNew ? (
            <label className="block">
              <span className="text-muted-foreground">Id</span>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1" value={id} disabled />
            </label>
          ) : null}
          <label className="block">
            <span className="text-muted-foreground">Name</span>
            <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-muted-foreground">Description</span>
            <textarea className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-muted-foreground">Frequency</span>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1" value={frequency} onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          {frequency === 'weekly' ? (
            <>
              <label className="block">
                <span className="text-muted-foreground">Sessions per week</span>
                <input type="number" min={1} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1" value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Scheduled days (comma-separated, e.g. Mon, Wed, Fri)</span>
                <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1" value={scheduledDays} onChange={(e) => setScheduledDays(e.target.value)} />
              </label>
            </>
          ) : null}

          <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
            <input type="checkbox" className="mt-0.5" checked={necessary} onChange={(e) => setNecessary(e.target.checked)} />
            <span>
              <span className="font-medium">Necessary</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                If this task is not done, the whole day fails on the heatmap (red square with ×).
              </span>
            </span>
          </label>

          <div className="rounded-md border border-border px-3 py-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Networked links</p>
            <p className="text-xs text-muted-foreground">
              Connect this task to food or water so logging one side checks off the other.
            </p>
            <label className="block">
              <span className="text-muted-foreground text-xs">Linked food staple</span>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1"
                value={linkedStapleId}
                onChange={(e) => setLinkedStapleId(e.target.value)}
              >
                <option value="">None</option>
                {staples.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={linkedWater} onChange={(e) => setLinkedWater(e.target.checked)} />
              <span className="text-xs">Linked to water tracker (logging water checks this task off)</span>
            </label>
          </div>

          <div className="rounded-md border border-border px-3 py-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Also log on success (one-off amounts)</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">+kcal</span>
                <input type="number" min={0} step={1} className="w-20 rounded-md border border-border bg-background px-2 py-1" value={extraCalories} onChange={(e) => setExtraCalories(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">+protein (g)</span>
                <input type="number" min={0} step={0.1} className="w-20 rounded-md border border-border bg-background px-2 py-1" value={extraProtein} onChange={(e) => setExtraProtein(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">+water (ml)</span>
                <input type="number" min={0} step={1} className="w-20 rounded-md border border-border bg-background px-2 py-1" value={extraWaterMl} onChange={(e) => setExtraWaterMl(e.target.value)} />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
