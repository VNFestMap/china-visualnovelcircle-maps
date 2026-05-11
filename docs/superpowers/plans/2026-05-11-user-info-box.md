# 顶层用户信息框 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-centered user info card with consolidated navigation, replace mobile top banner, and add a left-side drawer for intro content.

**Architecture:** New `#userInfoCard` element sits at top-center above the map with user info + 5 nav buttons. Mobile transforms it to a fixed collapsible banner with fold/expand. The existing `#introCard` stays for desktop; on mobile it's hidden and its content is accessible via a new left drawer opened by a hamburger button.

**Tech Stack:** Vanilla JS (IIFE patterns in app.js), CSS custom properties, responsive design at 720px breakpoint.

---

### Task 1: HTML — Add user info card, hamburger, drawer; remove side buttons

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove the 5 side toggle buttons**

Delete lines 168-173 from index.html (the `chinaToggleBtn`, `japanToggleBtn`, `overseasToggleBtn`, `calendarToggleBtn`, `publicationToggleBtn` buttons). Also remove the blank line at 167 and the comment at 168.

- [ ] **Step 2: Add the user info card after mapSvg**

Insert after `<svg id="mapSvg"></svg>` (line 47):

```html

    <!-- 顶层用户信息框 -->
    <div id="userInfoCard" class="user-info-card">
      <div class="user-info-row">
        <div class="user-avatar" id="topUserAvatar">?</div>
        <div class="user-name" id="topUserName">访客</div>
        <span class="user-role-badge" id="topUserRoleBadge" style="display:none;"></span>
        <button id="topLoginBtn" class="top-login-btn">登录 / 注册</button>
        <button id="topAccountBtn" class="top-account-btn" style="display:none;">账号</button>
        <a id="topAdminBtn" class="top-admin-btn" href="admin/club_manager.html" style="display:none;">同好会管理</a>
        <button class="mobile-expand-arrow" id="mobileExpandArrow">▼</button>
      </div>
      <div class="user-nav-row" id="userNavRow">
        <button class="user-nav-btn" data-action="china">中国同好会</button>
        <button class="user-nav-btn" data-action="japan">日本同好会</button>
        <button class="user-nav-btn" data-action="overseas">海外同好会</button>
        <button class="user-nav-btn" data-action="calendar">活动日历</button>
        <button class="user-nav-btn" data-action="publication">刊物投稿</button>
      </div>
    </div>
```

- [ ] **Step 3: Add hamburger button**

Insert after the user info card:

```html
    <!-- 移动端汉堡菜单按钮 -->
    <button id="hamburgerBtn" class="hamburger-btn" aria-label="菜单">☰</button>
```

- [ ] **Step 4: Add mobile left drawer**

Insert after the hamburger button, before `<!-- 简介卡片 -->`:

```html
    <!-- 移动端左侧抽屉 -->
    <div id="mobileDrawer" class="mobile-drawer" aria-hidden="true">
      <div class="mobile-drawer-backdrop" id="mobileDrawerBackdrop"></div>
      <div class="mobile-drawer-content">
        <button class="mobile-drawer-close" id="mobileDrawerClose">✕</button>
        <h2 class="card-title">全国Galgame同好会地图</h2>
        <img class="drawer-logo" src="./images/VNF.png" alt="VNFest 视觉小说高校学园祭" width="640" height="196" />
        <p class="card-body">本网站用于聚合展示全国各省、高校及海外地区的 Galgame / 视觉小说同好组织信息，支持地图缩放、拖拽、分省查看、切换分类与一键复制联系方式，帮助同好快速找到组织。</p>
        <p class="card-body">数据来自各高校同好会及公开信息，欢迎提交新的同好会资料。</p>
        <label class="md3-switch" for="invertCtrlSwitch">
          <input id="invertCtrlSwitchDrawer" type="checkbox" />
          <span class="md3-switch-track"><span class="md3-switch-thumb"></span></span>
          <span class="md3-switch-label">反转操作（默认关）</span>
        </label>
        <label class="md3-switch" for="themeSwitch">
          <input id="themeSwitchDrawer" type="checkbox" />
          <span class="md3-switch-track"><span class="md3-switch-thumb"></span></span>
          <span class="md3-switch-label">暗黑模式（跟随系统）</span>
        </label>
        <div class="intro-links">
          <div class="submit-buttons">
            <a class="submit-btn" href="https://github.com/kokubunshu/china-visualnovelcircle-maps" target="_blank" rel="noopener noreferrer">开源仓库</a>
            <button class="submit-btn primary" id="submitClubBtnDrawer" type="button">提交同好会信息</button>
            <button class="submit-btn" id="submitEventBtnDrawer" type="button">添加活动信息</button>
            <button class="submit-btn" id="submitPublicationBtnDrawer" type="button">投稿刊物征集</button>
            <div class="lang-switch-group">
              <button class="lang-btn" id="langZhBtnDrawer"><span class="lang-text">中文</span></button>
              <button class="lang-btn" id="langJaBtnDrawer"><span class="lang-text">日本語</span></button>
            </div>
          </div>
          <p class="card-body gpl-text" style="margin-top: 8px; font-size: 11px; text-align: center;">
            基于 <a href="https://github.com/HELPMEEADICE/china-bandori-maps" target="_blank">china-bandori-maps</a> 二次开发，遵循 <a href="./LICENSE" target="_blank">GPLv3</a>
          </p>
        </div>
      </div>
    </div>
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add user info card, hamburger button, and mobile drawer HTML"
```

---

### Task 2: CSS — Add user info card, hamburger, drawer styles; remove side toggle styles

**Files:**
- Modify: `css/styles.css`

- [ ] **Step 1: Remove side-toggle-btn styles**

Delete the `.side-toggle-btn` block (lines 539-546), the individual button positioning (lines 549-567), and the `.side-toggle-btn.active` style (line 832-835). Also delete the `.side-toggle-btn.mobile-inside` block (lines 837-844) and the mobile `display: none !important` for `.side-toggle-btn` (lines 2030-2032).

- [ ] **Step 2: Add user info card styles**

Insert after the `#introCard.collapsed` styles (after ~line 406):

```css
/* ===== 顶层用户信息框 ===== */
.user-info-card {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  width: auto;
  min-width: 390px;
  max-width: min(520px, calc(100vw - 32px));
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--md-outline-variant);
  border-radius: 20px;
  padding: 10px 16px;
  box-shadow: 0 4px 24px var(--md-shadow), 0 8px 32px rgba(0,0,0,0.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

[data-theme='dark'] .user-info-card {
  background: rgba(30, 30, 30, 0.82);
}

/* 用户行 */
.user-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.user-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--md-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
}

/* 登录按钮 */
.top-login-btn {
  padding: 4px 14px;
  background: var(--md-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

/* 账号按钮 */
.top-account-btn {
  padding: 4px 14px;
  background: transparent;
  color: var(--md-on-surface);
  border: 1px solid var(--md-outline);
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

/* 同好会管理按钮 */
.top-admin-btn {
  padding: 4px 14px;
  background: linear-gradient(135deg, var(--md-primary), #c2185b);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}

/* 导航按钮行 */
.user-nav-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--md-outline-variant);
}

.user-nav-btn {
  flex: 1;
  padding: 4px 0;
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  border: 1px solid var(--md-outline-variant);
  border-radius: 8px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
  transition: background 0.2s, color 0.2s;
}

.user-nav-btn:hover {
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
}

.user-nav-btn:active {
  transform: scale(0.96);
}

/* 移动端展开箭头 */
.mobile-expand-arrow {
  display: none;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--md-on-surface-variant);
  font-size: 11px;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34, 1.25, 0.64, 1);
  flex-shrink: 0;
}

.mobile-expand-arrow.expanded {
  transform: rotate(180deg);
}
```

- [ ] **Step 3: Add hamburger button styles**

Insert after the user info card styles:

```css
/* ===== 移动端汉堡按钮 ===== */
.hamburger-btn {
  display: none;
  position: fixed;
  top: calc(env(safe-area-inset-top) * 0.25 + 48px);
  left: 12px;
  z-index: 29;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--md-surface-container);
  border: 1px solid var(--md-outline-variant);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-size: 16px;
  color: var(--md-on-surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 4: Add mobile drawer styles**

Insert after the hamburger styles:

```css
/* ===== 移动端左侧抽屉 ===== */
.mobile-drawer {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 40;
}

.mobile-drawer.open {
  display: block;
}

.mobile-drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  animation: drawerFadeIn 0.25s ease;
}

@keyframes drawerFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.mobile-drawer-content {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(320px, 85vw);
  background: var(--md-surface-container);
  padding: 20px 18px;
  overflow-y: auto;
  box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  animation: drawerSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes drawerSlideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.mobile-drawer-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--md-surface-container-high);
  border: none;
  font-size: 14px;
  color: var(--md-on-surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-drawer-content .card-title {
  font-size: 18px;
  margin: 0 0 12px !important;
  padding-right: 32px;
  color: var(--md-on-surface);
}

.mobile-drawer-content .drawer-logo {
  width: 100%;
  height: auto;
  border-radius: 12px;
  margin-bottom: 12px;
}

.mobile-drawer-content .card-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--md-on-surface-variant);
  margin: 0 0 12px !important;
}
```

- [ ] **Step 5: Add mobile responsive styles at the 720px breakpoint**

Inside the `@media (max-width: 720px)` block (at the beginning, after line ~2027):

```css
  /* ===== 移动端用户信息框 ===== */
  .user-info-card {
    position: fixed !important;
    top: calc(env(safe-area-inset-top) * 0.25 + 4px) !important;
    left: 12px !important;
    right: 12px !important;
    transform: none !important;
    min-width: 0 !important;
    width: auto !important;
    max-width: none !important;
    padding: 8px 14px !important;
    border-radius: 16px !important;
    z-index: 30;
    cursor: pointer;
    overflow: hidden;
    transition: max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                padding 0.3s ease,
                box-shadow 0.3s ease !important;
    will-change: max-height;
  }

  .user-info-card .user-nav-row {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    margin-top: 0;
    padding-top: 0;
    border-top: none;
    pointer-events: none;
    transition: max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                opacity 0.25s ease,
                margin-top 0.3s ease,
                padding-top 0.3s ease;
  }

  .user-info-card.mobile-expanded .user-nav-row {
    max-height: 120px;
    opacity: 1;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--md-outline-variant);
    pointer-events: auto;
  }

  .user-info-card .user-role-badge {
    display: none !important;
  }

  .mobile-expand-arrow {
    display: flex !important;
  }

  /* 汉堡按钮 */
  .hamburger-btn {
    display: flex !important;
  }

  /* 左侧抽屉 */
  .mobile-drawer {
    display: none;
  }
  .mobile-drawer.open {
    display: block;
  }

  /* 桌面端 introCard 在移动端隐藏 */
  #introCard {
    display: none !important;
  }
```

- [ ] **Step 6: Commit**

```bash
git add css/styles.css
git commit -m "feat: add user info card, drawer, hamburger styles; remove side toggle styles"
```

---

### Task 3: JavaScript — Add top card logic, remove side button bindings

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Remove side toggle active management from switch functions**

In `switchToChinaMap()` (~line 3422), remove the 3 lines that manage toggle button active classes:
```js
// Remove these 3 lines:
document.getElementById('chinaToggleBtn')?.classList.add('active');
document.getElementById('japanToggleBtn')?.classList.remove('active');
document.getElementById('overseasToggleBtn')?.classList.remove('active');
```

In `switchToJapanMap()` (~line 3453), remove:
```js
// Remove these 3 lines:
document.getElementById('japanToggleBtn')?.classList.add('active');
document.getElementById('chinaToggleBtn')?.classList.remove('active');
document.getElementById('overseasToggleBtn')?.classList.remove('active');
```

In `switchToOverseas()` (~line 3489), remove:
```js
// Remove these 3 lines:
document.getElementById('overseasToggleBtn')?.classList.add('active');
document.getElementById('chinaToggleBtn')?.classList.remove('active');
document.getElementById('japanToggleBtn')?.classList.remove('active');
```

In `init()` (~line 4833), remove:
```js
// Remove these 3 lines:
const chinaBtn = document.getElementById('chinaToggleBtn');
const japanBtn = document.getElementById('japanToggleBtn');
if (chinaBtn) chinaBtn.classList.add('active');
if (japanBtn) japanBtn.classList.remove('active');
```

- [ ] **Step 2: Remove side toggle event bindings and references in bindAllStaticEvents**

In `bindAllStaticEvents()` (starting ~line 3584), remove:
```js
document.getElementById('overseasToggleBtn')?.addEventListener('click', switchToOverseas);
```
And the `calendarToggleBtn` click handler block:
```js
document.getElementById('calendarToggleBtn')?.addEventListener('click', () => {
    document.getElementById('calendarModal')?.classList.add('open');
    document.getElementById('calendarModal')?.setAttribute('aria-hidden', 'false');
});
```
And:
```js
document.getElementById('chinaToggleBtn')?.addEventListener('click', switchToChinaMap);
document.getElementById('japanToggleBtn')?.addEventListener('click', switchToJapanMap);
```

Also remove the `nonRegionalToggleBtn` click handler:
```js
document.getElementById('nonRegionalToggleBtn')?.addEventListener('click', () => {
    ...
});
```

- [ ] **Step 3: Remove overseasToggleBtn reference in bindAllStaticEvents' overseas section**

In `bindAllStaticEvents()`, also remove the `document.getElementById('overseasToggleBtn')?.addEventListener('click', switchToOverseas);` (confirm it's exactly the one around line 3646).

- [ ] **Step 4: Add topUserBar initialization object**

Add a helper to get top card elements (add near the top of the file, after the `currentUser` declaration ~line 40):

```js
// 顶层用户信息框元素引用
function getTopEls() {
  return {
    avatar: document.getElementById('topUserAvatar'),
    name: document.getElementById('topUserName'),
    badge: document.getElementById('topUserRoleBadge'),
    loginBtn: document.getElementById('topLoginBtn'),
    accountBtn: document.getElementById('topAccountBtn'),
    adminBtn: document.getElementById('topAdminBtn'),
    navRow: document.getElementById('userNavRow'),
    card: document.getElementById('userInfoCard'),
    expandArrow: document.getElementById('mobileExpandArrow')
  };
}
```

- [ ] **Step 5: Update updateUserUI() to also update top card**

Append to the `updateUserUI()` function (after the existing `profile.style.display` logic, around line 120):

```js
    // 更新顶层用户信息框
    const top = getTopEls();
    if (!top.name) return;
    if (currentUser?.logged_in && currentUser?.user) {
        top.loginBtn.style.display = 'none';
        top.accountBtn.style.display = '';
        // Update avatar
        if (top.avatar) {
            if (currentUser.user.avatar_url) {
                top.avatar.innerHTML = '<img src="' + currentUser.user.avatar_url + '" alt="" />';
            } else {
                top.avatar.textContent = (currentUser.user.nickname || currentUser.user.username || 'U')[0].toUpperCase();
                top.avatar.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
                top.avatar.style.color = '#fff';
            }
        }
        if (top.name) top.name.textContent = currentUser.user.nickname || currentUser.user.username || '用户';
        // Role badge
        if (top.badge) {
            const roleNames = { visitor: '访客', member: '成员', manager: '管理员', representative: '会长', super_admin: '超级管理员' };
            const roleColors = {
                visitor: { bg: 'rgba(128,128,128,0.12)', color: '#888' },
                member: { bg: 'rgba(76,175,80,0.12)', color: '#4caf50' },
                manager: { bg: 'rgba(33,150,243,0.12)', color: '#2196f3' },
                representative: { bg: 'rgba(255,152,0,0.12)', color: '#ff9800' },
                super_admin: { bg: 'rgba(233,30,99,0.12)', color: '#e91e63' }
            };
            const role = getEffectiveRole();
            const text = roleNames[role] || '';
            const s = roleColors[role] || roleColors.visitor;
            top.badge.textContent = text;
            top.badge.style.display = '';
            top.badge.style.background = s.bg;
            top.badge.style.color = s.color;
        }
        // Admin button
        if (top.adminBtn) {
            top.adminBtn.style.display = hasRole('manager') ? '' : 'none';
        }
    } else {
        top.loginBtn.style.display = '';
        top.accountBtn.style.display = 'none';
        if (top.adminBtn) top.adminBtn.style.display = 'none';
        if (top.avatar) {
            top.avatar.textContent = '?';
            top.avatar.style.background = '#e0e0e0';
            top.avatar.style.color = '#999';
            top.avatar.innerHTML = ''; // clear any img
        }
        if (top.name) top.name.textContent = '访客';
        if (top.badge) top.badge.style.display = 'none';
    }
```

- [ ] **Step 6: Add top card interaction initialization**

Create a new function and wire it up. Add after `initPublicationEvents()` (~line 4613):

```js
// ===== 顶层用户信息框交互 =====
function initTopUserBar() {
  // 导航按钮点击
  document.querySelectorAll('.user-nav-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const action = this.dataset.action;
      switch (action) {
        case 'china': switchToChinaMap(); break;
        case 'japan': switchToJapanMap(); break;
        case 'overseas': switchToOverseas(); break;
        case 'calendar':
          document.getElementById('calendarModal')?.classList.add('open');
          document.getElementById('calendarModal')?.setAttribute('aria-hidden', 'false');
          break;
        case 'publication':
          document.getElementById('publicationToggleBtn')?.click();
          break;
      }
    });
  });

  // 登录按钮
  document.getElementById('topLoginBtn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    openAccountModal('login');
  });

  // 账号按钮
  document.getElementById('topAccountBtn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    openAccountModal('settings');
    refreshProfile();
  });

  // 移动端：点击卡片切换折叠/展开
  const card = document.getElementById('userInfoCard');
  if (card) {
    card.addEventListener('click', function(e) {
      if (window.innerWidth > 720) return;
      // Don't toggle when clicking buttons/links
      if (e.target.closest('button') || e.target.closest('a')) return;
      this.classList.toggle('mobile-expanded');
      const arrow = document.getElementById('mobileExpandArrow');
      if (arrow) arrow.classList.toggle('expanded');
    });
  }

  // 移动端折叠状态跟随窗口resize重置
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (window.innerWidth > 720 && card) {
        card.classList.remove('mobile-expanded');
      }
    }, 200);
  });
}

// ===== 移动端左侧抽屉 =====
function initMobileDrawer() {
  // 汉堡按钮
  document.getElementById('hamburgerBtn')?.addEventListener('click', function() {
    document.getElementById('mobileDrawer')?.classList.add('open');
    document.getElementById('mobileDrawer')?.setAttribute('aria-hidden', 'false');
  });

  // 遮罩关闭
  document.getElementById('mobileDrawerBackdrop')?.addEventListener('click', function() {
    document.getElementById('mobileDrawer')?.classList.remove('open');
    document.getElementById('mobileDrawer')?.setAttribute('aria-hidden', 'true');
  });

  // 关闭按钮
  document.getElementById('mobileDrawerClose')?.addEventListener('click', function() {
    document.getElementById('mobileDrawer')?.classList.remove('open');
    document.getElementById('mobileDrawer')?.setAttribute('aria-hidden', 'true');
  });

  // 抽屉内提交按钮事件代理
  document.getElementById('submitClubBtnDrawer')?.addEventListener('click', function() {
    window.location.href = 'submit.html';
  });
  document.getElementById('submitEventBtnDrawer')?.addEventListener('click', function() {
    window.location.href = 'submit_event.html';
  });
  document.getElementById('submitPublicationBtnDrawer')?.addEventListener('click', function() {
    window.location.href = 'submit_publication.html';
  });

  // 抽屉内语言切换
  document.getElementById('langZhBtnDrawer')?.addEventListener('click', function() {
    currentLang = 'zh';
    localStorage.setItem('language', 'zh');
    updateUILanguage();
    renderCurrentDetail();
    document.getElementById('mobileDrawer')?.classList.remove('open');
  });
  document.getElementById('langJaBtnDrawer')?.addEventListener('click', function() {
    currentLang = 'ja';
    localStorage.setItem('language', 'ja');
    updateUILanguage();
    renderCurrentDetail();
    document.getElementById('mobileDrawer')?.classList.remove('open');
  });

  // 抽屉内开关同步到主开关
  document.getElementById('invertCtrlSwitchDrawer')?.addEventListener('change', function() {
    const main = document.getElementById('invertCtrlSwitch');
    if (main) main.checked = this.checked;
    main?.dispatchEvent(new Event('change'));
  });
  document.getElementById('themeSwitchDrawer')?.addEventListener('change', function() {
    const main = document.getElementById('themeSwitch');
    if (main) main.checked = this.checked;
    main?.dispatchEvent(new Event('change'));
  });
}
```

- [ ] **Step 7: Wire initTopUserBar and initMobileDrawer into init()**

Add these calls to the `init()` function (after `initPublicationEvents()` around line 4850):

```js
    initTopUserBar();
    initMobileDrawer();
```

- [ ] **Step 8: Update FAB admin button visibility**

In `initFAB()` (line 3802), the `fabAdminBtn` is still needed for mobile. But on desktop, the admin button now appears in the top card. Keep `initFAB()` as-is since `fabAdminBtn` still exists in the HTML for backward compatibility.

- [ ] **Step 9: Commit**

```bash
git add js/app.js
git commit -m "feat: add top user bar and mobile drawer logic; remove side button bindings"
```

---

### Verification

1. **Open in browser** — load the page and check:
   - Desktop: top-centered card shows with "访客" + login button + 5 nav buttons
   - Desktop: left introCard and right selectedCard still visible and functional
   - Desktop: no side toggle buttons on the right side
   - Desktop: click each nav button — China, Japan, Overseas switch maps; Calendar/Publications modals open
   - Desktop: login flow — top card should show avatar, name, role badge, account button; admin sees management button

2. **Mobile (resize to <720px)**:
   - Top card becomes fixed banner, collapsed (only user row + arrow visible)
   - Hamburger button visible on top-left
   - Click top card — expands to show nav buttons grid
   - Click hamburger — drawer slides in from left with intro content
   - Drawer close button and backdrop dismiss work
   - Drawer switches and buttons functional

3. **Admin role**:
   - Log in as manager/super_admin — "同好会管理" button appears in top card
   - Non-admin — button hidden

4. **Verify no console errors** — check that all button click handlers are bound correctly and no "undefined" errors occur.
