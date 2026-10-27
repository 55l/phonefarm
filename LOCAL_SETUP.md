# Local setup

Follow [AI_SETUP.md](AI_SETUP.md), sections 1–6, for the full host and phone setup. This file is a short operational reference, not a record of one person's Mac.

```sh
npm ci --ignore-scripts
npm run appium:install-driver
npm run host:setup
# Configure private .env signing values and prepare/pair the phone as documented.
npm run check
npm run local:start
```

A fresh local-only dashboard is at `http://127.0.0.1:3000`. Once remote authentication is enabled, use the actual HTTPS operator URL instead.

| Component | Default local address |
| --- | --- |
| Dashboard | 127.0.0.1:3000 |
| Appium | 127.0.0.1:4725 |
| Dedicated PostgreSQL 16 | 127.0.0.1:55432 |
| First phone WDA / MJPEG | 127.0.0.1:8100 / 9100 |

Configuration is private: `.env`, `.env.remote`, `devices.json`, and `.local` are ignored by Git. The database lives in `.local/postgres`; it is not a global Homebrew service. Other phones receive unique control/video ports.

Start/Stop Dashboard shortcuts manage the app-owned services. `npm run local:reload` reloads the web service while preserving WDA supervision; website sessions and active scroll runs end. Automatic login startup and unattended recovery are not installed.

For a public demo, use the shared-password setup in [CLOUDFLARE_ACCESS.md](CLOUDFLARE_ACCESS.md). Do not expose the unauthenticated local dashboard or its device/database ports.
