// src/components/daily/ActivityEditorDialog.tsx

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { StreakActivity } from '@/lib/streak/types';

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

  useEffect(() => {
    if (!open) return;
    setId(activity?.id || '');
    setName(activity?.name || '');
    setDescription(activity?.description || '');
    setFrequency(activity?.frequency === 'weekly' ? 'weekly' : 'daily');
    setWeeklyTarget(String(activity?.weeklyTarget ?? 1));
    setScheduledDays((activity?.scheduledDays || ['Sun']).join(', '));
  }, [open, activity]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const actId = (isNew ? slugify(trimmedName) : id.trim()) || slugify(trimmedName);
    const parsed: StreakActivity = {
      id: actId,
      name: trimmedName,
      frequency,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(frequency === 'weekly' ? {
        weeklyTarget: Math.max(1, parseInt(weeklyTarget, 10) || 1),
        scheduledDays: scheduledDays.split(',').map((d) => d.trim()).filter(Boolean)
      } : {})
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
