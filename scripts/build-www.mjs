/**
 * Build the static client bundle used by Electron and Capacitor.
 *
 * The PHP backend stays on the production server. This script copies only
 * client-side assets into www/ and rewrites API/data URLs to that server.
 */

import { execSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'fs';
import { extname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { rewriteFrontendPaths } from './frontend-paths.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const WWW = join(ROOT, 'www');

const ALLOWED_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
]);

const EXCLUDED_TOP_LEVEL = new Set([
  '.agents',
  '.codex',
  '.git',
  '.github',
  '_local',
  'admin',
  'android',
  'api',
  'data',
  'dist',
  'docs',
  'electron',
  'includes',
  'node_modules',
  'scripts',
  'tools',
  'uploads',
  'www',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'package.json',
  'vite.config.js',
  'capacitor.config.json',
  'config.php',
  'config.example.php',
  'deploy-config.example.sh',
  'docker-compose.yml',
  'Dockerfile',
  'README.md',
  'LICENSE',
]);

function shouldExclude(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const topLevel = segments[0];
  if (EXCLUDED_TOP_LEVEL.has(topLevel)) return true;
  if (segments.some((segment) => ['.gstack', '.vite', 'dist', 'docs', 'node_modules', 'src', 'tools'].includes(segment))) {
    return true;
  }
  if (EXCLUDED_FILES.has(normalized)) return true;
  if (EXCLUDED_FILES.has(segments[segments.length - 1])) return true;
  if (normalized.startsWith('image/background/') && !normalized.endsWith('.gitkeep')) return true;
  return false;
}

function copyClientFiles(srcDir, destDir) {
  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const relPath = relative(ROOT, srcPath);
    if (shouldExclude(relPath)) continue;

    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyClientFiles(srcPath, destPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    mkdirSync(destDir, { recursive: true });
    copyFileSync(srcPath, destPath);
  }
}

export function buildWww() {
  console.log('Generating wiki pages...');
  execSync('node scripts/generate-wiki-pages.mjs', { cwd: ROOT, stdio: 'inherit' });

  if (existsSync(WWW)) {
    console.log('Cleaning www/ ...');
    rmSync(WWW, { recursive: true, force: true });
  }
  mkdirSync(WWW, { recursive: true });

  console.log('Copying client files...');
  copyClientFiles(ROOT, WWW);

  console.log('Rewriting API/data paths...');
  const replacedCount = rewriteFrontendPaths(WWW, ROOT);
  console.log(`Rewrote ${replacedCount} file(s).`);

  return { root: ROOT, www: WWW, replacedCount };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildWww();
  console.log('Client bundle ready: ' + relative(result.root, result.www));
}
