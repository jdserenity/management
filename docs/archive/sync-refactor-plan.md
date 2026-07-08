# Sync refactor plan (read this for sync work)

Branch: `refactor/sync`. Goal: **any shared change syncs reliably** — not only check-offs and log rows.

## Problem (one paragraph)

Upload is partly row-level (`POST /v1/data/patch`), but **local saves** still wipe-and-rewrite whole tables (`streakDb`, `tdeeDb`), **pull** still uses full snapshots + `mergeUserData` with wrong rules (habit config decided by check-off times), and **push** still falls back to full DB when SQL is “unknown.” Archive/rename/config edits fail because of layers 1 and 3, not because patches are missing.

## Three layers (target state)

| Layer | Today | Target |
| --- | --- | --- |
| **Save** | `DELETE` table → re-`INSERT` all rows | Upsert/delete only changed rows; set `updated_at` on every change |
| **Send** | SQL string guessing + patch; snapshot fallback | `sync_outbox` (or explicit `markSyncChange`) → row patches only |
| **Receive** | `GET /v1/data` + ad-hoc merge | Registry-driven merge: row id + `updated_at`, newer wins |

## Folder map (post layout change)

| Area | Path |
| --- | --- |
| Sync client lib | `shared/sync/src/` |
| Merge (buggy) | `shared/sync/src/mergeUserData.ts` |
| Push/pull/boot | `shared/sync/src/userData.ts`, `initialSync.ts` |
| SQL hook (replace) | `wrapWithDataSync` in `userData.ts` |
| Server | `backend/src/app.ts`, `dataStore.ts` |
| Desktop wiring | `desktop/ui/lib/db.ts`, `dataSync.ts`, `dataSyncBootstrap.ts` |
| Mobile wiring | `mobile/src/platform/storage.ts` |
| Feature DBs (rewrite saves) | `desktop/ui/lib/streakDb.ts`, `tdeeDb.ts`, `waterDb.ts`, `stretchCreator/stretchCreatorDb.ts` |
| Migrations (desktop) | `desktop/src-tauri/src/main.rs` |
| Shared schema | `shared/storage/src/migrations.ts` |

Layout overview: `docs/KNOWLEDGE.md` § Repository folder layout.

## Desktop-only (never sync)

- `posture_log`
- `localStorage` camera/detection keys (`mgmtLocalStorage.ts`)
- Tauri `.settings.dat` posture calibration
- Decide per `app_kv` key: shared vs desktop-only (document in registry)

## Steps 1–7

### Step 1 — Sync registry + boundaries

- [x] Add `shared/sync/src/syncRegistry.ts`: table, row key, `updated_at` column, sync yes/no
- [x] List desktop-only tables/keys explicitly
- [x] Export from `shared/sync/src/index.ts`
- **Done when:** one file answers “does X sync?” for every table/key
- **Tests:** `syncRegistry.test.ts` (every production table classified)

### Step 2 — Schema: `updated_at` everywhere syncable

- [x] Migration desktop (`main.rs`) + `shared/storage` + server (`backend/src/db.ts`)
- [x] Backfill existing rows (e.g. `datetime('now')` or `archived_at` where sensible)
- [x] Tables missing it today: `streak_activities`, `streak_activity_meta`, `nutrition_staples`, `nutrition_regulars`, …
- **Done when:** registry columns exist on disk on all three DBs
- **Tests:** migration tests in `shared/storage`

### Step 3 — Row-level saves (feature DBs)

- [x] **`streakDb.ts` first** (archive case): stop `DELETE FROM streak_activities`; upsert one row + `updated_at`
- [x] Same for `streak_log_cells`, `streak_activity_meta` saves
- [x] Then `tdeeDb.ts`, `waterDb.ts`, `stretchCreatorDb.ts`
- **Done when:** archiving one habit touches one row in SQLite
- **Tests:** `streakDb` integration-style tests; archive round-trip

### Step 4 — One merge rule

- [x] Rewrite `mergeUserData.ts` to use registry only (`mergeByKey` + row `updated_at`)
- [x] **Delete** `mergeStreakActivities`, `mergeStreakActivityMeta`, `mergeConfigRows` proxy logic
- **Done when:** merge tests prove archive on server wins over local stale copy
- **Tests:** `mergeUserData.test.ts` — archive, staple edit, simultaneous edit

### Step 5 — Outbox; remove SQL guessing

- [x] `sync_outbox` table (entity, row key, op, payload/json, `updated_at`)
- [x] Writers enqueue; `SyncWorker` drains → `pushUserDataPatch`
- [x] Remove or narrow `wrapWithDataSync` SQL inference; no routine full-snapshot push
- **Done when:** every syncable save enqueues without parsing SQL
- **Tests:** outbox drain, offline retry

### Step 6 — Slim HTTP API

- [x] Normal path: patches / future `GET /v1/changes?since=`
- [x] `POST /v1/data` full replace: **bootstrap only** (empty device / first install)
- [x] Server apply: consistent LWW on `updated_at` per registry
- **Done when:** no production code path calls full replace after boot
- **Tests:** `backend/src/dataStore.test.ts`, `app.test.ts`

### Step 7 — Behavior test matrix

- [x] One test per user action (archive, rename habit, pause, staple edit, stretch edit, water, food, check-off, offline→online, conflict newer-wins)
- **Command:** `npm test -- shared/sync backend/src desktop/ui/lib/streakDb.test.ts` (expand as files land)

## Already shipped (do not re-do)

- Row patch upload `POST /v1/data/patch` (`userData.ts`, `dataStore.putDataPatch`)
- Server timestamp guards on some tables (`app_kv`, log cells, entries)
- `SyncStatusCard` in Settings (desktop + mobile)
- `syncStatus.ts` for last push/pull/error

## Suggested commit order

1. Registry (step 1)  
2. Migrations (step 2)  
3. `streakDb` saves (step 3a)  
4. Merge fix (step 4)  
5. Outbox (step 5)  
6. Other DB saves (step 3b)  
7. API slim + test matrix (steps 6–7)

## Agent bootstrap

1. Read this file + `docs/KNOWLEDGE.md` (layout).  
2. Skim `docs/ARCHITECTURE.md` § Mobile companion + Data Persistence only if needed.  
3. Do **not** grep the whole repo — use paths above.
