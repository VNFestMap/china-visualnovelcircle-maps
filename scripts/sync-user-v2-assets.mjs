import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const distAssets = path.join(root, 'user-v2-react', 'dist', 'user-v2-assets');
const publicAssets = path.join(root, 'user-v2-assets');
const userHtmlPath = path.join(root, 'user.html');

if (!fs.existsSync(distAssets)) {
  throw new Error(`用户中心构建目录不存在：${distAssets}。请先运行 user-v2-react 的 build。`);
}

const builtFiles = fs.readdirSync(distAssets).filter((name) => /^index-[^/]+\.(?:js|css)$/.test(name));
const jsFile = builtFiles.find((name) => name.endsWith('.js'));
const cssFile = builtFiles.find((name) => name.endsWith('.css'));
if (!jsFile || !cssFile) {
  throw new Error('用户中心构建结果缺少 index-*.js 或 index-*.css。');
}

fs.mkdirSync(publicAssets, { recursive: true });
for (const file of [jsFile, cssFile]) {
  fs.copyFileSync(path.join(distAssets, file), path.join(publicAssets, file));
}

let html = fs.readFileSync(userHtmlPath, 'utf8');
const jsPattern = /(\.\/user-v2-assets\/)index-[^"']+\.js/;
const cssPattern = /(\.\/user-v2-assets\/)index-[^"']+\.css/;
if (!jsPattern.test(html) || !cssPattern.test(html)) {
  throw new Error('user.html 中没有找到用户中心 JS/CSS 资源引用。');
}
html = html.replace(jsPattern, `$1${jsFile}`).replace(cssPattern, `$1${cssFile}`);
fs.writeFileSync(userHtmlPath, html);

console.log(`同步用户中心资源：${jsFile}、${cssFile}`);
