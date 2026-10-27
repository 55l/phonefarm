import type { AuthProvider } from '../plugin.js';

export function parseAllowedUsers(value: string): Set<string> {
    const users = value.split(',').map(user => user.trim().toLowerCase()).filter(Boolean);
    if (users.some(user => !/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(user))) {
        throw new Error('PHONE_FARM_ALLOWED_USERS must contain complete sign-in email addresses.');
    }
    return new Set(users);
}

/** Trust identity headers only from the local Tailscale Serve proxy. Never bind this backend to a LAN interface. */
export function createTailscaleAuth(value = process.env.PHONE_FARM_ALLOWED_USERS ?? ''): AuthProvider {
    const allowed = parseAllowedUsers(value);
    return {
        id: 'local.tailscale-team',
        registerRoutes() {
            if (!allowed.size) throw new Error('Set PHONE_FARM_ALLOWED_USERS before enabling remote access.');
        },
        isPublicPath: path => path === '/health',
        async authenticate(request, reply) {
            const address = request.raw.socket.remoteAddress;
            if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '')) {
                await reply.code(403).send({ error: 'Access must come through the private dashboard proxy.' });
                return null;
            }
            const header = request.headers['tailscale-user-login'];
            if (typeof header !== 'string') {
                if (request.headers.accept?.includes('text/html')) {
                    await reply.code(401).type('text/html').send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private workspace</title></head><body style="font:16px system-ui;max-width:620px;margin:80px auto;padding:24px"><h1>Open your private workspace address</h1><p>Connect Tailscale and use this Mac’s HTTPS dashboard address. Direct localhost access is disabled while team access is enabled.</p><p>Ask the workspace owner to add your Tailscale sign-in email if access is denied.</p></body></html>');
                }
                return null;
            }
            const login = header.trim().toLowerCase();
            if (!allowed.has(login)) {
                await reply.code(403).send({ error: 'Your sign-in is not on this workspace’s access list. Contact the owner.' });
                return null;
            }
            return { id: login, email: login, roles: ['operator'] };
        },
    };
}

export default createTailscaleAuth();
