import { actions } from '../src/data/actions.js';
import { actionDetailMap } from '../src/data/stats.js';
import { skills } from '../src/data/skills.js';
import { pickEnding } from '../src/data/endings.js';
import { calcActionCost, calcFitBreakdown, calcSupport, getSeason } from '../src/game/formulas.js';
import { avgFatigue, buildLegacy, initialState } from '../src/game/lifecycle.js';
import { executeAction, resolveEvent, resolvePendingArc, resolveRecruitChoice } from '../src/game/week.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function availableActions(state) {
  const season = getSeason(state.week);
  return actions.filter((action) =>
    action.seasons.includes(season.key)
    && calcActionCost(state, action) <= state.resources.funds
    && !(state.actionCooldowns?.[action.id] > 0)
    && !(action.project && state.projects.some((project) => project.id === action.project.id && project.done)));
}

function actionFit(state, action, member) {
  const skill = skills[member.skill];
  const skillReady = !!(skill?.ids.includes(action.id) && !member.skillCd);
  return calcFitBreakdown(
    action,
    member,
    calcSupport(action, state.detail, actionDetailMap),
    skillReady,
  ).score;
}

function chooseMember(state, action) {
  return state.members.reduce((best, member) => {
    const skill = skills[member.skill];
    const skillBonus = skill?.ids.includes(action.id) && !member.skillCd ? 10 : 0;
    const fatiguePenalty = Math.max(0, member.fatigue - 55) * 0.7;
    const score = actionFit(state, action, member) + skillBonus - fatiguePenalty;
    return !best || score > best.score ? { member, score } : best;
  }, null).member;
}

const balancedSchedule = [
  'campus_wall', 'regular_meeting', 'fresh_poster', 'tea',
  'seminar', 'platform', 'regular_meeting', 'funding',
  'seminar', 'mascot_goods', 'regular_meeting', 'platform',
  'online_game', 'seminar', 'regular_meeting', 'rest',
  'magazine', 'magazine', 'rest', 'magazine',
  'magazine', 'online_game', 'magazine', 'magazine',
  'campus_wall', 'fresh_poster', 'regular_meeting', 'joint',
  'seminar', 'joint', 'online_game', 'platform',
  'funding', 'regular_meeting', 'handover', 'handover',
  'rest', 'handover', 'handover', 'handover',
  'handover', 'rest', 'vn', 'seminar',
  'online_game', 'platform', 'rest', 'handover',
];

function balancedRouteAction(state, routeVariant) {
  if (state.week <= 16) return balancedSchedule[state.week - 1];

  const projectWeeks = {
    17: routeVariant === 'alliance' ? 'joint' : 'magazine',
    18: routeVariant === 'alliance' ? 'joint' : 'magazine',
    19: 'rest',
    20: routeVariant === 'alliance' ? 'joint' : 'magazine',
    21: routeVariant === 'alliance' ? 'joint' : 'magazine',
    22: 'online_game',
    23: routeVariant === 'alliance' ? 'joint' : 'magazine',
    24: routeVariant === 'alliance' ? 'joint' : 'magazine',
  };
  if (projectWeeks[state.week]) return projectWeeks[state.week];

  if (routeVariant === 'creative' || routeVariant === 'alliance') {
    const secondProject = {
      25: 'vn', 26: 'vn', 27: 'vn', 28: 'rest',
      29: 'vn', 30: 'vn', 31: 'vn',
      32: 'regular_meeting', 33: 'funding', 34: 'seminar',
      35: 'platform', 36: 'rest', 37: 'regular_meeting', 38: 'mascot_goods',
      39: 'seminar', 40: 'rest', 41: 'platform', 42: 'online_game',
      43: 'seminar', 44: 'rest', 45: 'platform', 46: 'regular_meeting',
      47: 'online_game', 48: 'rest',
    };
    return secondProject[state.week];
  }

  return balancedSchedule[state.week - 1];
}

function desiredAction(state, profile, routeVariant) {
  if (profile === 'rest') return 'rest';
  if (profile === 'funding') return state.actionCooldowns?.funding ? 'rest' : 'funding';
  if (profile === 'aggressive') {
    if (state.resources.pressure >= 82 || avgFatigue(state) >= 68) return 'rest';
    const season = getSeason(state.week).key;
    if (season === 'spring') return state.week % 3 === 0 ? 'fresh_poster' : 'joint';
    if (season === 'summer') return state.week % 2 === 0 ? 'booth' : 'magazine';
    if (season === 'autumn') return state.week % 2 === 0 ? 'vn' : 'joint';
    return state.week % 2 === 0 ? 'booth' : 'handover';
  }
  if (state.resources.pressure >= 72 || avgFatigue(state) >= 62) return 'rest';
  return balancedRouteAction(state, routeVariant) || 'rest';
}

function fallbackAction(state, desired) {
  const available = availableActions(state);
  return available.find((action) => action.id === desired)
    || available.find((action) => action.id === 'regular_meeting')
    || available.find((action) => action.id === 'rest')
    || available[0];
}

function resolvePending(state) {
  while (state.pendingRecruit) resolveRecruitChoice(state, 0);
  while (state.pendingArc) resolvePendingArc(state, 0);
  while (state.event) {
    const choice = state.resources.pressure >= 55 ? 0 : 1;
    resolveEvent(state, choice);
  }
}

export function runSimulation(seed, profile = 'balanced') {
  const originalRandom = Math.random;
  Math.random = seededRandom(seed);
  try {
    const state = initialState();
    const routeVariant = ['succession', 'creative', 'alliance'][seed % 3];
    const fits = [];
    let peakPressure = state.resources.pressure;
    let peakFunds = state.resources.funds;
    let turns = 0;

    while (!state.gameOver && turns++ < 60) {
      resolvePending(state);
      const action = fallbackAction(state, desiredAction(state, profile, routeVariant));
      if (!action) throw new Error(`No available action at week ${state.week}`);
      const member = chooseMember(state, action);
      state.selectedAction = action.id;
      state.selectedMember = member.name;
      state.policy = profile === 'aggressive'
        ? 'aggressive'
        : state.resources.pressure >= 58 ? 'safe' : 'balanced';
      fits.push(actionFit(state, action, member));
      const result = executeAction(state);
      if (!result?.ok && !state.gameOver) {
        throw new Error(`Action ${action.id} failed at week ${state.week}: ${result?.msg || 'unknown'}`);
      }
      peakPressure = Math.max(peakPressure, state.resources.pressure);
      peakFunds = Math.max(peakFunds, state.resources.funds);
    }

    resolvePending(state);
    const legacy = state.pendingLegacy || buildLegacy(state);
    return {
      profile,
      funds: state.resources.funds,
      peakFunds,
      pressure: state.resources.pressure,
      peakPressure,
      avgFatigue: avgFatigue(state),
      common: { ...state.common },
      members: state.members.length,
      stats: Object.fromEntries(Object.entries(state.stats)
        .filter(([key, value]) => !key.startsWith('__') && typeof value === 'number')),
      culture: { ...state.culture },
      legacy,
      projectsCompleted: state.projects.filter((project) => project.done).length,
      completedIds: [...(state.stats.__completed || [])],
      fitAverage: Math.round(fits.reduce((sum, fit) => sum + fit, 0) / Math.max(fits.length, 1)),
      perfectFits: fits.filter((fit) => fit >= 100).length,
      ending: pickEnding(state, legacy).id,
      achievements: state.achievements.unlocked.length,
    };
  } finally {
    Math.random = originalRandom;
  }
}

export function summarizeSimulations(results) {
  const average = (selector) => {
    const values = results.map(selector).filter(Number.isFinite);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
  };
  const endings = {};
  results.forEach((result) => { endings[result.ending] = (endings[result.ending] || 0) + 1; });
  return {
    runs: results.length,
    funds: average((result) => result.funds),
    peakFunds: average((result) => result.peakFunds),
    pressure: average((result) => result.pressure),
    peakPressure: average((result) => result.peakPressure),
    avgFatigue: average((result) => result.avgFatigue),
    commonTotal: average((result) => result.common.total),
    commonActive: average((result) => result.common.active),
    commonNewcomer: average((result) => result.common.newcomer),
    commonMood: average((result) => result.common.mood),
    commonFatigue: average((result) => result.common.fatigue),
    members: average((result) => result.members),
    projectsCompleted: average((result) => result.projectsCompleted),
    fitAverage: average((result) => result.fitAverage),
    perfectFits: average((result) => result.perfectFits),
    achievements: average((result) => result.achievements),
    stats: Object.fromEntries(['org', 'exec', 'part', 'content', 'external', 'succession']
      .map((key) => [key, average((result) => result.stats[key])])),
    endings,
  };
}
