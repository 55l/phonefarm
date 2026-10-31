# Instructions for AI assistants

Read **AI_SETUP.md** before installing, configuring, or exposing this application. That runbook is the source of truth for this customized checkout. The older architecture/plugin documents are reference material; they are not the default installation procedure.

If the owner chooses a new hosting machine or persistent hosting, also follow **HOST_DEPLOYMENT.md** and complete its private installation record. Its startup template is optional and must be installed and reboot-tested on the chosen host only after deployment is requested. Do not infer authorization to change DNS or install persistence from the existence of the guide. Adding a new iPhone alone uses the phone-onboarding section and does not require reinstalling the host.

- Follow the user's current scope. The main setup path is USB phone control plus password-protected browser remote access, using a stable approved hostname and a named Cloudflare tunnel for regular team use. Establish the target Mac and hostname before configuring access. A temporary URL is optional, not the default installation outcome. Do not infer permission to change nameservers, DNSSEC, an existing website, or startup persistence from a documentation request.
- Keep PostgreSQL, Appium, WebDriverAgent, and the dashboard origin bound to loopback. Install and verify website authentication before opening a public route.
- Never ask for passwords, phone passcodes, signing keys, tunnel tokens, or verification codes in chat. Use the local password setup page. Have the user handle account sign-ins, Apple trust/developer prompts, and applicable agreement acceptance directly.
- Never commit `.env*` except `.env.example`, `devices.json`, `.local`, `.appium2`, `.wda`, database files, logs, screenshots, account exports, or Apple signing material. A device-settings export without passcodes still contains private identifiers and handles.
- Preserve LICENSE, NOTICE, and source copyright attribution. User-facing promotional branding can be changed without removing these notices.
- Use `npm ci --ignore-scripts` and the reviewed driver installer. Do not replace it with an unpinned Appium install or apply WDA patches with fuzz. Review a version mismatch instead of forcing it through.
- Preserve existing local configuration and databases. Do not delete, reinitialize, or overwrite them to make a setup command pass. Inspect a port conflict before changing another application's service.
- Instagram is the default; leave TikTok and the scheduler worker disabled unless the user specifically requests those workflows.
- Phone control requires a physical device check. Health endpoints and unit tests are insufficient evidence. Do not run a prolonged scroll session, switch accounts, or perform social actions as an incidental setup test.
- Edit browser TypeScript under `static/dashboard/ts`; rebuild generated assets with `npm run build:web`. Run `npm run check` and appropriate dependency audits. Do not claim an end-to-end check happened unless it actually did.
- Shared-password sessions end on backend restart. Explain an expected sign-in interruption when reloading a running installation. Temporary connector addresses change when recreated.
- Ask only for genuinely missing information or actions the user must perform. Do not infer additional approval requirements from this document; continue work already authorized by the user and applicable tool policies.
- Before publishing, inspect the exact staged files for secrets and machine-specific information. Never push local data or copy another host's credentials into a fresh installation.

When reporting setup completion, include the actual operator URL, which authentication mode is active, the phone actions actually verified, and any remaining user action or limitation. Distinguish website availability, verified physical phone control, remote control from another device, and unattended recovery.
