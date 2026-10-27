import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPhoneControl, stopPhoneControl } from './local-phone-control.mjs';
import { postgresBin } from './host-paths.mjs';
import { startCloudflareTunnel, stopCloudflareTunnel } from './cloudflare-tunnel.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const state = path.join(root, '.local');
const pgCtl = postgresBin('pg_ctl');
const dbArgs = ['-D', path.join(state, 'postgres')];
const pidFile = path.join(state, 'dashboard.pid');
const entrypoint = path.join(root, 'src/api/server.ts');
const url = 'http://127.0.0.1:3000';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let command = process.argv[2] ?? 'start';
function dashboardPid() {
    try {
        const pid = Number(fs.readFileSync(pidFile, 'utf8'));
        if (!Number.isInteger(pid) || pid < 2) return null;
        const args = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
        return args.includes(entrypoint) ? pid : null;
    } catch { return null; }
}
if (command === 'reload') {
    const pid = dashboardPid();
    if (pid) {
        process.kill(pid, 'SIGTERM');
        for (let i = 0; i < 300 && dashboardPid(); i++) await delay(100);
        if (dashboardPid()) throw new Error('Dashboard is still shutting down.');
    }
    fs.rmSync(pidFile, { force: true });
    command = 'start';
}
if (command === 'stop') {
    await stopCloudflareTunnel();
    const pid = dashboardPid();
    if (pid) {
        process.kill(pid, 'SIGTERM');
        for (let i = 0; i < 300 && dashboardPid(); i++) await delay(100);
        if (dashboardPid()) throw new Error('Dashboard is still shutting down; database left running.');
    }
    fs.rmSync(pidFile, { force: true });
    await stopPhoneControl();
    if (fs.existsSync(path.join(state, 'postgres/postmaster.pid'))) {
        execFileSync(pgCtl, [...dbArgs, 'stop', '-m', 'fast'], { stdio: 'inherit' });
    }
    console.log('Phone Farm dashboard and its private database stopped.');
} else if (command === 'start') {
    await startPhoneControl();
    if (dashboardPid()) {
        await startCloudflareTunnel();
        console.log(`Dashboard already running: ${url}`);
        process.exit(0);
    }
    // Fail before starting if another app owns the dashboard port.
    const net = await import('node:net');
    await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', reject);
        probe.listen(3000, '127.0.0.1', () => probe.close(resolve));
    });
    if (!fs.existsSync(path.join(state, 'postgres/postmaster.pid'))) {
        execFileSync(pgCtl, [...dbArgs, '-l', path.join(state, 'postgres.log'), 'start'], { stdio: 'inherit' });
    }
    execFileSync('npm', ['run', 'build:web'], { stdio: 'inherit' });
    const log = fs.openSync(path.join(state, 'dashboard.log'), 'a', 0o600);
    const child = spawn(process.execPath, ['--env-file=.env', '--env-file-if-exists=.env.remote', '--import', 'tsx', entrypoint], {
        cwd: root, detached: true, stdio: ['ignore', log, log],
        env: { ...process.env, WEB_HOST: '127.0.0.1', WEB_PORT: '3000' },
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    fs.closeSync(log);
    fs.writeFileSync(pidFile, String(child.pid), { mode: 0o600 });
    child.unref();
    for (let i = 0; i < 100; i++) {
        try {
            const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
            if (response.ok) {
                await startCloudflareTunnel();
                console.log(`Phone Farm dashboard ready: ${url}`);
                process.exit(0);
            }
        } catch {}
        if (!dashboardPid()) break;
        await delay(200);
    }
    throw new Error('Dashboard did not start. See .local/dashboard.log.');
} else {
    throw new Error('Use start or stop.');
}
