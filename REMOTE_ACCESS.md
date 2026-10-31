# Remote access

The Mac hosts the dashboard and controls USB-connected iPhones. Remote operators use the dashboard website, not the Mac desktop. The Mac must remain awake, online, and connected to the phones.

## Regular team access: stable website with a shared password

Follow [AI_SETUP.md](AI_SETUP.md) sections 1–6 for the host and USB phones, then sections 7–9 for password protection and a named Cloudflare tunnel at the approved HTTPS hostname. That is the complete setup sequence for an agent; installing the website alone does not connect phones.

On the configured host:

```sh
npm run local:start
node scripts/cloudflare-tunnel.mjs status
```

Operators open the configured HTTPS address and enter the workspace password. They need no Tailscale, Xcode, Cloudflare account, USB cable, or local app installation on their viewing device. All password holders can view and control every registered enabled phone. Phone controls require USB discovery and a working phone controller on the host.

Keep the host and connector running. `npm run local:stop` stops the app-owned services and remote route. Restarting the backend ends sessions and scroll runs. Configure/test optional login startup using HOST_DEPLOYMENT.md only on the intended host when requested.

To revoke a former operator, set a new website password through the local `npm run demo:password` setup page, reload, and share it only with remaining operators. The command name is historical and also applies to stable access. Shared-password mode does not identify individual people or restrict access by phone.

## Optional: private Tailscale access with named users

Use this only if the owner explicitly prefers a private network and named email allowlists instead of shared-password browser access. Install/sign in to the official Tailscale app on the host and every operator device. Confirm the host is connected.

```sh
npm run remote:enable -- --users owner@example.com,teammate@example.com
```

Replace examples with actual approved Tailscale sign-in emails, including the host owner. The owner handles any HTTPS/Serve approval link. The helper installs named-user authentication before enabling the private HTTPS route. It does not enable Funnel. Open the newly printed `.ts.net` URL with Tailscale connected.

```sh
npm run remote:users -- --users owner@example.com,teammate@example.com
npm run remote:status
npm run remote:off
```

The users command replaces the entire allowlist. Inviting a teammate into Tailscale and allowing that email in the app are separate actions. Do not switch to this provider while a public tunnel is running: stop all public connectors first and review the configuration. The helper refuses to overwrite an unmanaged website-password configuration. Do not force past that guard.

## Optional: an expiring public address

If the owner chooses remote access without a stable hostname, use the optional temporary-address section at the end of AI_SETUP.md. The `demo:start` helper changes remote configuration and reloads the app, so do not run it as a routine startup command for an existing named-tunnel host. Temporary URLs change when recreated. Keep public authentication enabled while any connector runs.
