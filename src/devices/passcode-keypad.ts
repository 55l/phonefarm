import type { ScreenSize } from './wda-remote.js';
interface Node {
    type?: string; name?: unknown; label?: unknown; value?: unknown; isVisible?: unknown;
    rect?: { x: number; y: number; width: number; height: number }; children?: Node[];
}
export interface DetectedKeypad {
    digits: Map<string, { x: number; y: number }>;
    enteredDigits: number | null;
    expectedDigits?: number;
}
/** Read the visible system keypad, never infer positions from an unrelated device profile. */
export function detectPasscodeKeypad(source: unknown, size: ScreenSize): DetectedKeypad | undefined {
    const digits = new Map<string, { x: number; y: number }>();
    let field: Node | undefined;
    let ambiguous = false;
    const walk = (node: Node) => {
        if (!node || typeof node !== 'object') return;
        const visible = node.isVisible === true || node.isVisible === 1 || node.isVisible === '1';
        if (visible && node.type === 'SecureTextField') field = node;
        if (visible && ['Key', 'Button'].includes(node.type ?? '')) {
            const digit = [node.name, node.label].find(value => typeof value === 'string' && /^\d$/.test(value));
            const r = node.rect;
            if (typeof digit === 'string' && r && [r.x, r.y, r.width, r.height].every(Number.isFinite)
                && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0
                && r.x + r.width <= size.width + 1 && r.y + r.height <= size.height + 1) {
                const point = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
                const old = digits.get(digit);
                if (old && (old.x !== point.x || old.y !== point.y)) ambiguous = true;
                digits.set(digit, point);
            }
        }
        for (const child of node.children ?? []) walk(child);
    };
    walk(source as Node);
    if (ambiguous || digits.size !== 10 || !field) return;
    const value = String(field.value ?? '');
    const counts = value.match(/^\s*(\d+)\s+of\s+(\d+)\s+values?\s+entered\s*$/i);
    return { digits, enteredDigits: counts ? Number(counts[1]) : value === '' ? 0 : null,
        ...(counts ? { expectedDigits: Number(counts[2]) } : {}) };
}
