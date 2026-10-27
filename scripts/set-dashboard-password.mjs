import http from 'node:http';
import fs from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../.local/cloudflare/', import.meta.url));
const setupPath = `/${randomBytes(24).toString('hex')}`;
let origin;
const html = message => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set workspace password</title><style>body{font:16px system-ui;max-width:440px;margin:70px auto;padding:24px}input,button{display:block;box-sizing:border-box;width:100%;padding:12px;margin:10px 0 24px;font:inherit}p{line-height:1.5}</style></head><body><h1>Set your workspace password</h1><p>Choose one password to share with your team. Use at least 12 characters. Everyone with this password can access all phones.</p>${message ? `<p role="alert">${message}</p>` : ''}<form method="post"><label>Password<input name="password" type="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><label>Confirm password<input name="confirm" type="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><button>Save password</button></form></body></html>`;
const server = http.createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (request.url !== setupPath || request.headers.host !== new URL(origin).host) { response.writeHead(404).end(); return; }
    if (request.method === 'GET') { response.end(html()); return; }
    if (request.method !== 'POST' || request.headers.origin !== origin) { response.writeHead(403).end(); return; }
    let body = '';
    try {
        for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > 4096) { response.writeHead(413).end(); return; }
        }
        const fields = new URLSearchParams(body);
        const password = fields.get('password') ?? '';
        if (password.length < 12 || password.length > 256 || password !== fields.get('confirm')) {
            response.writeHead(400).end(html('Use at least 12 characters and make sure both entries match.')); return;
        }
        const salt = randomBytes(32).toString('hex');
        const hash = scryptSync(password, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        const target = `${directory}shared-auth.json`;
        const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
        await fs.writeFile(temporary, JSON.stringify({ version: 1, salt, hash }) + '\n', { mode: 0o600, flag: 'wx' });
        await fs.rename(temporary, target);
        response.end('<!doctype html><title>Password saved</title><h1>Password saved</h1><p>You can close this tab. Your password was stored as a salted hash.</p>');
        console.log('Website password saved privately. No plaintext password was stored. Reload the dashboard to apply it.');
        server.close();
    } catch { response.writeHead(500).end('Unable to save password. Please restart setup and try again.'); }
});
server.listen(0, '127.0.0.1', () => {
    origin = `http://127.0.0.1:${server.address().port}`;
    console.log(`Set the website password locally: ${origin}${setupPath}`);
});
