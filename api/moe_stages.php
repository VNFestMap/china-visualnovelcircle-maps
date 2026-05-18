<?php
// api/moe_stages.php - moe contest stage configuration API

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/moe.php';
require_once __DIR__ . '/../includes/audit.php';

moeEnsureSchema();
$action = $_GET['action'] ?? '';
$db = getDB();

function moeJsonOrNull($value): ?string {
    if ($value === null || $value === '') return null;
    if (is_string($value)) return $value;
    return json_encode($value, JSON_UNESCAPED_UNICODE);
}

function moeRequireStageManager(int $stageId): array {
    $stage = moeStageWithContest($stageId);
    if (!$stage) {
        moeRespond(['success' => false, 'message' => '阶段不存在'], 404);
    }
    [$user, $contest] = moeRequireContestManager((int)$stage['contest_id']);
    return [$user, $contest, $stage];
}

switch ($action) {
    case 'list':
        $contestId = (int)($_GET['contest_id'] ?? 0);
        $contest = moeGetContest($contestId);
        if (!$contest) {
            moeRespond(['success' => false, 'message' => '萌战活动不存在'], 404);
        }
        $stmt = $db->prepare("SELECT * FROM moe_contest_stages WHERE contest_id = ? ORDER BY sort_order ASC, id ASC");
        $stmt->execute([$contestId]);
        moeRespond(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

    case 'create':
        $input = moeReadJson();
        [$user, $contest] = moeRequireContestManager((int)($input['contest_id'] ?? 0));
        $type = $input['stage_type'] ?? '';
        if (!in_array($type, MOE_STAGE_TYPES, true)) {
            moeRespond(['success' => false, 'message' => '无效的阶段类型'], 400);
        }
        $title = trim($input['title'] ?? '');
        if ($title === '') {
            moeRespond(['success' => false, 'message' => '请填写阶段名称'], 400);
        }
        $orderStmt = $db->prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM moe_contest_stages WHERE contest_id = ?");
        $orderStmt->execute([(int)$contest['id']]);
        $sortOrder = (int)$orderStmt->fetchColumn();
        $stmt = $db->prepare(
            "INSERT INTO moe_contest_stages
             (contest_id, stage_type, title, sort_order, status, starts_at, ends_at, vote_mode, votes_per_user,
              allow_vote_change, allow_duplicate_candidate_vote, advance_rule, visibility_rule, config_json)
             VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            (int)$contest['id'],
            $type,
            $title,
            $sortOrder,
            $input['starts_at'] ?? null,
            $input['ends_at'] ?? null,
            $input['vote_mode'] ?? ($type === 'bracket' ? 'match_single' : 'fixed_per_stage'),
            max(1, (int)($input['votes_per_user'] ?? 1)),
            !empty($input['allow_vote_change']) ? 1 : 0,
            !empty($input['allow_duplicate_candidate_vote']) ? 1 : 0,
            moeJsonOrNull($input['advance_rule'] ?? null),
            moeJsonOrNull($input['visibility_rule'] ?? null),
            moeJsonOrNull($input['config_json'] ?? null),
        ]);
        $id = (int)$db->lastInsertId();
        logAction('moe_stage.create', 'moe_contest_stages', $id, ['contest_id' => (int)$contest['id']]);
        moeRespond(['success' => true, 'id' => $id]);

    case 'update':
        $input = moeReadJson();
        [$user, $contest, $stage] = moeRequireStageManager((int)($_GET['id'] ?? ($input['id'] ?? 0)));
        $type = $input['stage_type'] ?? $stage['stage_type'];
        if (!in_array($type, MOE_STAGE_TYPES, true)) {
            moeRespond(['success' => false, 'message' => '无效的阶段类型'], 400);
        }
        $status = moeNormalizeStatus($input['status'] ?? $stage['status'], MOE_STAGE_STATUSES, $stage['status']);
        $now = moeNowExpr();
        $startsAt = array_key_exists('starts_at', $input) ? $input['starts_at'] : ($stage['starts_at'] ?? null);
        $endsAt = array_key_exists('ends_at', $input) ? $input['ends_at'] : ($stage['ends_at'] ?? null);
        $advanceRule = array_key_exists('advance_rule', $input) ? $input['advance_rule'] : ($stage['advance_rule'] ?? null);
        $visibilityRule = array_key_exists('visibility_rule', $input) ? $input['visibility_rule'] : ($stage['visibility_rule'] ?? null);
        $configJson = array_key_exists('config_json', $input) ? $input['config_json'] : ($stage['config_json'] ?? null);
        $stmt = $db->prepare(
            "UPDATE moe_contest_stages
             SET stage_type = ?, title = ?, status = ?, starts_at = ?, ends_at = ?, vote_mode = ?, votes_per_user = ?,
                 allow_vote_change = ?, allow_duplicate_candidate_vote = ?, advance_rule = ?, visibility_rule = ?,
                 config_json = ?, updated_at = $now
             WHERE id = ?"
        );
        $stmt->execute([
            $type,
            trim($input['title'] ?? $stage['title']),
            $status,
            $startsAt,
            $endsAt,
            $input['vote_mode'] ?? $stage['vote_mode'],
            max(1, (int)($input['votes_per_user'] ?? $stage['votes_per_user'])),
            isset($input['allow_vote_change']) ? (!empty($input['allow_vote_change']) ? 1 : 0) : (int)$stage['allow_vote_change'],
            isset($input['allow_duplicate_candidate_vote']) ? (!empty($input['allow_duplicate_candidate_vote']) ? 1 : 0) : (int)$stage['allow_duplicate_candidate_vote'],
            moeJsonOrNull($advanceRule),
            moeJsonOrNull($visibilityRule),
            moeJsonOrNull($configJson),
            (int)$stage['id'],
        ]);
        logAction('moe_stage.update', 'moe_contest_stages', (int)$stage['id'], null);
        moeRespond(['success' => true]);

    case 'reorder':
        $input = moeReadJson();
        [$user, $contest] = moeRequireContestManager((int)($input['contest_id'] ?? 0));
        $ids = $input['ids'] ?? [];
        if (!is_array($ids) || count($ids) === 0) {
            moeRespond(['success' => false, 'message' => '阶段列表不能为空'], 400);
        }
        $stmt = $db->prepare("UPDATE moe_contest_stages SET sort_order = ? WHERE id = ? AND contest_id = ?");
        foreach ($ids as $index => $id) {
            $stmt->execute([$index + 1, (int)$id, (int)$contest['id']]);
        }
        logAction('moe_stage.reorder', 'moe_contests', (int)$contest['id'], ['ids' => $ids]);
        moeRespond(['success' => true]);

    case 'open':
    case 'lock':
    case 'settle':
        [$user, $contest, $stage] = moeRequireStageManager((int)($_GET['id'] ?? 0));
        $target = $action === 'open' ? 'open' : ($action === 'lock' ? 'locked' : 'settled');
        $advancedCount = 0;
        if ($action === 'settle') {
            if (($stage['stage_type'] ?? '') === 'nomination') {
                $advancedCount = moeSettleNominationStage($db, $stage);
            } elseif (in_array(($stage['stage_type'] ?? ''), ['qualifier', 'group_vote'], true)) {
                $advancedCount = moeSettleQualifierStage($db, $stage);
            }
        }
        $now = moeNowExpr();
        $stmt = $db->prepare("UPDATE moe_contest_stages SET status = ?, updated_at = $now WHERE id = ?");
        $stmt->execute([$target, (int)$stage['id']]);
        if ($target === 'open') {
            $db->prepare("UPDATE moe_contests SET status = 'running', updated_at = $now WHERE id = ?")->execute([(int)$contest['id']]);
        }
        logAction('moe_stage.' . $action, 'moe_contest_stages', (int)$stage['id'], null);
        moeRespond(['success' => true, 'status' => $target, 'advanced_count' => $advancedCount]);

    default:
        moeRespond(['success' => false, 'message' => '未知操作 action=' . $action], 400);
}
