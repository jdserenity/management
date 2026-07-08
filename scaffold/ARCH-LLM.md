# Architecture (agent reference)

Architecture overview built for agents. Dense and compact — optimized so an agent can understand the system without grepping the whole codebase.

Confirmed product and system facts only. No open questions or lessons (those belong in scaffold/PROJECT-KNOWLEDGE.md).

## Movement Snacks

- Feature: Movement Snacks — a daily goal of N movement snacks (default 6).
- Each snack has two versions:
  - **Hard** (ideal): 10 pushups, 20 air squats, 11 reverse crunches (reps)
  - **Easy** (fallback): 10 pushups, 10 reverse lunges (reps), 25s plank (seconds)
- All exercises and their amounts/units are fully customizable via the Snacks tab under Customize.
- Tracks completions per day via `workout_log` entries with `workout_id = 'movement-snack'`.
- The same workout logs feed into `todayExerciseTotals` (summarizeTodayExerciseTotals), so movement snacks automatically contribute to the aggregated today's movement totals alongside morning stretches, exercise breaks, and manual exercises.

### Key files
- `desktop/ui/lib/movementSnack/movementSnack.ts` — types (`MovementSnackPrefs`), defaults, `buildMovementSnackLogEntry()`, `countMovementSnacksToday()`.
- `desktop/ui/lib/movementSnack/movementSnackPref.ts` — load/save from `app_kv` with key `movement_snack_prefs_v1`.
- `desktop/ui/context/SessionContext.tsx` — exposes `movementSnackPrefs`, `todayMovementSnacks`, `updateMovementSnackPrefs(patch)`, `logMovementSnackCompletion(easy)`.
- `desktop/ui/components/daily/MovementSnackSection.tsx` — daily tab card with progress bar, hard/easy buttons.
- `desktop/ui/components/customize/CustomizeMovementSnacksPanel.tsx` — customize panel for goal number and per-version exercise lists.

### Data flow
1. `SessionContext` loads `movementSnackPrefs` from `app_kv` during init via `loadSessionStorage()`.
2. `todayMovementSnacks` is computed by `countMovementSnacksToday()` which filters `workoutLogs` for `workoutId === 'movement-snack'` within the current stats day window.
3. Clicking "Log hard snack" or "Log easy snack" calls `logMovementSnackCompletion(easy)` which calls `buildMovementSnackLogEntry()` → persists via `persistWorkoutLog()` → adds to `workoutLogs` state.
4. Because it's a normal workout log entry, it contributes to `todayExerciseTotals` / `todayStretchTotals` naturally.
5. Morning stretches (`workoutId = 'morning-stretch'`) and exercise breaks already log to `workoutLogs` the same way, so they were already contributing to today's totals before this feature.

### UI locations
- **Daily tab**: `MovementSnackSection` sits between `DailyStretchSections` and `StreakSection`.
- **Work tab**: "Today's movement" card was removed since the movement tracking is now consolidated in the Daily tab via movement snacks and the existing stretch/exercise-break logging.
- **Customize tab**: New "Snacks" tab with exercise list editing for hard/easy versions and daily goal input.
