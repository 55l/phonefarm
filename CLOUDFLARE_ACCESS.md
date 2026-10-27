# Password-protected Cloudflare access

## Temporary demo — no domain required

First complete local phone setup in [AI_SETUP.md](AI_SETUP.md). Install the official connector with `brew install cloudflared`.

```sh
npm run demo:password
npm run demo:start
npm run demo:status
```

The password command opens a local-only setup flow for the owner. Use 12–256 characters, keep it out of chat, and save it. Only a salted scrypt hash is stored in `.local/cloudflare/shared-auth.json`, permission 600.

The start command enables the shared-password auth provider and verifies anonymous/forged-header requests fail before starting a public connector. It captures the random HTTPS URL, configures the exact allowed origin, and prints the address to share. Use the actual printed URL; there is no fixed demo URL in source code. No owned domain, registrar, DNS, DNSSEC, Vercel change, or Tailscale is needed.

```sh
npm run demo:stop
```

This stops the temporary connector while retaining website authentication. Stop Dashboard also stops it. A new demo:start after a stop creates a new URL. Start Dashboard alone does not recreate quick tunnels; run demo:start explicitly. The host and connector must remain running. Cloudflare Quick Tunnels have no uptime guarantee, a 200 in-flight request limit, and no SSE support. The app's live screen uses MJPEG, which still needs a real connected-phone verification.

Private state/logs live under `.local/cloudflare`. Do not publish them. A previous remote configuration may be backed up as `before-demo.env`; do not restore an unauthenticated configuration while any public connector exists.

## Website login behavior

- All password holders can control all registered phones.
- Session cookies are Secure, HttpOnly, SameSite=Strict, and expire after six hours.
- Sessions are held in the backend, are revoked by logout, and end when the backend restarts. Live streams associated with an ended session close.
- Repeated guesses are limited per client, globally, and by concurrent password checks.
- Login/control writes must come from the configured exact public origin; do not bypass CSRF or use wildcard origins.
- To rotate the password, run demo:password and local:reload. Give the new password only to authorized operators.

## Optional stable hostname

Use this section only after an explicit request for a custom domain. Temporary demos do not require any of it.

1. Have the owner identify the domain/subdomain and sign in to the required accounts directly. Decide who can access the phones and whether shared-password mode remains appropriate.
2. Review existing DNS, website, email, and DNSSEC records before changing delegation. Cloudflare Free full-zone setup generally requires Cloudflare nameservers; using only selected records with an external authoritative provider requires a supported partial setup/plan. Verify current provider requirements.
3. Back up and preserve every website/email record. A website hosted on Vercel can remain hosted there while DNS management changes; keep its existing routing unless the owner requests otherwise.
4. Coordinate DNSSEC: inspect the old DS TTL, remove the old DS appropriately, and allow old trust records to expire before changing nameservers. After Cloudflare activation, enable its DNSSEC and publish its new DS at the registrar. Do not apply a remembered timer from another domain.
5. Create a dedicated named tunnel in Cloudflare. Store its connector token only in `.local/cloudflare/tunnel-token` (600), with its directory 700. Never put it in chat, Git, or shared docs.
6. Publish only the chosen hostname to `http://127.0.0.1:3000`. Never expose PostgreSQL, Appium, WDA, or Mac remote desktop ports. In shared-password mode, the application itself enforces sign-in; do not attach an unrelated email Access policy.
7. Before running the connector, set private `.env.remote`:

   ```dotenv
   WEB_HOST=127.0.0.1
   PUBLIC_ORIGIN=https://phones.example.com
   PHONE_FARM_AUTH_PLUGIN=./auth/shared-password.ts
   PHONE_FARM_PASSWORD_FILE=.local/cloudflare/shared-auth.json
   ```

   Replace the example hostname. Keep the file 600. Reload and verify anonymous API access returns 401.
8. Create `.local/cloudflare/enabled` after configuring the private token. Run `node scripts/cloudflare-tunnel.mjs start`. The helper checks origin protection before connecting. `status` and `stop` manage the connector; Stop Dashboard stops both named and temporary connectors.
9. Verify valid HTTPS, shared-password login, live video/control, logout, and the unchanged existing website/email routes. Retire the temporary connector and remove stale temporary trusted origins when moving to the stable hostname.

The source includes an optional signed Cloudflare Access JWT provider at `src/auth/cloudflare.ts`, for a separately configured email/identity deployment. It is not used by the default shared-password demo.

## New Mac and rollback

Follow [NEW_HOST_MAC.md](NEW_HOST_MAC.md). A fresh temporary demo gets a fresh URL. A named tunnel can retain its hostname, but stop the old connector before final cutover so traffic is not split between Macs. Recreate signing and passwords privately; never migrate credentials through the public repository.

For rollback, stop public connectors before changing auth providers. Keep original DNS records and coordinate DNSSEC again if reverting delegation. Do not restore an old unauthenticated `.env.remote` while any public path still forwards to the dashboard.

## References

- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Cloudflare DNSSEC](https://developers.cloudflare.com/dns/dnssec/)
- [Cloudflare partial DNS setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/)
