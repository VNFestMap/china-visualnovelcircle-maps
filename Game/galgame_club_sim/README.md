# Galgame同好会模拟器 Demo v7 Soft UI

基于 v6 的工程化重写版,采用 Vite + ES Modules 拆分代码,新增成就/角色个人剧情/多结局机制,加强 a11y 与状态可视化。

## 使用方式

```bash
npm install
npm run dev   # 开发模式,自动打开 http://localhost:5173
npm run build # 生产构建,输出到 dist/
npm run preview
npm test      # 结算与平衡回归测试
npm run simulate # 运行 1000 组固定种子平衡模拟
```

## v7.2 流程与数值平衡

- 免费行动按现实现金支出处理：校园墙招新、线上例会、线上团建、作品研讨、交接和休整不扣经费，但仍消耗时间或疲劳。
- 经费来源不再只有申请：制品销售即时回收部分成本，社刊、展会、VN 和跨校企划完成时结算销售或合作回款。
- 跨周企划首次支付完整预算，后续推进仅支付 20% 追加成本。
- 申请经费收入 160，冷却 8 周；已完成企划本学年不能重复执行。
- 修复技能冷却、Detail 覆盖 Stats、项目风险修正、季节被动重复触发和结局顺序抢占。
- 新增“维持之年”中性结局，并按实际路线成果评分选择正面结局。

也可以直接打开 `dist/index.html`(构建后)预览生产版本。

## v7 重点更新

### 工程化

- 原 68KB 单文件拆为 Vite 项目:`index.html` 仅 80 行容器,业务代码 47 个 ES Module
- 按 `data/` `state/` `game/` `ui/` `utils/` `styles/` 六个职责目录组织
- CSS 拆分为 4 个模块:`tokens.css`(变量)、`base.css`(重置/背景)、`layout.css`(栅格/响应式)、`components.css`(组件)
- 引入响应式 store + 订阅模式(便于将来加撤销/时光倒流)

### 新功能

- **成就系统**:16 个成就(招新/企划完成/学期无燃/六边形/逆风翻盘/角色剧情完成等),自动扫描解锁,弹窗 + 状态徽章
- **角色个人剧情**:6 名核心成员各 1-2 条剧情线(杏子副会交接、液泡眼前端独白、花田文档心、老社长送别等),触发条件基于角色状态 + 周数,走突发事件通道做选择
- **6 种结局**:传承之道 / 创作之光 / 连接之网 / 校园之根 / 六边形之路 / 燃尽之终,根据文化倾向/六维/继承档案匹配,每种独立文案

### 可访问性 (a11y)

- `#resultBox` `role="status" aria-live="polite"`,`#logList` `role="log" aria-live="polite"`
- 所有行动卡/成员卡/标签加 `aria-label` 含关键数值
- 选中态 `aria-pressed` / `aria-current`,不可用态 `aria-disabled`
- 模态框:打开时记录触发元素,`Tab`/`Shift+Tab` 焦点循环,`Esc` 关闭,关闭时焦点返回
- 隐藏的 announcer 用于向屏幕阅读器播报操作反馈
- `prefers-reduced-motion` 关掉所有过渡动画

### 状态可视化

- 数值不再仅靠颜色,统一用 `<span class="state-pill">` 包裹:图标 + 数字 + 状态文字
- 压力 ≥ 78:顶部 HUD 红色脉冲动画 + 文字 "建议休整,压力过高"
- 行动卡适配度 fit 数字以大字号徽章标在预览区
- 诊断卡(燃尽/招新/承载/交接)用渐变进度条 + 文字提示

## 项目结构

```text
galgame_club_sim/
├── index.html              # slim,只挂载 #app 与 <script type="module">
├── package.json
├── vite.config.js
└── src/
    ├── main.js             # 入口
    ├── styles/             # 4 个 CSS 模块
    ├── data/               # 静态数据(行动/角色/技能/成就/剧情/结局/…)
    ├── state/              # store + persistence + 纯函数 mutations
    ├── game/               # 业务逻辑(week/lifecycle/projects/arcs/achievements)
    ├── ui/                 # 渲染层(13 组件 + render 编排 + modal/result/event)
    └── utils/              # math/format 工具
```

## 当前玩法

- 48 周学年制
- 春学期、暑假、秋学期、寒假(每学期阶段报告)
- 每周行动选择(17 个行动,6 个分类)
- 核心角色卡(6 名)与技能冷却
- 普通成员池
- 大型企划进度(社刊/出摊/跨校/VN/交接)
- 学期报告(4 次) + 学年总结
- 6 种结局 + 继承系统
- 16 个成就 + 6 条角色个人剧情
- 每周可能触发的突发事件(4 种)
- 每周可能触发的角色剧情节拍
