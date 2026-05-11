# 账号档案面板重新设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将账号档案面板从旧版（进度条+bio）重设计为粉色→红白 Galgame 风格成员卡，含同好会专属展示框和可编辑个性签名

**Architecture:** PHP 后端 + SQLite/MySQL 双数据库支持；前端 JS 渲染 + CSS 样式；核心改动在 `api/auth.php`（后端）、`index.html`（结构）、`css/styles.css`（样式）、`js/app.js`（逻辑）

**Tech Stack:** PHP 8, SQLite/MySQL, Vanilla JS, CSS3

---

### Task 1: 后端 — profile_bio 字段 + API

**Files:**
- Modify: `includes/auth.php:31` — SQL 查询加 profile_bio
- Modify: `api/auth.php` — `case 'me':` 返回 profile_bio，`case 'update_profile':` 支持 bio 更新
- Modify: `scripts/migrate.php` — 两个数据库的 `$tryAlter` 加 profile_bio 列

- [ ] **Step 1: migrate.php — MySQL 加 profile_bio 列**

在 `scripts/migrate.php` 的 MySQL 迁移段（`$tryAlter` 区域，约第 41-46 行）追加：

```php
$tryAlter("ALTER TABLE users ADD COLUMN profile_bio VARCHAR(300) DEFAULT ''");
```

- [ ] **Step 2: migrate.php — SQLite 加 profile_bio 列**

在 `scripts/migrate.php` 的 SQLite 迁移段（`$tryAlter` 区域，约第 178-185 行）追加：

```php
$tryAlter("ALTER TABLE users ADD COLUMN profile_bio TEXT DEFAULT ''");
```

- [ ] **Step 3: includes/auth.php — getCurrentUser 加 profile_bio**

修改 `includes/auth.php:31` 的 SQL 查询，在 `discord_id` 后面加 `, profile_bio`：

```php
'SELECT u.id, u.username, u.nickname, u.avatar_url, u.role, u.status, u.email, u.qq_openid, u.discord_id, u.profile_bio
         FROM users u
         WHERE u.id = ? AND u.status = \'active\''
```

- [ ] **Step 4: api/auth.php — case 'me' 返回 profile_bio**

修改 `api/auth.php:176-185` 的 user 数组，加 `'profile_bio' => $user['profile_bio'] ?? ''`：

```php
'user' => [
    'id' => (int)$user['id'],
    'username' => $user['username'],
    'nickname' => $user['nickname'] ?? $user['username'],
    'avatar_url' => $user['avatar_url'],
    'role' => $user['role'],
    'email' => $user['email'] ?? '',
    'qq_openid' => $user['qq_openid'] ?? '',
    'discord_id' => $user['discord_id'] ?? '',
    'profile_bio' => $user['profile_bio'] ?? '',
],
```

- [ ] **Step 5: api/auth.php — update_profile 加 bio 支持**

修改 `api/auth.php:359-379` 的 `case 'update_profile':`，让它可以同时更新 nickname 和 profile_bio：

```php
case 'update_profile':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'message' => '仅支持 POST 请求']);
        exit();
    }
    $user = requireLogin();
    $input = json_decode(file_get_contents('php://input'), true);

    $nickname = isset($input['nickname']) ? trim($input['nickname']) : null;
    $bio = isset($input['profile_bio']) ? trim($input['profile_bio']) : null;

    if ($nickname !== null) {
        if (mb_strlen($nickname) < 1 || mb_strlen($nickname) > 30) {
            echo json_encode(['success' => false, 'message' => '昵称需为 1-30 个字符']);
            exit();
        }
        $db = getDB();
        $db->prepare("UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$nickname, $user['id']]);
    }

    if ($bio !== null) {
        if (mb_strlen($bio) > 300) {
            echo json_encode(['success' => false, 'message' => '个性签名不能超过 300 个字符']);
            exit();
        }
        $db = getDB();
        $db->prepare("UPDATE users SET profile_bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$bio, $user['id']]);
    }

    logAction('user.update_profile', 'user', $user['id'], ['nickname' => $nickname, 'bio' => $bio]);
    echo json_encode(['success' => true, 'message' => '已更新']);
    exit();
```

---

### Task 2: HTML — 重构档案 tab + 签名编辑

**Files:**
- Modify: `index.html` — `#vnProfileTab` 内容替换，`#vnSettingsTab` 追加签名编辑区

- [ ] **Step 1: 替换 #vnProfileTab 内容**

将 `index.html:594-638` 的整个 `#vnProfileTab` 内容替换为：

```html
<!-- Tab 1: 社团成员档案 -->
<div id="vnProfileTab" class="vn-tab-content active">
    <div class="vn-character-card">
        <div class="vn-card-ornament"></div>
        <!-- 头部 -->
        <div class="vn-card-header">
            <div class="vn-portrait-frame">
                <img id="vnAvatar" src="" alt="" class="vn-portrait-img" />
                <span class="vn-avatar-fallback"></span>
            </div>
            <div class="vn-character-info">
                <div class="vn-character-name" id="vnCharName"></div>
                <div class="vn-character-title" id="vnCharTitle"></div>
                <div class="vn-signature" id="vnSignature">"这个人很懒，还没有填写签名"</div>
            </div>
        </div>
        <!-- 同好会区域 -->
        <div class="vn-club-section">
            <div class="vn-club-section-header">所属同好会</div>
            <div id="vnClubList" class="vn-club-list"></div>
        </div>
        <!-- 统计数据 -->
        <div class="vn-stats-grid">
            <div class="vn-stat-item"><span class="vn-stat-num" id="statClubs">0</span><span class="vn-stat-label">同好会</span></div>
            <div class="vn-stat-item"><span class="vn-stat-num" id="statPubs">0</span><span class="vn-stat-label">刊物</span></div>
            <div class="vn-stat-item"><span class="vn-stat-num" id="statEvents">0</span><span class="vn-stat-label">活动</span></div>
            <div class="vn-stat-item"><span class="vn-stat-num" id="statDays">0</span><span class="vn-stat-label">天</span></div>
        </div>
        <!-- 底部 -->
        <div class="vn-card-footer">
            <span id="vnMemberSince"></span>
            <span id="vnLastActive"></span>
        </div>
    </div>
</div>
```

- [ ] **Step 2: #vnSettingsTab 追加个性签名编辑行**

在 `index.html` 昵称编辑行（约第 665-669 行）之后、用户名显示行之前，追加签名编辑：

```html
<div class="settings-row">
    <span class="settings-label">签名</span>
    <input type="text" id="accBioInput" class="nickname-input" placeholder="设置个性签名" maxlength="300" />
    <button id="accBioSaveBtn" class="btn-small btn-primary">保存</button>
</div>
```

---

### Task 3: CSS — 新档案面板样式

**Files:**
- Modify: `css/styles.css` — 追加新样式，保留现有 `.vn-character-card`/`.vn-portrait-frame` 等基类

- [ ] **Step 1: 追加新样式**

在 `css/styles.css` 文件末尾（`@media` 之前）追加：

```css
/* ====== VN 档案卡 2026-05 重设计 ====== */

/* 同好会专属区域 */
.vn-club-section {
    margin: 0 16px 16px;
    border-radius: 12px;
    border: 1px solid var(--md-outline-variant);
    overflow: hidden;
}

.vn-club-section-header {
    background: var(--md-surface-container);
    padding: 8px 14px;
    font-size: 11px;
    font-weight: 600;
    color: var(--md-on-surface-variant);
    letter-spacing: 2px;
    border-bottom: 1px solid var(--md-outline-variant);
}

.vn-club-list {
    padding: 4px 0;
}

.vn-club-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--md-outline-variant);
}

.vn-club-item:last-child {
    border-bottom: none;
}

.vn-club-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid var(--md-outline-variant);
    flex-shrink: 0;
    object-fit: cover;
    background: var(--md-surface-container-high);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--md-on-surface-variant);
}

.vn-club-info {
    flex: 1;
    min-width: 0;
}

.vn-club-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--md-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.vn-club-date {
    font-size: 11px;
    color: var(--md-on-surface-variant);
    margin-top: 1px;
}

.vn-club-role {
    font-size: 10px;
    padding: 3px 10px;
    border-radius: 6px;
    font-weight: 600;
    flex-shrink: 0;
    border: 1px solid transparent;
}

/* 个性签名 */
.vn-signature {
    font-size: 12px;
    color: var(--md-on-surface-variant);
    margin-top: 8px;
    border-left: 2px solid var(--md-outline);
    padding-left: 10px;
    line-height: 1.5;
    cursor: pointer;
    transition: color 0.2s;
}

.vn-signature:hover {
    color: var(--md-primary);
}

/* 卡片底部 */
.vn-card-footer {
    padding: 10px 20px;
    background: var(--md-surface-container);
    font-size: 12px;
    color: var(--md-on-surface-variant);
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--md-outline-variant);
}

/* 统计适配新布局 */
.vn-stats-grid {
    padding: 0 16px 16px;
    gap: 8px;
}

.vn-stat-item {
    border-radius: 10px;
    padding: 10px 4px;
}

/* 会员角色颜色类 */
.vn-role-member { background: rgba(76,175,80,0.12); color: #4caf50; border-color: rgba(76,175,80,0.2); }
.vn-role-manager { background: rgba(33,150,243,0.12); color: #2196f3; border-color: rgba(33,150,243,0.2); }
.vn-role-representative { background: rgba(255,152,0,0.12); color: #ff9800; border-color: rgba(255,152,0,0.2); }
.vn-role-visitor { background: rgba(136,136,136,0.12); color: #888; border-color: rgba(136,136,136,0.2); }
.vn-role-super_admin { background: rgba(233,30,99,0.12); color: #e91e63; border-color: rgba(233,30,99,0.2); }
```

- [ ] **Step 2: 响应式适配**

在现有的移动端 media query（`@media (max-width: ...)`，约第 4850+ 行）内的 `.vn-character-info` 和 `.vn-portrait-frame` 适配段后面追加：

```css
.vn-club-item { padding: 8px 10px; gap: 8px; }
.vn-club-avatar { width: 30px; height: 30px; font-size: 11px; }
.vn-club-name { font-size: 12px; }
.vn-signature { font-size: 11px; }
```

---

### Task 4: JS — 重写 renderVNProfile + 签名编辑

**Files:**
- Modify: `js/app.js` — `renderVNProfile()` 重写，新增签名编辑函数，设置页绑定

- [ ] **Step 1: 重写 renderVNProfile()**

将 `js/app.js:392-469` 的 `renderVNProfile()` 替换为：

```js
function renderVNProfile() {
    if (!currentUser?.logged_in || !currentUser?.user) return;
    var user = currentUser.user;
    var memberships = currentUser.memberships || [];
    var activeMemberships = memberships.filter(function(m) { return m.status === 'active'; });

    // 角色名
    var nameEl = document.getElementById('vnCharName');
    if (nameEl) nameEl.textContent = user.nickname || user.username || '';

    // 称号
    var titleEl = document.getElementById('vnCharTitle');
    var roleNames = { visitor: '见习同好', member: '同好会成员', manager: '同好会管理员', representative: '同好会会长', super_admin: '超级管理员' };
    var effectiveRole = getEffectiveRole();
    if (titleEl) titleEl.textContent = '—— ' + (roleNames[effectiveRole] || '同好') + ' ——';

    // 头像
    var avatarEl = document.getElementById('vnAvatar');
    if (avatarEl) {
        var frame = avatarEl.parentElement;
        var fallback = frame.querySelector('.vn-avatar-fallback');
        if (!fallback) {
            fallback = document.createElement('span');
            fallback.className = 'vn-avatar-fallback';
            frame.appendChild(fallback);
        }
        if (user.avatar_url) {
            avatarEl.src = user.avatar_url;
            avatarEl.style.display = '';
            fallback.textContent = '';
            frame.style.background = '';
        } else {
            avatarEl.style.display = 'none';
            fallback.textContent = (user.nickname || user.username || 'U')[0].toUpperCase();
            frame.style.background = '#e74c3c';
            frame.style.color = '#fff';
            frame.style.display = 'flex';
            frame.style.alignItems = 'center';
            frame.style.justifyContent = 'center';
            frame.style.fontSize = '28px';
            frame.style.fontWeight = '700';
        }
    }

    // 个性签名
    var sigEl = document.getElementById('vnSignature');
    if (sigEl) {
        sigEl.textContent = user.profile_bio
            ? '“' + user.profile_bio + '”'
            : '“这个人很懒，还没有填写签名”';
    }

    // === 同好会 ===
    var clubList = document.getElementById('vnClubList');
    var statClubs = document.getElementById('statClubs');
    var clubCount = 0;
    if (clubList) {
        if (activeMemberships.length === 0) {
            clubList.innerHTML = '<div style="padding:14px;text-align:center;font-size:12px;color:var(--md-on-surface-variant);">还没有加入同好会</div>';
        } else {
            var allClubs = [];
            if (typeof State !== 'undefined') {
                allClubs = (State.bandoriRows || []).concat(State.japanRows || []);
            }
            clubCount = activeMemberships.length;
            var roleClassMap = { member: 'vn-role-member', manager: 'vn-role-manager', representative: 'vn-role-representative', visitor: 'vn-role-visitor', super_admin: 'vn-role-super_admin' };
            var roleLabels = { member: '成员', manager: '管理员', representative: '会长', visitor: '访客', super_admin: '超级管理员' };
            clubList.innerHTML = activeMemberships.map(function(m) {
                var club = allClubs.find(function(c) { return parseInt(c.id) === parseInt(m.club_id) && (c.country || 'china') === (m.country || 'china'); });
                var clubName = club ? (club.display_name || club.name) : ('同好会 #' + m.club_id);
                var avatarHtml = club && club.logo_url
                    ? '<img src="' + escapeHtml(club.logo_url) + '" alt="" class="vn-club-avatar" loading="lazy">'
                    : '<span class="vn-club-avatar">' + (clubName[0] || '?') + '</span>';
                var roleClass = roleClassMap[m.role] || 'vn-role-member';
                var roleLabel = roleLabels[m.role] || m.role;
                var joinDate = m.created_at ? m.created_at.split(' ')[0] : '';
                return '<div class="vn-club-item">' +
                    avatarHtml +
                    '<div class="vn-club-info"><div class="vn-club-name">' + escapeHtml(clubName) + '</div>' +
                    (joinDate ? '<div class="vn-club-date">' + joinDate + ' 加入</div>' : '') +
                    '</div>' +
                    '<span class="vn-club-role ' + roleClass + '">' + roleLabel + '</span>' +
                    '</div>';
            }).join('');
        }
    }
    if (statClubs) statClubs.textContent = String(clubCount);

    // 统计数据
    var statPubs = document.getElementById('statPubs');
    if (statPubs) statPubs.textContent = '0';
    var statEvents = document.getElementById('statEvents');
    if (statEvents) {
        var userId = user.id;
        fetch('./api/events.php?action=registrations').then(function(r) { return r.json(); }).then(function(d) {
            var count = (d.registrations || []).filter(function(r) { return r.user_id === userId; }).length;
            if (statEvents) statEvents.textContent = String(count);
        }).catch(function() {});
    }
    var statDays = document.getElementById('statDays');
    if (statDays) statDays.textContent = '0';

    // 底部
    var memberSince = document.getElementById('vnMemberSince');
    if (memberSince) {
        var since = user.created_at || '';
        memberSince.textContent = since ? since.split(' ')[0] + ' 加入' : '';
    }
    var lastActive = document.getElementById('vnLastActive');
    if (lastActive) {
        lastActive.textContent = user.last_login_at ? user.last_login_at.split(' ')[0] + ' 活跃' : '';
    }
}
```

- [ ] **Step 2: 设置页绑定签名编辑**

在 `js/app.js` 昵称保存按钮的事件监听（约第 950-954 行）后面追加签名保存逻辑：

```js
// ====== 个性签名保存 ======
document.addEventListener('click', function(e) {
    if (e.target.id === 'accBioSaveBtn') {
        var input = document.getElementById('accBioInput');
        if (!input) return;
        var bio = input.value.trim();
        if (bio.length > 300) {
            alert('个性签名不能超过 300 个字符');
            return;
        }
        fetch('./api/auth.php?action=update_profile', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_bio: bio })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.success && currentUser?.user) {
                currentUser.user.profile_bio = bio;
                renderVNProfile();
                var statusEl = document.getElementById('accBioStatus');
                if (statusEl) { statusEl.textContent = '✅ 保存成功'; statusEl.style.color = '#27ae60'; }
                setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 2000);
            } else {
                alert(d.message || '保存失败');
            }
        })
        .catch(function() { alert('网络错误'); });
    }
});

// ====== 点击签名直接编辑 ======
document.addEventListener('click', function(e) {
    if (e.target.id === 'vnSignature' && currentUser?.logged_in) {
        // 切换到设置 tab 并聚焦签名输入框
        var settingsTab = document.querySelector('.vn-tab[data-tab="settings"]');
        if (settingsTab) settingsTab.click();
        var bioInput = document.getElementById('accBioInput');
        if (bioInput) {
            bioInput.value = currentUser.user.profile_bio || '';
            bioInput.focus();
        }
    }
});
```

- [ ] **Step 3: 设置页打开时填充签名**

在 `openAccountModal` 函数中（约第 169-174 行），在 `renderVNProfile()` 调用之前或之后，追加签名输入框填充：

```js
if (view === 'settings') {
    const defaultTab = document.querySelector('.vn-tab[data-tab="profile"]');
    if (defaultTab) switchVnTab(defaultTab);
    renderVNProfile();
    // 填充签名输入框
    var bioInput = document.getElementById('accBioInput');
    if (bioInput && currentUser?.user) {
        bioInput.value = currentUser.user.profile_bio || '';
    }
}
```

- [ ] **Step 4: 删除旧版进度条和 bio 相关引用**

从 `js/app.js` 的 `renderVNProfile()` 中移除（新函数中已移除）：
- 角色 badge 代码保留（`vnCharRole` DOM 元素已移除 → 移除 JS 中对它的引用）
- 进度条相关 DOM 不再需要 → 移除 `progClubs`/`countClubs`/`progPubs`/`countPubs`/`progEvents`/`countEvents` 的 JS 代码
- bio 相关 DOM 不再需要 → 移除 `vnBioText` 的 JS 代码

---

### Task 5: 清理旧 DOM 元素引用

**Files:**
- Modify: `index.html` — 确认所有旧 ID 已移除

- [ ] **Step 1: 确认旧 DOM 已清理**

验证以下旧 ID 不再存在于 `index.html` 中（已在 Task 2 的 HTML 替换中移除）：
- `vnBioText`, `progClubs`, `countClubs`, `progPubs`, `countPubs`, `progEvents`, `countEvents`, `vnCharRole`（从 badge 改为 title 中的角色文本）

---

### Task 6: 运行迁移 + 验证

- [ ] **Step 1: 运行数据库迁移**

```bash
php scripts/migrate.php
```

Expected: profile_bio 列被添加（MySQL: `ALTER TABLE users ADD COLUMN profile_bio VARCHAR(300) DEFAULT ''`，SQLite: 同上 TEXT）

- [ ] **Step 2: PHP 语法检查**

```bash
php -l api/auth.php
php -l includes/auth.php
php -l scripts/migrate.php
```

Expected: `No syntax errors detected`

- [ ] **Step 3: 浏览器验证**

1. 打开页面，登录账号
2. 点击账号 → 档案标签，验证：
   - 头像显示正常（有/无头像两种情况）
   - 名字、称号展示正确
   - 个性签名显示 "这个人很懒，还没有填写签名"
   - 同好会区域：显示已加入的同好会（头像、名称、角色标签颜色）
   - 统计数据正确
3. 切换到设置标签，验证：
   - 签名输入框存在并可以编辑
   - 保存签名后档案标签同步更新
4. 点击档案标签的签名文字 → 跳转到设置标签
5. 响应式：手机视图下布局正常
