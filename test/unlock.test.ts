import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPasscodeKeypad } from '../src/devices/passcode-keypad.js';
import { WdaRemoteControl } from '../src/devices/wda-remote.js';
const size = { width: 390, height: 844 };
function keypad(entered = 0) {
    return { type: 'Application', children: [
        { type: 'SecureTextField', isVisible: '1', value: `${entered} of 6 values entered` },
        ...Array.from({ length: 10 }, (_, digit) => ({ type: 'Key', name: String(digit), isVisible: '1',
            rect: { x: digit === 0 ? 144 : 42 + ((digit - 1) % 3) * 102,
                y: digit === 0 ? 571 : 284 + Math.floor((digit - 1) / 3) * 96, width: 102, height: 96 } })),
    ] };
}
function control(options: { entered?: number; unlockAfter?: number; initiallyLocked?: boolean } = {}) {
    const taps: Array<{ x: number; y: number }> = [];
    let locked = options.initiallyLocked ?? true;
    const remote = new WdaRemoteControl({ deviceUdid: 'phone', fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        let value: unknown;
        if (path === '/wda/locked') value = locked;
        else if (path === '/wda/screen') value = { screenSize: size, scale: 3 };
        else if (path === '/source') value = keypad(options.entered);
        else if (path === '/wda/absolute-actions') {
            const body = JSON.parse(String(init?.body));
            const point = body.actions[0].actions[0]; taps.push({ x: point.x, y: point.y });
            if (taps.length === options.unlockAfter) locked = false;
            value = null;
        } else if (path === '/wda/pressButton') value = null;
        else throw new Error(`Unexpected request ${path}`);
        return Response.json({ value });
    }) as typeof fetch });
    return { remote, taps };
}

test('detects the live iPhone 13 keypad and rejects incomplete or ambiguous keys', () => {
    const detected = detectPasscodeKeypad(keypad(), size)!;
    assert.equal(detected.expectedDigits, 6);
    assert.equal(detected.enteredDigits, 0);
    assert.deepEqual(detected.digits.get('0'), { x: 195, y: 619 });
    const missing = keypad(); missing.children.pop();
    assert.equal(detectPasscodeKeypad(missing, size), undefined);
    const duplicate = keypad(); duplicate.children.push({ type: 'Key', name: '1', isVisible: '1', rect: { x: 0, y: 0, width: 20, height: 20 } });
    assert.equal(detectPasscodeKeypad(duplicate, size), undefined);
});

test('one-time numeric unlock uses detected keys and verifies success', async () => {
    const { remote, taps } = control({ unlockAfter: 6 });
    await remote.performAction('phone', { type: 'unlock', passcode: '123456' });
    assert.equal(taps.length, 6);
    assert.deepEqual(taps[0], { x: 93, y: 332 });
    assert.equal(remote.passcode, undefined, 'a one-time passcode is not cached');
});

test('wrong-length or partial passcodes are rejected before any digits are sent', async () => {
    const a = control();
    await assert.rejects(a.remote.unlock('phone', '1234'), /6-digit/);
    assert.equal(a.taps.length, 0);
    const b = control({ entered: 2 });
    await assert.rejects(b.remote.unlock('phone', '123456'), /Clear any existing/);
    assert.equal(b.taps.length, 0);
});

test('a rejected passcode is attempted once, without automatic retries', async () => {
    const { remote, taps } = control();
    await assert.rejects(remote.unlock('phone', '123456'), /not be retried/);
    assert.equal(taps.length, 6);
});

test('already-unlocked phones need no passcode or keypad input', async () => {
    const { remote, taps } = control({ initiallyLocked: false });
    await remote.unlock('phone');
    assert.equal(taps.length, 0);
});
