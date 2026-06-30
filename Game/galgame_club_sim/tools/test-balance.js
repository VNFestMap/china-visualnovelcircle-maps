import assert from 'node:assert/strict';
import { actions } from '../src/data/actions.js';
import { pickEnding } from '../src/data/endings.js';
import { calcActionCost, calcProjectRisk } from '../src/game/formulas.js';
import { initialState, buildLegacy } from '../src/game/lifecycle.js';
import { executeAction } from '../src/game/week.js';
import { applyStat, touchDetail } from '../src/state/mutations.js';
import { runSimulation, summarizeSimulations } from './simulation-core.js';
import { allMembers } from '../src/data/members.js';
import { createRecruitCandidates, resolveRecruitChoice, MAX_CORE_MEMBERS } from '../src/game/recruitment.js';
import { calcFitBreakdown } from '../src/game/formulas.js';

function action(id) {
  return actions.find((item) => item.id === id);
}

function execute(state, actionId, memberName = state.members[0].name) {
  state.selectedAction = actionId;
  state.selectedMember = memberName;
  const result = executeAction(state);
  assert.equal(result.ok, true, result.msg);
}

{
  const state = initialState();
  state.stats.__completed = ['sentinel'];
  const before = state.stats.org;
  applyStat(state, { org: 5 });
  touchDetail(state, { schedule: 4 });
  assert.equal(state.stats.org, before + 6);
  assert.deepEqual(state.stats.__completed, ['sentinel']);
}

{
  const state = initialState();
  assert.equal(allMembers.length, 49);
  assert.equal(state.members.length, 6);
  assert.ok(allMembers.every((member) => Math.max(...Object.values(member.aptitudes)) >= 85));
}

{
  const state = initialState();
  const created = createRecruitCandidates(state, action('campus_wall'));
  assert.equal(created, true);
  assert.equal(state.pendingRecruit.candidates.length, 3);
  const recruited = resolveRecruitChoice(state, 0);
  assert.ok(recruited);
  assert.equal(state.members.length, 7);
  assert.ok(!state.recruitPool.some((member) => member.name === recruited.name));
  state.members = allMembers.slice(0, MAX_CORE_MEMBERS);
  state.pendingRecruit = null;
  assert.equal(createRecruitCandidates(state, action('campus_wall')), false);
}

{
  const actionBest = actions.filter((item) => item.id !== 'rest').map((item) => {
    const fits = allMembers.map((member) => calcFitBreakdown(item, member, 0.45, false).score).sort((a, b) => b - a);
    return { id: item.id, first: fits[0], second: fits[1] };
  });
  actionBest.forEach((row) => {
    assert.ok(row.first >= 85, `${row.id} needs an expert`);
    assert.ok(row.second >= 74, `${row.id} needs a second viable member`);
  });
}

{
  const freeActions = ['campus_wall', 'regular_meeting', 'seminar', 'online_game', 'handover', 'funding', 'rest'];
  freeActions.forEach((id) => assert.equal(action(id).cost, 0, `${id} should not require cash`));
}

{
  const state = initialState();
  execute(state, 'tea', '杏子');
  assert.equal(state.members.find((member) => member.name === '杏子').skillCd, 3);
}

{
  const state = initialState();
  execute(state, 'funding');
  assert.equal(state.actionCooldowns.funding, 8);
  assert.equal(state.resources.funds, 940);
}

{
  const state = initialState();
  const beforeStats = { ...state.stats };
  const beforeCulture = { ...state.culture };
  execute(state, 'rest');
  for (const key of ['org', 'exec', 'part', 'content', 'external', 'succession']) {
    assert.equal(state.stats[key], beforeStats[key]);
  }
  assert.deepEqual(state.culture, beforeCulture);
}

{
  const state = initialState();
  const magazine = action('magazine');
  assert.equal(calcActionCost(state, magazine), 200);
  state.projects.push({ id: 'magazine', progress: 28, quality: 12, load: 16, riskModifier: -10 });
  assert.equal(calcActionCost(state, magazine), 40);
  const withModifier = calcProjectRisk(state.projects[0], state);
  state.projects[0].riskModifier = 0;
  assert.equal(calcProjectRisk(state.projects[0], state) - withModifier, 10);
}

{
  const restRun = runSimulation(1, 'rest');
  assert.equal(restRun.projectsCompleted, 0);
  assert.equal(restRun.ending, 'steady');
  assert.ok(restRun.stats.org < 40);
}

{
  const fundingRun = runSimulation(1, 'funding');
  assert.ok(fundingRun.peakFunds < 2000);
}

{
  const summary = summarizeSimulations(Array.from({ length: 60 }, (_, index) => runSimulation(index + 1, 'balanced')));
  assert.ok(summary.funds >= 100 && summary.funds <= 700);
  assert.ok(summary.commonTotal >= 30 && summary.commonTotal <= 85);
  assert.ok(summary.projectsCompleted >= 1 && summary.projectsCompleted <= 3);
  assert.ok(summary.fitAverage >= 72 && summary.fitAverage <= 92);
  assert.ok(summary.avgFatigue >= 10 && summary.avgFatigue <= 55);
  const largestEndingShare = Math.max(...Object.values(summary.endings)) / summary.runs;
  assert.ok(largestEndingShare <= 0.55);
}

{
  const state = initialState();
  state.common.total = 5;
  state.common.active = 5;
  execute(state, 'online_game');
  assert.ok(state.common.active <= state.common.total);
  const ending = pickEnding(state, buildLegacy(state));
  assert.ok(ending);
}

console.log('balance tests passed');
