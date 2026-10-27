import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stopTemporaryTunnel } from './cloudflare-tunnel.mjs';
import { demoReachable } from './demo-health.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const state = path.join(root, '.local/cloudflare');
const recordFile = path.join(state, 'temporary-site.json');
const configFile = path.join(root, '.env.remote');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(state, { recursive: true, mode: 0o700 });

function current() {
    try {
        const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
        if (!Number.isSafeInteger(record.pid) || record.pid < 2 || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(record.url)) return null;
        const command = execFileSync('/bin/ps', ['-p', String(record.pid), '-o', 'command='], { encoding: 'utf8' });
        return command.includes('cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000 --logfile .local/cloudflare/temporary-tunnel.log') ? record : null;
    } catch { return null; }
}
function reload() { execFileSync('npm', ['run', 'local:reload'], { stdio: 'inherit' }); }
function writeConfig(origin, trusted = '') {
    fs.writeFileSync(configFile, `# Managed website password access\nWEB_HOST=127.0.0.1\nPUBLIC_ORIGIN=${origin}\nPHONE_FARM_AUTH_PLUGIN=./auth/shared-password.ts\nPHONE_FARM_PASSWORD_FILE=.local/cloudflare/shared-auth.json\n${trusted ? `PHONE_FARM_TRUSTED_ORIGINS=${trusted}\n` : ''}`, { mode: 0o600 });
    fs.chmodSync(configFile, 0o600);
}
async function checkProtection() {
    for (const headers of [{}, { 'tailscale-user-login': 'owner@example.com', 'cf-access-authenticated-user-email': 'owner@example.com' }]) {
        // Do not reuse a socket across the backend reloads performed by this CLI.
        const response = await fetch('http://127.0.0.1:3000/api/plugins', { headers: { connection: 'close', ...headers }, signal: AbortSignal.timeout(5000) });
        if (response.status !== 401) throw new Error('The origin must reject anonymous and forged-header requests before a demo tunnel starts.');
    }
}
const command = process.argv[2] ?? 'status';
if (command === 'status') {
    const record = current();
    console.log(record ? await demoReachable(record.url)
        ? `Temporary demo: ${record.url}\nUse the shared website password. No domain or Tailscale is required.`
        : 'Temporary connector exists, but its public URL is unavailable. Run npm run demo:start to replace it.'
        : 'No managed temporary demo is running.');
} else if (command === 'stop') {
    await stopTemporaryTunnel();
    console.log('Temporary demo connector stopped. Website password authentication remains enabled.');
} else if (command === 'start') {
    if (!fs.existsSync(path.join(state, 'shared-auth.json'))) throw new Error('Set your website password first: npm run demo:password');
    const existing = current();
    if (existing) {
        const config = fs.readFileSync(configFile, 'utf8');
        if (!/^PHONE_FARM_AUTH_PLUGIN=\.\/auth\/shared-password\.ts\s*$/m.test(config)) throw new Error('Restore shared-password authentication before using this demo.');
        await checkProtection();
        if (await demoReachable(existing.url)) {
            // Repair a stale origin left by an interrupted setup before reusing the URL.
            const publicOrigin = config.match(/^PUBLIC_ORIGIN=([^\n]+)/m)?.[1]?.trim();
            const trustedOrigins = config.match(/^PHONE_FARM_TRUSTED_ORIGINS=([^\n]*)/m)?.[1]?.split(',').map(value => value.trim()) ?? [];
            if (publicOrigin !== existing.url && !trustedOrigins.includes(existing.url)) {
                writeConfig(existing.url, publicOrigin?.startsWith('https://') ? publicOrigin : '');
                reload();
                await checkProtection();
            }
            console.log(`Temporary demo already running: ${existing.url}`);
            process.exit(0);
        }
        console.log('The previous temporary URL is unavailable; replacing its connector.');
        await stopTemporaryTunnel();
    }
    const before = fs.existsSync(configFile) ? fs.readFileSync(configFile, 'utf8') : '';
    const backup = path.join(state, 'before-demo.env');
    if (before && !fs.existsSync(backup)) fs.writeFileSync(backup, before, { mode: 0o600 });
    const oldOrigin = before.match(/^PUBLIC_ORIGIN=(https:\/\/[^\s]+)\s*$/m)?.[1];
    const trusted = before.match(/^PHONE_FARM_TRUSTED_ORIGINS=([^\n]*)/m)?.[1]?.trim() ?? '';
    // Authentication is installed and verified before creating any public route.
    writeConfig(oldOrigin ?? 'http://127.0.0.1:3000', trusted);
    reload();
    await checkProtection();
    const binary = [process.env.PHONE_FARM_CLOUDFLARED_BIN, '/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared'].filter(Boolean).find(file => fs.existsSync(file));
    if (!binary) throw new Error('Install the official connector: brew install cloudflared');
    const launchFile = path.join(state, 'temporary-launch.log');
    const log = fs.openSync(launchFile, 'w', 0o600);
    fs.chmodSync(launchFile, 0o600);
    const child = spawn(binary, ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:3000', '--logfile', '.local/cloudflare/temporary-tunnel.log'], {
        detached: true, stdio: ['ignore', log, log], cwd: root,
    });
    try { await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); }
    finally { fs.closeSync(log); }
    child.unref();
    let url;
    try {
        for (let i = 0; i < 225; i++) {
            url = fs.readFileSync(launchFile, 'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
            if (url) break;
            try { process.kill(child.pid, 0); } catch { throw new Error('Temporary connector exited; inspect the private launch log.'); }
            await delay(200);
        }
        if (!url) throw new Error('No temporary URL was issued within 45 seconds.');
        fs.writeFileSync(recordFile, JSON.stringify({ url, pid: child.pid, createdAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 });
        const origins = new Set(trusted.split(',').filter(Boolean));
        if (oldOrigin && oldOrigin !== url && !new URL(oldOrigin).hostname.endsWith('.trycloudflare.com')) origins.add(oldOrigin);
        for (const origin of origins) if (new URL(origin).hostname.endsWith('.trycloudflare.com')) origins.delete(origin);
        writeConfig(url, [...origins].join(','));
        reload();
        await checkProtection();
        let reachable = false;
        // New quick-tunnel names can take time to reach the host's DNS cache.
        for (let i = 0; i < 120; i++) {
            if (await demoReachable(url)) { reachable = true; break; }
            await delay(1000);
        }
        if (!reachable) throw new Error('Cloudflare issued a URL, but the public password page is not reachable yet. Inspect the private launch log and retry.');
        console.log(`Temporary password-protected demo: ${url}\nNo DNS change or Tailscale is required. Keep the Mac awake. The URL changes when a new tunnel is created.`);
    } catch (error) {
        try { process.kill(child.pid, 'SIGTERM'); } catch {}
        fs.rmSync(recordFile, { force: true });
        throw error;
    }
} else throw new Error('Use start, stop, or status.');
