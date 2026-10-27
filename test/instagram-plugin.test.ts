import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inject } from './support.js';
import { createInstagramPlugin, normalizeInstagramAccounts } from '../src/instagram-plugin.js';
import { PluginRegistry } from '../src/registry.js';
import type { SchedulerRepository } from '../src/scheduler/repository.js';
const directory = await mkdtemp(path.join(os.tmpdir(), 'pf-instagram-'));
const config = path.join(directory, 'devices.json');
process.env.DEVICES_CONFIG_PATH = config;

test('Instagram handles are normalized and reject invalid input', () => {
    assert.deepEqual(normalizeInstagramAccounts([' @Brand.One ', '@brand.one', '', 'other_2']), ['@brand.one', '@other_2']);
    for (const value of [null, 'handle', [123], ['<script>'], ['a'.repeat(31)], Array(31).fill('handle')]) {
        assert.throws(() => normalizeInstagramAccounts(value));
    }
});

test('account edits preserve other device data; launcher rejects disabled or busy devices', async context => {
    await writeFile(config, JSON.stringify([
        { name: 'Phone', udid: 'test-phone', passcode: '123456', pluginData: { other: { keep: true } } },
        { name: 'Offline', udid: 'offline', disabled: true, pluginData: {} },
    ]));
    let busy = false;
    const { createApp } = await import('../src/api/app.js');
    const scheduler = { async activeExecution() { return busy ? { id: 'active' } : null; } } as unknown as SchedulerRepository;
    const app = await createApp({ plugins: new PluginRegistry([createInstagramPlugin()]), scheduler });
    context.after(() => app.close());
    const health = await inject(app, { method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    const idle = await inject(app, { method: 'GET', url: '/api/devices/test-phone/instagram/doomscroll' });
    assert.equal(idle.json().status, 'idle');
    const badScroll = await inject(app, { method: 'POST', url: '/api/devices/test-phone/instagram/doomscroll', payload: { durationMinutes: 0 } });
    assert.equal(badScroll.statusCode, 400);
    const disabledScroll = await inject(app, { method: 'POST', url: '/api/devices/offline/instagram/doomscroll', payload: { durationMinutes: 1 } });
    assert.equal(disabledScroll.statusCode, 409);
    const saved = await inject(app, { method: 'PATCH', url: '/api/devices/test-phone/instagram/accounts', payload: { accounts: ['@Brand.One', 'second'] } });
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.json(), { accounts: ['@brand.one', '@second'] });
    assert.equal(saved.json().passcode, undefined);
    const devices = JSON.parse(await readFile(config, 'utf8'));
    assert.equal(devices[0].passcode, '123456');
    assert.deepEqual(devices[0].pluginData.other, { keep: true });
    const loaded = await inject(app, { method: 'GET', url: '/api/devices/test-phone/instagram/accounts' });
    assert.deepEqual(loaded.json(), saved.json());
    const invalid = await inject(app, { method: 'PATCH', url: '/api/devices/test-phone/instagram/accounts', payload: { accounts: ['<bad>'] } });
    assert.equal(invalid.statusCode, 400);
    const missing = await inject(app, { method: 'PATCH', url: '/api/devices/missing/instagram/accounts', payload: { accounts: [] } });
    assert.equal(missing.statusCode, 404);
    const disabled = await inject(app, { method: 'POST', url: '/api/devices/offline/instagram/open', payload: {} });
    assert.equal(disabled.statusCode, 409);
    busy = true;
    const busyScroll = await inject(app, { method: 'POST', url: '/api/devices/test-phone/instagram/doomscroll', payload: { durationMinutes: 1 } });
    assert.equal(busyScroll.statusCode, 409);
    const blocked = await inject(app, { method: 'POST', url: '/api/devices/test-phone/instagram/open', payload: {} });
    assert.equal(blocked.statusCode, 409);
    const removed = await inject(app, { method: 'PATCH', url: '/api/devices/test-phone/instagram/accounts', payload: { accounts: [] } });
    assert.deepEqual(removed.json(), { accounts: [] });
});
