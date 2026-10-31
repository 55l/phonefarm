try {
    document.documentElement.dataset.theme = localStorage.getItem('phone-workspace-theme') === 'light' ? 'light' : 'dark';
}
catch { /* default theme */ }
const deviceId = document.querySelector('[data-device-udid]').dataset.deviceUdid;
const base = `/api/devices/${encodeURIComponent(decodeURIComponent(deviceId))}`;
const screen = document.querySelector('#screen');
const status = document.querySelector('#status');
const toggle = document.querySelector('#toggle');
const handles = document.querySelector('#device-accounts');
const accountList = document.querySelector('#account-list');
const openButton = document.querySelector('#open-instagram');
let size;
let paused = false;
let busy = false;
let scrollActive = false;
let pointer;
let reconnectTimer;
async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, {
        method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok)
        throw new Error(data.error ?? 'The request could not be completed.');
    return data;
}
const message = (error) => error instanceof Error ? error.message : String(error);
function renderAccounts(accounts) {
    accountList.replaceChildren();
    for (const handle of accounts) {
        const item = document.createElement('li');
        item.textContent = handle;
        accountList.append(item);
    }
    if (!accounts.length) {
        const item = document.createElement('li');
        item.textContent = 'No handles saved yet.';
        accountList.append(item);
    }
    handles.value = accounts.join('\n');
}
async function connect() {
    window.clearTimeout(reconnectTimer);
    if (paused)
        return;
    status.textContent = 'Connecting to your iPhone…';
    try {
        const data = await request('/remote/info');
        size = data.screen.screenSize;
        document.querySelector('#device-name').textContent = data.device.name;
        document.querySelector('#device-details').textContent = `${data.device.modelName ?? 'iPhone'} · iOS ${data.device.osVersion} · ${size.width} × ${size.height} points`;
        document.title = `${data.device.name} · Phone Workspace`;
        screen.style.aspectRatio = `${size.width} / ${size.height}`;
        screen.parentElement.style.aspectRatio = `${size.width} / ${size.height}`;
        screen.src = `${base}/remote/stream?t=${Date.now()}`;
    }
    catch (error) {
        size = undefined;
        status.textContent = `${message(error)} Reconnect and unlock the phone.`;
        reconnectTimer = window.setTimeout(() => void connect(), 4000);
    }
}
screen.addEventListener('load', () => { status.textContent = 'Live · click to tap, drag to swipe'; });
screen.addEventListener('error', () => {
    if (paused)
        return;
    status.textContent = 'Video disconnected. Retrying…';
    reconnectTimer = window.setTimeout(() => void connect(), 4000);
});
document.querySelector('#refresh').addEventListener('click', () => { paused = false; toggle.textContent = 'Pause'; void connect(); });
toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Resume' : 'Pause';
    if (paused) {
        window.clearTimeout(reconnectTimer);
        screen.removeAttribute('src');
        status.textContent = 'Video paused';
    }
    else
        void connect();
});
async function action(body) {
    if (busy || scrollActive)
        return;
    busy = true;
    try {
        await request('/remote/action', 'POST', body);
        status.textContent = paused ? 'Video paused' : 'Live · input sent';
    }
    catch (error) {
        status.textContent = message(error);
    }
    finally {
        busy = false;
    }
}
function point(event) {
    const rect = screen.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(size.width - 1, Math.round((event.clientX - rect.left) * size.width / rect.width))),
        y: Math.max(0, Math.min(size.height - 1, Math.round((event.clientY - rect.top) * size.height / rect.height))),
        time: performance.now(),
    };
}
screen.addEventListener('pointerdown', event => {
    if (!size || paused || busy || scrollActive)
        return;
    event.preventDefault();
    screen.setPointerCapture(event.pointerId);
    pointer = point(event);
});
screen.addEventListener('pointercancel', () => { pointer = undefined; });
screen.addEventListener('pointerup', event => {
    if (!pointer || !size || paused)
        return;
    const start = pointer;
    pointer = undefined;
    const end = point(event);
    const stationary = Math.hypot(end.x - start.x, end.y - start.y) < 10;
    if (stationary && end.time - start.time < 500)
        void action({ type: 'tap', x: end.x, y: end.y });
    else
        void action({ type: 'swipe', startX: start.x, startY: start.y, endX: stationary ? start.x : end.x, endY: stationary ? start.y : end.y, durationMs: Math.round(Math.max(150, Math.min(2000, end.time - start.time))) });
});
for (const button of document.querySelectorAll('[data-remote-action]')) {
    button.addEventListener('click', () => {
        const type = button.dataset.remoteAction;
        if (['left', 'right', 'up', 'down'].includes(type)) {
            if (!size)
                return;
            const x = Math.round(size.width / 2), y = Math.round(size.height / 2);
            const points = {
                left: [size.width * .8, y, size.width * .2, y], right: [size.width * .2, y, size.width * .8, y],
                up: [x, size.height * .75, x, size.height * .25], down: [x, size.height * .25, x, size.height * .75],
            };
            const [startX, startY, endX, endY] = points[type].map(Math.round);
            void action({ type: 'swipe', startX, startY, endX, endY, durationMs: 350 });
        }
        else if (type === 'unlock')
            void unlockPhone();
        else
            void action({ type });
    });
}
openButton.addEventListener('click', async () => {
    openButton.disabled = true;
    const result = document.querySelector('#instagram-status');
    result.textContent = 'Opening Instagram…';
    try {
        await request('/instagram/open', 'POST', {});
        result.textContent = 'Instagram is open on your phone.';
    }
    catch (error) {
        result.textContent = message(error);
    }
    finally {
        openButton.disabled = false;
    }
});
document.querySelector('#accounts-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = document.querySelector('#accounts-result');
    const submit = document.querySelector('#accounts-form button');
    submit.disabled = true;
    try {
        const data = await request('/instagram/accounts', 'PATCH', { accounts: handles.value.split(/[,\n]+/).map(value => value.trim()).filter(Boolean) });
        renderAccounts(data.accounts);
        result.textContent = 'Account list saved.';
    }
    catch (error) {
        result.textContent = message(error);
    }
    finally {
        submit.disabled = false;
    }
});
window.addEventListener('pagehide', () => { paused = true; window.clearTimeout(reconnectTimer); screen.removeAttribute('src'); });
void request('/instagram/accounts').then(data => renderAccounts(data.accounts)).catch(error => {
    document.querySelector('#accounts-result').textContent = message(error);
});
void connect();
const scrollForm = document.querySelector('#doomscroll-form');
const scrollStart = document.querySelector('#start-scroll');
const scrollStop = document.querySelector('#stop-scroll');
const scrollStatus = document.querySelector('#scroll-status');
let scrollPoll;
let scrollPageOpen = true;
function renderScroll(state) {
    scrollActive = state.active;
    scrollStart.disabled = state.active;
    scrollStop.disabled = !state.active || state.status === 'stopping';
    openButton.disabled = state.active;
    for (const button of document.querySelectorAll('[data-remote-action]'))
        button.disabled = state.active;
    for (const button of document.querySelectorAll('#unlock-form button'))
        button.disabled = state.active || unlockBusy;
    const labels = { idle: 'Ready to scroll', starting: 'Opening Instagram', running: 'Scrolling', stopping: 'Stopping after the current input', stopped: 'Stopped', completed: 'Finished', failed: 'Stopped with an error' };
    const remaining = state.endsAt && state.status === 'running' ? Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 1000)) : null;
    const time = remaining === null ? '' : ` · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining`;
    scrollStatus.textContent = state.error ?? `${labels[state.status]} · ${state.scrollCount} scrolls${time}`;
}
async function pollScroll() {
    try {
        renderScroll(await request('/instagram/doomscroll'));
    }
    catch (error) {
        scrollStatus.textContent = message(error);
    }
    if (scrollPageOpen)
        scrollPoll = window.setTimeout(() => void pollScroll(), 1000);
}
scrollForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    scrollStart.disabled = true;
    try {
        renderScroll(await request('/instagram/doomscroll', 'POST', {
            durationMinutes: Number(document.querySelector('#scroll-duration').value),
            intervalSeconds: Number(document.querySelector('#scroll-interval').value),
        }));
    }
    catch (error) {
        scrollStatus.textContent = message(error);
        scrollStart.disabled = scrollActive;
    }
});
scrollStop.addEventListener('click', async () => {
    scrollStop.disabled = true;
    try {
        renderScroll(await request('/instagram/doomscroll/stop', 'POST', {}));
    }
    catch (error) {
        scrollStatus.textContent = message(error);
        scrollStop.disabled = !scrollActive;
    }
});
window.addEventListener('pagehide', () => { scrollPageOpen = false; window.clearTimeout(scrollPoll); });
void pollScroll();
const passcodeInput = document.querySelector('#unlock-passcode');
const unlockResult = document.querySelector('#unlock-result');
const savedPasscodeState = document.querySelector('#saved-passcode-state');
let hasSavedPasscode = false;
let unlockBusy = false;
let lockPoll;
let lockPageOpen = true;
async function refreshLock() {
    try {
        const state = await request('/remote/lock-state');
        hasSavedPasscode = state.hasPasscode;
        document.querySelector('#lock-state').textContent = state.locked ? 'Phone is locked.' : 'Phone is unlocked.';
        savedPasscodeState.textContent = state.hasPasscode ? 'A saved passcode is available. Leave the field empty to use it.' : 'No passcode saved. Enter it above to unlock once.';
    }
    catch {
        document.querySelector('#lock-state').textContent = 'Lock status unavailable. Check the phone connection.';
    }
}
function setUnlockBusy(value) {
    unlockBusy = value;
    for (const button of document.querySelectorAll('#unlock-form button'))
        button.disabled = value || scrollActive;
}
async function unlockPhone() {
    if (unlockBusy || scrollActive)
        return;
    const code = passcodeInput.value;
    if (code && !/^\d{4,32}$/.test(code)) {
        unlockResult.textContent = 'Enter a 4–32 digit numeric passcode.';
        return;
    }
    if (!code && !hasSavedPasscode) {
        unlockResult.textContent = 'Enter the phone passcode in this panel first.';
        passcodeInput.focus();
        return;
    }
    passcodeInput.value = '';
    setUnlockBusy(true);
    unlockResult.textContent = 'Unlocking—one attempt only…';
    try {
        await request('/remote/action', 'POST', { type: 'unlock', ...(code ? { passcode: code } : {}) });
        unlockResult.textContent = 'Phone unlocked.';
    }
    catch (error) {
        unlockResult.textContent = message(error);
    }
    finally {
        setUnlockBusy(false);
        await refreshLock();
    }
}
document.querySelector('#unlock-form').addEventListener('submit', event => { event.preventDefault(); void unlockPhone(); });
document.querySelector('#save-passcode').addEventListener('click', async () => {
    if (unlockBusy || scrollActive)
        return;
    const code = passcodeInput.value;
    if (!/^\d{4,32}$/.test(code)) {
        unlockResult.textContent = 'Enter a 4–32 digit numeric passcode to save.';
        return;
    }
    passcodeInput.value = '';
    setUnlockBusy(true);
    try {
        await request('', 'PATCH', { passcode: code });
        unlockResult.textContent = 'Saved on this Mac. The code will not be shown again.';
    }
    catch (error) {
        unlockResult.textContent = message(error);
    }
    finally {
        setUnlockBusy(false);
        await refreshLock();
    }
});
document.querySelector('#clear-passcode').addEventListener('click', async () => {
    if (unlockBusy || scrollActive)
        return;
    passcodeInput.value = '';
    setUnlockBusy(true);
    try {
        await request('', 'PATCH', { passcode: '' });
        unlockResult.textContent = 'Saved copy removed. The phone’s passcode is unchanged.';
    }
    catch (error) {
        unlockResult.textContent = message(error);
    }
    finally {
        setUnlockBusy(false);
        await refreshLock();
    }
});
async function pollLock() {
    await refreshLock();
    if (lockPageOpen)
        lockPoll = window.setTimeout(() => void pollLock(), 4000);
}
window.addEventListener('pagehide', () => { lockPageOpen = false; window.clearTimeout(lockPoll); passcodeInput.value = ''; });
void pollLock();
export {};
