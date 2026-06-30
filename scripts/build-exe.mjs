/**
 * Build Windows packages for the static client.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { buildWww } from './build-www.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const appName = 'Galgame同好会地图';

if (existsSync(DIST)) {
  console.log('Cleaning dist/ ...');
  rmSync(DIST, { recursive: true, force: true });
}

buildWww();

console.log('Building Windows package with electron-packager...');
execSync(
  [
    'npx electron-packager .',
    `"${appName}"`,
    '--platform=win32',
    '--arch=x64',
    '--out=dist',
    '--overwrite',
    '--icon=images/logo.ico',
    `--app-version=${pkg.version}`,
    '--electron-version=33.4.11',
    '--prune=true',
    '--ignore="^/(api|admin|includes|data|uploads|scripts|docs|android|dist|www/.*\\.map$|\\.git|\\.agents|\\.codex)"',
  ].join(' '),
  { cwd: ROOT, stdio: 'inherit' }
);

console.log('\nWindows package complete.');
console.log('Output: ' + relative(ROOT, DIST));
