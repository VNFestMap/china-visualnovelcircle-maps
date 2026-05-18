<?php
// api/moe_contests.php - self-service moe contest activity API

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

function moeContestPublicRow(array $row): array {
    return [
        'id' => (int)$row['id'],
        'club_id' => (int)$row['club_id'],
        'country' => $row['country'] ?? 'china',
        'title' => $row['title'] ?? '',
        'description' => $row['description'] ?? '',
        'cover_url' => $row['cover_url'] ?? '',
        'candidate_mode' => $row['candidate_mode'] ?? 'character_custom',
        'status' => $row['status'] ?? 'draft',
        'visibility' => $row['visibility'] ?? 'public',
        'eligibility_mode' => $row['eligibility_mode'] ?? 'public',
        'result_visibility' => $row['result_visibility'] ?? 'live_rank_only',
        'created_by' => (int)($row['created_by'] ?? 0),
        'created_at' => $row['created_at'] ?? '',
        'updated_at' => $row['updated_at'] ?? '',
        'published_at' => $row['published_at'] ?? '',
        'ended_at' => $row['ended_at'] ?? '',
    ];
}

switch ($action) {
    case 'list':
        $clubId = (int)($_GET['club_id'] ?? 0);
        $countryRaw = trim($_GET['country'] ?? '');
        $country = $countryRaw === '' || $countryRaw === 'all' ? 'all' : moeNormalizeCountry($countryRaw);
        $status = trim($_GET['status'] ?? '');

        $where = ["visibility = 'public'", "status <> 'draft'"];
        $params = [];
        if ($clubId > 0) {
            $where[] = 'club_id = ?';
            $params[] = $clubId;
        }
        if ($country !== 'all') {
            $where[] = 'country = ?';
            $params[] = $country;
        }
        if ($status !== '' && in_array($status, MOE_CONTEST_STATUSES, true)) {
            $where[] = 'status = ?';
            $params[] = $status;
        }

        $stmt = $db->prepare(
            'SELECT * FROM moe_contests WHERE ' . implode(' AND ', $where) . ' ORDER BY updated_at DESC, id DESC LIMIT 100'
        );
        $stmt->execute($params);
        $rows = array_map('moeContestPublicRow', $stmt->fetchAll(PDO::FETCH_ASSOC));
        moeRespond(['success' => true, 'data' => $rows]);

    case 'my_manageable':
        $user = requireLogin();
        if (($user['role'] ?? '') === 'super_admin') {
            $stmt = $db->query("SELECT * FROM moe_contests ORDER BY updated_at DESC, id DESC LIMIT 200");
            moeRespond(['success' => true, 'data' => array_map('moeContestPublicRow', $stmt->fetchAll(PDO::FETCH_ASSOC))]);
        }

        try {
            $stmt = $db->prepare(
                "SELECT DISTINCT c.*
                 FROM moe_contests c
                 JOIN club_memberships m ON m.club_id = c.club_id AND m.user_id = ? AND m.status = 'active'
                 WHERE m.role IN ('representative', 'manager')
                   AND (m.country = c.country OR m.country IS NULL OR m.country = '')
                 ORDER BY c.updated_at DESC, c.id DESC"
            );
            $stmt->execute([$user['id']]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            $stmt = $db->prepare(
                "SELECT DISTINCT c.*
                 FROM moe_contests c
                 JOIN club_memberships m ON m.club_id = c.club_id AND m.user_id = ? AND m.status = 'active'
                 WHERE m.role IN ('representative', 'manager')
                 ORDER BY c.updated_at DESC, c.id DESC"
            );
            $stmt->execute([$user['id']]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        moeRespond(['success' => true, 'data' => array_map('moeContestPublicRow', $rows)]);

    case 'get':
        $contestId = (int)($_GET['id'] ?? 0);
        $contest = moeGetContest($contestId);
        if (!$contest) {
            moeRespond(['success' => false, 'message' => '萌战活动不存在'], 404);
        }

        $user = getCurrentUser();
        $canManage = $user ? moeCanManageContest($user, $contest) : false;
        if (($contest['status'] ?? '') === 'draft' && !$canManage) {
            moeRespond(['success' => false, 'message' => '萌战活动不存在'], 404);
        }

        $stmt = $db->prepare("SELECT * FROM moe_contest_stages WHERE contest_id = ? ORDER BY sort_order ASC, id ASC");
        $stmt->execute([$contestId]);
        moeRespond([
            'success' => true,
            'data' => moeContestPublicRow($contest),
            'stages' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'can_manage' => $canManage,
        ]);

    case 'create':
        $user = requireLogin();
        $input = moeReadJson();
        $clubId = (int)($input['club_id'] ?? 0);
        $country = moeNormalizeCountry($input['country'] ?? 'china');
        $title = trim($input['title'] ?? '');
        if ($clubId <= 0 || $title === '') {
            moeRespond(['success' => false, 'message' => '请填写有效的同好会和活动名称'], 400);
        }
        if (!moeCanCreateContest($user, $clubId, $country)) {
            moeRespond(['success' => false, 'message' => '只有同好会负责人可以创建萌战'], 403);
        }

        $eligibility = moeNormalizeStatus($input['eligibility_mode'] ?? 'public', MOE_ELIGIBILITY_MODES, 'public');
        $resultVisibility = moeNormalizeStatus($input['result_visibility'] ?? 'live_rank_only', MOE_RESULT_VISIBILITIES, 'live_rank_only');
        $visibility = in_array(($input['visibility'] ?? 'public'), ['public', 'unlisted', 'club_only'], true) ? $input['visibility'] : 'public';
        $stmt = $db->prepare(
            "INSERT INTO moe_contests
             (club_id, country, title, description, cover_url, candidate_mode, status, visibility, eligibility_mode, result_visibility, created_by)
             VALUES (?, ?, ?, ?, ?, 'character_custom', 'draft', ?, ?, ?, ?)"
        );
        $stmt->execute([
            $clubId,
            $country,
            $title,
            trim($input['description'] ?? ''),
            trim($input['cover_url'] ?? ''),
            $visibility,
            $eligibility,
            $resultVisibility,
            $user['id'],
        ]);
        $id = (int)$db->lastInsertId();
        moeCreateStandardContestStages($db, $id);
        logAction('moe_contest.create', 'moe_contests', $id, ['club_id' => $clubId, 'country' => $country]);
        moeRespond(['success' => true, 'id' => $id]);

    case 'update':
        [$user, $contest] = moeRequireContestManager((int)($_GET['id'] ?? 0));
        $input = moeReadJson();
        $eligibility = moeNormalizeStatus($input['eligibility_mode'] ?? ($contest['eligibility_mode'] ?? 'public'), MOE_ELIGIBILITY_MODES, 'public');
        $resultVisibility = moeNormalizeStatus($input['result_visibility'] ?? ($contest['result_visibility'] ?? 'live_rank_only'), MOE_RESULT_VISIBILITIES, 'live_rank_only');
        $visibility = in_array(($input['visibility'] ?? ($contest['visibility'] ?? 'public')), ['public', 'unlisted', 'club_only'], true)
            ? ($input['visibility'] ?? ($contest['visibility'] ?? 'public'))
            : 'public';
        $now = moeNowExpr();
        $stmt = $db->prepare(
            "UPDATE moe_contests
             SET title = ?, description = ?, cover_url = ?, visibility = ?, eligibility_mode = ?, result_visibility = ?, updated_at = $now
             WHERE id = ?"
        );
        $stmt->execute([
            trim($input['title'] ?? $contest['title']),
            trim($input['description'] ?? ($contest['description'] ?? '')),
            trim($input['cover_url'] ?? ($contest['cover_url'] ?? '')),
            $visibility,
            $eligibility,
            $resultVisibility,
            (int)$contest['id'],
        ]);
        logAction('moe_contest.update', 'moe_contests', (int)$contest['id'], null);
        moeRespond(['success' => true]);

    case 'publish':
    case 'suspend':
    case 'archive':
        [$user, $contest] = moeRequireContestManager((int)($_GET['id'] ?? 0));
        $targetStatus = $action === 'publish' ? 'published' : ($action === 'suspend' ? 'suspended' : 'archived');
        $now = moeNowExpr();
        $publishedSql = $action === 'publish' ? ", published_at = COALESCE(published_at, $now)" : '';
        $stmt = $db->prepare("UPDATE moe_contests SET status = ?, updated_at = $now $publishedSql WHERE id = ?");
        $stmt->execute([$targetStatus, (int)$contest['id']]);
        logAction('moe_contest.' . $action, 'moe_contests', (int)$contest['id'], null);
        moeRespond(['success' => true, 'status' => $targetStatus]);

    case 'delete':
        [$user, $contest] = moeRequireContestManager((int)($_GET['id'] ?? 0));
        $input = moeReadJson();
        $confirmTitle = trim($input['confirm_title'] ?? '');
        if ($confirmTitle === '' || $confirmTitle !== trim($contest['title'] ?? '')) {
            moeRespond(['success' => false, 'message' => '请输入完整活动名称以确认删除'], 400);
        }

        $contestId = (int)$contest['id'];
        $stageStmt = $db->prepare("SELECT id FROM moe_contest_stages WHERE contest_id = ?");
        $stageStmt->execute([$contestId]);
        $stageIds = array_map('intval', $stageStmt->fetchAll(PDO::FETCH_COLUMN));

        try {
            $db->beginTransaction();
            if ($stageIds) {
                $placeholders = implode(',', array_fill(0, count($stageIds), '?'));
                $db->prepare("DELETE FROM moe_votes WHERE stage_id IN ($placeholders)")->execute($stageIds);
                $db->prepare("DELETE FROM moe_matches WHERE stage_id IN ($placeholders)")->execute($stageIds);
                $db->prepare("DELETE FROM moe_stage_entries WHERE stage_id IN ($placeholders)")->execute($stageIds);
                $db->prepare("DELETE FROM moe_stage_entries WHERE source_stage_id IN ($placeholders)")->execute($stageIds);
                $db->prepare("DELETE FROM moe_candidate_nominations WHERE stage_id IN ($placeholders)")->execute($stageIds);
            }
            $db->prepare("DELETE FROM moe_votes WHERE contest_id = ?")->execute([$contestId]);
            $db->prepare("DELETE FROM moe_invites WHERE contest_id = ?")->execute([$contestId]);
            $db->prepare("DELETE FROM moe_whitelist WHERE contest_id = ?")->execute([$contestId]);
            $db->prepare("DELETE FROM moe_candidates WHERE contest_id = ?")->execute([$contestId]);
            $db->prepare("DELETE FROM moe_contest_stages WHERE contest_id = ?")->execute([$contestId]);
            $db->prepare("DELETE FROM moe_contests WHERE id = ?")->execute([$contestId]);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            moeRespond(['success' => false, 'message' => '删除失败，请稍后重试'], 500);
        }

        logAction('moe_contest.delete', 'moe_contests', $contestId, [
            'title' => $contest['title'] ?? '',
            'stage_count' => count($stageIds),
        ]);
        moeRespond(['success' => true, 'deleted_id' => $contestId]);

    default:
        moeRespond(['success' => false, 'message' => '未知操作 action=' . $action], 400);
}
