// Local Instagram workspace customization: manual control and scroll-only sessions.
import { remote, type Browser } from 'webdriverio';
import type { PhoneFarmPlugin } from './plugin.js';
import { WdaRemoteControl } from './devices/wda-remote.js';
import { InstagramScrollSession, validateScrollOptions } from './instagram/doomscroll.js';

export const INSTAGRAM_PLUGIN_ID = 'local.instagram';

export function normalizeInstagramAccounts(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 30 || value.some(item => typeof item !== 'string')) {
        throw new Error('Enter up to 30 Instagram handles.');
    }
    const accounts = value.map(item => item.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
    if (accounts.some(handle => !/^[a-z0-9._]{1,30}$/.test(handle))) {
        throw new Error('Handles must contain 1–30 letters, numbers, periods, or underscores.');
    }
    return [...new Set(accounts)].map(handle => `@${handle}`);
}

export function createInstagramPlugin(): PhoneFarmPlugin {
    return {
        id: INSTAGRAM_PLUGIN_ID, version: '1.0.0', displayName: 'Instagram workspace', tasks: [],
        async registerRoutes(context) {
            const find = async (udid: string) => (await context.loadDevices()).find(device => device.udid === udid);
            context.app.get<{ Params: { udid: string } }>('/api/devices/:udid/instagram/accounts', async (request, reply) => {
                const device = await find(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered.' });
                return { accounts: device.pluginData[INSTAGRAM_PLUGIN_ID]?.accounts ?? [] };
            });
            context.app.patch<{ Params: { udid: string }; Body: { accounts?: unknown } }>('/api/devices/:udid/instagram/accounts', async (request, reply) => {
                let accounts: string[];
                try { accounts = normalizeInstagramAccounts(request.body?.accounts); }
                catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
                const updated = await context.mutateDevices(devices => {
                    const device = devices.find(entry => entry.udid === request.params.udid);
                    if (!device) return false;
                    device.pluginData[INSTAGRAM_PLUGIN_ID] = { ...device.pluginData[INSTAGRAM_PLUGIN_ID], accounts };
                    return true;
                });
                if (!updated) return reply.code(404).send({ error: 'Device is not registered.' });
                return { accounts };
            });
            const opening = new Set<string>();
            const scrolls = new Map<string, InstagramScrollSession>();
            context.app.addHook('preHandler', async (request, reply) => {
                const route = request.routeOptions.url;
                const udid = (request.params as { udid?: string } | undefined)?.udid;
                if (!udid || !scrolls.get(udid)?.isActive()) return;
                if (route === '/api/devices/:udid/remote/action'
                    || (route === '/api/devices/:udid' && ['PATCH', 'DELETE'].includes(request.method))) {
                    return reply.code(409).send({ error: 'Stop doomscroll before controlling or changing this device.' });
                }
            });
            context.app.addHook('preClose', async () => {
                for (const session of scrolls.values()) session.stop();
                await Promise.all([...scrolls.values()].map(session => session.done));
            });
            context.app.get<{ Params: { udid: string } }>('/api/devices/:udid/instagram/doomscroll', async (request, reply) => {
                if (!(await find(request.params.udid))) return reply.code(404).send({ error: 'Device is not registered.' });
                return scrolls.get(request.params.udid)?.snapshot() ?? { status: 'idle', active: false, scrollCount: 0 };
            });
            context.app.post<{ Params: { udid: string } }>('/api/devices/:udid/instagram/doomscroll', async (request, reply) => {
                let options;
                try { options = validateScrollOptions(request.body); }
                catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
                const device = await find(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered.' });
                if (device.disabled) return reply.code(409).send({ error: 'Reconnect this device first.' });
                const busy = await context.scheduler.activeExecution(device.udid);
                if (busy || opening.has(device.udid) || scrolls.get(device.udid)?.isActive()) {
                    return reply.code(409).send({ error: 'The device is busy. Stop its current session first.' });
                }
                const control = new WdaRemoteControl({ deviceUdid: device.udid, timeoutMs: 5000,
                    wdaUrl: `http://127.0.0.1:${device.wdaLocalPort ?? 8100}` });
                let driver: Browser | undefined;
                const session = new InstagramScrollSession(options, {
                    async prepare() {
                        if (await control.isLocked(device.udid)) throw new Error('Unlock the phone before starting doomscroll.');
                        driver = await remote({
                            hostname: process.env.APPIUM_HOST ?? '127.0.0.1', port: Number(process.env.APPIUM_PORT ?? 4725),
                            path: '/', logLevel: 'error', connectionRetryCount: 0, connectionRetryTimeout: 10_000,
                            capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest',
                                'appium:udid': device.udid, 'appium:bundleId': 'com.burbn.instagram',
                                'appium:noReset': true, 'appium:forceAppLaunch': false, 'appium:shouldTerminateApp': false,
                                'appium:webDriverAgentUrl': `http://127.0.0.1:${device.wdaLocalPort ?? 8100}` },
                        });
                    },
                    async screen() { return (await control.getScreenInfo(device.udid)).screenSize; },
                    async isInstagramActive() { return await driver!.queryAppState('com.burbn.instagram') === 4; },
                    async swipe(startX, startY, endX, endY, durationMs) {
                        await control.performAction(device.udid, { type: 'swipe', startX, startY, endX, endY, durationMs });
                    },
                    async close() { if (driver) await driver.deleteSession(); },
                });
                scrolls.set(device.udid, session);
                return reply.code(202).send(session.snapshot());
            });
            context.app.post<{ Params: { udid: string } }>('/api/devices/:udid/instagram/doomscroll/stop', async (request, reply) => {
                if (!(await find(request.params.udid))) return reply.code(404).send({ error: 'Device is not registered.' });
                const session = scrolls.get(request.params.udid);
                session?.stop();
                return session?.snapshot() ?? { status: 'idle', active: false, scrollCount: 0 };
            });
            context.app.post<{ Params: { udid: string } }>('/api/devices/:udid/instagram/open', async (request, reply) => {
                const device = await find(request.params.udid);
                if (!device) return reply.code(404).send({ error: 'Device is not registered.' });
                if (device.disabled) return reply.code(409).send({ error: 'Reconnect this device first.' });
                if (await context.scheduler.activeExecution(device.udid) || opening.has(device.udid) || scrolls.get(device.udid)?.isActive()) {
                    return reply.code(409).send({ error: 'The device is busy. Try again when it is idle.' });
                }
                opening.add(device.udid);
                try {
                    const driver = await remote({
                        hostname: process.env.APPIUM_HOST ?? '127.0.0.1',
                        port: Number(process.env.APPIUM_PORT ?? 4725), path: '/', logLevel: 'error',
                        capabilities: {
                            platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': device.udid,
                            'appium:bundleId': 'com.burbn.instagram', 'appium:noReset': true,
                            'appium:forceAppLaunch': true, 'appium:shouldTerminateApp': false,
                            'appium:webDriverAgentUrl': `http://127.0.0.1:${device.wdaLocalPort ?? 8100}`,
                        },
                    });
                    try { return { ok: true }; }
                    finally { await driver.deleteSession(); }
                } catch (error) {
                    request.log.warn({ err: error }, 'Instagram could not be opened');
                    return reply.code(503).send({ error: 'Could not open Instagram. Check that it is installed and the phone is connected and unlocked.' });
                } finally { opening.delete(device.udid); }
            });
        },
    };
}
