import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const php = String.raw`
<?php
define('DB_PATH', ':memory:');
require_once getcwd() . '/includes/vote_projects.php';

$db = getDB();
$db->exec("CREATE TABLE vote_projects (id INTEGER PRIMARY KEY, project_type TEXT, club_id INTEGER, country TEXT, title TEXT, status TEXT, eligibility_mode TEXT DEFAULT 'public', visibility TEXT DEFAULT 'public', updated_at TEXT, ended_at TEXT)");
$db->exec("CREATE TABLE vote_stages (id INTEGER PRIMARY KEY, project_id INTEGER, stage_type TEXT, title TEXT, status TEXT, sort_order INTEGER, starts_at TEXT, ends_at TEXT, vote_mode TEXT, group_count INTEGER, max_select INTEGER, advance_count INTEGER, score_min INTEGER, score_max INTEGER, allow_vote_change INTEGER, result_visibility TEXT, config_json TEXT, updated_at TEXT)");
$db->exec("CREATE TABLE vote_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, source_type TEXT, source_id TEXT, title TEXT, title_cn TEXT, subtitle TEXT, image_url TEXT, identity_key TEXT, entry_status TEXT, reviewed_at TEXT, summary TEXT)");
$db->exec("CREATE TABLE vote_flow_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, version_no INTEGER, status TEXT, created_by INTEGER, snapshot_json TEXT, archived_at TEXT)");
$db->exec("CREATE TABLE vote_flow_pools (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, project_id INTEGER, stage_id INTEGER, stage_type TEXT, title TEXT, status TEXT, vote_mode TEXT, group_count INTEGER, max_select INTEGER, advance_count INTEGER, config_json TEXT, opened_at TEXT, settled_at TEXT)");
$db->exec("CREATE TABLE vote_flow_pool_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, entry_id INTEGER, group_key TEXT, seed_no INTEGER, source_pool_id INTEGER, source_rank INTEGER, status TEXT)");
$db->exec("CREATE TABLE vote_flow_results (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, entry_id INTEGER, rank_no INTEGER, votes INTEGER, score_total INTEGER DEFAULT 0, rating_count INTEGER DEFAULT 0, score_avg REAL, advanced INTEGER, snapshot_json TEXT)");
$db->exec("CREATE TABLE vote_flow_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, stage_id INTEGER, round_no INTEGER, match_no INTEGER, slot_a_entry_id INTEGER, slot_b_entry_id INTEGER, winner_entry_id INTEGER, status TEXT, next_match_id INTEGER, next_slot TEXT, updated_at TEXT)");
$db->exec("CREATE TABLE vote_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, stage_id INTEGER, entry_id INTEGER, match_id INTEGER, user_id INTEGER, vote_value INTEGER, score_value INTEGER)");
$db->exec("CREATE TABLE vote_flow_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, pool_id INTEGER, project_id INTEGER, event_type TEXT, payload_json TEXT)");

$db->exec("INSERT INTO vote_projects (id, project_type, club_id, country, title, status) VALUES (1, 'twelve', 1, 'china', 'twelve v2', 'running')");
$db->exec("INSERT INTO vote_stages VALUES (1, 1, 'nomination', '提名期', 'open', 1, NULL, '2099-01-01 00:00:00', 'nomination', 1, 1, 0, 1, 10, 0, 'live_rank_only', '{}', NULL)");
$db->exec("INSERT INTO vote_stages VALUES (2, 1, 'qualifier', '海选', 'pending', 2, NULL, '2099-01-01 00:00:00', 'multi_select', 2, 12, 48, 1, 10, 0, 'live_rank_only', '{}', NULL)");
$db->exec("INSERT INTO vote_stages VALUES (3, 1, 'group_vote', '分组投票', 'pending', 3, NULL, '2099-01-01 00:00:00', 'multi_select', 4, 12, 24, 1, 10, 0, 'live_rank_only', '{}', NULL)");
$db->exec("INSERT INTO vote_stages VALUES (4, 1, 'final', '最终十二器', 'pending', 4, NULL, '2099-01-01 00:00:00', 'multi_select', 1, 12, 12, 1, 10, 0, 'after_stage', '{}', NULL)");

for ($i = 1; $i <= 60; $i++) {
    $db->prepare("INSERT INTO vote_entries (project_id, source_type, source_id, title, identity_key, entry_status) VALUES (1, 'manual', ?, ?, ?, 'approved')")
        ->execute([$i, 'work'.$i, 'manual:'.$i]);
}

$project = ['id' => 1, 'project_type' => 'twelve', 'status' => 'running'];

// 从提名生成海选池并打开
$rebuilt = voteFlowRebuildFromNominationAndOpen($db, $project, 1);
$qualifierPool = $rebuilt['pool'];
$qualifierStage = voteFetchStage(2);

$seeded = (int)$rebuilt['seeded_count'];
$readback = (int)$rebuilt['readback_count'];

// 海选投票：为每个作品投 1 票，并人为让 G1 高分、G2 低分便于断言
$qualifierEntries = voteFlowPoolEntries($db, (int)$qualifierPool['id']);
foreach ($qualifierEntries as $index => $entry) {
    $votes = $entry['group_key'] === 'G1' ? ($index + 1) : 1;
    $db->prepare("INSERT INTO vote_votes (project_id, stage_id, entry_id, user_id, vote_value) VALUES (1, 2, ?, ?, ?)")
        ->execute([(int)$entry['entry_id'], 100 + $index, $votes]);
}
$qualifierSettled = voteFlowSettlePool($db, $qualifierPool);
$advancedAfterQualifier = (int)$qualifierSettled['advanced_count'];

// 验证非萌战规则版本下排名行为
$rankRows = voteFlowRankRowsForPool($qualifierPool, array_map(function ($e) {
    return [
        'entry_id' => (int)$e['entry_id'],
        'group_key' => (string)$e['group_key'],
        'seed_no' => (int)$e['seed_no'],
        'votes' => (int)($e['group_key'] === 'G1' ? 10 : 1),
    ];
}, $qualifierEntries));
$advancedFromRank = count(array_filter($rankRows, fn($r) => !empty($r['_advanced'])));

// 生成下一阶段池（分组投票）
$groupPoolResult = voteFlowGenerateNextPool($db, voteFlowPoolById($db, (int)$qualifierPool['id']));
$groupPool = voteFlowPoolById($db, (int)$groupPoolResult['pool']['id']);
$groupPool = voteFlowOpenPool($db, $groupPool);
$groupStage = voteFetchStage(3);

$groupEntryCount = voteFlowPoolEntryCount($db, (int)$groupPool['id']);
$groupGroups = [];
foreach (voteFlowPoolEntries($db, (int)$groupPool['id']) as $e) {
    $groupGroups[(string)$e['group_key']] = ($groupGroups[(string)$e['group_key']] ?? 0) + 1;
}

// 分组投票
$groupEntries = voteFlowPoolEntries($db, (int)$groupPool['id']);
foreach ($groupEntries as $index => $entry) {
    $db->prepare("INSERT INTO vote_votes (project_id, stage_id, entry_id, user_id, vote_value) VALUES (1, 3, ?, ?, 1)")
        ->execute([(int)$entry['entry_id'], 200 + $index]);
}
$groupSettled = voteFlowSettlePool($db, $groupPool);
$advancedAfterGroup = (int)$groupSettled['advanced_count'];

// 生成最终池
$finalPoolResult = voteFlowGenerateNextPool($db, voteFlowPoolById($db, (int)$groupPool['id']));
$finalPool = voteFlowPoolById($db, (int)$finalPoolResult['pool']['id']);
$finalPool = voteFlowOpenPool($db, $finalPool);
$finalStage = voteFetchStage(4);

// 最终投票
$finalEntries = voteFlowPoolEntries($db, (int)$finalPool['id']);
foreach ($finalEntries as $index => $entry) {
    $db->prepare("INSERT INTO vote_votes (project_id, stage_id, entry_id, user_id, vote_value) VALUES (1, 4, ?, ?, ?)")
        ->execute([(int)$entry['entry_id'], 300 + $index, 60 - $index]);
}
$finalSettled = voteFlowSettlePool($db, $finalPool);
$finalPool = voteFlowPoolById($db, (int)$finalPool['id']);

$finalResults = $db->query("SELECT * FROM vote_flow_results WHERE pool_id = ".(int)$finalPool['id']." ORDER BY rank_no ASC")->fetchAll(PDO::FETCH_ASSOC);
$projectStatus = $db->query("SELECT status FROM vote_projects WHERE id = 1")->fetchColumn();

$flagsOpen = voteResultVisibilityFlags($project, 'open', 'live_rank_only');
$flagsSettled = voteResultVisibilityFlags($project, 'settled', 'after_stage');

// 海选池 runtime 不应该是萌战规则版本 2
$qualifierRuntime = voteFlowPoolRuntime($qualifierPool, $qualifierStage);

echo json_encode([
    'seeded' => $seeded,
    'readback' => $readback,
    'qualifier_status' => (string)$qualifierPool['status'],
    'advanced_after_qualifier' => $advancedAfterQualifier,
    'advanced_from_rank' => $advancedFromRank,
    'group_entry_count' => $groupEntryCount,
    'group_groups' => $groupGroups,
    'advanced_after_group' => $advancedAfterGroup,
    'final_entry_count' => voteFlowPoolEntryCount($db, (int)$finalPool['id']),
    'final_status' => (string)$finalPool['status'],
    'final_result_count' => count($finalResults),
    'final_top_ids' => array_map(fn($r) => (int)$r['entry_id'], $finalResults),
    'final_top_votes_descending' => array_map(fn($r) => (int)$r['votes'], $finalResults),
    'project_status' => (string)$projectStatus,
    'flags_open' => $flagsOpen,
    'flags_settled' => $flagsSettled,
    'qualifier_rule_version' => (int)$qualifierRuntime['rule_version'],
    'qualifier_group_ticket_scope' => (string)$qualifierRuntime['group_ticket_scope'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
`;

const result = spawnSync('php', { input: php, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
const start = result.stdout.indexOf('{');
assert.ok(start >= 0, result.stdout);
const data = JSON.parse(result.stdout.slice(start));

assert.equal(data.seeded, 60, 'qualifier pool should seed all 60 entries');
assert.equal(data.readback, 60, 'qualifier pool readback should match');
assert.equal(data.qualifier_status, 'open', 'qualifier pool should be open');
assert.equal(data.advanced_after_qualifier, 48, 'qualifier should advance 48 works');
assert.equal(data.advanced_from_rank, 48, 'rank helper should advance 48 works');
assert.equal(data.group_entry_count, 48, 'group vote pool should have 48 entries');
assert.deepEqual(data.group_groups, { G1: 12, G2: 12, G3: 12, G4: 12 }, 'group vote should distribute entries evenly');
assert.equal(data.advanced_after_group, 24, 'group vote should advance 24 works');
assert.equal(data.final_entry_count, 24, 'final pool should have 24 entries');
assert.equal(data.final_status, 'settled', 'final pool should be settled');
assert.equal(data.final_result_count, 24, 'final results should include all 24 entries');
assert.equal(data.project_status, 'ended', 'project should be ended after final settled');
assert.equal(data.final_top_ids.length, 24, 'final top list should contain all finalists');

// 最终票数应降序排列
for (let i = 1; i < data.final_top_votes_descending.length; i++) {
  assert.ok(
    data.final_top_votes_descending[i - 1] >= data.final_top_votes_descending[i],
    'final results should be ordered by votes descending'
  );
}

assert.deepEqual(data.flags_open, { rank_visible: true, metrics_visible: false });
assert.deepEqual(data.flags_settled, { rank_visible: true, metrics_visible: true });
assert.equal(data.qualifier_rule_version, 1, 'twelve should use rule version 1, not moe version 2');
assert.equal(data.qualifier_group_ticket_scope, 'stage', 'twelve default ticket scope should be stage');

console.log('twelve flow v2 checks passed');
