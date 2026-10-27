import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createCloudflareAuth } from '../src/auth/cloudflare.js';
import { createApp } from '../src/api/app.js';
import { PluginRegistry } from '../src/registry.js';
import type { SchedulerRepository } from '../src/scheduler/repository.js';
import { inject } from './support.js';

test('Cloudflare Access checks signatures, claims, allowlist, and proxy boundary', async context => {
    const issuer = 'https://test-team.cloudflareaccess.com';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256' };
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as SchedulerRepository,
        authProvider: createCloudflareAuth({ issuer, audience: 'dashboard', users: 'owner@example.com',
            verificationKey: createLocalJWKSet({ keys: [jwk] }) }) });
    context.after(() => app.close());
    const sign = (claims: Record<string, unknown> = {}, signingKey = privateKey) => new SignJWT({
        type: 'app', email: 'owner@example.com', iss: issuer, aud: ['dashboard'], sub: 'owner',
        iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, ...claims,
    }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(signingKey);
    const request = (token?: string, remoteAddress?: string) => inject(app, { method: 'GET', url: '/api/plugins',
        remoteAddress, headers: token ? { 'cf-access-jwt-assertion': token } : {} });
    assert.equal((await request()).statusCode, 401);
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins', headers: {
        'cf-access-authenticated-user-email': 'owner@example.com', 'tailscale-user-login': 'owner@example.com',
    } })).statusCode, 401);
    assert.equal((await request(await sign())).statusCode, 200);
    assert.equal((await request(await sign({ email: 'other@example.com' }))).statusCode, 403);
    for (const claims of [{ exp: 1 }, { aud: ['another-app'] }, { iss: 'https://attacker.example' },
        { type: 'org' }, { email: null }, { nbf: Math.floor(Date.now() / 1000) + 600 }]) {
        assert.equal((await request(await sign(claims))).statusCode, 401);
    }
    const otherKey = await generateKeyPair('RS256');
    assert.equal((await request(await sign({}, otherKey.privateKey))).statusCode, 401);
    assert.equal((await request('not-a-token')).statusCode, 401);
    assert.equal((await request(await sign(), '10.0.0.1')).statusCode, 403);
    assert.equal((await inject(app, { method: 'GET', url: '/health' })).statusCode, 200);
});

test('Cloudflare configuration fails closed before serving', async () => {
    for (const options of [{ issuer: 'https://attacker.example', audience: 'a', users: 'owner@example.com' },
        { issuer: 'https://team.cloudflareaccess.com', audience: '', users: 'owner@example.com' },
        { issuer: 'https://team.cloudflareaccess.com', audience: 'a', users: '' }]) {
        await assert.rejects(createApp({ plugins: new PluginRegistry([]), scheduler: {} as SchedulerRepository,
            authProvider: createCloudflareAuth(options) }), /CLOUDFLARE_ACCESS/);
    }
});
