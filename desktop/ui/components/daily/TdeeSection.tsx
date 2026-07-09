// src/components/daily/TdeeSection.tsx

import { useState } from 'react';
import { activeEntries, isStapleLogged } from '@/lib/tdee/entries';
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
import {
  addCustomEntry,
  addRegularEntry,
  addStapleEntry,
  loadTdeeFile,
  removeTdeeEntry
} from '@/lib/tdeeDb';
import { completeTasksLinkedToStaple, uncompleteTasksLinkedToStaple } from '@/lib/streak/crossLinks';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import {
  buildTrackerChain,
  TrackerAddPanel,
  TrackerPlusButton,
  TrackerSummary,
} from '@/components/daily/TrackerChain';
import './tdee.css';

type PortionControlsProps = {
  defaultCalories?: number;
  defaultProtein?: number;
  placeholderCalories?: string;
  placeholderProtein?: string;
  actionLabel?: string;
  onAdd: (calories: number, protein: number, count: number) => Promise<void>;
};

function PortionControls({ defaultCalories, defaultProtein, placeholderCalories, placeholderProtein, actionLabel = 'Eat', onAdd }: PortionControlsProps) {
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
        step={0.1}
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
          const p = normalizeMacro(Number(protein) || 0);
          const count = Math.max(1, Math.round(Number(qty) || 1));
          if (!c || c <= 0) return;
          void onAdd(c, p, count);
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

type Props = {
  refreshKey?: number;
  onLinkedTaskComplete?: () => void;
};

export default function TdeeSection({ refreshKey, onLinkedTaskComplete }: Props) {
  const { data: file, loadError, setData: setFile, storageReady } = useAppDataLoad(
    loadTdeeFile,
    'Failed to load nutrition data',
    { refreshKey }
  );
  const [addMode, setAddMode] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

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
  const pendingStaples = file.staples.filter((s) => !isStapleLogged(file.entries, s.id));

  const handleRemove = async (id: string) => {
    const entry = activeEntries(file.entries).find((e) => e.id === id);
    setFile(await removeTdeeEntry(file, id));
    // Lockstep: removing a staple unchecks the linked habit task.
    if (entry?.kind === 'staple' && entry.refId) {
      try {
        await uncompleteTasksLinkedToStaple(entry.refId);
      } catch (e) {
        console.error('Failed to uncomplete tasks linked to staple', entry.refId, e);
      }
      onLinkedTaskComplete?.();
    }
  };

  const afterStapleLogged = async (stapleId: string) => {
    try {
      await completeTasksLinkedToStaple(stapleId);
    } catch (e) {
      console.error('Failed to complete tasks linked to staple', stapleId, e);
    }
    // Always re-read habits after a staple log so linked tasks show as checked.
    onLinkedTaskComplete?.();
  };

  const handleStaple = async (staple: TdeeMealDef) => {
    setFile(await addStapleEntry(file, staple));
    await afterStapleLogged(staple.id);
  };

  const handleStapleFromEditor = async (staple: TdeeMealDef, calories: number, protein: number, count: number) => {
    // Logs as kind staple + refId so the day's staple chip is replaced (pending chip hides).
    setFile(await addStapleEntry(file, staple, calories, protein, count));
    setAddMode(false);
    await afterStapleLogged(staple.id);
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

  const pendingNodes = !addMode
    ? (pendingStaples.length === 0 && logged.length === 0
      ? [
          <p key="empty" className="tdee-tracker-empty tdee-chain-empty">
            No staples configured yet. Add staples in Customize → Food.
          </p>
        ]
      : pendingStaples.map((staple) => (
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
        )))
    : [];

  const chainItems = buildTrackerChain({
    chips: [...loggedChips, ...pendingNodes],
    plus: (
      <TrackerPlusButton
        key="plus"
        prefix="tdee"
        addMode={addMode}
        onOpen={() => setAddMode(true)}
        titleClosed="Log a regular or one-off meal"
      />
    )
  });

  const kcalRemaining = remainingDisplay(total, tdee);
  const proteinRemaining = proteinRemainingDisplay(proteinTotal, proteinTarget);

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
      <div className="tdee-chain">{chainItems}</div>
      {addMode ? (
        <TrackerAddPanel prefix="tdee" title={<>Staples, regulars &amp; one-off</>} onClose={() => setAddMode(false)}>
          <div className="tdee-regular-list">
            {file.staples.length === 0 ? (
              <p className="tdee-tracker-empty">No staples configured yet. Add them in Customize → Food.</p>
            ) : (
              file.staples.map((staple) => {
                const alreadyLogged = isStapleLogged(file.entries, staple.id);
                return (
                  <div key={staple.id} className="tdee-regular-row">
                    <div className="tdee-regular-info">
                      <span className="tdee-regular-name">
                        {staple.name}
                        {alreadyLogged ? <span className="tdee-tracker-empty"> · logged</span> : null}
                      </span>
                      {staple.ingredients?.length ? (
                        <div className="tdee-regular-ingredients">{formatIngredientsList(staple.ingredients)}</div>
                      ) : null}
                    </div>
                    <PortionControls
                      defaultCalories={staple.calories}
                      defaultProtein={staple.protein}
                      actionLabel={alreadyLogged ? 'Add more' : 'Eat'}
                      onAdd={(calories, protein, count) => handleStapleFromEditor(staple, calories, protein, count)}
                    />
                  </div>
                );
              })
            )}
          </div>
          <div className="tdee-regular-list">
            {file.regulars.length === 0 ? (
              <p className="tdee-tracker-empty">No regulars configured yet. Add them in Customize → Food.</p>
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
                placeholder="One-Off"
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
        </TrackerAddPanel>
      ) : null}
    </section>
  );
}
