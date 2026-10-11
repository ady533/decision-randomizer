# Decision Randomizer

Add tasks, give each a relative importance, and let the app pick one for you.
A task with importance 3 is three times as likely to be picked as one with importance 1.

- Works fully offline in the browser; tasks are saved on the device.
- Installable as an app (Add to Home Screen) on phones and desktops.
- Optional: run the small server on your own Linux box to sync tasks across all
  your devices from anywhere.

## Run it locally

Needs [Node.js](https://nodejs.org) 20 or newer. There is nothing to install.

```sh
npm start
```

Open http://127.0.0.1:8080. Without `APP_PASSWORD` the server only serves the
app, and tasks stay in that browser.

You can also host just the `public/` folder on any static host (GitHub Pages,
Netlify, ...); everything works except sync.

## Self-host with sync

The server is a single Node process with no dependencies. It serves the app and
a small password-protected API that stores your tasks in one JSON file.

The recommended way to reach it from anywhere is [Tailscale](https://tailscale.com):
your box stays closed to the internet and only your own devices can reach it,
over HTTPS.

### 1. Get the code onto the box

```sh
sudo git clone https://github.com/ady533/decision-randomizer.git /opt/decision-randomizer
sudo chown -R "$USER" /opt/decision-randomizer
cd /opt/decision-randomizer
```

### 2. Choose a password

```sh
cp .env.example .env
sed -i "s|^APP_PASSWORD=.*|APP_PASSWORD=$(openssl rand -base64 24)|" .env
chmod 600 .env
cat .env   # keep this; you type it once on each device
```

### 3a. Run with Docker (option A)

```sh
docker compose up -d --build
curl -s http://127.0.0.1:8080/api/health   # {"ok":true,"sync":true}
```

Data lives in the `data` Docker volume. The container restarts on reboot.

### 3b. Run with systemd (option B, no Docker)

Needs Node 20+ installed system-wide (`node --version`; the unit runs
`/usr/bin/env node`, so a per-user nvm install won't be found).

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin decision-randomizer
sudo install -m 600 -o root -g root .env /etc/decision-randomizer.env
sudo cp deploy/decision-randomizer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now decision-randomizer
curl -s http://127.0.0.1:8080/api/health   # {"ok":true,"sync":true}
```

Data lives in `/var/lib/decision-randomizer/state.json`. Logs:
`journalctl -u decision-randomizer -f`.

### 4. Reach it from anywhere with Tailscale

1. Install Tailscale on the box and log in:
   `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
2. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), turn on
   **MagicDNS** and **HTTPS Certificates**.
3. Put the app on your tailnet over HTTPS:
   ```sh
   sudo tailscale serve --bg 8080
   tailscale serve status   # shows https://<box-name>.<tailnet>.ts.net
   ```
4. Install Tailscale on your phone and laptop, sign in with the same account, and
   open that `https://...ts.net` address.
5. Open **Sync** at the bottom of the page, enter the password from step 2, and
   press Connect. Do this once per device. Add the page to your home screen to use
   it like an app.

HTTPS matters: browsers only allow offline mode and app install on HTTPS (or
localhost), which `tailscale serve` provides.

### Updating

```sh
cd /opt/decision-randomizer && git pull
docker compose up -d --build              # option A
sudo systemctl restart decision-randomizer # option B
```

Open devices pick up the new version on their next reload.

### Backups

- Option A: `docker compose cp decision-randomizer:/data/state.json backup.json`
- Option B: copy `/var/lib/decision-randomizer/state.json`

### Alternative: public HTTPS with Caddy

Only if you want it reachable without Tailscale. This exposes the login to the
whole internet, so use a long password. Point a domain at the box, open ports 80
and 443, install [Caddy](https://caddyserver.com), and use this `Caddyfile`:

```
tasks.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

## How sync works

Each device keeps its own copy and works offline. When it's connected, changes
are sent to the server, and the device checks for changes from other devices
when it regains focus or comes back online. If two devices both changed tasks
while apart, the one that syncs second loads the server's copy and shows a
notice. The first time you connect a device that already has tasks to a server
that also has tasks, the app asks which copy to keep.

Configuration (environment variables):

| Variable       | Default             | Meaning                                    |
| -------------- | ------------------- | ------------------------------------------ |
| `APP_PASSWORD` | empty (sync off)    | Password devices use to sync               |
| `HOST`         | `127.0.0.1`         | Address to listen on                       |
| `PORT`         | `8080`              | Port to listen on                          |
| `DATA_FILE`    | `data/state.json`   | Where tasks are stored                     |

## Development

```sh
npm test                          # unit and API tests (node:test, no dependencies)
python3 scripts/make-icons.py     # regenerate the app icons
```

Layout:

- `public/`: the app (HTML, CSS, ES modules, service worker, icons)
  - `js/picker.js`: weighted random pick
  - `js/state.js`: data shape, validation, localStorage (shared with the server)
  - `js/sync.js`: client for the sync API
  - `js/app.js`: UI
- `server/server.js`: static file server and sync API
- `deploy/`: systemd unit
