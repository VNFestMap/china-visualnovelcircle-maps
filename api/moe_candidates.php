<?php
// api/moe_candidates.php - moe contest nomination and candidate review API

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

function moeCandidateInput(array $input, array $fallback = []): array {
    return [
        'source' => in_array(($input['source'] ?? ($fallback['source'] ?? 'manual')), ['bangumi', 'manual'], true)
            ? ($input['source'] ?? ($fallback['source'] ?? 'manual'))
            : 'manual',
        'subject_id' => isset($input['subject_id']) ? (int)$input['subject_id'] : ($fallback['subject_id'] ?? null),
        'character_id' => isset($input['character_id']) ? (int)$input['character_id'] : ($fallback['character_id'] ?? null),
        'name' => trim($input['name'] ?? ($fallback['name'] ?? '')),
        'name_cn' => trim($input['name_cn'] ?? ($fallback['name_cn'] ?? '')),
        'subject_name' => trim($input['subject_name'] ?? ($fallback['subject_name'] ?? '')),
        'subject_name_cn' => trim($input['subject_name_cn'] ?? ($fallback['subject_name_cn'] ?? '')),
        'avatar_url' => trim($input['avatar_url'] ?? ($fallback['avatar_url'] ?? '')),
        'summary' => trim($input['summary'] ?? ($fallback['summary'] ?? '')),
        'custom_fields_json' => isset($input['custom_fields'])
            ? json_encode($input['custom_fields'], JSON_UNESCAPED_UNICODE)
            : ($fallback['custom_fields_json'] ?? null),
    ];
}

switch ($action) {
    case 'list':
        $contestId = (int)($_GET['contest_id'] ?? 0);
        $contest = moeGetContest($contestId);
        if (!$contest) {
            moeRespond(['success' => false, 'message' => '萌战活动不存在'], 404);
        }
        $status = trim($_GET['status'] ?? '');
        $where = ['contest_id = ?'];
        $params = [$contestId];
        if ($status !== '') {
            $where[] = 'status = ?';
            $params[] = $status;
        }
        $stmt = $db->prepare(
            'SELECT * FROM moe_candidates WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC, id DESC'
        );
        $stmt->execute($params);
        moeRespond(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

    case 'nominate':
        $user = requireLogin();
        $input = moeReadJson();
        $stageId = (int)($input['stage_id'] ?? 0);
        $stage = moeStageWithContest($stageId);
        if (!$stage || $stage['stage_type'] !== 'nomination') {
            moeRespond(['success' => false, 'message' => '提名阶段不存在'], 404);
        }
        if ($stage['status'] !== 'open') {
            moeRespond(['success' => false, 'message' => '当前提名阶段未开放'], 400);
        }
        $contest = moeGetContest((int)$stage['contest_id']);
        if (!$contest) {
            moeRespond(['success' => false, 'message' => '萌战活动不存在'], 404);
        }
        if (!moeCanManageContest($user, $contest) && !moeCanParticipateContest($user, $contest)) {
            moeRespond(['success' => false, 'message' => '当前账号不符合提名资格'], 403);
        }
        $candidate = moeCandidateInput($input);
        if ($candidate['name'] === '' && $candidate['name_cn'] === '') {
            moeRespond(['success' => false, 'message' => '请填写候选名称'], 400);
        }
        $limit = moeGetNominationLimit($stage);
        $countStmt = $db->prepare("SELECT COUNT(*) FROM moe_candidate_nominations WHERE stage_id = ? AND user_id = ? AND status = 'active'");
        $countStmt->execute([$stageId, (int)$user['id']]);
        if ((int)$countStmt->fetchColumn() >= $limit) {
            moeRespond(['success' => false, 'message' => '本阶段提名名额已用完'], 400);
        }
        $poolCandidate = moeFindOrCreateCandidateFromNomination($db, $contest, $stage, $candidate, $user);
        $dupeStmt = $db->prepare("SELECT id FROM moe_candidate_nominations WHERE stage_id = ? AND user_id = ? AND candidate_id = ? AND status = 'active'");
        $dupeStmt->execute([$stageId, (int)$user['id'], (int)$poolCandidate['id']]);
        if ($dupeStmt->fetchColumn()) {
            moeRespond(['success' => false, 'message' => '你已经提名过这个角色'], 409);
        }
        $identityKey = moeNormalizeCandidateIdentity($candidate);
        $stmt = $db->prepare(
            "INSERT INTO moe_candidate_nominations
             (contest_id, stage_id, candidate_id, user_id, source, subject_id, character_id, name, name_cn,
              subject_name, subject_name_cn, avatar_url, summary, identity_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')"
        );
        $stmt->execute([
            (int)$contest['id'],
            $stageId,
            (int)$poolCandidate['id'],
            (int)$user['id'],
            $candidate['source'],
            $candidate['subject_id'],
            $candidate['character_id'],
            $candidate['name'] ?: $candidate['name_cn'],
            $candidate['name_cn'],
            $candidate['subject_name'],
            $candidate['subject_name_cn'],
            $candidate['avatar_url'],
            $candidate['summary'],
            $identityKey,
        ]);
        $id = (int)$db->lastInsertId();
        logAction('moe_candidate.nominate', 'moe_candidate_nominations', $id, [
            'contest_id' => (int)$contest['id'],
            'candidate_id' => (int)$poolCandidate['id'],
        ]);
        moeRespond(['success' => true, 'id' => $id, 'candidate_id' => (int)$poolCandidate['id']]);

    case 'my_nominations':
        $user = requireLogin();
        $stageId = (int)($_GET['stage_id'] ?? 0);
        $stage = moeStageWithContest($stageId);
        if (!$stage || $stage['stage_type'] !== 'nomination') {
            moeRespond(['success' => false, 'message' => '提名阶段不存在'], 404);
        }
        $limit = moeGetNominationLimit($stage);
        $stmt = $db->prepare(
            "SELECT n.*, c.status AS candidate_status
             FROM moe_candidate_nominations n
             JOIN moe_candidates c ON c.id = n.candidate_id
             WHERE n.stage_id = ? AND n.user_id = ? AND n.status = 'active'
             ORDER BY n.created_at DESC, n.id DESC"
        );
        $stmt->execute([$stageId, (int)$user['id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        moeRespond([
            'success' => true,
            'data' => $rows,
            'limit' => $limit,
            'used' => count($rows),
            'remaining' => max(0, $limit - count($rows)),
        ]);

    case 'nomination_summary':
        $stageId = (int)($_GET['stage_id'] ?? 0);
        $stage = moeStageWithContest($stageId);
        if (!$stage || $stage['stage_type'] !== 'nomination') {
            moeRespond(['success' => false, 'message' => '提名阶段不存在'], 404);
        }
        $stmt = $db->prepare(
            "SELECT c.*, counts.nomination_count
             FROM moe_candidates c
             JOIN (
                 SELECT candidate_id, COUNT(*) AS nomination_count
                 FROM moe_candidate_nominations
                 WHERE stage_id = ? AND status = 'active'
                 GROUP BY candidate_id
             ) counts ON counts.candidate_id = c.id
             WHERE c.contest_id = ?
             ORDER BY counts.nomination_count DESC, c.id ASC"
        );
        $stmt->execute([$stageId, (int)$stage['contest_id']]);
        moeRespond(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

    case 'withdraw_nomination':
        $user = requireLogin();
        $input = moeReadJson();
        $id = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        $stmt = $db->prepare("SELECT * FROM moe_candidate_nominations WHERE id = ?");
        $stmt->execute([$id]);
        $nomination = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$nomination) {
            moeRespond(['success' => false, 'message' => '提名记录不存在'], 404);
        }
        $stage = moeStageWithContest((int)$nomination['stage_id']);
        if (!$stage || $stage['status'] !== 'open') {
            moeRespond(['success' => false, 'message' => '当前提名阶段不可撤回'], 400);
        }
        $contest = moeGetContest((int)$nomination['contest_id']) ?: [];
        if ((int)$nomination['user_id'] !== (int)$user['id'] && !moeCanManageContest($user, $contest)) {
            moeRespond(['success' => false, 'message' => '无权撤回该提名'], 403);
        }
        $now = moeNowExpr();
        $db->prepare("UPDATE moe_candidate_nominations SET status = 'withdrawn', updated_at = $now WHERE id = ?")->execute([$id]);
        logAction('moe_candidate.withdraw_nomination', 'moe_candidate_nominations', $id, null);
        moeRespond(['success' => true]);

    case 'update':
        $input = moeReadJson();
        $candidateId = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        $stmt = $db->prepare("SELECT * FROM moe_candidates WHERE id = ?");
        $stmt->execute([$candidateId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            moeRespond(['success' => false, 'message' => '候选不存在'], 404);
        }
        [$user, $contest] = moeRequireContestManager((int)$existing['contest_id']);
        $candidate = moeCandidateInput($input, $existing);
        if ($candidate['name'] === '') {
            moeRespond(['success' => false, 'message' => '请填写候选名称'], 400);
        }
        $now = moeNowExpr();
        $stmt = $db->prepare(
            "UPDATE moe_candidates
             SET source = ?, subject_id = ?, character_id = ?, name = ?, name_cn = ?, subject_name = ?,
                 subject_name_cn = ?, avatar_url = ?, summary = ?, custom_fields_json = ?, updated_at = $now
             WHERE id = ?"
        );
        $stmt->execute([
            $candidate['source'],
            $candidate['subject_id'],
            $candidate['character_id'],
            $candidate['name'],
            $candidate['name_cn'],
            $candidate['subject_name'],
            $candidate['subject_name_cn'],
            $candidate['avatar_url'],
            $candidate['summary'],
            $candidate['custom_fields_json'],
            $candidateId,
        ]);
        logAction('moe_candidate.update', 'moe_candidates', $candidateId, null);
        moeRespond(['success' => true]);

    case 'approve':
    case 'reject':
        $input = moeReadJson();
        $candidateId = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        $stmt = $db->prepare("SELECT * FROM moe_candidates WHERE id = ?");
        $stmt->execute([$candidateId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            moeRespond(['success' => false, 'message' => '候选不存在'], 404);
        }
        [$user, $contest] = moeRequireContestManager((int)$existing['contest_id']);
        $status = $action === 'approve' ? 'approved' : 'rejected';
        $now = moeNowExpr();
        $stmt = $db->prepare(
            "UPDATE moe_candidates SET status = ?, reviewed_by = ?, reviewed_at = $now, updated_at = $now WHERE id = ?"
        );
        $stmt->execute([$status, (int)$user['id'], $candidateId]);
        logAction('moe_candidate.' . $action, 'moe_candidates', $candidateId, null);
        moeRespond(['success' => true, 'status' => $status]);

    case 'withdraw':
        $user = requireLogin();
        $input = moeReadJson();
        $candidateId = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        $stmt = $db->prepare("SELECT * FROM moe_candidates WHERE id = ?");
        $stmt->execute([$candidateId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) {
            moeRespond(['success' => false, 'message' => '候选不存在'], 404);
        }
        if ((int)$existing['created_by'] !== (int)$user['id'] && !moeCanManageContest($user, moeGetContest((int)$existing['contest_id']) ?: [])) {
            moeRespond(['success' => false, 'message' => '无权撤回该候选'], 403);
        }
        $now = moeNowExpr();
        $stmt = $db->prepare("UPDATE moe_candidates SET status = 'withdrawn', updated_at = $now WHERE id = ? AND status = 'pending'");
        $stmt->execute([$candidateId]);
        logAction('moe_candidate.withdraw', 'moe_candidates', $candidateId, null);
        moeRespond(['success' => true]);

    default:
        moeRespond(['success' => false, 'message' => '未知操作 action=' . $action], 400);
}
