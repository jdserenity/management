# Knowledge

Hard-won lessons and context that should survive across agent sessions.

Add entries when you learn something non-obvious about this project — setup traps, tooling quirks, why a decision was made. Keep ARCHITECTURE.md for confirmed product and system facts only.

## Repository folder layout (2026-07)

Top-level code lives in literal folders:

| Folder | Role |
| --- | --- |
| `desktop/ui/` | Desktop React UI (import alias `@/`) |
| `desktop/src-tauri/` | Tauri Rust shell (keep this inner name — Tauri expects it) |
| `shared/core`, `shared/storage`, `shared/sync/` | npm packages `@mgmt/core`, `@mgmt/storage`, `@mgmt/sync` (sync is the **client** library, not the server) |
| `backend/` | HTTP sync server (`@mgmt/server`) — the program that runs on the VPS |
| `mobile/` | Phone PWA companion (`@mgmt/companion`) |

Root `package.json` still runs desktop Vite/Tauri; workspace entries are `shared/*`, `backend`, and `mobile`.

**Cloudflare Pages:** build output directory is `mobile/dist`.

**Tauri CLI:** `scripts/tauri.mjs` passes `dev --config desktop/src-tauri/tauri.conf.json` (config flag must come **after** the subcommand).

**Tauri build output path:** Vite `root` is `desktop/ui/`, so the default Vite `outDir` is `desktop/ui/dist/`. Tauri `frontendDist` in `desktop/src-tauri/tauri.conf.json` is `../../dist` (repo root). If those diverge, `npm run tauri build` bundles a **stale** root `dist/` while fresh JS lands in `desktop/ui/dist/` — Settings tabs, Sync health card, etc. look missing in the installed app. `vite.config.ts` sets `build.outDir` to repo root `dist/`. After a build, `rg "Sync health" dist/assets/*.js` should match.

**Stale `apps/` folder:** if you still see `apps/sync-api/` locally, it is gitignored dev DB junk from an old experiment — safe to delete (`rm -rf apps`).

## Sync refactor (merged 2026-07)

Branch `refactor/sync` merged to main. Checklist: **`docs/sync-refactor-plan.md`**. Still requires redeploy of desktop (`npm run tauri build`), companion (Cloudflare Pages), and VPS server for sync fixes to take effect in production.
