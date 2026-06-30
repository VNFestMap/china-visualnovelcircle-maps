// src/game/passives.js
// 被动/弱点结算系统

import { clamp } from '../utils/math.js';
import { actions } from '../data/actions.js';
import { getSeason } from './formulas.js';
import { applyRes, applyStat, touchDetail } from '../state/mutations.js';

function resolveAction(selected) {
  return actions.find((a) => a.id === selected) || actions[0];
}

// 计算动态属性（用于条件判断）
function computeDynamicStats(s, member) {
  return {
    projectCount: s.projects.filter(p => !p.done).length,
    consecutivePressure: Math.floor(s.resources.pressure / 25), // 每25压力算1层
    actionCat: null, // 由调用方设置
    total: s.common.total,
    docs: s.detail.docs,
    newcomer: s.common.newcomer,
    planning: s.detail.planning,
    design: s.detail.design,
    content: s.stats.content,
    participation: s.stats.part,
  };
}

// 检查条件是否满足
function checkCondition(condition, s, member, action) {
  if (!condition) return false;

  const dynamic = computeDynamicStats(s, member);
  if (action && condition.stat === 'actionCat') {
    return (action.cat || action.id) === condition.val;
  }

  // 特殊处理projectCount
  if (condition.stat === 'multiProject') {
    return dynamic.projectCount > condition.val;
  }

  // 特殊处理 consecutivePressure
  if (condition.stat === 'consecutivePressure') {
    return dynamic.consecutivePressure > condition.val;
  }

  // 标准stat查找
  let actual;
  if (condition.stat && typeof s.stats[condition.stat] === 'number') {
    actual = s.stats[condition.stat];
  } else if (condition.stat && typeof s.detail[condition.stat] === 'number') {
    actual = s.detail[condition.stat];
  } else if (condition.stat && typeof s.common[condition.stat] === 'number') {
    actual = s.common[condition.stat];
  } else if (condition.stat && typeof s.resources[condition.stat] === 'number') {
    actual = s.resources[condition.stat];
  } else if (condition.stat && typeof dynamic[condition.stat] !== 'undefined') {
    actual = dynamic[condition.stat];
  }

  // 如果没有stat字段，则检查member自身状态
  if (actual === undefined && !condition.stat) {
    // 检查member状态条件
    if (condition.op === 'gt') actual = member.fatigue;
    else if (condition.op === 'lt') actual = member.trust;
    // fallback to fatigue
  }

  if (actual === undefined) return false;

  switch (condition.op) {
    case 'gt': return actual > condition.val;
    case 'lt': return actual < condition.val;
    case 'gte': return actual >= condition.val;
    case 'lte': return actual <= condition.val;
    case 'is': return actual === condition.val;
    default: return false;
  }
}

// 检查被动触发条件
function shouldTriggerPassive(trigger, s, action, member, prevSeason) {
  if (!trigger) return false;

  switch (trigger.type) {
    case 'onActionComplete': {
      if (!action) return false;
      const actionTags = action.tags || [];
      const triggerTags = trigger.actionTags || [];
      return triggerTags.some(t => actionTags.includes(t));
    }
    case 'onWeekEnd':
      return true; // 每周都触发
    case 'onProjectComplete': {
      return s.projects.some(p => p.done && p._justCompleted);
    }
    case 'onSeasonStart': {
      if (!trigger.season) return false;
      const season = getSeason(s.week);
      return season && season.key === trigger.season && season.range[0] === s.week;
    }
    case 'alwaysActive':
      return true;
    default:
      return false;
  }
}

// 应用效果包（stats/res/detail/common/member）
function applyEffectPack(s, member, effect) {
  if (!effect) return;

  // stats
  if (effect.stats) {
    applyStat(s, effect.stats);
  }

  // resources
  if (effect.res) {
    applyRes(s, effect.res);
  }

  // detail
  if (effect.detail) {
    touchDetail(s, effect.detail);
  }

  // common
  if (effect.common) {
    for (const k in effect.common) {
      if (typeof s.common[k] === 'number') s.common[k] = clamp(s.common[k] + effect.common[k]);
    }
  }

  // member effects (specific keys)
  if (effect.member) {
    if (effect.member.growth) member.growth = clamp((member.growth || 0) + effect.member.growth);
    if (effect.member.trust) member.trust = clamp((member.trust || 0) + effect.member.trust);
    if (effect.member.fatigue) member.fatigue = clamp((member.fatigue || 0) + effect.member.fatigue);
  }
  if (effect.memberFatigue) member.fatigue = clamp((member.fatigue || 0) + effect.memberFatigue);
  if (effect.memberHeat) member.heat = clamp((member.heat || 0) + effect.memberHeat);
  if (effect.memberGrowth) member.growth = clamp((member.growth || 0) + effect.memberGrowth);

  // project effects
  if (effect.project && s.projects.length) {
    s.projects.forEach(p => {
      if (p.done) return;
      if (typeof effect.project.progress === 'number') p.progress = clamp(p.progress + effect.project.progress);
      if (typeof effect.project.quality === 'number') p.quality = clamp(p.quality + effect.project.quality);
      if (typeof effect.project.load === 'number') p.load = clamp(p.load + effect.project.load);
      if (typeof effect.project.risk === 'number') {
        p.riskModifier = clamp((p.riskModifier || 0) + effect.project.risk, -100, 100);
      }
    });
  }
}

// 结算所有成员的被动
export function applyPassives(s) {
  if (!s.selectedAction) return;
  const action = resolveAction(s.selectedAction);

  s.members.forEach(m => {
    if (!m.passive || !Array.isArray(m.passive)) return;
    m.passive.forEach(p => {
      if (shouldTriggerPassive(p.trigger, s, action, m)) {
        applyEffectPack(s, m, p.effect);
      }
    });
  });
}

// 结算所有成员的弱点
export function applyWeaknesses(s) {
  const action = s.selectedAction ? resolveAction(s.selectedAction) : null;

  s.members.forEach(m => {
    if (!m.weakness) return;
    if (checkCondition(m.weakness.condition, s, m, action)) {
      applyEffectPack(s, m, m.weakness.effect);
    }
  });
}

// 清除项目完成标记
export function clearProjectCompletionFlags(s) {
  s.projects.forEach(p => { delete p._justCompleted; });
}
