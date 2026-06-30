// src/game/week.js
// Pipeline orchestration + UI convenience re-exports
import { getSeason, calcMatch, calcSupport } from './formulas.js';
import { actionDetailMap } from '../data/stats.js';
import { skills } from '../data/skills.js';
import { seasons as allSeasons } from '../data/seasons.js';
import { actions } from '../data/actions.js';
import { currentMember } from './lifecycle.js';
import { addLog } from '../state/mutations.js';
import { validate } from './stages/validate.js';
import { calculate } from './stages/calculate.js';
import { resolveAll } from './stages/resolve.js';
import { eventHandlers, arcHandlers } from './eventHandlers.js';
import { resolveRecruitChoice as chooseRecruit } from './recruitment.js';

// ---- UI Convenience ----
// These delegate to formulas.js but keep the same signature the UI expects.
function matchBonus(action, member) {
  return calcMatch(action, member);
}

function detailSupport(s, action) {
  return calcSupport(action, s.detail, actionDetailMap);
}

function previewSkill(member, action) {
  const sk = skills[member.skill];
  if (!sk || !sk.ids.includes(action.id)) return null;
  return { name: sk.name, ready: !member.skillCd, cd: member.skillCd || 0 };
}

export { getSeason, matchBonus, detailSupport, previewSkill };

// ---- Pipeline ----
function resolveAction(selected) {
  return actions.find((a) => a.id === selected) || actions[0];
}

function resolveMember(s) {
  return currentMember(s);
}

export function executeAction(s) {
  const action = resolveAction(s.selectedAction);
  const member = resolveMember(s);

  const v = validate(s, action);
  if (!v.ok) return v;

  const calc = calculate(s, action, member);
  const result = resolveAll(s, action, member, calc);

  return result;
}

export function resolveEvent(s, choiceIndex) {
  const ev = s.event;
  if (!ev) return;
  const choice = ev.choices[choiceIndex];
  if (!choice) return;
  const fn = eventHandlers[choice.fnRef];
  if (fn) fn(s);
  addLog(s, {
    summary: `事件「${ev.title}」作出选择`,
    detail: ev.text,
    quote: `你的决定：${choice.label}`,
    category: '突发事件',
    type: 'major',
  });
  s.event = null;
}

export function resolvePendingArc(s, choiceIndex) {
  const arc = s.pendingArc;
  if (!arc) return;
  const choice = arc.arc.choices[choiceIndex];
  if (!choice) return;
  const fn = arcHandlers[choice.fnRef];
  if (fn) fn(s);
  s.pendingArc = null;
  s.lastResult = `${arc.member} 的剧情有了新的进展。`;
  addLog(s, {
    summary: `${arc.member}：${arc.arc.title}`,
    detail: arc.arc.text,
    quote: `你的回应：${choice.label}`,
    actors: [arc.member],
    category: '角色剧情',
    type: 'arc',
  });
}

export function resolveRecruitChoice(s, choiceIndex) {
  const recruited = chooseRecruit(s, choiceIndex);
  if (!recruited) return null;
  addLog(s, {
    summary: `${recruited.name}加入核心组`,
    detail: `${recruited.name}不再只是参加活动，而是开始承担稳定职责。核心组现在有 ${s.members.length} 人。`,
    quote: `“我愿意试试，也希望能把自己擅长的事情做好。”`,
    actors: [recruited.name],
    changes: [`核心成员 ${s.members.length}/10`],
    category: '成员招募',
    type: 'major',
  });
  s.lastResult = `${recruited.name}正式加入核心组。`;
  return recruited;
}
