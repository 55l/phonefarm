import { execFileSync } from 'node:child_process';

export function resolveDeveloperDir(): string {
    return process.env.XCODE_DEVELOPER_DIR ?? execFileSync('xcode-select', ['-p'], { encoding: 'utf8' }).trim();
}
