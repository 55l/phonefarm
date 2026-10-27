import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { AuthProvider } from '../plugin.js';
import { parseAllowedUsers } from './tailscale.js';

interface CloudflareAuthOptions {
    issuer?: string;
    audience?: string;
    users?: string;
    /** Allows offline signature tests without contacting Cloudflare. */
    verificationKey?: JWTVerifyGetKey;
}

/** Verify Access signatures and claims; never trust an email header alone. */
export function createCloudflareAuth(options: CloudflareAuthOptions = {}): AuthProvider {
    const issuer = options.issuer ?? process.env.CLOUDFLARE_ACCESS_ISSUER ?? '';
    const audience = options.audience ?? process.env.CLOUDFLARE_ACCESS_AUD ?? '';
    const allowed = parseAllowedUsers(options.users ?? process.env.PHONE_FARM_ALLOWED_USERS ?? '');
    let key: JWTVerifyGetKey | undefined;
    return {
        id: 'local.cloudflare-team',
        logoutPath: '/cdn-cgi/access/logout',
        registerRoutes() {
            if (!/^https:\/\/[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(issuer)) {
                throw new Error('CLOUDFLARE_ACCESS_ISSUER must be your HTTPS Cloudflare Access team address, without a trailing slash.');
            }
            if (!audience.trim() || !allowed.size) throw new Error('Configure CLOUDFLARE_ACCESS_AUD and PHONE_FARM_ALLOWED_USERS before enabling access.');
            key = options.verificationKey ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
                timeoutDuration: 5000,
                cooldownDuration: 30000,
            });
        },
        isPublicPath: path => path === '/health',
        async authenticate(request, reply) {
            const address = request.raw.socket.remoteAddress;
            if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '')) {
                await reply.code(403).send({ error: 'Access must come through the local dashboard tunnel.' });
                return null;
            }
            const token = request.headers['cf-access-jwt-assertion'];
            if (typeof token !== 'string' || token.length > 16384 || !key) return null;
            let email: string;
            try {
                const { payload } = await jwtVerify(token, key, {
                    issuer, audience, algorithms: ['RS256'],
                    requiredClaims: ['exp', 'iat', 'sub', 'email'],
                });
                if (payload.type !== 'app' || typeof payload.email !== 'string') return null;
                email = payload.email.trim().toLowerCase();
            } catch {
                // Never log assertions or allow a verification/network failure through.
                return null;
            }
            if (!allowed.has(email)) {
                await reply.code(403).send({ error: 'Your sign-in is not on this workspace’s access list. Contact the owner.' });
                return null;
            }
            return { id: email, email, roles: ['operator'] };
        },
    };
}

export default createCloudflareAuth();
