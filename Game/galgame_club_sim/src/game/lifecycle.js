import { clone, clamp } from '../utils/math.js';
import { coreSeed, recruitPool } from '../data/members.js';
import { cultureNames } from '../data/culture.js';
import { statNames } from '../data/stats.js';
import { getLegacy, getProfile } from '../state/persistence.js';
import { applyRes, applyStat, touchDetail, summarizeDetail, initialDetail, addLog } from '../state/mutations.js';

export function buildLegacy(s) {
  return {
    points: Math.floor((s.stats.succession + s.stats.content + s.culture.archive + s.culture.alliance) / 10),
    archive: Math.floor((s.detail.archive + s.detail.docs) / 20),
    network: Math.floor((s.resources.relations + s.detail.crossTrust + s.detail.platform) / 30),
    management: Math.floor((s.stats.org + s.detail.finance + s.detail.division) / 25),
    creative: Math.floor((s.stats.content + s.culture.creative + s.detail.projectOutput) / 25),
  };
}

export function applyLegacy(s, legacy) {
  if (!legacy) return;
  touchDetail(s, {
    archive: legacy.archive,
    docs: legacy.archive,
    platform: legacy.network,
    schoolLink: Math.floor(legacy.network * 0.7),
    division: legacy.management,
    finance: legacy.management,
    juniors: Math.floor(legacy.management * 0.7),
    projectOutput: legacy.creative,
    design: Math.floor(legacy.creative * 0.6),
  });
  applyRes(s, {
    funds: legacy.management * 8,
    relations: legacy.network * 2,
    fame: Math.floor(legacy.network * 1.2),
    credit: legacy.archive,
  });
  s.common.newcomer = clamp(s.common.newcomer + Math.floor(legacy.archive / 2));
}

export function initialState(config = null) {
  const detail = initialDetail();
  const legacy = getLegacy();
  const profile = getProfile();

  let selectedMembers, funds, policy;
  if (config) {
    selectedMembers = config.selectedMembers || clone(coreSeed).slice(0, 6);
    funds = config.funds ?? 780;
    policy = config.policy || 'balanced';
  } else {
    selectedMembers = clone(coreSeed).slice(0, 6);
    funds = 780;
    policy = 'balanced';
  }
  const s = {
    week: 1,
    detail,
    stats: { ...summarizeDetail(detail), __completed: [], __arcsResolved: [], __eventsSeen: [] },
    resources: { funds, fame: 12, pressure: 14, credit: 18, influence: 8, relations: 8 },
    culture: { campus: 8, publication: 0, alliance: 0, creative: 0, tradition: 0, archive: 4 },
    members: selectedMembers.map((m) => ({ ...m, skillCd: 0 })),
    recruitPool: clone(recruitPool).filter(r => !selectedMembers.some(sm => sm.name === r.name)),
    common: {
      total: 10,
      active: 5,
      newcomer: 3,
      silent: 2,
      prospects: 8,
      mood: 55,
      fatigue: 18,
      stage: '萌芽期',
      reachedStages: ['萌芽期'],
    },
    projects: [],
    logs: [{
      week: 1,
      summary: '新学年开始',
      detail: '你接手了一个人数不多、资源有限，但仍然有人愿意认真聊作品、组织活动的视觉小说同好会。',
      quote: '“先让大家有一个愿意留下来的地方。”',
      actors: [],
      changes: ['普通成员 10 人', '核心成员 6 人'],
      category: '序章',
      type: 'major',
    }],
    selectedAction: 'campus_wall',
    selectedMember: selectedMembers[0]?.name || '杏子',
    policy,
    actionCooldowns: {},
    activeTab: 'all',
    event: null,
    pendingArc: null,
    pendingRecruit: null,
    arcSeenFor: {},
    termReports: [],
    gameOver: false,
    pendingLegacy: null,
    legacy,
    lastResult: '从招新和例会开始，让同好会先"活起来"。',
    achievements: { unlocked: [...(profile.unlocked || [])], recentlyUnlocked: [] },
  };
  applyLegacy(s, legacy);
  s.stats = { ...s.stats, ...summarizeDetail(s.detail) };
  return s;
}

export function routeName(s) {
  const entries = Object.entries(s.culture).sort((a, b) => b[1] - a[1]);
  const [k] = entries[0] || [];
  return cultureNames[k] || '均衡路线';
}

export function avgFatigue(s) {
  return clamp(s.members.reduce((sum, m) => sum + m.fatigue, 0) / s.members.length);
}
export function avgHeat(s) {
  return clamp(s.members.reduce((sum, m) => sum + m.heat, 0) / s.members.length);
}

export function memberState(m) {
  if (m.fatigue >= 78) return ['燃尽边缘', 'burn'];
  if (m.fatigue >= 58) return ['疲劳', 'tired'];
  return [m.heat >= 70 ? '热情中' : '稳定', 'ok'];
}

export function capacity(m) {
  return clamp(35 + m.heat * 0.35 - m.fatigue * 0.4 + m.growth * 0.25 + m.trust * 0.1);
}

export function currentMember(s) {
  return s.members.find((m) => m.name === s.selectedMember) || s.members[0];
}

export function reportTitleByWeek(week) {
  if (week === 16) return '春学期结算';
  if (week === 24) return '暑假阶段报告';
  if (week === 40) return '秋学期结算';
  if (week === 48) return '学年总结';
  return '阶段报告';
}

export function makeReportBody(s) {
  const topStats = Object.entries(s.stats)
    .filter(([k]) => !k.startsWith('__'))
    .sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([k]) => statNames[k]).join('、');
  const weak = Object.entries(s.stats)
    .filter(([k]) => !k.startsWith('__'))
    .sort((a, b) => a[1] - b[1]).slice(0, 2)
    .map(([k]) => statNames[k]).join('、');
  return `强项：${topStats}；短板：${weak}；路线倾向：${routeName(s)}。经费 ${s.resources.funds}，知名度 ${s.resources.fame}，压力 ${s.resources.pressure}。`;
}

export function makeReportModalBody(s) {
  const line = makeReportBody(s);
  return `<p>${line}</p><p>核心成员平均热情 <b>${avgHeat(s)}</b>，平均疲劳 <b>${avgFatigue(s)}</b>。普通成员活跃数 <b>${s.common.active}</b>，新人观察 <b>${s.common.newcomer}</b>。</p>`;
}

export function addReport(s) {
  const body = makeReportBody(s);
  s.termReports.push({ week: s.week, title: reportTitleByWeek(s.week), body });
  // record flawless term if burn risk low
  if (s.week === 16 || s.week === 24 || s.week === 40 || s.week === 48) {
    const burn = clamp(s.resources.pressure * 0.42 + avgFatigue(s) * 0.58);
    if (burn < 30) s.stats.__flawlessTerm = true;
  }
}
