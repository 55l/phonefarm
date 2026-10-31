# Fully hosted installation on a new Mac

This is the deployment checklist for an AI assistant setting up a **new hosting Mac**, only when the owner decides to install it. A hosting Mac has the iPhones physically connected by USB. A teammate's viewing laptop, tablet, or phone needs only a browser and the website password; it does not run this stack.

Read **[AGENTS.md](AGENTS.md)** and **[AI_SETUP.md](AI_SETUP.md)** first. Use AI_SETUP for the detailed installation and phone commands, then use this guide to finish hosting, startup, operational verification, backups, and handover. Do not install anything on an existing machine merely because this document exists.

## 1. Confirm the target hosting setup

The main remote-control path in AI_SETUP.md uses a stable hostname and named tunnel. Confirm the owner’s intended host, hostname, and startup needs before making deployment changes. Alternatives remain available when explicitly chosen:

| Mode | Use | Website address | Startup behavior |
| --- | --- | --- | --- |
| Local only | Physical setup and local testing | Loopback only | Start Dashboard manually. |
| Temporary demo | Short demonstration from remote browsers | Random trycloudflare.com address | Start with demo:start; address changes when recreated. |
| Stable hosted app | Regular team use on a dedicated Mac | Owner-approved stable hostname and named tunnel | Optional user-login LaunchAgent below starts app-owned services. |
| Private team access | Team explicitly chooses Tailscale | Private .ts.net URL | See REMOTE_ACCESS.md; not required for browser-only demos. |

A stable hostname and reliable operations are separate from individual-user permissions: shared-password mode gives all password holders access to all phones. If the owner needs separate identities, individual revocation, audit attribution, or restricted phone groups, treat that as a separate feature/deployment decision rather than claiming it already exists.

For a demo, **do not request or modify an owned domain, DNSSEC, a registrar, or an existing Vercel website**. A custom domain is optional and needs its own explicit authorization. No DNS migration is pre-authorized by this repository.

## 2. Gather the minimum information privately

The installation needs:

- A supported Mac, normal user account, power/network access, and a local project directory.
- One initial USB iPhone, its data-capable cable, and someone on site to unlock it and accept trust/developer prompts.
- The owner's Apple signing account/team and a bundle identifier that team can use. The owner signs in to Xcode directly.
- A shared website password set through the localhost setup page, not sent to the assistant.
- For stable hosting only: the approved hostname, Cloudflare account access handled by the owner, and a dedicated named-tunnel connector token stored privately on the host.
- The person responsible for restarting/unlocking the Mac and phones, signing renewal, and backups.

Inspect existing configuration before generating anything. Never replace a running database or saved registry with empty defaults. Never copy someone else's Apple identity or tunnel token from a previous host.

## 3. Build the new host in order

Follow AI_SETUP sections 1–6 for the details. This is the required order, not a shortcut around those checks:

1. Install full Xcode, complete its first launch, select it with xcode-select, and sign in to the owner's Apple development account.
2. Install Homebrew, Node 24+, PostgreSQL 16, and cloudflared. Confirm the tools resolve correctly in the host user's environment.
3. Clone this repository into a non-cloud-synced local directory:

   ```sh
   git clone https://github.com/55l/phonefarm.git
   cd phonefarm
   npm ci --ignore-scripts
   npm run appium:install-driver
   npm run host:setup
   ```

4. Configure private `.env` signing values (`XCODE_ORG_ID`, `WDA_BUNDLE_ID`, selected Xcode, compatible deployment minimum). Keep the generated database credentials and loopback addresses.
5. Pair the first phone, enable Developer Mode, wait for Xcode readiness, identify its actual UDID locally, and run:

   ```sh
   npm run wda:prepare -- --udid YOUR_DEVICE_UDID
   ```

   Replace the placeholder. Trust the installed developer profile on the phone when prompted. A build alone does not prove installation/control.
6. Start with `npm run local:start`, register the prepared phone, and verify its actual live screen and harmless controls. Let the owner sign in to Instagram directly on the phone.
7. Run `npm run check` and `npm audit`. The driver installer performs its separate bundled dependency audit. Review failures instead of forcing upgrades or bypassing WDA patch checks.
8. Add additional phones **one at a time** after the first works; see section 8 below.

Reference-only tested combination: one iPhone 13 on iOS 17.0, Xcode 26.0.1, Node 24, PostgreSQL 16, XCUITest 12.21.0, WDA 16.17.5. Compatibility of other combinations and a fleet's capacity must be verified on the chosen host. Do not promise a phone count based only on memory size.

## 4. Enable website authentication before publication

```sh
npm run demo:password
```

Have the owner open the printed localhost URL, enter the website password twice, and save it. The salted password hash lives only in `.local/cloudflare/shared-auth.json` (600). The password must not appear in Git, command arguments, a transcript, a LaunchAgent, or a deployment record.

For a demo, simply run:

```sh
npm run demo:start
npm run demo:status
```

The helper installs and verifies shared-password authentication before creating the public route. Use the new URL printed on this host. Continue to section 6; section 5 is unnecessary for a temporary demo.

## 5. Stable hosting with a named Cloudflare tunnel

Only perform this after the owner explicitly chooses stable hosting and approves its hostname/account/DNS scope. Follow [AI_SETUP.md section 8](AI_SETUP.md#8-connect-regular-remote-access-with-a-stable-https-address) for the complete connector sequence and [CLOUDFLARE_ACCESS.md](CLOUDFLARE_ACCESS.md) for provider details, especially existing website/email records and DNSSEC timing. Do not infer that an unrelated domain should be moved.

1. Set up the approved hostname and a **dedicated remotely managed named tunnel** in the owner's Cloudflare account. Publish only that hostname to `http://127.0.0.1:3000`; never publish database/Appium/WDA ports.
2. Save the connector token privately as `.local/cloudflare/tunnel-token`, permission 600, with the directory 700. Do not include the token in a command or document. Do not install a second brew/Cloudflare system service for the same connector; this repository's helper will own it.
3. Create or deliberately update `.env.remote` after backing up an existing version privately:

   ```dotenv
   # Managed website password access
   WEB_HOST=127.0.0.1
   PUBLIC_ORIGIN=https://phones.example.com
   PHONE_FARM_AUTH_PLUGIN=./auth/shared-password.ts
   PHONE_FARM_PASSWORD_FILE=.local/cloudflare/shared-auth.json
   ```

   Replace `phones.example.com` with the approved hostname and chmod the file 600. Do not reuse another host's URL. Remove stale temporary trusted origins when retiring the demo.
4. Reload, keeping the connector disabled until the origin is protected:

   ```sh
   npm run local:reload
   curl --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/api/devices
   ```

   The API must return **401**, not phone data. Confirm forged identity headers also fail. The public password page must use valid HTTPS; do not bypass a certificate warning.
5. Enable and start the repository-managed named connector:

   ```sh
   touch .local/cloudflare/enabled
   chmod 600 .local/cloudflare/enabled
   node scripts/cloudflare-tunnel.mjs start
   node scripts/cloudflare-tunnel.mjs status
   ```

6. Confirm Cloudflare reports a healthy connector and the approved HTTPS address reaches the password page. Have the owner sign in and complete the public acceptance checks below.
7. Stop an old temporary demo with `npm run demo:stop`. When migrating an existing named tunnel to a different Mac, stop the old named connector before final cutover so requests cannot reach the wrong host.

Keep `WEB_HOST=127.0.0.1`. Opening the dashboard port directly on the router or LAN is not a substitute for the protected tunnel.

## 6. Acceptance gate: a hosted app must pass all relevant checks

Record results in a private `.local/installation.md` using [the template](docs/hosting/INSTALLATION_RECORD.example.md). A successful install command or health endpoint alone is insufficient.

| Layer | Required result |
| --- | --- |
| Runtime | Type checks, the current test suite, browser build, and root/driver dependency audits pass or a reviewed limitation is documented. The test count can grow in later revisions. |
| Storage | Dedicated database is on loopback; local credential/config permissions are private; no existing unrelated service was replaced. |
| Phones | Each registered phone shows the correct live image; Home, tap, swipe, and Instagram launch work on the intended phone. |
| Account management | Handle labels save; actual Instagram account switching/login remains on the phone. |
| Unlock, if requested | Owner enters the numeric code directly; one successful attempt; no retries or accidental save. |
| Scroll, if requested | A deliberate short run scrolls only the desired Instagram feed and stops; it does not resume after restart. |
| Public boundary | Anonymous device/image APIs return 401; forged proxy headers do not grant access; cross-site writes return 403. |
| Browser login | Owner's shared password opens the dashboard over HTTPS; secure cookie/session behavior works. |
| Real remote control | Authenticated public live video and one harmless phone action work. An offline phone leaves this check incomplete. |
| Sign-out | Confirm Sign out, revisit the dashboard, and see the password page again. |
| Second operator | A separate device/network opens the actual URL without Tailscale in public mode and passes the same login/control test. |
| Existing services | If DNS changes were explicitly made, existing website/email behavior is preserved and DNSSEC is correctly restored/verified. |

If only the website was tested because the phone is offline, report **website ready; live phone control unverified**, not “fully deployed.”

## 7. Start at user login and restart stopped services — optional

This section is a **deployment template**, not something installed merely by cloning the repo. It must be generated and tested on the chosen host after section 6 passes. Do not run these steps on the current/demo Mac without a request to install persistent hosting there.

The template runs `local-dashboard.mjs start` at login and every 60 seconds. The existing helper starts stopped app-owned components and leaves a running dashboard in place. A named connector is started when `.local/cloudflare/enabled` exists. A temporary quick tunnel is not recreated, because that would silently change its address.

This is **user-login startup and start-if-stopped recovery**, not boot-before-login operation or a full watchdog. A hung process, unavailable keychain, broken certificate, failed USB trust, or stale database PID still requires diagnosis. A successful launchd job does not prove that phones are online.

Generate the host-specific plist from the repository template, from the actual installed project directory:

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
if (!fs.existsSync(path.join(root, '.env')) || !fs.existsSync(path.join(root, 'scripts/local-dashboard.mjs'))) {
  throw new Error('Run this from the initialized phonefarm directory.');
}
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const servicePath = [path.dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':');
const template = fs.readFileSync('docs/hosting/com.phoneworkspace.host.plist.example', 'utf8');
const result = template.replaceAll('__NODE_BINARY__', escape(process.execPath))
  .replaceAll('__WORKSPACE__', escape(root)).replaceAll('__SERVICE_PATH__', escape(servicePath));
fs.mkdirSync('.local', { recursive: true, mode: 0o700 });
for (const log of ['host-launchd.log', 'host-launchd-error.log']) {
  fs.closeSync(fs.openSync(path.join('.local', log), 'a', 0o600));
  fs.chmodSync(path.join('.local', log), 0o600);
}
fs.writeFileSync('.local/com.phoneworkspace.host.plist', result, { mode: 0o600 });
JS
plutil -lint .local/com.phoneworkspace.host.plist
```

Review the generated paths. If a job with this label already exists, inspect and unload it deliberately before replacing it. Then install it **as the normal signed-in host user**, without sudo:

```sh
mkdir -p "$HOME/Library/LaunchAgents"
install -m 600 .local/com.phoneworkspace.host.plist "$HOME/Library/LaunchAgents/com.phoneworkspace.host.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.phoneworkspace.host.plist"
launchctl print "gui/$(id -u)/com.phoneworkspace.host"
```

The generated plist contains paths and a PATH environment only, not passwords or tokens. Regenerate it after moving the project or changing the Node binary location. Do not also install the same app/connector with a second launchd or Homebrew service.

**Maintenance shutdown:** unload the job first, otherwise the 60-second start interval can restart services you just stopped:

```sh
launchctl bootout "gui/$(id -u)/com.phoneworkspace.host"
npm run local:stop
```

The plist remains on disk for the next login. To disable automatic startup persistently, remove only this app's installed plist after unloading it. Do not remove unrelated LaunchAgents. To resume in the current login, bootstrap the installed plist again.

**Required restart test on the actual host:** after saving work and obtaining any needed reboot authorization, reboot and sign in normally. Confirm services return, the stable URL stays the same, an old browser session is signed out, and the intended phones can be controlled. The owner may need to unlock each phone once after its own restart and handle trust/developer prompts. Do not disable FileVault, automatic-lock protections, or security settings to avoid those steps.

Configure the host's supported energy settings to avoid system sleep while hosting. A dark display is fine; a sleeping Mac does not serve the app reliably. The owner must know that power/network failure, logout, signing expiry, and USB disconnects can still require on-site recovery. Fully unattended operation is not guaranteed by this template.

## 8. Add another iPhone later

A new phone is different from a new host. Do not reinstall the whole app or reuse another phone's UDID.

1. Connect the new phone over USB; unlock, Trust This Computer, enable Developer Mode, and wait for Xcode readiness.
2. Prepare WDA with its actual `--udid`, using the host's existing valid team and bundle configuration. Avoid a competing build/supervisor during signing preparation.
3. Register it in the dashboard. Keep its WDA and MJPEG ports unique; registration allocates available pairs. Do not copy another device's ports blindly.
4. Trust the correct developer profile if prompted and verify that this phone's screen/control works independently of the others.
5. Add its Instagram labels if wanted. Let the owner sign into Instagram on the phone. Phone passcodes are entered locally only.
6. Run a short simultaneous-use test appropriate to the intended fleet. Measure USB stability, memory/CPU, and upload rather than assuming ten live viewers will work because ten phones connect.

## 9. Backups and restoration

Back up before updates and periodically. Source code on GitHub is **not** a backup of local devices, accounts, signing, or the database.

- Store `.env`, `.env.remote`, `devices.json`, the website password record, and named-tunnel credential only in an owner-controlled encrypted backup. Never put these files in the public repo or a source bundle.
- `npm run host:package -- --export-devices` exports source plus a separate passcode-free registry, but that registry still contains private phone identifiers/account labels. Transfer it privately.
- Create logical PostgreSQL backups with the installed PostgreSQL 16 `pg_dump`, reading credentials privately from `.env` into the child process environment. Do not put a password-bearing URL or `PGPASSWORD=value` literal in a shell command/history. Keep dump files under private storage, not source control.
- Back up uploaded assets if the installation uses them. In-memory scroll sessions and website sessions are deliberately not restored.
- A copying strategy for a running `.local/postgres` directory is not a substitute for a supported database backup.
- Test restoration into a separate disposable database/host before relying on it. Validate schema, intended records, and phone registry mapping before switching the application to a restored database. Never drop/clean the active database as an automatic “repair.” Keep the worker disabled unless its scheduled workflows are intentionally requested.
- Rebuild dependencies and driver binaries on a replacement host; reestablish Apple signing and USB trust rather than copying keychains or pairing material as an installation shortcut.

## 10. Updates and rollback

1. Record the deployed Git revision and tool versions privately. Stop active scroll runs deliberately and notify operators about session interruptions.
2. Back up private configuration and the database. If the login LaunchAgent is installed, unload it before stopping or updating services.
3. Stop the workspace. Inspect local code changes; do not use a destructive reset to discard them.
4. Select the reviewed repository revision, run `npm ci --ignore-scripts`, install/review the pinned driver when appropriate, and run checks/audits/build. If migrations are introduced, review and back up before applying them; restoring old code alone may not undo a schema migration.
5. Prepare WDA again if its code, Xcode, signing, or driver changed. Start the app, repeat the physical/public acceptance tests, then restore login startup if used.
6. If validation fails, stop public routing and return to the last reviewed code/configuration and a compatible database. Keep authentication enabled while any route remains public. Diagnose instead of bypassing security or deleting data.

Private diagnostic files live under `.local`; they may include phone identifiers and account information. Review/redact before sharing. Health 200 proves only that the web process answers, not that a specific phone or the whole stack is healthy.

## 11. Handover: definition of complete

A deployment is complete only when the private installation record contains the actual revision, versions, operator URL, auth mode, phone acceptance results, startup choice, successful restart/recovery evidence appropriate to that choice, backup/restore plan, and the person responsible for physical recovery/signing renewal.

Give the owner:

- The actual operator URL and how to share/reset the password privately.
- Start, maintenance-stop, normal-stop, and restart instructions for the chosen mode.
- Which phones and actions were actually verified.
- Whether user login, local phone unlock, signing renewal, or any remaining check is still required.

If the owner has not yet decided to deploy, stop at reviewing this plan. Do not change their domain, install persistence, or move their phones automatically.

## Official references

- [Apple: user agents and background services](https://developer.apple.com/documentation/servicemanagement)
- [Apple: creating launchd jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [Cloudflare: named tunnel tokens](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/)
- [Cloudflare: connector run parameters](https://developers.cloudflare.com/tunnel/reference/run-parameters/)
- [Cloudflare: temporary Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
