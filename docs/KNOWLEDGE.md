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

**Stale `apps/` folder:** if you still see `apps/sync-api/` locally, it is gitignored dev DB junk from an old experiment — safe to delete (`rm -rf apps`).

## Sync refactor (in progress)

Full checklist and file paths: **`docs/sync-refactor-plan.md`**. Root issue: local saves wipe whole tables; merge uses wrong timestamps for config rows; pull is still full-snapshot. Row patches on upload are done; steps 1–7 in that doc finish the loop.
