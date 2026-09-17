import { useCallback, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import type { ExerciseDefinition, ExerciseUnit } from '@/lib/workoutPlanner';
import { createPrefixedId } from '@/lib/exerciseForm';
import { CustomizePanel, ExerciseEditRow, NewExerciseForm, exerciseDraft } from '@/components/customize/CustomizePrimitives';

type PoolKey = 'mobilityPool' | 'buildPool' | 'movePool';

const POOLS: readonly { key: PoolKey; title: string; description: string }[] = [
  { key: 'mobilityPool', title: 'Mobility', description: 'Stretches and mobility movements.' },
  { key: 'buildPool', title: 'Build', description: 'Exercises used by fixed Build tasks.' },
  { key: 'movePool', title: 'Move', description: 'Exercises available as Move overrides.' }
];

export default function CustomizeExercisePoolsPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const [addingTo, setAddingTo] = useState<PoolKey | null>(null);
  const [name, setName] = useState(''); const [amount, setAmount] = useState(10); const [unit, setUnit] = useState<ExerciseUnit>('reps');
  const pool = (key: PoolKey): ExerciseDefinition[] => movementSnackPrefs[key];
  const savePool = useCallback((key: PoolKey, entries: ExerciseDefinition[]) => {
    updateMovementSnackPrefs(key === 'movePool' ? { movePool: entries, quickLogExercises: entries } : { [key]: entries });
  }, [updateMovementSnackPrefs]);
  const updateAmount = useCallback((key: PoolKey, index: number, value: number) => {
    const entries = pool(key).map((entry, i) => i === index ? { ...entry, amount: Math.max(0, Math.round(value)) } : entry);
    savePool(key, entries);
  }, [movementSnackPrefs, savePool]);
  const updateUnit = useCallback((key: PoolKey, index: number, value: ExerciseUnit) => {
    const entries = pool(key).map((entry, i) => i === index ? { ...entry, unit: value } : entry);
    savePool(key, entries);
  }, [movementSnackPrefs, savePool]);
  const remove = useCallback((key: PoolKey, index: number) => {
    const entries = pool(key);
    if (entries.length <= 1) return;
    savePool(key, entries.filter((_, i) => i !== index));
  }, [movementSnackPrefs, savePool]);
  const add = (key: PoolKey) => {
    const entry = exerciseDraft(name, amount, unit, createPrefixedId(`${key.replace('Pool', '').toLowerCase()}-pool`));
    if (!entry.name) return;
    savePool(key, [...pool(key), entry]);
    setName(''); setAmount(10); setUnit('reps'); setAddingTo(null);
  };

  return <CustomizePanel title="Exercise pools" description="These are the three standardized exercise pools. Regimen comes first, Stretch Creator stays above this section, and these pools provide the reusable exercises.">
    <div className="movement-exercise-pools">
      {POOLS.map(({ key, title, description }) => <div className="movement-exercise-pool" key={key}>
        <div><h3 className="font-semibold">{title}</h3><p className="plugin-muted text-xs">{description}</p></div>
        <ul className="space-y-0">{pool(key).map((entry, index) => <ExerciseEditRow key={entry.id} name={entry.name} amount={entry.amount} unit={entry.unit} onAmount={(value) => updateAmount(key, index, value)} onUnit={(value) => updateUnit(key, index, value)} onRemove={() => remove(key, index)} removeDisabled={pool(key).length <= 1} />)}</ul>
        <button type="button" className="plugin-btn" onClick={() => setAddingTo(addingTo === key ? null : key)}>{addingTo === key ? 'Hide form' : '+ Add exercise'}</button>
        {addingTo === key ? <NewExerciseForm name={name} amount={amount} unit={unit} onName={setName} onAmount={setAmount} onUnit={setUnit} onSubmit={() => add(key)} onCancel={() => setAddingTo(null)} /> : null}
      </div>)}
    </div>
  </CustomizePanel>;
}
