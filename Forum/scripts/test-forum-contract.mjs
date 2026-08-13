import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const forumRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(forumRoot, '..');
const read = (name) => fs.readFileSync(path.join(forumRoot, name), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const common = read('assets/js/forum-common.js');
const forumHelpers = read('includes/forum.php');
let avatarErrorHandler = null;
const documentStub = {
  activeElement: null,
  addEventListener(type, handler) { if (type === 'error') avatarErrorHandler = handler; },
  createElement(tagName) {
    return {
      tagName: String(tagName).toUpperCase(), className: '', textContent: '', attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); }
    };
  },
  contains() { return true; }
};
const sandbox = {
  window: { location: { href: 'https://vnfest.example/Forum/forum-post.html', pathname: '/Forum/forum-post.html', search: '', hash: '' } },
  location: { href: 'https://vnfest.example/Forum/forum-post.html' }, URL, console, setTimeout, clearTimeout,
  Intl, crypto: globalThis.crypto, CustomEvent: class {}, document: documentStub
};
vm.createContext(sandbox);
vm.runInContext(common, sandbox, { filename: 'forum-common.js' });
const markdown = sandbox.window.VNFForum.markdown;
const normalizePlainTextPaste = sandbox.window.VNFForum.normalizePlainTextPaste;

const malicious = markdown('<script>alert(1)</script> [x](javascript:alert(2)) ![x](https://evil.example/x.png)');
assert(!malicious.includes('<script>'), 'raw HTML was not escaped');
assert(!malicious.includes('href="javascript:'), 'javascript link was rendered');
assert(!malicious.includes('<img'), 'external image was rendered');
const safe = markdown('**加粗**\n\n![海报](uploads/2026/08/abc-123.webp)\n\n[官网](https://vnfest.example)');
assert(safe.includes('<strong>加粗</strong>'), 'bold markdown missing');
assert(safe.includes('<img src="./uploads/2026/08/abc-123.webp"'), 'Forum-local image syntax missing');
assert(safe.includes('rel="noopener noreferrer"'), 'safe links need noopener');
const lightMarkdown = markdown('## 二级标题\n### 三级标题\n- 列表\n1. 有序\n> 引用\n`code`\n```js\nconst x = 1;\n```');
for (const fragment of ['<h2>', '<h3>', '<ul>', '<ol>', '<blockquote>', '<code>', '<pre>']) {
assert(lightMarkdown.includes(fragment), `light Markdown output missing ${fragment}`);
}
assert(typeof normalizePlainTextPaste === 'function', 'plain-text paste normalizer is not exported');
assert(normalizePlainTextPaste('第一行\r\n\r\n\r\n第二行') === '第一行\n\n第二行', 'plain-text paste line normalization is unstable');

const { safeAvatarUrl, avatarImage, forumImageUrl, removeForumImageReferences } = sandbox.window.VNFForum;
assert(safeAvatarUrl('data/avatars/7.png?t=1778348389') === '../data/avatars/7.png?t=1778348389', 'relative bound avatar was not resolved');
assert(safeAvatarUrl('/data/avatars/7.webp?t=9') === '/data/avatars/7.webp?t=9', 'site-absolute avatar was not accepted');
assert(safeAvatarUrl('https://cdn.example/avatar.jpg').startsWith('https://cdn.example/'), 'HTTP(S) avatar was not accepted');
for (const unsafeAvatar of ['data/galgame.db', 'data/avatars/../galgame.db', 'data:text/html,x', 'blob:https://vnfest.example/x', 'javascript:alert(1)', '//evil.example/avatar.png']) {
  assert(safeAvatarUrl(unsafeAvatar) === '', `unsafe avatar was accepted: ${unsafeAvatar}`);
}
assert(forumImageUrl('./uploads/2026/08/example.webp') === './uploads/2026/08/example.webp', 'Forum preview image path was not accepted');
assert(forumImageUrl('../uploads/evil.webp') === '', 'traversal preview image path was accepted');
const attachmentMarkdown = [
  '保留正文',
  '![原始说明](uploads/2026/08/remove-me.webp)',
  '![用户改过的 alt](./uploads/2026/08/remove-me.webp)',
  '![带标题](uploads/2026/08/remove-me.webp "图片标题")',
  '![其他附件](uploads/2026/08/keep-me.webp)',
  '[普通链接](uploads/2026/08/remove-me.webp)',
  '![非法穿越](uploads/../remove-me.webp)'
].join('\n');
const attachmentMarkdownAfterDelete = removeForumImageReferences(attachmentMarkdown, './uploads/2026/08/remove-me.webp');
assert(!attachmentMarkdownAfterDelete.includes('![原始说明]') && !attachmentMarkdownAfterDelete.includes('![用户改过的 alt]') && !attachmentMarkdownAfterDelete.includes('![带标题]'), 'deleting an upload did not remove every Markdown image reference by normalized path');
assert(attachmentMarkdownAfterDelete.includes('![其他附件](uploads/2026/08/keep-me.webp)'), 'deleting an upload removed another attachment');
assert(attachmentMarkdownAfterDelete.includes('[普通链接](uploads/2026/08/remove-me.webp)'), 'deleting an upload removed a normal Markdown link');
assert(attachmentMarkdownAfterDelete.includes('![非法穿越](uploads/../remove-me.webp)'), 'deleting an upload matched an unsafe traversal path');
assert(removeForumImageReferences(attachmentMarkdown, '../uploads/2026/08/remove-me.webp') === attachmentMarkdown, 'unsafe attachment targets must not alter Markdown');
const avatarMarkup = avatarImage({ nickname: '测试用户', avatar_url: 'data/avatars/7.png?t=1' }, 'post-avatar');
assert(avatarMarkup.includes('src="../data/avatars/7.png?t=1"'), 'bound avatar markup is missing');
assert(avatarMarkup.includes('loading="lazy"') && avatarMarkup.includes('decoding="async"'), 'list avatar loading policy is missing');
assert(typeof avatarErrorHandler === 'function', 'delegated avatar fallback handler was not installed');
let avatarReplacement = null;
avatarErrorHandler({ target: {
  tagName: 'IMG',
  dataset: { avatarClass: 'post-avatar', avatarLabel: '测试用户', avatarInitial: '测' },
  hasAttribute(name) { return name === 'data-forum-avatar'; },
  replaceWith(node) { avatarReplacement = node; }
} });
assert(avatarReplacement && avatarReplacement.className.includes('post-avatar') && avatarReplacement.className.includes('forum-runtime-avatar-fallback'), 'broken avatar did not keep its size class');
assert(avatarReplacement.attributes['aria-label'] === '测试用户的头像' && avatarReplacement.textContent === '测', 'broken avatar fallback identity is incorrect');

const api = read('api/forum.php');
for (const action of ['bootstrap', 'list_posts', 'get_post', 'list_replies', 'list_categories', 'list_mine', 'moderation_queue', 'create_post', 'update_post', 'delete_post', 'create_reply', 'update_reply', 'delete_reply', 'toggle_like', 'toggle_favorite', 'upload_image', 'delete_upload', 'report', 'moderate']) {
  assert(api.includes(`case '${action}'`), `missing forum API action ${action}`);
}
assert(!api.includes("case 'manage_category'"), 'retired category management action remains public');
assert(!api.includes('forum_club_post'), 'retired club-post notification creation remains');
assert(!api.includes("'memberships' =>") && !api.includes("'post_scopes' =>"), 'bootstrap still exposes retired membership/scope choices');
assert(api.includes("p.scope='plaza'"), 'public Forum queries are not plaza-only');
assert(api.includes("forumFail('当前仅支持论坛广场', 422)"), 'retired scope request rejection is missing');
assert(api.includes('WHERE id=? AND target_type=? AND target_id=?'), 'moderation can update an unrelated or dormant report');
assert(api.includes('forumRequireSameOrigin'), 'write same-origin guard missing');
assert(api.includes('checkRateLimit'), 'write rate limits missing');
assert(api.includes('forumValidateMarkdownImages'), 'attachment validation missing');
assert(api.includes("'tags' => FORUM_TAG_MAX_COUNT"), 'tag limits missing from bootstrap');
assert(api.includes("'uploads/' . date('Y/m')"), 'uploads are not Forum-local');
assert(!api.includes("'uploads/forum/"), 'legacy root upload path remains');
assert(api.includes('forumPostLink('), 'notification links are not centralized');
assert(api.includes('forumPreviewImagesForPosts'), 'list API preview image batch is missing');
assert(api.includes('forumSerializePostListItem'), 'shared list item serializer is missing');
assert(api.includes('FORUM_DISPLAY_CLUB_SELECT') && api.includes('FORUM_DISPLAY_CLUB_JOIN'), 'Forum author queries do not batch-join the selected display membership');
assert(forumHelpers.includes("'display_club' =>"), 'public Forum authors do not expose display_club');
assert(api.includes('anchor_id') && api.includes('floor_number'), 'reply anchor paging or stable floor contract is missing');
assert(api.includes('parent_visible_id') && api.includes("pr.status='published'") && api.includes('pr.deleted_at IS NULL'), 'hidden parent replies can leak through quotes');
assert(api.includes("array_key_exists('active', $input)"), 'like/favorite desired-state contract is missing');
assert(api.includes("p.author_id=? AND p.status='published'"), 'my-post list can expose hidden posts that the detail API cannot open');
const floorSql = api.match(/\(SELECT COUNT\(\*\) FROM forum_replies floor_reply[\s\S]*?\) AS floor_number/);
assert(floorSql && !floorSql[0].includes("status='published'") && !floorSql[0].includes('deleted_at'), 'reply floors are not stable across soft deletion or hiding');
for (const fragment of ['HTTP_X_FORWARDED_PROTO', 'requestPort', 'sourcePort', '缺少同源请求信息']) {
  assert(forumHelpers.includes(fragment), `strict same-origin contract missing ${fragment}`);
}
assert(forumHelpers.includes('count($matches[1] ?? []) > FORUM_IMAGE_MAX_COUNT'), 'Markdown image occurrences are not capped at 20');
assert(forumHelpers.includes('SELECT DISTINCT relative_path') && forumHelpers.includes('relative_path IN'), 'Markdown image ownership is not batch-validated');
assert(forumHelpers.includes("'post_archive'") && forumHelpers.includes("'reply_archive'"), 'removed live attachments are not retained for audit history');

const schema = read('includes/forum_schema.php');
for (const table of ['forum_categories', 'forum_posts', 'forum_replies', 'forum_attachments', 'forum_reactions', 'forum_favorites', 'forum_reports', 'forum_revisions', 'forum_tags', 'forum_post_tags']) {
  assert(schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `missing schema table ${table}`);
}
assert(schema.includes('FULLTEXT KEY ft_forum_posts'), 'MySQL FULLTEXT missing');
assert(schema.includes('USING fts5'), 'SQLite FTS5 path missing');
for (const category of ['综合讨论', '资源分享', '活动发布', '作品交流', '求助答疑']) {
  assert(schema.includes(category), `missing imported category ${category}`);
}

for (const page of ['forum-plaza.html', 'forum-post.html', 'forum-create.html']) {
  const html = read(page);
  assert(html.includes('assets/css/forum-runtime.css'), `${page} missing runtime state CSS`);
  assert(html.includes('assets/js/forum-common.js'), `${page} missing request/renderer wrapper`);
  assert(html.includes('assets/js/forum-pages.js'), `${page} missing page controller`);
  assert(html.includes('../js/theme-runtime.js'), `${page} missing shared theme runtime`);
  assert(html.includes('../css/theme-tokens.css'), `${page} missing shared theme tokens`);
  assert(html.includes('../js/page-background.js'), `${page} missing shared wallpaper runtime`);
  assert(!/data-picker|data-anchor|vnfestWallpaperPicker|forumWallpaperAnchor/.test(html), `${page} must not create a local wallpaper picker`);
  assert((html.match(/20260810-forum11/g) || []).length >= 3, `${page} Forum asset cache version was not refreshed`);
  assert(html.includes('data-forum-map-link') && html.includes('href="../index.html?guest=1"') && html.includes('>返回地图</span>'), `${page} missing return-to-map action`);
  assert(html.includes('class="topbar-brand" href="./forum-plaza.html"'), `${page} brand is not the plaza navigation entry`);
  assert(!/<a\s+class="topbar-btn[^"]*"[^>]*>广场<\/a>/.test(html), `${page} still has the decorative plaza button`);
  assert(!html.includes('（演示）'), `${page} still contains demo behavior`);
  assert(!html.includes('id=new'), `${page} still contains fake post redirect`);
  assert(html.includes('class="forum-footer forum-site-footer"'), `${page} missing shared page-level footer`);
}
const plaza = read('forum-plaza.html');
assert(plaza.includes('id="postList"'), 'plaza mount point missing');
assert(plaza.includes('id="forumNavToggle"') && plaza.includes('aria-controls="forumSidebar"'), 'mobile forum navigation toggle missing');
assert(plaza.includes('id="forumSidebar"'), 'mobile forum navigation drawer target missing');
assert(!plaza.includes('topbar-menu'), 'legacy decorative space menu remains');
assert(plaza.includes('id="forumTotal"') && plaza.includes('data-info="rules"') && plaza.includes('data-info="about"') && plaza.includes('data-info="privacy"'), 'plaza total or deep-link footer anchors missing');
assert((plaza.match(/\+ 发帖/g) || []).length === 1, 'plaza must retain exactly one primary + 发帖 entry');
const post = read('forum-post.html');
assert(post.includes('class="main-post"') && post.includes('class="reply-list"'), 'imported post design classes missing');
assert(!/<header class="topbar">[\s\S]*?>\s*发帖\s*<\/a>[\s\S]*?<\/header>/.test(post), 'post topbar still contains 发帖');
for (const id of ['forumReplyEditorTabs', 'forumReplyEditorPanel', 'forumReplyPreviewPanel', 'forumReplyPreview']) {
  assert(post.includes(`id="${id}"`), `post reply preview mount missing: ${id}`);
}
assert(post.includes('id="forumReplyVisualEditor"') && post.includes('contenteditable="true"'), 'reply rich editor mount is missing');
assert(post.includes('class="reply-markdown-toolbar"'), 'compact reply Markdown toolbar missing');
assert(post.includes('id="forumReplyTarget"'), 'safe reply target chip is missing');
const create = read('forum-create.html');
assert(create.includes('create-card') && create.includes('id="tagInput"'), 'imported editor design classes missing');
assert(!create.includes('发布范围') && !create.includes('scope-card') && !create.includes('id="club"'), 'retired publish-range controls remain');
assert(!/<header class="topbar">[\s\S]*?>\s*发帖\s*<\/a>[\s\S]*?<\/header>/.test(create), 'create topbar still contains 发帖');
for (const id of ['forumCreateEditorTabs', 'forumCreateEditorPanel', 'forumCreatePreviewPanel', 'forumCreatePreview']) {
  assert(create.includes(`id="${id}"`), `create preview mount missing: ${id}`);
}
for (const id of ['forumVisualEditor', 'forumCreateSourcePanel', 'forumCreateSourceTab']) {
  assert(create.includes(`id="${id}"`), `rich authoring mount missing: ${id}`);
}
assert(create.includes('contenteditable="true"') && create.includes('aria-multiline="true"'), 'visual editor is not an accessible contenteditable surface');
assert(create.includes('data-editor-tab="visual"') && create.includes('data-editor-tab="source"'), 'create editor visual/source tabs are missing');
for (const id of ['forumTitleCount', 'forumBodyCount', 'forumDraftStatus', 'forumCreatePreviewStatus', 'forumUploadCount', 'forumUploadButton', 'forumPublishStatus']) {
  assert(create.includes(`id="${id}"`), `authoring workspace mount missing: ${id}`);
}
for (const action of ['heading2', 'heading3', 'unordered-list', 'ordered-list', 'inline-code', 'code-block']) {
  assert(create.includes(`data-md="${action}"`), `create Markdown toolbar action missing: ${action}`);
}

const runtimeCss = read('assets/css/forum-runtime.css');
assert(runtimeCss.includes('[hidden] { display: none !important; }'), 'hidden-state guard missing');
assert(runtimeCss.includes('--forum-page'), 'Forum theme semantic aliases missing');
assert(runtimeCss.includes('data-theme="light"'), 'light theme override missing');
assert(runtimeCss.includes('min-height: 44px'), '44px mobile target contract missing');
assert(runtimeCss.includes('prefers-reduced-motion'), 'reduced-motion support missing');
assert(runtimeCss.includes('html.has-vnfest-wallpaper body[data-forum-page]'), 'Forum wallpaper surfaces missing');
assert(runtimeCss.includes('.forum-navigation-progress'), 'cross-page navigation progress missing');
assert(runtimeCss.includes('.forum-map-link'), 'return-to-map action styles missing');
assert(runtimeCss.includes('.forum-nav-toggle'), 'mobile navigation control styles missing');
assert(runtimeCss.includes('.forum-display-club'), 'display club badge styles are missing');
for (const selector of ['.forum-topic-stream', '.post-preview', '.post-author-rail', '.post-author-head', '.reply-author-rail', '.reply-body img', '.forum-editor-layout', '.forum-markdown-preview', '.forum-runtime-upload-thumb', '.forum-site-footer', '.forum-icon-action', '.post-last-reply', '.post-activity-time']) {
  assert(runtimeCss.includes(selector), `runtime CSS missing ${selector}`);
}
const pagesJs = read('assets/js/forum-pages.js');
assert(pagesJs.includes('class="post-row'), 'imported plaza row class contract missing from dynamic renderer');
assert(pagesJs.includes('post-author-head') && pagesJs.includes('post-author-meta'), 'post detail author header is not rendered above the article');
for (const icon of ['quoteIcon', 'flagIcon', 'editIcon', 'trashIcon', 'manageIcon']) {
  assert(pagesJs.includes(icon), `missing inline SVG action icon: ${icon}`);
}
assert(pagesJs.includes('forum-icon-action') && pagesJs.includes('aria-label=') && pagesJs.includes('title='), 'icon action accessibility attributes are missing');
assert(pagesJs.includes('aria-pressed='), 'like/favorite action state attributes are missing');
assert(!pagesJs.includes('scrollIntoView'), 'embedded-host unsafe scrolling method used');
assert(pagesJs.includes("addEventListener('popstate'"), 'plaza browser history restoration missing');
assert(pagesJs.includes('loadToken'), 'stale plaza request protection missing');
assert(pagesJs.includes('retiredSpace') && pagesJs.includes("['scope', 'club', 'country']"), 'legacy space URL normalization is missing');
assert(!pagesJs.includes('data-space') && !pagesJs.includes('renderSpaces') && !pagesJs.includes('loadClubNames'), 'retired space navigation/runtime remains');
assert(pagesJs.includes('setupMarkdownPreview') && pagesJs.includes('F.markdown(textarea.value)'), 'shared Markdown preview controller missing');
assert(pagesJs.includes('item.match_excerpt || item.excerpt') && pagesJs.includes('item.preview_image'), 'plaza excerpt/preview rendering missing');
assert(pagesJs.includes('displayClubBadge(item.author)') && pagesJs.includes('displayClubBadge(post.author)') && pagesJs.includes('displayClubBadge(reply.author)'), 'display club badge is not rendered on every author surface');
assert(pagesJs.includes('setupInfoDialogs') && pagesJs.includes("addEventListener('hashchange'"), 'deep-link dialog history sync missing');
assert(pagesJs.includes('replyLoadToken'), 'stale reply request protection missing');
assert(pagesJs.includes('reply_anchor') && pagesJs.includes('anchor_id'), 'cross-page reply anchor restoration missing');
assert(pagesJs.includes('replyHashMatch'), 'legacy hash-only reply links are not restored across pages');
assert(pagesJs.includes('active: desired'), 'like/favorite requests do not send an idempotent desired state');
assert(common.includes('createObjectURL') && common.includes('revokeObjectURL'), 'instant local upload thumbnails or cleanup missing');
assert(common.includes('role="progressbar"'), 'accessible upload progress missing');
assert(common.includes("matchMedia('(max-width: 1023px)')") && common.includes("toggleAttribute('inert'"), 'tablet drawer focus isolation is missing');
assert(runtimeCss.includes('@media (max-width: 1023px)') && runtimeCss.includes('forum-runtime-drawer-open::after'), 'tablet drawer and backdrop breakpoints are not aligned');
assert(common.includes('forum-navigation-pending'), 'shared cross-page navigation feedback missing');
assert(!common.includes('clubs.php') && !common.includes('clubs_japan.php') && !common.includes('forumClubNames'), 'retired club directory requests remain');
assert(common.includes("action === 'image' && typeof settings.onImage === 'function'"), 'image toolbar does not open the real uploader');
assert(!common.includes('uploads/图片路径'), 'image toolbar still inserts a placeholder path');
assert(pagesJs.includes('status.textContent = \'正在更新\'') && pagesJs.includes('preview.scrollTop'), 'preview sync status or scroll preservation is missing');
assert(pagesJs.includes('setupRichComposer') && pagesJs.includes('setupRichToolbar'), 'create page is not using the rich composer');
assert(pagesJs.includes('pasteTarget: visualEditor') && pagesJs.includes('dropTarget: visualEditor') && pagesJs.includes('onInsert: (markdownText) => composer.insertMarkdown(markdownText)'), 'rich composer upload insertion contract is missing');
assert(pagesJs.includes('pasteTarget: replyVisualEditor') && pagesJs.includes('dropTarget: replyVisualEditor') && pagesJs.includes('onInsert: (markdownText) => replyComposer.insertMarkdown(markdownText)'), 'reply rich composer upload insertion contract is missing');
assert(common.includes('markdownToEditorDom') && common.includes('editorDomToMarkdown') && common.includes('sanitizeEditorFragment'), 'rich composer conversion helpers are missing');
assert(common.includes('normalizePlainTextPaste') && common.includes('smartBlockPrefix') && common.includes('autoLinkCurrentBlock'), 'low-friction input automation is missing');
assert(common.includes("tag === 'SCRIPT' || tag === 'STYLE'") && common.includes('externalImages'), 'pasted unsafe HTML/image handling is missing');
for (const cssContract of ['clamp(540px, 68svh, 760px)', 'clamp(420px, 58svh, 620px)', '.forum-rich-editor', 'position: sticky', '.forum-media-section', '.forum-create-actions']) {
  assert(runtimeCss.includes(cssContract), `authoring workspace CSS missing ${cssContract}`);
}

const visibleCopy = [plaza, post, create, pagesJs, api].join('\n');
assert(!visibleCopy.includes('小空间'), 'legacy small-space wording remains in user-visible Forum sources');
assert(!visibleCopy.includes('同好会空间') && !visibleCopy.includes('选择同好会'), 'retired club-space wording remains in user-visible Forum sources');

for (const legacy of ['forum-plaza.html', 'forum-post.html', 'forum-create.html', 'api/forum.php', 'includes/forum.php', 'includes/forum_schema.php', 'js/forum-common.js', 'js/forum-pages.js', 'css/forum.css', 'scripts/test-forum-contract.mjs', 'scripts/test-forum-v1.php']) {
  assert(!fs.existsSync(path.join(repoRoot, legacy)), `legacy forum file remains outside Forum: ${legacy}`);
}
console.log('forum v1 layout pairing, security renderer, API, schema, paths, and responsive contracts passed');
