import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const displayRuntime = fs.readFileSync(path.join(root, 'js', 'display-preferences.js'), 'utf8');
const wallpaperRuntime = fs.readFileSync(path.join(root, 'js', 'page-background.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const userShell = fs.readFileSync(path.join(root, 'user.html'), 'utf8');
const userApp = fs.readFileSync(path.join(root, 'user-v2-react', 'src', 'App.jsx'), 'utf8');
const guestWallpaper = path.join(root, 'image', 'background', 'Defaultwallpaper.jpg');

const storage = new Map();
const windowStub = {
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  dispatchEvent() {},
  CustomEvent: class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  },
};
vm.runInNewContext(displayRuntime, { window: windowStub, CustomEvent: windowStub.CustomEvent });

assert.equal(windowStub.VNFDisplayPreferences.getMapInvert(), true, 'map inversion should default to enabled');
assert.equal(windowStub.VNFDisplayPreferences.setMapInvert(false), false, 'map inversion should accept disabled state');
assert.equal(storage.get('vnfestMapInvertControls'), '0', 'disabled map inversion should persist as 0');
assert.equal(windowStub.VNFDisplayPreferences.getMapInvert(), false, 'saved disabled map inversion should be read');
assert.equal(windowStub.VNFDisplayPreferences.setMapInvert(true), true, 'map inversion should be re-enabled');
assert.equal(storage.get('vnfestMapInvertControls'), '1', 'enabled map inversion should persist as 1');

for (const id of [
  'invertCtrlSwitch', 'themeSwitch', 'listInvertCtrl', 'listThemeSwitch',
  'invertCtrlSwitchDrawer', 'themeSwitchDrawer',
]) {
  assert.ok(!indexSource.includes(`id="${id}"`), `index should not render ${id}`);
}
assert.match(indexSource, /js\/display-preferences\.js/, 'index should load shared display preferences');
assert.match(appSource, /VNFDisplayPreferences\.getMapInvert/, 'map should initialize inversion from shared preferences');

assert.match(userShell, /js\/display-preferences\.js/, 'user center should load display preferences');
assert.match(userShell, /js\/page-background\.js/, 'user center should load wallpaper runtime');
assert.match(userApp, /key:\s*['"]preferences['"]/, 'user center should expose a preferences navigation item');
assert.match(userApp, /偏好设置/, 'user center should label the preferences screen');
for (const mode of ['light', 'dark', 'system']) {
  assert.match(userApp, new RegExp(`['"]${mode}['"]`), `user center should support ${mode} theme mode`);
}
assert.match(userApp, /VNFWallpaper/, 'wallpaper gallery should use the shared wallpaper runtime');
assert.match(userApp, /VNFDisplayPreferences/, 'map inversion control should use the shared preference runtime');

assert.match(wallpaperRuntime, /window\.VNFWallpaper\s*=/, 'wallpaper runtime should expose its shared API');
assert.match(wallpaperRuntime, /Defaultwallpaper\.jpg/, 'wallpaper runtime should reserve the guest default filename');
assert.ok(fs.existsSync(guestWallpaper), 'guest default wallpaper asset must exist');
assert.ok(fs.statSync(guestWallpaper).size > 0, 'guest default wallpaper asset must not be empty');
assert.doesNotMatch(wallpaperRuntime, /vnfestWallpaperPicker|data-picker|data-anchor/, 'wallpaper runtime should not create page-local pickers');

const htmlFiles = [];
function collectHtml(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'user-v2-assets', 'dist', 'dist2', 'build'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(target);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(target);
  }
}
collectHtml(root);
const wallpaperPages = htmlFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('page-background.js'));
assert.ok(wallpaperPages.length >= 22, `expected all wallpaper consumers plus user center, got ${wallpaperPages.length}`);
for (const file of wallpaperPages) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /data-picker|data-anchor|vnfestWallpaperPicker|forumWallpaperAnchor/, `${path.relative(root, file)} should not expose a wallpaper picker`);
}

console.log('display preference and centralized wallpaper contracts passed');
