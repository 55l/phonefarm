import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { postgresBin } from './host-paths.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (process.platform !== 'darwin' || process.getuid?.() === 0) throw new Error('Run this as your normal signed-in Mac user, not with sudo.');
const version = Number(process.versions.node.split('.')[0]);
if (version < 24) throw new Error('Use Node.js 24 or newer.');
const pgCtl = postgresBin('pg_ctl');
const initdb = postgresBin('initdb');
const developerDir = execFileSync('xcode-select', ['-p'], { encoding: 'utf8' }).trim();
if (!developerDir.includes('.app/Contents/Developer')) throw new Error('Install full Xcode and select it with xcode-select before setup.');
fs.mkdirSync('.local', { recursive: true, mode: 0o700 });
fs.chmodSync('.local', 0o700);
if (!fs.existsSync('.env')) {
    const password = crypto.randomBytes(32).toString('hex');
    let config = fs.readFileSync('.env.example', 'utf8').replaceAll('CHANGE_ME', password)
        .replace('127.0.0.1:5432/phone_farm', '127.0.0.1:55432/phone_farm');
    config += `\nPOSTGRES_PORT=55432\nPUBLIC_ORIGIN=http://127.0.0.1:3000\nXCODE_DEVELOPER_DIR=${developerDir}\n`;
    fs.writeFileSync('.env', config, { mode: 0o600 });
}
fs.chmodSync('.env', 0o600);
process.loadEnvFile('.env');
const database = new URL(process.env.DATABASE_URL ?? '');
const user = process.env.POSTGRES_USER ?? 'phone_farm';
const name = process.env.POSTGRES_DB ?? 'phone_farm';
const password = process.env.POSTGRES_PASSWORD;
const port = Number(process.env.POSTGRES_PORT ?? 55432);
if (database.hostname !== '127.0.0.1' || Number(database.port) !== port || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('This helper supports only the dedicated loopback database with a matching POSTGRES_PORT.');
if (!password || password === 'CHANGE_ME' || decodeURIComponent(database.password) !== password || decodeURIComponent(database.username) !== user || database.pathname !== `/${name}`) throw new Error('Database URL and POSTGRES settings must match; replace placeholder credentials.');
if (!/^[a-z_][a-z0-9_]*$/.test(user) || !/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Use simple lowercase database/user names.');
const data = path.join(root, '.local/postgres');
if (fs.existsSync(path.join(data, 'PG_VERSION')) && fs.readFileSync(path.join(data, 'PG_VERSION'), 'utf8').trim() !== '16') throw new Error('An existing database needs a reviewed version migration. It was not changed.');
if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const pwFile = path.join(root, '.local/initdb-password');
    fs.writeFileSync(pwFile, password, { mode: 0o600 });
    try {
        execFileSync(initdb, ['-D', data, '-U', user, `--pwfile=${pwFile}`, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C'], { stdio: 'inherit' });
    } finally { fs.rmSync(pwFile, { force: true }); }
    fs.appendFileSync(path.join(data, 'postgresql.conf'), `\n# Dedicated workspace database\nlisten_addresses = '127.0.0.1'\nport = ${port}\nunix_socket_directories = ''\n`);
}
try { execFileSync(pgCtl, ['-D', data, 'status'], { stdio: 'ignore' }); }
catch { execFileSync(pgCtl, ['-D', data, '-l', path.join(root, '.local/postgres.log'), 'start'], { stdio: 'inherit' }); }
const { Client } = await import('pg');
const adminUrl = new URL(database); adminUrl.pathname = '/postgres';
const client = new Client({ connectionString: adminUrl.href });
await client.connect();
try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
    if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}"`);
} finally { await client.end(); }
execFileSync('npm', ['run', 'db:migrate'], { stdio: 'inherit' });
if (!fs.existsSync('devices.json')) fs.writeFileSync('devices.json', '[]\n', { mode: 0o600 });
fs.chmodSync('devices.json', 0o600);
fs.writeFileSync('.local/phone-control-enabled', '');
console.log('Dedicated host database and local configuration are ready. Set your Apple team and WDA bundle ID in .env, install the iPhone driver, then prepare each phone.');
