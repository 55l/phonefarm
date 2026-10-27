import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inject } from './support.js';

test('new phones receive distinct ports and explicit collisions are rejected', async context => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'pf-multiple-phones-'));
    const registry = path.join(directory, 'devices.json');
    process.env.DEVICES_CONFIG_PATH = registry;
    await writeFile(registry, JSON.stringify([{ name: 'First', udid: 'first', wdaLocalPort: 8100, mjpegLocalPort: 9100, pluginData: {} }]));
    const { createApp } = await import('../src/api/app.js');
    const { PluginRegistry } = await import('../src/registry.js');
    const app = await createApp({ plugins: new PluginRegistry([]), scheduler: {} as never });
    context.after(() => app.close());
    const results = await Promise.all(['second', 'third'].map(udid => inject(app, { method: 'POST', url: '/api/devices', payload: { udid } })));
    for (const result of results) assert.equal(result.statusCode, 201, result.body);
    const ports = [8100, 9100, ...results.flatMap(result => [result.json().wdaLocalPort, result.json().mjpegLocalPort])];
    assert.equal(new Set(ports).size, 6);
    const collision = await inject(app, { method: 'POST', url: '/api/devices', payload: { udid: 'fourth', wdaLocalPort: 8100, mjpegLocalPort: 9105 } });
    assert.equal(collision.statusCode, 409);
});
