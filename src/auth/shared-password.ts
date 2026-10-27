import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AuthProvider } from '../plugin.js';
import type { ServerResponse } from 'node:http';

const cookieName = '__Host-phone-workspace';
const sessionDuration = 6 * 60 * 60 * 1000;
export interface PasswordRecord { version: 1; salt: string; hash: string }

export async function hashPassword(password: string, salt: string): Promise<Buffer> {
    return await new Promise((resolve, reject) => scryptCallback(password, Buffer.from(salt, 'hex'), 64,
        { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
        (error, key) => error ? reject(error) : resolve(key)));
}

export async function createPasswordRecord(password: string): Promise<PasswordRecord> {
    if (password.length < 12 || password.length > 256) throw new Error('Use a password between 12 and 256 characters.');
    const salt = randomBytes(32).toString('hex');
    return { version: 1, salt, hash: (await hashPassword(password, salt)).toString('hex') };
}

const page = (message = '', logout = false) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Phone Workspace</title><style>body{margin:0;background:#10141c;color:#edf2f7;font:16px system-ui;min-height:100vh;display:grid;place-items:center}main{width:min(360px,calc(100% - 64px));padding:32px;background:#1b2331;border-radius:18px}h1{font-size:26px}p{color:#bac6d7;line-height:1.5}label{display:block;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;padding:14px;border-radius:9px;font:inherit}input{background:#10141c;color:white;border:1px solid #566278}button{margin-top:18px;background:#9ad5c4;color:#11251f;border:0;cursor:pointer}.error{color:#ffb4b4}</style></head><body><main><h1>Phone Workspace</h1><p>${logout ? 'Sign out of this browser?' : 'Enter your team’s password to access the phones.'}</p>${message ? `<p class="error" role="alert">${message}</p>` : ''}<form method="post" action="/auth/${logout ? 'logout' : 'login'}">${logout ? '' : '<label for="password">Password</label><input id="password" name="password" type="password" required maxlength="256" autocomplete="current-password" autofocus>'}<button type="submit">${logout ? 'Sign out' : 'Sign in'}</button></form></main></body></html>`;

export function createSharedPasswordAuth(options: { record?: PasswordRecord; now?: () => number } = {}): AuthProvider {
    let record: PasswordRecord;
    const now = options.now ?? Date.now;
    const sessions = new Map<string, number>();
    const streams = new Map<string, Set<ServerResponse>>();
    const attempts = new Map<string, { count: number; until: number }>();
    let globalAttempts = { count: 0, until: 0 };
    let inFlight = 0;
    const digest = (token: string) => createHash('sha256').update(token).digest('hex');
    const revoke = (key: string) => {
        sessions.delete(key);
        for (const stream of streams.get(key) ?? []) stream.destroy();
        streams.delete(key);
    };
    const sessionKey = (token: unknown) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? digest(token) : '';
    const prune = () => {
        for (const [key, expiry] of sessions) if (expiry <= now()) revoke(key);
        for (const [key, value] of attempts) if (value.until <= now()) attempts.delete(key);
    };
    return {
        id: 'local.shared-password', logoutPath: '/auth/logout',
        isPublicPath: path => ['/health', '/auth/login', '/auth/logout'].includes(path),
        async registerRoutes(app) {
            record = options.record ?? JSON.parse(await readFile(process.env.PHONE_FARM_PASSWORD_FILE ?? '.local/cloudflare/shared-auth.json', 'utf8'));
            if (record.version !== 1 || !/^[a-f0-9]{64}$/.test(record.salt) || !/^[a-f0-9]{128}$/.test(record.hash)) {
                throw new Error('Set a valid website password before enabling shared-password access.');
            }
            app.addHook('preClose', async () => { for (const key of sessions.keys()) revoke(key); });
            app.addHook('onRequest', async (request, reply) => {
                if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.raw.socket.remoteAddress ?? '')) {
                    await reply.code(403).send({ error: 'Use the dashboard tunnel.' });
                }
            });
            app.addHook('onSend', async (_request, reply) => {
                reply.header('cache-control', 'no-store');
                reply.header('x-content-type-options', 'nosniff');
                reply.header('referrer-policy', 'same-origin');
            });
            const sendPage = (reply: import('fastify').FastifyReply, message = '', logout = false) => {
                reply.header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
                return reply.type('text/html').send(page(message, logout));
            };
            app.get('/auth/login', async (_request, reply) => sendPage(reply));
            app.post<{ Body: { password?: unknown } }>('/auth/login', { bodyLimit: 4096 }, async (request, reply) => {
                prune();
                const ipHeader = request.headers['cf-connecting-ip'];
                const ip = typeof ipHeader === 'string' && ipHeader.length <= 64 ? ipHeader : request.ip;
                const perIp = attempts.get(ip) ?? { count: 0, until: now() + 15 * 60 * 1000 };
                if (globalAttempts.until <= now()) globalAttempts = { count: 0, until: now() + 60000 };
                if (perIp.count >= 5 || globalAttempts.count >= 30 || inFlight >= 2 || attempts.size >= 10000) {
                    reply.header('retry-after', '900').code(429);
                    return sendPage(reply, 'Too many attempts. Please try again later.');
                }
                perIp.count++; globalAttempts.count++; attempts.set(ip, perIp);
                const password = request.body?.password;
                let valid = false;
                if (typeof password === 'string' && password.length >= 12 && password.length <= 256) {
                    inFlight++;
                    try { valid = timingSafeEqual(await hashPassword(password, record.salt), Buffer.from(record.hash, 'hex')); }
                    finally { inFlight--; }
                }
                if (!valid) return sendPage(reply.code(401), 'That password wasn’t recognized.');
                attempts.delete(ip);
                if (sessions.size >= 1000) revoke(sessions.keys().next().value!);
                const token = randomBytes(32).toString('hex');
                sessions.set(digest(token), now() + sessionDuration);
                reply.setCookie(cookieName, token, { secure: true, httpOnly: true, sameSite: 'strict', path: '/', maxAge: sessionDuration / 1000 });
                return reply.code(303).redirect('/');
            });
            app.get('/auth/logout', async (_request, reply) => sendPage(reply, '', true));
            app.post('/auth/logout', async (request, reply) => {
                revoke(sessionKey(request.cookies[cookieName]));
                reply.clearCookie(cookieName, { secure: true, httpOnly: true, sameSite: 'strict', path: '/' });
                return reply.code(303).redirect('/auth/login');
            });
        },
        async authenticate(request, reply) {
            const key = sessionKey(request.cookies[cookieName]);
            const expiry = sessions.get(key);
            if (expiry && expiry > now()) {
                if (request.url.split('?')[0]?.endsWith('/remote/stream')) {
                    const active = streams.get(key) ?? new Set<ServerResponse>();
                    active.add(reply.raw); streams.set(key, active);
                    const timer = setTimeout(() => revoke(key), expiry - now());
                    timer.unref();
                    reply.raw.once('close', () => {
                        clearTimeout(timer); active.delete(reply.raw);
                        if (!active.size) streams.delete(key);
                    });
                }
                return { id: 'team-operator', roles: ['operator'] };
            }
            if (expiry) revoke(key);
            if (request.headers.accept?.includes('text/html')) await reply.code(303).redirect('/auth/login');
            return null;
        },
    };
}

export default createSharedPasswordAuth();
