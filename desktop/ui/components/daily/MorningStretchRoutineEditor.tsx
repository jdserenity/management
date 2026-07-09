// src/components/daily/MorningStretchRoutineEditor.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { MorningStretchCatalogEntry, MorningStretchRef, MorningStretchRoutine } from '@/lib/morningStretch/morningStretch';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

const refKey = (ref: MorningStretchRef): string => `${ref.kind}:${ref.id}`;

type MorningStretchRoutineEditorProps = {
  routine: MorningStretchRoutine;
  availableToAdd: MorningStretchCatalogEntry[];
  saving: boolean;
  labelForRef: (ref: MorningStretchRef) => string;
  /** Default hold/amount when the ref has no routine-local override (e.g. pool default seconds). */
  defaultAmountForRef?: (ref: MorningStretchRef) => number | null;
  onAdd: (ref: MorningStretchRef) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  /** Set or clear a routine-local amount (does not change the global stretch pool). */
  onAmountChange?: (index: number, amount: number | undefined) => void;
};

export default function MorningStretchRoutineEditor({
  routine,
  availableToAdd,
  saving,
  labelForRef,
  defaultAmountForRef,
  onAdd,
  onRemove,
  onMove,
  onAmountChange
}: MorningStretchRoutineEditorProps) {
  const [pickKind, setPickKind] = useState<'moves' | 'stretches' | 'custom' | ''>('');
  const filteredAdd = pickKind ? availableToAdd.filter((row) => row.group === pickKind) : availableToAdd;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Turn on predefined moves under Customize → Exercises, then add stretches and moves to this routine. Hold times here are for this routine only — they do not change the break stretch pool.
      </p>
      {routine.exerciseRefs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No moves in your routine yet.</p>
      ) : (
        <ol className="space-y-2">
          {routine.exerciseRefs.map((ref, index) => {
            const showAmount = ref.kind === 'stretchPick' || ref.kind === 'custom';
            const defaultAmount = defaultAmountForRef?.(ref) ?? null;
            const amountValue = ref.amount != null ? String(ref.amount) : '';
            return (
              <li key={`${refKey(ref)}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium">{labelForRef(ref)}</span>
                {showAmount && onAmountChange ? (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="w-16 rounded-md border border-input bg-background px-1.5 py-1 text-sm tabular-nums text-foreground"
                      placeholder={defaultAmount != null ? String(defaultAmount) : 'sec'}
                      value={amountValue}
                      disabled={saving}
                      title="Hold time for this stretch only (seconds). Leave blank to use the default."
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          onAmountChange(index, undefined);
                          return;
                        }
                        const n = Math.round(Number(raw));
                        if (!Number.isFinite(n) || n <= 0) return;
                        onAmountChange(index, n);
                      }}
                    />
                    <span>sec</span>
                  </label>
                ) : null}
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={index === 0 || saving} onClick={() => onMove(index, -1)} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={index === routine.exerciseRefs.length - 1 || saving} onClick={() => onMove(index, 1)} aria-label="Move down">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" disabled={saving} onClick={() => onRemove(index)} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      {availableToAdd.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Filter
            <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" value={pickKind} onChange={(e) => setPickKind(e.target.value as typeof pickKind)}>
              <option value="">All</option>
              <option value="moves">Moves</option>
              <option value="stretches">Stretches</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Add exercise
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
              defaultValue=""
              onChange={(e) => {
                const row = filteredAdd.find((r) => refKey(r.ref) === e.target.value);
                if (row) onAdd(row.ref);
                e.target.value = '';
              }}
            >
              <option value="" disabled>Select…</option>
              {filteredAdd.map((row) => (
                <option key={refKey(row.ref)} value={refKey(row.ref)}>{row.label}</option>
              ))}
            </select>
          </label>
          <Plus className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      )}
      {availableToAdd.length === 0 && routine.exerciseRefs.length === 0 && (
        <p className="text-sm text-muted-foreground">Add stretches from the catalog, or enable predefined moves under Customize → Exercises.</p>
      )}
    </div>
  );
}
