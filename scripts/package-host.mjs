import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
fs.mkdirSync('.local', { recursive: true, mode: 0o700 });
// Explicit source allowlist: no credentials, device registry, installed packages, database, logs, or screenshots.
const entries = ['src', 'static', 'Patches', 'drizzle', 'test', 'scripts', 'docs', '.env.example', '.gitignore',
    'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.web.json', 'drizzle.config.ts', 'docker-compose.yml',
    'README.md', 'AGENTS.md', 'AI_SETUP.md', 'HOST_DEPLOYMENT.md', 'DEVELOPMENT.md', 'REMOTE_ACCESS.md', 'CLOUDFLARE_ACCESS.md', 'NEW_HOST_MAC.md', 'LOCAL_SETUP.md', 'PLUGIN_DEVELOPMENT.md',
    'SECURITY.md', 'LICENSE', 'NOTICE', 'Start Dashboard.command', 'Stop Dashboard.command'].filter(file => fs.existsSync(file));
const output = path.join(root, '.local/instagram-workspace-source.tar.gz');
execFileSync('/usr/bin/tar', ['-czf', output, ...entries]);
fs.chmodSync(output, 0o600);
console.log(`Source bundle (no device credentials): ${output}`);
if (process.argv.includes('--export-devices')) {
    const devices = JSON.parse(fs.readFileSync('devices.json', 'utf8')).map(({ passcode, ...device }) => device);
    const settings = path.join(root, '.local/device-settings-without-passcodes.json');
    fs.writeFileSync(settings, JSON.stringify(devices, null, 2) + '\n', { mode: 0o600 });
    console.log(`Optional device settings, with passcodes removed: ${settings}`);
}
