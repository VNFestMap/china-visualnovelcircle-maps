import { matches } from '../content/conditions.js';

const numericStats = (s) => Object.entries(s.stats)
  .filter(([key, value]) => !key.startsWith('__') && typeof value === 'number')
  .map(([, value]) => value);

const avgCoreFatigue = (s) => s.members.reduce((sum, member) => sum + member.fatigue, 0)
  / Math.max(s.members.length, 1);

export const endings = [
  {
    id: 'burnout', name: '燃尽之终', icon: '⚠',
    sub: '高压下集体疲惫，需要冷却',
    require: {
      'fn:burnout': { fn: (s) => s.common.fatigue >= 80 || avgCoreFatigue(s) >= 75 || (s.resources.pressure >= 90 && avgCoreFatigue(s) >= 60) },
    },
    score: () => Number.POSITIVE_INFINITY,
    body: '这一年你做了很多事，但核心成员和普通成员都已经很疲惫。下一届需要做的第一件事，是让大家休息。',
  },
  {
    id: 'succession', name: '传承之道', icon: '✦',
    sub: '把同好会交到下一代手里，档案与文化延续',
    require: {
      'stats.__completed': { includes: 'handover' },
      'culture.archive': { gte: 35 },
      'stats.succession': { gte: 60 },
    },
    score: (s, l) => 50 + l.archive * 2 + l.management * 2 + s.culture.archive + s.stats.succession * 0.4,
    body: '这一年里你做的最重要的事，不是完成了多少企划，而是把"经验"和"人"交到了下一届的手里。同好会会继续存在下去，而且会带着你的痕迹。',
  },
  {
    id: 'creative', name: '创作之光', icon: '✎',
    sub: '把同人作品做出真正的存在感',
    require: {
      'fn:creativeWork': { fn: (s) => s.stats.__completed?.some((id) => id === 'vn' || id === 'magazine') },
      'stats.content': { gte: 60 },
    },
    score: (s, l) => 50 + l.creative * 2 + s.culture.creative + s.culture.publication * 1.8 + s.stats.content * 0.4,
    body: '你选择把同好会的核心能量放在原创作品上。这一年，你们做出了能留下来的东西：社刊、视觉小说 和持续更新的平台。',
  },
  {
    id: 'alliance', name: '连接之网', icon: '联',
    sub: '让同好会跳出校园，建立网络',
    require: {
      'fn:externalWork': { fn: (s) => s.stats.__completed?.some((id) => id === 'alliance' || id === 'booth') },
      'culture.alliance': { gte: 15 },
      'stats.external': { gte: 55 },
    },
    score: (s, l) => 50 + l.network * 2 + s.culture.alliance * 2 + s.stats.external * 0.5,
    body: '你把同好会从"校内小群"做成了跨校网络的节点。外校伙伴、展会摊位和联合刊物，让同好会拥有了更广的连接。',
  },
  {
    id: 'campus', name: '校园之根', icon: '✸',
    sub: '让同好会成为校内不可替代的存在',
    require: {
      'culture.campus': { gte: 24 },
      'common.total': { gte: 22 },
    },
    score: (s) => s.culture.campus * 2 + s.common.total + s.stats.part * 0.3,
    body: '你选择扎根校内：迎新摊位、墙帖、同好会文化节和稳定的例会。下一届接手时，校内已经有一群人知道并需要这个同好会。',
  },
  {
    id: 'balance', name: '六边形之路', icon: '◈',
    sub: '六维均衡的稳健路线',
    require: {
      'fn:allStats65': { fn: (s) => numericStats(s).every((value) => value >= 65) },
    },
    score: (s) => Math.min(...numericStats(s)) * 5 + numericStats(s).reduce((sum, value) => sum + value, 0) / 6,
    body: '你没有偏科：内容、传承、外联、参与、执行和组织都保持在不错的水平。下届接手时，同好会可以选择任何方向继续。',
  },
  {
    id: 'steady', name: '维持之年', icon: '○',
    sub: '没有耀眼的突破，但同好会仍然稳定存在',
    require: {},
    score: () => 0,
    body: '这一年没有完成足以定义同好会方向的大成果，但例会仍在继续，成员也没有散去。下一届还有继续尝试的空间。',
  },
];

export function pickEnding(state, legacy) {
  const burnout = endings.find((ending) => ending.id === 'burnout');
  try {
    if (matches(state, legacy, null, burnout.require)) return burnout;
  } catch { /* fall through to positive routes */ }

  const eligible = endings
    .filter((ending) => ending.id !== 'burnout' && ending.id !== 'steady')
    .filter((ending) => {
      try { return matches(state, legacy, null, ending.require); }
      catch { return false; }
    })
    .sort((a, b) => b.score(state, legacy) - a.score(state, legacy));

  return eligible[0] || endings.find((ending) => ending.id === 'steady');
}
