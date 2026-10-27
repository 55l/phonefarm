import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPlugins } from '../src/api/server.js';

test('Instagram manual control is the default and TikTok requires explicit enablement', async () => {
    const keys = ['PHONE_FARM_TIKTOK_ENABLED', 'PHONE_FARM_INSTAGRAM_ENABLED', 'PHONE_FARM_PLUGINS'] as const;
    const saved = keys.map(key => process.env[key]);
    try {
        for (const key of keys) delete process.env[key];
        const plugins = await defaultPlugins();
        assert.deepEqual(plugins.map(plugin => plugin.id), ['local.instagram']);
        assert.deepEqual(plugins[0].tasks, []);
        process.env.PHONE_FARM_INSTAGRAM_ENABLED = 'false';
        assert.deepEqual(await defaultPlugins(), []);
        process.env.PHONE_FARM_TIKTOK_ENABLED = 'true';
        assert.equal((await defaultPlugins())[0]?.id, 'com.git-agni.tiktok');
    } finally {
        keys.forEach((key, index) => {
            if (saved[index] === undefined) delete process.env[key];
            else process.env[key] = saved[index];
        });
    }
});
