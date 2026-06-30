import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const endpoint = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9224';
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8097';
const outputDir = path.resolve('artifacts/mobile-navigation-browser');
fs.mkdirSync(outputDir, { recursive: true });

const targets = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page');
assert.ok(target?.webSocketDebuggerUrl, 'Chrome CDP page target is unavailable');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const eventWaiters = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  const waiters = eventWaiters.get(message.method);
  if (!waiters?.length) return;
  eventWaiters.delete(message.method);
  waiters.forEach((resolve) => resolve(message.params));
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function waitForEvent(method, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
    const complete = (params) => {
      clearTimeout(timer);
      resolve(params);
    };
    const waiters = eventWaiters.get(method) || [];
    waiters.push(complete);
    eventWaiters.set(method, waiters);
  });
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Runtime evaluation failed');
  }
  return result.result.value;
}

async function openPage(url, width, height) {
  await command('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 800
  });
  const loaded = waitForEvent('Page.loadEventFired');
  await command('Page.navigate', { url });
  await loaded;
  await pause(1400);
}

async function capture(name) {
  const screenshot = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });
  fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
}

const inspectExpression = `(() => {
  const isV2 = document.documentElement.getAttribute('data-ui') === 'v2';
  const mobile = innerWidth <= 800;
  const nav = isV2 ? document.querySelector('.map-v2-nav') : document.getElementById('mobileModeNav');
  const modes = isV2
    ? Array.from(document.querySelectorAll('.map-v2-nav > .map-v2-mobile-mode'))
    : Array.from(document.querySelectorAll('#mobileModeNav > .mode-tab'));
  const countries = isV2
    ? Array.from(document.querySelectorAll('.map-v2-mobile-countries > *'))
    : Array.from(document.querySelectorAll('#userNavRow .mobile-country-nav > *'));
  const utilities = isV2
    ? Array.from(document.querySelectorAll('.map-v2-mobile-utilities > *'))
    : Array.from(document.querySelectorAll('#userNavRow .mobile-utility-nav > *'));
  const heights = [...modes, ...countries, ...utilities]
    .map((item) => item.getBoundingClientRect().height)
    .filter((height) => height > 0);
  const extras = isV2
    ? document.querySelector('.map-v2-mobile-shortcut-extras')
    : document.querySelector('#userInfoCard .mobile-utility-nav');
  return {
    isV2,
    mobile,
    navVisible: Boolean(nav && getComputedStyle(nav).display !== 'none'),
    visibleModeCount: modes.filter((item) => getComputedStyle(item).display !== 'none').length,
    countryCount: countries.length,
    utilityCount: utilities.length,
    extrasVisible: Boolean(extras && extras.getBoundingClientRect().height > 0),
    minTargetHeight: heights.length ? Math.min(...heights) : 0,
    theme: document.documentElement.getAttribute('data-theme')
  };
})()`;

async function verifyCase(variant, width, height) {
  const query = variant === 'v2' ? '?guest=1&ui=v2' : '?guest=1';
  await openPage(`${baseUrl}/index.html${query}`, width, height);
  const initial = await evaluate(inspectExpression);

  assert.equal(initial.isV2, variant === 'v2', `${variant} should load the expected shell`);
  assert.equal(initial.countryCount, 3, `${variant} should expose three country entries`);
  assert.equal(initial.utilityCount, 2, `${variant} should expose two activity entries`);
  if (width <= 800) {
    assert.equal(initial.navVisible, true, `${variant} bottom navigation should be visible at ${width}px`);
    assert.equal(initial.visibleModeCount, 3, `${variant} should expose three visible modes at ${width}px`);
    assert.ok(initial.minTargetHeight >= 44, `${variant} controls should be at least 44px at ${width}px`);
    assert.equal(initial.extrasVisible, false, `${variant} secondary shortcuts should be collapsed by default`);

    await evaluate(`(${variant === 'v2'
      ? "document.querySelector('#v2ShortcutToggle')"
      : "document.querySelector('#mobileExpandArrow')"})?.click()`);
    await pause(240);
    const expandedState = await evaluate(`(() => {
      const button = ${variant === 'v2'
        ? "document.querySelector('#v2ShortcutToggle')"
        : "document.querySelector('#mobileExpandArrow')"};
      const extras = ${variant === 'v2'
        ? "document.querySelector('.map-v2-mobile-shortcut-extras')"
        : "document.querySelector('#userInfoCard .mobile-utility-nav')"};
      return {
        expanded: button?.getAttribute('aria-expanded'),
        visible: Boolean(extras && extras.getBoundingClientRect().height > 0)
      };
    })()`);
    assert.equal(expandedState.expanded, 'true', `${variant} shortcut toggle should expose its state`);
    assert.equal(expandedState.visible, true, `${variant} shortcut toggle should reveal secondary actions`);

    const switched = await evaluate(`(() => {
      const button = ${variant === 'v2'
        ? "document.querySelector('.map-v2-mobile-mode[data-v2-view=\"list\"]')"
        : "document.querySelector('#mobileModeNav [data-mode=\"list\"]')"};
      button.click();
      return true;
    })()`);
    assert.equal(switched, true);
    await pause(420);
    const listState = await evaluate(`(() => ({
      current: ${variant === 'v2'
        ? "document.querySelector('.map-v2-mobile-mode[data-v2-view=\"list\"]')?.getAttribute('aria-current')"
        : "document.querySelector('#mobileModeNav [data-mode=\"list\"]')?.getAttribute('aria-current')"},
      active: ${variant === 'v2'
        ? "document.querySelector('#vnfestMapV2')?.getAttribute('data-view') === 'list'"
        : "document.documentElement.classList.contains('mobile-list-mode-active')"},
      visibleLabels: ${variant === 'v2'
        ? "Array.from(document.querySelectorAll('.map-v2-nav > *')).filter((item) => getComputedStyle(item).display !== 'none' && item.textContent.trim()).map((item) => item.textContent.trim())"
        : "Array.from(document.querySelectorAll('#listNavRow .user-nav-btn')).filter((item) => item.getBoundingClientRect().height >= 44 && getComputedStyle(item).visibility !== 'hidden').map((item) => item.textContent.trim())"}
    }))()`);
    assert.equal(listState.current, 'page', `${variant} list mode should expose aria-current`);
    assert.equal(listState.active, true, `${variant} list mode should become active`);
    if (variant === 'v2') {
      assert.deepEqual(listState.visibleLabels, ['地图', '列表', '星图'], 'v2 bottom navigation should contain only map, list, and star map');
    } else {
      assert.equal(listState.visibleLabels.length, 3, 'legacy list workspace should keep countries visible while secondary actions stay collapsed');
      await evaluate(`document.querySelector('#listMobileExpandArrow')?.click()`);
      await pause(240);
      const listExpanded = await evaluate(`(() => ({
        expanded: document.querySelector('#listMobileExpandArrow')?.getAttribute('aria-expanded'),
        utilityHeight: document.querySelector('#listMobileUtilityNav')?.getBoundingClientRect().height || 0,
        bodyRows: getComputedStyle(document.querySelector('.list-body')).gridTemplateRows
      }))()`);
      assert.equal(listExpanded.expanded, 'true', 'legacy list shortcut toggle should expand');
      assert.ok(listExpanded.utilityHeight >= 44, 'legacy list utility row should remain touchable');
      assert.ok(listExpanded.bodyRows.split(' ').length >= 2, 'legacy list workspace should keep region and result rows');
    }

    await evaluate(`localStorage.setItem('themePreference', 'dark'); document.documentElement.setAttribute('data-theme', 'dark')`);
    const darkState = await evaluate(`(() => {
      const nav = ${variant === 'v2'
        ? "document.querySelector('.map-v2-nav')"
        : "document.getElementById('mobileModeNav')"};
      return { theme: document.documentElement.getAttribute('data-theme'), background: getComputedStyle(nav).backgroundColor };
    })()`);
    assert.equal(darkState.theme, 'dark');
    assert.notEqual(darkState.background, 'rgba(0, 0, 0, 0)', `${variant} dark navigation needs a visible surface`);
  } else {
    if (variant === 'legacy') {
      assert.equal(initial.navVisible, false, `${variant} mobile navigation should stay hidden at ${width}px`);
    }
  }

  await capture(`${variant}-${width}x${height}`);
  console.log(`OK ${variant} ${width}x${height}`);
}

await command('Page.enable');
await command('Runtime.enable');
await command('Network.enable');
await command('Network.setCacheDisabled', { cacheDisabled: true });

for (const variant of ['legacy', 'v2']) {
  await verifyCase(variant, 390, 844);
  await verifyCase(variant, 768, 1024);
  await verifyCase(variant, 1024, 900);
}

socket.close();
console.log(`mobile navigation browser checks passed; screenshots: ${outputDir}`);
