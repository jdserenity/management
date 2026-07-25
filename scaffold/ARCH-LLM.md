# Architecture (agent reference)

Personal focus + movement manager: Pomodoro/Deep Work timer, guided break exercises, daily habits (streaks), nutrition (TDEE), water, scheduled stretches, posture monitoring (desktop only). Multi-device sync via VPS HTTP server.

## Nav & tabs

Order (`desktop/ui/lib/navConfig.ts`): **Daily** → **Work** → **Posture** (desktop only) → **Stats** → **Customize** → **Settings**. Default tab: `daily`. Companion drops Posture; Settings → `CompanionSettingsPage`.

| Tab       | Component                                        | Role                                                                                                                                  |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Daily     | `DailyPage.tsx`                                  | Brand wordmark (`BrandWordmark`: "Management", Haglos OTF via `npm run font:haglos` → `desktop/ui/assets/fonts/`, white; OTF not in git), then stretches, streaks, TDEE, water, movement bursts |
| Work      | `Dashboard.tsx`                                  | Focus flow timer, today's work/movement totals, can't-exercise toggle                                                                 |
| Posture   | `PosturePage.tsx`                                | Live score, charts, camera (desktop/Tauri only)                                                                                       |
| Stats     | `StatsPage.tsx`                                  | All-time / monthly / weekly focus + movement aggregates                                                                               |
| Customize | `CustomizePage.tsx`                              | Subtabs: **Tasks** (habits/streaks), **Body** (bursts + exercises + stretches), **Energy** (TDEE targets) — that order                          |
| Settings  | `SettingsPage.tsx` / `CompanionSettingsPage.tsx` | General, alerts, posture, sync, theme, app presence                                                                                   |

Header **Start flow** (`FlowHeaderControl.tsx` in `AppShell.tsx`): idle → start pomodoro chain; active → show phase label, click → Work tab.

## Session rules

Durations (`@mgmt/core` `SESSION_DURATIONS_MINUTES`, re-exported from `workoutPlanner.ts`): pomodoro 25m, deep 90m, break 5m, long break 15m (5m exercise + 10m relax).

- Pomodoro break: 5m; guided exercise every 2 completed pomodoros in chain (`pomodoro_break_chain_v1` in `app_kv`; survives End Flow within stats day).
- Deep work long break: always 5m exercise + 10m relax.
- **Can't exercise** (`cant_exercise_mode_v1`): swaps exercise breaks for very-light breaks (water/bathroom/phone only).
- Focus ↔ type switch: remaining = target − elapsed; deep→pomo with >25m elapsed starts full 25m pomodoro. Partial credit if prior focus ≥15s.
- Lid close (macOS): pauses flow timer (`flow-lid-pause`/`flow-lid-resume`); companion unaffected.
- Stats session counts: `completion_ratio` ≥ 0.75; focus minutes credit proportionally.
- Day boundary: `stats_day_rollover_hour_v1` (default 4 AM local) — work stats, nutrition, water, streaks.
- Workout logged when break timer finishes (≥15s) or Complete Workout tapped (≥15s); stopping flow mid-break does not log.
- Morning stretch: built-in id `morning-stretch`; hides after completion or hide-after hour (default 11 AM); logs to `workout_log`.
- Stretch creator routine refs (`MorningStretchRef`) may carry optional `amount` (hold seconds) for that routine only; does not change global stretch pool / `stretchHoldSeconds`.
- Movement bursts (UI name; internal ids still `movement-snack*`): Customize lives under Body tab (top); completed chips show `Hard/Easy ·` nearest half-hour (`formatNearestHalfHourLabel`). `movement_snack_prefs_v1` stores daily goal, hard/easy burst lists, and `quickLogExercises` (Individual tap increments on Daily + panel; edit only in Customize → Body); syncs via `SHARED_APP_KV_KEYS`.
- Streak fire emoji only when current streak ≥ 5 days (`currentStreakFireEmojiClass`); under 5 shows the number only.
- Water: exact goal (0 ml remaining) uses success style `water-remaining-done` (green).
- TDEE food editor (+ menu) lists staples with portion controls; logging a staple (chip or editor) uses `kind: staple` + `refId` so the day's staple chip is replaced.
- Streak activity titles are always clickable: with description toggles it; without description, expands a truncated name.
- Streak activities: order by `sort_order` (add order + grip pointer-drag reorder in Customize → Tasks; Daily uses same order). DnD keeps DOM order fixed during drag (ghost + insert line); hit-tests midpoints via `findInsertIndex` / `moveIdToInsertIndex` in `lib/streak/reorder.ts` — do not live-reorder against frozen boxes (that glitches). Flags: `necessary` (incomplete → daily heatmap red × via `isDayNecessaryFailed`; gold check when done), `linked_staple_id` / `linked_water` / `linked_movement_burst` — lockstep partners (check/uncheck either side). Schema v12–v13.

Engine: `SessionContext.tsx` (single `PersistedFlowState` + effects) + `@mgmt/core` (`flowEngine.ts`, `flowState.ts`, `sessionProgress.ts`, `breakFlow.ts`, `exerciseMode.ts`). Workout modules: `workoutTypes.ts`, `workoutCatalogs.ts`, `sessionStats.ts`, barrel `workoutPlanner.ts` (break picking + stretch helpers).

**UI look:** Obsidian-plugin Daily language is app-wide — `desktop/ui/plugin-ui.css` + tokens in `App.css`. Shell/Work/Stats/Settings/Customize/Posture use plugin panels/chips/nav (not gradient shadcn chrome).

## Repo layout

| Path                 | Package / role                                                      |
| -------------------- | ------------------------------------------------------------------- |
| `desktop/ui/`        | React UI (`@/` alias), session engine, libs                         |
| `desktop/src-tauri/` | Tauri shell: tray, camera loop, SQL migrations, posture bridge      |
| `shared/core/`       | `@mgmt/core` — session types, timer math, flow state                |
| `shared/storage/`    | `@mgmt/storage` — shared SQLite schema migrations                   |
| `shared/sync/`       | `@mgmt/sync` — sync client, merge, outbox, polling (not the server) |
| `backend/`           | `@mgmt/server` — Hono HTTP sync API                                 |
| `mobile/`            | `@mgmt/companion` — Vite PWA; reuses `desktop/ui/` via aliases      |

Root `package.json` workspaces: `shared/*`, `backend`, `mobile`. Desktop Vite root: `desktop/ui/`; build outDir: repo `dist/` (Tauri `frontendDist`).

Boot: `DesktopBoot.tsx` / `CompanionBoot.tsx` → `SyncBootScreen` until SQLite + initial sync; then `App.tsx` / `MobileAppShell`.

## Persistence

**Desktop** `sqlite:local.db` (`desktop/ui/lib/db.ts`; Tauri plugin preload). Bundle id `com.diamari.management`. macOS path: `~/Library/Application Support/com.diamari.management/local.db`. Legacy `mgmt.db` renamed on first boot (`main.rs`).

**Server** `server.db` (`backend/data/server.db` or `DB_PATH`). Mirrors synced tables + `users`, `active_flow_singleton`. `OWNER_USER_ID` env (default `owner`).

### Tables (local.db)

| Table             | Purpose                                           | Sync                   |
| ----------------- | ------------------------------------------------- | ---------------------- |
| `posture_log`     | Posture samples                                   | desktop_only           |
| `focus_log`       | Completed focus sessions                          | shared, append_only    |
| `workout_log`     | Break workouts, stretches, manual increments      | shared, append_only    |
| `app_kv`          | Key-value prefs + active flow state               | per-key (see registry) |
| `nutrition_*`     | TDEE config, staples, regulars, today entries     | shared                 |
| `water_*`         | Water target + today entries                      | shared                 |
| `streak_*`        | Activities, log cells, pause/reset meta           | shared                 |
| `sync_tombstones` | Hard-delete markers (entity, row_key, deleted_at) | shared                 |
| `sync_outbox`     | Pending row patches                               | local only             |

Sync classification: `shared/sync/src/syncRegistry.ts` (`SYNC_TABLE_REGISTRY`, `SHARED_APP_KV_KEYS`, `DESKTOP_ONLY_APP_KV_KEYS`).

Not synced: `posture_log`, desktop-only `app_kv` keys (presence, tray, active flow, vault import flags), `localStorage` camera/detection (`mgmtLocalStorage.ts`), Tauri `.settings.dat` calibration.

## Sync

**Creds:** `VITE_SERVER_URL` + `VITE_SERVER_TOKEN` baked at build time (`@mgmt/sync` `getBuildTimeSyncCreds`). Local dev: root `.env`. Companion prod: Cloudflare Pages env vars.

**Flow:** `runBidirectionalInitialSync` on boot (empty local → full `GET /v1/data`; else registry merge). Foreground poll `GET /v1/data` every 5s (`startUserDataPolling`). Local writes enqueue `sync_outbox` → `POST /v1/data/patch`. Full `POST /v1/data` bootstrap-only; empty snapshot rejected (409).

**Merge:** `mergeUserData.ts` — registry-driven LWW on `updated_at`; `focus_log`/`workout_log` append-only (`ON CONFLICT DO NOTHING`). Server patch apply uses timestamp guards. **Streak archive is sticky** (`archived_at` kept via COALESCE on server + merge) so a later active-only upsert (reorder/edit race) cannot un-archive. **Hard deletes** write `sync_tombstones` rows (entity + row_key + deleted_at); pull-merge drops local ghost rows covered by a newer tombstone. Composite `row_key` parts join with U+001F (`TOMBSTONE_KEY_SEP` in `userData.ts`) — never `\0` (sql.js truncates at NUL → UNIQUE crash on companion).

**Debounced push vs hydrate:** `wrapWithDataSync` must not diff a pre-write snapshot against a mid-`hydrateDb` table (wipe-then-refill). Debounce waits while `runWithoutDataSync` is active and discards the before-snapshot if a hydrate generation bumped — otherwise torn extracts mint bulk false `streakLogCells` deletes + tombstones (2026-07-25 wipe). **Write lock** (`withDataSyncWriteLock`) serializes user mutations vs hydrate; hydrate uses the raw DB + BEGIN/COMMIT. **Bulk streakLogCells deletes** spanning many habits+days are refused client-side (`sanitizeDangerousBulkDeletes`) and ignored server-side. **Versioned deletes** on the server only remove a row when `updated_at <=` the matching tombstone `deleted_at`. `saveLogs` is upsert-only (no delete-missing).

**Table SQL truth:** `shared/sync/src/userDataSchema.ts` — column lists, bind order, client select/insert, server select/insert/patch/delete. `backend/src/dataStore.ts` and client `extractUserData`/`hydrateDb` loop the schema (no per-table SQL copies).

**Leader:** Companion auto-claims during exercise breaks; desktop viewer mode (`sessionSync.ts` `isSyncViewer`).

**Active session:** `active_flow_singleton` on server — live `ActiveFlowDocument` (phase, break workout, leader). Not in user-data snapshot.

**Status UI:** `SyncStatusCard` in Settings; `DATA_SYNC_REFRESH_EVENT` reloads Daily/Customize after pull.

## Backend (`@mgmt/server`)

Hono on default port 8787. Auth: `Authorization: Bearer $SERVER_TOKEN`.

| Endpoint              | Use                              |
| --------------------- | -------------------------------- |
| `GET /health`         | No auth                          |
| `GET /v1/data`        | Full user snapshot               |
| `POST /v1/data`       | Bootstrap replace (empty device) |
| `POST /v1/data/patch` | Row-level upsert/delete          |

Env: `SERVER_TOKEN`, `PORT`, `DB_PATH`, `OWNER_USER_ID`, optional `BACKUP_DIR`. Prod: systemd (`backend/mgmt-server.service.example`, `server.env.example`). **Daily backups** run in-process inside `mgmt-server` (`backend/src/dbBackup.ts`): snapshot `$DB_PATH` at 03:00 local + boot catch-up if none today; default dir `<DB_PATH dirname>/backups`; keep 14 days.

## Posture (desktop)

MediaPipe Tasks in webview (`@mediapipe/tasks-vision`); Rust captures camera frames, receives `submit_posture_analysis` from `PosturePipeline.tsx`. Scoring adapted from BatesPosture. Monitoring toggle: `posture_monitoring_enabled_v1` + tray.

## Tauri boundary

Commands (registered `main.rs`): boot settings (`set_app_presence_mode`, `set_hide_to_menu_bar_on_close`, camera/detection), session alerts (`focus_main_window`, tray labels, `notify_session_phase`), posture (`submit_posture_analysis`, `initialize_pose_model`, calibration), `restart_app`.

Events to webview: `camera-preview-frame`, `analysis-update`, `monitoring-state-changed`, `tray-start-focus-flow`, `flow-lid-pause`/`flow-lid-resume`, `camera-yield-changed`.

App presence: `dock` (Regular) vs `menu_bar` (Accessory). Tray is installed **once** at boot and never torn down until tray **Quit Management**. Window close / Cmd+Q only hide the main window (no tray rebuild, no activation-policy flip in dock mode). Tray icons solid white; not template mode. Flow menu updates use `set_menu` in place.

## Deploy (facts)

| Client         | Creds location                    | Deploy                                                                                                  |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Desktop        | root `.env`                       | `npm run tauri build` → `npm run app:deploy` → `/Applications/Management.app`                           |
| Companion prod | Cloudflare Pages env / GH secrets | Deploy **only** on `main` (`.github/workflows/deploy-companion.yml`); never on PR. Output `mobile/dist` |
| Server         | `/etc/mgmt/server.env`            | `npm run start:prod -w @mgmt/server` via systemd                                                        |

`npm run db:backup` → `~/Library/Application Support/com.diamari.management/backups/`. App version: root `package.json` → `VITE_APP_VERSION`.

## Key files

| Concern              | Path                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav                  | `desktop/ui/lib/navConfig.ts`                                                                                                                  |
| Session state        | `desktop/ui/context/SessionContext.tsx` (holds one `PersistedFlowState`); pure transitions in `@mgmt/core` `flowEngine.ts` / `exerciseMode.ts` |
| Feature DBs          | `sessionDb.ts`, `streakDb.ts`, `tdeeDb.ts`, `waterDb.ts`, `stretchCreator/`                                                                    |
| Workout modules      | `workoutTypes.ts`, `workoutCatalogs.ts`, `sessionStats.ts`, barrel `workoutPlanner.ts`                                                         |
| Plugin UI            | `desktop/ui/plugin-ui.css`, tokens in `App.css`                                                                                                |
| app_kv prefs         | `desktop/ui/lib/appKv.ts` (get/set + bool/json/int factories); thin `*Pref.ts` wrappers                                                        |
| Sync wiring          | `dataSync.ts`, `dataSyncBootstrap.ts`, `shared/sync/src/`                                                                                      |
| UserData SQL schema  | `shared/sync/src/userDataSchema.ts`                                                                                                            |
| Migrations (desktop) | `desktop/src-tauri/src/main.rs`                                                                                                                |
| Shared schema        | `shared/storage/src/migrations.ts`                                                                                                             |
