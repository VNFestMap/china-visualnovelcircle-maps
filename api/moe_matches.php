<?php
// api/moe_matches.php - moe contest 1v1 bracket match API

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

function moeRequireStageManagerForMatches(int $stageId): array {
    $stage = moeStageWithContest($stageId);
    if (!$stage) {
        moeRespond(['success' => false, 'message' => '阶段不存在'], 404);
    }
    if (($stage['stage_type'] ?? '') !== 'bracket' && ($stage['stage_type'] ?? '') !== 'final') {
        moeRespond(['success' => false, 'message' => '该阶段不是 1v1 对战阶段'], 400);
    }
    [$user, $contest] = moeRequireContestManager((int)$stage['contest_id']);
    return [$user, $contest, $stage];
}

function moeFetchStageMatches(PDO $db, int $stageId): array {
    $stmt = $db->prepare(
        "SELECT m.*,
                ca.name AS slot_a_name, ca.name_cn AS slot_a_name_cn, ca.avatar_url AS slot_a_avatar,
                cb.name AS slot_b_name, cb.name_cn AS slot_b_name_cn, cb.avatar_url AS slot_b_avatar,
                cw.name AS winner_name, cw.name_cn AS winner_name_cn, cw.avatar_url AS winner_avatar
         FROM moe_matches m
         LEFT JOIN moe_candidates ca ON ca.id = m.slot_a_candidate_id
         LEFT JOIN moe_candidates cb ON cb.id = m.slot_b_candidate_id
         LEFT JOIN moe_candidates cw ON cw.id = m.winner_candidate_id
         WHERE m.stage_id = ?
         ORDER BY m.round_no ASC, m.match_no ASC"
    );
    $stmt->execute([$stageId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function moeFindNextFinalStage(PDO $db, array $stage): ?array {
    if (($stage['stage_type'] ?? '') !== 'bracket') {
        return null;
    }
    $stmt = $db->prepare(
        "SELECT * FROM moe_contest_stages
         WHERE contest_id = ? AND sort_order > ? AND stage_type = 'final'
         ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    $stmt->execute([(int)$stage['contest_id'], (int)$stage['sort_order']]);
    $next = $stmt->fetch(PDO::FETCH_ASSOC);
    return $next ?: null;
}

function moeAdvanceWinnersToFinalStage(PDO $db, array $stage, array $winners): array {
    $finalStage = moeFindNextFinalStage($db, $stage);
    if (!$finalStage || count($winners) !== 2) {
        return ['advanced' => false, 'reason' => 'no_final_stage'];
    }

    $db->prepare("DELETE FROM moe_stage_entries WHERE stage_id = ? AND source_stage_id = ?")
        ->execute([(int)$finalStage['id'], (int)$stage['id']]);
    $insert = $db->prepare(
        "INSERT INTO moe_stage_entries (stage_id, candidate_id, seed_no, source_stage_id, source_rank, status)
         VALUES (?, ?, ?, ?, ?, 'active')"
    );
    foreach (array_values($winners) as $index => $winnerId) {
        $seed = $index + 1;
        $insert->execute([(int)$finalStage['id'], (int)$winnerId, $seed, (int)$stage['id'], $seed]);
    }

    $now = moeNowExpr();
    $db->prepare("UPDATE moe_contest_stages SET status = 'settled', updated_at = $now WHERE id = ?")
        ->execute([(int)$stage['id']]);
    logAction('moe_match.advance_final', 'moe_contest_stages', (int)$finalStage['id'], [
        'from_stage_id' => (int)$stage['id'],
        'finalists' => array_values($winners),
    ]);

    return [
        'advanced' => true,
        'final_stage_ready' => true,
        'final_stage_id' => (int)$finalStage['id'],
        'finalists' => count($winners),
    ];
}

function moeAdvanceBracketIfRoundComplete(PDO $db, array $stage, int $roundNo): array {
    $stageId = (int)$stage['id'];
    if ($stageId <= 0 || $roundNo <= 0) {
        return ['advanced' => false, 'reason' => 'invalid_round'];
    }

    $roundStmt = $db->prepare(
        "SELECT id, match_no, winner_candidate_id
         FROM moe_matches
         WHERE stage_id = ? AND round_no = ?
         ORDER BY match_no ASC, id ASC"
    );
    $roundStmt->execute([$stageId, $roundNo]);
    $roundMatches = $roundStmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($roundMatches) === 0) {
        return ['advanced' => false, 'reason' => 'round_empty'];
    }

    $winners = [];
    foreach ($roundMatches as $roundMatch) {
        $winnerId = (int)($roundMatch['winner_candidate_id'] ?? 0);
        if ($winnerId <= 0) {
            return ['advanced' => false, 'reason' => 'round_incomplete'];
        }
        $winners[] = $winnerId;
    }

    $nextRoundNo = $roundNo + 1;
    $existingNext = $db->prepare("SELECT COUNT(*) FROM moe_matches WHERE stage_id = ? AND round_no = ?");
    $existingNext->execute([$stageId, $nextRoundNo]);
    if ((int)$existingNext->fetchColumn() > 0) {
        return ['advanced' => false, 'reason' => 'next_round_exists'];
    }

    $now = moeNowExpr();
    if (($stage['stage_type'] ?? '') === 'bracket' && count($winners) === 2 && moeFindNextFinalStage($db, $stage)) {
        return moeAdvanceWinnersToFinalStage($db, $stage, $winners);
    }

    if (count($winners) === 1) {
        $db->prepare("UPDATE moe_contest_stages SET status = 'settled', updated_at = $now WHERE id = ?")
            ->execute([$stageId]);
        return ['advanced' => false, 'champion_candidate_id' => $winners[0], 'stage_settled' => true];
    }

    $insert = $db->prepare(
        "INSERT INTO moe_matches (stage_id, round_no, match_no, slot_a_candidate_id, slot_b_candidate_id, winner_candidate_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $created = 0;
    $matchNo = 1;
    for ($i = 0; $i < count($winners); $i += 2) {
        $a = $winners[$i];
        $b = $winners[$i + 1] ?? null;
        $byeWinner = $b === null ? $a : null;
        $status = $b === null ? 'settled' : 'pending';
        $insert->execute([$stageId, $nextRoundNo, $matchNo, $a, $b, $byeWinner, $status]);
        $created++;
        $matchNo++;
    }

    logAction('moe_match.advance', 'moe_contest_stages', $stageId, [
        'from_round' => $roundNo,
        'to_round' => $nextRoundNo,
        'matches' => $created,
    ]);

    return ['advanced' => true, 'round_no' => $nextRoundNo, 'matches' => $created];
}

switch ($action) {
    case 'list':
        $stageId = (int)($_GET['stage_id'] ?? 0);
        $stage = moeStageWithContest($stageId);
        if (!$stage) {
            moeRespond(['success' => false, 'message' => '阶段不存在'], 404);
        }
        moeRespond(['success' => true, 'data' => moeFetchStageMatches($db, $stageId)]);

    case 'contest_bracket':
        $contestId = (int)($_GET['contest_id'] ?? 0);
        $contest = moeGetContest($contestId);
        if (!$contest) {
            moeRespond(['success' => false, 'message' => 'contest_not_found'], 404);
        }
        $user = getCurrentUser();
        $canManage = $user ? moeCanManageContest($user, $contest) : false;
        if (!$canManage && !in_array(($contest['status'] ?? ''), ['published', 'running', 'settling', 'ended', 'archived'], true)) {
            moeRespond(['success' => false, 'message' => '璇ヨ悓鎴樻殏鏈叕寮€'], 403);
        }

        $stageStmt = $db->prepare(
            "SELECT s.*,
                    (SELECT COUNT(*) FROM moe_matches m WHERE m.stage_id = s.id) AS match_count,
                    (SELECT COUNT(*) FROM moe_stage_entries e WHERE e.stage_id = s.id AND e.status = 'active') AS entry_count
             FROM moe_contest_stages s
             WHERE s.contest_id = ? AND s.stage_type IN ('bracket', 'final')
             ORDER BY CASE
               WHEN s.stage_type = 'final' AND ((SELECT COUNT(*) FROM moe_matches mf WHERE mf.stage_id = s.id) > 0 OR s.status IN ('open', 'locked', 'settled')) THEN 0
               WHEN s.stage_type = 'bracket' THEN 1
               ELSE 2
             END, s.sort_order ASC, s.id ASC LIMIT 1"
        );
        $stageStmt->execute([$contestId]);
        $stage = $stageStmt->fetch(PDO::FETCH_ASSOC);
        $matches = $stage ? moeFetchStageMatches($db, (int)$stage['id']) : [];
        $champion = null;
        for ($i = count($matches) - 1; $i >= 0; $i--) {
            if (!empty($matches[$i]['winner_candidate_id'])) {
                $champion = [
                    'id' => (int)$matches[$i]['winner_candidate_id'],
                    'name' => $matches[$i]['winner_name'] ?? '',
                    'name_cn' => $matches[$i]['winner_name_cn'] ?? '',
                    'avatar_url' => $matches[$i]['winner_avatar'] ?? '',
                ];
                break;
            }
        }
        moeRespond([
            'success' => true,
            'contest' => $contest,
            'stage' => $stage ?: null,
            'matches' => $matches,
            'champion' => $champion,
        ]);

    case 'generate':
        $input = moeReadJson();
        [$user, $contest, $stage] = moeRequireStageManagerForMatches((int)($input['stage_id'] ?? 0));
        $force = !empty($input['force']);
        $config = moeDecodeJsonObject($stage['config_json'] ?? null);
        $bracketSize = max(2, (int)($config['bracket_size'] ?? (($stage['stage_type'] ?? '') === 'final' ? 2 : 32)));

        $existingStmt = $db->prepare("SELECT COUNT(*) FROM moe_matches WHERE stage_id = ?");
        $existingStmt->execute([(int)$stage['id']]);
        if ((int)$existingStmt->fetchColumn() > 0 && !$force) {
            moeRespond(['success' => false, 'message' => '该阶段已存在对阵，请确认后重新生成'], 409);
        }
        if ($force) {
            $db->prepare("DELETE FROM moe_matches WHERE stage_id = ?")->execute([(int)$stage['id']]);
        }

        $entryStmt = $db->prepare(
            "SELECT e.candidate_id
             FROM moe_stage_entries e
             JOIN moe_candidates c ON c.id = e.candidate_id
             WHERE e.stage_id = ? AND e.status = 'active' AND c.status = 'approved'
             ORDER BY COALESCE(e.seed_no, 999999), e.id"
        );
        $entryStmt->execute([(int)$stage['id']]);
        $candidateIds = array_map('intval', $entryStmt->fetchAll(PDO::FETCH_COLUMN));

        if (count($candidateIds) === 0) {
            $fallbackStmt = $db->prepare(
                "SELECT id FROM moe_candidates WHERE contest_id = ? AND status = 'approved' ORDER BY id ASC"
            );
            $fallbackStmt->execute([(int)$stage['contest_id']]);
            $candidateIds = array_map('intval', $fallbackStmt->fetchAll(PDO::FETCH_COLUMN));
        }

        if (count($candidateIds) < 2) {
            moeRespond(['success' => false, 'message' => '至少需要 2 个已审核候选才能生成对阵'], 400);
        }

        $candidateIds = array_slice($candidateIds, 0, $bracketSize);
        $seedOrder = moeBracketSeedOrder($bracketSize);
        $seededCandidateIds = [];
        foreach ($seedOrder as $seedNo) {
            $seededCandidateIds[] = $candidateIds[$seedNo - 1] ?? null;
        }

        $insert = $db->prepare(
            "INSERT INTO moe_matches (stage_id, round_no, match_no, slot_a_candidate_id, slot_b_candidate_id, winner_candidate_id, status)
             VALUES (?, 1, ?, ?, ?, ?, ?)"
        );
        $matchNo = 1;
        for ($i = 0; $i < count($seededCandidateIds); $i += 2) {
            $a = $seededCandidateIds[$i] ?? null;
            $b = $seededCandidateIds[$i + 1] ?? null;
            if ($a === null && $b === null) {
                continue;
            }
            $winner = $b === null ? $a : null;
            $status = $b === null ? 'settled' : 'pending';
            $insert->execute([(int)$stage['id'], $matchNo, $a, $b, $winner, $status]);
            $matchNo++;
        }

        logAction('moe_match.generate', 'moe_contest_stages', (int)$stage['id'], [
            'count' => $matchNo - 1,
            'bracket_size' => $bracketSize,
        ]);
        moeRespond(['success' => true, 'matches' => $matchNo - 1, 'bracket_size' => $bracketSize]);

    case 'update':
        $input = moeReadJson();
        $matchId = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        $stmt = $db->prepare("SELECT * FROM moe_matches WHERE id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$match) {
            moeRespond(['success' => false, 'message' => '场次不存在'], 404);
        }
        [$user, $contest, $stage] = moeRequireStageManagerForMatches((int)$match['stage_id']);
        $status = moeNormalizeStatus($input['status'] ?? $match['status'], ['pending', 'open', 'locked', 'settled'], $match['status']);
        $now = moeNowExpr();
        $update = $db->prepare(
            "UPDATE moe_matches
             SET round_no = ?, match_no = ?, slot_a_candidate_id = ?, slot_b_candidate_id = ?, status = ?,
                 starts_at = ?, ends_at = ?, tie_break_rule = ?, updated_at = $now
             WHERE id = ?"
        );
        $update->execute([
            (int)($input['round_no'] ?? $match['round_no']),
            (int)($input['match_no'] ?? $match['match_no']),
            isset($input['slot_a_candidate_id']) ? (int)$input['slot_a_candidate_id'] : $match['slot_a_candidate_id'],
            isset($input['slot_b_candidate_id']) ? (int)$input['slot_b_candidate_id'] : $match['slot_b_candidate_id'],
            $status,
            $input['starts_at'] ?? ($match['starts_at'] ?? null),
            $input['ends_at'] ?? ($match['ends_at'] ?? null),
            $input['tie_break_rule'] ?? ($match['tie_break_rule'] ?? 'extra_match'),
            $matchId,
        ]);
        logAction('moe_match.update', 'moe_matches', $matchId, null);
        moeRespond(['success' => true]);

    case 'open':
    case 'lock':
        $matchId = (int)($_GET['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM moe_matches WHERE id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$match) {
            moeRespond(['success' => false, 'message' => '场次不存在'], 404);
        }
        [$user, $contest, $stage] = moeRequireStageManagerForMatches((int)$match['stage_id']);
        $target = $action === 'open' ? 'open' : 'locked';
        $now = moeNowExpr();
        $db->prepare("UPDATE moe_matches SET status = ?, updated_at = $now WHERE id = ?")->execute([$target, $matchId]);
        logAction('moe_match.' . $action, 'moe_matches', $matchId, null);
        moeRespond(['success' => true, 'status' => $target]);

    case 'settle':
        $input = moeReadJson();
        $matchId = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        $stmt = $db->prepare("SELECT * FROM moe_matches WHERE id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$match) {
            moeRespond(['success' => false, 'message' => '场次不存在'], 404);
        }
        [$user, $contest, $stage] = moeRequireStageManagerForMatches((int)$match['stage_id']);
        $winnerId = (int)($input['winner_candidate_id'] ?? 0);
        if ($winnerId <= 0) {
            $voteStmt = $db->prepare(
                "SELECT candidate_id, COUNT(*) AS votes
                 FROM moe_votes
                 WHERE match_id = ?
                 GROUP BY candidate_id
                 ORDER BY votes DESC"
            );
            $voteStmt->execute([$matchId]);
            $rows = $voteStmt->fetchAll(PDO::FETCH_ASSOC);
            if (count($rows) === 0 || (count($rows) > 1 && (int)$rows[0]['votes'] === (int)$rows[1]['votes'])) {
                moeRespond(['success' => false, 'message' => '无法自动判定胜者，请手动选择或加赛'], 409);
            }
            $winnerId = (int)$rows[0]['candidate_id'];
        }
        if (!in_array($winnerId, [(int)$match['slot_a_candidate_id'], (int)$match['slot_b_candidate_id']], true)) {
            moeRespond(['success' => false, 'message' => '胜者必须来自本场对阵'], 400);
        }
        $now = moeNowExpr();
        $db->prepare("UPDATE moe_matches SET winner_candidate_id = ?, status = 'settled', updated_at = $now WHERE id = ?")
            ->execute([$winnerId, $matchId]);
        $advance = moeAdvanceBracketIfRoundComplete($db, $stage, (int)$match['round_no']);
        logAction('moe_match.settle', 'moe_matches', $matchId, ['winner_candidate_id' => $winnerId]);
        moeRespond(['success' => true, 'winner_candidate_id' => $winnerId, 'advance' => $advance]);

    default:
        moeRespond(['success' => false, 'message' => '未知操作 action=' . $action], 400);
}
