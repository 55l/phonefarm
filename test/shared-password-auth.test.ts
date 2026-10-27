import assert from 'node:assert/strict';
import test from 'node:test';
import { createSharedPasswordAuth, createPasswordRecord } from '../src/auth/shared-password.js';
import { createApp } from '../src/api/app.js';
import { PluginRegistry } from '../src/registry.js';
import type { SchedulerRepository } from '../src/scheduler/repository.js';
import { inject } from './support.js';

const password = 'test-only-long-passphrase';
test('shared password protects data, creates secure expiring sessions, and revokes logout', async context => {
    let now = Date.now();
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as SchedulerRepository,
        authProvider: createSharedPasswordAuth({ record: await createPasswordRecord(password), now: () => now }) });
    context.after(() => app.close());
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins' })).statusCode, 401);
    const redirect = await inject(app, { method: 'GET', url: '/', headers: { accept: 'text/html' } });
    assert.equal(redirect.headers.location, '/auth/login');
    assert.equal((await inject(app, { method: 'GET', url: '/auth/login' })).statusCode, 200);
    assert.equal((await inject(app, { method: 'POST', url: '/auth/login', headers: { origin: 'https://evil.example' }, payload: { password } })).statusCode, 403);
    assert.equal((await inject(app, { method: 'POST', url: '/auth/login', payload: { password: 'wrong-password-long' } })).statusCode, 401);
    const login = () => inject(app, { method: 'POST', url: '/auth/login', payload: { password } });
    const result = await login();
    assert.equal(result.statusCode, 303);
    const setCookie = String(result.headers['set-cookie']);
    for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(setCookie.includes(flag));
    const cookie = setCookie.split(';')[0]!;
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins', headers: { cookie } })).statusCode, 200);
    const logout = await inject(app, { method: 'POST', url: '/auth/logout', headers: { cookie } });
    assert.equal(logout.statusCode, 303);
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins', headers: { cookie } })).statusCode, 401);
    const secondCookie = String((await login()).headers['set-cookie']).split(';')[0]!;
    now += 6 * 60 * 60 * 1000 + 1;
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins', headers: { cookie: secondCookie } })).statusCode, 401);
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins', headers: { cookie: '__Host-phone-workspace=forged' } })).statusCode, 401);
    assert.equal((await inject(app, { method: 'GET', url: '/auth/login', remoteAddress: '10.0.0.2' })).statusCode, 403);
});

test('shared password limits repeated guesses and ignores identity headers', async context => {
    let now = Date.now();
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as SchedulerRepository,
        authProvider: createSharedPasswordAuth({ record: await createPasswordRecord(password), now: () => now }) });
    context.after(() => app.close());
    for (let i = 0; i < 5; i++) assert.equal((await inject(app, { method: 'POST', url: '/auth/login', payload: { password: 'wrong' } })).statusCode, 401);
    assert.equal((await inject(app, { method: 'POST', url: '/auth/login', payload: { password } })).statusCode, 429);
    now += 15 * 60 * 1000 + 1;
    assert.equal((await inject(app, { method: 'POST', url: '/auth/login', payload: { password } })).statusCode, 303);
    assert.equal((await inject(app, { method: 'GET', url: '/api/plugins', headers: { 'tailscale-user-login': 'owner@example.com', 'cf-access-authenticated-user-email': 'owner@example.com' } })).statusCode, 401);
    await assert.rejects(createPasswordRecord('1234'), /12/);
});
