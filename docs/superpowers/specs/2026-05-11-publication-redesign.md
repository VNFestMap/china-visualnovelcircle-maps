# 刊物投稿模块改造设计方案

## 背景

当前刊物投稿模块的一级列表中，每条记录展示封面大图、同好会名称、状态标签、联系方式、截止日期、描述等完整信息，内容密集且视觉冗余。同时，刊物与同好会为一对一关系（clubName 字符串），缺少详情展示和稿件投递功能，用户无法在浏览刊物时直接投稿。

本次改造在一级列表做减法、在二级详情做加法，并打通用户→稿件→同好会管理的完整链路。

## 设计目标

1. 一级刊物列表简化，仅展示同好会头像、名称、状态、截止日期等关键信息
2. 点击列表项弹出二级详情弹窗，展示完整刊物信息 + 关联同好会 + 封面素材
3. 刊物支持绑定多个同好会（club_ids 数组）
4. 二级弹窗开放上传稿件功能（文件 + 联系方式）
5. 同好会管理后台新增「刊物稿件」标签页，对接上传的稿件

## 数据模型变更

### publications.json

当前 `clubName` 字符串字段改为 `club_ids` 数组，每条记录包含 club_id 和 country：

```json
{
  "publications": [
    {
      "id": 2,
      "club_ids": [
        {"id": 88, "country": "china"},
        {"id": 12, "country": "china"}
      ],
      "clubName": "盐城工学院橘柚视觉小说同好会",
      "publicationName": "同好会年刊Vol2",
      "status": "writing",
      "submitContact": "2997016663@qq.com",
      "submitLink": "",
      "deadline": "2026-06-20",
      "description": "写作内容...",
      "image_url": "data/publication_images/2.png?t=1778342004",
      "created_at": "2026-05-07 23:50:04",
      "updated_at": "2026-05-09 23:53:26"
    }
  ]
}
```

- `club_ids` 字段存储同好会 ID + 国家（解决中日 club_id 冲突问题）
- 保留 `clubName` 字段作为显示用（后端从 clubs.json/clubs_japan.json 解析后填充）
- 前端渲染时，从 clubs.json/clubs_japan.json 读取 club 的 name 和 logo_url 用于显示

### 新增稿件数据文件：data/manuscripts.json

存储用户上传的稿件：

```json
[
  {
    "id": 1,
    "publication_id": 2,
    "club_ids": [
      {"id": 88, "country": "china"},
      {"id": 12, "country": "china"}
    ],
    "submitter_id": 42,
    "submitter_name": "张三",
    "contact": "123456789@qq.com",
    "file_name": "投稿_视觉小说_张三.pdf",
    "file_path": "data/manuscripts/1_张三.pdf",
    "remark": "这是我的投稿作品",
    "submitted_at": "2026-05-11 14:30:00"
  }
]
```

- `club_ids` 自动继承自 publication 的绑定关系
- 无需审核，提交后直接可见

### 新增 API：api/manuscripts.php

| 动作 | 方法 | 描述 | 权限 |
|------|------|------|------|
| list_by_publication | GET | 获取某个刊物的所有稿件 | 公开 |
| list_by_club | GET | 获取某个同好会的所有稿件 | 需管理权限 |
| upload | POST | 上传稿件 | 登录即可 |
| delete | DELETE | 删除稿件 | 需管理权限或本人 |

### PHP 数据文件：api/submit_manuscript.php

用于处理稿件上传的文件存储和 manuscripts.json 更新。

## 前端变更

### 文件：index.html

| 改动 | 说明 |
|------|------|
| 保留 `#publicationModal` | 作为一级列表容器，内容改用新渲染逻辑 |
| 新增 `#publicationDetailModal` | 二级详情弹窗结构 |
| 保留 `#publicationEditorModal` | 管理员 CRUD 弹窗，新增 club_ids 选择UI |

`#publicationDetailModal` 结构：

```html
<div id="publicationDetailModal" class="calendar-modal" aria-hidden="true">
  <div class="calendar-modal-card" style="max-width: 600px;">
    <button id="pubDetailClose" class="calendar-modal-close">×</button>
    <div class="calendar-modal-scroll">
      <!-- 封面素材 -->
      <div id="pubDetailCover" class="pub-detail-cover"></div>
      <!-- 刊物名称 -->
      <h3 id="pubDetailName"></h3>
      <!-- 关联同好会列表（头像+名称标签） -->
      <div id="pubDetailClubs" class="pub-detail-clubs"></div>
      <!-- 状态标签 + 截稿日期 -->
      <div class="pub-detail-meta"></div>
      <!-- 刊物描述 -->
      <div id="pubDetailDesc" class="pub-detail-desc"></div>
      <!-- 上传稿件区域 -->
      <div class="pub-detail-upload">
        <h4>上传稿件</h4>
        <input type="file" id="manuscriptFile" accept=".pdf,.png,.jpg,.doc,.docx">
        <input type="text" id="manuscriptContact" placeholder="联系方式 (QQ/邮箱)">
        <button id="manuscriptUploadBtn">上传</button>
      </div>
      <!-- 已收稿件列表 -->
      <div id="pubDetailManuscripts" class="pub-detail-manuscripts"></div>
    </div>
  </div>
</div>
```

### 文件：css/styles.css

新增样式类：
- `.pub-detail-cover` — 封面素材展示区
- `.pub-detail-clubs` — 关联同好会标签行（flex wrap，头像+名称）
- `.pub-detail-desc` — 刊物描述区域
- `.pub-detail-upload` — 上传稿件区域（文件输入+联系方式+按钮）
- `.pub-detail-manuscripts` — 稿件列表
- `.manuscript-item` — 单个稿件行（文件名、投稿人、时间、状态）
- `.pub-list-item` — 简化后的一级列表项（头像+名称+状态+截止日期）

### 文件：js/app.js

| 改动 | 说明 |
|------|------|
| `renderPublicationList()` | 简化为只显示头像+名称+状态+截止日期，头像从 clubs.json 读取 logo_url |
| 新增 `openPublicationDetail(publication)` | 打开二级弹窗，加载刊物信息、关联同好会、稿件列表 |
| 新增 `closePublicationDetail()` | 关闭二级弹窗 |
| 新增 `loadManuscripts(publicationId)` | 从 API 加载某个刊物的稿件 |
| 新增 `uploadManuscript(publicationId)` | 处理文件上传+联系方式提交 |
| `openPublicationEditor(publication)` | 新增 club_ids 选择（多选下拉或多选标签） |
| 新增 `initPublicationDetailEvents()` | 绑定二级弹窗事件 |

### 文件：admin/club_manager.html

新增「刊物稿件」标签页，显示内容：
- 该同好会关联的所有刊物列表
- 每个刊物对应的稿件数量和列表
- 查看/删除稿件操作

## 数据流

### 用户浏览刊物并投稿

```
用户点击顶层导航 "刊物投稿"
  → #publicationModal 打开
  → loadPublications() → 渲染简化列表（每个 item 显示同好会头像、名称、状态、截止日期）
  → 用户点击某个刊物 → openPublicationDetail(pub)
    → #publicationDetailModal 打开
    → 显示封面素材、关联同好会标签（头像+名称）、描述、投稿信息
    → loadManuscripts(pub.id) → 显示已收稿件列表
    → 用户填写联系方式、选择文件、点击上传
    → POST api/manuscripts.php?action=upload → 刷新稿件列表
```

### 管理员查看同好会稿件

```
管理员在 club_manager.html 点击「刊物稿件」标签
  → 显示该同好会关联的所有刊物
  → 点击某个刊物的「查看稿件」
  → 显示该刊物的所有稿件列表（投稿人、文件、联系方式、时间）
  → 可删除稿件
```

## 交互说明

| 元素 | 交互 |
|------|------|
| 一级列表项（简化后） | 点击 → 打开二级详情弹窗 |
| 二级详情 × 按钮/遮罩 | 关闭二级详情弹窗 |
| 上传文件按钮 | 选择文件 (.pdf/.png/.jpg/.doc/.docx) |
| 上传提交按钮 | POST 上传稿件，显示上传进度，成功后刷新列表 |
| 已收稿件列表 | 每条显示文件名、投稿人、联系方式、时间 |
| club_manager.html 刊物稿件标签 | 列出关联刊物+稿件数，点击查看详情 |

## 注意事项

- 中日 club_id 冲突：club_ids 数组每条存储 `{id, country}`，查询 clubs.json/clubs_japan.json 时需要根据 country 区分
- 头像显示：从 clubs.json/clubs_japan.json 读取 `logo_url`，若无则显示同好会名称首字
- 文件上传限制：最大 10MB，支持 PDF/PNG/JPG/DOC/DOCX
- 稿件文件存储在 `data/manuscripts/` 目录
- 用户可删除自己的稿件，管理员可删除任何稿件
- 评审中心 `admin/reviews.html` 不需要变动（刊物征集审核流程不变）
