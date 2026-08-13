import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.VNFEST_RETURN_BASE_URL || 'http://127.0.0.1:8097';
const legacyIds = [
  'invertCtrlSwitch', 'themeSwitch', 'langZhBtn', 'langJaBtn',
  'listInvertCtrl', 'listThemeSwitch', 'listLangZhBtn', 'listLangJaBtn',
  'invertCtrlSwitchDrawer', 'themeSwitchDrawer', 'langZhBtnDrawer', 'langJaBtnDrawer'
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const promise = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) promise.reject(new Error(message.error.message));
    else promise.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() { socket.close(); }
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
  return result.result.value;
}

assert.ok(fs.existsSync(chrome), `Chrome executable not found: ${chrome}`);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vnfest-index-return-'));
const port = 14000 + Math.floor(Math.random() * 1000);
const browser = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--ignore-certificate-errors',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank'
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((item) => item.type === 'page');
  assert.ok(target, 'Chrome must expose a page target');
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__vnfestPageShows = [];
      addEventListener('pageshow', (event) => {
        window.__vnfestPageShows.push({ persisted: event.persisted, href: location.href });
      });`
  });

  await cdp.send('Page.navigate', { url: `${baseUrl}/index.html?guest=1&lang=ja` });
  await delay(4000);
  await evaluate(cdp, `(() => {
    const intro = document.getElementById('introCard');
    if (!intro) throw new Error('introCard missing');
    intro.insertAdjacentHTML('beforeend', \
      '<label class="md3-switch"><input id="invertCtrlSwitch" type="checkbox"><span>操作を反転</span></label>' +
      '<label class="md3-switch"><input id="themeSwitch" type="checkbox"><span>テーマ：ライト</span></label>' +
      '<div class="lang-switch-group"><button id="langZhBtn">中文</button><button id="langJaBtn">日本語</button></div>');
    window.__vnfestInjectedLegacyControls = true;
    return ${JSON.stringify(legacyIds)}.filter((id) => document.getElementById(id)).length;
  })()`);

  await evaluate(cdp, `(() => {
    let event;
    try {
      event = new PageTransitionEvent('pageshow', { persisted: true });
    } catch {
      event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: true });
    }
    window.dispatchEvent(event);
  })()`);
  await delay(500);
  const restoredPageEvidence = await evaluate(cdp, `({
    pageShows: window.__vnfestPageShows || [],
    remainingLegacyIds: ${JSON.stringify(legacyIds)}.filter((id) => document.getElementById(id))
  })`);
  console.log(JSON.stringify({ restoredPageEvidence }, null, 2));
  assert.ok(restoredPageEvidence.pageShows.some((event) => event.persisted), 'test must dispatch a persisted pageshow event');
  assert.deepEqual(restoredPageEvidence.remainingLegacyIds, [], 'persisted page restoration must remove legacy preference controls');

  await cdp.send('Page.navigate', { url: `${baseUrl}/feedback.html?lang=ja` });
  await delay(1500);
  await evaluate(cdp, 'history.back()');
  await delay(2500);

  const evidence = await evaluate(cdp, `({
    href: location.href,
    restoredMarker: window.__vnfestInjectedLegacyControls === true,
    pageShows: window.__vnfestPageShows || [],
    remainingLegacyIds: ${JSON.stringify(legacyIds)}.filter((id) => document.getElementById(id))
  })`);
  console.log(JSON.stringify(evidence, null, 2));
  assert.deepEqual(evidence.remainingLegacyIds, [], 'legacy preference controls must be removed after returning to the map');
  cdp.close();
  console.log('index return preference cleanup test passed');
} finally {
  if (browser.exitCode === null) {
    browser.kill();
    await Promise.race([once(browser, 'exit'), delay(3000)]);
  }
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
