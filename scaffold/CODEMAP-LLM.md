# Architecture (agent reference)

Personal focus + movement manager: Pomodoro/Deep Work timer, guided break exercises, daily habits (streaks), nutrition (TDEE), water, scheduled stretches, posture monitoring (desktop only). Multi-device sync via VPS HTTP server.

## Nav & tabs

Live order (`desktop/ui/lib/navConfig.ts`): **Daily** → **Stats** → **Customize** → **Settings**. Default tab: `daily`. Companion Settings → `CompanionSettingsPage`.

Work and Posture are **parked** (code kept, not mounted): `FEATURE_WORK` / `FEATURE_POSTURE` in `desktop/ui/lib/features.ts` (both `false`). Flip to `true` and rebuild to restore the tab, exclusive settings, header **Start flow**, session alerts, timer resume, posture pipeline/camera boot, and matching tray items. `SessionProvider` stays mounted (Daily / Customize / Stats use it for stretches, movement, logs).

| Tab       | Component                                        | Role                                                                                                                                  |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Daily     | `DailyPage.tsx`                                  | Brand wordmark (`BrandWordmark`: "Management", Haglos OTF via `npm run font:haglos` → `desktop/ui/assets/fonts/`, white; OTF not in git — worktrees start without it and fall back to `cursive`). `tauri build` runs `font:haglos` first. Then stretches, streak calendar, the Food/Water/Build swipe carousel (`TrackerCarousel`, between calendar and tasks), and streak tasks. Third slide is notes-style Build-only (`MovementSnackSection`: `BUILD 1/2 — name — reps / reps / reps — progression`; unilateral exercises use Right/Left rows); Move snacks stay off Daily for now |
| Work      | `Dashboard.tsx`                                  | Parked. Focus flow timer, today's work/movement totals, can't-exercise toggle                                                         |
| Posture   | `PosturePage.tsx`                                | Parked. Live score, charts, camera (desktop/Tauri only)                                                                               |
| Stats     | `StatsPage.tsx`                                  | All-time / monthly / weekly focus + movement aggregates                                                                               |
| Customize | `CustomizePage.tsx`                              | Subtabs: **Tasks** (habits/streaks), **Body** (Day 1/Day 2 Build regimen + Stretch Creator + Mobility/Build pools), **Energy** (TDEE targets) — that order                          |
| Settings  | `SettingsPage.tsx` / `CompanionSettingsPage.tsx` | Live: General + About. **Focus & alerts** and **Posture** return with the matching feature switch. Sync, theme, app presence stay on General |

Header **Start flow** (`FlowHeaderControl.tsx`) is hidden while `FEATURE_WORK` is false.

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
- Movement snacks: `movement_snack_prefs_v1.regimen` still stores a full weekly schedule (including legacy Move slots), but the product surface is Build-only. Daily’s TrackerCarousel third slide shows the two Build snacks (Mon–Sat; Sunday empty); Move is hidden on Daily. Tracker-linked Workout streak habits count Build only (`buildSnackProgress`). Customize → Body regimen UI is **Day 1** (Mon/Wed/Fri: Push/Abs) and **Day 2** (Tue/Thu/Sat: Pull/Legs) via `updateBuildSlotOnTemplateDay` — not seven weekday editors; Move rows are not shown. Exercise pools UI is Mobility + Build only (Move pool data kept, no Customize editor). The Mobility pool filters Stretch Creator choices. Build tasks have three sets; each set stores the actual amount entered. Unilateral Build exercises (`exercise.unilateral`, Single-leg sit-to-stand) log each set twice with `movementSnack.side` `right`/`left` (six logs to complete). Build/Move set `movementSnack` metadata is stored inside `workout_log.exercises_json` as `{ exercises, movementSnack }` (`serializeWorkoutLogExercisesJson` / `parseWorkoutLogExercisesJson`); legacy bare exercise arrays still load. Build exercises carry an editable `currentProgression` label and a reps-only `repRange` target with distinct endpoints; changing either updates every weekly occurrence of that Build exercise. The Build pool is Push-ups (8–20 reps), Chin-ups (id `pullups`, 3–8 reps), Reverse crunches (10–20 reps), and Single-leg sit-to-stand (6–15 reps, unilateral), all at three sets; legacy Build exercises are replaced on load. The old hard/easy fields remain only for legacy log/config compatibility.
- Streak fire emoji only when current streak ≥ 5 days (`currentStreakFireEmojiClass`); under 5 shows the number only.
- Calendar day-completeness (`getDayCompletionCounts` / `isDayComplete` in `lib/streak/heatmap.ts`): every active habit counts on days it has started (`activityStartDates` / `isActivityActiveOnDay`), including tracker-linked water/food/workout. Tracker-linked start dates earlier than `TRACKER_LINKED_START_FLOOR` (`2026-10-20`) are clamped up on load — those habits were not usable on devices before then, so demanding them for older days falsely wiped calendar X's.
- Water: exact goal (0 ml remaining) uses success style `water-remaining-done` (green).
- Daily Food has no + menu: an always-visible custom row (name/calories/protein/×qty/Eat, plus a × button whenever the row holds anything) sits above a name-search over regulars; regulars render only after a search is typed, tapping a regular fills the custom row, and Eat logs a `custom` entry. A fruitless regulars search offers to add the searched name as a new regular using the custom row's calories/protein. Daily Water has quick amounts plus a custom ml row with a × clear button. The companion PWA forbids zooming (viewport `maximum-scale=1, user-scalable=no` + `touch-action: pan-x pan-y` in `mobile/`). Staples have no UI on Daily or in Customize → Food (stored `nutrition_staples` data and old `kind: staple` entries are kept untouched).
- Streak activity titles are always clickable: with description toggles it; without description, expands a truncated name.
- Streak activities: order by `sort_order` (add order + grip pointer-drag reorder in Customize → Tasks; Daily uses same order). DnD keeps DOM order fixed during drag (ghost + insert line); hit-tests midpoints via `findInsertIndex` / `moveIdToInsertIndex` in `lib/streak/reorder.ts` — do not live-reorder against frozen boxes (that glitches). Optional tracker-linked Water, Workout, and Food activities can be enabled, edited, and reordered with normal tasks; they render with a disabled gray checkmark and are completed only when their tracker reaches its configured threshold. The old networked/cross-link activity configuration is removed.

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
| `sync_state`      | Change-log cursor (`user_data_seq`)               | local only             |

Sync classification: `shared/sync/src/syncRegistry.ts` (`SYNC_TABLE_REGISTRY`, `SHARED_APP_KV_KEYS`, `DESKTOP_ONLY_APP_KV_KEYS`).

Not synced: `posture_log`, desktop-only `app_kv` keys (presence, tray, active flow, vault import flags), `localStorage` camera/detection (`mgmtLocalStorage.ts`), Tauri `.settings.dat` calibration, `window-size.json` (last desktop window size).

Desktop window default is 800×800 (width = Daily-tab `minWidth`; height unchanged). After first launch, resize is saved to `window-size.json` in the app support dir and restored on the next open so the window does not jump back to the default.

## Sync

**Creds:** `VITE_SERVER_URL` + `VITE_SERVER_TOKEN` baked at build time (`@mgmt/sync` `getBuildTimeSyncCreds`). Local dev: root `.env`. Companion prod: Cloudflare Pages env vars.

**Flow (server-referee change log):** The server is the only referee. Every accepted `POST /v1/data/patch` records the FINAL row it holds in `sync_changes` under a server-issued `seq` (`backend/src/dataStore.ts`); a stale patch that loses still records the server's final row so the loser is corrected. Devices keep a cursor in local `sync_state` (migration v17, key `user_data_seq`) and pull `GET /v1/changes?since=<cursor>` (poll every 5s via `startUserDataPolling`), applying changes verbatim (`changeSync.ts` `applySyncChanges`) in chunks of 200 — one transaction per chunk, cursor committed after each chunk, write lock released between chunks, consecutive same-table upserts coalesced into one multi-row statement; a failing chunk retries one-by-one to isolate a poison row, which stops the cursor just before it and surfaces via `markSyncPullResult(false, …)` (a pull is only marked successful AFTER apply, never at fetch) — no device-side merge, clock comparison, or wipe-and-refill on pull. The server skips minting a `sync_changes` entry when an accepted patch leaves a row byte-identical to its pre-patch state (refused writes still broadcast the final row for correction) — bulk re-uploads no longer create 1,000s of phantom changes (2026-10-22 wedge: 1,498-change single-transaction apply + infinite `waitWhileDataSyncSuppressed` poll, now bounded at 10s with a loud log). Full `GET /v1/data` (returns `{data, seq}`) + `hydrateDb` happen only at bootstrap: no cursor, a `snapshot` change marker, a cursor ahead of a reset server, or `snapshotRequired`. Bootstrap uploads local rows as an **upserts-only** diff patch (`pushUserDataDiff(..., { upsertsOnly: true })` — no deletes, no minted tombstones, since a stale device's missing rows are other devices' data, not deletions; 2026-10-20 wipe), then adopts the server's final snapshot + seq. Local writes enqueue `sync_outbox` → `POST /v1/data/patch` (response carries `seq`). Full `POST /v1/data` bootstrap-only; empty snapshot rejected (409); it also restarts the change log with a `snapshot` marker.

**Conflict rules (server-only):** patch apply uses `updated_at` timestamp guards; `focus_log`/`workout_log` append-only (`ON CONFLICT DO NOTHING`). **Streak archive is sticky** (`archived_at` kept via COALESCE on server patch apply) so a later active-only upsert (reorder/edit race) cannot un-archive, and the change log carries that final archived row. **Hard deletes** write `sync_tombstones` rows (entity + row_key + deleted_at); server versioned deletes only remove a row when `updated_at <=` the matching tombstone `deleted_at`, then a `delete` change drops the row on other devices. Composite `row_key` parts join with U+001F (`TOMBSTONE_KEY_SEP` in `userData.ts`) — never `\0` (sql.js truncates at NUL → UNIQUE crash on companion). Client-side snapshot merging (`mergeUserData.ts`) is deleted; two-device convergence is covered by `backend/src/syncConvergence.test.ts`.

**Debounced push vs hydrate:** `wrapWithDataSync` must not diff a pre-write snapshot against a mid-`hydrateDb` table (wipe-then-refill, bootstrap only now). Debounce waits while `runWithoutDataSync` is active and discards the before-snapshot if a hydrate generation bumped — otherwise torn extracts mint bulk false `streakLogCells` deletes + tombstones (2026-07-25 wipe). **Write lock** (`withDataSyncWriteLock`) serializes user mutations vs hydrate/change-apply; both use the raw DB + BEGIN/COMMIT. **Bulk streakLogCells deletes** spanning many habits+days are refused client-side (`sanitizeDangerousBulkDeletes`) and ignored server-side. `saveLogs` is upsert-only (no delete-missing). Habit check-offs are optimistic in `StreakSection` (`applyStreakLogLocally` preview, rollback + visible error on save failure).

**Table SQL truth:** `shared/sync/src/userDataSchema.ts` — column lists, bind order, client select/insert, server select/insert/patch/delete. `backend/src/dataStore.ts` and client `extractUserData`/`hydrateDb` loop the schema (no per-table SQL copies).

**Leader:** Companion auto-claims during exercise breaks; desktop viewer mode (`sessionSync.ts` `isSyncViewer`).

**Active session:** `active_flow_singleton` on server — live `ActiveFlowDocument` (phase, break workout, leader). Not in user-data snapshot.

**Status UI:** `SyncStatusCard` in Settings; `DATA_SYNC_REFRESH_EVENT` reloads Daily/Customize after pull.

## Backend (`@mgmt/server`)

Hono on default port 8787. Auth: `Authorization: Bearer $SERVER_TOKEN`.

| Endpoint              | Use                                            |
| --------------------- | ---------------------------------------------- |
| `GET /health`         | No auth                                        |
| `GET /v1/data`        | Full user snapshot + current seq (bootstrap)   |
| `GET /v1/changes`     | Numbered server changes after `?since=` cursor |
| `POST /v1/data`       | Bootstrap replace (empty device)               |
| `POST /v1/data/patch` | Row-level upsert/delete (returns new seq)      |

Env: `SERVER_TOKEN`, `PORT`, `DB_PATH`, `OWNER_USER_ID`, optional `BACKUP_DIR`, optional R2 offsite (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, optional `R2_PREFIX`). Prod: systemd (`backend/mgmt-server.service.example`, `server.env.example`). **Daily backups** run in-process inside `mgmt-server` (`backend/src/dbBackup.ts` + `r2Offsite.ts`): snapshot `$DB_PATH` at 03:00 local + boot catch-up if none today; default dir `<DB_PATH dirname>/backups`; keep 14 days; if R2 env is set, upload the snapshot to the bucket and prune there to the same retention. Local backup still succeeds if R2 upload fails.

## Posture (desktop)

Parked while `FEATURE_POSTURE` is false: `PosturePipeline` / `PostureSessionProvider` are not mounted; boot does not call `start_monitoring` or camera/detection invokes. Code remains. MediaPipe Tasks in webview (`@mediapipe/tasks-vision`); Rust captures camera frames, receives `submit_posture_analysis` from `PosturePipeline.tsx`. Scoring adapted from BatesPosture. Monitoring toggle: `posture_monitoring_enabled_v1` + tray (tray items omitted while parked).

## Tauri boundary

Commands (registered `main.rs`): boot settings (`set_app_presence_mode`, `set_hide_to_menu_bar_on_close`, `set_ui_features`, camera/detection), session alerts (`focus_main_window`, tray labels, `notify_session_phase`), posture (`submit_posture_analysis`, `initialize_pose_model`, calibration), `restart_app`.

Events to webview: `camera-preview-frame`, `analysis-update`, `monitoring-state-changed`, `tray-start-focus-flow`, `flow-lid-pause`/`flow-lid-resume`, `camera-yield-changed`.

App presence: `dock` (Regular) vs `menu_bar` (Accessory). Tray is installed **once** at boot and never torn down until tray **Quit Management**. Window close / Cmd+Q only hide the main window (no tray rebuild, no activation-policy flip in dock mode). Tray icons solid white; not template mode. Flow menu updates use `set_menu` in place. While Work/Posture are parked, tray is **Show App** + **Quit Management** only (`set_ui_features` from JS).

## Deploy (facts)

| Client         | Creds location                    | Deploy                                                                                                  |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Desktop        | root `.env`                       | `npm run tauri build` → `npm run app:deploy` → `/Applications/Management.app`                           |
| Companion prod | Cloudflare Pages env / GH secrets | Cloudflare Pages Git connection builds + deploys on push to `main` (no GitHub deploy workflow — the redundant one was removed 2026-10-20). Output `mobile/dist` |
| Server         | `/etc/mgmt/server.env`            | `npm run start:prod -w @mgmt/server` via systemd                                                        |

`npm run db:backup` → `~/Library/Application Support/com.diamari.management/backups/`. App version: root `package.json` → `VITE_APP_VERSION`.

## Key files

| Concern              | Path                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav                  | `desktop/ui/lib/navConfig.ts`                                                                                                                  |
| Feature switches     | `desktop/ui/lib/features.ts` (`FEATURE_WORK`, `FEATURE_POSTURE`)                                                                               |
| Session state        | `desktop/ui/context/SessionContext.tsx` (holds one `PersistedFlowState`); pure transitions in `@mgmt/core` `flowEngine.ts` / `exerciseMode.ts` |
| Feature DBs          | `sessionDb.ts`, `streakDb.ts`, `tdeeDb.ts`, `waterDb.ts`, `stretchCreator/`                                                                    |
| Workout modules      | `workoutTypes.ts`, `workoutCatalogs.ts`, `sessionStats.ts`, barrel `workoutPlanner.ts`                                                         |
| Plugin UI            | `desktop/ui/plugin-ui.css`, tokens in `App.css`                                                                                                |
| app_kv prefs         | `desktop/ui/lib/appKv.ts` (get/set + bool/json/int factories); thin `*Pref.ts` wrappers                                                        |
| Sync wiring          | `dataSync.ts`, `dataSyncBootstrap.ts`, `shared/sync/src/`                                                                                      |
| UserData SQL schema  | `shared/sync/src/userDataSchema.ts`                                                                                                            |
| Migrations (desktop) | `desktop/src-tauri/src/main.rs`                                                                                                                |
| Window size          | `desktop/src-tauri/src/window_geometry.rs` + `tauri.conf.json` (`minWidth` 800)                                                                |
| Shared schema        | `shared/storage/src/migrations.ts`                                                                                                             |
