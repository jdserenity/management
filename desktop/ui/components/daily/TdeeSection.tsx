// src/components/daily/TdeeSection.tsx

import { useState } from 'react';
import { activeEntries } from '@/lib/tdee/entries';
import { formatIngredientsList, normalizeMacro } from '@/lib/tdee/ingredients';
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
import type { TdeeMealDef } from '@/lib/tdee/types';
import { filterRegulars, hasCustomFoodInput, regularFromSearch } from '@/lib/tdee/meals';
import {
  addCustomEntry,
  loadTdeeFile,
  removeTdeeEntry,
  upsertTdeeRegular
} from '@/lib/tdeeDb';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import {
  TrackerSummary,
  withChainConnectors,
} from '@/components/daily/TrackerChain';
import './tdee.css';

type Props = {
  refreshKey?: number;
  onTrackerLinkedTaskChange?: () => void;
};

export default function TdeeSection({ refreshKey, onTrackerLinkedTaskChange }: Props) {
  const { data: file, loadError, setData: setFile, storageReady } = useAppDataLoad(
    loadTdeeFile,
    'Failed to load nutrition data',
    { refreshKey }
  );
  const [customTitle, setCustomTitle] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [regularSearch, setRegularSearch] = useState('');

  if (!storageReady) {
    return (
      <section className="tdee-tracker-container" aria-label="Nutrition">
        <p className="tdee-tracker-empty text-sm">Storage is not ready yet.</p>
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

  const handleRemove = async (id: string) => {
    setFile(await removeTdeeEntry(file, id));
    onTrackerLinkedTaskChange?.();
  };

  const handleEat = async () => {
    const calories = Math.round(Number(customCalories));
    if (!calories || calories <= 0) return;
    const protein = normalizeMacro(Number(customProtein) || 0);
    const count = Math.max(1, Math.round(Number(customQty) || 1));
    setFile(await addCustomEntry(file, customTitle, calories, protein, count));
    setCustomTitle('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomQty('1');
    onTrackerLinkedTaskChange?.();
  };

  const handleClearCustom = () => {
    setCustomTitle('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomQty('1');
    setRegularSearch('');
  };

  const handleAddRegularFromSearch = async () => {
    const meal = regularFromSearch(regularSearch, customCalories, customProtein, file.regulars);
    if (!meal) {
      // A regular needs calories: park the searched name in the Add food row
      // so the user can type calories/protein, then tap this button again.
      setCustomTitle(regularSearch.trim());
      return;
    }
    setFile(await upsertTdeeRegular(file, meal, true));
  };

  const handlePickRegular = (regular: TdeeMealDef) => {
    setCustomTitle(regular.name);
    setCustomCalories(String(regular.calories));
    setCustomProtein(String(regular.protein));
    setCustomQty('1');
  };

  const loggedChips = logged.map((entry) => {
    const amount = entryCalories(entry);
    const protein = entryProtein(entry);
    const macros = formatChipMacros(amount, protein);
    const displayLabel = entry.count > 1 ? `${entry.label} ×${entry.count}` : entry.label;
    return (
      <button
        key={entry.id}
        type="button"
        className="tdee-chain-btn tdee-chain-done"
        title={`${macros} — click to remove`}
        onClick={() => void handleRemove(entry.id)}
      >
        <span className="tdee-chain-label">{displayLabel}</span>
        <span className="tdee-chain-kcal">{macros}</span>
      </button>
    );
  });

  const kcalRemaining = remainingDisplay(total, tdee);
  const proteinRemaining = proteinRemainingDisplay(proteinTotal, proteinTarget);
  const visibleRegulars = filterRegulars(file.regulars, regularSearch);

  return (
    <section className="tdee-tracker-container" aria-label="Nutrition">
      <TrackerSummary
        prefix="tdee"
        today={<>{formatCalories(total)} kcal</>}
        target={tdee > 0 ? <>{formatCalories(tdee)} TDEE ⚡</> : undefined}
        remainingText={tdee > 0 ? kcalRemaining.text : 'Set TDEE and protein targets in Customize → Food'}
        remainingClass={kcalRemaining.extraClass}
        progressRatio={ratio}
        showProgress={tdee > 0}
      >
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
          {proteinTarget > 0 ? proteinRemaining.text : 'Set protein target in Customize → Food'}
        </div>
        {proteinTarget > 0 ? (
          <div className="tdee-progress">
            <div className="tdee-progress-fill" style={{ width: `${Math.round(proteinRatio * 100)}%` }} />
          </div>
        ) : null}
      </TrackerSummary>
      {loggedChips.length ? <div className="tdee-chain">{withChainConnectors(loggedChips)}</div> : (
        <p className="tdee-tracker-empty">Nothing eaten yet today.</p>
      )}
      <div className="tdee-quick-add">
        <div className="tdee-custom-row tdee-quick-row">
          <input
            className="tdee-meal-title-input"
            type="text"
            placeholder="Add food"
            aria-label="Food name"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          <input
            className="tdee-portion-input"
            type="number"
            min={1}
            step={1}
            placeholder="cals"
            aria-label="Calories"
            value={customCalories}
            onChange={(e) => setCustomCalories(e.target.value)}
          />
          <input
            className="tdee-portion-input tdee-portion-protein"
            type="number"
            min={0}
            step={0.1}
            placeholder="protein"
            aria-label="Protein (g)"
            value={customProtein}
            onChange={(e) => setCustomProtein(e.target.value)}
          />
          <span className="tdee-portion-x">×</span>
          <input
            className="tdee-portion-input tdee-portion-qty"
            type="number"
            min={1}
            step={1}
            aria-label="Quantity"
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
          />
          <button type="button" className="tdee-add-btn" onClick={() => void handleEat()}>
            Eat
          </button>
          {hasCustomFoodInput({ title: customTitle, calories: customCalories, protein: customProtein, qty: customQty }) || regularSearch !== '' ? (
            <button type="button" className="tdee-clear-btn" aria-label="Clear custom food fields" onClick={handleClearCustom}>
              Clear
            </button>
          ) : null}
        </div>
        <div className="tdee-regular-search-row">
          <input
            className="tdee-meal-title-input"
            type="search"
            placeholder="Search regulars"
            aria-label="Search regulars"
            value={regularSearch}
            onChange={(e) => setRegularSearch(e.target.value)}
          />
        </div>
        {file.regulars.length === 0 ? (
          <p className="tdee-tracker-empty">No regulars yet. Add them in Customize → Food.</p>
        ) : regularSearch.trim() === '' ? null : visibleRegulars.length === 0 ? (
          <div className="tdee-regular-no-match">
            <p className="tdee-tracker-empty">No regulars match “{regularSearch}”.</p>
            <button type="button" className="tdee-add-regular-btn" onClick={() => void handleAddRegularFromSearch()}>
              Add “{regularSearch.trim()}” as a regular
            </button>
            {regularFromSearch(regularSearch, customCalories, customProtein, file.regulars) ? null : (
              <p className="tdee-tracker-empty">Enter its calories in Add food above first, then add it.</p>
            )}
          </div>
        ) : (
          <div className="tdee-regular-results">
            {visibleRegulars.map((regular) => (
              <button
                key={regular.id}
                type="button"
                className="tdee-regular-result"
                title="Fill the Add food fields with this regular"
                onClick={() => handlePickRegular(regular)}
              >
                <span className="tdee-regular-name">{regular.name}</span>
                <span className="tdee-chain-kcal">{formatChipMacros(regular.calories, regular.protein)}</span>
                {regular.ingredients?.length ? (
                  <span className="tdee-regular-ingredients">{formatIngredientsList(regular.ingredients)}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
