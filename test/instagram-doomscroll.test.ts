import assert from 'node:assert/strict';
import test from 'node:test';
import { InstagramScrollSession, validateScrollOptions, type ScrollDevice } from '../src/instagram/doomscroll.js';

function device(overrides: Partial<ScrollDevice> = {}) {
    const swipes: number[][] = [];
    let closed = 0;
    const target: ScrollDevice = {
        async prepare() {}, async screen() { return { width: 390, height: 844 }; },
        async isInstagramActive() { return true; }, async swipe(...args) { swipes.push(args); },
        async close() { closed += 1; }, ...overrides,
    };
    return { target, swipes, closed: () => closed };
}

test('scroll-only options enforce bounded duration and pace', () => {
    assert.deepEqual(validateScrollOptions({ durationMinutes: 5 }), { durationMinutes: 5, intervalSeconds: 5 });
    for (const options of [null, {}, { durationMinutes: 0 }, { durationMinutes: 181 }, { durationMinutes: 1.5 }, { durationMinutes: 1, intervalSeconds: 0 }, { durationMinutes: 1, intervalSeconds: 31 }]) {
        assert.throws(() => validateScrollOptions(options));
    }
});

test('scrolls within the real iPhone 13 screen, stops at deadline, and closes the session', async () => {
    const d = device(); let time = 0;
    const session = new InstagramScrollSession({ durationMinutes: 1, intervalSeconds: 5 }, d.target, {
        now: () => time, async pause(ms, signal) { signal.throwIfAborted(); time += ms; },
    });
    await session.done;
    assert.equal(session.snapshot().status, 'completed');
    assert.equal(session.isActive(), false);
    assert.equal(d.swipes.length, 11);
    assert.deepEqual(d.swipes[0], [195, 608, 195, 236, 450]);
    assert.equal(time, 60000);
    assert.equal(d.closed(), 1);
});

test('stop interrupts the reading pause before another swipe', async () => {
    const d = device();
    let paused!: () => void;
    const reachedPause = new Promise<void>(resolve => { paused = resolve; });
    const session = new InstagramScrollSession({ durationMinutes: 1, intervalSeconds: 5 }, d.target, {
        now: () => 0,
        pause: (_ms, signal) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            paused();
        }),
    });
    await reachedPause;
    session.stop();
    await session.done;
    assert.equal(session.snapshot().status, 'stopped');
    assert.equal(session.isActive(), false);
    assert.equal(d.swipes.length, 0);
    assert.equal(d.closed(), 1);
});

test('switching away from Instagram stops without scrolling another app', async () => {
    const d = device({ async isInstagramActive() { return false; } }); let time = 0;
    const session = new InstagramScrollSession({ durationMinutes: 1, intervalSeconds: 5 }, d.target, {
        now: () => time, async pause(ms) { time += ms; },
    });
    await session.done;
    assert.equal(session.snapshot().status, 'failed');
    assert.match(session.snapshot().error!, /foreground/);
    assert.equal(d.swipes.length, 0);
    assert.equal(d.closed(), 1);
});

test('stop during startup cleans up without touching the screen', async () => {
    let release!: () => void;
    const prepared = new Promise<void>(resolve => { release = resolve; });
    const d = device({ prepare: () => prepared });
    const session = new InstagramScrollSession({ durationMinutes: 1, intervalSeconds: 5 }, d.target);
    session.stop(); release(); await session.done;
    assert.equal(session.snapshot().status, 'stopped');
    assert.equal(d.swipes.length, 0);
    assert.equal(d.closed(), 1);
});
