const el = (id) => document.getElementById(id);
const grid = el('phone-grid');
const frame = el('phone-controls-frame');
const tiles = new Map();
const scrolling = new Set();
let phones = [];
let selected = '';
let view = 'phones';
let stopped = false;
let refreshing = false;
let tableSnapshot = '';
const accounts = (phone) => phone.pluginData?.['local.instagram']?.accounts ?? [];
const apiPath = (phone) => `/api/devices/${encodeURIComponent(phone.udid)}`;
const state = (phone) => phone.disabled ? 'Paused' : phone.connected ? 'Connected' : 'Offline';
async function request(path, init) {
    const response = await fetch(path, { signal: AbortSignal.timeout(10000), ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
    if (response.status === 401) {
        window.location.assign('/auth/login');
        throw new Error('Please sign in again.');
    }
    if (!response.ok)
        throw new Error('Could not update the workspace. Try refreshing.');
    return response.json();
}
function text(parent, selector, value) { parent.querySelector(selector).textContent = value; }
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem('phone-workspace-theme', theme);
    }
    catch { /* browser storage unavailable */ }
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
    if (frame.contentDocument)
        frame.contentDocument.documentElement.dataset.theme = theme;
}
let theme = 'dark';
try {
    theme = localStorage.getItem('phone-workspace-theme') === 'light' ? 'light' : 'dark';
}
catch { /* use dark */ }
applyTheme(theme);
document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));
frame.addEventListener('load', () => { if (frame.contentDocument)
    frame.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme; });
function closeControls() {
    selected = '';
    el('control-panel').hidden = true;
    frame.removeAttribute('src');
    el('fleet-layout').classList.remove('with-controls');
    document.querySelectorAll('.phone-tile.selected').forEach(tile => tile.classList.remove('selected'));
}
function openControls(phone, anchor = '') {
    if (view !== 'phones')
        window.location.hash = 'phones';
    selected = phone.udid;
    el('focused-phone-name').textContent = phone.name;
    el('control-panel').hidden = false;
    el('fleet-layout').classList.add('with-controls');
    frame.src = `/devices/${encodeURIComponent(phone.udid)}?embedded=1${anchor}`;
    tiles.forEach((tile, id) => tile.classList.toggle('selected', id === selected));
    if (window.innerWidth < 900)
        el('control-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
el('close-control').addEventListener('click', closeControls);
document.addEventListener('keydown', event => { if (event.key === 'Escape')
    closeControls(); });
function syncPreview(phone, tile, snapshot = false) {
    const image = tile.querySelector('img');
    const mode = el('preview-mode').value;
    const available = !document.hidden && view === 'phones' && !phone.disabled && Boolean(phone.connected) && mode !== 'paused';
    // HTTP/1 browsers have a small per-host connection limit. Reserve room for API calls
    // and the focused controller; HTTPS tunnel viewers can stream the full fleet.
    const localFallback = location.protocol === 'http:' && phones.filter(item => item.connected && !item.disabled).findIndex(item => item.udid === phone.udid) >= 4;
    const kind = available ? (mode === 'live' && localFallback ? 'snapshots' : mode) : 'off';
    const changed = image.dataset.kind !== kind;
    if (changed) {
        image.removeAttribute('src');
        image.dataset.kind = kind;
        tile.classList.remove('preview-failed');
    }
    if (kind === 'off') {
        image.hidden = true;
        text(tile, '.preview-placeholder', phone.disabled ? 'Phone paused' : !phone.connected ? 'Connect by USB' : 'Previews paused');
    }
    else {
        image.hidden = false;
        if (changed || (kind === 'snapshots' && snapshot))
            image.src = `${apiPath(phone)}/remote/${kind === 'live' ? 'stream' : 'screenshot'}?t=${Date.now()}`;
    }
    tile.classList.toggle('preview-off', kind === 'off');
}
function renderTables() {
    const accountRows = el('workspace-accounts');
    const connections = el('workspace-connections');
    accountRows.replaceChildren();
    connections.replaceChildren();
    for (const phone of phones) {
        for (const handle of accounts(phone)) {
            const row = document.createElement('tr');
            for (const value of [handle.startsWith('@') ? handle : `@${handle}`, phone.name, state(phone)]) {
                const td = document.createElement('td');
                td.textContent = value;
                row.append(td);
            }
            const td = document.createElement('td');
            const button = document.createElement('button');
            button.className = 'button secondary';
            button.textContent = 'Manage accounts';
            button.disabled = Boolean(phone.disabled || !phone.connected);
            button.onclick = () => openControls(phone, '#accounts-form');
            td.append(button);
            row.append(td);
            accountRows.append(row);
        }
        const row = document.createElement('tr');
        for (const value of [phone.name, state(phone), phone.disabled ? 'Paused in this workspace' : 'Shared team access']) {
            const td = document.createElement('td');
            td.textContent = value;
            row.append(td);
        }
        const td = document.createElement('td');
        const button = document.createElement('button');
        button.className = 'button secondary';
        button.textContent = phone.disabled ? 'Enable phone' : 'Pause phone';
        button.onclick = async () => { button.disabled = true; try {
            await request(apiPath(phone), { method: 'PATCH', body: JSON.stringify({ disabled: !phone.disabled }) });
            if (selected === phone.udid)
                closeControls();
            await refresh();
        }
        catch (error) {
            el('fleet-message').textContent = String(error);
        }
        finally {
            button.disabled = false;
        } };
        td.append(button);
        row.append(td);
        connections.append(row);
    }
    for (const [body, message] of [[accountRows, 'No saved accounts yet. Open a phone’s controls to add Instagram handles.'], [connections, 'No phones registered. Add a phone to get started.']]) {
        if (!body.childElementCount) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = message;
            row.append(cell);
            body.append(row);
        }
    }
}
function render(snapshot = false) {
    const query = el('fleet-search').value.trim().toLowerCase();
    const filter = el('fleet-filter').value;
    let visible = 0;
    for (const phone of phones) {
        let tile = tiles.get(phone.udid);
        if (!tile) {
            tile = document.createElement('article');
            tile.className = 'phone-tile';
            tile.innerHTML = '<div class="phone-tile-heading"><div><span class="tile-number"></span><h2></h2></div><span class="fleet-badge"></span></div><div class="fleet-preview"><img draggable="false"><span class="preview-placeholder">Connecting screen…</span></div><div class="phone-tile-details"><p class="tile-model"></p><p class="tile-accounts"></p><div class="tile-bottom"><span class="scroll-label"></span><button class="button secondary">Controls ↗</button></div></div>';
            const id = phone.udid;
            tile.querySelector('button').addEventListener('click', () => { const current = phones.find(item => item.udid === id); if (current)
                openControls(current); });
            tile.querySelector('img').addEventListener('error', () => { tile.classList.add('preview-failed'); text(tile, '.preview-placeholder', 'Screen unavailable · Refresh to retry'); });
            tile.querySelector('img').addEventListener('load', () => tile.classList.remove('preview-failed'));
            tiles.set(id, tile);
            grid.append(tile);
        }
        tile.hidden = !(phone.name.toLowerCase().includes(query) || accounts(phone).join(' ').toLowerCase().includes(query)) || (filter === 'connected' && (!phone.connected || phone.disabled)) || (filter === 'attention' && (Boolean(phone.connected) || Boolean(phone.disabled))) || (filter === 'paused' && !phone.disabled);
        if (!tile.hidden)
            visible++;
        tile.classList.toggle('selected', phone.udid === selected);
        tile.querySelector('img').alt = `Screen of ${phone.name}`;
        text(tile, 'h2', phone.name);
        text(tile, '.tile-number', `PHONE ${String(phones.indexOf(phone) + 1).padStart(2, '0')}`);
        text(tile, '.fleet-badge', state(phone));
        tile.querySelector('.fleet-badge').dataset.state = state(phone).toLowerCase();
        text(tile, '.tile-model', [phone.connected?.modelName ?? 'iPhone', phone.connected?.osVersion ? `iOS ${phone.connected.osVersion}` : 'USB connection'].join(' · '));
        text(tile, '.tile-accounts', accounts(phone).map(account => account.startsWith('@') ? account : `@${account}`).join(' · ') || 'No accounts saved');
        text(tile, '.scroll-label', scrolling.has(phone.udid) ? '● Scrolling' : 'Manual control');
        tile.querySelector('button').disabled = Boolean(phone.disabled || !phone.connected);
        // Keep each live stream mounted across status polls. Hidden tiles release their streams.
        if (tile.hidden) {
            const image = tile.querySelector('img');
            image.removeAttribute('src');
            image.dataset.kind = 'off';
        }
        else
            syncPreview(phone, tile, snapshot);
    }
    for (const [id, tile] of tiles)
        if (!phones.some(phone => phone.udid === id)) {
            tile.querySelector('img').removeAttribute('src');
            tile.remove();
            tiles.delete(id);
            if (selected === id)
                closeControls();
        }
    el('count-total').textContent = String(phones.length);
    el('count-connected').textContent = String(phones.filter(phone => phone.connected && !phone.disabled).length);
    el('count-scrolling').textContent = String(scrolling.size);
    el('count-attention').textContent = String(phones.filter(phone => !phone.connected && !phone.disabled).length);
    el('fleet-empty').hidden = visible > 0;
    el('fleet-empty-message').textContent = phones.length ? 'No phones match this search or filter.' : 'Connect an iPhone to the host Mac and add it to the workspace.';
}
async function refresh() {
    if (refreshing || stopped || document.hidden)
        return;
    refreshing = true;
    try {
        phones = await request('/api/devices');
        await Promise.allSettled(phones.map(async (phone) => {
            if (phone.disabled || !phone.connected) {
                scrolling.delete(phone.udid);
                return;
            }
            const result = await request(`${apiPath(phone)}/instagram/doomscroll`);
            if (result.active)
                scrolling.add(phone.udid);
            else
                scrolling.delete(phone.udid);
        }));
        for (const id of scrolling)
            if (!phones.some(phone => phone.udid === id))
                scrolling.delete(id);
        if (selected && !phones.some(phone => phone.udid === selected && phone.connected && !phone.disabled))
            closeControls();
        render(true);
        const snapshot = JSON.stringify(phones);
        if (snapshot !== tableSnapshot) {
            renderTables();
            tableSnapshot = snapshot;
        }
        el('fleet-message').textContent = `${phones.length} registered · Everyone with workspace access can view and control connected phones.`;
        el('workspace-updated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    catch (error) {
        el('fleet-message').textContent = error instanceof Error ? error.message : 'Workspace unavailable. Refresh to retry.';
    }
    finally {
        refreshing = false;
    }
}
function navigate() {
    view = ['phones', 'accounts', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'phones';
    for (const name of ['phones', 'accounts', 'settings'])
        el(`${name}-view`).hidden = name !== view;
    document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === view));
    el('breadcrumb-title').textContent = ({ phones: 'Phones', accounts: 'Accounts', settings: 'Connections' })[view];
    document.body.classList.remove('nav-open');
    el('nav-toggle').setAttribute('aria-expanded', 'false');
    if (view !== 'phones')
        closeControls();
    render();
}
window.addEventListener('hashchange', navigate);
for (const id of ['fleet-search', 'fleet-filter', 'preview-mode'])
    el(id).addEventListener(id === 'fleet-search' ? 'input' : 'change', () => render());
el('grid-density').addEventListener('change', () => grid.classList.toggle('comfortable', el('grid-density').value === 'comfortable'));
el('refresh-fleet').addEventListener('click', () => { tiles.forEach(tile => { tile.querySelector('img').dataset.kind = 'retry'; }); void refresh(); });
el('nav-toggle').addEventListener('click', () => { const open = document.body.classList.toggle('nav-open'); el('nav-toggle').setAttribute('aria-expanded', String(open)); });
document.addEventListener('visibilitychange', () => { render(); if (!document.hidden)
    void refresh(); });
window.addEventListener('pagehide', () => { stopped = true; window.clearInterval(poll); closeControls(); tiles.forEach(tile => tile.querySelector('img').removeAttribute('src')); });
const poll = window.setInterval(() => void refresh(), 5000);
navigate();
void refresh();
export {};
