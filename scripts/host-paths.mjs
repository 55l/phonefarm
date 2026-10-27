import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
export function postgresBin(name) {
    const candidates = [process.env.PHONE_FARM_POSTGRES_BIN, '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin'].filter(Boolean);
    for (const folder of candidates) {
        const executable = path.join(folder, name);
        if (fs.existsSync(executable)) return executable;
    }
    try {
        const prefix = execFileSync('brew', ['--prefix', 'postgresql@16'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const executable = path.join(prefix, 'bin', name);
        if (fs.existsSync(executable)) return executable;
    } catch {}
    throw new Error('PostgreSQL 16 was not found. Install it with brew install postgresql@16.');
}
