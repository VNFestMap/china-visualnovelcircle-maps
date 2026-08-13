import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.VNFEST_PERF_BASE_URL || 'http://127.0.0.1:8097';
const pages = [
  '/index.html?guest=1&lang=ja',
  '/Forum/forum-plaza.html?lang=ja',
  '/submit.html?lang=ja'
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
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
    }
  };
}

async function measure(pagePath, port) {
  const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((item) => item.type === 'page');
  assert.ok(target, 'Chrome must expose a page target');
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const state = window.__i18nPerf = { callbacks: 0, records: 0, callbackMs: 0, longTasks: [], frames: 0 };
      const NativeMutationObserver = window.MutationObserver;
      window.MutationObserver = class extends NativeMutationObserver {
        constructor(callback) {
          super((records, observer) => {
            const started = performance.now();
            state.callbacks += 1;
            state.records += records.length;
            callback(records, observer);
            state.callbackMs += performance.now() - started;
          });
        }
      };
      try {
        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => state.longTasks.push(entry.duration));
        }).observe({ type: 'longtask', buffered: true });
      } catch {}
      requestAnimationFrame(function frame() {
        state.frames += 1;
        requestAnimationFrame(frame);
      });
    })();`
  });
  await cdp.send('Page.navigate', { url: baseUrl + pagePath });
  await delay(3000);
  await cdp.send('Runtime.evaluate', {
    expression: `Object.assign(window.__i18nPerf, {
      callbacks: 0,
      records: 0,
      callbackMs: 0,
      longTasks: [],
      frames: 0
    })`
  });
  await delay(2000);
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const whitespaceLengths = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const value = walker.currentNode.nodeValue || '';
        if (value && !value.trim()) whitespaceLengths.push(value.length);
      }
      const state = window.__i18nPerf;
      return {
        ...state,
        longTaskTotalMs: state.longTasks.reduce((sum, value) => sum + value, 0),
        maxLongTaskMs: Math.max(0, ...state.longTasks),
        maxWhitespaceLength: Math.max(0, ...whitespaceLengths),
        language: document.documentElement.lang
      };
    })()`,
    returnByValue: true
  });
  cdp.close();
  return result.result.value;
}

assert.ok(fs.existsSync(chrome), `Chrome executable not found: ${chrome}`);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vnfest-i18n-perf-'));
const port = 12000 + Math.floor(Math.random() * 2000);
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
  for (const page of pages) {
    const metrics = await measure(page, port);
    console.log(`${page}: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.language, 'ja', `${page} must render in Japanese`);
    const isMapPage = page.startsWith('/index.html');
    assert.ok(metrics.maxLongTaskMs < (isMapPage ? 1000 : 500), `${page} must not enter a translation long-task loop`);
    assert.ok(metrics.records < 5000, `${page} must not enter a mutation feedback loop`);
    assert.ok(metrics.callbackMs < 100, `${page} translation callbacks must remain bounded`);
    assert.ok(metrics.frames >= (isMapPage ? 35 : 60), `${page} must remain responsive during the sample`);
    assert.ok(metrics.maxWhitespaceLength < 10000, `${page} whitespace text must remain bounded`);
  }
  console.log('page i18n performance checks passed');
} finally {
  if (browser.exitCode === null) {
    browser.kill();
    await Promise.race([once(browser, 'exit'), delay(3000)]);
  }
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
