# 同好会运行画像生成器

> 通过几个简单问题，生成同好会的六维运行画像。

高校视觉小说同好会的轻量自我观察工具。填写同好会的现实运行情况，系统生成六维雷达图、规模概览、优势风险分析和改进建议。

**这不是社团管理系统，也不是排行榜。** 该工具仅用于观察同好会运行状态，不用于排名或比较。

## 六维指标

| 维度 | 关注点 |
| --- | --- |
| 组织稳定度 | 有没有稳定的组织骨架 |
| 活动执行力 | 事情能不能办成 |
| 成员规模与参与度 | 成员是否真实参与 |
| 内容沉淀力 | 做过的事情有没有留下成果 |
| 外部连接力 | 能不能和校外/跨校产生联系 |
| 传承持续力 | 未来能不能延续 |

## 快速开始

```bash
cd club-operation-portrait
php -S 127.0.0.1:8001
```

打开 http://127.0.0.1:8001

## 项目结构

```
.
├── index.html          主页面（表单 + 结果展示）
├── css/style.css       样式（暗色/亮色主题，响应式）
├── js/app.js           前端逻辑（表单、步骤导航、评分、雷达图、分享、AI 顾问流程）
├── api/index.php        API 接口（llm-correction/start、llm-correction/complete、兼容 analyze/correct、prefill）
├── api/llm_client.php   LLM API 客户端（支持 DeepSeek / OpenAI / Claude）
├── api/llm_prompts.php  分析 Prompt 模板
├── README.md           本文件
├── package.json        项目元数据
└── .gitignore          忽略规则
```

## 评分规则

每个维度 0-100 分，由数字数据基础分 + 状态选择修正分组成：

| 等级 | 分数范围 |
| --- | --- |
| 成熟稳定 | 80-100 |
| 良好 | 60-79 |
| 发展中 | 40-59 |
| 待补足 | 20-39 |
| 待补充 | 0-19 |

## API 接口

支持通过 `?action=` 参数区分路由。AI 顾问流程拆成两步：先生成追问，再根据补充答案生成修正分析。旧的 `analyze` / `correct` 入口保留为兼容别名。

### POST ?action=llm-correction/start — 生成 AI 顾问追问

提交同好会数据和本地基础评分，只返回 3-5 个结构化追问，不返回完整顾问报告或评分修正。前端会先展示本地基础画像，再在结果区展示这些追问。

**请求格式：**

```json
{
  "basic_info": { "club_name": "...", "school_name": "...", "city": "...", "founded_year": 2023, "short_intro": "..." },
  "dimensions": { ... },
  "base_scores": { "organization_stability": 78, "activity_execution": 82, ... }
}
```

**响应格式：**

```json
{
  "follow_up_questions": [
    {
      "id": "q1",
      "question": "追问内容",
      "target_dimension": "organization_stability",
      "input_type": "textarea",
      "reason": "为什么需要补充"
    }
  ],
  "message": "已生成补充问题。",
  "llm_available": true,
  "llm_error": false
}
```

### POST ?action=llm-correction/complete — 生成顾问修正分析

在回答完追问后提交，返回顾问摘要、优势、风险、建议、画像变化和评分修正。评分修正会经过后端校验，超出允许范围的维度修正会被丢弃。

**请求格式：**

```json
{
  "basic_info": { ... },
  "dimensions": { ... },
  "base_scores": { ... },
  "initial_llm_result": { "follow_up_questions": [ ... ] },
  "follow_up_answers": { "q1": "用户的回答" }
}
```

**响应格式：**

```json
{
  "advisor_summary": "顾问修正后的总体判断",
  "evaluation_summary": {
    "portrait_label": "小规模高参与型",
    "one_sentence": "一句话画像总结",
    "current_state": "当前可观察到的运行状态",
    "key_observation": "最关键的证据",
    "next_step": "下一步建议",
    "confidence": 0.7
  },
  "advantages": ["优势1", "优势2"],
  "risks": ["风险1", "风险2"],
  "recommendations": ["建议1", "建议2"],
  "classification_change": "画像变化说明",
  "revised_scores": [
    {
      "dimension": "organization_stability",
      "original_score": 78,
      "revised_score": 82,
      "delta": 4,
      "confidence": 0.7,
      "reason": "修正原因"
    }
  ],
  "follow_up_questions": [],
  "llm_available": true,
  "llm_error": false
}
```

### 兼容入口

- `POST ?action=analyze`：等同于 `llm-correction/start`，仅生成追问。
- `POST ?action=correct`：等同于 `llm-correction/complete`，生成最终顾问修正分析。

### LLM 降级与日志

LLM 未配置、接口超时、输出过长或 JSON 解析失败时，接口返回 `llm_available: false` 和清晰的 `message`。前端会保留本地基础画像，并显示“AI 顾问暂不可用，本地画像已生成”，不会展示假的顾问评分行。

后端会将问卷快照、LLM 请求、原始响应、解析结果、`finish_reason`、HTTP 状态和错误类型写入 `api/logs/*.jsonl`。日志 ID 和 API key 不会返回给前端。

### GET ?action=prefill — 获取预填数据

获取当前登录用户的同好会信息，用于自动填写表单。

**响应格式：**

```json
{
  "user": { "id": 1, "nickname": "..." },
  "club": {
    "display_name": "同好会名称",
    "school": "学校",
    "province": "省份",
    "city": "城市",
    "founded_year": 2023,
    "remark": "简介"
  }
}
```

未登录或无同好会时，`user` 和 `club` 返回 `null`。

### LLM 配置

在 `config.php` 中配置：

```php
define('LLM_ENABLED', false);        // 是否启用 LLM
define('LLM_PROVIDER', 'deepseek');  // deepseek / openai / claude
define('LLM_API_KEY', 'sk-...');     // API 密钥
define('LLM_MODEL', 'deepseek-chat');
```

LLM 未配置或不可用时，系统自动降级为前端独立评分和分析。

## 设计原则

- **不做排名**：只生成运行画像，不显示排名
- **不绑定网站活跃度**：关注现实运行情况，而非网站互动行为
- **不要求完全精确**：临时 Demo，不需要填写非常严格的数据

## License

GPLv3
