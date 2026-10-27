import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const env = { ...process.env, APPIUM_HOME: path.join(root, '.appium2'), npm_config_ignore_scripts: 'true' };
const driver = path.join(root, '.appium2/node_modules/appium-xcuitest-driver');
if (!fs.existsSync(path.join(driver, 'package.json'))) {
    execFileSync(process.execPath, ['node_modules/appium/index.js', 'driver', 'install', 'xcuitest@12.21.0'], { env, stdio: 'inherit' });
}
// The published driver bundles dependencies, so root-level overrides alone do
// not replace its vulnerable copies. Apply the fixes inside the driver too.
const manifest = path.join(driver, 'package.json');
const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (pkg.version !== '12.21.0') throw new Error('Review driver compatibility before using a different version.');
pkg.overrides = { ...pkg.overrides, 'shell-quote': '^1.12.0', 'body-parser': '^2.4.0', 'bplist-parser': '0.3.2' };
fs.writeFileSync(manifest, JSON.stringify(pkg, null, 2) + '\n');
execFileSync('npm', ['update', '--prefix', driver, '--omit=dev', '--ignore-scripts', '--no-fund'], { env, stdio: 'inherit' });
execFileSync('npm', ['audit', '--prefix', driver], { env, stdio: 'inherit' });
console.log('Driver dependencies checked. Run npm run wda:prepare to reapply WDA patches and build.');
