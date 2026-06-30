// src/game/formulas.js
// Pure calculation functions extracted from week.js, lifecycle.js, projects.js.
// No side effects — inputs in, numbers out.
import { clamp } from '../utils/math.js';
import { seasons as defaultSeasons } from '../data/seasons.js';

export function getSeason(week, seasons = defaultSeasons) {
  return (seasons || defaultSeasons).find((s) => week >= s.range[0] && week <= s.range[1]) || (seasons || defaultSeasons)[0];
}

export function calcMatch(action, member) {
  let score = 0;
  (action.tags || []).forEach((t) => { if (member.tags.includes(t)) score += 1; });
  return score;
}

export function calcAptitude(action, member) {
  return clamp(member?.aptitudes?.[action.id] ?? 42);
}

export function calcFit(match, support, capacity, aptitude = 55, skillAffinity = 0) {
  return clamp(Math.round(
    10
    + match * 9
    + support * 16
    + capacity * 0.22
    + aptitude * 0.48
    + skillAffinity,
  ));
}

export function calcFitBreakdown(action, member, support, skillReady = false) {
  const match = calcMatch(action, member);
  const capacity = calcCapacity(member);
  const aptitude = calcAptitude(action, member);
  const skillAffinity = skillReady ? 7 : 0;
  const score = calcFit(match, support, capacity, aptitude, skillAffinity);
  const rating = score >= 86 ? '专精' : score >= 74 ? '擅长' : score >= 58 ? '普通' : '不适合';
  return { score, rating, match, support, capacity, aptitude, skillAffinity };
}

export function calcCapacity(member) {
  return clamp(35 + member.heat * 0.35 - member.fatigue * 0.4 + member.growth * 0.25 + member.trust * 0.1);
}

export function calcSupport(action, detail, detailMap) {
  const keys = detailMap[action.id] || [];
  if (!keys.length) return 0.45;
  return keys.reduce((sum, k) => sum + (detail[k] || 0), 0) / (keys.length * 100);
}

export function calcFatigueDelta(actionFatigue, policy) {
  return Math.round(actionFatigue * (policy === 'aggressive' ? 1.15 : policy === 'safe' ? 0.85 : 1));
}

export function calcPolicyMod(policy) {
  return policy === 'aggressive' ? 1.18 : policy === 'safe' ? 0.88 : 1;
}

export function calcActionCost(state, action) {
  if (!action.project) return action.cost;
  const existing = state.projects?.find((project) => project.id === action.project.id && !project.done);
  return existing ? Math.round(action.cost * 0.2) : action.cost;
}

export function calcProjectRisk(project, s) {
  const avgFat = s.members.reduce((sum, m) => sum + m.fatigue, 0) / Math.max(s.members.length, 1);
  return clamp(
    project.load * 2.1 + s.resources.pressure * 0.35 + avgFat * 0.28
    - s.stats.org * 0.22 - s.stats.exec * 0.18 - project.quality * 0.15
    + (project.riskModifier || 0)
  );
}

export function calcRecruitChance(s) {
  return Math.max(0.03, Math.min(0.22,
    0.09
    + s.detail.newcomer * 0.0006
    + s.resources.fame * 0.0005
    + (s.common.prospects || 0) * 0.001
    + s.common.mood * 0.0004,
  ));
}

export function calcCommonActiveDelta(actionStatsPart, pressure) {
  const participation = actionStatsPart >= 6 ? 1 : 0;
  return participation - (pressure > 74 ? 2 : pressure > 58 ? 1 : 0);
}

export function calcBurnRisk(pressure, avgFatigue) {
  return clamp(pressure * 0.42 + avgFatigue * 0.58);
}

export function calcMemberState(fatigue, heat) {
  if (fatigue >= 78) return { label: '燃尽', cls: 'burnout' };
  if (fatigue >= 58) return { label: '疲惫', cls: 'tired' };
  if (heat >= 70)   return { label: '热情', cls: 'active' };
  if (heat >= 50)   return { label: '稳定', cls: 'stable' };
  return { label: '低迷', cls: 'low' };
}
