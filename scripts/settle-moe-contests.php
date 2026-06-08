<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../includes/vote_projects.php';

voteBootstrap();
voteEnsureSchema();

$lockPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'vnfest-moe-settlement.lock';
$lock = fopen($lockPath, 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
    fwrite(STDOUT, json_encode(['success' => true, 'skipped' => 'locked'], JSON_UNESCAPED_UNICODE) . PHP_EOL);
    exit(0);
}

$db = getDB();
$stmt = $db->query(
    "SELECT p.*, s.ends_at AS stage_ends_at
     FROM vote_flow_pools p
     JOIN vote_projects project ON project.id = p.project_id AND project.project_type = 'moe'
     JOIN vote_stages s ON s.id = p.stage_id
     WHERE p.status IN ('open', 'locked')
     ORDER BY p.id ASC"
);

$now = time();
$report = [
    'success' => true,
    'checked' => 0,
    'due' => 0,
    'settled' => [],
    'reviewing' => [],
    'errors' => [],
];

foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $pool) {
    $report['checked']++;
    $runtime = voteFlowPoolRuntime($pool);
    $endsAt = $runtime['ends_at'] ?: ($pool['stage_ends_at'] ?? null);
    $deadline = $endsAt ? strtotime((string)$endsAt) : false;
    if ($deadline === false || $deadline > $now) continue;
    $report['due']++;

    try {
        if (($pool['vote_mode'] ?? '') === 'match_single') {
            $result = voteFlowSettleOpenMatchesByVotes($db, $pool);
            $fresh = voteFlowPoolById($db, (int)$pool['id']);
            $item = [
                'pool_id' => (int)$pool['id'],
                'stage_id' => (int)$pool['stage_id'],
                'settled_count' => count($result['settled']),
                'unresolved_count' => count($result['unresolved']),
                'status' => $fresh['status'] ?? $pool['status'],
            ];
            if ($result['unresolved']) $report['reviewing'][] = $item;
            else $report['settled'][] = $item;
            continue;
        }

        $result = voteFlowSettlePool($db, $pool);
        $item = array_merge([
            'pool_id' => (int)$pool['id'],
            'stage_id' => (int)$pool['stage_id'],
        ], $result);
        if (($result['status'] ?? '') === 'reviewing') $report['reviewing'][] = $item;
        else $report['settled'][] = $item;
    } catch (Throwable $e) {
        $report['errors'][] = [
            'pool_id' => (int)$pool['id'],
            'stage_id' => (int)$pool['stage_id'],
            'message' => $e->getMessage(),
        ];
    }
}

flock($lock, LOCK_UN);
fclose($lock);

fwrite(STDOUT, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
exit($report['errors'] ? 1 : 0);
