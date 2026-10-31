# Instagram Phone Workspace

A macOS dashboard for controlling physical iPhones over USB, with manual Instagram control, an account directory, scroll-only sessions, and a shared-password website login for remote demos.

## Start here

- **[AI_SETUP.md](AI_SETUP.md)** — complete installation, phone setup, verification, and remote-demo runbook for an AI assistant or human operator.
- **[HOST_DEPLOYMENT.md](HOST_DEPLOYMENT.md)** — dedicated host deployment, stable hosting, optional login startup, recovery, backups, and acceptance checklist.
- **[AGENTS.md](AGENTS.md)** — repository instructions for coding and setup agents.
- [NEW_HOST_MAC.md](NEW_HOST_MAC.md) — moving the setup to another Mac.
- [CLOUDFLARE_ACCESS.md](CLOUDFLARE_ACCESS.md) — temporary demo and optional custom-domain access.
- [REMOTE_ACCESS.md](REMOTE_ACCESS.md) — choosing remote access and optional Tailscale.
- [DEVELOPMENT.md](DEVELOPMENT.md) — editing the dashboard and backend.
- [SECURITY.md](SECURITY.md) — credentials and deployment boundaries.

## What it does

- Live screen viewing, taps, swipes, long presses, Home, and Instagram launch.
- Per-phone Instagram handle lists. These are labels; actual account switching happens inside Instagram.
- Cancellable scroll-only sessions, using the phone's actual screen dimensions. No likes, comments, follows, or posting.
- Numeric iPhone unlock using the detected accessibility keypad, with one attempt and no automatic retry. Saving a phone passcode is an explicit separate action.
- Website password login with salted scrypt storage, secure cookies, six-hour sessions, logout, and guess limits.
- Temporary Cloudflare demo URLs without a domain, DNS change, or Tailscale on operator devices.

The Instagram plugin is enabled by default; the legacy TikTok plugin is disabled unless explicitly enabled. The legacy scheduler and plugin framework remain in the source. The normal manual-control/demo setup does not run a scheduler worker.

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

After local phone control works, create a temporary password-protected demo:

```sh
npm run demo:password
# Set the password in the temporary localhost page, keeping it out of chat.
npm run demo:start
npm run demo:status
```

`demo:start` enforces password authentication before opening a public tunnel. It requires the official `cloudflared` connector (`brew install cloudflared`). A quick-tunnel URL changes when recreated and has no uptime guarantee. Keep the host Mac awake. Use `npm run demo:stop` to stop just the temporary connector, or `npm run local:stop` to stop the whole workspace.

## Validation and limits

The customized stack has been exercised with one physical iPhone 13 on iOS 17.0 and Xcode 26.0.1. Other device/iOS combinations and larger fleets need their own checks. Tests passing does not prove that a new Mac has working signing, USB pairing, or phone control. No ten-phone capacity guarantee is claimed.

```sh
npm run check
npm audit
```

Local configuration, phone passcodes, Apple certificates, database contents, and tunnel credentials are intentionally excluded from this repository. A fresh clone requires its own local setup. No automatic macOS login startup or unattended recovery is installed.

## Attribution

Derived from [Git-Agni/prod-FARM-IOS-Core](https://github.com/Git-Agni/prod-FARM-IOS-Core), upstream revision `3e936babd80723b49b3e594f9403b25363078e64`, with Instagram, device-control, dependency, and remote-access changes. Original license, notice, and source copyright information are retained. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

See [Shared dashboard guide](docs/shared-dashboard.md) for the VML phone grid, shared controls, preview modes, and interface maintenance.
