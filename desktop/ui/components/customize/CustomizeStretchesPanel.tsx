import { useCallback, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import MorningStretchRoutineEditor from '@/components/daily/MorningStretchRoutineEditor';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';
import { useSession } from '@/context/SessionContext';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { formatDayRolloverHourLabel } from '@/lib/dayBoundary';
import {
  defaultAmountForStretchRef,
  labelForMorningStretchRef,
  listMorningStretchCatalog,
  type MorningStretchRef
} from '@/lib/morningStretch/morningStretch';
import {
  defaultUserStretch,
  STRETCH_GRADIENT_IDS,
  STRETCH_GRADIENT_STYLES,
  type StretchDefinition,
  type StretchGradientId
} from '@/lib/stretchCreator/stretchCreator';
import { loadStretchDefinitions, removeStretchDefinition, upsertStretchDefinition } from '@/lib/stretchCreator/stretchCreatorDb';
import StretchPoolSection from '@/components/customize/StretchPoolSection';
import { Plus, Trash2 } from 'lucide-react';

const refKey = (ref: MorningStretchRef): string => `${ref.kind}:${ref.id}`;

const durationOptions = [3, 5, 7, 10, 15, 20, 30].map((m) => ({ value: String(m), label: `${m} min` }));
const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: formatDayRolloverHourLabel(hour) }));

export default function CustomizeStretchesPanel() {
  const { workoutCustomizePrefs } = useSession();
  const load = useCallback(
    () => loadStretchDefinitions(workoutCustomizePrefs),
    [workoutCustomizePrefs]
  );
  const { data: stretches, loadError, setData: setStretches, storageReady } = useAppDataLoad(
    load,
    'Failed to load stretches',
    { intervalMs: null, listenSync: false }
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StretchDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  const catalog = useMemo(() => listMorningStretchCatalog(workoutCustomizePrefs), [workoutCustomizePrefs]);
  const editing = stretches?.find((s) => s.id === editingId) ?? null;
  const activeDraft = draft ?? editing;

  const availableToAdd = activeDraft
    ? catalog.filter((row) => !activeDraft.exerciseRefs.some((r) => refKey(r) === refKey(row.ref)))
    : [];

  const openEditor = (stretch: StretchDefinition) => {
    setEditingId(stretch.id);
    setDraft({ ...stretch, exerciseRefs: [...stretch.exerciseRefs] });
  };

  const closeEditor = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (patch: Partial<StretchDefinition>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const persistDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await upsertStretchDefinition(draft, workoutCustomizePrefs);
      setStretches(next);
      closeEditor();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addStretch = () => {
    openEditor(defaultUserStretch());
  };

  const deleteStretch = async (stretchId: string) => {
    setSaving(true);
    try {
      const next = await removeStretchDefinition(stretchId, workoutCustomizePrefs);
      setStretches(next);
      if (editingId === stretchId) closeEditor();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!storageReady) return <p className="plugin-muted text-sm">Storage is not ready yet.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!stretches) return <p className="plugin-muted text-sm">Loading stretches…</p>;

  return (
    <div className="space-y-4">
      <CustomizePanel
        title={
          <span className="flex w-full flex-wrap items-center justify-between gap-2">
            Stretch creator
            <button type="button" className="plugin-btn plugin-btn-primary text-sm font-semibold" onClick={addStretch}>
              <Plus className="mr-1 inline h-4 w-4" />New stretch
            </button>
          </span>
        }
        description="Build themed stretch routines. Morning stretch ships with the app; add your own (e.g. after a run)."
      >
        <ul className="space-y-2">
          {stretches.map((stretch) => {
            const style = STRETCH_GRADIENT_STYLES[stretch.gradientId];
            const triggerLabel = stretch.trigger.mode === 'scheduled'
              ? `Daily until ${formatDayRolloverHourLabel(stretch.trigger.hideAfterHour)}`
              : 'Manual only';
            return (
              <li key={stretch.id} className={`plugin-panel-flat space-y-2 ring-1 ${style.cardClass} ${style.ringClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{stretch.emoji} {stretch.name}{stretch.builtIn ? ' · built-in' : ''}</p>
                    <p className="plugin-muted text-xs">
                      {stretch.exerciseRefs.length} moves · {stretch.durationMinutes} min · {triggerLabel}{!stretch.enabled ? ' · off' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="plugin-btn text-sm" onClick={() => openEditor(stretch)}>Edit</button>
                    {!stretch.builtIn && (
                      <button type="button" className="plugin-btn-ghost p-1 text-destructive" disabled={saving} aria-label={`Delete ${stretch.name}`} onClick={() => void deleteStretch(stretch.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CustomizePanel>

      {activeDraft && (
        <CustomizePanel title="Edit stretch">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs plugin-muted">
              Name
              <input className="plugin-input text-sm text-foreground" value={activeDraft.name} onChange={(e) => updateDraft({ name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs plugin-muted">
              Emoji
              <input className="plugin-input w-20 text-sm text-foreground" value={activeDraft.emoji} maxLength={4} onChange={(e) => updateDraft({ emoji: e.target.value })} />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Colour gradient</span>
            <div className="flex flex-wrap gap-2">
              {STRETCH_GRADIENT_IDS.map((id) => {
                const style = STRETCH_GRADIENT_STYLES[id];
                const selected = activeDraft.gradientId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`h-10 min-w-[5.5rem] rounded-md border px-3 text-xs font-medium ring-2 ring-offset-2 ring-offset-background ${style.cardClass} ${selected ? style.ringClass.replace('ring-', 'ring-2 ring-') : 'ring-transparent'}`}
                    onClick={() => updateDraft({ gradientId: id as StretchGradientId })}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-medium">Enabled</span>
              <p className="plugin-muted text-sm">When off, scheduled stretches stay hidden on Daily.</p>
            </div>
            <Switch checked={activeDraft.enabled} onCheckedChange={(checked) => updateDraft({ enabled: checked })} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">Block duration</span>
            <Select value={String(activeDraft.durationMinutes)} onValueChange={(v) => updateDraft({ durationMinutes: Number(v) })}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <span className="font-medium">When to show</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`plugin-btn text-sm${activeDraft.trigger.mode === 'scheduled' ? ' plugin-btn-primary' : ''}`}
                onClick={() => updateDraft({ trigger: { mode: 'scheduled', hideAfterHour: activeDraft.trigger.mode === 'scheduled' ? activeDraft.trigger.hideAfterHour : 11 } })}
              >
                Daily tab (scheduled)
              </button>
              <button
                type="button"
                className={`plugin-btn text-sm${activeDraft.trigger.mode === 'manual' ? ' plugin-btn-primary' : ''}`}
                onClick={() => updateDraft({ trigger: { mode: 'manual' } })}
              >
                Manual only
              </button>
            </div>
            {activeDraft.trigger.mode === 'scheduled' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="plugin-muted text-sm">Hide after this time if not finished (next stats day resets).</p>
                <Select
                  value={String(activeDraft.trigger.hideAfterHour)}
                  onValueChange={(v) => updateDraft({ trigger: { mode: 'scheduled', hideAfterHour: Number(v) } })}
                >
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeDraft.trigger.mode === 'manual' && (
              <p className="plugin-muted text-sm">Manual stretches are not on Daily yet — we still need a launch point elsewhere in the app.</p>
            )}
          </div>

          <MorningStretchRoutineEditor
            routine={{ exerciseRefs: activeDraft.exerciseRefs }}
            availableToAdd={availableToAdd}
            saving={saving}
            labelForRef={labelForMorningStretchRef}
            defaultAmountForRef={(ref) => defaultAmountForStretchRef(ref, workoutCustomizePrefs)}
            onAdd={(ref) => {
              if (activeDraft.exerciseRefs.some((r) => refKey(r) === refKey(ref))) return;
              updateDraft({ exerciseRefs: [...activeDraft.exerciseRefs, ref] });
            }}
            onRemove={(index) => updateDraft({ exerciseRefs: activeDraft.exerciseRefs.filter((_, i) => i !== index) })}
            onMove={(index, dir) => {
              const next = [...activeDraft.exerciseRefs];
              const target = index + dir;
              if (target < 0 || target >= next.length) return;
              [next[index], next[target]] = [next[target], next[index]];
              updateDraft({ exerciseRefs: next });
            }}
            onAmountChange={(index, amount) => {
              const next = activeDraft.exerciseRefs.map((ref, i) => {
                if (i !== index) return ref;
                if (amount == null) {
                  const { amount: _drop, ...rest } = ref;
                  return rest;
                }
                return { ...ref, amount };
              });
              updateDraft({ exerciseRefs: next });
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button type="button" className="plugin-btn plugin-btn-primary" onClick={() => void persistDraft()} disabled={saving}>Save stretch</button>
            <button type="button" className="plugin-btn" onClick={closeEditor} disabled={saving}>Cancel</button>
            {!activeDraft.builtIn && activeDraft.id.startsWith('stretch-') && (
              <button type="button" className="plugin-btn-ghost text-destructive" disabled={saving} onClick={() => void deleteStretch(activeDraft.id)}>
                Delete
              </button>
            )}
          </div>
        </CustomizePanel>
      )}
      <StretchPoolSection />
    </div>
  );
}
