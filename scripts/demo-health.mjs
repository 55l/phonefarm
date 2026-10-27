import { resolve4 } from 'node:dns/promises';

/** A live process is insufficient: Cloudflare can retire a quick-tunnel URL. */
export async function demoReachable(url, fetcher = fetch, resolveHost = resolve4) {
    try {
        // Avoid poisoning macOS's negative hostname cache while Cloudflare is
        // still publishing a brand-new quick-tunnel DNS record.
        await resolveHost(new URL(url).hostname);
        const response = await fetcher(`${url}/auth/login`, {
            redirect: 'manual', signal: AbortSignal.timeout(10000),
        });
        if (response.status !== 200) return false;
        const html = await response.text();
        return /action=["']\/auth\/login["']/.test(html) && /name=["']password["']/.test(html);
    } catch { return false; }
}
