// src/game/stages/calculate.js
import { calcFitBreakdown, calcSupport, calcFatigueDelta, calcPolicyMod } from '../formulas.js';
import { actionDetailMap } from '../../data/stats.js';
import { skills } from '../../data/skills.js';
import { clone } from '../../utils/math.js';

export function calculate(s, action, member) {
  const support = calcSupport(action, s.detail, actionDetailMap);
  const skill = skills[member.skill];
  const triggered = !!(skill && skill.ids.includes(action.id) && !member.skillCd);
  const skillPack = triggered ? clone(skill) : null;
  const fitPack = calcFitBreakdown(action, member, support, triggered);

  return {
    match: fitPack.match,
    support,
    cap: fitPack.capacity,
    aptitude: fitPack.aptitude,
    fit: fitPack.score,
    fitRating: fitPack.rating,
    fitBreakdown: fitPack,
    policyMod: calcPolicyMod(s.policy),
    fatigueDelta: calcFatigueDelta(action.fatigue, s.policy),
    skill: { triggered, pack: skillPack, cool: skill ? skill.cool : 0 },
  };
}
