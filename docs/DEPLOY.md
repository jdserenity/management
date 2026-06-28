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

Assumes you already cloned the repo (e.g. `/home/linuxuser/prod-apps/management`) and ran `npm install` once by hand.

Create secrets (edit `SERVER_TOKEN`; `DB_PATH` must be a path **your Linux user can write**):

```bash
mkdir -p ~/prod-apps/management/data
sudo mkdir -p /etc/mgmt
sudo cp ~/prod-apps/management/apps/server/server.env.example /etc/mgmt/server.env
sudo chmod 600 /etc/mgmt/server.env
sudo nano /etc/mgmt/server.env
```

If you already have a `server.db` from running the server manually, point `DB_PATH` at that file (or copy it into `data/server.db`).

Install the unit (`User`, `Group`, and `WorkingDirectory` must match your VPS — see `mgmt-server.service.example`):

```bash
sudo cp ~/prod-apps/management/apps/server/mgmt-server.service.example /etc/systemd/system/mgmt-server.service
sudo nano /etc/systemd/system/mgmt-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now mgmt-server
```

If you prefer `DB_PATH=/var/lib/mgmt/server.db`, create the dir and give ownership to your login user:

```bash
sudo mkdir -p /var/lib/mgmt
sudo chown "$(whoami):$(whoami)" /var/lib/mgmt
```

### Verify

```bash
sudo systemctl status mgmt-server
journalctl -u mgmt-server -n 50 --no-pager
curl -s http://127.0.0.1:8787/health
```

`/health` should return `{"ok":true}` with no token (proves the process is listening).

Test auth (env file is root-only, so read the token with `sudo`):

```bash
TOKEN=$(sudo grep '^SERVER_TOKEN=' /etc/mgmt/server.env | cut -d= -f2- | tr -d '\r')
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8787/v1/data
```

Expect HTTP `200`. A `400` here usually means `$TOKEN` is empty (permission denied on the env file) or the header is malformed. A `401` means the token in curl does not match `SERVER_TOKEN` in the file.

Point clients at the same token as `SERVER_TOKEN` on the VPS (`/etc/mgmt/server.env`). Values are fixed at **build time** — changing them requires a new build/deploy, not an app restart alone.

| Client | Where to set `VITE_SERVER_URL` / `VITE_SERVER_TOKEN` | Redeploy |
| --- | --- | --- |
| **Companion (production)** | Cloudflare Pages dashboard → project **mgmt-companion** → Settings → Environment variables (Production) | Push to Git (auto-build) or **Retry deployment** in Cloudflare after editing vars |
| **Desktop** | Repo root `.env` on your Mac | `npm run tauri build` then `npm run app:deploy` |
| **Local dev** | Repo root `.env` | Restart `npm run dev:companion` or `npm run tauri dev` |

`VITE_SERVER_URL` must be a public HTTPS URL (e.g. `https://mgmt.levier.cc`), not a Tailscale-only IP. `VITE_SERVER_TOKEN` must match `SERVER_TOKEN` on the VPS.

### Companion on Cloudflare Pages (Git build)

Production companion is a static PWA on Cloudflare Pages. Cloudflare runs the build on each Git push; Vite reads `VITE_*` from the **Cloudflare dashboard env vars** (not from a `.env` file in the repo — that file is gitignored and not present on Cloudflare’s builders).

Typical Pages settings (monorepo root as project root):

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build:companion` |
| Build output directory | `apps/companion/dist` |
| Production env vars | `VITE_SERVER_URL`, `VITE_SERVER_TOKEN` |

After changing dashboard env vars, trigger a new deployment (push a commit or **Retry deployment**) so the new values are baked into the JS bundle.

Optional manual deploy from your Mac (uses local `.env` instead of dashboard): `npm run deploy:companion` (`scripts/deploy-companion.mjs` builds locally then `wrangler pages deploy`).

### Update server code on the VPS

```bash
cd ~/prod-apps/management
git pull
npm install
sudo systemctl restart mgmt-server
```

### Common commands

| Command | Use |
| --- | --- |
| `sudo systemctl status mgmt-server` | Running? recent log lines |
| `journalctl -u mgmt-server -f` | Live logs |
| `sudo systemctl restart mgmt-server` | After config or code change |
| `sudo systemctl stop mgmt-server` | Stop (e.g. before manual DB work) |
| `npm run db:server-overview` | Table list + row counts for `data/server.db` in the repo root |

Use `npm run start:prod -w @mgmt/server` in production (env from `/etc/mgmt/server.env`). Do not use `dev:server` on the VPS — that watches files for local development.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `status=217/USER` in `systemctl status` | `User=` in the unit file is not a real Linux account (e.g. left as `mgmt`) | Set `User=` and `Group=` to `whoami` on the VPS; set `WorkingDirectory=` to the repo path (`pwd` inside the clone) |
| `curl` prints `000` | Server is not listening (service failed or not started) | `sudo systemctl status mgmt-server` and `journalctl -u mgmt-server -n 30 --no-pager` |
| `curl: (2) no URL specified` | Missing URL at end of command | Add `http://127.0.0.1:8787/v1/data` after the headers |
| `401` from curl | Wrong token | Use the same string as `SERVER_TOKEN` in `/etc/mgmt/server.env` |
| `400` from curl on `/v1/data` | `Authorization: Bearer` with an empty or invalid token | Read token with `sudo grep '^SERVER_TOKEN=' /etc/mgmt/server.env` (file is chmod 600, root-owned) |
| `SqliteError: unable to open database file` | `DB_PATH` points somewhere `linuxuser` cannot write (e.g. `/var/lib/mgmt` owned by root) | `chown` that dir to your user, or set `DB_PATH` under your home (e.g. `~/prod-apps/management/data/server.db`) and `mkdir -p` the parent |

### HTTPS / public URL (follow-up)

Expose the API on HTTPS (e.g. Caddy or nginx reverse proxy to `127.0.0.1:8787`) before using it from phones on cellular. Firewall: allow 443; keep 8787 on localhost only once the proxy is in place.
