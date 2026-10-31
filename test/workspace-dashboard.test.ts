import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSharedPasswordAuth, createPasswordRecord } from '../src/auth/shared-password.js';
import { defaultDashboardTheme } from '../src/dashboard-theme.js';
import { PluginRegistry } from '../src/registry.js';

const directory = await mkdtemp(path.join(os.tmpdir(), 'pf-workspace-'));
process.env.DEVICES_CONFIG_PATH = path.join(directory, 'devices.json');
await writeFile(process.env.DEVICES_CONFIG_PATH, JSON.stringify([{ name: 'Shared phone', udid: 'test-phone', pluginData: {}, passcode: '987654' }]));
const { createApp } = await import('../src/api/app.js');

test('workspace assets and embedded controls keep authentication and passcode protection', async context => {
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as never,
        dashboardTheme: defaultDashboardTheme,
        authProvider: createSharedPasswordAuth({ record: await createPasswordRecord('fixture-workspace-password') }) });
    context.after(() => app.close());
    const font = await app.inject('/assets/fonts/rajdhani-700.ttf');
    assert.equal(font.statusCode, 200);
    assert.match(String(font.headers['content-type']), /font\/ttf/);
    assert.equal((await app.inject('/assets/fonts/private.ttf')).statusCode, 401);
    assert.equal((await app.inject('/assets/workspace.js')).statusCode, 401);
    assert.equal((await app.inject('/devices/test-phone?embedded=1')).statusCode, 401);
    const login = await app.inject({ method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:80' }, payload: { password: 'fixture-workspace-password' } });
    assert.equal(login.statusCode, 303);
    const headers = { cookie: String(login.headers['set-cookie']).split(';')[0]! };
    const home = await app.inject({ url: '/', headers });
    assert.equal(home.statusCode, 200);
    assert.match(home.body, /\/assets\/workspace\.js\?v=/);
    const script = await app.inject({ url: '/assets/workspace.js', headers });
    assert.equal(script.statusCode, 200);
    assert.match(String(script.headers['content-type']), /javascript/);
    const embedded = await app.inject({ url: '/devices/test-phone?embedded=1', headers });
    assert.equal(embedded.statusCode, 200);
    assert.match(embedded.body, /<body class="embedded-device">/);
    assert.doesNotMatch(embedded.body, /987654/);
    const full = await app.inject({ url: '/devices/test-phone', headers });
    assert.match(full.body, /<body>/);
    assert.equal((await app.inject({ url: '/assets/fonts/private.ttf', headers })).statusCode, 404);
});
