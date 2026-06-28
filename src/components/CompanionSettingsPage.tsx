import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import MorningStretchRoutineEditor from '@/components/daily/MorningStretchRoutineEditor';
import { formatDayRolloverHourLabel } from '@/lib/dayBoundary';
import {
  listMorningStretchCatalog,
  labelForMorningStretchRef,
  type MorningStretchRef
} from '@/lib/morningStretch/morningStretch';
import { loadStreakHeatmapColorPref, saveStreakHeatmapColorPref } from '@/lib/streakHeatmapPref';
import {
  loadSessionAlertsPrefs,
  notifySessionAlertsPrefsChanged,
  saveSessionAlertsPref,
  type SessionAlertsPrefs
} from '@/lib/sessionAlertsPref';
import { useSession } from '@/context/SessionContext';
import { DATA_SYNC_REFRESH_EVENT } from '@mgmt/sync';
import { getAppKind, hasAppStorage } from '@/lib/appRuntime';
import { BUILTIN_MORNING_STRETCH_ID, type StretchDefinition } from '@/lib/stretchCreator/stretchCreator';
import { loadStretchDefinitions, upsertStretchDefinition } from '@/lib/stretchCreator/stretchCreatorDb';

const durationOptions = [3, 5, 7, 10, 15, 20, 30].map((m) => ({ value: String(m), label: `${m} min` }));

export default function CompanionSettingsPage() {
  const { dayRolloverHour, setDayRolloverHour, workoutCustomizePrefs } = useSession();
  const [alertPrefs, setAlertPrefs] = useState<SessionAlertsPrefs | null>(null);
  const [heatmapColor, setHeatmapColor] = useState('');
  const [heatmapLoaded, setHeatmapLoaded] = useState(false);
  const [morningStretch, setMorningStretch] = useState<StretchDefinition | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);

  const refreshMorningStretch = useCallback(async () => {
    if (!hasAppStorage()) { setMorningStretch(null); return; }
    const stretches = await loadStretchDefinitions(workoutCustomizePrefs);
    setMorningStretch(stretches.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID) ?? null);
  }, [workoutCustomizePrefs]);

  useEffect(() => {
    void loadSessionAlertsPrefs().then(setAlertPrefs).catch(console.error);
    void loadStreakHeatmapColorPref()
      .then((color) => {
        setHeatmapColor(color ?? '#22c55e');
        setHeatmapLoaded(true);
      })
      .catch(console.error);
    void refreshMorningStretch().catch(console.error);
  }, [refreshMorningStretch]);

  useEffect(() => {
    if (getAppKind() !== 'companion') return;
    const onRemoteRefresh = () => { void refreshMorningStretch().catch(console.error); };
    window.addEventListener(DATA_SYNC_REFRESH_EVENT, onRemoteRefresh);
    return () => window.removeEventListener(DATA_SYNC_REFRESH_EVENT, onRemoteRefresh);
  }, [refreshMorningStretch]);

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
  const availableToAdd = morningStretch
    ? catalog.filter((row) => !morningStretch.exerciseRefs.some((r) => refKey(r) === refKey(row.ref)))
    : [];

  const persistMorningStretch = async (next: StretchDefinition) => {
    setSavingRoutine(true);
    try {
      const updated = await upsertStretchDefinition(next, workoutCustomizePrefs);
      setMorningStretch(updated.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID) ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRoutine(false);
    }
  };

  const patchMorningStretch = (patch: Partial<StretchDefinition>) => {
    if (!morningStretch) return;
    const next = { ...morningStretch, ...patch };
    setMorningStretch(next);
    void persistMorningStretch(next);
  };

  const hideAfterHour = morningStretch?.trigger.mode === 'scheduled' ? morningStretch.trigger.hideAfterHour : 11;
  const stretchHourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: formatDayRolloverHourLabel(hour)
  }));
  const hourOptions = stretchHourOptions;

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

      {morningStretch ? (
        <Card>
          <CardHeader><CardTitle>Morning stretch</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Show on Daily tab</span>
              <Switch
                checked={morningStretch.enabled}
                onCheckedChange={(checked) => patchMorningStretch({ enabled: checked })}
              />
            </div>
            <Select
              value={String(morningStretch.durationMinutes)}
              onValueChange={(v) => patchMorningStretch({ durationMinutes: Number(v) })}
            >
              <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(hideAfterHour)}
              onValueChange={(v) => patchMorningStretch({ trigger: { mode: 'scheduled', hideAfterHour: Number(v) } })}
            >
              <SelectTrigger><SelectValue placeholder="Hide after" /></SelectTrigger>
              <SelectContent>
                {stretchHourOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MorningStretchRoutineEditor
              routine={{ exerciseRefs: morningStretch.exerciseRefs }}
              availableToAdd={availableToAdd}
              saving={savingRoutine}
              labelForRef={labelForMorningStretchRef}
              onAdd={(ref) => {
                if (morningStretch.exerciseRefs.some((r) => refKey(r) === refKey(ref))) return;
                void persistMorningStretch({ ...morningStretch, exerciseRefs: [...morningStretch.exerciseRefs, ref] });
              }}
              onRemove={(index) => void persistMorningStretch({ ...morningStretch, exerciseRefs: morningStretch.exerciseRefs.filter((_, i) => i !== index) })}
              onMove={(index, dir) => {
                const next = [...morningStretch.exerciseRefs];
                const target = index + dir;
                if (target < 0 || target >= next.length) return;
                [next[index], next[target]] = [next[target], next[index]];
                void persistMorningStretch({ ...morningStretch, exerciseRefs: next });
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
