import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { EXERCISE_UNIT_OPTIONS, type ExerciseUnit } from '@/lib/exerciseForm';
import type { ExerciseDefinition, ExerciseRepRange } from '@/lib/workoutPlanner';

// re-export unit type for panels that imported from exerciseForm only
export type { ExerciseUnit };

export function CustomizePanel({
  title,
  description,
  actions,
  children
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="plugin-panel space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="plugin-panel-title mb-1">{title}</h2>
          {description ? <p className="plugin-muted text-sm leading-snug">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AmountUnitFields({
  amount,
  unit,
  onAmount,
  onUnit,
  showPreview
}: {
  amount: number;
  unit: ExerciseUnit;
  onAmount: (n: number) => void;
  onUnit: (u: ExerciseUnit) => void;
  showPreview?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm shrink-0">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        className="plugin-input w-16 font-semibold tabular-nums"
        value={amount}
        onChange={(e) => onAmount(Number(e.target.value))}
      />
      <select
        className="plugin-select text-xs"
        value={unit}
        onChange={(e) => onUnit(e.target.value as ExerciseUnit)}
      >
        {EXERCISE_UNIT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {showPreview ? <span className="plugin-muted text-xs tabular-nums">({showPreview})</span> : null}
    </label>
  );
}

export function ExerciseEditRow({
  name,
  amount,
  unit,
  repRange,
  currentProgression,
  onAmount,
  onUnit,
  onRepRange,
  onCurrentProgression,
  preview,
  onRemove,
  removeDisabled,
  removeLabel,
  quickLog,
  editable = true
}: {
  name: string;
  amount: number;
  unit: ExerciseUnit;
  repRange?: ExerciseRepRange;
  currentProgression?: string;
  onAmount: (n: number) => void;
  onUnit: (u: ExerciseUnit) => void;
  onRepRange?: (range: ExerciseRepRange) => void;
  onCurrentProgression?: (value: string) => void;
  preview?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
  removeLabel?: string;
  quickLog?: {
    enabled: boolean;
    incrementLabel: string;
    amount: number;
    unit: ExerciseUnit;
    onToggle: (on: boolean) => void;
    onAmount: (n: number) => void;
    onUnit: (u: ExerciseUnit) => void;
  };
  editable?: boolean;
}) {
  return (
    <li className="plugin-row !border-border !py-2 px-0">
      <div className="flex items-center gap-1.5 w-full">
        <span className="text-sm font-medium min-w-0 flex-1">{name}</span>
        {editable && repRange && onRepRange ? <div className="flex items-center gap-1 text-xs plugin-muted shrink-0">
          <span>Target</span>
          <input type="number" min={0} className="plugin-input w-14 font-semibold tabular-nums" value={repRange.min} onChange={(e) => onRepRange({ min: Math.max(0, Math.round(Number(e.target.value))), max: Math.max(repRange.max, Math.round(Number(e.target.value))) })} aria-label={`${name} minimum reps`} />
          <span>–</span>
          <input type="number" min={repRange.min} className="plugin-input w-14 font-semibold tabular-nums" value={repRange.max} onChange={(e) => onRepRange({ min: repRange.min, max: Math.max(repRange.min, Math.round(Number(e.target.value))) })} aria-label={`${name} maximum reps`} />
          <span>reps</span>
        </div> : null}
        {editable && onCurrentProgression ? <input className="plugin-input w-28 text-xs" value={currentProgression ?? ''} onChange={(e) => onCurrentProgression(e.target.value)} placeholder="Current progression" aria-label={`${name} current progression`} /> : null}
        {editable ? <div className="flex items-center gap-1.5 shrink-0">
          {repRange && onRepRange ? <span className="plugin-muted text-xs">reps</span> : <AmountUnitFields amount={amount} unit={unit} onAmount={onAmount} onUnit={onUnit} showPreview={preview} />}
          {onRemove ? (
            <button
              type="button"
              className="plugin-btn-ghost p-1"
              disabled={removeDisabled}
              aria-label={removeLabel ?? `Remove ${name}`}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div> : <span className="plugin-muted text-sm shrink-0">{repRange ? `${repRange.min}–${repRange.max} reps` : `${amount} ${unit}`}{currentProgression ? ` · ${currentProgression}` : ''}{preview ? ` (${preview})` : ''}</span>}
      </div>
      {quickLog ? (
        <QuickLogExerciseRow
          enabled={quickLog.enabled}
          incrementLabel={quickLog.incrementLabel}
          amount={quickLog.amount}
          unit={quickLog.unit}
          onToggle={quickLog.onToggle}
          onAmount={quickLog.onAmount}
          onUnit={quickLog.onUnit}
        />
      ) : null}
    </li>
  );
}

export function QuickLogExerciseRow({
  enabled,
  incrementLabel,
  amount,
  unit,
  onToggle,
  onAmount,
  onUnit
}: {
  enabled: boolean;
  incrementLabel: string;
  amount: number;
  unit: ExerciseUnit;
  onToggle: (on: boolean) => void;
  onAmount: (n: number) => void;
  onUnit: (u: ExerciseUnit) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pl-0 pt-1 pb-2 border-b border-border/40 last:border-b-0">
      <label className="flex items-center gap-2 text-xs plugin-muted shrink-0">
        <Switch checked={enabled} onCheckedChange={onToggle} className="scale-75" />
        <span>Individual{enabled ? ` · ${incrementLabel}` : ''}</span>
      </label>
      {enabled ? (
        <AmountUnitFields amount={amount} unit={unit} onAmount={onAmount} onUnit={onUnit} />
      ) : null}
    </div>
  );
}

export function NewExerciseForm({
  name,
  amount,
  unit,
  onName,
  onAmount,
  onUnit,
  onSubmit,
  onCancel,
  submitLabel = 'Add',
  namePlaceholder = 'e.g. Push-ups'
}: {
  name: string;
  amount: number;
  unit: ExerciseUnit;
  onName: (s: string) => void;
  onAmount: (n: number) => void;
  onUnit: (u: ExerciseUnit) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  namePlaceholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs plugin-muted">
        Name
        <input
          className="plugin-input min-w-[10rem] text-sm text-foreground"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={namePlaceholder}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs plugin-muted">
        Amount
        <input
          type="number"
          min={0}
          className="plugin-input w-16 font-semibold tabular-nums text-foreground"
          value={amount}
          onChange={(e) => onAmount(Number(e.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs plugin-muted">
        Unit
        <select
          className="plugin-select text-sm text-foreground"
          value={unit}
          onChange={(e) => onUnit(e.target.value as ExerciseUnit)}
        >
          {EXERCISE_UNIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <button type="button" className="plugin-btn plugin-btn-primary" onClick={onSubmit}>{submitLabel}</button>
      {onCancel ? (
        <button type="button" className="plugin-btn-ghost" onClick={onCancel}>Cancel</button>
      ) : null}
    </div>
  );
}

export function exerciseDraft(name: string, amount: number, unit: ExerciseUnit, id: string): ExerciseDefinition {
  return { id, name: name.trim(), amount: Math.max(0, Math.round(amount)), unit };
}
