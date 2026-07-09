# Project knowledge

Hard-won lessons and context that should survive across agent sessions.

## Always backup `local.db` before sync/hydrate/schema work

User data lives at `~/Library/Application Support/com.diamari.management/local.db` (not in git). Before refactors that touch sync, `hydrateDb`, migrations, or feature DBs:

```bash
npm run db:backup
```

That script uses `sqlite3 .backup` so **WAL contents are included** (plain `cp local.db` can drop recent rows still only in the `-wal` file).

Backups land in `…/com.diamari.management/backups/mgmt-<timestamp>.db`. After recovery events, also keep a human-named copy (e.g. `mgmt-recovered-full-checkpoint-YYYY-MM-DD.db`).

Lesson (2026-07): a hydrate/sync refactor wiped streaks/food/water; no pre-change backup existed. Phone companion + VPS still had data for recovery. Prefer phone→server upload then desktop pull when Mac is incomplete.

## Monorepo layout

| Folder | Role |
| --- | --- |
| `desktop/ui/` | React UI (`@/` alias) |
| `desktop/src-tauri/` | Tauri Rust shell — keep inner name; Tauri expects it |
| `shared/core`, `shared/storage`, `shared/sync/` | `@mgmt/core`, `@mgmt/storage`, `@mgmt/sync` (client lib, not the server) |
| `backend/` | `@mgmt/server` — HTTP sync API on the VPS |
| `mobile/` | `@mgmt/companion` — phone PWA |

Root `package.json` runs desktop Vite/Tauri; workspaces are `shared/*`, `backend`, `mobile`.

## Tauri build: stale `dist/` trap

Vite `root` is `desktop/ui/`, so the default Vite `outDir` would be `desktop/ui/dist/`. Tauri `frontendDist` in `desktop/src-tauri/tauri.conf.json` points at repo root `dist/`. If those diverge, `npm run tauri build` bundles **stale** root `dist/` while fresh JS lands in `desktop/ui/dist/` — Settings tabs, Sync health card, etc. look missing in the installed app.

`vite.config.ts` sets `build.outDir` to repo root `dist/`. After a build, `rg "Sync health" dist/assets/*.js` should match.

## Tauri CLI

`scripts/tauri.mjs` passes `dev --config desktop/src-tauri/tauri.conf.json` — the `--config` flag must come **after** the subcommand.

## Cloudflare Pages (companion)

Build output directory is `mobile/dist`. Production env vars (`VITE_SERVER_URL`, `VITE_SERVER_TOKEN`) live in the Cloudflare dashboard (or GitHub Actions secrets for the deploy workflow), not in the repo `.env` (gitignored on builders).

**Deploy only from `main` — not on pull requests.** Preview deploys for every PR are wasteful and confusing.

1. Prefer GitHub Actions: `.github/workflows/deploy-companion.yml` runs only on `push` to `main` (and manual dispatch). Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VITE_SERVER_URL`, `VITE_SERVER_TOKEN`.
2. If the project is still connected to Cloudflare’s automatic Git builds, in the Cloudflare dashboard for **mgmt-companion**:
   - **Settings → Builds & deployments → Production branch** = `main`
   - **Preview deployments** = **None** (or off) so opening a PR does not publish
   - Ideally disable automatic Git deploys entirely and rely on the Actions workflow, so you only get one production deploy path

Optional manual deploy from Mac: `npm run deploy:companion` (local `.env` + `wrangler pages deploy`).

## Stale `apps/` folder

If you still see `apps/sync-api/` locally, it is gitignored dev DB junk from an old experiment — safe to delete (`rm -rf apps`).

## Sync architecture (why row patches)

Before the sync refactor (merged 2026-07), local saves wiped whole tables and pull used ad-hoc merge rules — archive/rename/config edits could silently fail. Current design (see `shared/sync/src/syncRegistry.ts`):

1. **Save** — feature DBs upsert/delete only changed rows with `updated_at`
2. **Send** — `sync_outbox` queues row patches; no routine full-snapshot push
3. **Receive** — registry-driven merge; newer `updated_at` wins

Key paths: `mergeUserData.ts`, `syncOutbox.ts`, `userData.ts`, `dataSync.ts` (desktop), `mobile/src/platform/storage.ts`.

`POST /v1/data` full replace is bootstrap-only (empty device). Clients never push empty snapshots; server returns 409.

## Streaks + TDEE origin

Habits and nutrition were ported from Obsidian plugins (Streak Tracker, TDEE Tracker) into SQLite + React. Vault data was one-time imported via `npm run import:vault`. Wikilinks and Obsidian sync were dropped. Nutrition history is today-only (v1).

## VPS systemd troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `status=217/USER` | `User=` in unit file is not a real Linux account | Set `User=` / `Group=` to `whoami`; `WorkingDirectory=` to repo path |
| `curl` prints `000` | Server not listening | `sudo systemctl status mgmt-server`; `journalctl -u mgmt-server -n 30` |
| `401` from curl | Wrong token | Match `SERVER_TOKEN` in `/etc/mgmt/server.env` |
| `400` on `/v1/data` | Empty or malformed Bearer token | `sudo grep '^SERVER_TOKEN=' /etc/mgmt/server.env` (file is chmod 600) |
| `SqliteError: unable to open database file` | `DB_PATH` not writable by service user | `chown` the dir to your user, or use `~/prod-apps/management/data/server.db` |

Use `npm run start:prod -w @mgmt/server` in production. Do not use `dev:server` on the VPS.

HTTPS: expose API via reverse proxy (Caddy/nginx) to `127.0.0.1:8787`; allow 443, keep 8787 on localhost only.

## DEPLOY.md note

Older docs referenced `mgmt.db`; the desktop file is now `local.db` (auto-renamed from `mgmt.db` on first boot). `npm run db:backup` backs up `local.db`.
