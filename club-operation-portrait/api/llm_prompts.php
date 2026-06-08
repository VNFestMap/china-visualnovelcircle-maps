<?php
/**
 * LLM Prompt 模板 — 同好会运行画像分析
 *
 * 提供构建分析 prompt 和修正 prompt 的函数。
 * 所有 prompt 设计为引导 LLM 输出结构化 JSON。
 */

/**
 * 构建初始分析 prompt
 *
 * @param array $basicInfo 同好会基本信息
 * @param array $dimensions 各维度详细数据
 * @param array $baseScores 前端的原始评分（0-100）
 * @return string 完整的 user prompt
 */
function buildAnalysisPrompt(array $basicInfo, array $dimensions, array $baseScores): string {
    $dimText = buildDimensionText($dimensions);

    $scoresText = '';
    $dimLabels = [
        'organization_stability' => '组织稳定度',
        'activity_execution' => '活动执行力',
        'member_scale_participation' => '成员规模与参与度',
        'content_accumulation' => '内容沉淀力',
        'external_connection' => '外部连接力',
        'continuity' => '传承持续力',
    ];
    foreach ($baseScores as $key => $score) {
        $label = $dimLabels[$key] ?? $key;
        $scoresText .= "- {$label}: {$score}分\n";
    }

    $info = $basicInfo;
    return <<<PROMPT
## 同好会基本信息
- 名称：{$info['club_name']}
- 学校：{$info['school_name']}
- 城市：{$info['city']}
- 成立年份：{$info['founded_year']}
- 一句话介绍：{$info['short_intro']}

## 各维度数据和前端基础评分

{$dimText}

## 前端基础评分（供参考，可在此基础上调整）
{$scoresText}

## 画像原则
- 这是运行画像，不是排行榜，也不是强弱评比。
- 不要使用“强/弱排名”“更强/更弱”“领先/落后”“吊打/碾压”等比较语言。
- 不要因为成员人数少、学校规模小、成立时间短就直接判定低评价。
- 成员规模只作为背景；优先关注活跃比例、组织结构、活动执行、内容沉淀、外部连接和传承风险。
- 信息不足时不要编造事实；在初始阶段提出追问，在最终修正阶段降低 confidence 或保持 score_adjustment 为 0。

## 任务

请分析该同好会的运行状态，严格按照以下 JSON 格式输出，不要包含其他内容：

{
  "score_adjustment": {
    "organization_stability": 整数(-10~+10),
    "activity_execution": 整数(-10~+10),
    "member_scale_participation": 整数(-10~+10),
    "content_accumulation": 整数(-10~+10),
    "external_connection": 整数(-10~+10),
    "continuity": 整数(-10~+10)
  },
  "dimension_analysis": {
    "organization_stability": "分析文本",
    "activity_execution": "分析文本",
    "member_scale_participation": "分析文本",
    "content_accumulation": "分析文本",
    "external_connection": "分析文本",
    "continuity": "分析文本"
  },
  "strengths": ["优势1", "优势2"],
  "risks": ["风险1", "风险2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "summary": "总体评价（一句话概括）",
  "follow_up_questions": [
    {
      "id": "q1",
      "question": "追问的问题内容",
      "target_dimension": "关联维度key",
      "input_type": "textarea",
      "reason": "为什么需要追问"
    }
  ]
}

## 评分调整规则
- score_adjustment 范围 -10 到 +10，0 表示不需要调整
- 基于"补充说明"文本对基础评分进行微调
  - 文本描述与数据一致 → ±0~2
  - 文本揭示数据未反映的运行风险 → -3~-10
  - 文本显示实际运行更稳定、更有持续性或更有协作结构 → +3~+10
- 不要因为人数少直接下调；人数少但活跃比例高、分工清楚、活动稳定时不应负向修正
- 信息不足时不要硬调分，score_adjustment 保持 0，并在分析中说明不确定性
- 六个维度的调整要基于证据，避免总偏差过大

## 追问规则
- 提 3-5 个需要澄清的问题
- 仅当数据中存在矛盾、模糊或不明确之处时提问
- 如果数据清晰完整，返回空数组 []
- 每个问题需指定 target_dimension（关联到六个维度之一）
- 追问的目的：获取无法从表单数据中直接判断、且会影响画像判断的关键信息
- 优先追问活跃比例、组织结构、活动执行、内容沉淀、外部连接和传承风险
- 对开放问答内容先理解，再拆成具体维度追问；不要重复询问已经明确给出的内容
PROMPT;
}

/**
 * 构建含追问的修正 prompt
 *
 * @param array $basicInfo 同好会基本信息
 * @param array $dimensions 各维度详细数据
 * @param array $baseScores 前端的原始评分
 * @param array $followUpAnswers 用户对追问的回答
 * @return string 完整的 user prompt
 */
function buildCorrectionPrompt(array $basicInfo, array $dimensions, array $baseScores, array $followUpAnswers): string {
    $basePrompt = buildAnalysisPrompt($basicInfo, $dimensions, $baseScores);

    $answersText = '';
    foreach ($followUpAnswers as $id => $answer) {
        $answersText .= "- {$id}: {$answer}\n";
    }

    return <<<PROMPT
{$basePrompt}

## 补充信息（用户对追问的回答）

{$answersText}

请结合以上补充信息，重新进行评估，输出修正后的完整 JSON。
这次 follow_up_questions 请务必返回空数组 []。
最终报告仍然是运行画像，不是排名或强弱评比；如果补充信息仍不足，请降低 revised_scores 的 confidence，不要编造确定结论。
PROMPT;
}

/**
 * 构建各维度文本描述（供 prompt 使用）
 */
function buildDimensionText(array $dimensions): string {
    $parts = [];

    $config = [
        'organization_stability' => [
            'label' => '组织稳定度',
            'fields' => ['total_members', 'core_members', 'managers_count'],
            'fieldLabels' => ['总成员数', '核心成员数', '管理员人数'],
            'choices' => [
                'has_clear_leader' => '有明确负责人',
                'has_core_group' => '有核心组',
                'has_fixed_channel' => '有固定交流渠道',
                'has_task_division' => '有基本分工',
            ],
            'management_mode' => [
                'single_leader' => '单人负责',
                'small_core_group' => '小型核心组',
                'distributed_team' => '分散协作',
                'loose_interest_group' => '松散兴趣组',
            ],
            'textKey' => 'os_text',
        ],
        'activity_execution' => [
            'label' => '活动执行力',
            'fields' => ['activities_last_3_months', 'activities_last_12_months', 'average_participants', 'largest_activity_participants'],
            'fieldLabels' => ['近3个月活动数', '近12个月活动数', '平均参与人数', '最大活动参与人数'],
            'choices' => [
                'has_event_plan' => '有活动策划习惯',
                'has_event_review' => '有活动复盘习惯',
            ],
            'frequency' => [
                'none' => '基本不办',
                'occasional' => '偶尔办',
                'semester' => '每学期几次',
                'monthly' => '每月都有',
                'high_frequency' => '高频（每周/双周）',
            ],
            'stability' => [
                'often_cancelled' => '经常取消',
                'sometimes_completed' => '有时能办成',
                'mostly_completed' => '大部分能办成',
                'stable' => '稳定执行',
            ],
            'textKey' => 'ae_text',
        ],
        'member_scale_participation' => [
            'label' => '成员规模与参与度',
            'fields' => ['total_members', 'active_members', 'core_members', 'average_activity_attendance', 'members_helped_operations', 'members_submitted_content'],
            'fieldLabels' => ['总成员数', '活跃成员数', '核心成员数', '平均活动参与人数', '协助事务成员数', '投稿成员数'],
            'activityLevel' => [
                'low' => '低',
                'medium' => '中',
                'high' => '高',
            ],
            'participationPattern' => [
                'leader_only' => '只有负责人在做事',
                'core_members_only' => '核心成员在做事',
                'core_plus_some' => '核心+部分成员',
                'broad_participation' => '广泛参与',
            ],
            'integration' => [
                'difficult' => '比较困难',
                'depends_on_acquaintance' => '看熟人关系',
                'has_basic_path' => '有基本融入路径',
                'clear_path' => '有清晰的新人引导',
            ],
            'textKey' => 'mp_text',
        ],
        'content_accumulation' => [
            'label' => '内容沉淀力',
            'fields' => ['articles_count', 'event_reports_count', 'publication_submissions_count', 'visual_materials_count'],
            'fieldLabels' => ['专栏/文章数', '活动总结数', '刊物投稿数', '海报/宣传图数'],
            'choices' => [
                'has_public_archive' => '有公开内容归档',
                'has_representative_work' => '有代表性成果',
            ],
            'outputFrequency' => [
                'none' => '基本没有',
                'occasional' => '偶尔产出',
                'regular' => '定期产出',
                'active' => '活跃产出',
            ],
            'textKey' => 'ca_text',
        ],
        'external_connection' => [
            'label' => '外部连接力',
            'fields' => ['joint_projects_participated', 'joint_projects_initiated', 'partner_clubs_count', 'external_events_count'],
            'fieldLabels' => ['参与联合企划数', '发起联合企划数', '合作同好会数量', '外部活动参与数'],
            'choices' => [
                'has_external_contact_person' => '有对外联系人',
            ],
            'network' => [
                'none' => '基本没有',
                'few_private_contacts' => '少数私人联系',
                'stable_partners' => '稳定合作伙伴',
                'wide_network' => '广泛合作网络',
            ],
            'willingness' => [
                'not_now' => '暂不考虑',
                'interested_but_inexperienced' => '有兴趣但没经验',
                'willing_to_join' => '愿意参与',
                'willing_to_initiate' => '愿意发起',
            ],
            'textKey' => 'ec_text',
        ],
        'continuity' => [
            'label' => '传承持续力',
            'fields' => ['active_years', 'leadership_transition_count'],
            'fieldLabels' => ['连续活跃年数', '换届次数'],
            'choices' => [
                'has_completed_transition' => '已完成过换届',
                'has_handover_docs' => '有交接文档',
                'has_history_records' => '有历史记录',
                'has_yearly_basic_activity' => '每年有基本活动',
            ],
            'dependence' => [
                'very_high' => '非常依赖',
                'high' => '比较依赖',
                'medium' => '一般',
                'low' => '不依赖',
            ],
            'risk' => [
                'high' => '高风险',
                'medium' => '中等风险',
                'low' => '低风险',
            ],
            'textKey' => 'co_text',
        ],
    ];

    foreach ($config as $key => $cfg) {
        $dim = $dimensions[$key] ?? null;
        if (!$dim) continue;

        $text = "### {$cfg['label']}\n";

        // 数字字段
        $numeric = $dim['numeric'] ?? [];
        foreach ($cfg['fields'] as $i => $field) {
            $val = $numeric[$field] ?? 0;
            $text .= "- {$cfg['fieldLabels'][$i]}: {$val}\n";
        }

        // 复选框选择
        $choices = $dim['choice'] ?? [];
        foreach ($cfg['choices'] ?? [] as $cKey => $cLabel) {
            $text .= "- {$cLabel}: " . (!empty($choices[$cKey]) ? '是' : '否') . "\n";
        }

        // 特殊选择字段
        if (isset($cfg['management_mode']) && !empty($choices['management_mode'])) {
            $mode = $choices['management_mode'];
            $text .= "- 管理模式: " . ($cfg['management_mode'][$mode] ?? $mode) . "\n";
        }
        if (isset($cfg['frequency']) && !empty($choices['activity_frequency'])) {
            $freq = $choices['activity_frequency'];
            $text .= "- 活动频率: " . ($cfg['frequency'][$freq] ?? $freq) . "\n";
        }
        if (isset($cfg['stability']) && !empty($choices['execution_stability'])) {
            $st = $choices['execution_stability'];
            $text .= "- 执行稳定性: " . ($cfg['stability'][$st] ?? $st) . "\n";
        }
        if (isset($cfg['activityLevel']) && !empty($choices['member_activity_level'])) {
            $lv = $choices['member_activity_level'];
            $text .= "- 活跃度: " . ($cfg['activityLevel'][$lv] ?? $lv) . "\n";
        }
        if (isset($cfg['participationPattern']) && !empty($choices['participation_pattern'])) {
            $pp = $choices['participation_pattern'];
            $text .= "- 参与模式: " . ($cfg['participationPattern'][$pp] ?? $pp) . "\n";
        }
        if (isset($cfg['integration']) && !empty($choices['new_member_integration'])) {
            $ni = $choices['new_member_integration'];
            $text .= "- 新成员融入: " . ($cfg['integration'][$ni] ?? $ni) . "\n";
        }
        if (isset($cfg['outputFrequency']) && !empty($choices['output_frequency'])) {
            $of = $choices['output_frequency'];
            $text .= "- 产出频率: " . ($cfg['outputFrequency'][$of] ?? $of) . "\n";
        }
        if (isset($cfg['network']) && !empty($choices['collaboration_network'])) {
            $cn = $choices['collaboration_network'];
            $text .= "- 合作网络: " . ($cfg['network'][$cn] ?? $cn) . "\n";
        }
        if (isset($cfg['willingness']) && !empty($choices['willingness_for_future_collab'])) {
            $wl = $choices['willingness_for_future_collab'];
            $text .= "- 合作意愿: " . ($cfg['willingness'][$wl] ?? $wl) . "\n";
        }
        if (isset($cfg['dependence']) && !empty($choices['dependence_on_single_person'])) {
            $dp = $choices['dependence_on_single_person'];
            $text .= "- 对负责人依赖度: " . ($cfg['dependence'][$dp] ?? $dp) . "\n";
        }
        if (isset($cfg['risk']) && !empty($choices['continuity_risk_self_assessment'])) {
            $rk = $choices['continuity_risk_self_assessment'];
            $text .= "- 传承风险自评: " . ($cfg['risk'][$rk] ?? $rk) . "\n";
        }

        // 补充说明文本
        $textKey = $cfg['textKey'] ?? '';
        if ($textKey && !empty($dim['text'])) {
            $text .= "- 补充说明: {$dim['text']}\n";
        }

        $parts[] = $text;
    }

    return implode("\n", $parts);
}

/**
 * 构建追问策略指导
 *
 * 引导 LLM 针对同好会发展的各维度提出有洞察力的追问，
 * 避免泛泛而谈，聚焦数据中隐含的矛盾、风险和提升空间。
 */
function buildFollowUpStrategyPrompt(): string {
    return <<<STRATEGY
## 追问策略指南

你不是在泛泛提问，而是像一个有经验的社团顾问一样，基于已有数据中的矛盾、缺口或异常信号进行定向追问。

### 各维度追问切入点

**组织稳定度**
- 核心成员流动情况：数据中有核心成员数，但 turnover 如何？是否过于依赖特定个人？
- 决策效率：有管理层人数，但是否存在决策僵化或权责不清的风险？

**活动执行力**
- 活动质量 vs 数量：活动数量可观，但参与率是否在下降？是否有活动"办了但没人来"的情况？
- 活动类型单一性：是否只办同一类活动？是否有成员兴趣多样化的需求未被满足？

**成员规模与参与度**
- "沉默成员"比例：总成员 vs 活跃成员的差距是否在扩大？非活跃成员是否有流失风险？
- 参与深度：成员是被动参加还是主动贡献？是否有从"参与者"到"贡献者"的转化路径？

**内容沉淀力**
- 产出连续性：内容产出是否集中在少数人身上？如果这些成员毕业，内容产出是否会断档？
- 归档可访问性：有归档习惯，但归档内容是否真正被后续成员使用和参考？

**外部连接力**
- 合作的实质深度：合作次数不少，但合作质量如何？是否停留在"挂名"层面？
- 外部资源获取：是否有从外部合作中获得实质资源（资金、场地、指导）的能力？

**传承持续力**
- 隐性知识流失：有交接文档，但那些"只可意会"的运作经验是否被传承？
- 创新 vs 守成：换届后是否出现了活力下降，还是新团队带来了新思路？

### 提问原则
1. 每次提问聚焦一个具体的矛盾或风险信号
2. 优先选择与评分最低的 2-3 个维度相关的问题
3. 避免问表单中已经明确提供的信息
4. 如果数据充分且无明显矛盾，不需要为了凑数而提问
STRATEGY;
}
