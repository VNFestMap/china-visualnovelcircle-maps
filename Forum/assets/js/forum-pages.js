(function () {
  'use strict';

  const F = window.VNFForum;
  if (!F) return;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const commentIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const likeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 21s-6.6-4.8-9.6-9.6A5.6 5.6 0 0 1 11.3 5a.7.7 0 0 0 .7-.2A5.6 5.6 0 0 1 21 10.4C21 14.6 12 21 12 21z"/></svg>';
  const bookmarkIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  const shareIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
  const quoteIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a8 8 0 0 1 8-8V3a10 10 0 0 0-10 10v-2Z"/><path d="M21 3a10 10 0 0 0-10 10v6"/></svg>';
  const flagIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4c5-3 9 3 14 0v10c-5 3-9-3-14 0"/></svg>';
  const editIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
  const trashIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';
  const manageIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>';

  function displayClubBadge(author) {
    const club = author && author.display_club;
    if (!club || !club.name || !['china', 'japan'].includes(String(club.country))) return '';
    const role = { member: '成员', manager: '管理员', representative: '负责人' }[club.role];
    if (!role) return '';
    const country = club.country === 'japan' ? '日本' : '中国';
    const label = `${club.name} · ${role}`;
    const accessible = `${country}代表同好会：${label}`;
    return `<span class="forum-display-club" title="${F.attr(accessible)}" aria-label="${F.attr(accessible)}">${F.esc(label)}</span>`;
  }

  function stateMarkup(kind, title, message, retry) {
    return `<div class="forum-runtime-state" data-state="${F.attr(kind)}">
      <strong>${F.esc(title)}</strong>
      ${message ? `<span>${F.esc(message)}</span>` : ''}
      ${retry ? '<button type="button" data-retry>重新加载</button>' : ''}
    </div>`;
  }

  function setUrl(values, replace) {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) => {
      if (value === '' || value == null || value === false || value === 0 && key !== 'page') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    history[replace || url.href === window.location.href ? 'replaceState' : 'pushState']({}, '', url);
  }

  function pageNumbers(current, total) {
    const result = new Set([1, total, current - 1, current, current + 1]);
    return Array.from(result).filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
  }

  const infoContent = {
    rules: ['社区规则', '<p>尊重他人，理性讨论；分享资源时注明来源并尊重版权；发布活动时写清时间、地点与参与方式。违规内容可通过帖子或回复旁的举报入口提交处理。</p>'],
    about: ['关于论坛', '<p>VNFest 论坛用于同好交流、企划讨论、资源分享和活动发布。论坛广场对所有访客开放，登录后可以发布和参与讨论。</p>'],
    privacy: ['隐私政策', '<p>论坛只公开用户主动发布的内容和公开昵称；举报快照和修订记录仅供授权管理者审计。</p>']
  };

  function setupInfoDialogs() {
    if (document.body.dataset.forumPage !== 'plaza') return;
    const anchors = $$('[data-info]');
    if (!anchors.length) return;
    let active = null;
    let closingFromHistory = false;

    const infoKeyFromHash = () => {
      const key = String(location.hash || '').replace(/^#/, '');
      return Object.prototype.hasOwnProperty.call(infoContent, key) ? key : '';
    };

    function clearInfoHash(key) {
      if (infoKeyFromHash() !== key) return;
      if (history.state && history.state.forumInfo === key) {
        history.back();
        return;
      }
      const url = new URL(location.href);
      url.hash = '';
      history.replaceState(history.state || {}, '', url);
    }

    function closeActiveFromHistory() {
      if (!active) return;
      const dialog = active.dialog;
      active = null;
      closingFromHistory = true;
      dialog.close('history');
      closingFromHistory = false;
    }

    function syncDialogToHash() {
      const key = infoKeyFromHash();
      if (!key) {
        closeActiveFromHistory();
        return;
      }
      if (active && active.key === key) return;
      closeActiveFromHistory();
      const content = infoContent[key];
      const dialog = F.openDialog({
        title: content[0],
        html: content[1],
        onClose: () => {
          if (active && active.dialog === dialog) active = null;
          if (!closingFromHistory) clearInfoHash(key);
        }
      });
      active = { key, dialog };
    }

    anchors.forEach((anchor) => anchor.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const key = anchor.dataset.info;
      if (!infoContent[key]) return;
      event.preventDefault();
      if (infoKeyFromHash() !== key) {
        const url = new URL(location.href);
        url.hash = key;
        history.pushState(Object.assign({}, history.state || {}, { forumInfo: key }), '', url);
      }
      syncDialogToHash();
    }));
    globalThis.addEventListener('hashchange', syncDialogToHash);
    globalThis.addEventListener('popstate', syncDialogToHash);
    syncDialogToHash();
  }

  function setupMarkdownPreview(options) {
    const textarea = options.textarea;
    const preview = options.preview;
    const editorPanel = options.editorPanel;
    const previewPanel = options.previewPanel;
    const tabList = options.tabList;
    const status = options.status;
    if (!textarea || !preview) return { refresh() {}, activate() {} };
    const tabs = tabList ? $$('[data-editor-tab]', tabList) : [];
    const media = options.alwaysTabs ? null : globalThis.matchMedia('(max-width: 1023px)');
    let activeTab = 'edit';
    let renderTimer = 0;

    function render() {
      globalThis.clearTimeout(renderTimer);
      renderTimer = 0;
      const scrollTop = preview.scrollTop;
      const value = textarea.value.trim();
      preview.innerHTML = value
        ? F.markdown(textarea.value)
        : `<div class="forum-preview-empty"><strong>${F.esc(options.emptyTitle || '正文预览会显示在这里')}</strong><span>${F.esc(options.emptyHint || '可使用工具栏，也可直接输入 Markdown。')}</span></div>`;
      preview.scrollTop = Math.min(scrollTop, Math.max(0, preview.scrollHeight - preview.clientHeight));
      if (status) status.textContent = '已同步';
    }

    function usesTabs() {
      return options.alwaysTabs || Boolean(media && media.matches);
    }

    function syncPanels() {
      const tabMode = usesTabs();
      if (tabList) tabList.dataset.tabsActive = String(tabMode);
      if (editorPanel) {
        editorPanel.hidden = tabMode && activeTab !== 'edit';
        editorPanel.setAttribute('aria-hidden', String(tabMode && activeTab !== 'edit'));
      }
      if (previewPanel) {
        previewPanel.hidden = tabMode && activeTab !== 'preview';
        previewPanel.setAttribute('aria-hidden', String(tabMode && activeTab !== 'preview'));
      }
      tabs.forEach((tab) => {
        const selected = tab.dataset.editorTab === activeTab;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
    }

    function activate(name, focus) {
      activeTab = name === 'preview' ? 'preview' : 'edit';
      if (activeTab === 'preview') render();
      syncPanels();
      if (focus) {
        const selected = tabs.find((tab) => tab.dataset.editorTab === activeTab);
        if (selected) selected.focus();
      }
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab.dataset.editorTab, false));
      tab.addEventListener('keydown', (event) => {
        let next = null;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next == null) return;
        event.preventDefault();
        activate(tabs[next].dataset.editorTab, true);
      });
    });
    textarea.addEventListener('input', () => {
      globalThis.clearTimeout(renderTimer);
      if (status) status.textContent = '正在更新';
      renderTimer = globalThis.setTimeout(render, 120);
    });
    if (media) {
      const sync = () => syncPanels();
      if (typeof media.addEventListener === 'function') media.addEventListener('change', sync);
      else if (typeof media.addListener === 'function') media.addListener(sync);
    }
    render();
    syncPanels();
    return { refresh: render, activate };
  }

  function localNotificationHref(value) {
    const link = String(value || '');
    if (/^\.\/Forum\//.test(link)) return './' + link.slice('./Forum/'.length);
    if (/^\.\//.test(link)) return '../' + link.slice(2);
    if (/^\//.test(link) && !link.startsWith('//')) return link;
    return '../user.html';
  }

  function setupNotifications(bootstrap) {
    const button = $('#forumNoticeButton');
    const badge = $('#forumNoticeBadge');
    if (!button || !badge) return;
    const syncBadge = (count) => {
      const value = Math.max(0, Number(count) || 0);
      badge.textContent = value > 99 ? '99+' : String(value);
      badge.hidden = value === 0;
      button.setAttribute('aria-label', value ? `通知，${value} 条未读` : '通知');
    };
    syncBadge(bootstrap.unread_notifications);

    async function open() {
      const old = $('.forum-runtime-notifications');
      if (old) { old.remove(); button.setAttribute('aria-expanded', 'false'); return; }
      if (!bootstrap.user) { F.requireLogin('Forum/forum-plaza.html'); return; }
      const panel = document.createElement('aside');
      panel.className = 'forum-runtime-notifications';
      panel.innerHTML = stateMarkup('loading', '正在读取通知', '');
      document.body.append(panel);
      button.setAttribute('aria-expanded', 'true');
      try {
        const data = await F.platformApi('notifications.php?action=list&page=1&limit=8');
        const notices = Array.isArray(data.notifications) ? data.notifications : [];
        panel.innerHTML = `<div class="forum-runtime-notice-head"><strong>通知</strong><button type="button" data-mark-all>全部已读</button></div>
          ${notices.length ? notices.map((notice) => `<a class="forum-runtime-notice-item ${Number(notice.is_read) ? '' : 'is-unread'}" href="${F.attr(localNotificationHref(notice.link))}" data-notice-id="${Number(notice.id)}">
            <strong>${F.esc(notice.title || '通知')}</strong><span>${F.esc(notice.message || '')}</span>
          </a>`).join('') : stateMarkup('empty', '暂无通知', '新的回复、提及和管理结果会出现在这里。')}`;
        panel.querySelector('[data-mark-all]').addEventListener('click', async () => {
          try {
            const result = await F.platformApi('notifications.php?action=mark_all_read', { method: 'POST', body: {} });
            syncBadge(result.unread_count || 0);
            panel.querySelectorAll('.is-unread').forEach((item) => item.classList.remove('is-unread'));
          } catch (error) { F.toast(error.message, 'error'); }
        });
        panel.querySelectorAll('[data-notice-id]').forEach((item) => item.addEventListener('click', async (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          try { await F.platformApi('notifications.php?action=mark_read', { method: 'POST', body: { id: Number(item.dataset.noticeId) } }); }
          catch (_) { /* Navigation is still useful if the read marker fails. */ }
          window.location.href = item.href;
        }));
      } catch (error) {
        panel.innerHTML = stateMarkup('error', '通知读取失败', error.message, true);
        panel.querySelector('[data-retry]').addEventListener('click', () => { panel.remove(); open(); });
      }
    }
    button.addEventListener('click', open);
    document.addEventListener('click', (event) => {
      const panel = $('.forum-runtime-notifications');
      if (panel && !panel.contains(event.target) && !button.contains(event.target)) {
        panel.remove();
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  async function initPlaza() {
    F.setupChrome();
    setupInfoDialogs();
    const readLocationState = () => {
      const params = new URLSearchParams(location.search);
      const retiredSpace = params.get('scope') === 'club' || params.has('club') || params.has('country');
      const view = ['latest', 'mine', 'favorites'].includes(params.get('view')) ? params.get('view') : '';
      const sort = ['latest', 'hot', 'essence'].includes(params.get('sort')) ? params.get('sort') : 'latest';
      return {
        page: Math.max(1, Number(params.get('page')) || 1),
        sort: view === 'latest' ? 'latest' : sort,
        categoryId: Math.max(0, Number(params.get('category')) || 0),
        section: view || 'plaza',
        q: params.get('q') || '',
        retiredSpace,
      };
    };
    const state = Object.assign(readLocationState(), {
      bootstrap: null,
      categories: [],
      loadToken: 0,
    });
    let lastHandledSearch = location.search;
    const list = $('#postList');
    const search = $('#forumSearch');
    search.value = state.q;

    const announce = (message) => {
      const live = $('#forumNavigationStatus');
      if (live) live.textContent = message || '';
    };

    function clearInlineBusy() {
      list.setAttribute('aria-busy', 'false');
      $$('.nav-item.is-loading').forEach((item) => item.classList.remove('is-loading'));
      $$('[data-forum-inline-busy]').forEach((item) => {
        item.classList.remove('is-navigating');
        item.removeAttribute('data-forum-inline-busy');
      });
    }

    function normalizeRetiredSpace() {
      if (!state.retiredSpace) return false;
      const url = new URL(location.href);
      ['scope', 'club', 'country'].forEach((name) => url.searchParams.delete(name));
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      lastHandledSearch = location.search;
      state.retiredSpace = false;
      state.section = 'plaza';
      F.toast('该分区暂未开放，已返回论坛广场', 'info');
      return true;
    }

    try {
      state.bootstrap = await F.api('bootstrap');
    } catch (error) {
      list.innerHTML = stateMarkup('error', '论坛初始化失败', error.message, true);
      list.querySelector('[data-retry]').addEventListener('click', () => location.reload());
      return;
    }

    setupNotifications(state.bootstrap);
    const postButton = $('.btn-post');
    if (!state.bootstrap.user) postButton.addEventListener('click', (event) => { event.preventDefault(); F.requireLogin('Forum/forum-create.html'); });

    function renderNavigation() {
      $$('.nav-list [data-view]').forEach((anchor) => {
        const active = anchor.dataset.view === state.section;
        anchor.closest('.nav-item').classList.toggle('active', active);
        if (active) anchor.setAttribute('aria-current', 'page');
        else anchor.removeAttribute('aria-current');
      });
      $$('[data-sort]').forEach((button) => {
        const active = button.dataset.sort === state.sort;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      $$('[data-category-id]').forEach((button) => {
        const active = Number(button.dataset.categoryId) === state.categoryId;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function renderCategories() {
      const tabs = $('#forumCategoryTabs');
      tabs.innerHTML = `<button class="tab ${state.categoryId ? '' : 'active'}" type="button" data-category-id="0" aria-pressed="${state.categoryId ? 'false' : 'true'}">全部分类</button>` + state.categories.map((category) =>
        `<button class="tab ${state.categoryId === Number(category.id) ? 'active' : ''}" type="button" data-category-id="${Number(category.id)}" aria-pressed="${state.categoryId === Number(category.id) ? 'true' : 'false'}">${F.esc(category.name)}</button>`
      ).join('');
      tabs.querySelectorAll('[data-category-id]').forEach((button) => button.addEventListener('click', () => {
        if (state.section === 'mine' || state.section === 'favorites') {
          state.section = 'plaza';
        }
        state.categoryId = Number(button.dataset.categoryId) || 0;
        state.page = 1;
        refresh({ historyMode: 'push', source: button });
      }));
    }

    async function loadCategories(token) {
      const categories = state.bootstrap.categories || [];
      if (token !== state.loadToken) return false;
      state.categories = categories;
      if (state.categoryId && !categories.some((category) => Number(category.id) === state.categoryId)) state.categoryId = 0;
      renderCategories();
      return true;
    }

    function renderPost(item) {
      const category = item.category ? `<span class="post-pill category">${F.esc(item.category.name)}</span>` : '';
      const finalReply = item.last_reply_author && item.last_reply_author.nickname
        ? `<span class="post-last-reply"><span class="sep">·</span><span>最后回复：${F.esc(item.last_reply_author.nickname)}</span></span>` : '';
      const activityTime = `<span class="post-activity-time"><span class="sep">·</span>${F.formatDate(item.last_activity_at)}</span>`;
      const href = `./forum-post.html?id=${Number(item.id)}`;
      const excerpt = String(item.match_excerpt || item.excerpt || '').trim();
      const previewUrl = item.preview_image && typeof F.forumImageUrl === 'function'
        ? F.forumImageUrl(item.preview_image.url)
        : '';
      const preview = previewUrl ? `<a class="post-preview" href="${href}" aria-label="查看帖子《${F.attr(item.title)}》的图片">
        <img src="${F.attr(previewUrl)}" alt="${F.attr(item.preview_image.alt || '帖子图片')}" loading="lazy" decoding="async"${Number(item.preview_image.width) > 0 ? ` width="${Number(item.preview_image.width)}"` : ''}${Number(item.preview_image.height) > 0 ? ` height="${Number(item.preview_image.height)}"` : ''}>
      </a>` : '';
      return `<article class="post-row ${item.is_pinned ? 'pinned' : ''}" aria-labelledby="forum-topic-${Number(item.id)}">
        <div class="post-author-media">${F.avatarImage(item.author, 'post-avatar')}</div>
        <div class="post-body"><div class="post-title-line">
          <a class="post-title" id="forum-topic-${Number(item.id)}" href="${href}">${F.esc(item.title)}</a>
          ${item.is_pinned ? '<span class="post-pill pinned-badge">置顶</span>' : ''}
          ${item.is_essence ? '<span class="post-pill essence-badge">精华</span>' : ''}${category}
        </div>
        ${excerpt ? `<p class="post-excerpt">${F.esc(excerpt)}</p>` : ''}
        <div class="post-meta"><span class="post-author-name" title="${F.attr(item.author.nickname)}">${F.esc(item.author.nickname)}</span>${displayClubBadge(item.author)}${activityTime}${finalReply}</div>
        </div>
        <div class="post-row-aside">
          <div class="post-stats" aria-label="帖子统计"><span>${commentIcon} ${F.compact(item.reply_count)}</span><span>${likeIcon} ${F.compact(item.like_count)}</span></div>
          ${preview}
        </div>
      </article>`;
    }

    function renderPagination(pagination) {
      const node = $('#forumPagination');
      if (!pagination || pagination.total_pages <= 1) { node.innerHTML = ''; return; }
      const numbers = pageNumbers(pagination.page, pagination.total_pages);
      let previous = 0;
      const middle = numbers.map((number) => {
        const gap = previous && number - previous > 1 ? '<span>…</span>' : '';
        previous = number;
        return gap + (number === pagination.page
          ? `<span class="current" aria-current="page">${number}</span>`
          : `<a href="#" data-page="${number}">${number}</a>`);
      }).join('');
      node.innerHTML = `<a href="#" data-page="${Math.max(1, pagination.page - 1)}" ${pagination.page <= 1 ? 'aria-disabled="true"' : ''}>«</a>${middle}<a href="#" data-page="${Math.min(pagination.total_pages, pagination.page + 1)}" ${pagination.page >= pagination.total_pages ? 'aria-disabled="true"' : ''}>»</a>`;
      node.querySelectorAll('[data-page]').forEach((anchor) => anchor.addEventListener('click', (event) => {
        event.preventDefault();
        if (anchor.getAttribute('aria-disabled') === 'true') return;
        state.page = Number(anchor.dataset.page);
        refresh({ historyMode: 'push', source: anchor });
        window.scrollTo({ top: Math.max(0, list.getBoundingClientRect().top + window.scrollY - 76), behavior: 'smooth' });
      }));
    }

    async function fetchPosts() {
      if (state.section === 'mine' || state.section === 'favorites') {
        if (!state.bootstrap.user) {
          F.requireLogin(`Forum/forum-plaza.html?view=${state.section}`);
          return null;
        }
        return F.api('list_mine', { query: { type: state.section === 'favorites' ? 'favorites' : 'posts', page: state.page, limit: 20 } });
      }
      return F.api('list_posts', { query: {
        page: state.page, limit: 20, sort: state.section === 'latest' ? 'latest' : state.sort,
        category_id: state.categoryId || '', q: state.q
      } });
    }

    function syncLocation(historyMode) {
      if (historyMode === 'none') return;
      setUrl({
        page: state.page > 1 ? state.page : '', sort: state.sort === 'latest' ? '' : state.sort,
        category: state.categoryId || '', scope: '', club: '', country: '',
        view: ['latest', 'mine', 'favorites'].includes(state.section) ? state.section : '', q: state.q || ''
      }, historyMode === 'replace');
      lastHandledSearch = location.search;
    }

    async function refresh(options) {
      const settings = Object.assign({ historyMode: 'push', reloadCategories: false, source: null }, options || {});
      const token = ++state.loadToken;
      clearInlineBusy();
      renderNavigation();
      const currentNav = $('.nav-list a[aria-current="page"]');
      if (currentNav) currentNav.closest('.nav-item').classList.add('is-loading');
      if (settings.source && settings.source.isConnected) {
        settings.source.classList.add('is-navigating');
        settings.source.setAttribute('data-forum-inline-busy', 'true');
      }
      list.setAttribute('aria-busy', 'true');
      list.innerHTML = stateMarkup('loading', '正在读取论坛内容', '请稍候');
      announce('正在更新论坛内容…');
      try {
        if (settings.reloadCategories && !(await loadCategories(token))) return;
        const data = await fetchPosts();
        if (!data || token !== state.loadToken) return;
        list.innerHTML = data.items.length ? data.items.map(renderPost).join('') : stateMarkup('empty', '这里还没有帖子', state.q ? '没有找到匹配内容，可以尝试更短的关键词。' : '成为第一个开启话题的人。');
        renderPagination(data.pagination);
        $('#forumTotal').textContent = `共 ${Number(data.pagination.total).toLocaleString('zh-CN')} 个帖子`;
        syncLocation(settings.historyMode);
        renderNavigation();
        announce('论坛内容已更新');
      } catch (error) {
        if (token !== state.loadToken) return;
        list.innerHTML = stateMarkup('error', '帖子读取失败', error.message, true);
        list.querySelector('[data-retry]').addEventListener('click', () => refresh({ historyMode: 'replace', reloadCategories: settings.reloadCategories }));
        $('#forumPagination').innerHTML = '';
        $('#forumTotal').textContent = '暂时无法统计帖子';
        announce('论坛内容加载失败');
      } finally {
        if (token === state.loadToken) clearInlineBusy();
      }
    }

    $$('[data-sort]').forEach((button) => button.addEventListener('click', () => {
      state.sort = button.dataset.sort;
      if (state.section === 'mine' || state.section === 'favorites' || (state.section === 'latest' && state.sort !== 'latest')) {
        state.section = 'plaza';
      }
      state.page = 1;
      renderNavigation();
      refresh({ historyMode: 'push', source: button });
    }));
    search.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      state.q = search.value.trim();
      if (state.section === 'mine' || state.section === 'favorites') {
        state.section = 'plaza';
      }
      state.page = 1;
      refresh({ historyMode: 'push', source: search });
    });
    search.addEventListener('search', () => {
      if (search.value) return;
      state.q = '';
      state.page = 1;
      refresh({ historyMode: 'push', source: search });
    });

    $('#forumSidebar').addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('[data-view]');
      if (!anchor) return;
      event.preventDefault();
      const section = ['plaza', 'latest', 'mine', 'favorites'].includes(anchor.dataset.view) ? anchor.dataset.view : 'plaza';
      if ((section === 'mine' || section === 'favorites') && !state.bootstrap.user) {
        F.requireLogin(`Forum/forum-plaza.html?view=${section}`);
        return;
      }
      state.section = section;
      state.sort = 'latest';
      state.categoryId = 0;
      state.page = 1;
      state.q = '';
      search.value = '';
      refresh({ historyMode: 'push', reloadCategories: true, source: anchor });
    });

    globalThis.addEventListener('popstate', () => {
      if (location.search === lastHandledSearch) return;
      lastHandledSearch = location.search;
      Object.assign(state, readLocationState());
      normalizeRetiredSpace();
      search.value = state.q;
      refresh({ historyMode: 'none', reloadCategories: true });
    });

    normalizeRetiredSpace();
    renderNavigation();
    try { await refresh({ historyMode: 'replace', reloadCategories: true }); }
    catch (error) {
      list.innerHTML = stateMarkup('error', '论坛读取失败', error.message, true);
      list.querySelector('[data-retry]').addEventListener('click', () => location.reload());
    }
  }

  async function initPost() {
    F.setupChrome();
    const params = new URLSearchParams(location.search);
    const postId = Math.max(0, Number(params.get('id')) || 0);
    const replyHashMatch = String(location.hash || '').match(/^#reply-(\d+)$/);
    const replyAnchorFromUrl = Math.max(0, Number(params.get('reply_anchor')) || Number(replyHashMatch && replyHashMatch[1]) || 0);
    const root = $('#forumPostRoot');
    const replyList = $('#forumReplyList');
    const repliesSection = $('.replies');
    const quickReply = $('.quick-reply');
    const state = {
      post: null,
      bootstrap: null,
      replyPage: Math.max(1, Number(params.get('reply_page')) || 1),
      replySort: params.get('reply_sort') === 'hot' ? 'hot' : 'time',
      replyAnchor: replyAnchorFromUrl,
      replyPagination: null,
      replyLoadToken: 0,
      postActionTokens: new Map(),
      replyActionTokens: new Map()
    };
    let replyComposer = null;
    if (state.replyAnchor) state.replySort = 'time';
    const setUnavailable = () => {
      if (repliesSection) repliesSection.hidden = true;
      if (quickReply) quickReply.hidden = true;
    };
    if (!postId) {
      setUnavailable();
      root.innerHTML = stateMarkup('error', '链接缺少帖子 ID', '请返回论坛广场重新选择帖子。');
      replyList.innerHTML = '';
      return;
    }
    try {
      [state.bootstrap, state.post] = await Promise.all([F.api('bootstrap'), F.api('get_post', { query: { id: postId } })]);
    } catch (error) {
      setUnavailable();
      const unavailable = error.status === 404;
      root.innerHTML = stateMarkup(
        'error',
        unavailable ? '帖子不存在或暂不可用' : (error.status === 403 ? '无法访问这个帖子' : '帖子读取失败'),
        unavailable ? '内容可能已删除、隐藏或暂未开放。' : error.message,
        !unavailable
      );
      const retry = root.querySelector('[data-retry]');
      if (retry) retry.addEventListener('click', () => location.reload());
      replyList.innerHTML = '';
      return;
    }
    document.title = `${state.post.title} · VNFest 论坛`;

    function postTags() {
      const post = state.post;
      const tags = [];
      if (post.category) tags.push(`<span class="post-tag" style="background:rgba(231,76,60,0.12);color:var(--primary)">${F.esc(post.category.name)}</span>`);
      if (post.is_pinned) tags.push('<span class="post-tag" style="background:rgba(231,76,60,.12);color:var(--primary)">置顶</span>');
      if (post.is_essence) tags.push('<span class="post-tag" style="background:rgba(84,169,130,.15);color:#54a982">精华</span>');
      (post.tags || []).forEach((tag) => tags.push(`<span class="post-tag">${F.esc(tag)}</span>`));
      return tags.join('');
    }

    function renderPost() {
      const post = state.post;
      const titleId = `forum-post-title-${post.id}`;
      const authorId = `forum-post-author-${post.id}`;
      const likeLabel = post.liked ? '取消点赞' : '点赞';
      const favoriteLabel = post.favorited ? '取消收藏' : '收藏';
      root.setAttribute('aria-labelledby', titleId);
      root.innerHTML = `<header class="post-author-rail post-author-head">
          ${F.avatarImage(post.author, 'avatar', { eager: true })}
          <div class="post-author-identity">
            <div class="post-author-identity-line"><strong class="author" id="${authorId}" title="${F.attr(post.author.nickname)}">${F.esc(post.author.nickname)}</strong>${displayClubBadge(post.author)}</div>
            <div class="post-author-meta"><span>${F.formatDate(post.created_at, true)}</span>${post.edited_at ? '<span> · 已编辑</span>' : ''}<span> · 浏览 ${F.compact(post.view_count)}</span></div>
          </div>
        </header>
        <div class="post-article post-article-main">
          <header class="post-article-head">
            <div class="post-tags">${postTags()}</div>
            <h1 id="${titleId}">${F.esc(post.title)}</h1>
          </header>
          <div class="post-content">${F.markdown(post.body_md)}</div>
          <div class="post-actions">
          <button type="button" class="forum-icon-action like ${post.liked ? 'active' : ''}" data-post-action="like" aria-label="${likeLabel}" aria-pressed="${String(Boolean(post.liked))}" title="${likeLabel}">${likeIcon}<span class="forum-action-count">${F.compact(post.like_count)}</span></button>
          <button type="button" class="forum-icon-action" data-post-action="reply" aria-label="回复" title="回复">${commentIcon}</button>
          <button type="button" class="forum-icon-action ${post.favorited ? 'active' : ''}" data-post-action="favorite" aria-label="${favoriteLabel}" aria-pressed="${String(Boolean(post.favorited))}" title="${favoriteLabel}">${bookmarkIcon}</button>
          <button type="button" class="forum-icon-action" data-post-action="share" aria-label="分享" title="分享">${shareIcon}</button>
          ${post.capabilities.report ? `<button type="button" class="forum-icon-action forum-runtime-meta-action" data-post-action="report" aria-label="举报" title="举报">${flagIcon}</button>` : ''}
          ${post.capabilities.edit ? `<a class="forum-icon-action forum-runtime-meta-action" href="./forum-create.html?edit=${post.id}" aria-label="编辑" title="编辑">${editIcon}</a>` : ''}
          ${post.capabilities.delete ? `<button type="button" class="forum-icon-action forum-runtime-meta-action" data-post-action="delete" aria-label="删除" title="删除">${trashIcon}</button>` : ''}
          ${post.capabilities.moderate ? `<button type="button" class="forum-icon-action forum-runtime-meta-action" data-post-action="moderate" aria-label="管理" title="管理">${manageIcon}</button>` : ''}
          </div>
        </div>`;
      root.querySelectorAll('[data-post-action]').forEach((button) => button.addEventListener('click', () => handlePostAction(button.dataset.postAction, button)));
    }

    function moveToReply() {
      const reply = $('.quick-reply');
      if (!reply) return;
      window.scrollTo({ top: Math.max(0, reply.getBoundingClientRect().top + window.scrollY - 74), behavior: 'smooth' });
      if (replyComposer) replyComposer.activate('visual', true);
      else $('#forumReplyBody').focus();
    }

    async function handlePostAction(action, sourceButton) {
      const actionToken = (state.postActionTokens.get(action) || 0) + 1;
      state.postActionTokens.set(action, actionToken);
      try {
        if (action === 'like') {
          if (!state.bootstrap.user) { F.requireLogin(`Forum/forum-post.html?id=${postId}`); return; }
          const desired = !state.post.liked;
          F.setBusy(sourceButton, true, '处理中…');
          const data = await F.api('toggle_like', { method: 'POST', body: { target_type: 'post', target_id: postId, active: desired } });
          if (state.postActionTokens.get(action) !== actionToken) return;
          state.post.liked = data.active;
          state.post.like_count = data.like_count;
          renderPost();
        } else if (action === 'favorite') {
          if (!state.bootstrap.user) { F.requireLogin(`Forum/forum-post.html?id=${postId}`); return; }
          const desired = !state.post.favorited;
          F.setBusy(sourceButton, true, '处理中…');
          const data = await F.api('toggle_favorite', { method: 'POST', body: { post_id: postId, active: desired } });
          if (state.postActionTokens.get(action) !== actionToken) return;
          state.post.favorited = data.active;
          state.post.favorite_count = data.favorite_count;
          renderPost();
        } else if (action === 'reply') {
          const selection = String(window.getSelection && window.getSelection() || '').trim();
          if (selection) {
            const quote = `> ${selection.slice(0, 500)}`;
            if (replyComposer) replyComposer.insertMarkdown(quote);
            else F.insertText($('#forumReplyBody'), '> ', '\n\n', selection.slice(0, 500));
          }
          moveToReply();
        } else if (action === 'share') {
          await navigator.clipboard.writeText(window.location.href);
          F.toast('帖子链接已复制');
        } else if (action === 'report') {
          openReport('post', postId);
        } else if (action === 'delete') {
          if (!window.confirm('确定删除这篇帖子？删除后普通用户将无法查看。')) return;
          await F.api('delete_post', { method: 'POST', body: { id: postId } });
          window.location.href = './forum-plaza.html';
        } else if (action === 'moderate') {
          openModeration('post', postId, state.post);
        }
      } catch (error) {
        if (state.postActionTokens.get(action) !== actionToken) return;
        if (sourceButton) F.setBusy(sourceButton, false);
        F.toast(error.message, 'error');
      }
    }

    function openReport(type, targetId) {
      const dialog = F.openDialog({
        title: '举报内容',
        html: `<div class="forum-runtime-field"><label for="forumReportReason">举报理由</label><select id="forumReportReason">
          <option value="spam">垃圾广告</option><option value="harassment">辱骂骚扰</option><option value="illegal">违法违规</option>
          <option value="copyright">侵权</option><option value="privacy">泄露隐私</option><option value="other">其他</option>
        </select></div><div class="forum-runtime-field"><label for="forumReportDetails">补充说明</label><textarea id="forumReportDetails" maxlength="1000" placeholder="选择“其他”时必须填写"></textarea></div>`,
        actions: '<div class="forum-runtime-dialog-actions"><button type="button" data-dialog-cancel>取消</button><button type="button" class="primary" data-report-submit>提交举报</button></div>'
      });
      dialog.element.querySelector('[data-dialog-cancel]').addEventListener('click', dialog.close);
      dialog.element.querySelector('[data-report-submit]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        try {
          F.setBusy(button, true, '提交中…');
          await F.api('report', { method: 'POST', body: {
            target_type: type, target_id: targetId,
            reason: $('#forumReportReason', dialog.element).value,
            details: $('#forumReportDetails', dialog.element).value.trim()
          } });
          dialog.close();
          F.toast('举报已提交，我们会尽快处理');
        } catch (error) { F.toast(error.message, 'error'); F.setBusy(button, false); }
      });
    }

    function openModeration(type, targetId, target) {
      const isPost = type === 'post';
      const dialog = F.openDialog({
        title: '管理内容',
        html: `<p>请选择对当前${isPost ? '帖子' : '回复'}执行的操作。所有操作都会写入审计日志。</p>
          <div class="forum-runtime-field"><label for="forumModerationOperation">操作</label><select id="forumModerationOperation">
            <option value="hide">隐藏内容</option><option value="delete">删除内容</option><option value="restore">恢复内容</option>
            ${isPost ? `<option value="${target.is_pinned ? 'unpin' : 'pin'}">${target.is_pinned ? '取消置顶' : '置顶'}</option><option value="${target.is_essence ? 'unessence' : 'essence'}">${target.is_essence ? '取消精华' : '加精'}</option>` : ''}
          </select></div><div class="forum-runtime-field"><label for="forumModerationResolution">处理说明</label><textarea id="forumModerationResolution" maxlength="1000"></textarea></div>`,
        actions: '<div class="forum-runtime-dialog-actions"><button type="button" data-dialog-cancel>取消</button><button type="button" class="primary" data-moderate-submit>确认执行</button></div>'
      });
      dialog.element.querySelector('[data-dialog-cancel]').addEventListener('click', dialog.close);
      dialog.element.querySelector('[data-moderate-submit]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        try {
          F.setBusy(button, true, '处理中…');
          await F.api('moderate', { method: 'POST', body: {
            target_type: type, target_id: targetId,
            operation: $('#forumModerationOperation', dialog.element).value,
            resolution: $('#forumModerationResolution', dialog.element).value.trim()
          } });
          location.reload();
        } catch (error) { F.toast(error.message, 'error'); F.setBusy(button, false); }
      });
    }

    function renderReply(reply) {
      const parent = reply.parent ? `<div class="quote"><strong>${F.esc(reply.parent.username)}</strong> 说：<p>${F.esc(reply.parent.excerpt || '')}</p></div>` : '';
      const authorId = `forum-reply-author-${reply.id}`;
      return `<article class="reply-item" id="reply-${reply.id}" aria-labelledby="${authorId}">
        <header class="reply-author-rail">
          ${F.avatarImage(reply.author, 'avatar')}
          <strong class="reply-author" id="${authorId}" title="${F.attr(reply.author.nickname)}">${F.esc(reply.author.nickname)}</strong>
          ${displayClubBadge(reply.author)}
          <span class="reply-time">${F.formatDate(reply.created_at)}${reply.edited_at ? ' · 已编辑' : ''}<span class="reply-floor">#${reply.floor}</span></span>
        </header>
        <div class="reply-main">
        <div class="reply-body">${parent}${F.markdown(reply.body_md)}</div>
        <div class="reply-foot">
          <button type="button" class="forum-icon-action" data-reply-action="quote" data-reply-id="${reply.id}" aria-label="引用" title="引用">${quoteIcon}</button>
          <button type="button" class="forum-icon-action" data-reply-action="reply" data-reply-id="${reply.id}" aria-label="回复" title="回复">${commentIcon}</button>
          ${reply.capabilities.like ? `<button type="button" class="forum-icon-action ${reply.liked ? 'is-active' : ''}" data-reply-action="like" data-reply-id="${reply.id}" aria-label="${reply.liked ? '取消点赞' : '点赞'}" aria-pressed="${String(Boolean(reply.liked))}" title="${reply.liked ? '取消点赞' : '点赞'}">${likeIcon}<span class="forum-action-count">${F.compact(reply.like_count)}</span></button>` : ''}
          ${reply.capabilities.report ? `<button type="button" class="forum-icon-action" data-reply-action="report" data-reply-id="${reply.id}" aria-label="举报" title="举报">${flagIcon}</button>` : ''}
          ${reply.capabilities.edit ? `<button type="button" class="forum-icon-action" data-reply-action="edit" data-reply-id="${reply.id}" aria-label="编辑" title="编辑">${editIcon}</button>` : ''}
          ${reply.capabilities.delete ? `<button type="button" class="forum-icon-action" data-reply-action="delete" data-reply-id="${reply.id}" aria-label="删除" title="删除">${trashIcon}</button>` : ''}
        </div></div>
      </article>`;
    }

    function renderReplyPagination(pagination) {
      const node = $('#forumReplyPagination');
      if (!pagination || pagination.total_pages <= 1) { node.innerHTML = ''; return; }
      node.innerHTML = `<button type="button" data-reply-page="${Math.max(1, pagination.page - 1)}" ${pagination.page <= 1 ? 'disabled' : ''}>上一页</button>` +
        pageNumbers(pagination.page, pagination.total_pages).map((page) => `<button type="button" data-reply-page="${page}" ${page === pagination.page ? 'aria-current="page"' : ''}>${page}</button>`).join('') +
        `<button type="button" data-reply-page="${Math.min(pagination.total_pages, pagination.page + 1)}" ${pagination.page >= pagination.total_pages ? 'disabled' : ''}>下一页</button>`;
      node.querySelectorAll('[data-reply-page]').forEach((button) => button.addEventListener('click', () => {
        state.replyAnchor = 0;
        state.replyPage = Number(button.dataset.replyPage);
        loadReplies();
      }));
    }

    function replyTargetExcerpt(markdown) {
      return String(markdown || '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[`*_>#~\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || '图片或格式化回复';
    }

    function setReplyTarget(reply) {
      const target = $('#forumReplyTarget');
      $('#forumReplyParent').value = reply ? String(reply.id) : '';
      if (!target) return;
      if (!reply) {
        target.hidden = true;
        target.innerHTML = '';
        return;
      }
      target.hidden = false;
      target.innerHTML = `<span><strong>正在回复 ${F.esc(reply.author.nickname)}</strong><span>${F.esc(replyTargetExcerpt(reply.body_md))}</span></span><button type="button" data-reply-target-clear aria-label="取消引用">取消</button>`;
      target.querySelector('[data-reply-target-clear]').addEventListener('click', () => {
        setReplyTarget(null);
        $('#forumReplyBody').focus();
      });
    }

    async function handleReplyAction(action, replyId, sourceButton) {
      const reply = state.replyPagination.items.find((item) => item.id === replyId);
      if (!reply) return;
      const tokenKey = `${action}:${replyId}`;
      const actionToken = (state.replyActionTokens.get(tokenKey) || 0) + 1;
      state.replyActionTokens.set(tokenKey, actionToken);
      try {
        if (action === 'quote' || action === 'reply') {
          if (!state.bootstrap.user) { F.requireLogin(`Forum/forum-post.html?id=${postId}`); return; }
          setReplyTarget(reply);
          if (action === 'reply') {
            const mention = `@${reply.author.username} `;
            if (replyComposer) replyComposer.insertText(mention);
            else {
              const replyTextarea = $('#forumReplyBody');
              replyTextarea.setRangeText(mention, replyTextarea.selectionStart, replyTextarea.selectionEnd, 'end');
              replyTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
          moveToReply();
        } else if (action === 'like') {
          const desired = !reply.liked;
          F.setBusy(sourceButton, true, '处理中…');
          const data = await F.api('toggle_like', { method: 'POST', body: { target_type: 'reply', target_id: replyId, active: desired } });
          if (state.replyActionTokens.get(tokenKey) !== actionToken) return;
          reply.liked = data.active;
          reply.like_count = data.like_count;
          renderReplies();
        } else if (action === 'report') {
          openReport('reply', replyId);
        } else if (action === 'delete') {
          if (!window.confirm('确定删除这条回复？')) return;
          await F.api('delete_reply', { method: 'POST', body: { id: replyId } });
          await loadReplies();
        } else if (action === 'edit') {
          const dialog = F.openDialog({
            title: '编辑回复',
            html: `<div class="forum-runtime-field"><label for="forumEditReply">回复内容</label><textarea id="forumEditReply" maxlength="50000">${F.esc(reply.body_md)}</textarea></div>`,
            actions: '<div class="forum-runtime-dialog-actions"><button type="button" data-dialog-cancel>取消</button><button type="button" class="primary" data-edit-submit>保存</button></div>'
          });
          dialog.element.querySelector('[data-dialog-cancel]').addEventListener('click', dialog.close);
          dialog.element.querySelector('[data-edit-submit]').addEventListener('click', async (event) => {
            const button = event.currentTarget;
            try {
              F.setBusy(button, true, '保存中…');
              await F.api('update_reply', { method: 'POST', body: { id: replyId, body_md: $('#forumEditReply', dialog.element).value.trim() } });
              dialog.close();
              await loadReplies();
            } catch (error) { F.toast(error.message, 'error'); F.setBusy(button, false); }
          });
        }
      } catch (error) {
        if (state.replyActionTokens.get(tokenKey) !== actionToken) return;
        if (sourceButton) F.setBusy(sourceButton, false);
        F.toast(error.message, 'error');
      }
    }

    function renderReplies() {
      const data = state.replyPagination;
      $('#forumReplyCount').textContent = `${Number(data.pagination.total).toLocaleString('zh-CN')} 条`;
      replyList.innerHTML = data.items.length ? data.items.map(renderReply).join('') : stateMarkup('empty', '还没有回复', '成为第一个参与讨论的人。');
      renderReplyPagination(data.pagination);
      replyList.querySelectorAll('[data-reply-action]').forEach((button) => button.addEventListener('click', () => handleReplyAction(button.dataset.replyAction, Number(button.dataset.replyId), button)));
    }

    async function loadReplies() {
      const loadToken = ++state.replyLoadToken;
      replyList.innerHTML = stateMarkup('loading', '正在读取回复', '');
      replyList.setAttribute('aria-busy', 'true');
      try {
        const query = { post_id: postId, page: state.replyPage, limit: 30, sort: state.replySort };
        if (state.replyAnchor) query.anchor_id = state.replyAnchor;
        const anchorId = state.replyAnchor;
        const data = await F.api('list_replies', { query });
        if (loadToken !== state.replyLoadToken) return;
        state.replyPage = data.pagination.page;
        state.replyAnchor = 0;
      state.replyPagination = data;
      renderReplies();
      const live = $('#forumNavigationStatus');
      if (live) live.textContent = `已加载 ${data.items.length} 条回复`;
        if (anchorId) {
          window.requestAnimationFrame(() => {
            const target = document.getElementById(`reply-${anchorId}`);
            if (target) window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 74), behavior: 'auto' });
          });
        }
      } catch (error) {
        if (loadToken !== state.replyLoadToken) return;
        replyList.innerHTML = stateMarkup('error', '回复读取失败', error.message, true);
        replyList.querySelector('[data-retry]').addEventListener('click', loadReplies);
      } finally {
        if (loadToken === state.replyLoadToken) replyList.removeAttribute('aria-busy');
      }
    }

    $$('[data-reply-sort]').forEach((button) => {
      const active = button.dataset.replySort === state.replySort;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-reply-sort]').forEach((button) => button.addEventListener('click', () => {
      state.replySort = button.dataset.replySort;
      state.replyAnchor = 0;
      state.replyPage = 1;
      $$('[data-reply-sort]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      loadReplies();
    }));
    globalThis.addEventListener('hashchange', () => {
      const match = String(location.hash || '').match(/^#reply-(\d+)$/);
      const anchorId = Math.max(0, Number(match && match[1]) || 0);
      if (!anchorId) return;
      state.replyAnchor = anchorId;
      state.replySort = 'time';
      state.replyPage = 1;
      $$('[data-reply-sort]').forEach((button) => {
        const active = button.dataset.replySort === 'time';
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      loadReplies();
    });

    renderPost();
    const replyBody = $('#forumReplyBody');
    const replyVisualEditor = $('#forumReplyVisualEditor');
    const replySubmit = $('#forumReplySubmit');
    if (!state.bootstrap.user) {
      const replyTabs = $('#forumReplyEditorTabs');
      const replyToolbar = $('.reply-markdown-toolbar');
      const replyPreviewPanel = $('#forumReplyPreviewPanel');
      if (replyTabs) replyTabs.hidden = true;
      if (replyToolbar) replyToolbar.hidden = true;
      if (replyPreviewPanel) replyPreviewPanel.hidden = true;
      if (replyVisualEditor) {
        replyVisualEditor.hidden = true;
        replyVisualEditor.contentEditable = 'false';
      }
      replyBody.hidden = false;
      replyBody.removeAttribute('aria-hidden');
      replyBody.disabled = true;
      replyBody.placeholder = '登录后可以参与回复';
      replySubmit.textContent = '登录后回复';
      replySubmit.addEventListener('click', () => F.requireLogin(`Forum/forum-post.html?id=${postId}`));
      $('#forumReplyUpload').textContent = '登录后可使用 Markdown、@提及和图片上传。';
    } else {
      const replyCount = $('#forumReplyBodyCount');
      const refreshReplyCount = () => { replyCount.textContent = `${Array.from(replyBody.value).length.toLocaleString('zh-CN')} / 50,000`; };
      replyBody.hidden = true;
      replyBody.setAttribute('aria-hidden', 'true');
      replyComposer = F.setupRichComposer({
        textarea: replyBody,
        editor: replyVisualEditor,
        preview: $('#forumReplyPreview'),
        editorPanel: $('#forumReplyEditorPanel'),
        previewPanel: $('#forumReplyPreviewPanel'),
        tabList: $('#forumReplyEditorTabs'),
        status: $('#forumReplyPreviewStatus'),
        emptyTitle: '回复预览会显示在这里',
        emptyHint: '使用工具栏或直接输入 Markdown。'
      });
      const uploadToken = F.randomToken();
      const uploader = F.setupUploader({
        zone: $('#forumReplyUpload'), textarea: replyBody, token: uploadToken,
        pasteTarget: replyVisualEditor,
        dropTarget: replyVisualEditor,
        maxCount: state.bootstrap.limits.images, maxBytes: state.bootstrap.limits.image_bytes,
        onInsert: (markdownText) => replyComposer.insertMarkdown(markdownText),
        onChange: (items) => {
          const pending = items.some((item) => ['waiting', 'uploading', 'removing'].includes(item.status));
          replySubmit.disabled = pending;
          if (pending) replySubmit.textContent = '等待图片上传';
          else if (!replySubmit.dataset.busy) replySubmit.textContent = '发送回复';
        }
      });
      F.setupRichToolbar($('.reply-markdown-toolbar'), replyComposer, { onImage: () => uploader.open() });
      replyBody.addEventListener('input', refreshReplyCount);
      refreshReplyCount();
      replySubmit.addEventListener('click', async () => {
        replyComposer.syncMarkdown();
        const body = replyBody.value.trim();
        if (!body) { F.toast('请输入回复内容', 'error'); replyComposer.activate('visual', true); return; }
        if (uploader.hasPending()) { F.toast('请等待图片上传完成', 'error'); return; }
        try {
          F.setBusy(replySubmit, true, '发送中…');
          const data = await F.api('create_reply', { method: 'POST', body: {
            post_id: postId, body_md: body, parent_reply_id: Number($('#forumReplyParent').value) || null, upload_token: uploadToken
          } });
          const replyId = Number(data.anchor_id || data.id);
          window.location.href = `./forum-post.html?id=${postId}&reply_anchor=${replyId}#reply-${replyId}`;
        } catch (error) { F.toast(error.message, 'error'); F.setBusy(replySubmit, false); replyComposer.refresh(); }
      });
    }
    await loadReplies();
  }

  async function initCreate() {
    F.setupChrome();
    const form = $('#postForm');
    const title = $('#title');
    const body = $('#content');
    const visualEditor = $('#forumVisualEditor');
    const categoryGroup = $('#categoryGroup');
    const categoryInput = $('#category');
    const tagContainer = $('#tagInput');
    const tagInput = $('#tagInput input');
    const submit = $('#forumSubmitPost');
    const titleCount = $('#forumTitleCount');
    const bodyCount = $('#forumBodyCount');
    const draftStatus = $('#forumDraftStatus');
    const publishStatus = $('#forumPublishStatus');
    const params = new URLSearchParams(location.search);
    const editId = Math.max(0, Number(params.get('edit')) || 0);
    const uploadToken = F.randomToken();
    const state = {
      bootstrap: null,
      post: null,
      categories: [],
      tags: [],
      draftTimer: 0,
      draftKey: '',
      restoring: false,
      initialized: false,
      submitting: false,
      uploadPending: false
    };
    submit.disabled = true;

    try {
      state.bootstrap = await F.api('bootstrap');
    } catch (error) {
      form.innerHTML = stateMarkup('error', '发帖页初始化失败', error.message, true);
      form.querySelector('[data-retry]').addEventListener('click', () => location.reload());
      return;
    }
    if (!state.bootstrap.user) { F.requireLogin(`Forum/forum-create.html${editId ? `?edit=${editId}` : ''}`); return; }
    state.draftKey = `vnfest:forum:draft:${state.bootstrap.user.id}:${editId ? `edit:${editId}` : 'create'}`;

    function renderCategories(categories, selectedId) {
      state.categories = categories;
      categoryGroup.innerHTML = categories.map((category, index) => `<button type="button" class="category-chip ${Number(selectedId) === Number(category.id) || (!selectedId && index === 0) ? 'selected' : ''}" data-category-id="${Number(category.id)}" data-category="${F.attr(category.name)}">${F.esc(category.name)}</button>`).join('');
      const active = $('.category-chip.selected', categoryGroup);
      categoryInput.value = active ? active.dataset.categoryId : '';
      categoryGroup.querySelectorAll('.category-chip').forEach((chip) => chip.addEventListener('click', () => {
        categoryGroup.querySelectorAll('.category-chip').forEach((item) => item.classList.remove('selected'));
        chip.classList.add('selected');
        categoryInput.value = chip.dataset.categoryId;
        scheduleDraft();
      }));
    }

    function refreshCategories(selectedId) {
      renderCategories(state.bootstrap.categories || [], selectedId);
    }

    function renderTags() {
      tagContainer.querySelectorAll('.tag').forEach((tag) => tag.remove());
      state.tags.forEach((tag, index) => {
        const element = document.createElement('span');
        element.className = 'tag';
        element.innerHTML = `${F.esc(tag)} <button type="button" aria-label="删除标签 ${F.attr(tag)}">×</button>`;
        element.querySelector('button').addEventListener('click', () => { state.tags.splice(index, 1); renderTags(); scheduleDraft(); });
        tagContainer.insertBefore(element, tagInput);
      });
    }

    function addTag(value) {
      const tag = String(value || '').trim().replace(/\s+/g, ' ');
      if (!tag) return true;
      if (Array.from(tag).length > 20) { F.toast('单个标签不能超过 20 字', 'error'); return false; }
      if (state.tags.some((current) => current.toLocaleLowerCase() === tag.toLocaleLowerCase())) { tagInput.value = ''; return true; }
      if (state.tags.length >= 5) { F.toast('每篇帖子最多添加 5 个标签', 'error'); return false; }
      state.tags.push(tag);
      tagInput.value = '';
      renderTags();
      scheduleDraft();
      return true;
    }
    tagInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(tagInput.value); }
      if (event.key === 'Backspace' && !tagInput.value && state.tags.length) { state.tags.pop(); renderTags(); scheduleDraft(); }
    });
    tagInput.addEventListener('blur', () => addTag(tagInput.value));

    function draftData() {
      return {
        title: title.value, body: body.value,
        categoryId: Number(categoryInput.value) || 0, tags: state.tags, savedAt: Date.now()
      };
    }

    function updateCounts() {
      titleCount.textContent = `${Array.from(title.value).length} / 100`;
      bodyCount.textContent = `${Array.from(body.value).length.toLocaleString('zh-CN')} / 50,000`;
    }

    function updateSubmitState() {
      submit.disabled = !state.initialized || state.submitting || state.uploadPending;
      if (state.submitting) publishStatus.textContent = editId ? '正在保存修改…' : '正在发布…';
      else if (state.uploadPending) publishStatus.textContent = '等待图片上传完成';
      else publishStatus.textContent = '内容会自动保存为本机草稿';
    }

    function scheduleDraft() {
      if (state.restoring) return;
      clearTimeout(state.draftTimer);
      draftStatus.textContent = '正在保存草稿…';
      state.draftTimer = window.setTimeout(() => {
        try {
          const draft = draftData();
          localStorage.setItem(state.draftKey, JSON.stringify(draft));
          draftStatus.textContent = `草稿已保存 ${new Date(draft.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        } catch (_) {
          draftStatus.textContent = '草稿保存失败';
        }
      }, 700);
    }
    [title, body].forEach((field) => field.addEventListener('input', () => { updateCounts(); scheduleDraft(); }));

    function showDraftOffer(draft) {
      const banner = document.createElement('div');
      banner.className = 'forum-runtime-draft';
      banner.innerHTML = `发现 ${F.formatDate(new Date(draft.savedAt).toISOString(), true)} 保存的本机草稿。<button type="button" data-draft-restore>恢复</button><button type="button" data-draft-discard>丢弃</button>`;
      form.insertBefore(banner, form.children[1]);
      banner.querySelector('[data-draft-restore]').addEventListener('click', async () => {
        state.restoring = true;
        let restored = false;
        try {
          title.value = draft.title || '';
          body.value = draft.body || '';
          state.tags = Array.isArray(draft.tags) ? draft.tags.slice(0, 5) : [];
          refreshCategories(draft.categoryId);
          renderTags();
          updateCounts();
          restored = true;
        } catch (error) {
          F.toast(`草稿恢复失败：${error.message}`, 'error');
        } finally {
          state.restoring = false;
          composer.refresh();
        }
        if (restored) banner.remove();
      });
      banner.querySelector('[data-draft-discard]').addEventListener('click', () => {
        clearTimeout(state.draftTimer);
        state.draftTimer = 0;
        localStorage.removeItem(state.draftKey);
        banner.remove();
      });
    }

    const composer = F.setupRichComposer({
      textarea: body,
      editor: visualEditor,
      preview: $('#forumCreatePreview'),
      editorPanel: $('#forumCreateEditorPanel'),
      previewPanel: $('#forumCreatePreviewPanel'),
      sourcePanel: $('#forumCreateSourcePanel'),
      tabList: $('#forumCreateEditorTabs'),
      status: $('#forumCreatePreviewStatus')
    });
    const uploader = F.setupUploader({
      zone: $('#uploadZone'), textarea: body, token: uploadToken,
      pasteTarget: visualEditor,
      dropTarget: visualEditor,
      trigger: $('#forumUploadButton'), countNode: $('#forumUploadCount'),
      maxCount: state.bootstrap.limits.images, maxBytes: state.bootstrap.limits.image_bytes,
      onInsert: (markdownText) => composer.insertMarkdown(markdownText),
      onChange: (items) => {
        state.uploadPending = items.some((item) => ['waiting', 'uploading', 'removing'].includes(item.status));
        updateSubmitState();
      }
    });
    F.setupRichToolbar($('.editor-toolbar'), composer, { onImage: () => uploader.open() });
    $('#forumMarkdownHelp').addEventListener('click', () => F.openDialog({
      title: 'Markdown 帮助',
      html: '<p>正文支持二级/三级标题、粗体、斜体、列表、引用、行内代码、代码块、HTTP(S) 链接、@提及和通过本页上传的图片。</p><p>标题本身已经是一级标题。原始 HTML、外部图片、iframe、data: 与 javascript: 地址会被当作文本或拒绝显示。</p>'
    }));

    if (editId) {
      try {
        state.post = await F.api('get_post', { query: { id: editId } });
        if (!state.post.capabilities.edit) throw new F.ForumError('只能编辑自己的帖子', 403);
        $('h1', form).textContent = '编辑帖子';
        $('.breadcrumb span:last-child').textContent = '编辑帖子';
        submit.textContent = '保存修改';
        title.value = state.post.title;
        body.value = state.post.body_md;
        state.tags = state.post.tags || [];
        refreshCategories(state.post.category && state.post.category.id);
        renderTags();
        updateCounts();
        composer.refresh();
      } catch (error) {
        form.innerHTML = stateMarkup(
          'error',
          error.status === 404 ? '帖子不存在或暂不可用' : (error.status === 403 ? '无法编辑这个帖子' : '帖子读取失败'),
          error.status === 404 ? '内容可能已删除、隐藏或暂未开放。' : error.message
        );
        return;
      }
    } else {
      refreshCategories();
    }

    try {
      const draft = JSON.parse(localStorage.getItem(state.draftKey) || 'null');
      if (draft && draft.savedAt && (draft.title || draft.body)) showDraftOffer(draft);
    } catch (_) { localStorage.removeItem(state.draftKey); }

    function validate() {
      let valid = true;
      $$('.error-msg', form).forEach((element) => { element.style.display = 'none'; });
      title.classList.remove('error');
      let invalid = null;
      if (!title.value.trim()) { $('#titleError').style.display = 'block'; title.classList.add('error'); valid = false; invalid = title; }
      if (!Number(categoryInput.value)) { F.toast('请选择分类', 'error'); valid = false; invalid = invalid || categoryGroup.querySelector('button'); }
      if (!body.value.trim()) { $('#contentError').style.display = 'block'; valid = false; invalid = invalid || visualEditor; }
      if (!valid) {
        composer.activate('visual');
        if (invalid) requestAnimationFrame(() => {
          window.scrollTo({ top: Math.max(0, invalid.getBoundingClientRect().top + window.scrollY - 120), behavior: 'smooth' });
          invalid.focus();
        });
      }
      return valid;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      composer.syncMarkdown();
      addTag(tagInput.value);
      if (!validate()) return;
      if (uploader.hasPending()) { F.toast('请等待图片上传完成', 'error'); return; }
      const payload = {
        title: title.value.trim(), body_md: body.value.trim(), category_id: Number(categoryInput.value),
        upload_token: uploadToken, tags: state.tags.slice()
      };
      if (editId) payload.id = editId;
      try {
        state.submitting = true;
        updateSubmitState();
        F.setBusy(submit, true, editId ? '保存中…' : '发布中…');
        const data = await F.api(editId ? 'update_post' : 'create_post', { method: 'POST', body: payload });
        clearTimeout(state.draftTimer);
        state.draftTimer = 0;
        localStorage.removeItem(state.draftKey);
        window.location.href = `./forum-post.html?id=${data.id || editId}`;
      } catch (error) {
        F.toast(error.message, 'error');
        state.submitting = false;
        F.setBusy(submit, false);
        updateSubmitState();
      }
    });

    updateCounts();
    state.initialized = true;
    updateSubmitState();
  }

  const page = document.body.dataset.forumPage;
  if (page === 'plaza') initPlaza();
  else if (page === 'post') initPost();
  else if (page === 'create') initCreate();
})();
