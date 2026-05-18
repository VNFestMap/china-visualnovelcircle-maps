import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'admin', 'moe_manager.html');
const clubManagerPath = path.join(root, 'admin', 'club_manager.html');
const packagePath = path.join(root, 'package.json');

assert.ok(fs.existsSync(pagePath), 'admin/moe_manager.html should exist');

const page = fs.readFileSync(pagePath, 'utf8');
const clubManager = fs.readFileSync(clubManagerPath, 'utf8');
const pkg = fs.readFileSync(packagePath, 'utf8');

[
  'moe_contests.php',
  'moe_stages.php',
  'moe_candidates.php',
  'moe_matches.php',
  'bangumi_proxy.php',
].forEach((api) => {
  assert.match(page, new RegExp(api), `moe manager should call ${api}`);
});

[
  'loadManageableContests',
  'createMoeContest',
  'loadMoeContestDetail',
  'createMoeStage',
  'updateMoeStage',
  'searchMoeSubjects',
  'loadSubjectCharacters',
  'nominateBangumiCharacter',
  'approveMoeCandidate',
  'generateMoeMatches',
  'openMoeMatch',
  'lockMoeMatch',
  'settleMoeMatch',
].forEach((fn) => {
  assert.match(page, new RegExp(`function\\s+${fn}\\s*\\(`), `${fn} should be defined`);
});

[
  'my_manageable',
  'create',
  'publish',
  'nominate',
  'approve',
  'generate',
  'search_subject',
  'subject_characters',
].forEach((action) => {
  assert.match(page, new RegExp(action), `moe manager should include action=${action}`);
});

assert.match(page, /Moe Contest Manager/, 'page should carry a stable feature marker');
assert.match(page, /data-view="contests"/, 'page should include a contests view');
assert.match(page, /data-view="stages"/, 'page should include a stages view');
assert.match(page, /data-view="candidates"/, 'page should include a candidates view');
assert.match(page, /data-view="matches"/, 'page should include a matches view');
assert.match(page, /value="group_vote"/, 'manager stage type select should use backend stage_type=group_vote');
assert.doesNotMatch(page, /value="group"/, 'manager page should not submit unsupported stage_type=group');
assert.match(page, /value="live_votes"/, 'manager result visibility should support backend live_votes mode');
assert.match(page, /value="after_event"/, 'manager result visibility should support backend after_event mode');
assert.match(page, /data\.advance[\s\S]*advanced/, 'manager page should surface automatic next-round generation after settling');
assert.match(page, /stage_settled/, 'manager page should surface automatic stage settlement after final match');
assert.match(page, /name="nomination_limit"/, 'manager stage form should configure nomination_limit');
assert.match(page, /renderNominationSummary/, 'manager page should render nomination summary');
assert.match(page, /nomination_summary/, 'manager page should call nomination_summary');
assert.match(page, /提名人数/, 'manager page should display nomination counts');
assert.match(page, /installInteractionFeedback/, 'manager page should install click interaction feedback');
assert.match(page, /click-ripple/, 'manager page should render click ripple feedback');
assert.match(page, /is-loading/, 'manager page should expose loading state feedback');
assert.match(page, /prefers-reduced-motion/, 'manager page should respect reduced motion preferences');
assert.match(page, /withButtonFeedback/, 'manager async actions should use button feedback helper');
assert.match(page, /bracket\.html\?contest_id=/, 'manager contest actions should link to the live bracket board');
assert.match(page, /standard-flow/, 'manager overview should explain the standard nomination -> qualifier -> top 32 -> bracket flow');
assert.match(page, /bracket_size/, 'manager stage creation should support bracket_size configuration for 32-player brackets');
assert.match(page, /toggleStageEdit/, 'manager stage cards should expose editable controls for default stages');
assert.match(page, /action:\s*'update'/, 'manager stage editing should call moe_stages update action');
assert.match(clubManager, /moe_manager\.html/, 'club manager should link to moe manager');
assert.match(pkg, /test-moe-manager-ui-contract\.mjs/, 'npm check should include moe manager UI contract test');

console.log('moe manager UI contract tests passed');
