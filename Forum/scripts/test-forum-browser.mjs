import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const forumRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(forumRoot, '..');
const outputRoot = process.env.FORUM_BROWSER_OUTPUT
  ? path.resolve(process.env.FORUM_BROWSER_OUTPUT)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'vnfest-forum-browser-'));
fs.mkdirSync(outputRoot, { recursive: true });

const categories = [
  { id: 1, name: '综合讨论', slug: 'general' },
  { id: 2, name: '资源分享', slug: 'resources' },
  { id: 3, name: '活动发布', slug: 'events' },
  { id: 4, name: '作品交流', slug: 'works' },
  { id: 5, name: '求助答疑', slug: 'help' }
];

const fixtureImagePath = path.join(repoRoot, 'data', 'avatars', '100.png');
const fallbackFixtureImagePath = path.join(repoRoot, 'data', 'avatars', '10.jpg');
const fixtureImage = fs.existsSync(fixtureImagePath) ? fixtureImagePath : fallbackFixtureImagePath;

function forumUser(id, nickname, avatarUrl) {
  const displayClub = id === 11
    ? { club_id: 17, country: 'china', name: 'A very long representative club name for truncation', role: 'representative' }
    : id % 2 === 0
      ? { club_id: 3, country: 'japan', name: 'Star Club', role: 'member' }
      : null;
  return { id, username: `fixture_${id}`, nickname, avatar_url: avatarUrl, role: 'visitor', display_club: displayClub };
}

function postItem(id) {
  const hasPreview = id % 3 === 1;
  const avatars = ['data/avatars/10.jpg?t=1', 'data/avatars/999999.png?t=1', ''];
  return {
    id,
    title: id === 1
      ? '【置顶】VNFest 论坛使用说明与本月活动汇总'
      : `第 ${id} 个测试主题：分享一段足够长的标题用于验证两行截断与窄屏布局`,
    scope: 'plaza',
    club_id: null,
    country: null,
    category: categories[id % categories.length],
    tags: id % 2 ? ['Galgame', '活动'] : [],
    author: forumUser(id + 10, id === 4 ? '这是一个非常非常长的昵称用于验证截断与可访问名称' : `同好 ${id}`, avatars[(id - 1) % avatars.length]),
    last_reply_author: id % 2 ? forumUser(90, '最后回复者', '') : null,
    status: 'published',
    is_pinned: id === 1,
    is_essence: id % 6 === 0,
    view_count: id * 73,
    reply_count: id * 2,
    like_count: id * 3,
    favorite_count: id,
    edited_at: id % 4 === 0 ? '2026-08-09 10:30:00' : null,
    created_at: '2026-08-08 09:00:00',
    last_activity_at: `2026-08-09 1${id % 10}:20:00`,
    capabilities: { edit: false, delete: false, report: true, like: true, favorite: true, moderate: false },
    excerpt: hasPreview && id === 1
      ? '这是清理 Markdown 后的两行纯文本摘要，不包含图片语法、文件路径或原始 HTML，用于快速判断主题内容。'
      : '这是清理后的主题摘要，用来验证连续主题流的信息密度和响应式排版。',
    preview_image: hasPreview ? { url: './uploads/fixture.png', width: 1280, height: 720, alt: '活动海报' } : null
  };
}

function listPayload(url) {
  const q = url.searchParams.get('q') || '';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.max(1, Number(url.searchParams.get('limit')) || 20);
  const total = q === 'empty' ? 0 : q === 'short' ? 1 : 21;
  const start = (page - 1) * limit;
  const items = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, index) => postItem(start + index + 1));
  if (q && !['empty', 'short'].includes(q)) items.forEach((item) => { item.match_excerpt = `搜索命中：${item.excerpt}`; });
  return { items, pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
}

function detailPost() {
  const item = postItem(1);
  return Object.assign(item, {
    body_md: '## 从这里开始\n\n这是一段 **真实 Markdown** 正文，用于验证专栏式阅读宽度、行高与图片留白。\n\n![活动海报](uploads/fixture.png)\n\n> 引用内容会继续使用 VNFest 的品牌红和低对比表面。\n\n- 第一项\n- 第二项\n\n```js\nconst forum = "VNFest";\n```',
    liked: false,
    favorited: true,
    capabilities: { edit: true, delete: true, report: true, like: true, favorite: true, moderate: true }
  });
}

function repliesPayload(url) {
  if (Number(url?.searchParams.get('anchor_id')) === 31) {
    return {
      items: [{
        id: 31,
        floor: 31,
        body_md: '这是第 31 条回复，用于验证跨页锚点定位。',
        author: forumUser(61, '第二页回复者', ''),
        parent: null,
        like_count: 0,
        liked: false,
        created_at: '2026-08-09 13:31:00',
        edited_at: null,
        capabilities: { like: true, report: true, edit: false, delete: false }
      }],
      pagination: { page: 2, limit: 30, total: 31, total_pages: 2 }
    };
  }
  const authors = [
    forumUser(31, '第一位回复者', 'data/avatars/10.jpg?t=1'),
    forumUser(32, '这是一个超过常规长度的回复者昵称用于检查窄屏', 'data/avatars/999999.png?t=1'),
    forumUser(33, '无头像回复者', '')
  ];
  const items = authors.map((author, index) => ({
    id: index + 1,
    floor: index + 1,
    body_md: index === 0
      ? '这是一条带有超宽图片的回复，用于验证图片不会突破正文列。\n\n![超宽图片](uploads/fixture.png)'
      : index === 1 ? '### 补充说明\n\n回复也支持 **Markdown** 和 `inline code`。' : '这是一条连续楼层回复，用于验证作者栏和正文的对齐。',
    author,
    parent: index === 2 ? { id: 1, username: 'fixture_31', excerpt: '被引用的安全摘要' } : null,
    like_count: index * 4,
    liked: false,
    created_at: `2026-08-09 12:0${index}:00`,
    edited_at: index === 1 ? '2026-08-09 12:30:00' : null,
    capabilities: { like: true, report: true, edit: index === 0, delete: index === 0 }
  }));
  return { items, pagination: { page: 1, limit: 30, total: items.length, total_pages: 1 } };
}

function json(res, data, status = 200) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
}

function success(data) {
  return { success: true, data };
}

function forumApi(req, res, url) {
  const action = url.searchParams.get('action') || '';
  if (action === 'bootstrap') {
    return json(res, success({
      user: forumUser(10, '浏览器测试用户', 'data/avatars/10.jpg?t=1'),
      categories,
      unread_notifications: 3,
      limits: { title: 100, body: 50000, images: 20, image_bytes: 10485760, tags: 5, tag_length: 20 }
    }));
  }
  if (action === 'list_posts' || action === 'list_mine') return json(res, success(listPayload(url)));
  if (action === 'get_post') {
    if (Number(url.searchParams.get('id')) === 999) return json(res, { success: false, message: '帖子不存在' }, 404);
    return json(res, success(detailPost()));
  }
  if (action === 'list_replies') return json(res, success(repliesPayload(url)));
  if (action === 'list_categories') return json(res, success({ items: categories }));
  if (action === 'upload_image') {
    req.resume();
    return setTimeout(() => json(res, success({
      id: 501,
      path: 'uploads/fixture.png',
      url: './uploads/fixture.png',
      mime_type: 'image/png',
      width: 1280,
      height: 720,
      file_size: 2048,
      original_name: 'fixture.png'
    })), 350);
  }
  if (['delete_upload', 'toggle_like', 'toggle_favorite', 'create_reply', 'create_post', 'update_post'].includes(action)) {
    req.resume();
    return json(res, success({ id: 1, active: true, like_count: 4, favorite_count: 2 }));
  }
  return json(res, { success: false, message: `fixture action not implemented: ${action}` }, 404);
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'
  })[extension] || 'application/octet-stream';
}

let clubDirectoryRequests = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/Forum/api/forum.php') return forumApi(req, res, url);
  if (url.pathname === '/api/clubs.php' || url.pathname === '/api/clubs_japan.php') {
    clubDirectoryRequests++;
    return json(res, { success: false, message: 'retired endpoint must not be requested' }, 410);
  }
  if (url.pathname === '/api/backgrounds.php') return json(res, { images: [{ name: '测试背景', url: 'data/avatars/100.png' }] });
  if (url.pathname === '/api/notifications.php') return json(res, success({ notifications: [], unread_count: 0 }));
  if (url.pathname === '/Forum/uploads/fixture.png') {
    const body = fs.readFileSync(fixtureImage);
    res.writeHead(200, { 'Content-Type': contentType(fixtureImage), 'Content-Length': body.length });
    return res.end(body);
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad path'); }
  const relative = decoded.replace(/^\/+/, '').replaceAll('/', path.sep);
  const filePath = path.resolve(repoRoot, relative);
  if (!filePath.startsWith(repoRoot + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  const body = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType(filePath), 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  return res.end(body);
});

function listen(serverInstance) {
  return new Promise((resolve, reject) => {
    serverInstance.once('error', reject);
    serverInstance.listen(0, '127.0.0.1', () => resolve(serverInstance.address().port));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) throw new Error('Chrome or Edge was not found; set CHROME_PATH to run Forum browser QA.');
  return executable;
}

async function waitForDebugger(port) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const pages = await response.json();
        const page = pages.find((item) => item.type === 'page' && !String(item.url || '').startsWith('chrome-extension://'));
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the browser debugging endpoint.');
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      const callbacks = this.listeners.get(message.method) || [];
      callbacks.forEach((callback) => callback(message.params || {}));
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const callback = (params) => {
        this.off(method, callback);
        resolve(params);
      };
      this.on(method, callback);
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) || [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  off(method, callback) {
    const callbacks = this.listeners.get(method) || [];
    this.listeners.set(method, callbacks.filter((item) => item !== callback));
  }

  close() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.close();
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
  return result.result?.value;
}

async function waitFor(client, expression, message, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(client, `Boolean(${expression})`)) return;
    await delay(75);
  }
  let diagnostic = {};
  try {
    diagnostic = await evaluate(client, `({ href: location.href, readyState: document.readyState, body: (document.body && document.body.innerText || '').slice(0, 800), forumRuntime: Boolean(window.VNFForum), rows: document.querySelectorAll('.post-row').length })`);
  } catch {}
  throw new Error(`${message}\n${JSON.stringify(diagnostic, null, 2)}`);
}

async function navigate(client, url, width, height, theme = 'dark') {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 720 });
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('themePreference', ${JSON.stringify(theme)}); localStorage.removeItem('vnfestWallpaperPreference'); } catch (_) {}`
  });
  const loaded = Promise.race([client.once('Page.loadEventFired'), delay(5000)]);
  await client.send('Page.navigate', { url });
  await loaded;
  await delay(600);
}

async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
  const target = path.join(outputRoot, `${name}.png`);
  fs.writeFileSync(target, Buffer.from(result.data, 'base64'));
  return target;
}

async function run() {
  const serverPort = await listen(server);
  const debuggerPort = await freePort();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vnfest-forum-chrome-'));
  const browser = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-background-networking', '--disable-default-apps',
    '--no-first-run', '--hide-scrollbars', `--remote-debugging-port=${debuggerPort}`, `--user-data-dir=${userData}`,
    '--window-size=1440,1100', 'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  const errors = [];
  let client;
  try {
    client = new CdpClient(await waitForDebugger(debuggerPort));
    await client.connect();
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Log.enable'), client.send('Network.enable')]);
    await client.send('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'] });
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(`exception: ${exceptionDetails?.text || 'unknown'}`));
    client.on('Log.entryAdded', ({ entry }) => {
      if (entry && ['error', 'warning'].includes(entry.level) && entry.source !== 'network') errors.push(`${entry.level}: ${entry.text}`);
    });
    const base = `http://127.0.0.1:${serverPort}`;
    const results = [];

    await navigate(client, `${base}/Forum/forum-plaza.html`, 1440, 1000, 'dark');
    await waitFor(client, `document.querySelectorAll('.post-row').length === 20`, 'plaza topics did not render');
    await waitFor(client, `document.querySelectorAll('.forum-runtime-avatar-fallback.post-avatar').length >= 2`, 'avatar fallback did not render');
    const plazaDesktop = await evaluate(client, `(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      topics: document.querySelectorAll('.post-row').length,
      excerpts: document.querySelectorAll('.post-excerpt').length,
      previews: document.querySelectorAll('.post-preview img').length,
      boundAvatar: Boolean(document.querySelector('.post-avatar[src*="data/avatars/10.jpg"]')?.naturalWidth),
      mapAction: (() => { const link = document.querySelector('[data-forum-map-link]'); const rect = link?.getBoundingClientRect(); const url = link ? new URL(link.href) : null; return { path: url?.pathname, search: url?.search, width: rect?.width || 0, height: rect?.height || 0, label: link?.getAttribute('aria-label') }; })(),
      footerTop: document.querySelector('.forum-site-footer').getBoundingClientRect().top,
      documentHeight: document.documentElement.scrollHeight
    }))()`);
    assert.equal(plazaDesktop.overflow, 0, '1440px plaza overflows horizontally');
    assert.equal(plazaDesktop.topics, 20, 'plaza topic density changed');
    assert.ok(plazaDesktop.excerpts >= 19 && plazaDesktop.previews >= 6 && plazaDesktop.boundAvatar, 'plaza identity/summary/preview rendering is incomplete');
    assert.deepEqual(plazaDesktop.mapAction, { path: '/index.html', search: '?guest=1', width: plazaDesktop.mapAction.width, height: plazaDesktop.mapAction.height, label: '返回地图' }, 'desktop return-to-map action is missing or points to the wrong route');
    assert.ok(plazaDesktop.mapAction.width >= 80 && plazaDesktop.mapAction.height >= 36, 'desktop return-to-map action is too small');
    results.push({ scenario: 'plaza-1440-dark', screenshot: await screenshot(client, 'plaza-1440-dark'), metrics: plazaDesktop });

    await navigate(client, `${base}/Forum/forum-plaza.html?scope=club&club=7&country=china`, 1440, 900, 'dark');
    await waitFor(client, `document.querySelectorAll('.post-row').length === 20`, 'retired-space URL did not return to the plaza');
    const retiredSpaceUrl = await evaluate(client, `({
      scope: new URL(location.href).searchParams.get('scope'),
      club: new URL(location.href).searchParams.get('club'),
      country: new URL(location.href).searchParams.get('country'),
      notice: document.body.innerText.includes('该分区暂未开放，已返回论坛广场'),
      spaceLinks: document.querySelectorAll('[data-space]').length
    })`);
    assert.deepEqual(retiredSpaceUrl, { scope: null, club: null, country: null, notice: true, spaceLinks: 0 }, 'retired-space URL normalization is incorrect');
    results.push({ scenario: 'retired-space-url', metrics: retiredSpaceUrl });

    await navigate(client, `${base}/Forum/forum-plaza.html?q=short`, 1440, 1000, 'light');
    await waitFor(client, `document.querySelectorAll('.post-row').length === 1`, 'short plaza fixture did not render');
    const shortFooter = await evaluate(client, `(() => { const footer = document.querySelector('.forum-site-footer').getBoundingClientRect(); return { bottom: footer.bottom, viewport: innerHeight, position: getComputedStyle(document.querySelector('.forum-site-footer')).position }; })()`);
    assert.ok(shortFooter.bottom >= shortFooter.viewport - 2, 'short-page footer is not at the viewport bottom');
    assert.notEqual(shortFooter.position, 'fixed', 'footer must not be fixed');
    results.push({ scenario: 'plaza-short-1440-light', screenshot: await screenshot(client, 'plaza-short-1440-light'), metrics: shortFooter });

    await navigate(client, `${base}/Forum/forum-plaza.html`, 390, 844, 'dark');
    await waitFor(client, `document.querySelectorAll('.post-row').length === 20`, 'mobile plaza topics did not render');
    const plazaMobile = await evaluate(client, `(() => { const link = document.querySelector('[data-forum-map-link]'); const rect = link?.getBoundingClientRect(); const row = document.querySelector('.post-row'); const excerpt = row?.querySelector('.post-excerpt'); const lastReply = row?.querySelector('.post-last-reply'); const activity = row?.querySelector('.post-activity-time'); const badge = row?.querySelector('.forum-display-club'); return { overflow: document.documentElement.scrollWidth - innerWidth, wallpaper: Boolean(document.querySelector('#vnfestWallpaperLayer')), navTarget: Math.min(document.querySelector('#forumNavToggle').getBoundingClientRect().width, document.querySelector('#forumNavToggle').getBoundingClientRect().height), mapTarget: Math.min(rect?.width || 0, rect?.height || 0), mapLabel: getComputedStyle(link?.querySelector('.forum-map-link-label')).display, excerptVisible: Boolean(excerpt && getComputedStyle(excerpt).display !== 'none'), lastReplyHidden: Boolean(lastReply && getComputedStyle(lastReply).display === 'none'), activityHidden: Boolean(activity && getComputedStyle(activity).display === 'none'), identityVisible: Boolean(badge && getComputedStyle(badge).display !== 'none'), identityWidth: badge?.getBoundingClientRect().width || 0 }; })()`);
    assert.ok(plazaMobile.overflow <= 0, '390px plaza overflows horizontally');
    assert.equal(plazaMobile.wallpaper, false, 'mobile plaza should not mount wallpaper');
    assert.ok(plazaMobile.navTarget >= 44, 'mobile navigation target is smaller than 44px');
    assert.ok(plazaMobile.mapTarget >= 44 && plazaMobile.mapLabel === 'none', 'mobile return-to-map action is not a compact 44px control');
    assert.ok(plazaMobile.excerptVisible && plazaMobile.lastReplyHidden && plazaMobile.activityHidden && plazaMobile.identityVisible, `mobile plaza content-priority fields are incorrect: ${JSON.stringify(plazaMobile)}`);
    assert.ok(plazaMobile.identityWidth <= 220, 'mobile display-club badge is not compact');
    results.push({ scenario: 'plaza-390-dark', screenshot: await screenshot(client, 'plaza-390-dark'), metrics: plazaMobile });

    await navigate(client, `${base}/Forum/forum-plaza.html?q=short`, 1000, 800, 'dark');
    await waitFor(client, `Boolean(document.querySelector('#forumSidebar'))`, 'tablet drawer did not initialize');
    const drawerClosed = await evaluate(client, `({ inert: document.querySelector('#forumSidebar').hasAttribute('inert'), hidden: document.querySelector('#forumSidebar').getAttribute('aria-hidden') })`);
    assert.deepEqual(drawerClosed, { inert: true, hidden: 'true' }, 'closed tablet drawer remains keyboard accessible');
    await evaluate(client, `document.querySelector('#forumNavToggle').click()`);
    await waitFor(client, `document.querySelector('#forumSidebar').classList.contains('is-open')`, 'tablet drawer did not open');
    const drawerOpen = await evaluate(client, `({
      inert: document.querySelector('#forumSidebar').hasAttribute('inert'),
      hidden: document.querySelector('#forumSidebar').getAttribute('aria-hidden'),
      focusInside: document.querySelector('#forumSidebar').contains(document.activeElement),
      backdrop: getComputedStyle(document.body, '::after').content
    })`);
    assert.ok(!drawerOpen.inert && drawerOpen.hidden === null && drawerOpen.focusInside && drawerOpen.backdrop !== 'none', `tablet drawer open state is incomplete: ${JSON.stringify(drawerOpen)}`);
    await evaluate(client, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await waitFor(client, `!document.querySelector('#forumSidebar').classList.contains('is-open')`, 'Escape did not close the tablet drawer');
    const drawerAfterEscape = await evaluate(client, `({ inert: document.querySelector('#forumSidebar').hasAttribute('inert'), hidden: document.querySelector('#forumSidebar').getAttribute('aria-hidden'), focus: document.activeElement?.id })`);
    assert.deepEqual(drawerAfterEscape, { inert: true, hidden: 'true', focus: 'forumNavToggle' }, 'closed tablet drawer did not restore focus and isolation');
    results.push({ scenario: 'plaza-1000-drawer', metrics: { drawerClosed, drawerOpen, drawerAfterEscape } });

    await navigate(client, `${base}/Forum/forum-post.html?id=1`, 1440, 1000, 'light');
    await waitFor(client, `Boolean(document.querySelector('.post-author-rail .avatar, .post-author-rail .forum-runtime-avatar-fallback'))`, 'post author rail did not render');
    await waitFor(client, `document.querySelectorAll('.reply-item').length === 3`, 'reply floors did not render');
    await waitFor(client, `Boolean(document.querySelector('.reply-body img'))`, 'reply Markdown image did not render');
    await waitFor(client, `Boolean(document.querySelector('#forumReplyVisualEditor')) && document.querySelector('#forumReplyBody').hidden`, 'reply rich editor did not initialize');
    const replyRichValue = await evaluate(client, `(() => { const editor = document.querySelector('#forumReplyVisualEditor'); editor.innerHTML = '<p>回复 <strong>预览</strong></p>'; editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' })); return document.querySelector('#forumReplyBody').value; })()`);
    assert.ok(replyRichValue.includes('**预览**'), 'reply rich editor did not synchronize Markdown');
    await evaluate(client, `document.querySelector('#forumReplyPreviewTab').click()`);
    await waitFor(client, `document.querySelector('#forumReplyPreview').innerText.includes('预览')`, 'reply rich preview did not render');
    await evaluate(client, `document.querySelector('#forumReplyEditTab').click()`);
    await evaluate(client, `(() => { const image = document.querySelector('.reply-body img'); image.setAttribute('width', '1600'); image.setAttribute('height', '900'); })()`);
    const postDesktop = await evaluate(client, `(() => {
      const content = document.querySelector('.post-content');
      const replyBody = document.querySelector('.reply-body');
      const replyImage = document.querySelector('.reply-body img');
      const style = getComputedStyle(content);
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        mainDisplay: getComputedStyle(document.querySelector('.main-post')).display,
        authorTop: document.querySelector('.post-author-head').getBoundingClientRect().top,
        articleTop: document.querySelector('.post-article').getBoundingClientRect().top,
        bodyWidth: content.getBoundingClientRect().width,
        readingWidth: content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        replyBodyWidth: replyBody?.getBoundingClientRect().width || 0,
        replyImageWidth: replyImage?.getBoundingClientRect().width || 0,
        replies: document.querySelectorAll('.reply-item').length,
        articles: document.querySelectorAll('article[aria-labelledby]').length,
        actionIconContract: Array.from(document.querySelectorAll('.post-actions .forum-icon-action, .reply-foot .forum-icon-action')).every((el) => el.querySelector('svg[aria-hidden="true"]') && el.getAttribute('aria-label') && el.title),
        pressedContract: Array.from(document.querySelectorAll('.post-actions .like, .post-actions [data-post-action="favorite"], .reply-foot [data-reply-action="like"]')).every((el) => ['true', 'false'].includes(el.getAttribute('aria-pressed'))),
        actionTargets: Array.from(document.querySelectorAll('.post-actions .forum-icon-action, .reply-foot .forum-icon-action')).map((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)),
        postActionOverflow: (() => { const el = document.querySelector('.post-actions'); return el.scrollWidth <= el.clientWidth + 1; })(),
        replyActionOverflow: (() => { const el = document.querySelector('.reply-foot'); return el.scrollWidth <= el.clientWidth + 1; })()
      };
    })()`);
    assert.equal(postDesktop.overflow, 0, '1440px post page overflows horizontally');
    assert.ok(postDesktop.replyImageWidth <= postDesktop.replyBodyWidth + 1, `reply image exceeds its content column: ${JSON.stringify(postDesktop)}`);
    assert.ok(postDesktop.mainDisplay === 'block' && postDesktop.authorTop < postDesktop.articleTop && postDesktop.readingWidth >= 680 && postDesktop.readingWidth <= 760, `post author header or readable column width is incorrect: ${JSON.stringify(postDesktop)}`);
    assert.ok(postDesktop.actionIconContract && postDesktop.pressedContract && postDesktop.postActionOverflow && postDesktop.replyActionOverflow && postDesktop.actionTargets.every((size) => size >= 44), `post/reply icon action contract is incomplete: ${JSON.stringify(postDesktop)}`);
    assert.ok(postDesktop.replies === 3 && postDesktop.articles >= 4, 'post/reply article semantics are incomplete');
    results.push({ scenario: 'post-1440-light', screenshot: await screenshot(client, 'post-1440-light'), metrics: postDesktop });

    await navigate(client, `${base}/Forum/forum-post.html?id=1`, 390, 844, 'dark');
    await waitFor(client, `document.querySelectorAll('.reply-item').length === 3`, 'mobile replies did not render');
    const postMobile = await evaluate(client, `(() => { const author = document.querySelector('.post-author-head'); const article = document.querySelector('.post-article'); const actions = [...document.querySelectorAll('.post-actions .forum-icon-action, .reply-foot .forum-icon-action')]; return { overflow: document.documentElement.scrollWidth - innerWidth, authorTop: author?.getBoundingClientRect().top || 0, articleTop: article?.getBoundingClientRect().top || 0, replyWidth: document.querySelector('.reply-item').getBoundingClientRect().width, actionTargets: actions.map((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)), actionOverflow: actions.every((el) => el.getBoundingClientRect().right <= innerWidth + 1) }; })()`);
    assert.ok(postMobile.overflow <= 0, '390px post page overflows horizontally');
    assert.ok(postMobile.replyWidth <= 362, 'mobile reply floor exceeds its content area');
    assert.ok(postMobile.authorTop < postMobile.articleTop && postMobile.actionOverflow && postMobile.actionTargets.every((size) => size >= 44), `mobile post author/action layout is incomplete: ${JSON.stringify(postMobile)}`);
    results.push({ scenario: 'post-390-dark', screenshot: await screenshot(client, 'post-390-dark'), metrics: postMobile });

    await navigate(client, `${base}/Forum/forum-post.html?id=999`, 1024, 800, 'dark');
    await waitFor(client, `document.body.innerText.includes('帖子不存在或暂不可用')`, 'dormant/missing post did not show the unified unavailable state');
    const unavailablePost = await evaluate(client, `({ repliesHidden: document.querySelector('.replies').hidden, composerHidden: document.querySelector('.quick-reply').hidden, leakedTitle: document.body.innerText.includes('休眠帖子') })`);
    assert.deepEqual(unavailablePost, { repliesHidden: true, composerHidden: true, leakedTitle: false }, 'unavailable post leaked content or interactive surfaces');
    results.push({ scenario: 'unavailable-post', metrics: unavailablePost });

    await navigate(client, `${base}/Forum/forum-post.html?id=1#reply-31`, 1024, 900, 'dark');
    await waitFor(client, `Boolean(document.querySelector('#reply-31'))`, 'reply anchor did not load the target page');
    const replyAnchor = await evaluate(client, `({ page: document.querySelector('[data-reply-page][aria-current="page"]')?.dataset.replyPage, hash: location.hash, anchorQuery: new URL(location.href).searchParams.get('reply_anchor') })`);
    assert.deepEqual(replyAnchor, { page: '2', hash: '#reply-31', anchorQuery: null }, 'legacy hash-only reply anchor did not resolve to the target page');
    results.push({ scenario: 'reply-anchor-page-2', metrics: replyAnchor });

    await navigate(client, `${base}/Forum/forum-create.html`, 1440, 1000, 'dark');
    await waitFor(client, `Boolean(document.querySelector('#forumCreatePreview'))`, 'create preview did not initialize');
    await evaluate(client, `(() => { document.querySelector('#forumCreateSourceTab').click(); const body = document.querySelector('#content'); body.value = '## 即时预览\\n\\n**粗体** 与列表\\n\\n' + Array.from({ length: 90 }, (_, i) => '- 第 ' + (i + 1) + ' 项正文，用于验证写作画布滚动').join('\\n') + '\\n\\n![图片](uploads/fixture.png)'; body.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#forumCreateEditTab').click(); })()`);
    await waitFor(client, `Boolean(document.querySelector('#forumCreatePreview h2')) && Boolean(document.querySelector('#forumCreatePreview img'))`, 'create Markdown preview is not using the detail renderer');
    const pasteResult = await evaluate(client, `(() => { const dt = new DataTransfer(); dt.setData('text/html', '<p><strong>粘贴格式</strong> <a href="https://example.com">链接</a><img src="https://evil.example/x.png" alt="外部图片"></p>'); const editor = document.querySelector('#forumVisualEditor'); editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return document.querySelector('#content').value; })()`);
    assert.ok(pasteResult.includes('**粘贴格式**') && pasteResult.includes('[链接](https://example.com/)') && !pasteResult.includes('evil.example'), 'rich HTML paste was not safely converted');
    const createDesktop = await evaluate(client, `({
      overflow: document.documentElement.scrollWidth - innerWidth,
      editorVisible: getComputedStyle(document.querySelector('#forumCreateEditorPanel')).display !== 'none',
      previewVisible: getComputedStyle(document.querySelector('#forumCreatePreviewPanel')).display !== 'none',
      layoutHeight: document.querySelector('.forum-editor-layout').getBoundingClientRect().height,
      sourceHidden: document.querySelector('#forumCreateSourcePanel').hidden,
      canvasScrolls: document.querySelector('#forumVisualEditor').scrollHeight > document.querySelector('#forumVisualEditor').clientHeight,
      sticky: getComputedStyle(document.querySelector('.forum-create-actions')).position
    })`);
    assert.equal(createDesktop.overflow, 0, '1440px create page overflows horizontally');
    assert.ok(createDesktop.editorVisible && !createDesktop.previewVisible && createDesktop.sourceHidden, 'desktop writing canvas should be the default mode');
    assert.ok(createDesktop.layoutHeight >= 540 && createDesktop.layoutHeight <= 762 && createDesktop.canvasScrolls, `bounded writing canvas is incomplete: ${JSON.stringify(createDesktop)}`);
    assert.equal(createDesktop.sticky, 'sticky', 'create action bar is not sticky inside the card');

    const previewMode = await evaluate(client, `(() => { document.querySelector('#forumCreatePreviewTab').click(); return { editorHidden: document.querySelector('#forumCreateEditorPanel').hidden, previewHidden: document.querySelector('#forumCreatePreviewPanel').hidden, selected: document.querySelector('#forumCreatePreviewTab').getAttribute('aria-selected'), previewScrolls: document.querySelector('#forumCreatePreview').scrollHeight > document.querySelector('#forumCreatePreview').clientHeight }; })()`);
    assert.ok(previewMode.editorHidden && !previewMode.previewHidden && previewMode.selected === 'true' && previewMode.previewScrolls, `preview mode is incomplete: ${JSON.stringify(previewMode)}`);
    await evaluate(client, `document.querySelector('#forumCreateEditTab').click()`);

    const imageToolbarOpensUploader = await evaluate(client, `(() => {
      const input = document.querySelector('#uploadZone + input[type="file"]');
      let opened = false;
      input.addEventListener('click', event => { opened = true; event.preventDefault(); }, { once: true });
      document.querySelector('.editor-toolbar [data-md="image"]').click();
      return opened;
    })()`);
    assert.equal(imageToolbarOpensUploader, true, 'image toolbar did not open the actual file uploader');

    const localUpload = await evaluate(client, `(() => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zk1sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
      const file = new File([bytes], 'fixture.png', { type: 'image/png' });
      const transfer = new DataTransfer(); transfer.items.add(file);
      const input = document.querySelector('#uploadZone + input[type="file"]');
      Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return document.querySelector('.forum-runtime-upload-thumb')?.src || '';
    })()`);
    assert.ok(localUpload.startsWith('blob:'), 'upload did not show an immediate local blob thumbnail');
    await waitFor(client, `document.querySelector('.forum-runtime-upload-item.is-done') && document.querySelector('.forum-runtime-upload-thumb')?.src.includes('/Forum/uploads/fixture.png')`, 'upload did not switch to the trusted server thumbnail');
    await waitFor(client, `document.querySelector('#content').value.includes('![fixture.png](uploads/fixture.png)') && document.querySelectorAll('#forumCreatePreview img').length >= 2`, 'uploaded Markdown did not render immediately in preview');
    results.push({ scenario: 'create-1440-dark', screenshot: await screenshot(client, 'create-1440-dark'), metrics: createDesktop });

    await navigate(client, `${base}/Forum/forum-create.html`, 1024, 900, 'light');
    await waitFor(client, `Boolean(document.querySelector('#forumCreatePreview'))`, '1024 create page did not initialize');
    const create1024 = await evaluate(client, `({ overflow: document.documentElement.scrollWidth - innerWidth, tabs: getComputedStyle(document.querySelector('#forumCreateEditorTabs')).display, layout: getComputedStyle(document.querySelector('.forum-editor-layout')).display })`);
    assert.equal(create1024.overflow, 0, '1024px create page overflows horizontally');
    assert.equal(create1024.tabs, 'flex', '1024px create page should expose the writing mode tabs');
    assert.equal(create1024.layout, 'block', '1024px create page should use the central canvas layout');

    await navigate(client, `${base}/Forum/forum-create.html`, 760, 900, 'dark');
    await waitFor(client, `Boolean(document.querySelector('#forumCreatePreviewTab'))`, '760 create tabs did not initialize');
    await evaluate(client, `document.querySelector('#forumCreatePreviewTab').click()`);
    const create760 = await evaluate(client, `({ overflow: document.documentElement.scrollWidth - innerWidth, editHidden: document.querySelector('#forumCreateEditorPanel').hidden, previewHidden: document.querySelector('#forumCreatePreviewPanel').hidden, selected: document.querySelector('#forumCreatePreviewTab').getAttribute('aria-selected') })`);
    assert.equal(create760.overflow, 0, '760px create page overflows horizontally');
    assert.ok(create760.editHidden && !create760.previewHidden && create760.selected === 'true', 'tablet preview tab state is incorrect');

    await navigate(client, `${base}/Forum/forum-create.html`, 390, 844, 'dark');
    await waitFor(client, `Boolean(document.querySelector('#forumCreatePreviewTab'))`, '390 create tabs did not initialize');
    const createMobile = await evaluate(client, `({ overflow: document.documentElement.scrollWidth - innerWidth, tabTargets: Array.from(document.querySelectorAll('#forumCreateEditorTabs button')).map(button => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height)) })`);
    assert.ok(createMobile.overflow <= 0, '390px create page overflows horizontally');
    assert.ok(createMobile.tabTargets.every((size) => size >= 44), 'mobile editor tabs are smaller than 44px');
    results.push({ scenario: 'create-390-dark', screenshot: await screenshot(client, 'create-390-dark'), metrics: createMobile });

    await navigate(client, `${base}/Forum/forum-plaza.html#rules`, 1440, 900, 'dark');
    await waitFor(client, `Boolean(document.querySelector('.forum-runtime-dialog'))`, 'direct rules hash did not open its dialog');
    await evaluate(client, `document.querySelector('[data-dialog-close]').click()`);
    await waitFor(client, `location.hash === '' && !document.querySelector('.forum-runtime-dialog')`, 'closing a direct info dialog did not clear the hash');
    await evaluate(client, `document.querySelector('[data-info="about"]').click()`);
    await waitFor(client, `location.hash === '#about' && Boolean(document.querySelector('.forum-runtime-dialog'))`, 'clicking an info link did not open its deep link');
    await evaluate(client, `history.back()`);
    await waitFor(client, `location.hash === '' && !document.querySelector('.forum-runtime-dialog')`, 'history back did not close the info dialog');
    await evaluate(client, `history.forward()`);
    await waitFor(client, `location.hash === '#about' && Boolean(document.querySelector('.forum-runtime-dialog'))`, 'history forward did not restore the info dialog');
    results.push({ scenario: 'deep-link-dialog', metrics: { hashCleared: true, historyRestored: true } });

    assert.equal(clubDirectoryRequests, 0, 'Forum still requested retired club directories');
    assert.deepEqual(errors, [], `browser console/runtime issues:\n${errors.join('\n')}`);
    const report = { success: true, output: outputRoot, scenarios: results, errors };
    fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`forum browser QA passed (${results.length} scenarios)`);
    console.log(`screenshots: ${outputRoot}`);
  } finally {
    client?.close();
    const browserExited = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill();
    await Promise.race([browserExited, delay(2500)]);
    await new Promise((resolve) => server.close(resolve));
    try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 }); }
    catch (cleanupError) { console.warn(`temporary browser profile cleanup skipped: ${cleanupError.message}`); }
  }
}

run().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
