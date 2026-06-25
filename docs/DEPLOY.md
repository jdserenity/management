# Deploy (macOS daily use)

Tauri wraps the React UI in a native **Management.app**. Stats live outside the app bundle, so replacing the app keeps your data.

## Data

- Bundle id: `com.diamari.management` (do not change in `src-tauri/tauri.conf.json`).
- SQLite: `~/Library/Application Support/com.diamari.management/mgmt.db`
- Backups (via `npm run db:backup`): `.../com.diamari.management/backups/mgmt-<timestamp>.db`

## Install / update

```bash
npm install
npm run tauri build
```

Release bundle: `src-tauri/target/release/bundle/macos/Management.app` (open from Finder or `open` that path).

`npm run app:deploy` copies that bundle to `/Applications/Management.app` (replaces an existing install). After code changes, build again and run deploy again (do not delete Application Support).

## Commands

| Command | Use |
| --- | --- |
| `npm run tauri build` | Package **Management.app** (runs `npm run build` first via Tauri) |
| `npm run tauri dev` | Dev desktop app; **same** `mgmt.db` as the installed app |
| `npm run dev` | Vite only (browser at localhost:1420); **no** Tauri/SQLite — not for real use |
| `npm run build` | Frontend TypeScript + Vite only; not a macOS app bundle |
| `npm run db:backup` | Copy `mgmt.db` into `~/Library/Application Support/com.diamari.management/backups/` |
| `npm run app:deploy` | Copy release `Management.app` to `/Applications` (macOS; run `tauri build` first) |

If macOS blocks an unsigned build: System Settings → Privacy & Security, or `xattr -cr /Applications/Management.app`.
