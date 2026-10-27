# End-to-end setup runbook for AI assistants

This guide installs **this customized repository**, prepares physical iPhones, verifies Instagram control, and creates a temporary password-protected public demo. It is intended to be executed in order by an AI assistant working with the owner of the Mac and phones.

## 0. Understand the deployment

```text
Operator browser → HTTPS Cloudflare tunnel → password-protected dashboard
                                             ↓
                            local Appium / WebDriverAgent → USB iPhone
                                             ↓
                              dedicated local PostgreSQL
```

The phones run Instagram. The Mac coordinates control and forwards screens. Operators need a browser and the shared website password; they do not need Xcode, a USB cable, Tailscale, or a Cloudflare account.

For a **temporary demo**, do not ask for a domain and do not change DNS, DNSSEC, the registrar, or an existing Vercel website. A temporary `https://...trycloudflare.com` URL is sufficient. A custom domain is a separate optional deployment described in CLOUDFLARE_ACCESS.md.

Default capabilities: manual control, Instagram launch, account labels, numeric unlock, scroll-only sessions. All people with the website password can access all registered phones. There are no individual operator accounts or per-phone permissions in that mode.

## 1. Inspect before changing anything

1. Read AGENTS.md, this guide, package.json, and the setup scripts.
2. Establish whether this is a fresh Mac, an existing running installation, or a migration. Preserve existing `.env`, `.env.remote`, `devices.json`, and `.local` data.
3. Check macOS, `uname -m`, `node --version`, `npm --version`, `xcode-select -p`, `xcodebuild -version`, and PostgreSQL 16 availability. Check ports 3000, 4725, 55432 and per-phone control/video ports before trying to bind them. Do not stop unrelated services.
4. Determine the owner-provided Apple signing team and bundle ID. Read already-configured identifiers locally if available; do not invent them or publish them.
5. If remote access is already configured, inspect the active auth provider and `npm run demo:status`. A denied direct localhost request can be expected under remote authentication.

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

   On a fresh local-only installation open `http://127.0.0.1:3000`. Use Register device to add the prepared phone with its real UDID and a useful name. Leave optional phone-passcode storage unset unless the owner explicitly wants it. Registration allocates distinct WDA/MJPEG ports; the device service then supervises the signed runner.
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
- If scroll sessions are in scope, deliberately start a short run on the desired Instagram feed, then Stop. It should send only screen-relative swipes. Manual input is blocked while a run owns the phone. Closing a browser does not stop a run; Stop or backend shutdown does. Runs do not resume after restart.

If a phone is offline, report that local phone control remains unverified. A working website can still be demonstrated, but do not represent it as a live control test.

## 7. Set the shared website password privately

```sh
npm run demo:password
```

The command prints a random, local-only setup URL. Open that URL in a browser on the host Mac. Have the owner enter the password twice and Save; use 12–256 characters. Do not inspect the password fields or copy the password into chat, terminal arguments, or documentation.

The setup server exits after success. It stores only a random salt and scrypt hash in `.local/cloudflare/shared-auth.json` (600). This website password is different from iPhone unlock codes and the database password.

If the owner is rotating an existing password, reload the dashboard afterward with `npm run local:reload`. Existing sessions then end. A shared password has no individual attribution: changing it and reloading is how to remove a former operator's access.

## 8. Start the temporary public demo

Make sure public access is within the user's authorized scope; honor actual tool confirmation requirements. Do not add an unnecessary domain/account onboarding flow.

```sh
npm run demo:start
npm run demo:status
```

The helper:

1. Requires the password record and writes the shared-password auth configuration to `.env.remote` (600).
2. Reloads the web service and checks that anonymous and forged-identity-header API requests return 401 **before** creating a public route.
3. Starts the official cloudflared connector on this Mac, obtains a random `trycloudflare.com` HTTPS URL, and records its verified process ID privately.
4. Configures the exact public origin so browser login/control writes pass the same-origin guard, then reloads and checks protection again.
5. Prints the actual URL for the operator. Use that value; do not reuse a URL from another host or a past session.

Reloading signs out existing sessions and cancels active scroll sessions. If a running installation has custom remote settings, review the helper before applying it; its previous `.env.remote` is backed up privately as `.local/cloudflare/before-demo.env`. Do not restore an unauthenticated backup while any public tunnel remains.

A Cloudflare account, owned domain, Tailscale, router port forwarding, and DNS changes are **not required**. The temporary service has no uptime guarantee, supports up to 200 in-flight requests, and does not support SSE. The dashboard's live video is MJPEG; real streaming still needs a phone test. A new tunnel gets a new URL. See Cloudflare's current Quick Tunnel documentation if behavior or limits change.

If cloudflared refuses a quick tunnel because another local `config.yml` is present, inspect that configuration; do not delete another application's tunnel settings. Use an isolated configuration according to the installed connector's official documentation.

## 9. Verify public access before calling it complete

From a browser or HTTP client without an existing session:

| Check | Expected |
| --- | --- |
| GET `/` with HTML Accept | Redirect to `/auth/login`. |
| GET `/auth/login` | Password page over valid HTTPS. |
| GET `/api/devices` | 401, no phone/account data. |
| Fake Tailscale/Cloudflare identity headers | Still 401. |
| Cross-site login POST | 403. |
| Owner enters correct password in browser | Devices dashboard opens. |
| Live screen and a harmless phone action | Work on the intended connected phone. |
| Log out → Sign out, then revisit `/` | Password page again; prior session no longer works. |
| Second operator device, Tailscale disconnected | Same password login works. |

Do not read or export browser cookies to impersonate the owner. Have the owner perform the real password test. Automated tests cover session expiry, logout, password hashing behavior, origin checks, and guess limits; still verify a real HTTPS browser session on the deployment.

Session cookies are HttpOnly, Secure, SameSite=Strict, and last six hours. Restarting the backend clears server-side sessions. Plain HTTP localhost is not the remote-password login test because Secure cookies need HTTPS. New code changes should retain these properties.

## 10. Daily operations and additional phones

- `Start Dashboard.command` or `npm run local:start`: starts app-owned database/control/web services. The shortcut opens the active URL where known.
- `Stop Dashboard.command` or `npm run local:stop`: stops app-owned temporary/named connectors and services. It does not stop unrelated databases or apps.
- `npm run local:reload`: reloads web/backend code without deliberately restarting WDA; ends website sessions and scroll runs.
- `npm run demo:stop`: stops only the managed temporary connector; leaves authentication enabled.
- `npm run demo:start`: starts a fresh demo after a stop. Share the newly printed URL; the old bookmark expires.

A temporary quick tunnel is not automatically recreated at login or by Start Dashboard. Starting the Mac does not start the dashboard either. Do not promise unattended recovery until an explicit startup/recovery solution has been implemented and tested.

For each extra phone, repeat pairing, Developer Mode, signing/preparation, registration, and real-device checks. Use powered USB hubs with sufficient power and data capacity. Check unique WDA/MJPEG ports in the private registry. For already-registered imported phones, `npm run wda:prepare -- --all` builds for all targets. Do not have two Macs supervise one phone concurrently.

Connected-phone count, simultaneous scroll commands, simultaneous live viewers, and operator count are different workloads. Measure CPU, memory, USB reliability, and upload before claiming a fleet capacity. Keep devices ventilated and follow battery service guidance for damaged or unstable devices.

## 11. Move to a new host

Clone this repository on the new Mac and repeat the prerequisites and setup. Optional source bundles are created with `npm run host:package`. `npm run host:package -- --export-devices` additionally creates a **private** passcode-free registry export containing UDIDs and account handles; never commit it.

Do not copy `node_modules`, `.appium2`, `.wda`, Xcode DerivedData, signing keys, `.env`, tunnel credentials, or the database as an installation shortcut. Set up the new Mac's signing and password independently. If importing the private registry, place it at `devices.json`, chmod 600, and preserve its unique device ports. Set phone passcodes again directly only if requested. Source-only migration does not move historical jobs/media/database contents.

Stop the old host's controller before moving the phones. The new temporary demo gets a new URL. Verify the new host before retiring the old one. For a stable named tunnel, stop the old connector before final cutover so traffic cannot be split between two Macs.

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
| Old demo URL unavailable | Run demo:status. Restart with demo:start if stopped; share the new URL. |
| Remote site works but video does not | Verify phone online and WDA's MJPEG stream locally before blaming Cloudflare; then test the authenticated public stream. |

Keep diagnostics private. Logs may contain phone identifiers or app data. Never publish environment files, token files, saved passcodes, screenshots, browser sessions, or full local process/environment dumps.

## Completion report template

Report the actual URL, shared-password/private/named-access mode, tests/audits run, specific physical phone actions verified, and anything still blocked. State whether the host must be manually started after reboot. Never include the password or make a ten-phone performance claim without measurements.

## Official references

- [Apple: run an app on a device](https://help.apple.com/xcode/mac/current/en.lproj/dev5a825a1ca.html)
- [Apple: Xcode requirements](https://developer.apple.com/xcode/system-requirements)
- [Appium: parallel iOS sessions](https://appium.github.io/appium-xcuitest-driver/latest/guides/parallel-tests/)
- [Cloudflare: Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Homebrew](https://brew.sh)
