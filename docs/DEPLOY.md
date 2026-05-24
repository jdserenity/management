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

Copy `src-tauri/target/release/bundle/macos/Management.app` to Applications. After code changes, build again and replace the app (do not delete Application Support).

## Commands

| Command | Use |
| --- | --- |
| `npm run tauri dev` | Dev desktop app; **same** `mgmt.db` as the installed app |
| `npm run dev` | Vite only (browser at localhost:1420); **no** Tauri/SQLite — not for real use |
| `npm run db:backup` | Copy `mgmt.db` into the `backups/` folder |

If macOS blocks an unsigned build: System Settings → Privacy & Security, or `xattr -cr /Applications/Management.app`.
