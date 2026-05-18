import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'moe', 'index.html');
const bracketPath = path.join(root, 'moe', 'bracket.html');
const indexPath = path.join(root, 'index.html');
const packagePath = path.join(root, 'package.json');
const contestsApiPath = path.join(root, 'api', 'moe_contests.php');

assert.ok(fs.existsSync(pagePath), 'moe/index.html should exist');
assert.ok(fs.existsSync(bracketPath), 'moe/bracket.html should exist');

const page = fs.readFileSync(pagePath, 'utf8');
const bracketPage = fs.readFileSync(bracketPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const pkg = fs.readFileSync(packagePath, 'utf8');
const contestsApi = fs.readFileSync(contestsApiPath, 'utf8');

[
  'moe_contests.php',
  'moe_candidates.php',
  'moe_matches.php',
  'moe_votes.php',
  'bangumi_proxy.php',
].forEach((api) => {
  assert.match(page, new RegExp(api), `public moe page should call ${api}`);
});

[
  'loadPublicMoeContests',
  'loadMoeContestDetail',
  'renderMoeCandidates',
  'loadMoeMatches',
  'castStageVote',
  'castMatchVote',
  'loadStageResults',
  'loadMatchResults',
  'searchNominationSubjects',
  'loadNominationSubjectCharacters',
  'submitBangumiNomination',
].forEach((fn) => {
  assert.match(page, new RegExp(`function\\s+${fn}\\s*\\(`), `${fn} should be defined`);
});

[
  'list',
  'get',
  'eligibility',
  'cast',
  'stage_results',
  'match_results',
  'search_subject',
  'subject_characters',
].forEach((action) => {
  assert.match(page, new RegExp(action), `public moe page should include action=${action}`);
});

assert.match(page, /Moe Contest Public Portal/, 'public page should carry a stable feature marker');
assert.match(page, /data-panel="contests"/, 'public page should include contest list panel');
assert.match(page, /data-panel="detail"/, 'public page should include contest detail panel');
assert.match(page, /data-panel="voting"/, 'public page should include voting panel');
assert.match(page, /my_nominations/, 'public page should load current user nominations');
assert.match(page, /withdraw_nomination/, 'public page should allow nomination withdrawal while open');
assert.match(page, /nomination_summary/, 'public page should show the deduplicated nomination pool');
assert.match(page, /剩余提名/, 'public page should display remaining nomination quota');
assert.match(page, /function\s+submitNomination\s*\(/, 'public page should define submitNomination');
assert.match(page, /Bangumi/, 'public nomination UI should expose Bangumi nomination search');
assert.match(page, /installInteractionFeedback/, 'public page should install click interaction feedback');
assert.match(page, /click-ripple/, 'public page should render click ripple feedback');
assert.match(page, /is-loading/, 'public page should expose loading state feedback');
assert.match(page, /prefers-reduced-motion/, 'public page should respect reduced motion preferences');
assert.match(page, /withButtonFeedback/, 'public async actions should use button feedback helper');
assert.match(page, /bracket\.html\?contest_id=/, 'public contest detail should link to the live bracket board');
assert.match(index, /moe\/index\.html/, 'home page should link to public moe portal');
assert.match(contestsApi, /countryRaw[\s\S]*all/, 'contest list API should support country=all');
assert.match(pkg, /test-moe-public-ui-contract\.mjs/, 'npm check should include public moe UI contract test');

assert.match(bracketPage, /Moe Contest Bracket Board/, 'bracket page should carry a stable feature marker');
assert.match(bracketPage, /contest_bracket/, 'bracket page should call the public bracket endpoint');
assert.match(bracketPage, /function\s+loadBracketData\s*\(/, 'bracket page should load bracket data');
assert.match(bracketPage, /function\s+renderBracketBoard\s*\(/, 'bracket page should render the tournament board');
assert.match(bracketPage, /bracket-side left/, 'bracket page should render a blue left side');
assert.match(bracketPage, /bracket-side right/, 'bracket page should render an orange right side');
assert.match(bracketPage, /champion-card/, 'bracket page should render the center champion card');
assert.match(bracketPage, /setInterval\(loadBracketData,\s*30000\)/, 'bracket page should refresh live data every 30 seconds');

console.log('moe public UI contract tests passed');
