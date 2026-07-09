// src/components/daily/WaterSection.tsx

import { useState, type ReactNode } from 'react';
import { activeEntries } from '@/lib/water/entries';
import { entryMl, formatLitres, formatWaterLabel, progressRatio, remainingDisplay, totalWater } from '@/lib/water/totals';
import type { WaterEntry } from '@/lib/water/types';
import { addWaterEntry, loadWaterFile, removeWaterEntry } from '@/lib/waterDb';
import { completeTasksLinkedToWater, uncompleteTasksLinkedToWater } from '@/lib/streak/crossLinks';
import TdeeChainConnector from '@/components/daily/TdeeChainConnector';
import { useFeatureFileRefresh } from '@/lib/useFeatureFileRefresh';
import './water.css';

const QUICK_AMOUNTS = [100, 250, 500, 750, 1000] as const;

type Props = {
  refreshKey?: number;
  onLinkedTaskComplete?: () => void;
};

export default function WaterSection({ refreshKey, onLinkedTaskComplete }: Props) {
  const { file, loadError, setFile, storageReady } = useFeatureFileRefresh(loadWaterFile, 'Failed to load water data', refreshKey);
  const [addMode, setAddMode] = useState(false);
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
    // Lockstep: no water left for the day → water-linked tasks uncheck.
    if (activeEntries(next.entries).length === 0) {
      try {
        await uncompleteTasksLinkedToWater();
      } catch (e) {
        console.error('Failed to uncomplete tasks linked to water', e);
      }
      onLinkedTaskComplete?.();
    }
  };

  const handleAdd = async (ml: number, label?: string) => {
    if (!ml || ml <= 0) return;
    setFile(await addWaterEntry(file, label || formatWaterLabel(ml), ml, 1));
    setCustomMl('');
    setAddMode(false);
    try {
      await completeTasksLinkedToWater();
    } catch (e) {
      console.error('Failed to complete tasks linked to water', e);
    }
    onLinkedTaskComplete?.();
  };

  const renderChip = (entry: WaterEntry, withConnector: boolean) => {
    const amount = entryMl(entry);
    const chipLabel = entry.count > 1 ? `${formatWaterLabel(entry.ml)} ×${entry.count}` : formatWaterLabel(amount);
    return (
      <>
        {withConnector ? <TdeeChainConnector /> : null}
        <button
          type="button"
          className="water-chain-btn water-chain-done water-chain-btn-single"
          title={`${chipLabel} — click to remove`}
          onClick={() => void handleRemove(entry.id)}
        >
          <span className="water-chain-label">{chipLabel}</span>
        </button>
      </>
    );
  };

  const chainItems: ReactNode[] = [];
  logged.forEach((entry, i) => {
    chainItems.push(renderChip(entry, i > 0));
  });

  if (chainItems.length > 0) chainItems.push(<TdeeChainConnector key="c-plus" />);
  chainItems.push(
    <button
      key="plus"
      type="button"
      className={`water-chain-btn water-chain-plus${addMode ? ' water-chain-plus-disabled' : ''}`}
      title={addMode ? 'Close add menu first' : 'Log water'}
      disabled={addMode}
      onClick={() => setAddMode(true)}
    >
      +
    </button>
  );

  return (
    <section className="water-tracker-container" aria-label="Water">
      <div className="water-summary">
        <div className="water-counts">
          <span className="water-today">{formatLitres(total)}</span>
          {target > 0 ? (
            <>
              <span className="water-sep"> / </span>
              <span className="water-target">{formatLitres(target)} daily goal 💧</span>
            </>
          ) : null}
        </div>
        <div className={`water-remaining${waterRemaining.extraClass}`}>
          {target > 0 ? waterRemaining.text : 'Set water target in Customize → Food'}
        </div>
        {target > 0 ? (
          <div className="water-progress">
            <div className="water-progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="water-chain">{chainItems}</div>
      {addMode ? (
        <div className="water-add-panel">
          <div className="water-add-header">
            <span className="water-add-title">Drink water</span>
            <button type="button" className="water-add-close" title="Close" aria-label="Close" onClick={() => setAddMode(false)}>
              ×
            </button>
          </div>
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
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
            />
            <button
              type="button"
              className="water-log-btn"
              onClick={() => void handleAdd(Math.round(Number(customMl) || 0))}
            >
              Drink
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
