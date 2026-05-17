# VNFest 自助萌战系统设计

日期：2026-05-17
状态：设计确认稿
配套视觉稿：`docs/moe-contest-system-demo.html`

## 目标

为各同好会提供一个自助开启年度萌战活动的系统。负责人可以创建活动、配置阶段、审核提名、生成 1v1 正赛对阵；同好会管理员可协助运营；全站用户可在萌战广场发现并参与符合资格的活动。

第一版聚焦真实萌战流程：提名、海选、分组/预选、1v1 正赛、复活赛、决赛与归档。不做泛活动平台，不做复杂风控和票权公式。

## 用户角色与权限

- 访客：可浏览公开萌战广场和公开结果，不可投票。
- 登录用户：可参与公开投票、提交公开提名。
- 同好会成员：可参与仅本会成员投票和提名。
- 同好会管理员：可审核提名、编辑候选资料、配置阶段、查看本会活动数据。
- 同好会负责人/代表：可创建、发布、结束、归档、删除本会萌战。
- 超级管理员：可查看和管理所有萌战，可下架违规活动。

权限判断沿用现有 `club_memberships`：`representative` 拥有创建权，`representative` 与 `manager` 拥有运营权，`super_admin` 拥有全局兜底权。

## 活动入口

1. 同好会详情页
   - 展示该同好会的萌战活动列表。
   - 负责人看到“创建萌战”“管理活动”入口。
   - 用户看到“投票”“提名”“查看结果”入口。

2. 全站萌战广场
   - 聚合展示进行中、提名中、即将开始、已结束活动。
   - 支持按国家/省份、同好会、状态、活动类型筛选。

3. 个人中心
   - 后续展示“我的提名”“我的投票记录”“我管理的萌战”。
   - 第一版可以只提供轻量入口，不做完整历史中心。

## 活动状态机

活动状态：

- `draft`：草稿，只有管理者可见。
- `published`：已发布，但当前阶段可能尚未开始。
- `running`：当前阶段进行中。
- `settling`：阶段结束后锁票，等待结算/生成晋级名单。
- `ended`：全部阶段结束，结果可展示。
- `archived`：历史归档，只读。
- `suspended`：被负责人或超级管理员暂停。

阶段状态：

- `pending`：未开始。
- `open`：进行中。
- `locked`：已锁票，等待结算。
- `settled`：已结算，晋级名单已写入下一阶段。
- `skipped`：跳过。

## 阶段类型

阶段以积木方式组合，顺序由负责人配置。

1. `nomination`
   - 用户提交候选。
   - 支持 Bangumi 搜作品选角色、直接搜角色、手动候选。
   - 负责人/管理员审核后进入候选池。

2. `qualifier`
   - 海选或预选。
   - 多候选投票，按票数或排名选出前 N 名。
   - 支持每轮固定票数或每日刷新票数。

3. `group_vote`
   - 分组投票。
   - 候选按组分配，每组前 N 名晋级。
   - 分组可随机、按种子蛇形、手动调整。

4. `bracket`
   - 正式 1v1 对战阶段。
   - 支持 64/32/16/8 强单败淘汰。
   - 每场两个候选，用户只能投一边。
   - 胜者自动进入下一轮。

5. `revival`
   - 复活赛。
   - 从被淘汰候选中选出若干名回到后续阶段。
   - 规则与 `qualifier` 类似，但来源为淘汰池。

6. `final`
   - 决赛、季军战、排名战。
   - 可复用 `bracket` 的 match 模型。

## 1v1 正赛规则

正赛不能用普通投票列表硬凑，必须有独立对阵模型。

对阵生成方式：

- 按预选排名蛇形排位。
- 随机抽签。
- 负责人手动排位。

场次规则：

- 每场单票，默认不可改票。
- 支持按场次设置开始/结束时间。
- 支持实时百分比、实时票数、仅排名、结束后公开、全程隐藏。
- 支持负责人锁场、重开、手动修正胜者。

同票处理：

- 加赛。
- 按种子位晋级。
- 负责人裁定。

晋级：

- `moe_matches.winner_candidate_id` 写入后，下一轮对应场次自动填入。
- 生成下一轮前检查所有来源场次是否已结算。

## 提名与 Bangumi 接入

现有 `api/bangumi_proxy.php` 已支持 Bangumi 条目搜索和缓存。萌战需要扩展：

- 搜作品：`action=search_subject`
- 作品角色列表：`action=subject_characters`
- 搜角色：`action=search_character`
- 角色详情：`action=get_character`

提名保存字段：

- `subject_id`
- `character_id`
- `subject_name`
- `subject_name_cn`
- `character_name`
- `character_name_cn`
- `avatar_url`
- `aliases`
- `summary`
- `source`

允许无 Bangumi 来源的手动候选，但审核界面要标记为 `manual`，方便负责人确认资料。

## 投票资格与展示

投票资格由活动或阶段配置：

- `public`：所有登录用户。
- `club_member`：指定同好会 active 成员。
- `invite_code`：持邀请码用户。
- `whitelist`：白名单用户。

结果展示由阶段配置：

- `live_votes`：实时公开票数。
- `live_rank_only`：实时公开排名，不公开票数。
- `after_stage`：阶段结束后公开。
- `after_event`：活动结束后公开。
- `hidden`：仅管理端可见。

## 基础反作弊

第一版只做基础限制：

- 登录用户才能投票。
- 按阶段和场次限制投票次数。
- 记录 IP、User-Agent、创建时间。
- 重复投票按唯一约束拦截。
- 支持负责人导出投票记录用于复盘。

不做代理识别、风控分、可疑票暂存、票权倍率、应援加成。

## 数据表设计

### `moe_contests`

- `id`
- `club_id`
- `country`
- `title`
- `description`
- `cover_url`
- `candidate_mode`：`character_custom`
- `status`
- `visibility`：`public` / `unlisted` / `club_only`
- `eligibility_mode`
- `result_visibility`
- `created_by`
- `created_at`
- `updated_at`
- `published_at`
- `ended_at`

### `moe_contest_stages`

- `id`
- `contest_id`
- `stage_type`
- `title`
- `sort_order`
- `status`
- `starts_at`
- `ends_at`
- `vote_mode`：`fixed_per_stage` / `daily` / `match_single`
- `votes_per_user`
- `allow_vote_change`
- `allow_duplicate_candidate_vote`
- `advance_rule`：JSON
- `visibility_rule`：JSON
- `config_json`：JSON
- `created_at`
- `updated_at`

### `moe_candidates`

- `id`
- `contest_id`
- `source`：`bangumi` / `manual`
- `subject_id`
- `character_id`
- `name`
- `name_cn`
- `subject_name`
- `subject_name_cn`
- `avatar_url`
- `summary`
- `custom_fields_json`
- `status`：`pending` / `approved` / `rejected` / `withdrawn`
- `created_by`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

### `moe_stage_entries`

- `id`
- `stage_id`
- `candidate_id`
- `group_key`
- `seed_no`
- `source_stage_id`
- `source_rank`
- `status`：`active` / `advanced` / `eliminated` / `revived`
- `created_at`

### `moe_matches`

- `id`
- `stage_id`
- `round_no`
- `match_no`
- `slot_a_candidate_id`
- `slot_b_candidate_id`
- `winner_candidate_id`
- `source_match_a_id`
- `source_match_b_id`
- `status`：`pending` / `open` / `locked` / `settled`
- `starts_at`
- `ends_at`
- `tie_break_rule`
- `created_at`
- `updated_at`

### `moe_votes`

- `id`
- `contest_id`
- `stage_id`
- `match_id`
- `candidate_id`
- `user_id`
- `vote_date`
- `ip_hash`
- `user_agent_hash`
- `created_at`

唯一约束按阶段类型变化：

- 普通阶段：`stage_id + user_id + candidate_id` 防止同候选重复。
- 每日票数：统计 `stage_id + user_id + vote_date`。
- 1v1 场次：`match_id + user_id` 保证每场一票。

### `moe_invites`

- `id`
- `contest_id`
- `code`
- `max_uses`
- `use_count`
- `expires_at`
- `created_by`
- `created_at`
- `is_active`

### `moe_whitelist`

- `id`
- `contest_id`
- `user_id`
- `created_by`
- `created_at`

## API 设计

### `api/moe_contests.php`

- `list`：萌战广场列表。
- `my_manageable`：当前用户可管理的萌战。
- `get`：活动详情。
- `create`：负责人创建草稿。
- `update`：负责人更新基础信息。
- `publish`：发布活动。
- `suspend`：暂停活动。
- `archive`：归档活动。

### `api/moe_stages.php`

- `list`：阶段列表。
- `create`：添加阶段。
- `update`：修改阶段配置。
- `reorder`：阶段排序。
- `open`：开启阶段。
- `lock`：锁定阶段。
- `settle`：结算阶段并生成晋级名单。

### `api/moe_candidates.php`

- `list`：候选列表。
- `nominate`：提交提名。
- `update`：编辑候选资料。
- `approve`：审核通过。
- `reject`：驳回。
- `withdraw`：撤回。

### `api/moe_matches.php`

- `generate`：生成 1v1 对阵。
- `list`：对阵表。
- `update`：手动调整场次。
- `open`：开启场次。
- `lock`：锁定场次。
- `settle`：结算场次。
- `advance`：写入下一轮。

### `api/moe_votes.php`

- `eligibility`：检查当前用户是否可投。
- `cast`：投票。
- `my_votes`：我的投票。
- `stage_results`：阶段结果。
- `match_results`：场次结果。
- `export`：管理端导出记录。

### `api/bangumi_proxy.php`

扩展角色相关 action，并沿用现有缓存目录 `data/cache/bangumi`。

## 前端页面结构

第一版可先用单独页面和现有主站入口连接：

- `moe.html`：萌战广场。
- `moe_detail.html?id=...`：活动详情、阶段状态、投票入口。
- `moe_vote.html?contest_id=...&stage_id=...`：投票页。
- `moe_bracket.html?contest_id=...&stage_id=...`：1v1 对阵表。
- `moe_manage.html?contest_id=...`：负责人工作台。
- `moe_create.html?club_id=...&country=...`：创建向导。

后续可以整合进主 `index.html` 的同好会详情弹窗和个人中心。

## 第一版开发顺序

1. 建表和迁移脚本。
2. 权限 helper：`canManageMoeContest`、`canCreateMoeContest`、`canVoteMoeContest`。
3. `moe_contests` 与 `moe_stages` API。
4. Bangumi 角色搜索扩展。
5. 提名与候选审核 API。
6. 萌战广场和活动详情页。
7. 海选/预选投票。
8. 1v1 对阵生成、投票、结算。
9. 负责人工作台。
10. 测试脚本与健康检查。

## 测试重点

- 非负责人不能创建本会萌战。
- 管理员能审核提名但不能删除活动。
- 未登录用户不能投票。
- 仅本会成员阶段拒绝非成员投票。
- 1v1 场次每人只能投一次。
- 阶段锁定后不能继续投票。
- 结算后胜者能进入下一轮。
- Bangumi API 失败时允许手动候选兜底。

## 非第一版范围

- 复杂风控、代理识别、可疑票审核队列。
- 票权倍率、应援加成、积分公式编辑器。
- 完整活动平台化。
- 多语言全量文案打磨。
- APK/Windows 离线完整运营能力。
