// src/game/stages/resolve.js
import { clamp, rand, clone } from '../../utils/math.js';
import { eventPool } from '../../data/events.js';
import { actionDetailMap } from '../../data/stats.js';
import { applyRes, applyStat, touchDetail, addLog } from '../../state/mutations.js';
import { avgFatigue, addReport, reportTitleByWeek, makeReportModalBody, buildLegacy } from '../lifecycle.js';
import { startOrAdvanceProject, projectRisk } from '../projects.js';
import { checkArcs } from '../arcs.js';
import { checkAndUnlock } from '../achievements.js';
import { calcActionCost, calcRecruitChance, calcCommonActiveDelta, getSeason } from '../formulas.js';
import { applyPassives, applyWeaknesses, clearProjectCompletionFlags } from '../passives.js';
import { applyCommunityAction, applyCommunityDecay, checkCommunityStage } from '../community.js';
import { createRecruitCandidates, MAX_CORE_MEMBERS } from '../recruitment.js';
import { buildActionNarrative } from '../narrative.js';

function maybeRecruitCore(s, action) {
  const chance = calcRecruitChance(s);
  if (
    ['campus_wall', 'fresh_poster', 'tea', 'regular_meeting'].includes(action.id)
    && s.recruitPool.length
    && s.members.length < MAX_CORE_MEMBERS
    && Math.random() < chance
  ) {
    createRecruitCandidates(s, action);
  }
}

function applyStateMutations(s, action, member, calc) {
  // Resources
  s.resources.funds = Math.max(0, s.resources.funds - calcActionCost(s, action));
  const resPack = {};
  for (const k in action.res) resPack[k] = Math.round(action.res[k] * calc.policyMod);
  applyRes(s, resPack);

  // Stats
  const statPack = {};
  for (const k in action.stats) statPack[k] = Math.round(action.stats[k] * (0.1 + calc.fit / 350));
  applyStat(s, statPack);

  // Culture
  for (const k in (action.culture || {})) {
    s.culture[k] = clamp(s.culture[k] + Math.round(action.culture[k] * (s.policy === 'aggressive' ? 1.1 : 1)));
  }

  // Detail
  const bump = {};
  (actionDetailMap[action.id] || []).forEach((k) => { bump[k] = Math.round(0.5 + calc.fit / 70); });
  touchDetail(s, bump);
}

function applySkillPack(s, member, calc) {
  if (!calc.skill.triggered || !calc.skill.pack) return;
  const pack = calc.skill.pack;
  if (pack.stats) {
    applyStat(s, Object.fromEntries(Object.entries(pack.stats)
      .map(([key, value]) => [key, Math.round(value * 0.35)])));
  }
  if (pack.detail) {
    touchDetail(s, Object.fromEntries(Object.entries(pack.detail)
      .map(([key, value]) => [key, Math.round(value * 0.4)])));
  }
  if (pack.res) applyRes(s, pack.res);
  if (pack.common) {
    for (const k in pack.common) {
      const value = k === 'mood' ? Math.round(pack.common[k] * 0.5) : pack.common[k];
      s.common[k] = clamp(s.common[k] + value);
    }
  }
  if (pack.member) for (const k in pack.member) member[k] = clamp((member[k] || 0) + pack.member[k]);
  member.skillCd = calc.skill.cool + 1;
}

function applyMemberUpdates(s, action, member, calc) {
  member.fatigue = clamp(member.fatigue + calc.fatigueDelta);
  member.heat = clamp(member.heat + action.heat - (s.resources.pressure > 72 ? 3 : 0));
  member.trust = clamp(member.trust + (calc.fit >= 75 ? 2 : 1));
  member.growth = clamp(member.growth + (calc.match >= 2 ? 2 : calc.match >= 1 ? 1 : 0));
}

function applyCommonUpdates(s, action, member, calc) {
  const communityDelta = applyCommunityAction(s, action, calc);

  const isSocial = ['regular_meeting', 'tea', 'online_game', 'seminar'].includes(action.id);
  const moodDelta = (isSocial ? 2 : 0)
    - (s.resources.pressure > 78 ? 4 : s.resources.pressure > 60 ? 2 : 0)
    - (s.common.fatigue > 65 ? 2 : 0)
    - (action.fatigue >= 16 ? 1 : 0);
  s.common.mood = clamp(s.common.mood + moodDelta);
  s.common.fatigue = clamp(
    s.common.fatigue
    + Math.max(0, Math.round(calc.fatigueDelta * 0.35))
    - (action.id === 'online_game' ? 4 : 0),
  );
  s.common.active = clamp(
    s.common.active + calcCommonActiveDelta(action.stats.part, s.resources.pressure),
    0, s.common.total,
  );
  s.common.silent = Math.max(0, s.common.total - s.common.active - s.common.newcomer);
  return communityDelta;
}

function applyPolicyEffects(s, action) {
  if (s.policy === 'safe') s.resources.pressure = clamp(s.resources.pressure - 2);
  if (action.id === 'rest') {
    s.members.forEach((m) => { m.fatigue = clamp(m.fatigue - 3); });
    s.common.fatigue = clamp(s.common.fatigue - 5);
    s.common.mood = clamp(s.common.mood + 3);
  }
  if (action.cooldownWeeks) s.actionCooldowns[action.id] = action.cooldownWeeks + 1;
}

function decayAndPassive(s, activeMember) {
  s.members.forEach((m) => {
    if (m.skillCd > 0) m.skillCd--;
    if (m !== activeMember && s.week % 2 === 0) m.fatigue = clamp(m.fatigue - 1);
    if (s.policy === 'safe') m.fatigue = clamp(m.fatigue - 1);
    m.heat = clamp(m.heat - 1);
    if (m.fatigue > 70) m.heat = clamp(m.heat - 3);
  });
  for (const id in s.actionCooldowns) {
    s.actionCooldowns[id] = Math.max(0, s.actionCooldowns[id] - 1);
    if (!s.actionCooldowns[id]) delete s.actionCooldowns[id];
  }
  s.common.fatigue = clamp(s.common.fatigue - 1);
  if (s.common.mood > 65) s.common.mood = clamp(s.common.mood - 3);
  else if (s.common.mood > 55) s.common.mood = clamp(s.common.mood - 1);
  else if (s.common.mood < 45) s.common.mood++;

  applyCommunityDecay(s);
  s.resources.pressure = clamp(s.resources.pressure - 1);
  s.projects.forEach((p) => {
    if (p.done) return;
    const risk = projectRisk(p, s);
    if (risk > 78) {
      p.quality = clamp(p.quality - 2);
      if (Math.random() < 0.35) {
        s.resources.pressure = clamp(s.resources.pressure + 2);
        addLog(s, `企划【${p.title}】因负荷过高出现了小幅拖延。`);
      }
    }
  });
}

function maybeRandomEvent(s) {
  if (s.event || s.pendingRecruit || s.gameOver) return;
  const eligible = eventPool.filter((event) => {
    if (!event.when) return true;
    if (event.when.project && !s.projects.some((p) => p.id === event.when.project && !p.done)) return false;
    if (event.when.minAvgFatigue && avgFatigue(s) < event.when.minAvgFatigue) return false;
    if (event.when.minPlatform && s.detail.platform < event.when.minPlatform) return false;
    if (event.when.seasons && !event.when.seasons.includes(getSeason(s.week).key)) return false;
    if (event.when.minCulturePublication && s.culture.publication < event.when.minCulturePublication) return false;
    if (event.when.minCommonTotal && s.common.total < event.when.minCommonTotal) return false;
    if (event.when.maxCommonTotal && s.common.total > event.when.maxCommonTotal) return false;
    if ((s.stats.__eventsSeen || []).includes(event.id)) return false;
    return true;
  });
  if (!eligible.length) return;
  const chance = Math.min(0.3, 0.10 + s.resources.pressure / 500 + (s.week % 8 === 0 ? 0.05 : 0));
  if (Math.random() < chance) {
    s.event = clone(eligible[rand(0, eligible.length - 1)]);
    s.stats.__eventsSeen = [...(s.stats.__eventsSeen || []), s.event.id];
  }
}

function checkBoundary(s, completedWeek) {
  if (completedWeek === 16 || completedWeek === 24 || completedWeek === 40 || completedWeek === 48) {
    addReport(s);
    s.pendingReport = { title: reportTitleByWeek(completedWeek), body: makeReportModalBody(s) };
    if (completedWeek === 48) {
      s.gameOver = true;
      s.pendingLegacy = { ...buildLegacy(s) };
    }
    return { type: 'report' };
  }

  if (s.pendingRecruit) return { type: 'recruit' };

  const arc = checkArcs(s);
  if (arc) {
    s.pendingArc = arc;
    return { type: 'arc' };
  }

  maybeRandomEvent(s);
  if (s.event) return { type: 'event' };
  return { type: null };
}

export function resolveAll(s, action, member, calc) {
  clearProjectCompletionFlags(s);
  // Step 0: Snapshot pre-execution values
  const prePressure = s.resources.pressure;
  s.stats.__maxPressure = Math.max(s.stats.__maxPressure || 0, prePressure);

  // Apply all state changes
  applyStateMutations(s, action, member, calc);
  applySkillPack(s, member, calc);
  applyMemberUpdates(s, action, member, calc);
  const communityDelta = applyCommonUpdates(s, action, member, calc);
  applyPolicyEffects(s, action);

  // Project
  startOrAdvanceProject(s, action, member, calc.fit, calc.skill.pack);

  // Recruitment
  maybeRecruitCore(s, action);

  // Log
  addLog(s, buildActionNarrative(s, action, member, calc, communityDelta));
  s.lastResult = `本周行动：${action.title}。${member.name}的适配评价为「${calc.fitRating}」(${calc.fit})。${communityDelta.joined ? `有 ${communityDelta.joined} 名普通成员正式加入。` : ''}${calc.skill.triggered ? `技能【${calc.skill.pack.name}】已发动。` : ''}`;

  // Comeback check
  if (prePressure >= 80 && s.resources.pressure <= 30) s.stats.__comeback = true;

  // Passives & weaknesses (after all other effects)
  applyPassives(s);
  applyWeaknesses(s);
  s.common.silent = Math.max(0, s.common.total - s.common.active - s.common.newcomer);
  checkCommunityStage(s);

  // Decay + week advance + boundary
  decayAndPassive(s, member);
  const completedWeek = s.week;
  const boundary = checkBoundary(s, completedWeek);
  if (!s.gameOver) s.week++;

  checkAndUnlock(s);
  return { ok: true, boundary: boundary.type ? boundary : null };
}
