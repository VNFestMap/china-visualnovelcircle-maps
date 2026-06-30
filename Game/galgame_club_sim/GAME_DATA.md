# Galgame同好会模拟器 — 数值文档 v7.2

> 本文档汇总游戏全部数值、公式、阈值，供审核与平衡性修正参考。

---

## v7.2 权威修订

以下内容优先于后文仍保留的 v7.1 历史表格。

### 现金成本与收入

| 行动 | 首次成本 | 后续推进 | 直接或完成回款 |
|---|---:|---:|---:|
| 校园墙招新 / 例会 / 线上团建 / 研讨会 / 交接 / 休整 | 0 | 0 | 0 |
| 新人茶会 / KTV | 50 | — | 0 |
| 跨校联动 | 60 | 12 | 完成后 40 |
| 迎新看板 / 社团制品 | 100 | — | 制品即时回款 45 |
| 原创短篇 VN | 120 | 24 | 完成后 40 |
| 社刊 | 200 | 40 | 完成后 140 |
| 展会出摊 | 300 | 60 | 完成后 220 |
| 维护平台 | 20 | — | 0 |
| 申请经费 | 0 | 冷却 8 周 | 160 |

校园文化节邀请可获得 40 支持经费，漫展合作事件可获得 60 场地或销售补贴。

### 核心公式

```text
适配度 = clamp(20 + 标签匹配*14 + Detail支持*45 + (可用度-50)*0.45)
项目后续成本 = round(首次成本 * 0.2)
核心招募概率 = clamp(
  0.09 + newcomerDetail*0.0006 + fame*0.0005
  + 候选新人*0.003 + 心情*0.0004,
  0.03, 0.22
)
```

- 技能发动后进入定义的完整冷却周期。
- Detail 通过增量同步到六维能力，不再覆盖行动收益和成就元数据。
- 休整只恢复压力、疲劳和心情，不增加组织、传承、Detail 或文化。
- 普通成员由招新行动进入候选池，再通过例会或茶会转化为正式成员；活跃人数不会超过总人数。
- 季节开始被动只在季节第一周触发一次。
- 燃尽结局优先判定；正面结局按路线成果评分；无路线达标时进入“维持之年”。

## 一、基础资源系统

### 1.1 资源一览

| 资源 | 上限 | 初始值 | 说明 |
|---|---|---|---|
| funds 经费 | 无上限 | 780 | 行动消耗，`Math.max(0, ...)` 防止负值 |
| fame 知名度 | 0–100 | 12 | 影响招新和外部邀请 |
| pressure 压力 | 0–100 | 14 | 核心负担指标，影响成员状态 |
| credit 社团信用 | 0–100 | 18 | 影响经费申请与校方关系 |
| influence 作品影响力 | 0–100 | 8 | 与内容产出相关 |
| relations 外部关系 | 0–100 | 8 | 影响跨校合作 |

### 1.2 压力阈值

| 压力范围 | 等级 | 效果 |
|---|---|---|
| 0–59 | good | 正常 |
| 60–77 | warn | 压力偏高，HUD 黄色提示 |
| 78–100 | bad | 高危，HUD 红色脉冲动画；成员行动时 `heat -= 3`；`active -= 2`；`mood -= 5` |

### 1.3 文化倾向

| 文化值 | 名称 | 增长来源 |
|---|---|---|
| campus | 校内扎根 | 校园墙/迎新/例会/茶会/申请经费 |
| publication | 刊物出摊 | 社刊/制品/出摊 |
| alliance | 跨校联动 | 联动/出摊/社刊/平台 |
| creative | 创作开发 | 原创 VN |
| tradition | 活动传统 | 迎新/制品 |
| archive | 档案传承 | 研讨/社刊/平台/交接/休整 |

`routeName(s)` 取最高文化值决定路线名称。

---

## 二、核心成员系统

### 2.1 初始核心成员

| 姓名 | 年级 | 角色 | 热 | 疲 | 信 | 成长 | 技能 | 稀有度 | 特质 |
|---|---|---|---|---|---|---|---|---|---|
| 杏子 | 三年级 | 副会长·文案主持 | 72 | 18 | 54 | 58 | 破冰主持 | SR | 热情但容易燃尽 |
| 液泡眼 | 二年级 | 前端·宣传 | 62 | 14 | 48 | 50 | 原型冲刺 | SR | 能力强但不主动 |
| 花田 | 二年级 | 日语·校对 | 60 | 12 | 46 | 52 | 文献档案 | SR | 稳定可靠 |
| 白纸 | 一年级 | 绘图·排版新人 | 66 | 10 | 38 | 35 | 版面急救 | R | 新人但成长快 |
| 北窗 | 一年级 | 脚本·音乐兴趣 | 58 | 8 | 34 | 32 | 原型冲刺 | R | 创作欲高但抗压低 |
| 老社长 | 四年级 | 顾问·摊位经验 | 52 | 22 | 60 | 70 | 摊位统筹 | SSR | 经验丰富但即将毕业 |

### 2.2 招募池

| 姓名 | 年级 | 角色 | 热 | 疲 | 信 | 成长 | 技能 | 稀有度 | 特质 |
|---|---|---|---|---|---|---|---|---|---|
| 青柠 | 一年级 | 美术 | 64 | 6 | 28 | 22 | 版面急救 | R | 安静但很会画 |
| 海盐 | 一年级 | 主持 | 68 | 6 | 26 | 24 | 破冰主持 | R | 喜欢聊天，敢开麦 |
| 南桥 | 二年级 | 前端 | 56 | 8 | 25 | 28 | 原型冲刺 | R | 技术不错但很忙 |
| 澄空 | 一年级 | 文案 | 62 | 6 | 24 | 22 | 文献档案 | R | 写推荐很认真 |
| 远夏 | 一年级 | 摊位 | 61 | 7 | 27 | 25 | 摊位统筹 | R | 执行力强 |
| 月见 | 二年级 | 组织 | 60 | 9 | 26 | 30 | 接班火种 | SR | 愿意接锅但需要引导 |

### 2.3 成员状态计算

```
memberState(m):
  fatigue >= 78 → ['燃尽边缘', 'burn']
  fatigue >= 58 → ['疲劳', 'tired']
  else → heat >= 70 ? ['热情中', 'ok'] : ['稳定', 'ok']

capacity(m):
  clamp(35 + heat*0.35 - fatigue*0.4 + growth*0.25 + trust*0.1)
```

### 2.4 每周被动变化

```
每位成员:
  skillCd > 0 → skillCd--
  fatigue -= 2
  policy === 'safe' → fatigue -= 1 (额外)
  heat -= 1
  fatigue > 70 → heat -= 3
公共:
  common.fatigue -= 1
  pressure -= 1
```

---

## 三、行动系统

### 3.1 行动一览

| ID | 分类 | 费用 | 季节 | 标签 |
|---|---|---|---|---|
| campus_wall | campus | 0 | 春秋 | 宣传,文案 |
| fresh_poster | campus | 100 | 春秋 | 宣传,绘图,摊位 |
| regular_meeting | campus | 0 | 全年 | 主持,组织 |
| tea | campus | 50 | 春秋冬 | 主持,组织 |
| seminar | content | 0 | 全年 | 文案,主持,日语 |
| online_game | rest | 0 | 全年 | 主持 |
| mascot_goods | content | 100 | 全年 | 绘图,排版,宣传 |
| magazine | content | 200 | 夏秋冬 | 文案,排版,校对,绘图 |
| joint | external | 60 | 全年 | 组织,主持,宣传 |
| booth | external | 300 | 夏冬 | 摊位,宣传,组织 |
| vn | creative | 120 | 夏秋冬 | 脚本,绘图,音乐,前端 |
| platform | content | 20 | 全年 | 前端,资料整理,宣传 |
| handover | succession | 0 | 秋冬 | 资料整理,组织 |
| funding | campus | 0 | 春秋冬 | 文案,组织 |
| rest | rest | 0 | 全年 | 休整 |

### 3.2 行动数值效果

| 行动 | stats | res | culture | fatigue | heat |
|---|---|---|---|---|---|
| campus_wall | part+5, org+1 | fame+6, pressure+2 | campus+3 | 5 | 3 |
| fresh_poster | part+7, exec+4, org+2 | fame+12, pressure+6, credit+1 | campus+5, tradition+1 | 10 | 5 |
| regular_meeting | org+4, part+4, succession+1 | pressure-2, credit+1 | campus+1, archive+1 | 4 | 2 |
| tea | part+8, org+2, succession+2 | fame+3, pressure-2, credit+2 | campus+4 | 6 | 5 |
| seminar | content+7, part+4, exec+3 | influence+5, pressure+3, fame+2 | archive+2, campus+1 | 7 | 4 |
| online_game | part+6, org+1 | pressure-8, fame+1 | campus+2 | -4 | 4 |
| mascot_goods | content+5, part+3, exec+3 | fame+6, influence+6, pressure+4 | tradition+3, publication+2 | 8 | 5 |
| magazine | content+10, external+5, exec+4 | fame+8, influence+10, relations+5, pressure+14 | publication+7, archive+3, alliance+2 | 18 | 4 |
| joint | external+11, exec+4, part+2 | fame+8, relations+13, pressure+9 | alliance+7, archive+1 | 12 | 5 |
| booth | external+10, exec+8, content+4 | fame+15, relations+10, pressure+16, credit+3 | publication+7, alliance+4 | 20 | 6 |
| vn | content+10, exec+6, part+3 | influence+10, fame+6, pressure+12 | creative+8, archive+1 | 16 | 7 |
| platform | content+7, external+4, org+4 | fame+5, influence+5, pressure+5 | archive+5, alliance+2 | 10 | 3 |
| handover | succession+10, org+4, content+3 | pressure+1, credit+2 | archive+6 | 8 | 1 |
| funding | org+4, exec+2 | funds+160, pressure+3, credit+2 | 无 | 4 | 0 |
| rest | 无 | pressure-7 | 无 | 0（另恢复全员疲劳） | 1 |

### 3.3 适配度公式

```
matchBonus: 每匹配一个 tag → +1；技能匹配 → +2
detailSupport: sum(action's detail keys) / (keys.length * 100)，兜底 0.45

fit = clamp(20 + match * 14 + support * 45 + (capacity(member) - 50) * 0.45)
```

适配度范围 0–100，影响 stat 乘数和 detail bump。

### 3.4 策略倍率

| 策略 | res 倍率 | fatigue 倍率 | culture 倍率 | project load 增量 |
|---|---|---|---|---|
| balanced | 1.0 | 1.0 | 1.0 | +2 |
| aggressive | 1.18 | 1.15 | 1.1 | +4 |
| safe | 0.88 | 0.85 | 1.0 | +1 |

### 3.5 技能系统

| 技能ID | 名称 | 冷却 | 适用行动 | 效果 |
|---|---|---|---|---|
| ice | 破冰主持 | 3周 | campus_wall, fresh_poster, regular_meeting, tea, online_game | part+4, detail新入+4/聊天+3, common活跃+2/心情+4/疲劳-2, member信任+2/疲劳-2 |
| archive | 文献档案 | 3周 | seminar, magazine, platform, handover, twelve | content+4, succession+2, detail档案+5/文档+4/文章+3, project质量+7/风险-4, member成长+2 |
| layout | 版面急救 | 4周 | magazine, mascot_goods, fresh_poster, booth | exec+3, content+2, detail设计+5/物料+4, project质量+8/风险-6/负荷-2, pressure-2 |
| proto | 原型冲刺 | 4周 | vn, platform | content+3, exec+2, detail产出+6/平台+3, project进度+9/质量+3/负荷+2, member疲劳+3/成长+3 |
| booth | 摊位统筹 | 4周 | booth, fresh_poster, festival | exec+4, detail物料+4/规划+3, pressure-3, funds+45, project进度+4/风险-5 |
| succ | 接班火种 | 3周 | handover, regular_meeting, tea, farewell | succession+5, org+2, detail新人+5/权限+4/文档+3, common活跃+1/心情+3, member成长+3 |

---

## 四、大型企划系统

### 4.1 企划定义

| ID | 标题 | 初始进度 | 初始质量 | 初始负荷 | 耗时参考 |
|---|---|---|---|---|---|
| magazine | 社刊/联合刊物 | 28 | 12 | 16 | ~4–5周 |
| alliance | 跨校联合企划 | 30 | 8 | 12 | ~3–4周 |
| booth | 展会出摊 | 34 | 10 | 18 | ~3–4周 |
| vn | 原创短篇 VN | 25 | 12 | 14 | ~4–6周 |
| handover | 交接包 | 30 | 8 | 8 | ~2–3周 |

### 4.2 推进公式

```
每执行一次关联行动（startOrAdvanceProject）:
  已有企划 → progress += round(10 + fit * 0.08)
              quality += round(9)
              load += round(2 + policyBonus), 上限100
  技能加成 → 叠加 skillPack.project 中的值
```

### 4.3 风险公式

```
projectRisk = clamp(
  load * 2.1
  + pressure * 0.35
  + avgFatigue * 0.28
  - org * 0.22
  - exec * 0.18
  - quality * 0.15
)
risk > 78 → quality -= 2，有 35% 概率 pressure += 2
```

### 4.4 完成奖励

```
progress >= 100 → done = true
  fame += 8, influence += 8, credit += 2
  external分类 → relations += 5
  pressure -= 4
  booth → funds += 120
  vn/magazine → content += 4, 否则 +2
  external → external += 3
  handover → succession += 5
  记录到 s.stats.__completed
```

---

## 五、个人剧情系统

### 5.1 触发条件

| 角色 | 剧情ID | 条件 | 说明 |
|---|---|---|---|
| 杏子 | kyoko_1 | trust≥60, heat≥60, week≥12, week≤30 | 副会长的疑虑 |
| 杏子 | kyoko_2 | trust≥75, heat≥70, week≥32, 未解决 | 交接前的夜谈 |
| 杏子 | kyoko_3 | trust≥80, heat≥70, week≥40, 已解决 | 毕业交接仪式 |
| 液泡眼 | laypark_1 | trust≥50, growth≥55, week≥14, week≤28 | 沉默的伙伴 |
| 液泡眼 | laypark_2 | growth≥65, platform≥40, week≥30 | 平台重构计划 |
| 花田 | hanata_1 | trust≥55, growth≥55, archive≥40, week≥20 | 档案角的常客 |
| 花田 | hanata_2 | growth≥60, archive≥50, week≥35, 已解决 | 文档体系蓝图 |
| 老社长 | ob_1 | trust≥65, heat≥60, week≥30 | 毕业前的话 |
| 老社长 | ob_2 | week≥42 | 最后的留言 |
| 白纸 | baizhi_1 | growth≥45, week≥6, week≤16 | 第一份看板 |
| 白纸 | baizhi_2 | growth≥55, week≥28 | 独立负责看板 |
| 北窗 | beichuang_1 | growth≥40, heat≥55, week≥18, week≤34 | 脚本的第一次 |
| 北窗 | beichuang_2 | heat≥65, week≥32, 已解决 | 试读反馈之后 |

### 5.2 剧情效果

每个选项对应 eventHandlers.js 中的函数，效果包括：
- 成员属性调整（trust/heat/fatigue/growth）
- 资源调整（pressure/fame/relations等）
- 文化值调整
- detail 调整
- stat 调整
- `__arcsResolved` 标记完成

---

## 六、随机事件系统

### 6.1 事件池

| 标题 | 选项A(效果) | 选项B(效果) |
|---|---|---|
| 投稿进度告急 | 延期：pressure-2, docs+2, archive+1 | 删减：pressure+2, credit+1, progress+10, quality-2, load-2 |
| 核心成员低落 | 缓一下：fatigue-12, heat+4, pressure-4 | 继续推：fatigue+8, pressure+5 |
| 外校联动邀请 | 接下：external+4, exec+1, relations+6, pressure+4, fame+2, alliance+4 | 婉拒：org+2, succession+1, pressure-2 |
| 校园文化节 | 接下：fame+4, credit+1, pressure+4, external+2, campus+2 | 婉拒：pressure-3 |
| 经费审查 | 认真整理：pressure+3, credit+4, detail财务+5/合规+4/文档+2, org+2 | 让财务处理：pressure+1, detail合规+1 |
| 成员流失预警 | 挽留：pressure+3, fame-1, active+2, mood+3 | 放宽考勤：pressure-2, active-2, newcomer-1 |
| 服务器宕机 | 自己修：pressure+6, fame-2, detail平台-3, mood-4 | 找IT：pressure+2, detail平台+1/文档+2 |
| 漫展合作 | 参加：fame+6, relations+4, pressure+6, funds-80, external+3, exec+1, publication+3 | 推荐：relations+3 |

### 6.2 触发概率

```
chance = 0.16 + pressure/300 + (week%8===0 ? 0.08 : 0)
```

- 基础 16%，压力 100 时约 0.49%，每 8 周额外 +8%
- 有 pendingArc 或 event 时不会触发

---

## 七、成就系统

| ID | 标题 | 条件 |
|---|---|---|
| first_recruit | 初次招新 | 首位新核心加入 |
| magazine_done | 刊物出师 | 完成社刊 |
| vn_done | 原创短篇 | 完成 VN |
| booth_done | 展会出征 | 完成出摊 |
| joint_done | 跨校之桥 | 完成联合企划 |
| handover_done | 薪火相传 | 完成交接包 |
| flawless_term | 无烧一学期 | 学期末燃尽风险 < 30 |
| full_roster | 满员社团 | 核心成员 ≥ 7 |
| culture_specialist | 文化匠人 | 任一文化 ≥ 50 |
| route_balance | 六边形会长 | 六维均 ≥ 50 |
| comeback | 逆风翻盘 | 压力≥80后回落到≤30 |
| arc_kyoko/arc_laypark/... | 角色剧情 | 对应角色剧情完成 |
| legacy_first | 第一份传承 | 完成学年并生成继承档案 |

---

## 八、结局系统

| 结局 | 条件 | 说明 |
|---|---|---|
| 传承之道 | archive≥10, management≥8, culture.archive≥12 | 默认兜底结局 |
| 创作之光 | creative≥12, (culture.creative≥12 或 creative≥16) | 侧重原创 |
| 连接之网 | network≥12, culture.alliance≥10 | 侧重跨校 |
| 校园之根 | culture.campus≥18 | 侧重校内 |
| 六边形之路 | 六维均 ≥ 50 | 均衡发展 |
| 燃尽之终 | common.fatigue≥80 或 archive===0 | 负面结局 |

`pickEnding` 按数组顺序返回第一个匹配的结局。优先顺序：传承 → 创作 → 连接 → 校园 → 六边形 → 燃尽。

---

## 九、继承系统

```
legacy.points = floor((succession + content + archive + alliance) / 10)
legacy.archive  = floor((detail.archive + detail.docs) / 20)
legacy.network  = floor((relations + detail.crossTrust + detail.platform) / 30)
legacy.management = floor((org + detail.finance + detail.division) / 25)
legacy.creative = floor((content + culture.creative + detail.projectOutput) / 25)
```

新游戏 applyLegacy:
- detail 提升（archive/docs/platform/schoolLink/division/finance/juniors/projectOutput/design）
- 资源奖励（funds=management*8, relations=network*2, fame=network*1.2, credit=archive）
- newcomer += floor(archive/2)

---

## 十、Detail 子系统

### 10.1 24 个 detail 键

| 统计 | 包含键 |
|---|---|
| org 组织稳定度 | schedule, division, finance, compliance |
| exec 活动执行力 | planning, materials, publicity, offline |
| part 成员参与度 | newcomer, retention, chat, review |
| content 内容沉淀力 | articles, archive, design, projectOutput |
| external 外部连接力 | crossTrust, eventLink, platform, schoolLink |
| succession 传承持续力 | docs, juniors, permission, obSupport |

detail 初始值在 10–34 之间，`summarizeDetail` 对每个 stat 取其 4 个 detail 键的均值。

### 10.2 学期边界

| Week | 事件 |
|---|---|
| 17 (春学期末) | 学期报告，燃尽判定 |
| 25 (暑假末) | 阶段报告，燃尽判定 |
| 41 (秋学期末) | 学期报告，燃尽判定 |
| 49 (学年末) | 学年总结 → 游戏结束 → 继承档案 |

`burn = clamp(pressure * 0.42 + avgFatigue * 0.58)`，`burn < 30` 视作无燃学期。

---

## 十一、公共成员池

| 属性 | 初始值 | 说明 |
|---|---|---|
| total | 18 | 总人数 |
| active | 7 | 活跃成员数 |
| newcomer | 5 | 新人观察数 |
| mood | 55 | 群体心情 0–100 |
| fatigue | 18 | 群体疲劳 0–100 |

### 每周变化

```
total += max(0, round((fame + publicity - 30) / 35)) + (校园墙/迎新 ? rand(0,2) : 0)
active += round(action.stats.part/5) + (online_game ? +2 : 0) - (pressure>74 ? 2 : 0)
newcomer += (campus_wall/fresh_poster/tea ? +4 : regular_meeting ? +2 : 0) - (booth ? 1 : 0)
mood += round(heat * 1.1) - (pressure>78 ? 5 : 0)
fatigue += max(0, round(fatigueDelta * 0.55)) - (rest/online_game ? 8 : 0)
```

### 招新触发

```
chance = (newcomer*0.22 + fame*0.25 + common.newcomer*0.32 + mood*0.12) / 100
if (campus_wall/fresh_poster/tea/regular_meeting && recruitPool.length && random < chance*0.28)
  → 招募新核心成员
```
