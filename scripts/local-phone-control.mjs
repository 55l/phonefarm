import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const state = path.join(root, '.local');
const entrypoint = path.join(root, 'node_modules/appium/index.js');
const pidFile = path.join(state, 'appium.pid');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function managedPid() {
    try {
        const pid = Number(fs.readFileSync(pidFile, 'utf8'));
        if (!Number.isInteger(pid) || pid < 2) return null;
        const args = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
        return args.includes(entrypoint) ? pid : null;
    } catch { return null; }
}
export async function startPhoneControl() {
    if (!fs.existsSync(path.join(state, 'phone-control-enabled'))) return;
    if (!managedPid()) {
        const net = await import('node:net');
        await new Promise((resolve, reject) => {
            const probe = net.createServer();
            probe.once('error', reject);
            probe.listen(4725, '127.0.0.1', () => probe.close(resolve));
        });
        const log = fs.openSync(path.join(state, 'appium.log'), 'a', 0o600);
        const child = spawn(process.execPath, [entrypoint, '--address', '127.0.0.1', '--base-path', '/', '--port', '4725', '--log-level', 'info'], {
            cwd: root, env: { ...process.env, APPIUM_HOME: path.join(root, '.appium2') },
            detached: true, stdio: ['ignore', log, log],
        });
        await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
        fs.closeSync(log);
        fs.writeFileSync(pidFile, String(child.pid), { mode: 0o600 });
        child.unref();
    }
    for (let i = 0; i < 50; i++) {
        try {
            const response = await fetch('http://127.0.0.1:4725/status', { signal: AbortSignal.timeout(1000) });
            if (response.ok) {
                const config = path.join(root, 'devices.json');
                if (fs.existsSync(config) && JSON.parse(fs.readFileSync(config, 'utf8')).some(device => !device.disabled)) {
                    execFileSync(process.execPath, ['--env-file=.env', '--import', 'tsx', 'src/devices/start-wda-service.ts'], { cwd: root, stdio: 'inherit' });
                }
                return;
            }
        } catch {}
        if (!managedPid()) break;
        await delay(200);
    }
    throw new Error('Phone control server is not ready. See .local/appium.log.');
}
export async function stopPhoneControl() {
    // The service owns only this workspace's registered-device supervisors.
    execFileSync(process.execPath, ['--env-file=.env', '--import', 'tsx', 'src/devices/stop-wda-service.ts'], { cwd: root, stdio: 'inherit' });
    const pid = managedPid();
    if (pid) {
        process.kill(pid, 'SIGTERM');
        for (let i = 0; i < 100 && managedPid(); i++) await delay(100);
        if (managedPid()) throw new Error('Phone control server is still shutting down.');
    }
    fs.rmSync(pidFile, { force: true });
}
