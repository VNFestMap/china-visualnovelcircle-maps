# VNFest Forum

## 本轮前端展示约定

- 移动端广场采用内容优先的主题行：保留头像、两行标题、两行摘要、作者昵称、代表同好会短徽标以及回复/点赞数字；最后回复者和活动时间在 720px 以下隐藏，长身份使用省略号但保留完整 `title` 与无障碍名称。
- 帖子详情在所有断点统一使用“作者头在上、正文在下”的单列结构。作者头包含头像、昵称、代表同好会身份和时间统计，正文仍由安全的 Markdown 渲染器提供适合长文阅读的宽度。
- 主帖和回复操作统一使用 Forum 内联 SVG 图标按钮，不依赖第三方图标库。图标按钮至少 44px，必须同时提供 `aria-label`、`title` 和 `aria-hidden` 图标；点赞/收藏状态使用 `aria-pressed`，数字统计继续保留。
- 本轮只改变展示层，不修改 `display_club` 数据契约、帖子/回复接口、权限判断、Markdown、图片上传和数据库结构。发布后请使用 `20260810-forum11` 资源版本，避免浏览器继续读取旧操作栏样式。

VNFest Forum 是主站内自包含的论坛模块。论坛自有代码和运行时上传都位于本目录；账户、通知、审计、限流、数据库与主题运行时继续使用主项目的公共模块。当前产品只开放统一的论坛广场。

## 目录

```text
Forum/
├─ forum-plaza.html
├─ forum-post.html
├─ forum-create.html
├─ assets/css/forum-runtime.css
├─ assets/js/forum-common.js
├─ assets/js/forum-pages.js
├─ api/forum.php
├─ includes/forum.php
├─ includes/forum_schema.php
├─ scripts/test-forum-contract.mjs
├─ scripts/test-forum-browser.mjs
├─ scripts/test-forum-v1.php
└─ uploads/
```

## 本地运行

在 `VNFmap2.0` 目录启动 PHP 本地服务器：

```powershell
php -S 127.0.0.1:8080
```

打开：

```text
http://127.0.0.1:8080/Forum/forum-plaza.html
```

论坛依赖真实登录和通知数据。只打开 HTML 文件不能完成 API 或登录联调。

## 主题

三份页面共用主站的 `../css/theme-tokens.css` 与 `../js/theme-runtime.js`。切换按钮通过现有 `VNFTheme` 写入 `themePreference`，刷新后保持暗色、亮色或系统解析结果。`assets/css/forum-runtime.css` 只把共享 token 映射到 Forum 的 `--forum-*` 语义变量，并分别调整深空面板和暖白纸面，不在 Forum 内复制另一份主题状态。

## 背景与导航

三份页面通过 `../js/page-background.js` 应用用户中心保存的全站壁纸偏好，并继续使用主站公共壁纸库、`api/backgrounds.php` 和 `image/background/`。Forum 不创建独立选择器、状态或本地存储键；公共模块会在 720px 以下或粗指针设备上关闭全屏壁纸，Forum 不复制或绕过该保护。

广场侧栏只保留广场、最新回复、我的发帖和我的收藏，使用 `view=latest|mine|favorites` 保持可刷新、可复制的页内状态。当前项、加载状态、快速连续请求保护和浏览器前进/后退由 `assets/js/forum-pages.js` 统一处理；跨页面链接由 `assets/js/forum-common.js` 提供顶部进度与可访问状态提示。旧的 `scope=club&club=...&country=...` 地址会清理休眠参数、返回广场并给出一次中性提示，不再请求主站同好会目录。

## 当前范围与休眠数据

当前 Forum API 只开放 `scope='plaza'` 内容。历史同好会分类、帖子、回复、附件、收藏、修订、举报和通知仍原样保留在数据库中，但不会出现在列表、搜索、我的内容、详情、回复、互动或管理队列；包括 `super_admin` 在内的用户都不能通过 Forum API 打开休眠内容。`manager` 与 `representative` 不再获得 Forum 管理权，广场管理只属于 `super_admin`。

本轮不删除 `forum_posts.scope/club_id/country` 等兼容字段，不迁移历史内容，也不修改表结构。未来若恢复分区能力，必须重新完成权限、国家隔离、搜索摘要、附件、通知和管理链路验收，不能仅重新显示旧入口。

## 本轮阅读与创作体验

### 真实头像

帖子、主帖作者和回复楼层直接使用账户接口已有的 `avatar_url`，不增加重复头像字段。Forum 为头像使用独立的安全路径解析：允许 HTTP(S)、站内 `/data/avatars/...`，以及主项目生成的 `data/avatars/{数字 ID}.{jpg|jpeg|png|gif|webp}?t={数字}`；相对地址会转换为 `../data/avatars/...` 并保留缓存版本参数。任意其他 `data/` 文件、路径穿越、`data:`、`blob:` 和 `javascript:` 地址均被拒绝。

头像图片加载失败时，由统一事件监听替换为昵称首字母占位，不使用内联 `onerror`，也不会改变头像容器尺寸。广场和回复头像延迟加载，主帖首屏头像立即加载。

### 代表同好会

用户可以在“账户设置 → 个人资料/公开展示信息”中，从自己 `active` 且角色为 `member`、`manager` 或 `representative` 的正式会籍里选择一个“代表同好会”，也可以选择“不展示”。`external` 及非活跃会籍不能选择；中国、日本同编号会籍始终按 `club_id + country` 区分。

Forum 不把代表身份写入帖子或回复快照。`list_posts`、`list_mine`、`get_post` 与 `list_replies` 的作者对象动态返回可空的 `display_club`，并在广场作者、主帖作者栏和回复作者栏显示“同好会名称 · 会籍角色”。公开作者数据不包含 `display_membership_id` 或其他会籍。用户更换选择、正式角色变化或清除选择后，旧帖和旧回复下次读取即同步更新；退出、被踢、重新申请或会籍失效时，选择会在同一事务内清除，读取侧仍会再次验证会籍有效性。

### 广场、详情与楼层

- 广场使用连续主题流。每条主题显示绑定头像、标题和状态徽标、最多两行纯文本摘要、作者和最后活动信息、回复/点赞统计，以及可选的首图缩略图；没有图片的帖子不保留空白图片位。
- `list_posts` 和 `list_mine` 的帖子型结果增加 `excerpt` 与 `preview_image`。摘要最多约 180 个 Unicode 字符，并去除图片语法、URL、原始 HTML 标记和 Markdown 控制符；纯图片正文显示为“图片帖”。
- `preview_image` 只可能来自当前用户已经有权看到、且已经绑定到该帖子的第一张 Forum 附件。临时上传、未绑定附件和其他内容的附件不会返回；无图时固定为 `null`。这是向后兼容的列表字段扩展，不是新的封面字段。
- 帖子详情在桌面端采用作者栏与专栏正文分区，正文保持适合长文阅读的宽度；回复使用一个连续楼层表面和分隔线。手机端把作者栏折叠为“头像、昵称、时间、楼层”的横向头部。

列表增量字段示例：

```json
{
  "excerpt": "去除 Markdown 控制符后的正文摘要",
  "preview_image": {
    "url": "./uploads/2026/08/example.webp",
    "width": 1280,
    "height": 720,
    "alt": "example.webp"
  }
}
```

### Markdown 预览与图片上传

发帖、编辑和快捷回复继续以 Markdown 作为唯一正文源，并复用详情页的同一个白名单渲染器。支持 H2/H3、粗体、斜体、列表、引用、行内/围栏代码、HTTP(S) 链接、Forum 本地图片和 `@提及`；原始 HTML、危险协议和外部图片不开放。

发帖页现在使用居中的专栏式写作画布，不再强制桌面编辑/预览双栏。工作区高度限制为桌面 `clamp(540px, 68svh, 760px)`、平板/手机 `clamp(420px, 58svh, 620px)`；写作、预览和 Markdown 源码通过可访问 Tab 切换，面板各自滚动，长正文和长图不会无限拉长页面。预览在输入后 120ms 合并刷新，显示“正在更新 / 已同步”，并保留合法滚动位置。快捷回复复用同一套安全 `contenteditable` 转换、粘贴清理、工具栏和图片上传能力，但仍保持紧凑的编辑/预览 Tab，不引入第三套正文格式。

标题、正文、分类和标签位于同一创作卡片；新草稿只保存标题、正文、分类、标签和保存时间。默认写作模式使用受控 `contenteditable` 画布，Markdown 源码只是可选的高级入口，发布时仍只提交 `body_md`。状态栏显示标题/正文字数、草稿保存时间或存储失败、预览同步与图片等待状态。取消和发布位于卡片内吸附栏，离开卡片后自然停止，不覆盖页面页脚。Markdown 详细说明收进“Markdown 帮助”对话框。

工具栏“图片”与媒体区“添加图片”都会直接打开同一个真实上传器，不插入占位 URL。选择、拖拽或粘贴图片后，上传队列先使用本机 `blob:` 对象地址即时显示缩略图，并展示文件名、大小、进度、失败原因、重试和删除操作。服务端成功后缩略图切换到受信任的 `./uploads/...` URL，同时把 Markdown 图片语法插入当前光标位置并刷新预览。上传进行中会禁用发布并显示“等待图片上传”；`blob:` 不会写入正文或数据库，移除队列项时会释放对象地址。

写作画布会把 Word、网页和专栏富文本粘贴为论坛允许的 Markdown 结构，自动清理样式、脚本和不支持的标签；外部图片不抓取，只提示使用本页上传。Enter 会延续列表/引用，输入 `## `、`### ` 或代码围栏会自动建立对应块，HTTP(S) 地址在安全边界内自动转为链接。所有转换都避开中文输入法组合状态，且可使用浏览器撤销。

### 三页共享页脚

广场、详情和发帖页使用同一个页面级页脚。短页面时页脚位于视口底部，长页面时自然排在分页、回复或表单之后，不固定覆盖内容。广场页脚额外显示 API 返回的真实帖子总数。

“社区规则”“关于论坛”“隐私政策”分别使用 `#rules`、`#about`、`#privacy` 深链接。直接打开锚点、页内点击、浏览器前进/后退和关闭对话框都会同步 URL 与对话框状态；详情和发帖页统一链接回广场的对应锚点。

## 数据迁移

论坛 DDL 位于 `Forum/includes/forum_schema.php`，主迁移脚本只负责加载并调用它。确认当前配置指向本地或隔离数据库后运行：

```powershell
php scripts/migrate.php
```

迁移可重复执行，支持 MySQL 与 SQLite。不要在未备份、未核对连接目标时直接对生产数据库运行。

本轮没有修改 Forum 自有表，但账号“代表同好会”会在主项目 `users` 表增加可空的 `display_membership_id` 和普通索引。因此部署本功能前必须先备份数据库，再执行主迁移；迁移支持 MySQL/SQLite 首次与重复执行，且不会为旧账号自动选择会籍。重复迁移仍会保留休眠范围的历史数据，不能据此推断已经执行过生产迁移。

## 测试

```powershell
node Forum/scripts/test-forum-contract.mjs
node Forum/scripts/test-forum-browser.mjs
php Forum/scripts/test-forum-v1.php
node scripts/test-display-club-contract.mjs
node scripts/test-user-page-assets.mjs
php -l Forum/api/forum.php
php -l Forum/includes/forum.php
php -l Forum/includes/forum_schema.php
php -l includes/display_club.php
php -l api/auth.php
php -l api/membership.php
php -l scripts/migrate.php
```

SQLite 测试使用系统临时目录并在结束后删除测试数据库。浏览器脚本会自动使用本机 Chrome 或 Edge，启动一个只服务 Forum 文件的临时地址，并使用隔离的模拟账号、帖子和上传响应；它不连接生产数据库，也不写入生产上传目录。完整主项目检查可能包含与 Forum 无关的历史契约；交付时应分别记录 Forum 专项结果和主项目已有失败。

当前 SQLite 覆盖休眠数据在重复迁移后的完整保留与全角色不可访问，并验证摘要清理、纯图片帖、首张已绑定附件、临时附件隔离、历史附件归档与列表输出。隔离浏览器验收覆盖旧空间 URL 恢复广场、未请求同好会目录、1440/1024 居中写作画布、有界独立滚动、写作/预览/源码 Tab、真实图片按钮、blob 缩略图切换、粘贴转换、吸附栏、页脚与深链接。真实会话、真实上传与生产 Web 服务器配置仍属于部署前验证。

## 上传目录

新附件保存到：

```text
Forum/uploads/YYYY/MM/random-name.ext
```

生产 Web 进程需要对 `Forum/uploads` 拥有写权限。仓库只跟踪 `.gitignore` 和 Apache `.htaccess`，不跟踪用户上传内容。

Apache 会通过目录内 `.htaccess` 禁止目录浏览和脚本文件访问。Nginx 需要在站点配置中加入等价规则：

```nginx
location ~* ^/Forum/uploads/.*\.(?:php[0-9]?|phtml|phar|cgi|pl|py|sh|shtml)$ {
    deny all;
}

location /Forum/uploads/ {
    autoindex off;
    add_header X-Content-Type-Options nosniff always;
    try_files $uri =404;
}
```

修改后先执行 `nginx -t`，再按服务器既有发布流程平滑重载。

Forum 写接口会按浏览器完整同源规则比较协议、主机和有效端口，并拒绝同时缺少 `Origin` 与 `Referer` 的写请求。若生产站点位于反向代理之后，代理必须覆盖而不是追加客户端传入的 `X-Forwarded-Proto`，并正确传递原始 `Host`；否则 HTTPS 页面的合法写请求会因 Origin 不一致而被拒绝。非浏览器发布工具也必须显式发送与目标一致的 `Origin`，不使用无来源头的会话 Cookie 写入。

## 生产发布顺序

1. 备份数据库、`user.html`、现有 `user-v2-assets/`、`Forum/` 和上传目录。
2. 部署共享代表同好会辅助模块、账号/会籍 API、主迁移脚本和新的 `Forum/` 文件。
3. 上传新哈希的用户中心 JS/CSS，再更新 `user.html` 引用；旧哈希文件可暂时保留用于快速回滚和缓存过渡。
4. 设置 `Forum/uploads` 的所有者、写权限和 Web 服务器保护规则。
5. 核对生产数据库连接后执行 `php scripts/migrate.php`，确认 `users.display_membership_id` 与 `idx_users_display_membership` 已建立。
6. 验证代表同好会的选择、不展示、失效清理及账号总览，再依次验证访客广场、登录发帖/回复、编辑、收藏、举报、广场管理，并确认历史分区帖子返回统一 404。
7. 验证广场、主帖、回复的作者徽标与通知链接，并检查 PHP/Nginx 错误日志和静态资源缓存命中。

本实现不会自动发布或执行生产迁移。

## 回滚

- 先进入维护窗口，停止新的论坛写入。
- 恢复发布前的代码、`user.html` 哈希引用和主迁移脚本备份；旧哈希资源确认重新可用后再清理新资源。
- `users.display_membership_id` 是可空的向后兼容字段。仅回滚代码时可以保留该字段；不要在仍有新代码运行或没有完整备份时直接删列。需要数据级回滚时恢复整库备份。
- 上传文件与数据库附件记录必须使用同一时间点恢复，避免出现孤立记录或丢失文件。
- 根目录旧论坛 URL 没有兼容跳转；回滚到旧入口时必须同步恢复旧页面文件。
