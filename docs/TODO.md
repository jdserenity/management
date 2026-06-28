# TODO

- [ ] Companion: start standalone exercise break without desktop.
- [ ] VPS HTTPS reverse proxy for `apps/server` (Caddy/nginx → `127.0.0.1:8787`; firewall 443 only).
- [x] Document VPS systemd deploy for `apps/server` (`DB_PATH`, `SERVER_TOKEN`, `mgmt-server.service.example`, `docs/DEPLOY.md`). (Composer, 2026-06-27)
- [x] Desktop write-sync: after every local.db write, push the changed row(s) to server via HTTP so new data appears on the companion immediately (replaces manual `npm run sync:to-server`). Implemented via `wrapWithDataSync` in `@mgmt/sync`; debounced 2s push on every `db.execute` in both desktop (`src/lib/db.ts`) and companion (`apps/companion/src/platform/storage.ts`). (Sonnet 4.6, 2026-06-25)
- [x] Stats sync to server (`focus_log`, `workout_log`) so both devices share history. Covered by the same full-snapshot push in `extractUserData` / `pushUserData`. (Sonnet 4.6, 2026-06-25)
- [x] Companion startup data hydration: on boot, fetches `GET /v1/data` and merges it into the local sql.js db via `hydrateDb` before rendering. (Sonnet 4.6, 2026-06-25)
- [x] Companion-led exercise breaks: phone claims leadership during break, desktop viewer mode, Complete Workout on companion (Composer, 2026-06-18).
- [x] Verify end-to-end sync locally (sync-api + `.env` + desktop session visible on companion) (Composer, 2026-06-18).

## Complete port (Streak Tracker + TDEE Tracker → Management)

Source repos (sibling clones): `../obs-streak-tracker`, `../obs-tdee-tracker`. Obsidian plugins in the vault stay untouched. **Full handoff spec (archived):** `docs/archive/REFACTOR1.md`.

**Confirmed for this refactor:** combined **Daily** tab first (nutrition + habits); current focus/timer flow becomes **Work** tab second; streak activity config edited in-app (no vault markdown); drop wikilinks; nutrition is today-only for now (no multi-day history); shared stats day rollover (`stats_day_rollover_hour_v1`).

- [x] **Phase 0 — Prep:** Export vault JSON fixtures for import tests; skim plugin `docs/ARCHITECTURE.md` in both repos for parity checklist. (Composer, 2026-06-17)
- [x] **Phase 1 — TDEE in Daily tab:** Nav — Daily first, rename Dashboard → Work; port `obs-tdee-tracker/src/domain/*` to `src/lib/tdee/` (TypeScript); SQLite for targets/staples/regulars/today’s entries; `DailyPage` nutrition section (summary bars + chain UI); `importTdeeVaultJson` in `tdeeDb.ts` (Settings file picker → Phase 4); unit tests in `src/lib/tdee/tdee.test.ts`. (Composer, 2026-06-17)
- [x] **Phase 2 — Streak domain + SQLite:** Port `obs-streak-tracker/src/domain/*` (+ `pause-sync`, `activity-reset`) to `src/lib/streak/` (TypeScript); SQLite migration v6 + `streakDb.ts`; `importStreakVault` / config / data; unit tests in `src/lib/streak/streak.test.ts` (25 tests). (Composer, 2026-06-17)
- [x] **Phase 3 — Streak UI (Daily tab):** Today's activities (success/fail, pause, reset, archive); yearly + weekly heatmaps; in-app activity add/edit/archive (replaces config markdown); confetti; port/adapt streak styles — no wikilinks; browser-only `npm run dev` shows friendly message (Tauri APIs need `npm run tauri dev`). (Composer, 2026-06-17)
- [x] **Phase 4 — Integration:** Wire shared day rollover to TDEE + streaks; streak heatmap color in Settings; one-time vault import via `npm run import:vault` (no in-app import UI); `docs/ARCHITECTURE.md` updated. (Composer, 2026-06-17)

- [x] Add posture analytics in the main UI (session averages, min/max, streaks, history charts) sourced from `posture_log`, on the Posture tab (`PosturePage`) (Composer, 2026-05-16).
- [x] Remove prior fork branding (bundle id, Cargo crate, locales, GitHub templates) (Composer, 2026-05-16).
- [x] Replace forked YOLO11 pose stack with BatesPosture-style MediaPipe scoring in the webview and Rust ingest bridge (Composer, 2026-05-16).
- [x] Implement Pomodoro + Deep Work timer flow with auto-scheduled follow-up session controls (Codex, 2026-05-14 19:54 UTC-3).
- [x] Implement predefined workout allowlist + break-time auto workout guidance and logging (Codex, 2026-05-14 19:54 UTC-3).
- [x] Implement cumulative exercise totals for current run, daily deep work count, and weekly/monthly historical rollups (Codex, 2026-05-14 19:54 UTC-3).
- [ ] Confirm whether workout guidance should be strictly rep-count based, timer-based, or mixed.
- [x] Confirm whether users need editable/custom workouts in addition to predefined workouts. (Yes — Customize tab: editable amounts, per-stretch toggles, custom exercises; Composer, 2026-05-24.)
- [ ] Confirm whether the app should send desktop notifications at phase changes (focus end, break end, next session start).
