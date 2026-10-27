# Remote access

The Mac hosts the dashboard and controls USB-connected iPhones. Remote operators use the dashboard website, not the Mac desktop. The Mac must remain awake, online, and connected to the phones.

## Default: temporary website with a shared password

Follow [AI_SETUP.md](AI_SETUP.md), sections 7–9, after local phone control works:

```sh
npm run demo:password
npm run demo:start
npm run demo:status
```

Set the password in the printed localhost setup page, not in chat or shell arguments. Operators open the actual HTTPS URL printed by demo:start and enter that password. They do not need Tailscale, Xcode, a Cloudflare account, or an owned domain. All password holders can control all registered phones.

The URL changes when the temporary tunnel is recreated. There is no uptime guarantee. `npm run demo:stop` stops that connector; `npm run local:stop` stops the whole workspace. Keep the password provider enabled while any public tunnel exists. Restarting the web service ends sessions and scroll runs.

To revoke a former operator, set a new website password, reload, and share it only with remaining operators. Shared-password mode does not identify individual people or limit access by phone.

## Optional: private Tailscale access with named users

Use this only if the owner explicitly prefers a private network and named email allowlists instead of the public demo. Install/sign in to the official Tailscale app on the host and every operator device. Confirm the host is connected.

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

## Optional: stable public hostname

See [CLOUDFLARE_ACCESS.md](CLOUDFLARE_ACCESS.md). This is not necessary for temporary demos and must not change an unrelated website or DNS setup without the owner's explicit request.
