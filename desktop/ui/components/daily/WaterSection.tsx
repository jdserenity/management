import { useState } from 'react';
import { activeEntries } from '@/lib/water/entries';
import { entryMl, formatLitres, formatWaterLabel, progressRatio, remainingDisplay, totalWater } from '@/lib/water/totals';
import type { WaterEntry } from '@/lib/water/types';
import { addWaterEntry, loadWaterFile, removeWaterEntry } from '@/lib/waterDb';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import {
  TrackerSummary,
  withChainConnectors
} from '@/components/daily/TrackerChain';
import './water.css';

const QUICK_AMOUNTS = [100, 250, 500, 750, 1000] as const;
const P = 'water' as const;

type Props = {
  refreshKey?: number;
  onTrackerLinkedTaskChange?: () => void;
};

export default function WaterSection({ refreshKey, onTrackerLinkedTaskChange }: Props) {
  const { data: file, loadError, setData: setFile, storageReady } = useAppDataLoad(
    loadWaterFile,
    'Failed to load water data',
    { refreshKey }
  );
  const [customMl, setCustomMl] = useState('');

  if (!storageReady) {
    return (
      <section className="water-tracker-container" aria-label="Water">
        <p className="water-tracker-empty text-sm">Storage is not ready yet.</p>
      </section>
    );
  }
  if (loadError) return <p className="water-tracker-empty">Could not load water: {loadError}</p>;
  if (!file) return <p className="water-tracker-empty">Loading water…</p>;

  const logged = activeEntries(file.entries);
  const total = totalWater(file.entries);
  const target = file.targetMl || 0;
  const ratio = progressRatio(total, target);
  const waterRemaining = remainingDisplay(total, target);

  const handleRemove = async (id: string) => {
    const next = await removeWaterEntry(file, id);
    setFile(next);
    onTrackerLinkedTaskChange?.();
  };

  const handleAdd = async (ml: number, label?: string) => {
    if (!ml || ml <= 0) return;
    setFile(await addWaterEntry(file, label || formatWaterLabel(ml), ml, 1));
    setCustomMl('');
    onTrackerLinkedTaskChange?.();
  };

  const chips = logged.map((entry: WaterEntry) => {
    const amount = entryMl(entry);
    const chipLabel = entry.count > 1 ? `${formatWaterLabel(entry.ml)} ×${entry.count}` : formatWaterLabel(amount);
    return (
      <button
        key={entry.id}
        type="button"
        className="water-chain-btn water-chain-done water-chain-btn-single"
        title={`${chipLabel} — click to remove`}
        onClick={() => void handleRemove(entry.id)}
      >
        <span className="water-chain-label">{chipLabel}</span>
      </button>
    );
  });

  return (
    <section className="water-tracker-container" aria-label="Water">
      <TrackerSummary
        prefix={P}
        today={formatLitres(total)}
        target={target > 0 ? <>{formatLitres(target)} daily goal 💧</> : undefined}
        remainingText={target > 0 ? waterRemaining.text : 'Set water target in Customize → Food'}
        remainingClass={waterRemaining.extraClass}
        progressRatio={ratio}
        showProgress={target > 0}
      />
      {chips.length ? <div className="water-chain">{withChainConnectors(chips)}</div> : null}
      <div className="water-quick-add">
        {QUICK_AMOUNTS.map((ml) => (
          <button key={ml} type="button" className="water-quick-btn" onClick={() => void handleAdd(ml)}>
            {formatWaterLabel(ml)}
          </button>
        ))}
      </div>
      <div className="water-custom-row">
        <input
          className="water-custom-input"
          type="number"
          min={1}
          step={1}
          placeholder="ml"
          aria-label="Custom water amount (ml)"
          value={customMl}
          onChange={(e) => setCustomMl(e.target.value)}
        />
        <button type="button" className="water-log-btn" onClick={() => void handleAdd(Math.round(Number(customMl) || 0))}>
          Drink
        </button>
        {customMl !== '' ? (
          <button type="button" className="water-clear-btn" aria-label="Clear custom water amount" onClick={() => setCustomMl('')}>
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}
