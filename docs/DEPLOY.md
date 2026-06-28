# Deploy (macOS daily use)

Tauri wraps the React UI in a native **Management.app**. Stats live outside the app bundle, so replacing the app keeps your data.

## Data

- Bundle id: `com.diamari.management` (do not change in `src-tauri/tauri.conf.json`).
- SQLite: `~/Library/Application Support/com.diamari.management/local.db`
- Backups (via `npm run db:backup`): `.../com.diamari.management/backups/local-<timestamp>.db`

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

## Sync server (VPS, systemd)

The companion and desktop apps sync through `apps/server` (Hono HTTP API, SQLite). On a VPS, run it as a **systemd** service so it stays up after you close SSH and restarts after a reboot or crash.

**systemd** is Linux’s service manager — it starts background programs (“daemons”) and keeps them running. The name is not short for “daemon”; it’s just the project name for the init system most Linux VPS images use.

Templates: `apps/server/mgmt-server.service.example`, `apps/server/server.env.example`.

### One-time VPS setup

On the VPS (Ubuntu/Debian-style; adjust package names if needed):

```bash
# Node 20+ (example via NodeSource; use nvm or distro packages if you prefer)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# App user + data dir (keeps DB outside the git clone)
sudo useradd --system --create-home --home-dir /home/mgmt --shell /bin/bash mgmt || true
sudo mkdir -p /var/lib/mgmt
sudo chown mgmt:mgmt /var/lib/mgmt

# Clone repo (as mgmt)
sudo -u mgmt git clone https://github.com/YOUR_ORG/management.git /home/mgmt/management
cd /home/mgmt/management && sudo -u mgmt npm install
```

Create secrets and paths (edit values; use a long random `SERVER_TOKEN`):

```bash
sudo mkdir -p /etc/mgmt
sudo cp /home/mgmt/management/apps/server/server.env.example /etc/mgmt/server.env
sudo chmod 600 /etc/mgmt/server.env
sudo nano /etc/mgmt/server.env   # SERVER_TOKEN, DB_PATH=/var/lib/mgmt/server.db, PORT=8787
```

Install the unit (edit `User`, `WorkingDirectory`, and `ExecStart` if your paths differ):

```bash
sudo cp /home/mgmt/management/apps/server/mgmt-server.service.example /etc/systemd/system/mgmt-server.service
sudo nano /etc/systemd/system/mgmt-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now mgmt-server
```

### Verify

```bash
sudo systemctl status mgmt-server
journalctl -u mgmt-server -n 50 --no-pager
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer YOUR_SERVER_TOKEN" http://127.0.0.1:8787/v1/data
```

Expect HTTP `200`. Close SSH and run the same `curl` from your Mac (replace host/port if you use a reverse proxy).

Point clients at the same token: desktop `sync-server.json` (Settings or app config dir), companion `VITE_SERVER_URL` / `VITE_SERVER_TOKEN` at build time (`npm run deploy:companion`).

### Update server code on the VPS

```bash
cd /home/mgmt/management
sudo -u mgmt git pull
sudo -u mgmt npm install
sudo systemctl restart mgmt-server
```

### Common commands

| Command | Use |
| --- | --- |
| `sudo systemctl status mgmt-server` | Running? recent log lines |
| `journalctl -u mgmt-server -f` | Live logs |
| `sudo systemctl restart mgmt-server` | After config or code change |
| `sudo systemctl stop mgmt-server` | Stop (e.g. before manual DB work) |

Use `npm run start:prod -w @mgmt/server` in production (env from `/etc/mgmt/server.env`). Do not use `dev:server` on the VPS — that watches files for local development.

### HTTPS / public URL (follow-up)

Expose the API on HTTPS (e.g. Caddy or nginx reverse proxy to `127.0.0.1:8787`) before using it from phones on cellular. Firewall: allow 443; keep 8787 on localhost only once the proxy is in place.
