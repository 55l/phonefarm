import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error The CLI helper is a native ESM module with no declaration file.
import { demoReachable } from '../scripts/demo-health.mjs';

test('demo health rejects expired tunnels and proxy errors even if their process survives', async () => {
    const address = 'https://example.trycloudflare.com';
    const dnsReady = async () => ['192.0.2.1'];
    assert.equal(await demoReachable(address, async () => new Response('Tunnel not found', { status: 530 }), dnsReady), false);
    assert.equal(await demoReachable(address, async () => new Response('<html>Cloudflare error</html>'), dnsReady), false);
    assert.equal(await demoReachable(address, async () => { throw new Error('DNS lookup failed'); }, dnsReady), false);
    assert.equal(await demoReachable(address, async () => new Response('', { status: 303 }), dnsReady), false);
    assert.equal(await demoReachable(address, async (url: string) => {
        assert.equal(url, `${address}/auth/login`);
        return new Response('<form action="/auth/login"><input name="password" type="password"></form>');
    }, dnsReady), true);
});

test('demo waits for DNS publication before invoking the system HTTP resolver', async () => {
    let requests = 0;
    assert.equal(await demoReachable('https://new.trycloudflare.com', async () => {
        requests++;
        return new Response('');
    }, async () => { throw new Error('ENOTFOUND'); }), false);
    assert.equal(requests, 0);
});
