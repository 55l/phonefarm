import assert from 'node:assert/strict';
import test from 'node:test';
import { createTailscaleAuth, parseAllowedUsers } from '../src/auth/tailscale.js';
import { createApp } from '../src/api/app.js';
import { PluginRegistry } from '../src/registry.js';
import type { SchedulerRepository } from '../src/scheduler/repository.js';
import { inject } from './support.js';

test('team allowlist requires full emails and fails closed when empty', async context => {
    assert.deepEqual([...parseAllowedUsers(' Owner@Example.com,owner@example.com, teammate@example.com ')], ['owner@example.com', 'teammate@example.com']);
    assert.throws(() => parseAllowedUsers('owner@gmail'), /complete/);
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as SchedulerRepository, authProvider: createTailscaleAuth('') }).catch(error => error);
    assert.match(String(app), /Set PHONE_FARM_ALLOWED_USERS/);
});

test('private proxy identity is required, allowlisted, and limited to loopback peers', async context => {
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as SchedulerRepository,
        authProvider: createTailscaleAuth('owner@example.com,teammate@example.com') });
    context.after(() => app.close());
    const health = await inject(app, { method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    for (const url of ['/api/plugins', '/api/devices', '/api/devices/u/remote/screenshot']) {
        const anonymous = await inject(app, { method: 'GET', url });
        assert.equal(anonymous.statusCode, 401);
    }
    const bearer = await inject(app, { method: 'POST', url: '/api/devices/u/remote/action', headers: { authorization: 'Bearer made-up' }, payload: { type: 'home' } });
    assert.equal(bearer.statusCode, 401);
    for (const login of ['owner@example.com', 'teammate@example.com']) {
        const permitted = await inject(app, { method: 'GET', url: '/api/plugins', headers: { 'tailscale-user-login': login } });
        assert.equal(permitted.statusCode, 200);
    }
    const denied = await inject(app, { method: 'GET', url: '/api/plugins', headers: { 'tailscale-user-login': 'other@example.com' } });
    assert.equal(denied.statusCode, 403);
    const direct = await inject(app, { method: 'GET', url: '/api/plugins', remoteAddress: '10.0.0.10', headers: { 'tailscale-user-login': 'owner@example.com' } });
    assert.equal(direct.statusCode, 403);
    const crossSite = await inject(app, { method: 'POST', url: '/api/devices/u/remote/action', headers: { origin: 'https://untrusted.example', 'tailscale-user-login': 'owner@example.com' }, payload: { type: 'home' } });
    assert.equal(crossSite.statusCode, 403);
});
