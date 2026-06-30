const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8097';
const smokeLanguage = process.env.SMOKE_LANGUAGE || '';
const smokePerf = process.env.SMOKE_PERF === '1';
const args = new Set(process.argv.slice(2));
const smokeViewport = args.has('--all-viewports') ? 'all' : (process.env.SMOKE_VIEWPORT || 'desktop');
const smokePerfOutput = process.env.SMOKE_PERF_OUTPUT || '';
const viewportNames = smokeViewport === 'all' ? ['desktop', 'tablet', 'mobile'] : [smokeViewport];
const viewportSizes = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1366, height: 900 },
};
const defaultPages = [
  '/index.html?guest=1',
  '/submit.html',
  '/feedback.html',
  '/user.html',
  '/star_map.html',
  '/wiki/index.html',
];
const moePages = [
  '/moe/index.html',
  '/moe/contest.html?id=999999',
  '/moe/bracket.html?project_id=999999',
];
const pageFilter = (process.env.SMOKE_PAGES || '').split(',').map((item) => item.trim()).filter(Boolean);
const pages = args.has('--moe') ? moePages : (pageFilter.length ? pageFilter : defaultPages);

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function inspectPage(pagePath, viewportName) {
  const viewportSize = viewportSizes[viewportName] || viewportSizes.desktop;
  const win = new BrowserWindow({
    show: false,
    width: viewportSize.width,
    height: viewportSize.height,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const consoleErrors = [];
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2 && !message.includes('Electron Security Warning')) {
      consoleErrors.push(`${message} (${sourceId}:${line})`);
    }
  });

  const url = new URL(pagePath, baseUrl).toString();
  let loadFailure = null;
  const startedAt = Date.now();
  try {
    await win.loadURL(url, { userAgent: 'GalgameMapSmoke/1.0' });
    if (smokeLanguage === 'ja' || smokeLanguage === 'zh') {
      await win.webContents.executeJavaScript(`localStorage.setItem('language', ${JSON.stringify(smokeLanguage)});`);
      await win.reload();
    }
  } catch (error) {
    loadFailure = error.message;
  }
  await sleep(1200);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      async function sampleFrames(duration) {
        return await new Promise((resolve) => {
          const start = performance.now();
          const deltas = [];
          let previous = start;
          function tick(now) {
            deltas.push(now - previous);
            previous = now;
            if (now - start >= duration) {
              const sorted = deltas.slice().sort((a, b) => a - b);
              const over50 = deltas.filter((value) => value > 50).length;
              resolve({
                frameSamples: deltas.length,
                avgFrameMs: deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length),
                p95FrameMs: sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] || 0,
                longFrameCount: over50
              });
              return;
            }
            requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const resourceBytes = resources.reduce((sum, item) => sum + (item.transferSize || item.encodedBodySize || 0), 0);
      const localBrokenImages = Array.from(document.images).filter((img) => {
        if (!img.currentSrc) return false;
        const url = new URL(img.currentSrc, location.href);
        return url.origin === location.origin && img.complete && img.naturalWidth === 0;
      }).map((img) => img.getAttribute('src') || img.currentSrc);
      const frameStats = ${smokePerf ? 'await sampleFrames(700)' : 'null'};
      const isV2 = document.documentElement.getAttribute('data-ui') === 'v2';
      const mobileNavigation = (() => {
        if (location.pathname !== '/index.html') return null;
        if (isV2) {
          const modes = Array.from(document.querySelectorAll('.map-v2-nav > .map-v2-mobile-mode'));
          const shortcuts = document.querySelector('.map-v2-mobile-shortcuts');
          return {
            variant: 'v2',
            visible: modes.length === 3 && modes.every((item) => getComputedStyle(item).display !== 'none'),
            modeCount: modes.length,
            countryCount: document.querySelectorAll('.map-v2-mobile-shortcuts [data-v2-country]').length,
            utilityCount: document.querySelectorAll('.map-v2-mobile-utilities > *').length,
            shortcutsVisible: Boolean(shortcuts && getComputedStyle(shortcuts).display !== 'none')
          };
        }
        const nav = document.getElementById('mobileModeNav');
        return {
          variant: 'legacy',
          visible: Boolean(nav && getComputedStyle(nav).display !== 'none'),
          modeCount: nav ? nav.querySelectorAll('.mode-tab').length : 0,
          countryCount: document.querySelectorAll('#userNavRow .mobile-country-nav > *').length,
          utilityCount: document.querySelectorAll('#userNavRow .mobile-utility-nav > *').length,
          shortcutsVisible: true
        };
      })();
      return {
        title: document.title,
        finalUrl: location.href,
        bodyTextLength: (document.body && document.body.innerText || '').trim().length,
        localBrokenImages,
        perf: {
          domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : 0,
          loadEventMs: navigation ? Math.round(navigation.loadEventEnd) : 0,
          resourceCount: resources.length,
          resourceBytes,
          jsHeapUsed: performance.memory ? performance.memory.usedJSHeapSize : 0,
          frameStats
        },
        mobileNavigation
      };
    })();
  `);

  win.destroy();
  return {
    pagePath,
    viewport: viewportName,
    wallTimeMs: Date.now() - startedAt,
    loadFailure,
    consoleErrors,
    ...result
  };
}

app.whenReady().then(async () => {
  const failures = [];
  const results = [];
  for (const viewportName of viewportNames) {
    for (const pagePath of pages) {
      const result = await inspectPage(pagePath, viewportName);
      results.push(result);
      const redirectedToLogin = result.loadFailure && result.loadFailure.includes('ERR_ABORTED') && result.finalUrl.includes('/login.html');
      const expectsMobileNavigation = result.mobileNavigation && (viewportSizes[viewportName] || viewportSizes.desktop).width <= 800;
      const invalidMobileNavigation = expectsMobileNavigation && (
        !result.mobileNavigation.visible ||
        !result.mobileNavigation.shortcutsVisible ||
        result.mobileNavigation.modeCount !== 3 ||
        result.mobileNavigation.countryCount !== 3 ||
        result.mobileNavigation.utilityCount !== 2
      );
      const hasFailure = (result.loadFailure && !redirectedToLogin) || result.bodyTextLength < 20 || result.localBrokenImages.length || result.consoleErrors.length || invalidMobileNavigation;
      if (hasFailure) failures.push(result);
      const perfLabel = smokePerf && result.perf
        ? ` load=${result.perf.loadEventMs}ms wall=${result.wallTimeMs}ms resources=${result.perf.resourceCount}`
        : '';
      console.log(`${hasFailure ? 'FAIL' : 'OK'} ${viewportName} ${pagePath} ${result.title || ''}${perfLabel}`);
    }
  }

  if (smokePerfOutput) {
    const outputPath = path.resolve(process.cwd(), smokePerfOutput);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      baseUrl,
      language: smokeLanguage || 'default',
      viewport: smokeViewport,
      generatedAt: new Date().toISOString(),
      results
    }, null, 2));
  }

  await app.quit();
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
});
