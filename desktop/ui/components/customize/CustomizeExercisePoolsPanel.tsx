import { useCallback, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import type { ExerciseDefinition } from '@/lib/workoutPlanner';
import { createPrefixedId } from '@/lib/exerciseForm';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';

type PoolKey = 'mobilityPool' | 'buildPool' | 'movePool';

const POOLS: readonly { key: PoolKey; title: string; description: string }[] = [
  { key: 'mobilityPool', title: 'Mobility', description: 'Exercises available to select in the movement regimen.' },
  { key: 'buildPool', title: 'Build', description: 'Fixed exercises used by Build tasks. Configure their targets in Movement regimen.' },
  { key: 'movePool', title: 'Move', description: 'Exercises available to select in the movement regimen.' }
];

export default function CustomizeExercisePoolsPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const [addingTo, setAddingTo] = useState<Exclude<PoolKey, 'buildPool'> | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const pool = (key: PoolKey): ExerciseDefinition[] => movementSnackPrefs[key];
  const savePool = useCallback((key: PoolKey, entries: ExerciseDefinition[]) => {
    updateMovementSnackPrefs(key === 'movePool' ? { movePool: entries, quickLogExercises: entries } : { [key]: entries });
  }, [updateMovementSnackPrefs]);
  const remove = useCallback((key: PoolKey, index: number) => {
    const entries = pool(key);
    if (entries.length <= 1) return;
    savePool(key, entries.filter((_, i) => i !== index));
  }, [movementSnackPrefs, savePool]);
  const add = (key: Exclude<PoolKey, 'buildPool'>) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const entry: ExerciseDefinition = { id: createPrefixedId(`${key.replace('Pool', '').toLowerCase()}-pool`), name: trimmedName, amount: 0, unit: 'reps' };
    savePool(key, [...pool(key), entry]);
    setName(''); setAddingTo(null);
  };

  const toggleEditing = () => {
    setEditing((current) => {
      if (current) setAddingTo(null);
      return !current;
    });
  };

  return <CustomizePanel
    title="Exercise pools"
    description="These are the three standardized exercise pools. Regimen comes first, Stretch Creator stays above this section, and these pools provide the reusable exercises."
    actions={<button type="button" className="plugin-btn-ghost p-1.5" onClick={toggleEditing} aria-label={editing ? 'Done editing exercise pools' : 'Edit exercise pools'} title={editing ? 'Done editing' : 'Edit exercise pools'}><Pencil className="h-4 w-4" /></button>}
  >
    <div className="movement-exercise-pools">
      {POOLS.map(({ key, title, description }) => <div className="movement-exercise-pool" key={key}>
        <div><h3 className="font-semibold">{title}</h3><p className="plugin-muted text-xs">{description}</p></div>
        <ul className="space-y-0">{pool(key).map((entry, index) => <li className="plugin-row !border-border !py-2 px-0" key={entry.id}><span className="text-sm font-medium">{entry.name}</span>{editing && key !== 'buildPool' ? <button type="button" className="plugin-btn-ghost p-1" onClick={() => remove(key, index)} disabled={pool(key).length <= 1} aria-label={`Remove ${entry.name}`}><Trash2 className="h-4 w-4" /></button> : null}</li>)}</ul>
        {editing && key !== 'buildPool' ? <>
          <button type="button" className="plugin-btn" onClick={() => setAddingTo(addingTo === key ? null : key)}>{addingTo === key ? 'Hide form' : '+ Add exercise'}</button>
          {addingTo === key ? <div className="flex flex-wrap items-end gap-2"><label className="flex flex-col gap-1 text-xs plugin-muted">Name<input className="plugin-input min-w-[10rem] text-sm text-foreground" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Push-ups" /></label><button type="button" className="plugin-btn plugin-btn-primary" onClick={() => add(key)}>Add</button><button type="button" className="plugin-btn-ghost" onClick={() => setAddingTo(null)}>Cancel</button></div> : null}
        </> : null}
      </div>)}
    </div>
  </CustomizePanel>;
}
