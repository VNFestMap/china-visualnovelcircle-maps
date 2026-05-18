import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const helperPath = path.join(root, 'includes', 'moe.php');
const migratePath = path.join(root, 'scripts', 'migrate.php');
const packagePath = path.join(root, 'package.json');
const bangumiProxyPath = path.join(root, 'api', 'bangumi_proxy.php');

assert.ok(fs.existsSync(helperPath), 'includes/moe.php should exist');
assert.ok(fs.existsSync(bangumiProxyPath), 'api/bangumi_proxy.php should exist');

const helper = fs.readFileSync(helperPath, 'utf8');
const migrate = fs.readFileSync(migratePath, 'utf8');
const pkg = fs.readFileSync(packagePath, 'utf8');
const bangumiProxy = fs.readFileSync(bangumiProxyPath, 'utf8');

[
  'moeEnsureSchema',
  'moeCanCreateClubContest',
  'moeCanManageContest',
  'moeCanParticipateContest',
  'moeClientIpHash',
  'moeUserAgentHash',
].forEach((fn) => {
  assert.match(helper, new RegExp(`function\\s+${fn}\\s*\\(`), `${fn} helper should be defined`);
});

[
  'moe_contests',
  'moe_contest_stages',
  'moe_candidates',
  'moe_candidate_nominations',
  'moe_stage_entries',
  'moe_matches',
  'moe_votes',
  'moe_invites',
  'moe_whitelist',
].forEach((table) => {
  assert.match(helper, new RegExp(table), `${table} table should be created by moeEnsureSchema`);
});

[
  'moeNormalizeCandidateIdentity',
  'moeFindOrCreateCandidateFromNomination',
  'moeGetNominationLimit',
  'moeSettleNominationStage',
  'moeCreateStandardContestStages',
  'moeSettleQualifierStage',
  'moeBracketSeedOrder',
].forEach((fn) => {
  assert.match(helper, new RegExp(`function\\s+${fn}\\s*\\(`), `${fn} helper should be defined`);
});

assert.match(migrate, /require_once __DIR__ \. '\/\.\.\/includes\/moe\.php'/, 'migration should load moe helpers');
assert.match(migrate, /moeEnsureSchema\(\$db\)/, 'migration should create moe tables');

const apiContracts = [
  {
    file: 'api/moe_contests.php',
    actions: ['list', 'my_manageable', 'get', 'create', 'update', 'publish', 'suspend', 'archive', 'delete'],
  },
  {
    file: 'api/moe_stages.php',
    actions: ['list', 'create', 'update', 'reorder', 'open', 'lock', 'settle'],
  },
  {
    file: 'api/moe_candidates.php',
    actions: ['list', 'nominate', 'my_nominations', 'nomination_summary', 'withdraw_nomination', 'update', 'approve', 'reject', 'withdraw'],
  },
  {
    file: 'api/moe_matches.php',
    actions: ['list', 'contest_bracket', 'generate', 'update', 'open', 'lock', 'settle'],
  },
  {
    file: 'api/moe_votes.php',
    actions: ['eligibility', 'cast', 'my_votes', 'stage_results', 'match_results'],
  },
];

for (const contract of apiContracts) {
  const filePath = path.join(root, contract.file);
  assert.ok(fs.existsSync(filePath), `${contract.file} should exist`);
  const source = fs.readFileSync(filePath, 'utf8');
  assert.match(source, /moeEnsureSchema\(\)/, `${contract.file} should ensure schema`);
  assert.match(source, /require_once __DIR__ \. '\/\.\.\/includes\/moe\.php'/, `${contract.file} should use moe helper`);
  for (const action of contract.actions) {
    assert.match(source, new RegExp(`case\\s+['"]${action}['"]`), `${contract.file} should support action=${action}`);
  }
}

const candidateApi = fs.readFileSync(path.join(root, 'api', 'moe_candidates.php'), 'utf8');
assert.match(candidateApi, /stage_id/, 'nominate action should require a nomination stage_id');
assert.match(candidateApi, /moeFindOrCreateCandidateFromNomination/, 'nominate action should deduplicate through the helper');
assert.match(candidateApi, /moeGetNominationLimit/, 'nominate action should enforce nomination quota');
assert.match(
  candidateApi,
  /moeCanManageContest\(\$user,\s*\$contest\)[\s\S]*moeCanParticipateContest\(\$user,\s*\$contest\)/,
  'contest managers should be allowed to nominate candidates from the manager UI',
);

const stageApi = fs.readFileSync(path.join(root, 'api', 'moe_stages.php'), 'utf8');
assert.match(stageApi, /moeSettleNominationStage/, 'settling nomination stages should generate next-stage entries');
assert.match(stageApi, /moeSettleQualifierStage/, 'settling qualifier stages should advance the top 32 into bracket entries');
assert.match(stageApi, /array_key_exists\('ends_at',\s*\$input\)/, 'stage updates should allow clearing or changing default stage end times');
assert.match(stageApi, /array_key_exists\('config_json',\s*\$input\)/, 'stage updates should allow replacing default stage config');

const contestsApiSource = fs.readFileSync(path.join(root, 'api', 'moe_contests.php'), 'utf8');
assert.match(
  contestsApiSource,
  /moeCreateStandardContestStages\(\$db,\s*\$id\)/,
  'creating a contest should also create the standard nomination, qualifier, bracket, and final stages',
);
assert.match(contestsApiSource, /confirm_title/, 'deleting a contest should require explicit title confirmation');
assert.match(contestsApiSource, /DELETE FROM moe_votes[\s\S]*DELETE FROM moe_contests/, 'deleting a contest should remove dependent moe records before the contest row');
assert.match(helper, /'stage_type'\s*=>\s*'final'[\s\S]*'title'\s*=>\s*'决赛'/, 'standard contest stages should include a separate final stage');

const matchApi = fs.readFileSync(path.join(root, 'api', 'moe_matches.php'), 'utf8');
assert.match(
  matchApi,
  /function\s+moeAdvanceBracketIfRoundComplete\s*\(/,
  'match API should define automatic bracket advancement helper',
);
assert.match(
  matchApi,
  /moeAdvanceBracketIfRoundComplete\(\$db,\s*\$stage,\s*\(int\)\$match\['round_no'\]\)/,
  'settling a match should attempt automatic advancement for the completed round',
);
assert.match(
  matchApi,
  /SELECT COUNT\(\*\) FROM moe_matches WHERE stage_id = \? AND round_no = \?/,
  'automatic advancement should avoid creating duplicate next-round matches',
);
assert.match(
  matchApi,
  /UPDATE moe_contest_stages SET status = 'settled'/,
  'automatic advancement should settle the stage when only one winner remains',
);
assert.match(matchApi, /function\s+moeFindNextFinalStage\s*\(/, 'match API should find the separate final stage after bracket play');
assert.match(matchApi, /function\s+moeAdvanceWinnersToFinalStage\s*\(/, 'match API should advance bracket finalists into the final stage');
assert.match(matchApi, /final_stage_ready/, 'settling bracket semifinals should report when the final stage is ready');
assert.match(matchApi, /case\s+['"]contest_bracket['"]/, 'match API should expose a public contest bracket endpoint');
assert.match(matchApi, /bracket_size/, 'match generation should use bracket_size configuration');
assert.match(matchApi, /moeBracketSeedOrder/, 'match generation should seed the bracket order');

const votesApi = fs.readFileSync(path.join(root, 'api', 'moe_votes.php'), 'utf8');
assert.match(
  votesApi,
  /moe_stage_entries/,
  'stage results should prefer active stage entries when calculating qualifier rankings',
);
assert.match(
  votesApi,
  /source_rank/,
  'qualifier rankings should expose entry source_rank data for advancement audits',
);

[
  'bangumiRequest',
  'normalizeBangumiCharacter',
].forEach((fn) => {
  assert.match(bangumiProxy, new RegExp(`function\\s+${fn}\\s*\\(`), `${fn} should be defined for moe nomination support`);
});

[
  'search_subject',
  'search_character',
  'subject_characters',
  'get_character',
].forEach((action) => {
  assert.match(
    bangumiProxy,
    new RegExp(`\\$action\\s*===\\s*['"]${action}['"]|['"]${action}['"]\\s*===\\s*\\$action`),
    `bangumi proxy should support action=${action}`,
  );
});
assert.match(bangumiProxy, /v0\/search\/characters/, 'bangumi proxy should search characters through v0 API');
assert.match(bangumiProxy, /v0\/subjects\/.*\/characters/, 'bangumi proxy should fetch subject characters');

assert.match(pkg, /test-moe-contest-contract\.mjs/, 'npm check should include moe contest contract test');

console.log('moe contest contract tests passed');
