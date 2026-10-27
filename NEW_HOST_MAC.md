# Set up on a new hosting Mac

Use **[AI_SETUP.md](AI_SETUP.md)** from start to finish. It is written for an AI assistant working alongside the Mac/phone owner and includes the exact prerequisites, signing, device pairing, password setup, remote demo, and verification steps.

Then complete **[HOST_DEPLOYMENT.md](HOST_DEPLOYMENT.md)** for a dedicated hosted machine: choose temporary or stable access, configure optional login startup only if requested, verify restart/recovery, and record the handover privately. Merely installing dependencies does not constitute a fully set up host.

## Fresh install

```sh
git clone https://github.com/55l/phonefarm.git
cd phonefarm
npm ci --ignore-scripts
npm run appium:install-driver
npm run host:setup
```

Before controlling phones, install/select full Xcode, set the generated private `.env` signing values, trust/pair each iPhone, enable Developer Mode, prepare its WDA build, register it, and verify live manual control. Follow the runbook rather than treating these four commands as complete setup.

## Move an existing fleet

1. Stop active scroll runs on the old host. Keep it intact until the new host is tested.
2. Clone this customized repository; do not clone upstream expecting these changes.
3. Optionally run `npm run host:package -- --export-devices` on the old Mac. The source bundle excludes credentials. The separate `device-settings-without-passcodes.json` still contains private UDIDs/account labels and must be transferred privately, never committed.
4. Install tools and initialize the new host with fresh configuration/database. Import the optional registry as `devices.json`, chmod 600, and preserve distinct per-phone ports. Do not copy installed dependencies, drivers, signing material, the old environment, or the database as an installation shortcut.
5. Set up the new Mac's Apple signing and trust relationship. Copying source does not transfer pairing or signing. Build WDA before starting a competing supervisor.
6. Stop the old controller before moving USB phones to the new Mac. Verify every phone independently on the new host.
7. Run `npm run demo:password`, set a website password locally, then `npm run demo:start`. Share the new temporary HTTPS URL. No domain or Tailscale is required for this mode.
8. Test sign-in from another device, live viewing, one deliberate control action, and logout. Source migration does not move historical database jobs/media; restart scroll sessions only deliberately.

A named production tunnel is optional and separate. If moving one, stop its old connector before routing to the new host. Keep all credentials private. The default demo URL changes when recreated.

See [REMOTE_ACCESS.md](REMOTE_ACCESS.md) for operator access and [CLOUDFLARE_ACCESS.md](CLOUDFLARE_ACCESS.md) for demo lifecycle and optional stable hostnames.
