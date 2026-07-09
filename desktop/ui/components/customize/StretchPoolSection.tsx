import { useSession } from '@/context/SessionContext';
import {
  resolveAllowedStretchPickKeys,
  stretchHoldSecondsForPickKey
} from '@/lib/workoutCustomize';
import { STRETCH_PICK_CATALOG, formatExerciseAmount } from '@/lib/workoutPlanner';
import { Switch } from '@/components/ui/switch';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';

export default function StretchPoolSection() {
  const { workoutCustomizePrefs, handleStretchPickToggle, updateStretchHoldSeconds } = useSession();
  const allowedStretchKeys = resolveAllowedStretchPickKeys(workoutCustomizePrefs);

  return (
    <CustomizePanel
      title="Break stretch pool"
      description="Choose which stretches can appear in mixed exercise breaks during focus flows. Stretch creator routines can use any stretch; these toggles do not limit that."
    >
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Default hold per stretch</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          className="plugin-input w-16 font-semibold tabular-nums"
          value={workoutCustomizePrefs.stretchHoldSeconds}
          onChange={(e) => updateStretchHoldSeconds(Number(e.target.value))}
        />
        <span className="plugin-muted">sec</span>
      </label>
      <ul className="space-y-2">
        {STRETCH_PICK_CATALOG.map((row) => {
          const enabled = allowedStretchKeys.includes(row.key);
          const isOnlyEnabledStretch = enabled && allowedStretchKeys.length === 1;
          const hold = stretchHoldSecondsForPickKey(row.key, workoutCustomizePrefs);
          const preview = { id: row.key, name: row.label, amount: hold, unit: 'seconds' as const };
          return (
            <li key={row.key} className="plugin-row !border-border !py-2 px-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="plugin-muted text-xs">{formatExerciseAmount(preview)}</p>
              </div>
              <Switch
                checked={enabled}
                disabled={isOnlyEnabledStretch}
                onCheckedChange={(checked) => handleStretchPickToggle(row.key, checked)}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>
    </CustomizePanel>
  );
}
