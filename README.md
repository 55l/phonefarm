# Instagram Phone Workspace

A macOS dashboard for controlling physical iPhones over USB, with manual Instagram control, an account directory, scroll-only sessions, and a shared-password website login for remote phone control.

## Start here

- **[AI_SETUP.md](AI_SETUP.md)** — complete installation, phone setup, verification, and remote-control runbook for an AI assistant or human operator.
- **[HOST_DEPLOYMENT.md](HOST_DEPLOYMENT.md)** — dedicated host deployment, stable hosting, optional login startup, recovery, backups, and acceptance checklist.
- **[AGENTS.md](AGENTS.md)** — repository instructions for coding and setup agents.
- [NEW_HOST_MAC.md](NEW_HOST_MAC.md) — moving the setup to another Mac.
- [CLOUDFLARE_ACCESS.md](CLOUDFLARE_ACCESS.md) — named tunnels, stable hostnames, and optional temporary access.
- [REMOTE_ACCESS.md](REMOTE_ACCESS.md) — choosing remote access and optional Tailscale.
- [DEVELOPMENT.md](DEVELOPMENT.md) — editing the dashboard and backend.
- [SECURITY.md](SECURITY.md) — credentials and deployment boundaries.

## What it does

- Live screen viewing, taps, swipes, long presses, Home, and Instagram launch.
- Per-phone Instagram handle lists. These are labels; actual account switching happens inside Instagram.
- Cancellable scroll-only sessions, using the phone's actual screen dimensions. No likes, comments, follows, or posting.
- Numeric iPhone unlock using the detected accessibility keypad, with one attempt and no automatic retry. Saving a phone passcode is an explicit separate action.
- Website password login with salted scrypt storage, secure cookies, six-hour sessions, logout, and guess limits.
- Password-protected browser remote access through a named Cloudflare tunnel and an approved stable hostname. Operator devices need no Tailscale or local installation.

The Instagram plugin is enabled by default; the legacy TikTok plugin is disabled unless explicitly enabled. The legacy scheduler and plugin framework remain in the source. The normal manual-control setup does not run a scheduler worker.

## Installation outline

On a supported Mac with full Xcode, an Apple signing team, Node 24+, PostgreSQL 16, and a USB-connected iPhone:

```sh
git clone https://github.com/55l/phonefarm.git
cd phonefarm
npm ci --ignore-scripts
npm run appium:install-driver
npm run host:setup
```

Set the Apple signing values in the generated private `.env`, pair and prepare the phone, then start the dashboard. Follow **AI_SETUP.md** for the required details and acceptance checks; the commands above alone do not finish phone setup.

After local phone control works, follow **AI_SETUP.md sections 7–9** to set the workspace password privately, configure the approved stable hostname and named Cloudflare tunnel, and verify live control from another device. This guide also covers how each additional iPhone connects, required per-phone checks, daily start/stop commands, and host migration.

On a configured host, start the application and its enabled named connector with:

```sh
npm run local:start
node scripts/cloudflare-tunnel.mjs status
```

The team visits the configured HTTPS address and signs in with the workspace password. Keep the host Mac awake and its iPhones connected by USB. A temporary address is an optional alternative described at the end of AI_SETUP.md; it is not required for regular remote control.

## Validation and limits

The customized stack has been exercised with one physical iPhone 13 on iOS 17.0 and Xcode 26.0.1. Other device/iOS combinations and larger fleets need their own checks. Tests passing does not prove that a new Mac has working signing, USB pairing, or phone control. No ten-phone capacity guarantee is claimed.

```sh
npm run check
npm audit
```

Local configuration, phone passcodes, Apple certificates, database contents, and tunnel credentials are intentionally excluded from this repository. A fresh clone requires its own local setup. No automatic macOS login startup or unattended recovery is installed.

## Attribution

Derived from [Git-Agni/prod-FARM-IOS-Core](https://github.com/Git-Agni/prod-FARM-IOS-Core), upstream revision `3e936babd80723b49b3e594f9403b25363078e64`, with Instagram, device-control, dependency, and remote-access changes. Original license, notice, and source copyright information are retained. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

See [Shared dashboard guide](docs/shared-dashboard.md) for the phone grid, shared controls, preview modes, and interface maintenance.
