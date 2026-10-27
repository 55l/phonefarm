import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const stateDir = path.join(root, '.local');
const configFile = path.join(root, '.env.remote');
const recordFile = path.join(stateDir, 'remote-access.json');
const marker = '# Managed private access: scripts/remote-access.mjs';
fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
function tailscalePath() {
    for (const executable of [process.env.PHONE_FARM_TAILSCALE_BIN, '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'].filter(Boolean)) {
        if (fs.existsSync(executable)) return executable;
    }
    throw new Error('Install the official Tailscale Mac app, sign in, and approve its VPN configuration first.');
}
const ts = tailscalePath();
const json = args => JSON.parse(execFileSync(ts, args, { encoding: 'utf8', timeout: 10000 }));
const run = args => execFileSync(ts, args, { stdio: 'inherit', timeout: 60000 });
const command = process.argv[2] ?? 'status';
function validateUsers(value) {
    const users = [...new Set(value.split(',').map(user => user.trim().toLowerCase()).filter(Boolean))];
    if (!users.length || users.some(user => !/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(user))) throw new Error('Supply complete sign-in emails: --users owner@example.com,teammate@example.com');
    return users;
}
function currentRecord() {
    return fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : null;
}
function writeConfig(url, users) {
    if (fs.existsSync(configFile) && !fs.readFileSync(configFile, 'utf8').startsWith(marker)) throw new Error('An unmanaged .env.remote already exists; review it before changing access.');
    fs.writeFileSync(configFile, `${marker}\nWEB_HOST=127.0.0.1\nPUBLIC_ORIGIN=${url}\nPHONE_FARM_AUTH_PLUGIN=./auth/tailscale.ts\nPHONE_FARM_ALLOWED_USERS=${users.join(',')}\n`, { mode: 0o600 });
    fs.chmodSync(configFile, 0o600);
}
function reload() { execFileSync('npm', ['run', 'local:reload'], { stdio: 'inherit' }); }
function record(value) { fs.writeFileSync(recordFile, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); }
if (command === 'status') {
    const status = json(['status', '--json']);
    console.log(`Tailscale: ${status.BackendState}`);
    const configured = currentRecord();
    const passwordAuth = fs.existsSync(configFile) && /PHONE_FARM_AUTH_PLUGIN=\.\/auth\/shared-password\.ts/.test(fs.readFileSync(configFile, 'utf8'));
    console.log(passwordAuth ? `Dashboard uses shared website password authentication.\nPrivate route: ${configured?.url ?? 'not recorded'}`
        : configured ? `Dashboard: ${configured.url}\nConfiguration: ${configured.state}\nAllowed users: ${configured.users.join(', ')}` : 'Private dashboard access has not been configured.');
    run(['serve', 'status']);
} else if (command === 'enable' || command === 'users') {
    const index = process.argv.indexOf('--users');
    const users = validateUsers(index < 0 ? '' : process.argv[index + 1] ?? '');
    const status = json(['status', '--json']);
    if (status.BackendState !== 'Running') throw new Error('Connect Tailscale before enabling remote access.');
    const owner = status.User?.[String(status.Self?.UserID)]?.LoginName?.toLowerCase();
    if (!owner || !users.includes(owner)) throw new Error('Include this Mac’s current Tailscale sign-in email in --users to avoid locking out the owner.');
    const hostname = status.Self?.DNSName?.replace(/\.$/, '');
    if (!hostname || !/^[a-z0-9.-]+\.ts\.net$/i.test(hostname)) throw new Error('A valid Tailscale MagicDNS hostname is required.');
    const url = `https://${hostname}`;
    const existing = json(['serve', 'status', '--json']);
    if (Object.values(existing.AllowFunnel ?? {}).some(Boolean)) throw new Error('Funnel is enabled. Review and remove public exposure before using this private-access setup.');
    const previous = currentRecord();
    const currentProxy = existing.Web?.[`${hostname}:443`]?.Handlers?.['/']?.Proxy;
    if (existing.TCP?.['443'] && currentProxy !== 'http://127.0.0.1:3000') throw new Error('HTTPS port 443 is assigned to a different service. It was not changed.');
    if (!previous && (Object.keys(existing.TCP ?? {}).length || Object.keys(existing.Web ?? {}).length)) throw new Error('This Mac already has a Serve configuration. Review it before assigning the dashboard port.');
    if (command === 'users' && !previous) throw new Error('Enable remote access before changing its users.');
    writeConfig(url, users);
    record({ url, users, state: 'authentication-configured' });
    reload();
    // Verify authentication is enforced BEFORE creating a network route.
    const anonymous = await fetch('http://127.0.0.1:3000/api/devices');
    if (anonymous.status !== 401) throw new Error('Authentication check failed; private proxy was not enabled.');
    const permitted = await fetch('http://127.0.0.1:3000/api/plugins', { headers: { 'Tailscale-User-Login': owner } });
    if (!permitted.ok) throw new Error('Owner authorization failed; private proxy was not enabled.');
    console.log('Authentication verified. If Tailscale prints an HTTPS enablement link, open and approve it in your own account.');
    run(['serve', '--bg', '--https=443', 'http://127.0.0.1:3000']);
    const enabled = json(['serve', 'status', '--json']);
    const route = enabled.Web?.[`${hostname}:443`]?.Handlers?.['/'];
    if (route?.Proxy !== 'http://127.0.0.1:3000' || enabled.TCP?.['443']?.HTTPS !== true) {
        throw new Error('Serve did not report the expected private HTTPS proxy. Authentication remains enabled.');
    }
    record({ url, users, state: 'proxy-enabled' });
    console.log(`Private dashboard ready: ${url}\nUse Tailscale on each operator device. Access is limited to the listed sign-ins.`);
} else if (command === 'off') {
    const previous = currentRecord();
    if (!previous || !fs.existsSync(configFile) || !fs.readFileSync(configFile, 'utf8').startsWith(marker)) throw new Error('No managed Tailscale-only configuration found. Website authentication was kept in place.');
    const existing = json(['serve', 'status', '--json']);
    const hostname = new URL(previous.url).hostname;
    const currentProxy = existing.Web?.[`${hostname}:443`]?.Handlers?.['/']?.Proxy;
    if (existing.TCP?.['443'] && currentProxy !== 'http://127.0.0.1:3000') throw new Error('HTTPS port 443 is assigned to a different service. It was not changed.');
    run(['serve', '--https=443', 'off']);
    const remaining = json(['serve', 'status', '--json']);
    const otherProxy = Object.values(remaining.Web ?? {}).some(web => Object.values(web.Handlers ?? {}).some(route => /localhost:3000|127\.0\.0\.1:3000/.test(route.Proxy ?? '')));
    if (remaining.TCP?.['443'] || otherProxy) throw new Error('A dashboard proxy is still enabled; authentication was kept in place.');
    fs.renameSync(configFile, path.join(stateDir, 'remote-access-disabled.env'));
    fs.rmSync(recordFile, { force: true });
    reload();
    console.log('Private proxy disabled. Local dashboard restored at http://127.0.0.1:3000.');
} else throw new Error('Use enable --users EMAILS, users --users EMAILS, status, or off.');
