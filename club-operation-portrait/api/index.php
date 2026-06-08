<?php
/**
 * 同好会运行画像生成器 — API 接口
 *
 * 支持三种 action（通过 $_GET['action'] 区分）：
 *
 * POST ?action=analyze
 *   初始 LLM 分析，返回评分修正 + 分析文本 + 追问
 * POST ?action=correct
 *   提交追问答案，返回修正后的最终分析
 * GET  ?action=prefill
 *   获取当前用户的同好会数据用于预填表单
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../../config.php';

require_once __DIR__ . '/llm_client.php';
require_once __DIR__ . '/llm_prompts.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'llm-correction/start':
    case 'analyze':
        handleAnalyze();
        break;
    case 'llm-correction/complete':
    case 'correct':
        handleCorrect();
        break;
    case 'prefill':
        handlePrefill();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => '未知 action，支持: analyze, correct, prefill'], JSON_UNESCAPED_UNICODE);
        exit;
}

// ===== Action Handlers =====

/**
 * 初始 LLM 分析
 * POST { basic_info, dimensions, base_scores }
 */
function handleAnalyze(): void {
    $input = getJsonInput();
    if (!$input || !isset($input['basic_info'], $input['dimensions'], $input['base_scores'])) {
        jsonError('请求体不完整，需要 basic_info, dimensions, base_scores');
        return;
    }

    $client = new LLMClient();

    if (!$client->isAvailable()) {
        jsonResponse(getLlmUnavailableResponse());
        return;
    }

    $systemPrompt = getSystemPrompt();
    $userPrompt = buildFollowUpPrompt($input['basic_info'], $input['dimensions'], $input['base_scores']);

    $messages = [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $userPrompt],
    ];

    $result = $client->chat($messages);

    if ($result === null) {
        $resp = getLlmFailureResponse($client, 'AI 顾问暂不可用，本地画像已生成。');
        writeLlmCorrectionLog('start', $input, $messages, $client->getLastRawResponse(), null, $client->getLastErrorType() ?: 'llm_result_null', $client);
        jsonResponse($resp);
        return;
    }

    $result = normalizeStartResult($result);
    $result['llm_available'] = true;
    $result['llm_error'] = false;
    writeLlmCorrectionLog('start', $input, $messages, $client->getLastRawResponse(), $result, null, $client);
    jsonResponse($result);
}

/**
 * 提交追问答案，获取修正后的分析
 * POST { basic_info, dimensions, base_scores, follow_up_answers }
 */
function handleCorrect(): void {
    $input = getJsonInput();
    if (!$input || !isset($input['basic_info'], $input['dimensions'], $input['base_scores'])) {
        jsonError('请求体不完整，需要 basic_info, dimensions, base_scores');
        return;
    }

    $client = new LLMClient();

    if (!$client->isAvailable()) {
        jsonResponse(getLlmUnavailableResponse());
        return;
    }

    $followUpAnswers = $input['follow_up_answers'] ?? [];

    $systemPrompt = getSystemPrompt();
    $userPrompt = buildCorrectionPrompt(
        $input['basic_info'],
        $input['dimensions'],
        $input['base_scores'],
        $followUpAnswers
    ) . getAdvisorModePrompt(false);

    $messages = [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $userPrompt],
    ];

    $result = $client->chat($messages);

    if ($result === null) {
        $resp = getLlmFailureResponse($client, 'AI 顾问暂不可用，本地画像已生成。');
        writeLlmCorrectionLog('complete', $input, $messages, $client->getLastRawResponse(), null, $client->getLastErrorType() ?: 'llm_result_null', $client);
        jsonResponse($resp);
        return;
    }

    $result = normalizeLlmResult($result, $input['base_scores']);
    $result['follow_up_questions'] = [];
    $result['llm_available'] = true;
    $result['llm_error'] = false;
    writeLlmCorrectionLog('complete', $input, $messages, $client->getLastRawResponse(), $result, null, $client);
    jsonResponse($result);
}

/**
 * 获取当前用户的同好会数据用于预填
 * GET
 */
function handlePrefill(): void {
    $authFile = __DIR__ . '/../../includes/auth.php';
    if (!file_exists($authFile)) {
        jsonResponse(['user' => null, 'club' => null, 'clubs' => [], 'error' => 'auth 系统不可用']);
        return;
    }

    require_once $authFile;
    initSession();
    $user = getCurrentUser();

    if (!$user) {
        jsonResponse(['user' => null, 'club' => null, 'clubs' => []]);
        return;
    }

    // 查询用户的活跃成员身份
    try {
        $db = getDB();
        $stmt = $db->prepare(
            "SELECT club_id, COALESCE(country, 'china') AS country
             FROM club_memberships
             WHERE user_id = ? AND status = 'active'
             ORDER BY joined_at DESC, id DESC"
        );
        $stmt->execute([$user['id']]);
        $memberships = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        jsonResponse(['user' => $user, 'club' => null, 'clubs' => [], 'error' => '数据库查询失败']);
        return;
    }

    if (!$memberships) {
        jsonResponse(['user' => $user, 'club' => null, 'clubs' => []]);
        return;
    }

    $indexes = [
        'china' => loadClubRowsByCountry('china'),
        'japan' => loadClubRowsByCountry('japan'),
    ];

    $clubList = [];
    foreach ($memberships as $membership) {
        $country = ($membership['country'] ?? 'china') === 'japan' ? 'japan' : 'china';
        $clubId = (int)($membership['club_id'] ?? 0);
        if ($clubId <= 0) continue;

        foreach ($indexes[$country] as $club) {
            if ((int)($club['id'] ?? 0) === $clubId) {
                $clubList[] = normalizePrefillClub($club, $clubId, $country);
                break;
            }
        }
    }

    jsonResponse([
        'user' => $user,
        'club' => $clubList[0] ?? null,
        'clubs' => $clubList,
    ]);
}

// ===== Helper Functions =====

function loadClubRowsByCountry(string $country): array {
    $file = $country === 'japan'
        ? __DIR__ . '/../../data/clubs_japan.json'
        : __DIR__ . '/../../data/clubs.json';

    if (!file_exists($file)) {
        return [];
    }

    $payload = json_decode(file_get_contents($file), true);
    if (!is_array($payload)) {
        return [];
    }

    if (isset($payload['data']) && is_array($payload['data'])) {
        return $payload['data'];
    }

    $keys = array_keys($payload);
    $isList = $payload === [] || $keys === range(0, count($payload) - 1);
    return $isList ? $payload : [];
}

function normalizePrefillClub(array $club, int $clubId, string $country): array {
    $foundedYear = null;
    if (!empty($club['created_at'])) {
        $year = (int)substr((string)$club['created_at'], 0, 4);
        if ($year > 1900 && $year <= (int)date('Y')) {
            $foundedYear = $year;
        }
    }

    $province = (string)($club['province'] ?? $club['prefecture'] ?? '');
    $city = (string)($club['prefecture'] ?? $club['province'] ?? '');

    return [
        'club_id' => $clubId,
        'country' => $country,
        'name' => (string)($club['name'] ?? ''),
        'display_name' => (string)($club['display_name'] ?? $club['name'] ?? ''),
        'school' => (string)($club['school'] ?? ''),
        'province' => $province,
        'city' => $city,
        'founded_year' => $foundedYear,
        'remark' => (string)($club['remark'] ?? ''),
    ];
}

function getJsonInput(): ?array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function jsonResponse(array $data): void {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

function jsonError(string $message): void {
    http_response_code(400);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
}

function getZeroAdjustment(string $message = ''): array {
    $zero = [
        'organization_stability' => 0,
        'activity_execution' => 0,
        'member_scale_participation' => 0,
        'content_accumulation' => 0,
        'external_connection' => 0,
        'continuity' => 0,
    ];
    return [
        'score_adjustment' => $zero,
        'dimension_analysis' => [],
        'strengths' => [],
        'risks' => [],
        'suggestions' => [],
        'summary' => '',
        'advisor_summary' => '',
        'advantages' => [],
        'recommendations' => [],
        'classification_change' => '',
        'revised_scores' => [],
        'follow_up_questions' => [],
        'llm_available' => false,
        'llm_error' => false,
        'message' => $message ?: 'LLM 未配置。当前版本由前端独立完成评分和分析。',
    ];
}

function getSystemPrompt(): string {
    return <<<'SYSTEM'
你是一个高校视觉小说同好会运行状态分析专家。你擅长根据同好会的成员数据、活动数据、内容产出和外部联系等信息，客观评估同好会的运行状态。

你的分析原则：
1. 实事求是：基于提供的数据和文本描述进行评估，不臆想不存在的细节
2. 平衡客观：同时指出优势和不足，避免过度乐观或悲观
3. 具体可操作：建议要针对同好会的具体情况，避免泛泛而谈
4. 文化适配：了解中国高校学生社团的实际运行环境
5. 画像而非排名：你不是在给同好会排名，而是在生成运行画像。不要使用排行榜、名次、强弱比较、碾压、落后、吊打等评价语言。
6. 不以人数定性：不要因为人数少、规模小就直接给低评价；优先看活跃比例、稳定分工、活动执行、内容沉淀、外部连接和传承风险。
7. 证据优先：信息不足时不要编造结论，应提出追问；如果已经在最终修正阶段，保持 score_adjustment 为 0 或降低 confidence，并说明不确定性。

请严格按照用户要求的 JSON 格式输出，不要包含其他内容。
SYSTEM;
}

function buildFollowUpPrompt(array $basicInfo, array $dimensions, array $baseScores): string {
    $dimText = buildDimensionText($dimensions);
    $scoresText = '';
    foreach ($baseScores as $key => $score) {
        $scoresText .= "- {$key}: {$score}\n";
    }

    $info = $basicInfo;
    return <<<PROMPT
## 同好会基本信息
- 名称：{$info['club_name']}
- 学校：{$info['school_name']}
- 城市：{$info['city']}
- 成立年份：{$info['founded_year']}
- 一句话介绍：{$info['short_intro']}

## 各维度数据
{$dimText}

## 前端基础评分
{$scoresText}

## 画像原则
- 这是运行画像，不是排行榜，也不是强弱评比。
- 不要使用“强/弱排名”“更强/更弱”“领先/落后”“吊打/碾压”等比较语言。
- 不要因为成员人数少、学校规模小、成立时间短就直接判定低评价。
- 成员规模只作为背景；优先追问活跃比例、核心协作、活动执行、内容沉淀、外部连接、传承风险。
- 如果信息不足，不要补全想象中的事实，应把它转化为可回答的追问。

## 任务
只生成用于进一步修正画像的追问，不要输出顾问总结、评分修正、优势、风险或建议。

严格输出 JSON：
{
  "follow_up_questions": [
    {
      "id": "q1",
      "question": "具体问题",
      "target_dimension": "六个维度 key 之一",
      "input_type": "textarea",
      "reason": "为什么需要追问"
    }
  ],
  "message": "简短状态说明"
}

追问规则：
- 只有存在信息缺口、矛盾或关键不确定性时才提问。
- 有问题时输出 3-5 个追问；信息充分时输出空数组。
- 每个问题只聚焦一个维度或一个矛盾点。
- 不要询问表单里已经明确给出的信息。
- 优先问能够改变画像判断的问题，而不是补全无关背景。
- 每个问题都要能帮助判断：活跃比例、组织结构、活动执行、内容沉淀、外部连接、传承风险中的一个方面。
- 对开放问答内容要先理解其含义，再拆成具体维度追问；不要把同一个开放问题重复问一遍。
- 问题必须使用简体中文。

PROMPT
        . buildFollowUpStrategyPrompt();
}

/**
 * 验证并补全 LLM 返回的结果
 */
function getAdvisorModePrompt(bool $needsFollowUps): string {
    $followUpRule = $needsFollowUps
        ? 'Generate 3 to 5 follow_up_questions when ambiguity, conflict, or missing context exists. Each question must include id, question, target_dimension, input_type, and reason. Use input_type "textarea" unless a numeric answer is clearly required.'
        : 'Return follow_up_questions as an empty array.';

    return <<<PROMPT

## Additional LLM correction mode requirements

Respond in Simplified Chinese. Keep the existing JSON fields, and also include these fields:

{
  "advisor_summary": "deeper consultant-style summary",
  "evaluation_summary": {
    "portrait_label": "short operational portrait label, not a rank",
    "one_sentence": "one sentence conclusion",
    "current_state": "current operational state",
    "key_observation": "most important evidence-based observation",
    "next_step": "most useful next action",
    "confidence": 0.6
  },
  "advantages": ["specific advantage"],
  "recommendations": ["specific implementation recommendation"],
  "classification_change": "whether the portrait/category changed after revision",
  "revised_scores": [
    {
      "dimension": "one of the six dimension keys",
      "original_score": 0,
      "revised_score": 0,
      "delta": 0,
      "confidence": 0.6,
      "reason": "why this dimension changed or stayed unchanged"
    }
  ]
}

Score revision rules:
- revised_scores must include all six dimensions.
- delta must be an integer from -10 to +10.
- If evidence is weak, keep delta at 0 and explain uncertainty.
- Do not invent facts that are not in the questionnaire or follow-up answers.
- This is an operational portrait, not a ranking. Do not use leaderboard, rank, stronger/weaker comparison, winning/losing, or similar competitive language.
- Do not lower a score only because the club is small. Small but active, well-structured, or sustainable clubs can receive stable or positive revisions.
- Focus on active member ratio, organization structure, activity execution, content accumulation, external connection, and succession risk.
- When information is insufficient, keep confidence low and avoid firm conclusions.

Evaluation summary template:
- evaluation_summary is a concise consultant summary skill/template.
- portrait_label must describe operational state, such as "小规模高参与型", "活动稳定但传承待确认", "内容沉淀起步型"; it must not be a rank or strong/weak label.
- one_sentence must be 35 to 70 Chinese characters.
- current_state must describe what is observable now.
- key_observation must cite the most important evidence from questionnaire or follow-up answers.
- next_step must be one concrete next action.
- confidence must be 0.3 to 0.9. Use lower confidence when information is incomplete.

Follow-up rules:
- {$followUpRule}
- Break broad open-ended uncertainty into separate operational dimensions.
PROMPT;
}

function normalizeStartResult(array $result): array {
    $keys = ['organization_stability', 'activity_execution', 'member_scale_participation',
             'content_accumulation', 'external_connection', 'continuity'];
    $questions = [];
    $incoming = isset($result['follow_up_questions']) && is_array($result['follow_up_questions'])
        ? $result['follow_up_questions']
        : [];

    foreach ($incoming as $i => $question) {
        $normalized = normalizeFollowUpQuestion($question, (int)$i, $keys);
        if ($normalized['question'] === '') continue;
        $questions[] = $normalized;
        if (count($questions) >= 5) break;
    }

    return [
        'follow_up_questions' => $questions,
        'message' => asString($result['message'] ?? ''),
    ];
}

function normalizeLlmResult(array $result, array $baseScores = []): array {
    $keys = ['organization_stability', 'activity_execution', 'member_scale_participation',
             'content_accumulation', 'external_connection', 'continuity'];

    if (!isset($result['score_adjustment']) || !is_array($result['score_adjustment'])) {
        $result['score_adjustment'] = [];
    }
    foreach ($keys as $k) {
        if (!isset($result['score_adjustment'][$k]) || !is_numeric($result['score_adjustment'][$k])) {
            $result['score_adjustment'][$k] = 0;
        } else {
            $result['score_adjustment'][$k] = max(-10, min(10, (int)$result['score_adjustment'][$k]));
        }
    }

    $result['summary'] ??= '';
    $result['advisor_summary'] = asString($result['advisor_summary'] ?? $result['summary'] ?? '');
    $result['evaluation_summary'] = normalizeEvaluationSummary($result['evaluation_summary'] ?? null);
    $result['classification_change'] = asString($result['classification_change'] ?? '');

    if (!isset($result['dimension_analysis']) || !is_array($result['dimension_analysis'])) {
        $result['dimension_analysis'] = [];
    }

    if (!isset($result['advantages']) && isset($result['strengths'])) {
        $result['advantages'] = $result['strengths'];
    }
    if (!isset($result['recommendations']) && isset($result['suggestions'])) {
        $result['recommendations'] = $result['suggestions'];
    }

    foreach (['strengths', 'advantages', 'risks', 'suggestions', 'recommendations', 'follow_up_questions'] as $field) {
        if (!isset($result[$field]) || !is_array($result[$field])) {
            $result[$field] = [];
        }
    }

    $questions = [];
    foreach ($result['follow_up_questions'] as $i => $question) {
        $questions[] = normalizeFollowUpQuestion($question, (int)$i, $keys);
        if (count($questions) >= 5) break;
    }
    $result['follow_up_questions'] = $questions;
    $result['revised_scores'] = normalizeRevisedScores($result, $baseScores, $keys);

    return $result;
}

function normalizeFollowUpQuestion($question, int $index, array $keys): array {
    $q = is_array($question) ? $question : [];
    $dimension = asString($q['target_dimension'] ?? $q['dimension'] ?? '');
    if (!in_array($dimension, $keys, true)) {
        $dimension = '';
    }

    $inputType = $q['input_type'] ?? 'textarea';
    if (!in_array($inputType, ['textarea', 'number', 'select'], true)) {
        $inputType = 'textarea';
    }

    return [
        'id' => asString($q['id'] ?? ('q' . ($index + 1))),
        'question' => asString($q['question'] ?? ''),
        'target_dimension' => $dimension,
        'dimension' => $dimension,
        'input_type' => $inputType,
        'reason' => asString($q['reason'] ?? ''),
    ];
}

function normalizeEvaluationSummary($summary): array {
    $data = is_array($summary) ? $summary : [];
    return [
        'portrait_label' => asString($data['portrait_label'] ?? ''),
        'one_sentence' => asString($data['one_sentence'] ?? ''),
        'current_state' => asString($data['current_state'] ?? ''),
        'key_observation' => asString($data['key_observation'] ?? ''),
        'next_step' => asString($data['next_step'] ?? ''),
        'confidence' => normalizeConfidence($data['confidence'] ?? 0.5),
    ];
}

function normalizeRevisedScores(array &$result, array $baseScores, array $keys): array {
    $incoming = isset($result['revised_scores']) && is_array($result['revised_scores'])
        ? $result['revised_scores']
        : [];
    $byDimension = [];

    foreach ($incoming as $row) {
        if (!is_array($row)) continue;
        $dimension = asString($row['dimension'] ?? '');
        if (!in_array($dimension, $keys, true)) continue;

        $original = isset($baseScores[$dimension]) && is_numeric($baseScores[$dimension])
            ? (int)$baseScores[$dimension]
            : (int)($row['original_score'] ?? 0);
        $revised = isset($row['revised_score']) && is_numeric($row['revised_score'])
            ? max(0, min(100, (int)$row['revised_score']))
            : $original;
        $delta = $revised - $original;

        if ($delta < -10 || $delta > 10) {
            $revised = $original;
            $delta = 0;
        }

        $byDimension[$dimension] = [
            'dimension' => $dimension,
            'original_score' => $original,
            'revised_score' => $revised,
            'delta' => $delta,
            'confidence' => normalizeConfidence($row['confidence'] ?? null),
            'reason' => asString($row['reason'] ?? ''),
        ];
    }

    foreach ($keys as $dimension) {
        if (isset($byDimension[$dimension])) {
            $result['score_adjustment'][$dimension] = $byDimension[$dimension]['delta'];
            continue;
        }

        $original = isset($baseScores[$dimension]) && is_numeric($baseScores[$dimension])
            ? (int)$baseScores[$dimension]
            : 0;
        $delta = (int)($result['score_adjustment'][$dimension] ?? 0);
        $revised = max(0, min(100, $original + $delta));
        $byDimension[$dimension] = [
            'dimension' => $dimension,
            'original_score' => $original,
            'revised_score' => $revised,
            'delta' => $revised - $original,
            'confidence' => $delta === 0 ? 0.5 : 0.7,
            'reason' => asString($result['dimension_analysis'][$dimension] ?? ''),
        ];
    }

    return array_values($byDimension);
}

function normalizeConfidence($value): float {
    if (!is_numeric($value)) return 0.6;
    return max(0.0, min(1.0, (float)$value));
}

function asString($value): string {
    if (is_scalar($value) || $value === null) {
        return trim((string)$value);
    }
    return '';
}

function getLlmFailureResponse(LLMClient $client, string $message): array {
    $errorType = $client->getLastErrorType() ?: 'llm_unavailable';
    return [
        'follow_up_questions' => [],
        'llm_available' => false,
        'llm_error' => true,
        'llm_error_type' => $errorType,
        'finish_reason' => $client->getLastFinishReason(),
        'http_status' => $client->getLastHttpStatus(),
        'message' => getLlmUserMessage($errorType, $message),
    ];
}

function getLlmUnavailableResponse(string $message = 'AI 顾问暂不可用，本地画像已生成。'): array {
    return [
        'follow_up_questions' => [],
        'llm_available' => false,
        'llm_error' => true,
        'llm_error_type' => 'not_configured',
        'finish_reason' => null,
        'http_status' => null,
        'message' => $message,
    ];
}

function getLlmUserMessage(string $errorType, string $fallback): string {
    return match ($errorType) {
        'finish_reason_length' => 'AI 输出过长，已使用本地画像。',
        'json_parse_failed', 'response_json_decode_failed' => 'AI 输出格式异常，已使用本地画像。',
        default => $fallback,
    };
}

function writeLlmCorrectionLog(string $stage, array $input, array $messages, ?string $rawResponse, ?array $normalized, ?string $error, ?LLMClient $client = null): string {
    $id = date('YmdHis') . '-' . bin2hex(random_bytes(4));
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $entry = [
        'id' => $id,
        'created_at' => date('c'),
        'stage' => $stage,
        'input' => $input,
        'llm_request' => $messages,
        'llm_raw_response' => $rawResponse,
        'normalized_response' => $normalized,
        'finish_reason' => $client ? $client->getLastFinishReason() : null,
        'http_status' => $client ? $client->getLastHttpStatus() : null,
        'error_type' => $client ? $client->getLastErrorType() : $error,
        'error' => $error,
    ];

    $file = $dir . '/llm-correction-' . date('Ymd') . '.jsonl';
    @file_put_contents($file, json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);

    return $id;
}
