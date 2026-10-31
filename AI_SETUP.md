# AI setup: connect iPhones and enable remote control

Follow this guide to set up a host Mac, connect physical iPhones over USB, and let the team view and control those phones from other devices through a password-protected website. This is the regular remote-control installation procedure; it is not limited to a demonstration. Execute it in order with the owner available for physical trust and sign-in prompts.

For a **new dedicated hosting Mac or persistent hosted installation**, pair this runbook with **[HOST_DEPLOYMENT.md](HOST_DEPLOYMENT.md)**. That guide covers the deployment decision, stable routing, optional user-login startup, restart/recovery tests, backups, and handover. To add another iPhone to an existing host, use its phone-onboarding section instead of reinstalling the application.

## 0. Understand the deployment

```text
Operator browser → HTTPS Cloudflare tunnel → password-protected dashboard
                                             ↓
                            local Appium / WebDriverAgent → USB iPhone
                                             ↓
                              dedicated local PostgreSQL
```

The phones run Instagram. The Mac coordinates control and forwards screens. Operators need a browser and the shared website password; they do not need Xcode, a USB cable, Tailscale, or a Cloudflare account.

The host Mac must physically have the iPhones connected. Installing the dashboard on Vercel or another cloud website does not replace that Mac or its USB connection. Remote operators visit the host's HTTPS dashboard; their own devices need no USB connection, Xcode, Tailscale, or cloudflared. Phone internet access for Instagram and the Mac's internet connection for remote viewing are separate requirements.

The regular browser-access path below uses a **named Cloudflare tunnel and an approved stable hostname**. Gather the host location, hostname, and owner-controlled Cloudflare account before configuring it. If these are not available, finish local phone setup and report remote routing as pending; do not silently replace the requested setup with an expiring link. An optional temporary-address method is included at the end for owners who choose it. Do not change an existing website, domain delegation, or DNSSEC without authorization for that scope.

Default capabilities: manual control, Instagram launch, account labels, numeric unlock, scroll-only sessions. All people with the website password can access all registered phones. There are no individual operator accounts or per-phone permissions in that mode.

## 1. Inspect before changing anything

1. Read AGENTS.md, this guide, package.json, and the setup scripts.
2. Establish whether this is a fresh Mac, an existing running installation, or a migration. Preserve existing `.env`, `.env.remote`, `devices.json`, and `.local` data.
3. Check macOS, `uname -m`, `node --version`, `npm --version`, `xcode-select -p`, `xcodebuild -version`, and PostgreSQL 16 availability. Check ports 3000, 4725, 55432 and per-phone control/video ports before trying to bind them. Do not stop unrelated services.
4. Determine the owner-provided Apple signing team and bundle ID. Read already-configured identifiers locally if available; do not invent them or publish them.
5. Identify existing remote access before changing it: inspect `.env.remote` privately and run `node scripts/cloudflare-tunnel.mjs status` for a named connector. Use `npm run demo:status` only if a temporary connector is in use. A denied direct localhost request can be expected under remote authentication.
6. Record the intended host, approved HTTPS hostname, operator access model, manual versus automatic startup, and person available to accept phone prompts. The shared-password model gives all password holders access to all phones.

Do not assume a brand-new install has passed the real-device checks below just because another Mac did.

## 2. Prepare the host Mac

Use a normal signed-in macOS user, not root. Use a local project folder outside cloud-synced storage. The Mac must remain powered, awake, online, and connected to its phones. Its signing keychain must be available.

- Install **full Xcode from Apple**, open it, and let the owner complete first-launch/license and Apple-account sign-in prompts. Command Line Tools alone are insufficient.
- In Xcode → Settings → Accounts, add the owner's development account and identify the team. Ensure its certificate/provisioning supports the devices. Team limits and certificate validity depend on the account; do not promise permanent unattended signing.
- Install Homebrew from its official website if needed. Let the owner handle any administrator prompts locally.
- Install the required tools:

  ```sh
  brew install node@24 postgresql@16 cloudflared
  ```

  Follow Homebrew's PATH instructions so `node` resolves to version 24 or later. The PostgreSQL helper detects `/opt/homebrew` on Apple silicon and `/usr/local` on Intel. Do not start a global PostgreSQL service for this app.
- If necessary, select the full Xcode installation:

  ```sh
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  xcode-select -p
  ```

  Adjust the path to the actual installation. Do not ask for the Mac password in chat.

The exercised reference stack was Node 24, PostgreSQL 16, Xcode 26.0.1, XCUITest driver 12.21.0, WebDriverAgent 16.17.5, and a physical iPhone 13 on iOS 17.0. Choose an Xcode/macOS combination supported by the target phone's iOS. A 2018 Intel Mac mini has an OS upgrade ceiling; verify current compatibility before purchasing or upgrading. Larger fleets and iPhone minis have not been capacity-benchmarked here.

## 3. Get this code and install dependencies

```sh
git clone https://github.com/55l/phonefarm.git
cd phonefarm
npm ci --ignore-scripts
npm run appium:install-driver
npm run host:setup
npm run check
npm audit
```

For an existing checkout, inspect its working tree before pulling or replacing files. Do not use a destructive reset to update the host.

The driver installer pins XCUITest 12.21.0, applies dependency overrides inside its bundled dependency tree, and runs its audit. Root overrides alone do not fix bundled copies. Do not substitute a raw latest-driver install. Review unexpected audit failures or version mismatches instead of forcing changes.

`host:setup` creates a random database password, `.env` (600), `.local` (700), an empty `devices.json` (600), and a dedicated PostgreSQL 16 cluster at `.local/postgres`. It listens on `127.0.0.1:55432`, creates the app database, and runs migrations. It preserves existing files and rejects inconsistent database settings. An unrelated database on port 5432 is not this app's database.

An ordinary `.env.example` copy is not a replacement for this helper: its placeholder credentials must not reach a running deployment. Do not print the generated database password.

## 4. Configure signing privately

Edit the generated `.env` locally. Retain the generated database credentials and loopback addresses.

| Variable | Value |
| --- | --- |
| `XCODE_ORG_ID` | Owner's actual Apple Developer Team ID. |
| `WDA_BUNDLE_ID` | A unique development bundle identifier usable by that team, e.g. `com.example.phoneworkspace.WebDriverAgentRunner` after replacing the example namespace. |
| `XCODE_SIGNING_ID` | Normally `Apple Development`. |
| `XCODE_DEVELOPER_DIR` | Full selected Xcode developer directory; the helper supplies it. |
| `IOS_PLATFORM_VERSION` | Deployment minimum compatible with the phone and selected WDA/Xcode; `17.0` was tested. This is not a universal fleet runtime version. |
| `PHONE_FARM_INSTAGRAM_ENABLED` | `true`. |
| `PHONE_FARM_TIKTOK_ENABLED` | `false`. |
| `WEB_HOST`, `APPIUM_HOST` | `127.0.0.1`. |

Do not start a scheduler worker for this guide. An optional `IOS_UDID` pins CLI targeting to one device; omit it for a fleet unless intentional. Use explicit `--udid` values while preparing individual phones.

## 5. Pair and prepare the first iPhone

The owner must perform physical prompts. Do not request a phone passcode or Apple verification code in chat.

1. Connect the phone over a reliable **data-capable USB cable**, unlock it, and accept Trust This Computer on the phone.
2. Enable Settings → Privacy & Security → Developer Mode, including its restart/confirmation if requested.
3. Open Xcode → Window → Devices and Simulators. Wait until it reports the device ready. Do not proceed while it is stuck at Connecting/Preparing.
4. Identify the device locally:

   ```sh
   xcrun xctrace list devices
   ```

   Treat its UDID as local configuration, not public documentation. Ignore simulator entries.
5. Build the control app for that actual device:

   ```sh
   npm run wda:prepare -- --udid YOUR_DEVICE_UDID
   ```

   Replace the placeholder before execution. The preparation script applies the exact WDA 16.17.5 patches with zero fuzz and runs a signed `build-for-testing`. A successful build is not proof that the runner is installed or controlling the phone yet. Do not run a second competing WDA build/supervisor during this step.
6. Start the workspace:

   ```sh
   npm run local:start
   ```

   On a fresh local-only installation open `http://127.0.0.1:3000`. Use **Add a phone** to add the prepared phone with its real UDID and a useful name. Leave optional phone-passcode storage unset unless the owner explicitly wants it. Registration allocates distinct WDA/MJPEG ports; the device service then supervises the signed runner.
7. If the installed runner triggers an untrusted developer prompt, have the owner trust the correct profile under Settings → General → VPN & Device Management. If no profile is shown yet, wait until the runner is installed/launched; the build alone may not create it.
8. Keep the phone unlocked for initial launch. Confirm the dashboard shows it online and its actual screen.

Default first-device ports are WDA control 8100 and MJPEG video 9100. The dashboard is 3000, Appium 4725, database 55432. Keep them private. Additional phones need separate control and video ports, not additional public ports.

## 6. Verify real local phone control

Use harmless deliberate actions and document what actually passed:

- The live image updates, has the correct orientation/aspect ratio, and shows the intended phone.
- Home, one tap, one swipe, and a long press land correctly using the actual screen geometry.
- Open Instagram launches the existing installed Instagram app without resetting its data. The owner handles Instagram sign-in directly on the phone.
- The account directory saves labels. It does not sign into or switch accounts; switching remains manual inside Instagram.
- If unlock is in scope, ask the owner to show the numeric passcode keypad, then enter the code directly in the dashboard's Unlock phone panel. Verify one attempt. **Unlock** is transient; **Save on this Mac** separately persists a copy in `devices.json`, which is owner-only but not encrypted storage. Never retry a failed code automatically.
- If scroll sessions are in scope, deliberately start a short run on the desired Instagram feed, then Stop. It should send only screen-relative swipes. Manual input is blocked during a scroll session to avoid conflicting actions. This is not an operator takeover system. Closing a browser does not stop a run; Stop or backend shutdown does. Runs do not resume after restart.

If a phone is offline, report that local phone control remains unverified. A working website does not prove phone control. Controls are enabled when USB discovery sees the registered phone; a running WDA controller is also needed for images and input.

## 7. Configure website authentication privately

```sh
npm run demo:password
```

The command name is historical: it sets the website password for **both stable and temporary access**; it does not create a tunnel. The command prints a random, local-only setup URL. Open that URL in a browser on the host Mac. Have the owner enter the password twice and Save; use 12–256 characters. Do not inspect the password fields or copy the password into chat, terminal arguments, or documentation.

The setup server exits after success. It stores only a random salt and scrypt hash in `.local/cloudflare/shared-auth.json` (600). This website password is different from iPhone unlock codes and the database password.

If the owner is rotating an existing password, reload the dashboard afterward with `npm run local:reload`. Existing sessions then end. A shared password has no individual attribution: changing it and reloading is how to remove a former operator's access.

## 8. Connect regular remote access with a stable HTTPS address

Complete local phone control and password setup first. Use a dedicated **remotely managed named Cloudflare tunnel**, with the connector running on the same Mac as the dashboard. A tunnel is the route to the app; the app's shared-password provider is the sign-in gate. Creating a tunnel alone does not secure a dashboard.

### 8.1 Prepare the approved hostname and tunnel

1. Have the owner sign in to Cloudflare directly. Use the current Cloudflare One dashboard's Networks / Connectors / Cloudflare Tunnels area to create a named cloudflared tunnel for this host. Navigation labels can change; check the official documentation linked below.
2. Confirm the approved domain's DNS is supported by the account's Cloudflare setup. A domain registered elsewhere can remain registered there. If it is not already configured for Cloudflare, inspect existing website/email records and DNSSEC and obtain authorization for the actual DNS scope before changing it; follow CLOUDFLARE_ACCESS.md. Do not use a remembered domain or hostname from another installation.
3. Store the tunnel connector token locally at `.local/cloudflare/tunnel-token`; directory mode 700, file mode 600. Use a private file editor or owner-controlled entry, never a command containing the token. Do not paste the token into chat, commit it, or run Cloudflare's token-in-command example in a recorded terminal. Do not install a second system connector service: this repository's helper manages this connector.
4. Configure the tunnel's published application route for the approved hostname (for example, `phones.example.com`) to the service **HTTP → `127.0.0.1:3000`**. Leave the path unrestricted so `/api`, `/assets`, `/auth`, and `/devices` reach the app. Do not route video directly to a WDA port or expose Appium, PostgreSQL, or Mac remote desktop. Keep the connector stopped until authentication is verified below. Browser access to the hostname uses HTTPS even though the connector's loopback service uses HTTP.

### 8.2 Enable the app's existing password gate

Back up an existing `.env.remote` privately before deliberately updating it. On a fresh installation, create it with the following values, replacing the example hostname with the actual approved hostname:

```dotenv
WEB_HOST=127.0.0.1
PUBLIC_ORIGIN=https://phones.example.com
PHONE_FARM_AUTH_PLUGIN=./auth/shared-password.ts
PHONE_FARM_PASSWORD_FILE=.local/cloudflare/shared-auth.json
```

Keep `.env.remote` mode 600. Preserve unrelated settings that this host still needs. Review/remove obsolete `PHONE_FARM_TRUSTED_ORIGINS` entries when retiring old routes; never use `*`. If the named connector is already enabled on an existing installation, stop the managed connectors before changing auth or routing and plan the interruption with the owner.

```sh
npm run local:reload
curl --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/api/devices
curl --silent --output /dev/null --write-out '%{http_code}\n' -H 'tailscale-user-login: owner@example.com' -H 'cf-access-authenticated-user-email: owner@example.com' http://127.0.0.1:3000/api/devices
```

Both API requests must return **401**, without device data. Do not start the connector if either request succeeds anonymously. Reloading ends website sessions and scroll runs; it does not change the password.

### 8.3 Start the named connector

Once the token, route, password record, and protected origin are ready:

```sh
chmod 700 .local/cloudflare
chmod 600 .local/cloudflare/tunnel-token .env.remote
# Create this marker only after the preceding authentication checks pass.
touch .local/cloudflare/enabled
chmod 600 .local/cloudflare/enabled
node scripts/cloudflare-tunnel.mjs start
node scripts/cloudflare-tunnel.mjs status
```

The helper checks anonymous/forged-header requests before connecting and reads the token from its private file. Confirm Cloudflare reports the connector healthy. Open the actual HTTPS hostname; it should redirect to the password page with a valid certificate. Do not bypass certificate warnings or disable CSRF to make login work. The shared-password flow does not require an email-based Cloudflare Access policy; individual identity login would be a separate configuration.

Retire any previous temporary connector with `npm run demo:stop` and remove stale trusted origins once cutover works. When moving an existing named tunnel between Macs, stop its old connector before final cutover so requests cannot reach two different hosts. Stop all public routes before restoring any unauthenticated local configuration.

## 9. Verify remote control from another device before calling it complete

From a browser or HTTP client without an existing session:

| Check | Expected |
| --- | --- |
| GET `/` with HTML Accept | Redirect to `/auth/login`. |
| GET `/auth/login` | Password page over valid HTTPS. |
| GET `/api/devices` and a registered phone’s `/api/devices/ACTUAL_UDID/remote/screenshot` without cookies | 401, no phone/account/image data. |
| Fake Tailscale/Cloudflare identity headers | Still 401. |
| Cross-site login POST | 403. |
| Owner enters correct password in browser | Shared phone dashboard opens; actual registered phones appear. |
| Live screen and a harmless phone action | Work on the intended connected phone. |
| Log out → Sign out, then revisit `/` | Password page again; prior session no longer works. |
| Second operator device, Tailscale disconnected | Same password login works. |

Do not read or export browser cookies to impersonate the owner. Have the owner perform the real password test. Automated tests cover session expiry, logout, password hashing behavior, origin checks, and guess limits; still verify a real HTTPS browser session on the deployment.

Session cookies are HttpOnly, Secure, SameSite=Strict, and last six hours. Restarting the backend clears server-side sessions. Plain HTTP localhost is not the remote-password login test because Secure cookies need HTTPS. New code changes should retain these properties.

## 10. Daily startup, additional phones, and recovery

For an already configured named-tunnel installation:

```sh
npm run local:start
node scripts/cloudflare-tunnel.mjs status
```

`local:start` starts the app-owned database, phone controller service, dashboard, and the named connector when `.local/cloudflare/enabled` exists. Operators then open the **same approved HTTPS hostname** and sign in with the workspace password. They do not run commands on their own devices. Keep the Mac awake, powered, online, and attached to the phones.

- `Start Dashboard.command`: convenience shortcut for starting services on the host.
- `npm run local:reload`: load code/config updates; ends website sessions and scroll runs.
- `npm run local:stop`: stop app-owned connectors, dashboard, controllers, and database; all remote access stops.
- `node scripts/cloudflare-tunnel.mjs stop`: stop the managed named and temporary connectors while leaving the dashboard running locally. The enabled marker is retained, so a later `local:start` can start the named connector again.
- `node scripts/cloudflare-tunnel.mjs status`: report the named connector process/enable marker. This alone does not prove public HTTPS or physical phone control; repeat the relevant checks in section 9.

Cloning/configuring this repository does not install automatic startup. If the owner wants it to recover after Mac restart, complete and test **HOST_DEPLOYMENT.md section 7** on the chosen host. The provided LaunchAgent starts after that macOS user signs in; it is not pre-login remote access and does not bypass FileVault, keychain, Apple signing, or phone unlock requirements. Reboot and verify actual remote control before claiming unattended recovery.

For every additional iPhone, repeat section 5 and the physical checks in section 6: connect by data-capable USB, accept Trust, enable Developer Mode, wait for Xcode readiness, prepare the signed runner for the actual UDID, then use **Add a phone**. Registration allocates distinct WDA/MJPEG ports. Add phones one at a time, name them clearly, and check that selecting each tile controls that same physical phone. The grid automatically reflects the registry; changing a number in the UI does not connect more phones. Existing imported registrations can be prepared with `npm run wda:prepare -- --all`. Do not have two Macs supervise the same phone concurrently.

Use a powered data-capable USB hub when needed. Measure CPU, memory, USB reliability, upload bandwidth, and simultaneous video/scroll workloads rather than promising a phone count from Mac specifications. Connected phones, running scroll sessions, and simultaneous remote viewers are separate loads. The dashboard offers low-bandwidth snapshots; its guide is docs/shared-dashboard.md. Follow battery service guidance for damaged or unstable devices.

## 11. Move to a new host

Clone this repository on the new Mac and repeat the prerequisites and setup. Optional source bundles are created with `npm run host:package`. `npm run host:package -- --export-devices` additionally creates a **private** passcode-free registry export containing UDIDs and account handles; never commit it.

Do not copy `node_modules`, `.appium2`, `.wda`, Xcode DerivedData, signing keys, `.env`, tunnel credentials, or the database as an installation shortcut. Set up the new Mac's signing and password independently. If importing the private registry, place it at `devices.json`, chmod 600, and preserve its unique device ports. Set phone passcodes again directly only if requested. Source-only migration does not move historical jobs/media/database contents.

Stop the old host's controller before moving the phones. A named tunnel can keep the approved hostname, but stop the old connector before final cutover so traffic cannot be split between Macs. Verify the new host’s signing, local control, protected HTTPS login, remote actions, and recovery before retiring the old installation.

## 12. Troubleshooting and stop conditions

| Symptom | Next action |
| --- | --- |
| Xcode stuck Connecting | Unlock, reconnect USB, confirm Trust/Developer Mode, inspect Xcode state. A Mac reboot resolved this on the reference host. Let the owner handle administrator actions; do not collect their password. |
| Signing/provisioning error | Check team, bundle ID, certificate/keychain, Xcode account, device support. Do not bypass signing. |
| WDA patch mismatch | Inspect installed driver/WDA versions. Stop instead of fuzzy-patching an unreviewed version. |
| Driver audit fails | Review bundled dependency findings; do not ignore the failure or run npm audit fix --force blindly. |
| Port occupied | Identify the owner; do not kill a process solely by port. |
| PostgreSQL helper rejects config | Preserve data; inspect `.env` consistency, cluster version, and dedicated port. Never erase the cluster to proceed. |
| Device offline but dashboard works | Check physical USB/power, device trust, runner, per-phone ports, and private WDA/Appium logs. |
| Remote API or localhost returns 401 | Authentication is working; use the active HTTPS browser URL and password. |
| Login returns 403 | Check PUBLIC_ORIGIN / exact trusted origins. Do not disable CSRF or use wildcard origins. |
| Password fails repeatedly | Check Caps Lock/password privately; honor the temporary guess limit. Reset via the local setup page and reload if the owner chooses. |
| Stable URL unavailable | Check host power/network, local dashboard health, named connector status/logs, Cloudflare tunnel health, route hostname, and DNS/certificate status. Do not replace it with a random link without the owner choosing that. |
| Remote site works but video does not | Verify phone online and WDA's MJPEG stream locally before blaming Cloudflare; then test the authenticated public stream. |

Keep diagnostics private. Logs may contain phone identifiers or app data. Never publish environment files, token files, saved passcodes, screenshots, browser sessions, or full local process/environment dumps.

## Completion report template

Report the actual URL, authentication mode and named/private/temporary routing, tests/audits run, specific physical phone actions verified, and anything still blocked. Record each phone’s local and remote verification separately. State whether startup is manual or login-based and what still requires someone physically present. Never include the password or make a ten-phone performance claim without measurements.

## Optional: remote access without a stable hostname

Only use this when the owner explicitly chooses an expiring address instead of the stable route above:

```sh
npm run demo:password  # Skip if a valid workspace password already exists.
npm run demo:start
npm run demo:status
```

These historical `demo:*` helpers configure the same shared-password remote-control application through a temporary Cloudflare Quick Tunnel. They are not necessary for a named tunnel, and `demo:start` should not be run against a configured stable installation: it changes the remote origin/auth configuration and reloads the app. The printed address changes when recreated and has no uptime guarantee. Start Dashboard does not recreate temporary connectors. Stop one with `npm run demo:stop`. No owned domain or Tailscale is required for this optional route; no DNS changes are needed. Verify login, video, and a real phone action exactly as in section 9.

## Official references

- [Apple: run an app on a device](https://help.apple.com/xcode/mac/current/en.lproj/dev5a825a1ca.html)
- [Apple: Xcode requirements](https://developer.apple.com/xcode/system-requirements)
- [Appium: parallel iOS sessions](https://appium.github.io/appium-xcuitest-driver/latest/guides/parallel-tests/)
- [Cloudflare: create a named tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/)
- [Cloudflare: Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Homebrew](https://brew.sh)
