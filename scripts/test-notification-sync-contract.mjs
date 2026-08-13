import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const appSource = readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const notificationStart = appSource.indexOf('// 通知系统');
const notificationEnd = appSource.indexOf('// 全站公告横幅', notificationStart);
assert.ok(notificationStart >= 0 && notificationEnd > notificationStart, 'notification module should be present in js/app.js');

const notificationSource = appSource.slice(notificationStart, notificationEnd);
const apiSource = readFileSync(path.join(root, 'api', 'notifications.php'), 'utf8');

// checkAuth dispatches on window, so the notification lifecycle must listen on window too.
assert.match(notificationSource, /window\.addEventListener\('auth:updated'/, 'notification polling should start after the window auth event');
assert.doesNotMatch(notificationSource, /document\.addEventListener\('auth:updated'/, 'notification polling must not listen on a different event target');

// Fresh unread counts must not be served from a browser or intermediary cache.
assert.match(notificationSource, /cache:\s*'no-store'/, 'notification fetches should bypass the browser cache');
assert.match(apiSource, /Cache-Control:\s*no-store, no-cache, must-revalidate, max-age=0/, 'notification responses should disable HTTP caching');

// Reading in one open tab should refresh the red dot in the others without waiting for polling.
assert.match(notificationSource, /BroadcastChannel/, 'notification module should coordinate open tabs when BroadcastChannel is available');
assert.match(notificationSource, /window\.addEventListener\('storage'/, 'notification module should retain a cross-tab fallback');

// Mutation responses provide the resulting count so the initiating tab updates immediately.
assert.match(apiSource, /case 'mark_read':[\s\S]*?'unread_count'\s*=>\s*\$unreadCount/, 'mark_read should return the remaining unread count');
assert.match(apiSource, /case 'mark_all_read':[\s\S]*?'unread_count'\s*=>\s*\$unreadCount/, 'mark_all_read should return the remaining unread count');

// Exercise the actual notification IIFE with a logged-in bell. This catches the
// original failure mode: checkAuth dispatched on window but polling listened on document.
const windowListeners = new Map();
const documentListeners = new Map();
const intervals = [];
const requests = [];
const channels = [];
let failUnreadRequest = false;
const bellWrap = { style: { display: 'none' } };
const badge = { style: {}, textContent: '' };

function makeElement() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contains() { return false; },
    innerHTML: '',
  };
}

function addListener(registry, type, listener) {
  const listeners = registry.get(type) || [];
  listeners.push(listener);
  registry.set(type, listeners);
}

function emit(registry, type, event = {}) {
  for (const listener of registry.get(type) || []) listener(event);
}

function FakeBroadcastChannel() {
  this.listeners = new Map();
  channels.push(this);
}
FakeBroadcastChannel.prototype.addEventListener = function (type, listener) {
  this.listeners.set(type, listener);
};
FakeBroadcastChannel.prototype.postMessage = function () {};
FakeBroadcastChannel.prototype.emit = function (data) {
  this.listeners.get('message')?.({ data });
};

const sandbox = {
  console,
  Date,
  Number,
  Math,
  Promise,
  setTimeout,
  clearTimeout,
  setInterval(handler) {
    intervals.push(handler);
    return intervals.length;
  },
  clearInterval() {},
  localStorage: { setItem() {} },
  fetch(url, options) {
    requests.push({ url, options });
    if (failUnreadRequest) return Promise.reject(new Error('temporary network failure'));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, count: 3 }) });
  },
  document: {
    hidden: false,
    body: makeElement(),
    getElementById(id) {
      if (id === 'notifBellWrap') return bellWrap;
      if (id === 'notifBadge') return badge;
      return null;
    },
    addEventListener(type, listener) { addListener(documentListeners, type, listener); },
    createElement: makeElement,
  },
  window: {
    BroadcastChannel: FakeBroadcastChannel,
    addEventListener(type, listener) { addListener(windowListeners, type, listener); },
  },
};

vm.runInNewContext(notificationSource, sandbox, { filename: 'js/app.js notification module' });
bellWrap.style.display = '';
emit(windowListeners, 'auth:updated');
await new Promise((resolve) => setImmediate(resolve));

assert.equal(intervals.length, 1, 'window auth event should start notification polling immediately after login');
assert.equal(requests.length, 1, 'starting notification polling should fetch the unread count immediately');
assert.equal(requests[0].options.cache, 'no-store', 'unread fetch should bypass the browser cache');
assert.equal(badge.textContent, 3, 'fresh unread count should update the red-dot badge');

channels[0].emit({ type: 'notification-sync' });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requests.length, 2, 'a sync event from another tab should refresh this tab immediately');

failUnreadRequest = true;
emit(windowListeners, 'focus');
await new Promise((resolve) => setImmediate(resolve));
assert.equal(badge.textContent, 3, 'a transient unread request failure must not clear the existing red dot');

console.log('notification sync contract checks passed');
