// src/components/daily/WaterSection.tsx

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { activeEntries } from '@/lib/water/entries';
import { entryMl, formatLitres, formatWaterLabel, progressRatio, remainingDisplay, totalWater } from '@/lib/water/totals';
import type { WaterEntry, WaterFile } from '@/lib/water/types';
import { addWaterEntry, loadWaterFile, removeWaterEntry } from '@/lib/waterDb';
import TdeeChainConnector from '@/components/daily/TdeeChainConnector';
import { hasAppStorage } from '@/lib/appRuntime';
import './water.css';

const QUICK_AMOUNTS = [100, 250, 500, 750, 1000] as const;

type Props = {
  refreshKey?: number;
};

export default function WaterSection({ refreshKey }: Props) {
  const [file, setFile] = useState<WaterFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customMl, setCustomMl] = useState('');

  const refresh = useCallback(async () => {
    if (!hasAppStorage()) { setLoadError(null); setFile(null); return; }
    try {
      setLoadError(null);
      setFile(await loadWaterFile());
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load water data');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (refreshKey != null) void refresh();
  }, [refreshKey, refresh]);

  if (!hasAppStorage()) {
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
    setFile(await removeWaterEntry(file, id));
  };

  const handleAdd = async (ml: number, label?: string) => {
    if (!ml || ml <= 0) return;
    setFile(await addWaterEntry(file, label || formatWaterLabel(ml), ml, 1));
    setCustomMl('');
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
      {chainItems.length > 0 ? <div className="water-chain">{chainItems}</div> : null}
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
    </section>
  );
}
