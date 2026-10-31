# Shared phone dashboard

This is a shared browser interface for controlling USB-connected iPhones through a host Mac. It uses its own workspace password.

Everyone signed in with the workspace password can see and control every enabled phone. There are no operator assignments, takeover requests, or active-user indicators. Avoid issuing conflicting input to the same phone; inputs from different browsers affect the same physical screen.

## Everyday use

1. Start the host following AI_SETUP.md or HOST_DEPLOYMENT.md. For regular remote access, complete AI_SETUP.md sections 7–9 once, then use the configured HTTPS hostname. An expiring address is an optional alternative.
2. Sign in with the existing phone workspace password. Password creation still requires at least 12 characters.
3. **Phone dashboard** shows every registered phone, with connected screens live together. The grid adjusts to the actual registry size; five phones is a layout target, not a limit or prepopulated inventory.
4. Search by phone name or saved Instagram handle, filter by connection state, or choose larger tiles. **Low bandwidth** uses still screenshots refreshed about every five seconds. **Pause previews** stops this browser’s grid previews. These choices do not stop scroll sessions on the phones.
5. Choose **Controls** to open that phone’s live controller beside the grid. Tap or drag its screen, open Instagram, manage account labels, unlock, or start/stop doomscroll using the existing controls. Closing the panel ends its extra preview; it does not stop a running scroll session.
6. **Account directory** lists saved Instagram handle labels across phones. Manage accounts opens the corresponding phone’s account form. Labels neither sign in nor change Instagram’s active account.
7. **Connections** enables or pauses supervision of a registered phone. Pausing is a workspace-wide setting affecting all viewers. **Add a phone** opens the existing onboarding flow; follow the physical-device checks in AI_SETUP.md. Each phone needs distinct control/video ports.

The count of **Connected** phones reflects USB discovery, not proof that every live video/controller is healthy. If a preview is unavailable, unlock the phone, check its USB connection, and use Refresh phones or Reconnect in its controls. Offline devices remain in the registry and are shown as needing attention. The scrolling count updates from actual scroll-session state.

## Performance and shared viewing

Each live tile opens a video stream, and the selected controller opens an additional stream. More phones and more viewing browsers increase host and upload work. Use low-bandwidth mode when viewing many phones or on a weak connection. When using plain HTTP locally, only the first four connected tiles stream live; additional tiles use snapshots to leave browser connections available for controls and status requests. The HTTPS remote dashboard does not apply this local limit. Background tabs release grid previews and resume when visible. Refreshing status keeps existing live images mounted so the video is not restarted every five seconds.

No five-phone physical-device load test is implied by the layout. Verify actual capacity on the intended host and network. Existing numeric unlock and scroll-session input guards remain in effect.

## Maintaining the interface

- `static/dashboard/templates/index.html`: dashboard shell and navigation.
- `static/dashboard/ts/workspace.ts`: fleet grid, account directory, filters, previews, and controller panel.
- `static/dashboard/styles.css`: shared dashboard styling and embedded controller layout.
- `static/dashboard/ts/device.ts`: existing physical-phone controller.
- `src/auth/shared-password.ts`: shared login and its matching visual style. Do not replace authentication with a client-side PIN check.
- `static/dashboard/fonts`: locally hosted IBM Plex Sans and Rajdhani fonts, with their OFL license notices.

Edit TypeScript sources and run `npm run build:web`, then `npm run check`. Dashboard template and script changes require a backend reload (`npm run local:reload`) because they are loaded at startup. Reloading ends shared-password sessions, so operators must sign in again. Temporary tunnel links are replaced when the connector is recreated. Do not change DNS to refresh a temporary demo.
