const baseAchievementDefs = [
  { id: 'first_recruit', icon: '✦', title: '初次招新', desc: '首位新核心成员加入',
    require: { 'stats.__firstRecruit': { truthy: true } } },
  { id: 'magazine_done', icon: '刊', title: '刊物出师', desc: '完成首个社刊/联合刊物',
    require: { 'stats.__completed': { includes: 'magazine' } } },
  { id: 'vn_done', icon: '视', title: '原创短篇', desc: '完成一部原创短篇视觉小说',
    require: { 'stats.__completed': { includes: 'vn' } } },
  { id: 'booth_done', icon: '摊', title: '展会出征', desc: '完成一次展会出摊',
    require: { 'stats.__completed': { includes: 'booth' } } },
  { id: 'joint_done', icon: '联', title: '跨校之桥', desc: '完成一次跨校联合企划',
    require: { 'stats.__completed': { includes: 'alliance' } } },
  { id: 'handover_done', icon: '交', title: '薪火相传', desc: '完成交接包整理',
    require: { 'stats.__completed': { includes: 'handover' } } },
  { id: 'flawless_term', icon: '✧', title: '无烧一学期', desc: '学期结束时燃尽风险 < 30',
    require: { 'stats.__flawlessTerm': { truthy: true } } },
  { id: 'full_roster', icon: '✪', title: '满员同好会', desc: '核心成员达到 8 人',
    require: { 'fn:fullRoster': { fn: (s) => s.members.length >= 7 } } },
  { id: 'culture_specialist', icon: '✸', title: '文化匠人', desc: '任一文化倾向 ≥ 50',
    require: { 'fn:cultureSpec': { fn: (s) => Object.values(s.culture).some((v) => v >= 50) } } },
  { id: 'route_balance', icon: '◈', title: '六边形会长', desc: '六维能力均 ≥ 50',
    require: { 'fn:routeBalance': { fn: (s) => Object.entries(s.stats).filter(([k]) => !k.startsWith('__')).every(([, v]) => v >= 50) } } },
  { id: 'comeback', icon: '↻', title: '逆风翻盘', desc: '压力 ≥ 80 后回落到 30 以内',
    require: { 'stats.__comeback': { truthy: true } } },
  { id: 'legacy_first', icon: '✦', title: '第一份传承', desc: '完成学年并生成继承档案',
    require: { 'fn:legacyFirst': { fn: (s) => !!s.pendingLegacy || !!s.legacy } } },
  { id: 'arc_kyoko_2', icon: '❀', title: '传承的仪式', desc: '完成杏子的毕业交接',
    require: { 'fn:arcKyoko2': { fn: (s) => s.stats.__arcsResolved?.includes('kyoko_3') } } },
  { id: 'arc_laypark_2', icon: '❀', title: '架构之魂', desc: '完成液泡眼的重构之路',
    require: { 'fn:arcLaypark2': { fn: (s) => s.stats.__arcsResolved?.includes('laypark_2') } } },
  { id: 'arc_hanata_2', icon: '❀', title: '知识枢纽', desc: '完成花田的文档体系建设',
    require: { 'fn:arcHanata2': { fn: (s) => s.stats.__arcsResolved?.includes('hanata_2') } } },
  { id: 'arc_ob_2', icon: '❀', title: '薪火永续', desc: '完成老会长的最终传承',
    require: { 'fn:arcOb2': { fn: (s) => s.stats.__arcsResolved?.includes('ob_2') } } },
  { id: 'arc_baizhi_2', icon: '❀', title: '独立之翼', desc: '完成白纸的独立设计之路',
    require: { 'fn:arcBaizhi2': { fn: (s) => s.stats.__arcsResolved?.includes('baizhi_2') } } },
  { id: 'arc_beichuang_2', icon: '❀', title: '笔耕不辍', desc: '完成北窗的脚本打磨之旅',
    require: { 'fn:arcBeichuang2': { fn: (s) => s.stats.__arcsResolved?.includes('beichuang_2') } } },
];

const categories = {
  first_recruit: ['社群', 'bronze', 10],
  magazine_done: ['创作', 'silver', 20],
  vn_done: ['创作', 'gold', 30],
  booth_done: ['外联', 'silver', 20],
  joint_done: ['外联', 'silver', 20],
  handover_done: ['传承', 'silver', 20],
  flawless_term: ['经营', 'gold', 30],
  full_roster: ['社群', 'silver', 20],
  culture_specialist: ['经营', 'silver', 20],
  route_balance: ['经营', 'gold', 30],
  comeback: ['经营', 'gold', 30],
  legacy_first: ['传承', 'gold', 30],
};

export const achievementDefs = baseAchievementDefs.map((achievement) => {
  const fallback = achievement.id.startsWith('arc_')
    ? ['角色', achievement.id.endsWith('_2') ? 'gold' : 'silver', achievement.id.endsWith('_2') ? 30 : 20]
    : ['收藏', 'silver', 20];
  const [category, tier, points] = categories[achievement.id] || fallback;
  return { ...achievement, category, tier, points, hidden: achievement.id.endsWith('_2'), scope: 'profile' };
});

export const runGoalDefs = [
  { id: 'goal_community_50', title: '从小群到同好会', desc: '普通成员达到 50 人', category: '社群', target: 50, value: (s) => s.common.total },
  { id: 'goal_active_25', title: '不是只有群人数', desc: '活跃成员达到 25 人', category: '社群', target: 25, value: (s) => s.common.active },
  { id: 'goal_core_8', title: '核心组扩容', desc: '核心成员达到 8 人', category: '成员', target: 8, value: (s) => s.members.length },
  { id: 'goal_project_2', title: '留下作品', desc: '完成两个大型企划', category: '创作', target: 2, value: (s) => s.stats.__completed?.length || 0 },
];

export const achievementsById = Object.fromEntries(achievementDefs.map((a) => [a.id, a]));

export function getAchievementProgress(state) {
  const unlocked = (state.achievements?.unlocked || []).filter((id) => achievementsById[id]);
  const points = achievementDefs
    .filter((achievement) => unlocked.includes(achievement.id))
    .reduce((sum, achievement) => sum + achievement.points, 0);
  return { unlocked, total: achievementDefs.length, points };
}

export function getRunGoals(state) {
  return runGoalDefs.map((goal) => {
    const current = Math.min(goal.target, Math.max(0, goal.value(state)));
    return { ...goal, current, complete: current >= goal.target, percent: Math.round(current / goal.target * 100) };
  });
}
