# Knowledge

Hard-won lessons and context that should survive across agent sessions.

Add entries when you learn something non-obvious about this project — setup traps, tooling quirks, why a decision was made. Keep ARCHITECTURE.md for confirmed product and system facts only.

## Repository folder layout (2026-07)

Top-level code lives in literal folders:

| Folder | Role |
| --- | --- |
| `desktop/ui/` | Desktop React UI (import alias `@/`) |
| `desktop/src-tauri/` | Tauri Rust shell (keep this inner name — Tauri expects it) |
| `shared/core`, `shared/storage`, `shared/sync-client/` | npm packages `@mgmt/core`, `@mgmt/storage`, `@mgmt/sync` |
| `backend/server/` | HTTP sync server (`@mgmt/server`) |
| `mobile/` | Phone PWA companion (`@mgmt/companion`) |

Root `package.json` still runs desktop Vite/Tauri; workspace globs are `shared/*`, `backend/*`, and `mobile`.

**Cloudflare Pages:** after this move, set build output directory to `mobile/dist` (was `apps/companion/dist`).

**Tauri CLI:** `scripts/tauri.mjs` passes `--config desktop/src-tauri/tauri.conf.json` because `src-tauri` is no longer at the repo root.
