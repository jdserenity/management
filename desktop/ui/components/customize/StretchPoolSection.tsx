import { useSession } from '@/context/SessionContext';
import {
  resolveAllowedStretchPickKeys,
  stretchHoldSecondsForPickKey
} from '@/lib/workoutCustomize';
import { STRETCH_PICK_CATALOG, formatExerciseAmount } from '@/lib/workoutPlanner';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const unitShort = (): string => 'sec';

export default function StretchPoolSection() {
  const { workoutCustomizePrefs, handleStretchPickToggle, updateStretchHoldSeconds } = useSession();
  const allowedStretchKeys = resolveAllowedStretchPickKeys(workoutCustomizePrefs);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Break stretch pool</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose which stretches can appear in mixed exercise breaks during focus flows. Stretch creator routines can use any stretch; these toggles do not limit that.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Default hold per stretch</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
            value={workoutCustomizePrefs.stretchHoldSeconds}
            onChange={(e) => updateStretchHoldSeconds(Number(e.target.value))}
          />
          <span className="text-muted-foreground">{unitShort()}</span>
        </label>
        <ul className="space-y-2">
          {STRETCH_PICK_CATALOG.map((row) => {
            const enabled = allowedStretchKeys.includes(row.key);
            const isOnlyEnabledStretch = enabled && allowedStretchKeys.length === 1;
            const hold = stretchHoldSecondsForPickKey(row.key, workoutCustomizePrefs);
            const preview = { id: row.key, name: row.label, amount: hold, unit: 'seconds' as const };
            return (
              <li key={row.key} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{formatExerciseAmount(preview)}</p>
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
      </CardContent>
    </Card>
  );
}
