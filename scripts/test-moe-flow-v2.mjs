import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const php = String.raw`
<?php
define('DB_PATH', ':memory:');
require_once getcwd() . '/includes/vote_projects.php';

$db = getDB();
$db->exec("CREATE TABLE vote_projects (id INTEGER PRIMARY KEY, project_type TEXT, club_id INTEGER, country TEXT, title TEXT, status TEXT, eligibility_mode TEXT DEFAULT 'public', visibility TEXT DEFAULT 'public', updated_at TEXT, ended_at TEXT)");
$db->exec("CREATE TABLE vote_stages (id INTEGER PRIMARY KEY, project_id INTEGER, stage_type TEXT, title TEXT, status TEXT, sort_order INTEGER, starts_at TEXT, ends_at TEXT, vote_mode TEXT, group_count INTEGER, max_select INTEGER, advance_count INTEGER, score_min INTEGER, score_max INTEGER, allow_vote_change INTEGER, result_visibility TEXT, config_json TEXT, updated_at TEXT)");
$db->exec("CREATE TABLE vote_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, source_type TEXT, source_id TEXT, title TEXT, title_cn TEXT, subtitle TEXT, image_url TEXT, identity_key TEXT, entry_status TEXT)");
$db->exec("CREATE TABLE vote_flow_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, version_no INTEGER, status TEXT, created_by INTEGER, snapshot_json TEXT)");
$db->exec("CREATE TABLE vote_flow_pools (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, project_id INTEGER, stage_id INTEGER, stage_type TEXT, title TEXT, status TEXT, vote_mode TEXT, group_count INTEGER, max_select INTEGER, advance_count INTEGER, config_json TEXT, opened_at TEXT, settled_at TEXT)");
$db->exec("CREATE TABLE vote_flow_pool_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, entry_id INTEGER, group_key TEXT, seed_no INTEGER, source_pool_id INTEGER, source_rank INTEGER, status TEXT)");
$db->exec("CREATE TABLE vote_flow_results (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, entry_id INTEGER, rank_no INTEGER, votes INTEGER, score_total INTEGER DEFAULT 0, rating_count INTEGER DEFAULT 0, score_avg REAL, advanced INTEGER, snapshot_json TEXT)");
$db->exec("CREATE TABLE vote_flow_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, stage_id INTEGER, round_no INTEGER, match_no INTEGER, slot_a_entry_id INTEGER, slot_b_entry_id INTEGER, winner_entry_id INTEGER, status TEXT, next_match_id INTEGER, next_slot TEXT, updated_at TEXT)");
$db->exec("CREATE TABLE vote_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, stage_id INTEGER, entry_id INTEGER, match_id INTEGER, user_id INTEGER, vote_value INTEGER, score_value INTEGER)");
$db->exec("CREATE TABLE vote_flow_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, event_type TEXT, payload_json TEXT)");

$db->exec("INSERT INTO vote_projects (id, project_type, club_id, title, status) VALUES (1, 'moe', 1, 'v2', 'running')");
$db->exec("INSERT INTO vote_stages VALUES (11, 1, 'qualifier', 'qualifier', 'pending', 1, NULL, '2099-01-01 00:00:00', 'multi_select', 4, 2, 4, 1, 10, 1, 'live_rank_only', '{}', NULL)");
$db->exec("INSERT INTO vote_stages VALUES (12, 1, 'qualifier', 'tie', 'open', 2, NULL, '2099-01-01 00:00:00', 'multi_select', 1, 4, 4, 1, 10, 0, 'live_votes', '{}', NULL)");
$db->exec("INSERT INTO vote_stages VALUES (13, 1, 'bracket', 'bracket', 'open', 3, NULL, '2000-01-01 00:00:00', 'match_single', 1, 1, 2, 1, 10, 0, 'live_votes', '{}', NULL)");
for ($i = 1; $i <= 9; $i++) {
    $db->prepare("INSERT INTO vote_entries (project_id, source_type, source_id, title, identity_key, entry_status) VALUES (1, 'manual', ?, ?, ?, 'approved')")
        ->execute([$i, 'entry'.$i, 'manual:'.$i]);
}
$entryIds = array_map('intval', $db->query("SELECT id FROM vote_entries ORDER BY id")->fetchAll(PDO::FETCH_COLUMN));
$db->exec("INSERT INTO vote_flow_runs (project_id, version_no, status, created_by, snapshot_json) VALUES (1, 1, 'active', 1, '{}')");
$runId = (int)$db->lastInsertId();
$run = ['id' => $runId, 'project_id' => 1, 'version_no' => 1];

$stage = voteFetchStage(11);
$poolA = voteFlowCreatePool($db, $run, $stage);
voteFlowSeedPoolEntries($db, $poolA, $entryIds);
$poolB = voteFlowCreatePool($db, $run, $stage);
voteFlowSeedPoolEntries($db, $poolB, $entryIds);
$mapFor = function ($poolId) use ($db) {
    $stmt = $db->prepare("SELECT entry_id, group_key FROM vote_flow_pool_entries WHERE pool_id = ? ORDER BY entry_id");
    $stmt->execute([$poolId]);
    return $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
};
$mapA = $mapFor((int)$poolA['id']);
$mapB = $mapFor((int)$poolB['id']);
$sizes = array_count_values($mapA);

$invalidRejected = false;
try {
    voteValidateMoePoolConfig(array_merge($poolA, ['advance_count' => 6]), 9);
} catch (Throwable $e) {
    $invalidRejected = true;
}

$scorePool = [
    'vote_mode' => 'score',
    'stage_type' => 'qualifier',
    'group_count' => 1,
    'advance_count' => 4,
    'config_json' => voteJson(['rule_version' => 2]),
];
$scoreRows = [
    ['entry_id' => 1, 'group_key' => '', 'seed_no' => 1, 'score_total' => 20, 'rating_count' => 2, 'score_avg' => 10],
    ['entry_id' => 2, 'group_key' => '', 'seed_no' => 2, 'score_total' => 20, 'rating_count' => 3, 'score_avg' => 6.667],
    ['entry_id' => 3, 'group_key' => '', 'seed_no' => 3, 'score_total' => 19, 'rating_count' => 2, 'score_avg' => 9.5],
    ['entry_id' => 4, 'group_key' => '', 'seed_no' => 4, 'score_total' => 18, 'rating_count' => 2, 'score_avg' => 9],
];
$scoreOrder = array_map(fn($row) => (int)$row['entry_id'], voteFlowRankRowsForPool($scorePool, $scoreRows));

$tieStage = voteFetchStage(12);
$tiePool = voteFlowCreatePool($db, $run, $tieStage);
voteFlowSeedPoolEntries($db, $tiePool, array_slice($entryIds, 0, 8));
$canRebuildBeforeVotes = voteFlowPoolCanRebuild($db, $tiePool);
$db->prepare("UPDATE vote_flow_pools SET status = 'open' WHERE id = ?")->execute([(int)$tiePool['id']]);
$tiePool = voteFlowPoolById($db, (int)$tiePool['id']);
$tieEntries = voteFlowPoolEntries($db, (int)$tiePool['id']);
$values = [8, 7, 6, 5, 5, 3, 2, 1];
foreach ($tieEntries as $index => $entry) {
    $db->prepare("INSERT INTO vote_votes (project_id, stage_id, entry_id, user_id, vote_value) VALUES (1, 12, ?, ?, ?)")
        ->execute([(int)$entry['entry_id'], 100 + $index, $values[$index]]);
}
$canRebuildAfterVotes = voteFlowPoolCanRebuild($db, $tiePool);
$tieResult = voteFlowSettlePool($db, $tiePool);
$tieBreak = $tieResult['tie_breaks'][0];
$chosen = (int)$tieBreak['entry_ids'][0];
$resolved = voteFlowResolvePoolTie($db, voteFlowPoolById($db, (int)$tiePool['id']), [[
    'group_key' => $tieBreak['group_key'],
    'entry_ids' => [$chosen],
]]);

$bracketStage = voteFetchStage(13);
$bracketPool = voteFlowCreatePool($db, $run, $bracketStage);
voteFlowSeedPoolEntries($db, $bracketPool, array_slice($entryIds, 0, 4));
$matches = voteFlowGenerateMatches($db, $bracketPool);
$matchResult = voteFlowSettleOpenMatchesByVotes($db, $bracketPool);
$bracketFresh = voteFlowPoolById($db, (int)$bracketPool['id']);

$flagsRank = voteResultVisibilityFlags(['status' => 'running'], 'open', 'live_rank_only');
$flagsAfter = voteResultVisibilityFlags(['status' => 'running'], 'open', 'after_stage');

echo json_encode([
    'runtime' => voteFlowPoolRuntime($poolA, $stage),
    'stable_groups' => $mapA === $mapB,
    'group_sizes' => array_values($sizes),
    'invalid_rejected' => $invalidRejected,
    'can_rebuild_before_votes' => $canRebuildBeforeVotes,
    'can_rebuild_after_votes' => $canRebuildAfterVotes,
    'score_order' => $scoreOrder,
    'tie_status' => $tieResult['status'],
    'tie_slots' => (int)$tieBreak['slots'],
    'resolved_status' => $db->query("SELECT status FROM vote_flow_pools WHERE id = ".(int)$tiePool['id'])->fetchColumn(),
    'resolved_advanced' => (int)$resolved['advanced_count'],
    'match_status' => $bracketFresh['status'],
    'unresolved_matches' => count($matchResult['unresolved']),
    'rank_flags' => $flagsRank,
    'after_flags' => $flagsAfter,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
`;

const result = spawnSync('php', { input: php, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
const start = result.stdout.indexOf('{');
assert.ok(start >= 0, result.stdout);
const data = JSON.parse(result.stdout.slice(start));

assert.equal(data.runtime.rule_version, 2);
assert.equal(data.runtime.group_ticket_scope, 'per_group');
assert.equal(data.runtime.scoring_method, 'total_points');
assert.equal(data.stable_groups, true);
assert.ok(Math.max(...data.group_sizes) - Math.min(...data.group_sizes) <= 1);
assert.equal(data.invalid_rejected, true);
assert.equal(data.can_rebuild_before_votes, true);
assert.equal(data.can_rebuild_after_votes, false);
assert.deepEqual(data.score_order, [2, 1, 3, 4]);
assert.equal(data.tie_status, 'reviewing');
assert.equal(data.tie_slots, 1);
assert.equal(data.resolved_status, 'settled');
assert.equal(data.resolved_advanced, 4);
assert.equal(data.match_status, 'reviewing');
assert.equal(data.unresolved_matches, 2);
assert.deepEqual(data.rank_flags, { rank_visible: true, metrics_visible: false });
assert.deepEqual(data.after_flags, { rank_visible: false, metrics_visible: false });

console.log('moe flow v2 checks passed');
