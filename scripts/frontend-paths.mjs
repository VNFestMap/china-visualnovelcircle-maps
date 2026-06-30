import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join, relative } from 'path';

export const API_BASE = 'https://162.251.93.178';

const REWRITABLE_EXTENSIONS = new Set(['.html', '.js']);
const URL_LITERAL_PATTERN = /(['"`])((?:\.\.?\/)*)(api|data)\//g;

function shouldRewriteFile(filePath) {
  return REWRITABLE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function replaceFrontendPaths(filePath, rootDir) {
  if (!shouldRewriteFile(filePath)) return false;

  const original = readFileSync(filePath, 'utf8');
  const content = original
    .replace(URL_LITERAL_PATTERN, (_match, quote, _prefix, segment) => {
      return `${quote}${API_BASE}/${segment}/`;
    })
    .replace(/https:\/\/www\.map\.vnfest\.top/g, API_BASE);

  if (content === original) return false;

  writeFileSync(filePath, content, 'utf8');
  console.log(`  rewrote: ${relative(rootDir, filePath)}`);
  return true;
}

export function rewriteFrontendPaths(dir, rootDir) {
  if (!existsSync(dir)) return 0;

  let replaced = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile()) {
      if (replaceFrontendPaths(fullPath, rootDir)) replaced++;
    } else if (entry.isDirectory()) {
      replaced += rewriteFrontendPaths(fullPath, rootDir);
    }
  }
  return replaced;
}
