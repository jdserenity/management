# REFACTOR1 — Complete port (Streak Tracker + TDEE Tracker → Management)

**Read this first** when picking up the `refactor/complete-port` worktree with no chat history. Execution checklist lives in `docs/TODO.md` (same phase names). Product/system facts that ship with the app eventually merge into `docs/ARCHITECTURE.md` in Phase 4.

---

## Why this exists

The owner uses two Obsidian plugins every day — **Streak Tracker** (habits/streaks) and **TDEE Tracker** (daily nutrition vs targets). Both are being **ported into** the Tauri desktop app **Management** so everything lives in one place, with SQLite instead of vault markdown JSON, and React UI instead of Obsidian code blocks.

- **Do not delete or modify** the Obsidian plugins in the vault (`…/obsidian vault (root)/.obsidian/plugins/streak-tracker` and `tdee-tracker`). They stay as reference and fallback during transition.
- **Source of truth for behavior** during the port: sibling git clones (see below), especially `src/domain/*` and `test/*`.

---

## Repos and paths

| What | Path |
|------|------|
| Management app (this repo) | `/Users/jd/Documents/coding-temp/management-wt-refactor-complete-port` |
| Git branch | `refactor/complete-port` |
| Streak Tracker source | `../obs-streak-tracker` → `/Users/jd/Documents/coding-temp/obs-streak-tracker` |
| TDEE Tracker source | `../obs-tdee-tracker` → `/Users/jd/Documents/coding-temp/obs-tdee-tracker` |
| Vault plugin bundles (read-only reference) | `/Users/jd/Documents/obsidian-temp/obsidian vault (root)/.obsidian/plugins/{streak-tracker,tdee-tracker}` |
| Vault JSON to import (user data) | `Archive/streak-tracker-config.md`, `Archive/streak-tracker-data.md`, `Archive/tdee-tracker-config.md` inside the vault |

Run plugin tests from clone roots: `npm test` (Node `node:test`). Management tests: `npm test` (Vitest).

---

## Confirmed product decisions (do not re-litigate)

| Topic | Decision |
|-------|----------|
| **Daily tab** | New **first** nav tab. Combined **nutrition (TDEE) + habits (streaks)** on one scrollable page. |
| **Work tab** | Current `Dashboard.tsx` timer flow (Pomodoro / Deep Work / breaks). Rename label **Dashboard → Work**. Second tab. |
| **Activity config** | Streak activities defined and edited **in the app** (add / edit / archive). No vault markdown config files in the shipped product. |
| **Wikilinks** | **Dropped.** Activity names are plain text; optional `description` field stays (expand/collapse in Obsidian UI → port as simple text, no `[[note]]` parsing or link color for vault notes). |
| **Nutrition history** | **Today only** for v1. No multi-day nutrition log table yet. Day rollover clears today’s entries (same as plugin). Staples/regulars/targets persist. |
| **Day boundary** | **One setting** for the whole app: existing `stats_day_rollover_hour_v1` in `app_kv` (default hour **4**, i.e. 4:00 AM local). TDEE and streaks must use this — **not** separate `dayEndTime` settings. Implement streak/TDEE `getCurrentDay` on top of `src/lib/dayBoundary.ts` (plugins used `"04:00"` string; Management uses hour integer 0–23). |
| **Multi-device sync** | **Not ported.** Obsidian vault merge/LWW/`SyncCoordinator`/`vault.on("modify")` goes away. Single SQLite on one machine. |
| **Scope** | Full feature parity for streak UI (heatmaps, pause, reset, archive, confetti, weekly activities) except wikilinks and cross-device sync. |

### Target nav order (after Phase 1 nav work)

1. **Daily** (`DailyPage.tsx` — new)
2. **Work** (`Dashboard.tsx` — rename only in nav/i18n)
3. Posture
4. Customize workouts
5. Stats
6. Settings

Default `activeComponentId` on boot: **`daily`** (not `dashboard`).

---

## Daily tab layout (UX intent)

Single page, top to bottom:

1. **Nutrition** — TDEE section: kcal + protein summary bars, remaining/surplus, chain of logged chips, staples, `+` add flow (regulars + custom). Match plugin behavior from `obs-tdee-tracker/src/ui/tracker-view.js` and `styles.css`.
2. **Habits** — Streak section: yearly heatmap, weekly heatmap (if weekly activities exist), today’s daily activities, today’s weekly activities. Match `obs-streak-tracker/src/ui/tracker-view.js` and `styles.css`.

Use existing Management UI primitives (`src/components/ui/*`) where practical; port plugin CSS ideas into scoped classes or `App.css` / component CSS modules — do not depend on Obsidian theme variables.

---

## Architecture: what moves where

### From Obsidian plugins → Management

```
obs-*/src/domain/*     →  src/lib/streak/*  and  src/lib/tdee/*  (TypeScript, pure logic)
obs-*/src/store/*      →  React context and/or hooks + src/lib/*/db.ts (not a 1:1 store class)
obs-*/src/infra/*      →  DELETE pattern; replace with SQLite in src/lib/*Db.ts
obs-*/src/ui/*         →  React components under src/components/daily/ (suggested)
obs-*/src/plugin.js    →  gone (no Obsidian lifecycle)
```

### Management patterns to copy

| Concern | Existing example |
|---------|------------------|
| SQLite access | `src/lib/db.ts` → `getDb()`, migrations in `src-tauri/src/main.rs` (`Migration` version N) |
| Feature DB layer | `src/lib/sessionDb.ts` — typed rows, `app_kv` flags, import from legacy |
| Day rollover | `src/lib/dayBoundary.ts`, `src/lib/dayBoundaryPref.ts`, Settings UI |
| Tab shell | `src/App.tsx` `navItems` array |
| Tests | `src/lib/*.test.ts` Vitest, colocated with lib |

Add SQL migrations as **version 5+** in `main.rs` (current latest is **4**). Frontend reads/writes via `@tauri-apps/plugin-sql` like `sessionDb.ts`.

---

## TDEE Tracker — behavioral spec

Full plugin doc: `../obs-tdee-tracker/docs/ARCHITECTURE.md`.

### Domain modules to port (`obs-tdee-tracker/src/domain/`)

| File | Purpose |
|------|---------|
| `defaults.js` | Default targets, empty staples/regulars |
| `dates.js` | `getCurrentDay(dayEndTime)`, `formatDate` |
| `entries.js` | Entry ids, staple logged check, `ensureCurrentDay` clears entries |
| `ingredients.js` | Format ingredient lists on regulars |
| `normalize.js` | Normalize file shape on load |
| `merge.js` | LWW merge (needed for **import** from vault snapshot; not runtime sync) |
| `totals.js` | Sums, progress ratio, remaining/surplus display copy |

### Data model (logical)

Persisted config (survives day rollover):

- `tdee` — number, kcal target
- `protein` — number, grams target
- `staples[]` — `{ id, name, calories, protein?, ingredients? }`
- `regulars[]` — same shape; used in add menu

Today-only (reset when calendar day changes per rollover):

- `day` — `YYYY-MM-DD` string for current log day
- `entries[]` — `{ id, kind: 'staple'|'regular'|'custom', refId?, label, calories, protein, count, updatedAt }`
  - Tombstone: `{ id, deleted: true, updatedAt }` filtered by `activeEntries`

### UI parity

- Progress bars for kcal and protein
- Surplus over TDEE shown in green with 💪 (see `totals.js` `remainingDisplay`)
- Logged foods as green chips in a chain (SVG connectors — `chain-connector.js`)
- Staple logs once per day; click chip to remove
- Add mode: pick regular or custom, edit kcal/protein before add
- Invalid JSON was a vault concern; SQLite removes that failure mode

### Tests to port/adapt (`obs-tdee-tracker/test/`)

`chain-connector`, `chain-layout`, `dates`, `defaults`, `entries`, `ingredients`, `merge`, `normalize`, `totals`. Skip `plugin-refresh.test.js` (Obsidian-specific) unless rewriting as integration smoke.

---

## Streak Tracker — behavioral spec

Full plugin doc: `../obs-streak-tracker/docs/ARCHITECTURE.md`.

### Domain modules to port (`obs-streak-tracker/src/domain/`)

| File | Purpose |
|------|---------|
| `defaults.js` | Default settings shape (heatmap color etc.) |
| `dates.js` | Day strings, week helpers, `getCurrentDay` |
| `logs.js` | Log cells `{ state, updatedAt }`, states `success` / `failed` / `none`, normalization |
| `merge.js` | Merge logs and state (import + any future conflict resolution) |
| `pause-sync.js` | Pause/unpause merge rules |
| `activity-reset.js` | Clear logs for one activity, reset counts |
| `stats.js` | `calculateStats`, `calculateWeeklyStats`, `recalculateAllStats` |
| `activity-catalog.js` | Which activities count on which days; archive/pause/log-only |
| `heatmap-helpers.js` | Perfect day, completion counts |
| `heatmap-layout.js` | Month spans for heatmap grid |
| `streak-display.js` | Streak tier display / fire emoji class |
| `archive-backfill.js` | Set `archivedAt` on archive migrate |

### Activity config (what “activity config” means)

Stored in DB, edited in-app. Two buckets like the plugin:

**`activities[]`** — active definitions. Typical fields per activity:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable slug |
| `name` | string | Display name (plain text; **no wikilinks**) |
| `description` | string? | Optional; collapsible in UI |
| `frequency` | `'daily'` (default) or `'weekly'` | |
| `weeklyTarget` | number? | Sessions per ISO week (default 1) |
| `scheduledDays` | string[]? | e.g. `["Mon","Tue",…]` for weekly |
| `canFail` | boolean? | Show fail ✗ button |

**`archivedActivities[]`** — moved here on archive with `archivedAt` (`YYYY-MM-DD`). Still counts in heatmap for dates before archive. **Never delete** config rows that have history — archive instead.

### Data / logs (persisted)

Plugin vault file `streak-tracker-data.md` JSON body (no `stats` on disk — stats are derived):

```ts
{
  logs: Record<string, Record<string, { state: 'success'|'failed'|'none', updatedAt: string } | null>>,
  activityStartDates: Record<string, string>,  // YYYY-MM-DD
  pausedActivities: Record<string, string>,    // activityId → pause start day
  unpausedActivities: Record<string, string>,  // activityId → unpause day
  activityResetCounts: Record<string, number>
}
```

`stats` computed in memory only via `recalculateAllStats` after load or log change.

### UI parity (Phase 3)

- Yearly contribution heatmap (configurable base color — was `heatmapColor` in plugin settings)
- Separate weekly heatmap when weekly activities exist
- Per activity: ✓ success, optional ✗ fail, pause/resume, reset stats, archive
- Secondary actions: plugin hid pause/archive/reset behind **Alt** (or other modifier) on hover — can ship as always-visible icon buttons first, or port modifier behavior later
- **Confetti** when all activities due that day are success (`canvas-confetti` — add npm dep)
- Weekly row: session chips `n/weeklyTarget this week`, scheduled day labels
- **No** wikilink rendering in names/descriptions

### Settings to port into Management Settings

| Plugin setting | Management home |
|----------------|-----------------|
| `dayEndTime` | **Use** `stats_day_rollover_hour_v1` only |
| `heatmapColor` | New `app_kv` key e.g. `streak_heatmap_color_v1` or Settings section |
| `linkColor` | **Drop** (wikilinks dropped) |
| `secondaryModifier` | Optional; defer or Settings |
| `configFilePath` / `dataFilePath` | **Drop** (no vault files) |

### Tests to port/adapt (`obs-streak-tracker/test/`)

Port domain tests: `activity-catalog`, `activity-reset`, `archive-backfill`, `heatmap`, `heatmap-layout`, `merge`, `pause-sync`, `stats`, `streak-display`. Skip or rewrite `sync-coordinator`, `refresh-ui` (vault sync). `plugin-refresh` N/A.

---

## Proposed SQLite schema (v5 migration — adjust if needed)

Use normalized tables where queries matter; JSON columns OK for nested blobs if faster for v1.

### TDEE

```sql
-- config singleton row or app_kv JSON blob 'tdee_config_v1'
-- Option A: tables
CREATE TABLE nutrition_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tdee INTEGER NOT NULL DEFAULT 0,
  protein INTEGER NOT NULL DEFAULT 0,
  log_day TEXT NOT NULL DEFAULT ''  -- YYYY-MM-DD for current entries
);
CREATE TABLE nutrition_staples (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL DEFAULT 0,
  ingredients_json TEXT
);
CREATE TABLE nutrition_regulars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL DEFAULT 0,
  ingredients_json TEXT
);
CREATE TABLE nutrition_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ref_id TEXT,
  label TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
```

On day rollover: delete or soft-delete all `nutrition_entries` where `log_day` ≠ current; update `nutrition_config.log_day`.

### Streak

```sql
CREATE TABLE streak_activities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  weekly_target INTEGER,
  scheduled_days_json TEXT,
  can_fail INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE streak_log_cells (
  log_date TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (log_date, activity_id)
);

CREATE TABLE streak_activity_meta (
  activity_id TEXT PRIMARY KEY,
  start_date TEXT,
  pause_since TEXT,
  unpaused_at TEXT,
  reset_count INTEGER NOT NULL DEFAULT 0
);
```

Alternative: one `app_kv` JSON blob per subsystem for speed — acceptable for v1 if migrations stay simple; prefer tables if heatmap queries get awkward.

### Import flags

```sql
-- app_kv keys (suggested):
-- 'vault_import_streak_v1' = 'done' | timestamp
-- 'vault_import_tdee_v1' = 'done' | timestamp
```

---

## Vault import (one-time)

**No in-app import UI.** Owner data was migrated once via `npm run import:vault` (`scripts/import-vault-once.ts`), which reads vault Archive JSON and writes SQLite. Re-run with `--force` after `npm run db:backup` if needed.

**Source files** (default `~/Documents/obsidian-temp/obsidian vault (root)/Archive/`, override with `VAULT_ARCHIVE_DIR`):

1. `tdee-tracker-config.md` — JSON body → nutrition tables
2. `streak-tracker-config.md` — activities → `streak_activities`
3. `streak-tracker-data.md` — logs + meta → `streak_log_cells` + `streak_activity_meta`

`app_kv` keys `vault_import_tdee_v1` and `vault_import_streak_v1` record completion timestamps.

**Phase 0:** Copy real JSON into `test/fixtures/refactor1/` in Management repo for import + stats regression tests.

---

## Phases (detailed) — sync with `docs/TODO.md`

Check off items in `TODO.md` as completed (agent name + date on resolve per `AGENTS.md`).

### Phase 0 — Prep

- [ ] Copy vault JSON fixtures into `test/fixtures/refactor1/`
- [ ] Read `obs-streak-tracker/docs/ARCHITECTURE.md` and `obs-tdee-tracker/docs/ARCHITECTURE.md`
- [ ] Skim plugin `styles.css` for both (visual reference)

### Phase 1 — TDEE + nav shell

- [ ] `App.tsx`: add Daily tab first, rename Dashboard → Work, default tab `daily`
- [ ] `src/lib/tdee/*` — port domain from JS to TS
- [ ] `src/lib/tdeeDb.ts` (or similar) + migration v5
- [ ] `src/components/DailyPage.tsx` + `src/components/daily/TdeeSection.tsx`
- [ ] Port chain UI + summary bars; wire day rollover
- [ ] Vitest: port tdee domain tests
- [ ] Optional: basic vault file import for TDEE

### Phase 2 — Streak domain + DB

- [ ] `src/lib/streak/*` — port all domain modules
- [ ] `src/lib/streakDb.ts` + migration (v5 or v6 if split)
- [ ] Import path for streak config + data JSON
- [ ] Vitest: port streak domain tests (merge, stats, catalog, pause, reset, heatmap helpers)

### Phase 3 — Streak UI on Daily tab

- [ ] `src/components/daily/StreakSection.tsx` (+ subcomponents for heatmap, activity row)
- [ ] In-app activity CRUD (modal or inline) — replaces config markdown editing
- [ ] Pause, reset, archive, confetti
- [ ] Port/adapt `obs-streak-tracker/styles.css` classes
- [ ] Drop wikilink code paths entirely

### Phase 4 — Integration + docs

- [ ] TDEE + streak both read `loadDayRolloverHour()` from `dayBoundaryPref.ts`
- [ ] Streak heatmap color in Settings (`streak_heatmap_color_v1`)
- [ ] One-time vault import script (`npm run import:vault`); `app_kv` done flags — no in-app import UI
- [ ] Merge shipped facts into `docs/ARCHITECTURE.md` (nav map, new tables, Daily tab product intent)
- [ ] Check off Phase items in `TODO.md`

---

## Definition of done (per `AGENTS.md`)

Each phase / feature:

1. Behavior matches plugin spec (minus dropped items).
2. **Vitest** covers new/changed logic — cite test files in commit/PR.
3. Update `docs/ARCHITECTURE.md` when product facts change (bulk update at end is OK if `REFACTOR1.md` stayed accurate during work).

---

## Explicit non-goals (v1)

- Obsidian plugin deprecation or vault file writing
- Nutrition history / past-day food log browsing
- Wikilinks / opening Obsidian notes
- iCloud / Obsidian Sync / multi-device LWW merge
- Replacing `docs/ARCHITECTURE.md` pre-workout sections (posture, Work tab timer) — those stay; **add** Daily tab + persistence sections

---

## Quick file map (target end state)

```
src/
  App.tsx                          # nav: daily, work, posture, …
  components/
    DailyPage.tsx
    daily/
      TdeeSection.tsx
      StreakSection.tsx
      StreakHeatmap.tsx
      StreakActivityRow.tsx
      ActivityEditorDialog.tsx     # in-app config
    Dashboard.tsx                  # Work tab (unchanged logic)
  lib/
    dayBoundary.ts                 # shared rollover (existing)
    dayBoundaryPref.ts             # (existing)
    tdee/
      dates.ts
      entries.ts
      totals.ts
      …
    tdeeDb.ts
    streak/
      stats.ts
      logs.ts
      activity-catalog.ts
      …
    streakDb.ts
    vaultImport.ts                 # optional shared import parser
test/fixtures/refactor1/
  tdee-config.json
  streak-config.json
  streak-data.json
src-tauri/src/main.rs              # SQL migrations v5+
```

---

## Status log

| Date | Agent | Note |
|------|-------|------|
| 2026-06-17 | Composer | Phase 4 shipped: shared rollover already wired; habits heatmap color in Settings; vault data imported once via `npm run import:vault` (TDEE 2500/80, 19 activities, 684 log cells); removed in-app import UI; ARCHITECTURE.md updated. 143 tests green. |
| 2026-06-17 | Composer | Phase 3 shipped: Streak UI on Daily tab; browser `npm run dev` guards. |
| 2026-06-17 | Composer | Phase 0 + Phase 1 shipped: Daily/Work nav, TDEE domain (`src/lib/tdee/`), migration v5, `TdeeSection`, 112 tests green. Import API ready; file-picker UI → Phase 4. Streak → Phase 2 next. |
| 2026-06-17 | Composer | Created `REFACTOR1.md`; planning complete, **no implementation started** yet (all TODO phases open). |

*Append a row when you finish a phase or make a major decision.*
