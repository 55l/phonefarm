const list = document.querySelector('#candidate-list');
const status = document.querySelector('#registration-status');
async function candidates() {
    list.textContent = 'Looking for phones…';
    try {
        const response = await fetch('/api/device-registrations/candidates');
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error ?? 'Could not read connected devices.');
        list.replaceChildren();
        for (const device of data.devices) {
            const row = document.createElement('div');
            row.className = 'panel';
            const title = document.createElement('h3');
            title.textContent = device.name;
            const description = document.createElement('p');
            description.textContent = `iOS ${device.osVersion}`;
            const button = document.createElement('button');
            button.className = 'button primary';
            button.textContent = 'Add to workspace';
            button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    const result = await fetch('/api/devices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: device.name, udid: device.udid, pluginData: {} }) });
                    const body = await result.json();
                    if (!result.ok)
                        throw new Error(body.error ?? 'Could not register the phone.');
                    location.href = `/devices/${encodeURIComponent(device.udid)}`;
                }
                catch (error) {
                    status.textContent = error.message;
                    button.disabled = false;
                }
            });
            row.append(title, description, button);
            list.append(row);
        }
        if (!data.devices.length)
            list.textContent = 'No unregistered phones found. Your saved phones are on the Devices page.';
    }
    catch (error) {
        list.textContent = error.message;
    }
}
document.querySelector('#refresh-candidates').addEventListener('click', () => void candidates());
void candidates();
export {};
