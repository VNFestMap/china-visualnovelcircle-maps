import { clamp } from '../utils/math.js';
import { addLog } from '../state/mutations.js';

const stageDefs = [
  { name: '萌芽期', min: 0, detail: '群里的人彼此都叫得出名字，每一次活动都像临时攒起来的小聚会。' },
  { name: '稳定期', min: 20, detail: '群聊开始形成固定话题，也有普通成员主动帮忙维持活动。' },
  { name: '校级同好会', min: 50, detail: '同好会已经不再只是熟人小群，活动通知会传到校园的不同角落。' },
  { name: '大型社群', min: 100, detail: '百人规模带来了影响力，也带来了新人融入、信息分层和管理压力。' },
];

const exposureByAction = {
  campus_wall: 8,
  fresh_poster: 16,
  regular_meeting: 2,
  tea: 5,
  seminar: 4,
  online_game: 2,
  mascot_goods: 7,
  magazine: 11,
  joint: 10,
  booth: 20,
  vn: 6,
  platform: 5,
  handover: 1,
  funding: 0,
  rest: 0,
};

const conversionActions = new Set([
  'campus_wall', 'fresh_poster', 'regular_meeting', 'tea',
  'seminar', 'online_game', 'joint', 'booth',
]);

export function getCommunityStage(total) {
  return [...stageDefs].reverse().find((stage) => total >= stage.min) || stageDefs[0];
}

function normalizeBuckets(common) {
  common.total = Math.max(0, Math.round(common.total || 0));
  common.active = clamp(common.active || 0, 0, common.total);
  common.newcomer = clamp(common.newcomer || 0, 0, common.total - common.active);
  common.silent = Math.max(0, common.total - common.active - common.newcomer);
  common.prospects = Math.max(0, Math.round(common.prospects || 0));
}

export function applyCommunityAction(state, action, calc) {
  const common = state.common;
  normalizeBuckets(common);

  const visibility = exposureByAction[action.id] || 0;
  const routeBonus = Math.round((state.resources.fame + state.stats.external + state.stats.part) / 45);
  const exposureGain = Math.max(0, Math.round(visibility * (0.65 + calc.fit / 150) + routeBonus));
  common.prospects += exposureGain;

  const matured = Math.min(common.newcomer, common.mood >= 58 ? 2 : 1);
  const maturedActive = common.mood >= 48 ? matured : Math.floor(matured / 2);
  common.newcomer -= matured;
  common.active += maturedActive;

  let joined = 0;
  if (conversionActions.has(action.id) && common.prospects > 0) {
    const quality = clamp(
      25
      + common.mood * 0.35
      + state.stats.org * 0.18
      + calc.fit * 0.22
      - state.resources.pressure * 0.18,
    );
    const conversionRate = 0.025 + quality / 1100;
    const eventCapacity = {
      fresh_poster: 3,
      joint: 2,
      booth: 9,
      campus_wall: 1,
    }[action.id] || 0;
    const excellenceMultiplier = quality >= 88 && state.resources.fame >= 78
      ? (common.total >= 100 ? 2.8 : 2.2)
      : quality >= 80 && state.resources.fame >= 62 ? 1.35 : 1;
    const capacity = Math.max(1, Math.round(
      (1 + state.stats.org / 50 + state.stats.part / 65 + eventCapacity) * excellenceMultiplier,
    ));
    joined = Math.min(common.prospects, capacity, Math.max(1, Math.round(common.prospects * conversionRate)));
    common.prospects -= joined;
    common.total += joined;
    common.newcomer += joined;

    const activeGain = Math.min(common.newcomer, Math.max(0, Math.round(joined * (quality >= 65 ? 0.55 : 0.3))));
    common.newcomer -= activeGain;
    common.active += activeGain;
  }

  if (action.id === 'regular_meeting' || action.id === 'tea' || action.id === 'online_game') {
    const reactivated = Math.min(common.silent, action.id === 'online_game' ? 2 : 1);
    common.active += reactivated;
  }

  normalizeBuckets(common);
  return { exposureGain, joined };
}

export function applyCommunityDecay(state) {
  const common = state.common;
  normalizeBuckets(common);
  if (state.week % 4 !== 0) return { lost: 0 };

  const scalePressure = Math.floor(common.total / 70);
  const healthPenalty = (common.mood < 42 ? 2 : 0)
    + (common.fatigue > 68 ? 2 : 0)
    + (state.resources.pressure > 72 ? 2 : 0);
  const retention = clamp(state.detail.retention + state.stats.org * 0.35 + common.mood * 0.25);
  const lost = Math.min(
    common.total,
    Math.max(0, Math.round(common.total * (0.012 + healthPenalty * 0.006) + scalePressure - retention / 65)),
  );
  common.total -= lost;
  common.silent = Math.max(0, common.silent - lost);

  const silentGain = Math.min(
    common.active,
    Math.max(0, Math.round(common.active * (0.04 + state.resources.pressure / 900 + common.fatigue / 1100))),
  );
  common.active -= silentGain;
  normalizeBuckets(common);
  return { lost };
}

export function checkCommunityStage(state) {
  const stage = getCommunityStage(state.common.total);
  state.common.stage = stage.name;
  state.common.reachedStages ||= [];
  if (state.common.reachedStages.includes(stage.name)) return null;
  state.common.reachedStages.push(stage.name);
  addLog(state, {
    summary: `社群进入「${stage.name}」`,
    detail: stage.detail,
    quote: stage.name === '大型社群' ? '“群里已经有一百多人了，我们得重新想想怎么让新人留下来。”' : '',
    category: '社群成长',
    type: 'major',
    changes: [`普通成员 ${state.common.total} 人`],
  });
  return stage.name;
}
