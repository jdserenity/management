// src/components/daily/TdeeSection.tsx

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { activeEntries, isStapleLogged } from '@/lib/tdee/entries';
import { formatIngredientsList } from '@/lib/tdee/ingredients';
import {
  entryCalories,
  entryProtein,
  formatCalories,
  formatChipMacros,
  formatProtein,
  progressRatio,
  proteinRemainingDisplay,
  remainingDisplay,
  totalCalories,
  totalProtein
} from '@/lib/tdee/totals';
import type { TdeeFile, TdeeLogEntry, TdeeMealDef } from '@/lib/tdee/types';
import {
  addCustomEntry,
  addRegularEntry,
  addStapleEntry,
  loadTdeeFile,
  removeTdeeEntry
} from '@/lib/tdeeDb';
import TdeeChainConnector from '@/components/daily/TdeeChainConnector';
import { isTauri } from '@/lib/isTauri';
import './tdee.css';

type PortionControlsProps = {
  defaultCalories?: number;
  defaultProtein?: number;
  placeholderCalories?: string;
  placeholderProtein?: string;
  onAdd: (calories: number, protein: number, count: number) => Promise<void>;
};

function PortionControls({ defaultCalories, defaultProtein, placeholderCalories, placeholderProtein, onAdd }: PortionControlsProps) {
  const [calories, setCalories] = useState(defaultCalories != null ? String(defaultCalories) : '');
  const [protein, setProtein] = useState(
    defaultProtein != null ? String(defaultProtein) : placeholderProtein ? '' : '0'
  );
  const [qty, setQty] = useState('1');
  return (
    <div className="tdee-portion-wrap">
      <input
        className="tdee-portion-input"
        type="number"
        min={1}
        step={1}
        placeholder={placeholderCalories}
        value={calories}
        onChange={(e) => setCalories(e.target.value)}
      />
      <input
        className="tdee-portion-input tdee-portion-protein"
        type="number"
        min={0}
        step={1}
        placeholder={placeholderProtein}
        value={protein}
        onChange={(e) => setProtein(e.target.value)}
      />
      <span className="tdee-portion-x">×</span>
      <input
        className="tdee-portion-input tdee-portion-qty"
        type="number"
        min={1}
        step={1}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      <button
        type="button"
        className="tdee-add-btn"
        onClick={() => {
          const c = Math.round(Number(calories));
          const p = Math.max(0, Math.round(Number(protein) || 0));
          const count = Math.max(1, Math.round(Number(qty) || 1));
          if (!c || c <= 0) return;
          void onAdd(c, p, count);
        }}
      >
        Add
      </button>
    </div>
  );
}

export default function TdeeSection() {
  const [file, setFile] = useState<TdeeFile | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');

  const refresh = useCallback(async () => {
    if (!isTauri()) { setLoadError(null); setFile(null); return; }
    try {
      setLoadError(null);
      setFile(await loadTdeeFile());
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load nutrition data');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!isTauri()) {
    return (
      <section className="tdee-tracker-container" aria-label="Nutrition">
        <h2 className="mb-4 text-lg font-semibold">Nutrition</h2>
        <p className="tdee-tracker-empty text-sm">Run <code className="text-foreground">npm run tauri dev</code> for SQLite. Browser-only <code className="text-foreground">npm run dev</code> cannot load nutrition data.</p>
      </section>
    );
  }

  if (loadError) {
    return <p className="tdee-tracker-empty">Could not load nutrition: {loadError}</p>;
  }
  if (!file) return <p className="tdee-tracker-empty">Loading nutrition…</p>;

  const logged = activeEntries(file.entries);
  const total = totalCalories(file.entries);
  const tdee = file.tdee || 0;
  const ratio = progressRatio(total, tdee);
  const proteinTotal = totalProtein(file.entries);
  const proteinTarget = file.protein || 0;
  const proteinRatio = progressRatio(proteinTotal, proteinTarget);
  const pendingStaples = file.staples.filter((s) => !isStapleLogged(file.entries, s.id));

  const handleRemove = async (id: string) => {
    setFile(await removeTdeeEntry(file, id));
  };

  const handleStaple = async (staple: TdeeMealDef) => {
    setFile(await addStapleEntry(file, staple));
  };

  const handleRegular = async (regular: TdeeMealDef, calories: number, protein: number, count: number) => {
    setFile(await addRegularEntry(file, regular, calories, protein, count));
    setAddMode(false);
  };

  const handleCustom = async (calories: number, protein: number, count: number) => {
    setFile(await addCustomEntry(file, customTitle, calories, protein, count));
    setCustomTitle('');
    setAddMode(false);
  };

  const renderChip = (entry: TdeeLogEntry, withConnector: boolean) => {
    const amount = entryCalories(entry);
    const protein = entryProtein(entry);
    const macros = formatChipMacros(amount, protein);
    const displayLabel = entry.count > 1 ? `${entry.label} ×${entry.count}` : entry.label;
    return (
      <>
        {withConnector ? <TdeeChainConnector /> : null}
        <button
          type="button"
          className="tdee-chain-btn tdee-chain-done"
          title={`${macros} — click to remove`}
          onClick={() => void handleRemove(entry.id)}
        >
          <span className="tdee-chain-label">{displayLabel}</span>
          <span className="tdee-chain-kcal">{macros}</span>
        </button>
      </>
    );
  };

  const chainItems: ReactNode[] = [];
  logged.forEach((entry, i) => {
    chainItems.push(renderChip(entry, i > 0));
  });

  if (!addMode) {
    if (pendingStaples.length === 0 && logged.length === 0) {
      chainItems.push(
        <p key="empty" className="tdee-tracker-empty tdee-chain-empty">
          No staples configured yet.
        </p>
      );
    } else {
      pendingStaples.forEach((staple, i) => {
        const withConnector = chainItems.length > 0 || i > 0;
        chainItems.push(
          withConnector ? <TdeeChainConnector key={`c-s-${staple.id}`} /> : null,
          <button
            key={`s-${staple.id}`}
            type="button"
            className="tdee-chain-btn"
            title={`+${formatChipMacros(staple.calories, staple.protein)}`}
            onClick={() => void handleStaple(staple)}
          >
            <span className="tdee-chain-label">{staple.name}</span>
            <span className="tdee-chain-kcal">{formatChipMacros(staple.calories, staple.protein)}</span>
          </button>
        );
      });
    }
  }

  if (chainItems.length > 0) chainItems.push(<TdeeChainConnector key="c-plus" />);
  chainItems.push(
    <button
      key="plus"
      type="button"
      className={`tdee-chain-btn tdee-chain-plus${addMode ? ' tdee-chain-plus-disabled' : ''}`}
      title={addMode ? 'Close add menu first' : 'Add regular or custom calories'}
      disabled={addMode}
      onClick={() => setAddMode(true)}
    >
      +
    </button>
  );

  const kcalRemaining = remainingDisplay(total, tdee);
  const proteinRemaining = proteinRemainingDisplay(proteinTotal, proteinTarget);

  return (
    <section className="tdee-tracker-container" aria-label="Nutrition">
      <h2 className="mb-4 text-lg font-semibold">Nutrition</h2>
      <div className="tdee-summary">
        <div className="tdee-counts">
          <span className="tdee-today">{formatCalories(total)} kcal</span>
          {tdee > 0 ? (
            <>
              <span className="tdee-sep"> / </span>
              <span className="tdee-target">{formatCalories(tdee)} TDEE ⚡</span>
            </>
          ) : null}
        </div>
        <div className={`tdee-remaining${kcalRemaining.extraClass}`}>{tdee > 0 ? kcalRemaining.text : 'Set TDEE and protein targets in Settings (coming soon)'}</div>
        {tdee > 0 ? (
          <div className="tdee-progress">
            <div className="tdee-progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
        <div className="tdee-counts tdee-protein-counts">
          <span className="tdee-today">{formatProtein(proteinTotal)} g</span>
          {proteinTarget > 0 ? (
            <>
              <span className="tdee-sep"> / </span>
              <span className="tdee-target">{formatProtein(proteinTarget)} protein 🥩</span>
            </>
          ) : null}
        </div>
        <div className={`tdee-remaining${proteinRemaining.extraClass}`}>
          {proteinTarget > 0 ? proteinRemaining.text : 'Set protein target in Settings (coming soon)'}
        </div>
        {proteinTarget > 0 ? (
          <div className="tdee-progress">
            <div className="tdee-progress-fill" style={{ width: `${Math.round(proteinRatio * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="tdee-chain">{chainItems}</div>
      {addMode ? (
        <div className="tdee-add-panel">
          <div className="tdee-add-header">
            <span className="tdee-add-title">Regulars &amp; custom</span>
            <button type="button" className="tdee-add-close" title="Close" aria-label="Close" onClick={() => setAddMode(false)}>
              ×
            </button>
          </div>
          <div className="tdee-regular-list">
            {file.regulars.length === 0 ? (
              <p className="tdee-tracker-empty">No regulars configured yet.</p>
            ) : (
              file.regulars.map((regular) => (
                <div key={regular.id} className="tdee-regular-row">
                  <div className="tdee-regular-info">
                    <span className="tdee-regular-name">{regular.name}</span>
                    {regular.ingredients?.length ? (
                      <div className="tdee-regular-ingredients">{formatIngredientsList(regular.ingredients)}</div>
                    ) : null}
                  </div>
                  <PortionControls
                    defaultCalories={regular.calories}
                    defaultProtein={regular.protein}
                    onAdd={(calories, protein, count) => handleRegular(regular, calories, protein, count)}
                  />
                </div>
              ))
            )}
          </div>
          <div className="tdee-custom-row">
            <div className="tdee-regular-info">
              <input
                className="tdee-meal-title-input"
                type="text"
                placeholder="Custom"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>
            <PortionControls
              placeholderCalories="cals"
              placeholderProtein="protein"
              onAdd={(calories, protein, count) => handleCustom(calories, protein, count)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
