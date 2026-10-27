import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const state = path.join(root, '.local/cloudflare');
const tokenFile = path.join(state, 'tunnel-token');
const pidFile = path.join(state, 'tunnel.pid');
const marker = path.join(state, 'enabled');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function runningPid() {
    try {
        const pid = Number(fs.readFileSync(pidFile, 'utf8'));
        if (!Number.isSafeInteger(pid) || pid < 2) return null;
        const command = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
        return command.includes('cloudflared') && command.includes(tokenFile) ? pid : null;
    } catch { return null; }
}

export async function startCloudflareTunnel() {
    if (!fs.existsSync(marker)) return;
    const env = fs.readFileSync(path.join(root, '.env.remote'), 'utf8');
    if (!/^PHONE_FARM_AUTH_PLUGIN=\.\/auth\/(?:cloudflare|shared-password)\.ts\s*$/m.test(env)) {
        throw new Error('Cloudflare tunnel was not started: website authentication must be enabled first.');
    }
    for (const headers of [{}, { 'tailscale-user-login': 'owner@example.com', 'cf-access-authenticated-user-email': 'owner@example.com' }]) {
        const response = await fetch('http://127.0.0.1:3000/api/plugins', { headers, signal: AbortSignal.timeout(5000) });
        if (response.status !== 401) throw new Error('Cloudflare tunnel was not started: origin authentication check failed.');
    }
    if (runningPid()) return;
    if (!fs.existsSync(tokenFile) || (fs.statSync(tokenFile).mode & 0o077)) {
        throw new Error('Store the tunnel token privately in .local/cloudflare/tunnel-token with permission 600.');
    }
    const binary = [process.env.PHONE_FARM_CLOUDFLARED_BIN, '/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared']
        .filter(Boolean).find(file => fs.existsSync(file));
    if (!binary) throw new Error('Install cloudflared on this Mac first.');
    const logFile = path.join(state, 'tunnel.log');
    const log = fs.openSync(logFile, 'a', 0o600);
    const offset = fs.statSync(logFile).size;
    const child = spawn(binary, ['tunnel', '--no-autoupdate', 'run', '--token-file', tokenFile], {
        detached: true, stdio: ['ignore', log, log], cwd: root,
    });
    try {
        await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    } finally { fs.closeSync(log); }
    fs.writeFileSync(pidFile, String(child.pid), { mode: 0o600 });
    child.unref();
    for (let i = 0; i < 100; i++) {
        if (!runningPid()) throw new Error('Cloudflare connector stopped; inspect the private tunnel log.');
        const recent = fs.readFileSync(logFile).subarray(offset).toString();
        if (recent.includes('Registered tunnel connection')) {
            console.log('Cloudflare dashboard connector is connected.');
            return;
        }
        await delay(200);
    }
    throw new Error('Connector has not confirmed a connection yet; inspect .local/cloudflare/tunnel.log.');
}

export async function stopCloudflareTunnel() {
    await stopTemporaryTunnel();
    const pid = runningPid();
    if (pid) {
        process.kill(pid, 'SIGTERM');
        for (let i = 0; i < 100 && runningPid(); i++) await delay(100);
        if (runningPid()) throw new Error('Cloudflare connector is still stopping.');
    }
    fs.rmSync(pidFile, { force: true });
}

export async function stopTemporaryTunnel() {
    const recordFile = path.join(state, 'temporary-site.json');
    if (!fs.existsSync(recordFile)) return;
    const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
    if (!Number.isSafeInteger(record.pid) || record.pid < 2) throw new Error('Invalid temporary connector process record.');
    let command = '';
    try { command = execFileSync('/bin/ps', ['-p', String(record.pid), '-o', 'command='], { encoding: 'utf8' }); } catch {}
    if (command.includes('cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000 --logfile .local/cloudflare/temporary-tunnel.log')) {
        process.kill(record.pid, 'SIGTERM');
        for (let i = 0; i < 100; i++) {
            try { process.kill(record.pid, 0); } catch { fs.rmSync(recordFile); return; }
            await delay(100);
        }
        throw new Error('Temporary Cloudflare connector is still stopping.');
    }
    fs.rmSync(recordFile);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const command = process.argv[2] ?? 'status';
    if (command === 'start') await startCloudflareTunnel();
    else if (command === 'stop') await stopCloudflareTunnel();
    else if (command === 'stop-temporary') await stopTemporaryTunnel();
    else if (command === 'status') console.log(`Cloudflare connector: ${runningPid() ? 'running' : 'stopped'}; startup ${fs.existsSync(marker) ? 'enabled' : 'disabled'}`);
    else throw new Error('Use start, stop, stop-temporary, or status.');
}
