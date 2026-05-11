<div align="center">

# 🗺️ 全国 Galgame 同好会地图

### 中日高校视觉小说同好会 · 可视化地图导航

[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![PHP](https://img.shields.io/badge/PHP-8.x-777bb4.svg)](https://php.net)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-f7df1e.svg)](https://developer.mozilla.org/)
[![D3.js](https://img.shields.io/badge/D3.js-7.9.0-f9a03c.svg)](https://d3js.org/)

**🌐 [map.vnfest.top](https://www.map.vnfest.top)**

</div>

---

## 简介

全国 Galgame 同好会地图是一个面向中日高校视觉小说同好会的交互式导航平台。通过中国省份地图和日本都道府县地图，直观展示各地同好会的分布情况，提供搜索、筛选、活动日历、刊物管理、GalOnly 出展申请等综合功能。

---

## 功能

**🗺️ 地图导航**
- 中国/日本地图一键切换，省份/都道府县点击查看
- D3.js 矢量渲染，支持缩放拖拽
- 数字徽章显示各地同好会数量

**🔍 搜索筛选**
- 组织名/群号搜索
- 高校同好会 / 地区联合 / VNFest 类型筛选
- 按名称、注册时间等多种排序

**👤 用户系统**
- 用户名/密码注册登录（bcrypt 加密）
- QQ 互联 / Discord OAuth2 登录
- 邮箱绑定与验证
- 个人头像上传（Cropper.js）与裁剪

**🎪 同好会管理**
- 同好会详情与成员列表
- 成员申请与审核流程
- 角色体系：成员 → 管理员 → 负责人
- 联系方式可见性控制
- 社团头像上传与管理

**📋 账号面板（VN 风格）**
- 个人档案卡片（角色风格布局）
- 图鉴收集系统：已加入的同好会、已报名的活动、投稿刊物一览
- 昵称与个性签名设置
- 头像上传与裁剪

**📅 活动日历**
- 月历视图 / 列表视图切换
- 活动详情弹窗（海报、简介、链接）
- 活动报名与取消报名
- 多日跨月活动支持
- 筛选：全部 / 即将开始 / 进行中 / 已结束
- 管理员增删改

**📖 刊物管理**
- 社团刊物投稿与管理
- 状态追踪：写作中 / 规划中 / 编辑中 / 发布中 / 已完成
- 封面图上传

**🎟️ GalOnly 高校专属通道**
- 同好会出展申请表单（社团选择、海报上传、自我介绍）
- 申请状态追踪（待审核 / 已通过 / 已驳回 / 待付款）
- 7 人投票审核机制（先达 4 票决定结果）
- 驳回后重审机制（清空旧投票 + 重审标记）
- 审核后台（管理员面板）
- 申请数据重置工具

**📝 提交系统**
- 同好会信息提交
- 活动信息提交
- 刊物投稿提交

**👑 管理后台**
- 同好会增删改查（超级管理员）
- 提交审核（同好会 / 活动 / 刊物）
- 成员管理（审核、角色变更、踢出）
- 数据统计面板

**🎨 界面**
- 深色/浅色主题（跟随系统）
- 多主题配色（红/蓝/绿/紫/橙）
- 中日双语切换
- 移动端适配（汉堡菜单、用户卡片折叠展开）
- 玻璃态模糊效果（backdrop-filter）
- 动态渐变与流光动效

---

## 快速开始

### 环境要求

- PHP 8.0+
- SQLite（默认）或 MySQL
- Apache（mod_rewrite）或 Nginx
- QQ 互联 / Discord 开发者账号（OAuth 可选）

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/kokubunshu/china-galgame-maps.git
cd china-galgame-maps

# 2. 配置环境
cp config.example.php config.php
# 编辑 config.php 填写数据库、OAuth 等配置

# 3. 初始化数据库
php scripts/migrate.php

# 4. 启动开发服务器
php -S localhost:8000
```

### 访问地址

| 页面 | 地址 |
|------|------|
| 主页 | `http://localhost:8000` |
| 同好会提交 | `submit.html` |
| 活动提交 | `submit_event.html` |
| 刊物投稿 | `submit_publication.html` |
| GalOnly 出展申请 | `Galgame_events/Shanghai_Galonly_submit.html` |
| GalOnly 活动主页 | `Galgame_events/galgameonly_list.html` |
| 审核后台 | `admin/reviews.html` |
| 同好会管理 | `admin/club_manager.html` |
| GalOnly 审核 | `admin/Galonly_audit.html` |
| 活动审核 | `admin/events.php` |

---

## 目录结构

```
├── admin/              # 管理后台页面
│   ├── club_manager.html      # 同好会管理面板
│   ├── reviews.html           # 审核中心
│   ├── Galonly_audit.html     # GalOnly 出展审核
│   ├── events.php             # 活动审核
│   ├── submissions.html       # 同好会提交审核
│   └── submissions_event.html # 活动提交审核
├── api/                # API 接口
│   ├── auth.php               # 用户认证（登录/注册/OAuth）
│   ├── clubs.php              # 中国同好会 CRUD
│   ├── clubs_japan.php        # 日本同好会 CRUD
│   ├── membership.php         # 成员管理
│   ├── events.php             # 活动管理 + 报名系统
│   ├── publications.php       # 刊物管理
│   ├── galonly.php            # GalOnly 出展申请 API
│   ├── manuscripts.php        # 稿件管理 API
│   ├── avatar.php             # 头像上传
│   ├── club_avatar.php        # 社团头像上传
│   ├── submit.php             # 同好会提交
│   ├── submit_event.php       # 活动提交
│   └── submit_publication.php # 刊物投稿
├── css/
│   └── styles.css             # 全局样式
├── data/               # 数据文件
│   ├── clubs.json             # 中国同好会数据
│   ├── clubs_japan.json       # 日本同好会数据
│   ├── events.json            # 活动数据
│   ├── publications.json      # 刊物数据
│   ├── submissions.json       # 待审核提交
│   ├── event_registrations.json  # 活动报名数据
│   ├── submissions_event.json # 活动提交审核数据
│   ├── manuscripts.json       # 稿件数据
│   ├── galgame.db             # SQLite 数据库
│   ├── club_avatars/          # 同好会头像上传目录
│   ├── avatars/               # 用户头像上传目录
│   ├── publication_images/    # 刊物封面上传目录
│   └── manuscripts/           # 稿件文件上传目录
├── Galgame_events/     # GalOnly 专属活动页面
│   ├── galgameonly_list.html  # 活动列表与申请管理
│   └── Shanghai_Galonly_submit.html  # 出展申请表
├── images/             # 图片资源
├── includes/           # PHP 核心库
│   ├── auth.php               # 认证与角色管理
│   ├── db.php                 # 数据库连接（SQLite + MySQL）
│   ├── oauth_qq.php           # QQ OAuth2
│   ├── oauth_discord.php      # Discord OAuth2
│   ├── audit.php              # 审计日志
│   └── rate_limit.php         # 频率限制
├── js/                 # 前端脚本
│   ├── app.js                 # 主应用逻辑（用户面板、图鉴、地图交互）
│   ├── calendar.js            # 活动日历（月历/列表、报名）
│   ├── china.js               # 中国地图 GeoJSON
│   └── japan.js               # 日本地图 GeoJSON
├── scripts/            # 命令行工具
│   ├── migrate.php            # 数据库迁移
│   ├── reset_galonly.php      # 清空 GalOnly 申请数据
│   ├── add_column_resubmitted.php  # 添加重审列（Web 迁移）
│   └── seed_superadmin.php    # 创建超级管理员
├── uploads/            # 文件上传目录
│   └── galonly/               # GalOnly 海报上传
├── index.html          # 主页面
├── submit.html         # 同好会提交页
├── submit_event.html   # 活动提交页
└── submit_publication.html # 刊物投稿页
```

---

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `api/clubs.php` | GET | 获取中国同好会列表 |
| `api/clubs_japan.php` | GET | 获取日本同好会列表 |
| `api/events.php` | GET/POST | 活动读取/管理/报名 |
| `api/publications.php` | GET/POST/PUT/DELETE | 刊物 CRUD |
| `api/auth.php` | GET/POST | 认证（含 OAuth） |
| `api/membership.php` | GET/POST | 成员申请/审核 |
| `api/galonly.php` | GET/POST | GalOnly 出展申请/审核/投票 |
| `api/manuscripts.php` | GET/POST | 稿件管理 |
| `api/club_avatar.php` | POST | 同好会头像上传 |
| `api/submit.php` | POST | 提交同好会 |
| `api/toggle_visibility.php` | POST | 切换可见性 |

> 管理操作需要对应角色权限（super_admin / representative / manager）。

---

## 角色体系

| 角色 | 级别 | 说明 |
|------|------|------|
| visitor | 0 | 注册用户 |
| member | 1 | 同好会成员 |
| manager | 2 | 管理员（审核成员、编辑信息） |
| representative | 3 | 负责人（同好会最高权限） |
| super_admin | 4 | 超级管理员（全局管理） |

此外，`is_audit` 标志位可单独赋予用户审核权限，用于 GalOnly 等审核流程。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML5 / CSS3（Custom Properties）/ Vanilla JS |
| 后端 | PHP 8.x（无框架） |
| 数据库 | SQLite / MySQL（PDO 双驱动） |
| 地图 | D3.js v7（SVG GeoJSON） |
| 认证 | Session + QQ OAuth2 + Discord OAuth2 |
| 密码 | bcrypt（cost 12） |
| 图片裁剪 | Cropper.js |
| 许可证 | GPLv3 |

---

## 数据统计

| 地区 | 同好会 |
|------|--------|
| 🇨🇳 中国 | 232 |
| 🇯🇵 日本 | 27 |
| **合计** | **259** |

---

## 近期更新

### v1.5.0 — 用户面板与 GalOnly 高校通道

**✨ 新功能**
- **GalOnly 高校专属通道**：同好会出展申请、7 人投票审核、驳回重审机制
- **账号面板（VN 风格）**：个人档案卡片、图鉴收集、设置页
- **活动报名系统**：用户可报名/取消活动，实时显示报名人数
- **动态流光动效**：GalOnly 按钮与移动端汉堡按钮的流动渐变 + 呼吸辉光

**🎨 界面重设计**
- 顶层用户信息卡片：头像、昵称、角色徽章、导航按钮
- 移动端汉堡菜单 + 左侧抽屉导航
- 移动端用户卡片点击展开/折叠导航行
- 模态框 z-index 修复（关闭按钮不被标签栏遮挡）
- 图鉴中同好会卡片显示社团头像（取代固定 emoji）

**📅 日历增强**
- 新增列表视图筛选：全部 / 即将开始 / 进行中 / 已结束
- 多日活动跨月渲染支持
- 活动报名/取消功能

**🐛 修复**
- `includes/auth.php` fallback 路径覆盖 is_audit 标志位
- `admin/events.php` 审核通过时覆盖整个 events.json 导致数据丢失
- 桌面端用户信息卡片遮挡介绍卡片「收起」按钮
- GalOnly 重审未清空旧投票导致审核卡死
- `login_local` 响应缺少 `is_audit` 字段
- 移动端汉堡按钮与展开的用户卡片重叠

**🛠 其他**
- 数据库迁移脚本增强（resubmitted 列）
- GalOnly 申请数据重置工具
- 移除废弃脚本（gen_sql.php, list_assignments.php, match_members.php）

---

## 相关项目

- [china-bandori-maps](https://github.com/HELPMEEADICE/china-bandori-maps) — 原始地图数据参考

---

<div align="center">

**Made with ❤️ for Galgame Community**

</div>
