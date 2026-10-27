import { setTimeout as delay } from 'node:timers/promises';

export interface ScrollOptions { durationMinutes: number; intervalSeconds: number }
export interface ScrollSnapshot extends ScrollOptions {
    status: 'starting' | 'running' | 'stopping' | 'completed' | 'stopped' | 'failed';
    scrollCount: number;
    startedAt: string | null;
    endsAt: string | null;
    error?: string;
}
export interface ScrollDevice {
    prepare(): Promise<void>;
    screen(): Promise<{ width: number; height: number }>;
    isInstagramActive(): Promise<boolean>;
    swipe(startX: number, startY: number, endX: number, endY: number, durationMs: number): Promise<void>;
    close(): Promise<void>;
}
export function validateScrollOptions(value: unknown): ScrollOptions {
    const input = value as Partial<ScrollOptions> | null;
    const durationMinutes = input?.durationMinutes;
    const intervalSeconds = input?.intervalSeconds ?? 5;
    if (!Number.isInteger(durationMinutes) || typeof durationMinutes !== 'number' || durationMinutes < 1 || durationMinutes > 180) {
        throw new Error('Choose a duration from 1 to 180 minutes.');
    }
    if (!Number.isInteger(intervalSeconds) || intervalSeconds < 2 || intervalSeconds > 30) {
        throw new Error('Choose 2 to 30 seconds between scrolls.');
    }
    return { durationMinutes, intervalSeconds };
}
export class InstagramScrollSession {
    private controller = new AbortController();
    private state: ScrollSnapshot;
    private finished = false;
    readonly done: Promise<void>;
    constructor(options: ScrollOptions, private device: ScrollDevice, private clock = {
        now: () => Date.now(),
        pause: (ms: number, signal: AbortSignal) => delay(ms, undefined, { signal }),
    }) {
        this.state = { ...validateScrollOptions(options), status: 'starting', scrollCount: 0, startedAt: null, endsAt: null };
        this.done = this.run();
    }
    snapshot(): ScrollSnapshot & { active: boolean } { return { ...this.state, active: !this.finished }; }
    isActive(): boolean { return !this.finished; }
    stop(): void {
        if (!['starting', 'running'].includes(this.state.status)) return;
        this.state.status = 'stopping';
        this.controller.abort();
    }
    private async run(): Promise<void> {
        const signal = this.controller.signal;
        try {
            await this.device.prepare();
            signal.throwIfAborted();
            const size = await this.device.screen();
            if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 100 || size.height < 100) {
                throw new Error('The phone returned an invalid screen size.');
            }
            signal.throwIfAborted();
            const start = this.clock.now();
            const deadline = start + this.state.durationMinutes * 60_000;
            this.state.startedAt = new Date(start).toISOString();
            this.state.endsAt = new Date(deadline).toISOString();
            this.state.status = 'running';
            while (this.clock.now() < deadline) {
                await this.clock.pause(Math.min(this.state.intervalSeconds * 1000, deadline - this.clock.now()), signal);
                signal.throwIfAborted();
                if (this.clock.now() >= deadline) break;
                if (!(await this.device.isInstagramActive())) throw new Error('Instagram is no longer in the foreground. Scrolling stopped.');
                signal.throwIfAborted();
                if (this.clock.now() >= deadline) break;
                const x = Math.round(size.width * .5);
                await this.device.swipe(x, Math.round(size.height * .72), x, Math.round(size.height * .28), 450);
                this.state.scrollCount += 1;
                signal.throwIfAborted();
            }
            signal.throwIfAborted();
            this.state.status = 'completed';
        } catch (error) {
            if (signal.aborted) this.state.status = 'stopped';
            else { this.state.status = 'failed'; this.state.error = error instanceof Error ? error.message : String(error); }
        } finally {
            try { await this.device.close(); }
            catch (error) {
                if (this.state.status === 'completed') {
                    this.state.status = 'failed';
                    this.state.error = `Scrolling finished, but the control session could not close: ${error instanceof Error ? error.message : String(error)}`;
                }
            }
            this.finished = true;
        }
    }
}
