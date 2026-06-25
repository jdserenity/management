import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import MorningStretchRoutineEditor from '@/components/daily/MorningStretchRoutineEditor';
import { formatDayRolloverHourLabel } from '@/lib/dayBoundary';
import {
  listMorningStretchCatalog,
  labelForMorningStretchRef,
  type MorningStretchRef,
  type MorningStretchRoutine
} from '@/lib/morningStretch/morningStretch';
import { loadMorningStretchRoutine, saveMorningStretchRoutine } from '@/lib/morningStretch/morningStretchDb';
import {
  formatMorningStretchHideAfterLabel,
  loadMorningStretchPrefs,
  saveMorningStretchDurationMinutes,
  saveMorningStretchEnabled,
  saveMorningStretchHideAfterHour,
  type MorningStretchPrefs
} from '@/lib/morningStretch/morningStretchPref';
import { loadStreakHeatmapColorPref, saveStreakHeatmapColorPref } from '@/lib/streakHeatmapPref';
import {
  loadSessionAlertsPrefs,
  notifySessionAlertsPrefsChanged,
  saveSessionAlertsPref,
  type SessionAlertsPrefs
} from '@/lib/sessionAlertsPref';
import { useSession } from '@/context/SessionContext';

export default function CompanionSettingsPage() {
  const { dayRolloverHour, setDayRolloverHour, workoutCustomizePrefs } = useSession();
  const [alertPrefs, setAlertPrefs] = useState<SessionAlertsPrefs | null>(null);
  const [heatmapColor, setHeatmapColor] = useState('');
  const [heatmapLoaded, setHeatmapLoaded] = useState(false);
  const [stretchPrefs, setStretchPrefs] = useState<MorningStretchPrefs | null>(null);
  const [routine, setRoutine] = useState<MorningStretchRoutine | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);

  useEffect(() => {
    void loadSessionAlertsPrefs().then(setAlertPrefs).catch(console.error);
    void loadStreakHeatmapColorPref()
      .then((color) => {
        setHeatmapColor(color ?? '#22c55e');
        setHeatmapLoaded(true);
      })
      .catch(console.error);
    void Promise.all([loadMorningStretchPrefs(), loadMorningStretchRoutine(workoutCustomizePrefs)])
      .then(([prefs, nextRoutine]) => {
        setStretchPrefs(prefs);
        setRoutine(nextRoutine);
      })
      .catch(console.error);
  }, [workoutCustomizePrefs]);

  const patchAlert = (key: keyof SessionAlertsPrefs, value: boolean) => {
    if (!alertPrefs) return;
    const next = { ...alertPrefs, [key]: value };
    setAlertPrefs(next);
    void saveSessionAlertsPref(key, value)
      .then(() => notifySessionAlertsPrefsChanged())
      .catch(console.error);
  };

  const persistHeatmapColor = useCallback((hex: string) => {
    const normalized = hex.trim();
    setHeatmapColor(normalized);
    void saveStreakHeatmapColorPref(normalized || null).catch(console.error);
  }, []);

  const refKey = (ref: MorningStretchRef) => `${ref.kind}:${ref.id}`;
  const catalog = listMorningStretchCatalog(workoutCustomizePrefs);
  const availableToAdd = routine
    ? catalog.filter((row) => !routine.exerciseRefs.some((r) => refKey(r) === refKey(row.ref)))
    : [];

  const persistRoutine = async (next: MorningStretchRoutine) => {
    setSavingRoutine(true);
    try {
      await saveMorningStretchRoutine(next);
      setRoutine(next);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRoutine(false);
    }
  };

  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: formatDayRolloverHourLabel(hour)
  }));
  const stretchHourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: formatMorningStretchHideAfterLabel(hour)
  }));
  const durationOptions = [3, 5, 7, 10, 15, 20, 30].map((m) => ({ value: String(m), label: `${m} min` }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader><CardTitle>Stats day</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Work, movement, nutrition, and habits reset at this time.</p>
            <Select value={String(dayRolloverHour)} onValueChange={(v) => setDayRolloverHour(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {hourOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {alertPrefs ? (
        <Card>
          <CardHeader><CardTitle>Focus & break alerts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Sound alerts</span>
              <Switch checked={alertPrefs.sound} onCheckedChange={(v) => patchAlert('sound', v)} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">5-second countdown</span>
              <Switch checked={alertPrefs.countdownSound} onCheckedChange={(v) => patchAlert('countdownSound', v)} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Habits heatmap</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <input
            type="color"
            className="h-10 w-14 cursor-pointer rounded border border-border bg-background p-1"
            value={heatmapLoaded ? heatmapColor : '#22c55e'}
            disabled={!heatmapLoaded}
            onChange={(e) => persistHeatmapColor(e.target.value)}
          />
          <input
            type="text"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            value={heatmapColor}
            disabled={!heatmapLoaded}
            onChange={(e) => setHeatmapColor(e.target.value)}
            onBlur={() => persistHeatmapColor(heatmapColor)}
          />
        </CardContent>
      </Card>

      {stretchPrefs && routine ? (
        <Card>
          <CardHeader><CardTitle>Morning stretch</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Show on Daily tab</span>
              <Switch
                checked={stretchPrefs.enabled}
                onCheckedChange={(checked) => {
                  setStretchPrefs({ ...stretchPrefs, enabled: checked });
                  void saveMorningStretchEnabled(checked).catch(console.error);
                }}
              />
            </div>
            <Select
              value={String(stretchPrefs.durationMinutes)}
              onValueChange={(v) => {
                void saveMorningStretchDurationMinutes(Number(v))
                  .then((saved) => setStretchPrefs({ ...stretchPrefs, durationMinutes: saved }))
                  .catch(console.error);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(stretchPrefs.hideAfterHour)}
              onValueChange={(v) => {
                void saveMorningStretchHideAfterHour(Number(v))
                  .then((saved) => setStretchPrefs({ ...stretchPrefs, hideAfterHour: saved }))
                  .catch(console.error);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Hide after" /></SelectTrigger>
              <SelectContent>
                {stretchHourOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MorningStretchRoutineEditor
              routine={routine}
              availableToAdd={availableToAdd}
              saving={savingRoutine}
              labelForRef={labelForMorningStretchRef}
              onAdd={(ref) => {
                if (routine.exerciseRefs.some((r) => refKey(r) === refKey(ref))) return;
                void persistRoutine({ exerciseRefs: [...routine.exerciseRefs, ref] });
              }}
              onRemove={(index) => void persistRoutine({ exerciseRefs: routine.exerciseRefs.filter((_, i) => i !== index) })}
              onMove={(index, dir) => {
                const next = [...routine.exerciseRefs];
                const target = index + dir;
                if (target < 0 || target >= next.length) return;
                [next[index], next[target]] = [next[target], next[index]];
                void persistRoutine({ exerciseRefs: next });
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
