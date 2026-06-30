import { clone } from '../utils/math.js';
import { calcAptitude } from './formulas.js';

export const MAX_CORE_MEMBERS = 10;

function weightedScore(member, action) {
  return calcAptitude(action, member) + Math.random() * 24;
}

export function createRecruitCandidates(state, action) {
  if (state.pendingRecruit || state.members.length >= MAX_CORE_MEMBERS) return false;
  if (!state.recruitPool?.length) return false;
  const candidates = [...state.recruitPool]
    .sort((a, b) => weightedScore(b, action) - weightedScore(a, action))
    .slice(0, Math.min(3, state.recruitPool.length))
    .map(clone);
  if (!candidates.length) return false;
  state.pendingRecruit = {
    sourceAction: action.id,
    title: '新的核心成员候选',
    text: '最近的活动让几位普通成员开始主动承担工作。你准备邀请谁进入核心组？',
    candidates,
  };
  return true;
}

export function resolveRecruitChoice(state, index) {
  const candidate = state.pendingRecruit?.candidates?.[index];
  if (!candidate || state.members.length >= MAX_CORE_MEMBERS) {
    state.pendingRecruit = null;
    return null;
  }
  candidate.skillCd = 0;
  state.members.push(candidate);
  state.recruitPool = state.recruitPool.filter((member) => member.name !== candidate.name);
  state.selectedMember = candidate.name;
  state.stats.__firstRecruit = true;
  state.pendingRecruit = null;
  return candidate;
}
