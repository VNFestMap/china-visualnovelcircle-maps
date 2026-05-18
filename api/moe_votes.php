<?php
// api/moe_votes.php - moe contest voting and result API

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

function moeStageContestForVoting(int $stageId): ?array {
    return moeStageWithContest($stageId);
}

function moeCanViewMoeResults(?array $user, array $stage): bool {
    $contest = moeGetContest((int)$stage['contest_id']);
    if (!$contest) return false;
    if ($user && moeCanManageContest($user, $contest)) return true;
    $visibility = $stage['visibility_rule'] ? json_decode($stage['visibility_rule'], true) : null;
    $mode = is_array($visibility) && !empty($visibility['result_visibility'])
        ? $visibility['result_visibility']
        : ($contest['result_visibility'] ?? 'live_rank_only');
    if (in_array($mode, ['live_votes', 'live_rank_only'], true)) return true;
    if ($mode === 'after_stage') return in_array(($stage['status'] ?? ''), ['locked', 'settled'], true);
    if ($mode === 'after_event') return in_array(($contest['status'] ?? ''), ['ended', 'archived'], true);
    return false;
}

function moeResultVisibilityMode(array $stage): string {
    $contest = moeGetContest((int)$stage['contest_id']);
    $visibility = $stage['visibility_rule'] ? json_decode($stage['visibility_rule'], true) : null;
    return is_array($visibility) && !empty($visibility['result_visibility'])
        ? $visibility['result_visibility']
        : ($contest['result_visibility'] ?? 'live_rank_only');
}

switch ($action) {
    case 'eligibility':
        $user = getCurrentUser();
        if (!$user) {
            moeRespond(['success' => true, 'eligible' => false, 'reason' => 'login_required']);
        }
        $stage = moeStageContestForVoting((int)($_GET['stage_id'] ?? 0));
        if (!$stage) {
            moeRespond(['success' => false, 'message' => '阶段不存在'], 404);
        }
        $contest = moeGetContest((int)$stage['contest_id']);
        $eligible = $contest && moeCanParticipateContest($user, $contest);
        moeRespond([
            'success' => true,
            'eligible' => $eligible,
            'stage_status' => $stage['status'],
            'vote_mode' => $stage['vote_mode'],
            'votes_per_user' => (int)$stage['votes_per_user'],
            'reason' => $eligible ? '' : 'not_eligible',
        ]);

    case 'cast':
        $user = requireLogin();
        $input = moeReadJson();
        $stage = moeStageContestForVoting((int)($input['stage_id'] ?? 0));
        if (!$stage) {
            moeRespond(['success' => false, 'message' => '阶段不存在'], 404);
        }
        $contest = moeGetContest((int)$stage['contest_id']);
        if (!$contest || !moeCanParticipateContest($user, $contest)) {
            moeRespond(['success' => false, 'message' => '当前账号不符合投票资格'], 403);
        }
        if (($stage['status'] ?? '') !== 'open') {
            moeRespond(['success' => false, 'message' => '当前阶段未开放投票'], 409);
        }

        $candidateId = (int)($input['candidate_id'] ?? 0);
        if ($candidateId <= 0) {
            moeRespond(['success' => false, 'message' => '请选择候选'], 400);
        }
        $candidateStmt = $db->prepare("SELECT id FROM moe_candidates WHERE id = ? AND contest_id = ? AND status = 'approved'");
        $candidateStmt->execute([$candidateId, (int)$contest['id']]);
        if (!$candidateStmt->fetch()) {
            moeRespond(['success' => false, 'message' => '候选不存在或未审核通过'], 400);
        }

        $matchId = (int)($input['match_id'] ?? 0);
        if ($matchId > 0) {
            $matchStmt = $db->prepare("SELECT * FROM moe_matches WHERE id = ? AND stage_id = ?");
            $matchStmt->execute([$matchId, (int)$stage['id']]);
            $match = $matchStmt->fetch(PDO::FETCH_ASSOC);
            if (!$match || ($match['status'] ?? '') !== 'open') {
                moeRespond(['success' => false, 'message' => '该场次未开放投票'], 409);
            }
            if (!in_array($candidateId, [(int)$match['slot_a_candidate_id'], (int)$match['slot_b_candidate_id']], true)) {
                moeRespond(['success' => false, 'message' => '候选不属于该场对阵'], 400);
            }
            $dupStmt = $db->prepare("SELECT id FROM moe_votes WHERE match_id = ? AND user_id = ?");
            $dupStmt->execute([$matchId, (int)$user['id']]);
            if ($dupStmt->fetch()) {
                moeRespond(['success' => false, 'message' => '你已经投过该场次'], 409);
            }
        } else {
            if (empty($stage['allow_duplicate_candidate_vote'])) {
                $dupStmt = $db->prepare("SELECT id FROM moe_votes WHERE stage_id = ? AND user_id = ? AND candidate_id = ?");
                $dupStmt->execute([(int)$stage['id'], (int)$user['id'], $candidateId]);
                if ($dupStmt->fetch()) {
                    moeRespond(['success' => false, 'message' => '不能重复投给同一候选'], 409);
                }
            }
            $voteDate = date('Y-m-d');
            if (($stage['vote_mode'] ?? '') === 'daily') {
                $countStmt = $db->prepare("SELECT COUNT(*) FROM moe_votes WHERE stage_id = ? AND user_id = ? AND vote_date = ?");
                $countStmt->execute([(int)$stage['id'], (int)$user['id'], $voteDate]);
            } else {
                $countStmt = $db->prepare("SELECT COUNT(*) FROM moe_votes WHERE stage_id = ? AND user_id = ?");
                $countStmt->execute([(int)$stage['id'], (int)$user['id']]);
            }
            if ((int)$countStmt->fetchColumn() >= (int)$stage['votes_per_user']) {
                moeRespond(['success' => false, 'message' => '本阶段可用票数已用完'], 409);
            }
        }

        $voteDate = date('Y-m-d');
        $stmt = $db->prepare(
            "INSERT INTO moe_votes
             (contest_id, stage_id, match_id, candidate_id, user_id, vote_date, ip_hash, user_agent_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            (int)$contest['id'],
            (int)$stage['id'],
            $matchId > 0 ? $matchId : null,
            $candidateId,
            (int)$user['id'],
            $voteDate,
            moeClientIpHash(),
            moeUserAgentHash(),
        ]);
        logAction('moe_vote.cast', 'moe_votes', (int)$db->lastInsertId(), [
            'contest_id' => (int)$contest['id'],
            'stage_id' => (int)$stage['id'],
            'match_id' => $matchId,
        ]);
        moeRespond(['success' => true]);

    case 'my_votes':
        $user = requireLogin();
        $contestId = (int)($_GET['contest_id'] ?? 0);
        $stageId = (int)($_GET['stage_id'] ?? 0);
        $where = ['user_id = ?'];
        $params = [(int)$user['id']];
        if ($contestId > 0) {
            $where[] = 'contest_id = ?';
            $params[] = $contestId;
        }
        if ($stageId > 0) {
            $where[] = 'stage_id = ?';
            $params[] = $stageId;
        }
        $stmt = $db->prepare('SELECT * FROM moe_votes WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC');
        $stmt->execute($params);
        moeRespond(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

    case 'stage_results':
        $stage = moeStageContestForVoting((int)($_GET['stage_id'] ?? 0));
        if (!$stage) {
            moeRespond(['success' => false, 'message' => '阶段不存在'], 404);
        }
        $user = getCurrentUser();
        if (!moeCanViewMoeResults($user, $stage)) {
            moeRespond(['success' => true, 'hidden' => true, 'data' => []]);
        }
        $entryCountStmt = $db->prepare("SELECT COUNT(*) FROM moe_stage_entries WHERE stage_id = ? AND status = 'active'");
        $entryCountStmt->execute([(int)$stage['id']]);
        if ((int)$entryCountStmt->fetchColumn() > 0) {
            $stmt = $db->prepare(
                "SELECT c.id, c.name, c.name_cn, c.avatar_url, e.id AS entry_id, e.seed_no, e.source_rank, COUNT(v.id) AS votes
                 FROM moe_stage_entries e
                 JOIN moe_candidates c ON c.id = e.candidate_id
                 LEFT JOIN moe_votes v ON v.candidate_id = e.candidate_id AND v.stage_id = e.stage_id
                 WHERE e.stage_id = ? AND e.status = 'active' AND c.status = 'approved'
                 GROUP BY c.id, c.name, c.name_cn, c.avatar_url, e.id, e.seed_no, e.source_rank
                 ORDER BY votes DESC, COALESCE(e.seed_no, 999999), e.id ASC"
            );
            $stmt->execute([(int)$stage['id']]);
        } else {
            $stmt = $db->prepare(
                "SELECT c.id, c.name, c.name_cn, c.avatar_url, NULL AS seed_no, NULL AS source_rank, COUNT(v.id) AS votes
                 FROM moe_candidates c
                 LEFT JOIN moe_votes v ON v.candidate_id = c.id AND v.stage_id = ?
                 WHERE c.contest_id = ? AND c.status = 'approved'
                 GROUP BY c.id, c.name, c.name_cn, c.avatar_url
                 ORDER BY votes DESC, c.id ASC"
            );
            $stmt->execute([(int)$stage['id'], (int)$stage['contest_id']]);
        }
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (moeResultVisibilityMode($stage) === 'live_rank_only' && !($user && moeCanManageContest($user, moeGetContest((int)$stage['contest_id']) ?: []))) {
            foreach ($data as &$row) {
                unset($row['votes']);
            }
        }
        moeRespond(['success' => true, 'hidden' => false, 'data' => $data]);

    case 'match_results':
        $matchId = (int)($_GET['match_id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM moe_matches WHERE id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$match) {
            moeRespond(['success' => false, 'message' => '场次不存在'], 404);
        }
        $stage = moeStageContestForVoting((int)$match['stage_id']);
        $user = getCurrentUser();
        if (!$stage || !moeCanViewMoeResults($user, $stage)) {
            moeRespond(['success' => true, 'hidden' => true, 'data' => []]);
        }
        $stmt = $db->prepare(
            "SELECT c.id, c.name, c.name_cn, c.avatar_url, COUNT(v.id) AS votes
             FROM moe_candidates c
             LEFT JOIN moe_votes v ON v.candidate_id = c.id AND v.match_id = ?
             WHERE c.id IN (?, ?)
             GROUP BY c.id, c.name, c.name_cn, c.avatar_url
             ORDER BY votes DESC, c.id ASC"
        );
        $stmt->execute([$matchId, (int)$match['slot_a_candidate_id'], (int)$match['slot_b_candidate_id']]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (moeResultVisibilityMode($stage) === 'live_rank_only' && !($user && moeCanManageContest($user, moeGetContest((int)$stage['contest_id']) ?: []))) {
            foreach ($data as &$row) {
                unset($row['votes']);
            }
        }
        moeRespond(['success' => true, 'hidden' => false, 'data' => $data]);

    default:
        moeRespond(['success' => false, 'message' => '未知操作 action=' . $action], 400);
}
