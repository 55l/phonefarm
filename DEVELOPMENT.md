# Editing your Instagram workspace

This checkout is customized for Instagram control and scroll-only sessions on your iPhone 13.
When remote access is enabled, use the actual HTTPS URL printed by demo:start (or the configured private/named URL). Otherwise use http://127.0.0.1:3000. Start and stop it with the two Dashboard
shortcuts in this folder. The scheduler worker stays stopped.

## Main files

| Change | File |
| --- | --- |
| Device page layout, wording, buttons | `static/dashboard/templates/device.html` |
| Taps, swipes, long presses, video, account editor | `static/dashboard/ts/device.ts` |
| Colors, typography, phone preview sizing | `static/dashboard/styles.css` |
| Devices page | `static/dashboard/templates/index.html` |
| Instagram launcher, account directory, and scroll-session API | `src/instagram-plugin.ts` |
| Doomscroll timer, cancellation, and screen-relative swipes | `src/instagram/doomscroll.ts` |
| Which app plugins are loaded | `src/api/server.ts` |
| Hardware model names | `src/devices/coordinates.ts` |

Open this folder in your code editor, or ask Codex to make a specific change.
Edit the TypeScript in `static/dashboard/ts`, not the generated JavaScript in
`static/dashboard/assets`.

After editing:

```sh
npm run check
npm run local:stop
npm run local:start
```

Starting the dashboard builds the browser code. Reload the browser to get the
new page and assets. Restarting briefly disconnects live control; it does not
remove Instagram or erase phone data.

## Instagram and accounts

`src/instagram-plugin.ts` provides app launch, a local directory of
handles, and immediate scroll-only sessions. It does not schedule posts or perform engagement actions. The launcher uses the installed Instagram
app (`com.burbn.instagram`) and does not reset its login or app data.

Saved handles are stored per phone in the `local.instagram` section of
`devices.json`. They are labels for your reference, not verified login sessions.
Add, edit, or remove them in the Account directory and press Save account list.
Switch actual accounts through Instagram on the live screen. Long presses are
supported. Enter passwords and verification codes on the phone.

The iPhone 13 is identified as `iPhone14,5`. Manual control reads its actual
390 × 844 point screen and maps clicks to the image rectangle, clamping them to
screen bounds. It does not use the old iPhone 8 TikTok coordinate map. No guessed
Instagram automation coordinates have been added.

Defaults: Instagram plugin enabled, TikTok disabled. `.env` controls these with
`PHONE_FARM_INSTAGRAM_ENABLED` and `PHONE_FARM_TIKTOK_ENABLED`. Leave TikTok off
for this workspace. The old TikTok implementation remains isolated in its
original source files, so future upgrades can be compared with upstream.

## Branding and local data

The visible Handler/Agniverse links and promotional footer have been removed.
The neutral title is Instagram Workspace. Original LICENSE and NOTICE files
and source copyright notices remain with the code.

`.env`, `devices.json`, and `.local` contain local configuration/data and are
ignored by Git. Keep services on 127.0.0.1. Do not put phone passcodes or account
passwords in source files or Git commits.

## Instagram doomscroll

Open the Instagram Home or Reels feed you want to browse. Set a duration
(1–180 minutes) and a reading interval (2–30 seconds), then press Start doomscroll.
The current signed-in account is used; the account directory does not switch it.
Stop cancels the reading pause and prevents further swipes after an in-flight
phone command finishes. Manual remote input and another app launch are blocked
while a session owns the device.

Sessions run inside the dashboard process and need no scheduler worker. Closing
the browser does not stop a session; press Stop or stop the dashboard. Dashboard
shutdown cancels sessions and closes their Appium connection. Sessions also stop
if Instagram leaves the foreground or device commands fail. Runs are not resumed
after a server restart, and their status is not stored as scheduled jobs.

Only vertical swipes are sent, derived from the actual screen geometry. No
likes, saves, comments, follows, account switches, or posts are performed.

## Phone passcode and unlocking

The Unlock phone panel supports an immediate numeric-passcode attempt or an
explicit saved copy on this Mac. Unlock does not save the entered code. Save on
this Mac stores it using the existing owner-only devices.json file; Forget saved
code removes that local copy without changing the actual iPhone passcode. Saved
codes are never returned by the API, prefilled, or shown. The local file is not
an encrypted password vault.

Unlock reads the live iOS passcode keypad through WDA accessibility data. It
requires ten visible, unambiguous digit keys and an empty secure passcode field,
uses their actual rectangles, checks the expected passcode length, and verifies
that the device became unlocked. It makes one attempt and does not automatically
retry an incorrect code. This replaces the old iPhone 8 coordinate assumption.
Only numeric passcodes are supported. If the keypad cannot be recognized, show
it manually and retry; no guessed-keypad fallback is used.

`src/devices/passcode-keypad.ts` detects keys and
`src/devices/wda-remote.ts` performs the unlock. Dashboard lock state reports
only locked and hasPasscode flags. To apply web/backend edits without restarting
WDA on a locked phone, use `npm run local:reload`.

## Remote access architecture

Remote browsers connect to the dashboard on this Mac; Appium/WDA then control
phones connected to the Mac by USB. Keep the Mac awake and phones connected.
A private VPN with an HTTPS service proxy can provide a remote dashboard URL.
Tailscale Serve supports this architecture with tailnet access controls:
https://tailscale.com/docs/features/tailscale-serve

The origin remains loopback-only. Shared website-password authentication is in
`src/auth/shared-password.ts`; the default public demo is managed by
`scripts/demo-access.mjs`. Tailscale and signed Cloudflare Access providers are
optional alternatives. A fresh clone contains no passwords or deployment URLs.
All shared-password holders have access to all phones; there are no individual
operator permissions in that mode. See AI_SETUP.md and CLOUDFLARE_ACCESS.md.

## Host migration and private team access

See REMOTE_ACCESS.md for operator devices, invitations, and the allowlist.
See NEW_HOST_MAC.md to install the customized app on a new hosting Mac.
Use `npm run host:package -- --export-devices` to prepare the code bundle and
optional device settings with passcodes removed.
