import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
let url = 'http://127.0.0.1:3000';
const file = path.join(root, '.local/remote-access.json');
if (fs.existsSync(file)) {
    const configured = new URL(JSON.parse(fs.readFileSync(file, 'utf8')).url);
    if (configured.protocol !== 'https:' || !configured.hostname.endsWith('.ts.net') || configured.username || configured.password || configured.port) throw new Error('Invalid private dashboard address.');
    url = configured.origin;
}
const remoteConfig = path.join(root, '.env.remote');
if (fs.existsSync(remoteConfig)) {
    const origin = fs.readFileSync(remoteConfig, 'utf8').match(/^PUBLIC_ORIGIN=(https:\/\/[^\s]+)\s*$/m)?.[1];
    if (origin) {
        const configured = new URL(origin);
        if (configured.username || configured.password) throw new Error('Invalid dashboard origin.');
        url = configured.origin;
    }
}
const temporary = path.join(root, '.local/cloudflare/temporary-site.json');
if (fs.existsSync(temporary)) {
    try {
        const record = JSON.parse(fs.readFileSync(temporary, 'utf8'));
        if (Number.isSafeInteger(record.pid) && record.pid > 1 && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(record.url)) {
            const command = execFileSync('/bin/ps', ['-p', String(record.pid), '-o', 'command='], { encoding: 'utf8' });
            if (command.includes('cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000 --logfile .local/cloudflare/temporary-tunnel.log')) url = record.url;
        }
    } catch { /* A stopped temporary tunnel is not a usable bookmark. */ }
}
execFileSync('open', [url]);
console.log(url);
