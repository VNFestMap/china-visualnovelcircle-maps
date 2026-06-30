import { allMembers } from '../data/members.js';
import { achievementDefs } from '../data/achievements.js';

const STORAGE_KEY = 'galgameClubSimV7State';
const LEGACY_KEY = 'galgameClubSimV7Legacy';
const PROFILE_KEY = 'galgameClubSimV7Profile';
const achievementIds = new Set(achievementDefs.map((achievement) => achievement.id));
const legacyLeaderName = ['老', '社', '长'].join('');

function migrateMemberName(name) {
  return name === legacyLeaderName ? '老会长' : name;
}

function migrateText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replaceAll(legacyLeaderName, '老会长')
    .replaceAll('社团', '同好会')
    .replaceAll('司令台', '指挥台')
    .replaceAll('VN', '视觉小说');
}

function normalizeProfile(profile = {}) {
  const unlocked = Array.from(new Set(profile.unlocked || []))
    .filter((id) => achievementIds.has(id));
  const unlockedSet = new Set(unlocked);
  const points = achievementDefs
    .filter((achievement) => unlockedSet.has(achievement.id))
    .reduce((sum, achievement) => sum + achievement.points, 0);
  return { ...profile, unlocked, points };
}

function safeParse(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[persistence] failed to parse ${key}:`, err);
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[persistence] failed to save ${key}:`, err);
    return false;
  }
}

function normalizeState(state) {
  if (!state) return null;
  state.actionCooldowns ||= {};
  state.achievements ||= { unlocked: [], recentlyUnlocked: [] };
  const profile = getProfile();
  state.achievements.unlocked = Array.from(new Set([
    ...(profile.unlocked || []),
    ...(state.achievements.unlocked || []),
  ])).filter((id) => achievementIds.has(id));
  state.achievements.recentlyUnlocked = (state.achievements.recentlyUnlocked || [])
    .filter((id) => achievementIds.has(id));
  if (state.achievements.unlocked.length !== (profile.unlocked || []).length) {
    saveProfile({ ...profile, unlocked: [...state.achievements.unlocked] });
  }
  state.stats ||= {};
  state.stats.__completed ||= [];
  state.stats.__arcsResolved ||= [];
  state.stats.__arcsResolved = state.stats.__arcsResolved.map(migrateMemberName);
  state.stats.__eventsSeen ||= [];
  state.projects ||= [];
  const memberCatalog = new Map(allMembers.map((member) => [member.name, member]));
  state.members = (state.members || []).map((member) => {
    const name = migrateMemberName(member.name);
    const catalog = memberCatalog.get(name);
    return {
      ...catalog,
      ...member,
      name,
      role: catalog?.role || migrateText(member.role),
      trait: catalog?.trait || migrateText(member.trait),
      tags: catalog?.tags || member.tags || [],
      passive: catalog?.passive || member.passive,
      weakness: catalog?.weakness || member.weakness,
      aptitudes: member.aptitudes || catalog?.aptitudes || {},
    };
  });
  state.recruitPool = (state.recruitPool || []).map((member) => {
    const name = migrateMemberName(member.name);
    const catalog = memberCatalog.get(name);
    return {
      ...catalog,
      ...member,
      name,
      role: catalog?.role || migrateText(member.role),
      trait: catalog?.trait || migrateText(member.trait),
      tags: catalog?.tags || member.tags || [],
      passive: catalog?.passive || member.passive,
      weakness: catalog?.weakness || member.weakness,
      aptitudes: member.aptitudes || catalog?.aptitudes || {},
    };
  });
  state.selectedMember = migrateMemberName(state.selectedMember);
  if (state.arcSeenFor?.[legacyLeaderName]) {
    state.arcSeenFor['老会长'] = Array.from(new Set([
      ...(state.arcSeenFor['老会长'] || []),
      ...state.arcSeenFor[legacyLeaderName],
    ]));
    delete state.arcSeenFor[legacyLeaderName];
  }
  if (state.pendingArc?.member) state.pendingArc.member = migrateMemberName(state.pendingArc.member);
  state.pendingRecruit ||= null;
  state.common ||= {};
  state.common.total ??= 10;
  state.common.active ??= Math.min(5, state.common.total);
  state.common.newcomer ??= 0;
  state.common.silent ??= Math.max(0, state.common.total - state.common.active - state.common.newcomer);
  state.common.prospects ??= 5;
  state.common.stage ||= state.common.total >= 100 ? '大型社群'
    : state.common.total >= 50 ? '校级同好会'
      : state.common.total >= 20 ? '稳定期' : '萌芽期';
  state.common.stage = migrateText(state.common.stage);
  state.common.reachedStages = (state.common.reachedStages || [state.common.stage]).map(migrateText);
  state.logs = (state.logs || []).map((log) => typeof log === 'string'
    ? { week: state.week || 1, summary: migrateText(log), detail: '', type: '' }
    : {
      ...log,
      summary: migrateText(log.summary || log.text || ''),
      detail: migrateText(log.detail || ''),
      quote: migrateText(log.quote || ''),
      category: migrateText(log.category || ''),
      actors: (log.actors || []).map(migrateMemberName),
      changes: (log.changes || []).map(migrateText),
    });
  state.projects.forEach((project) => {
    project.title = migrateText(project.title);
    project.goal = migrateText(project.goal);
    if (typeof project.riskModifier !== 'number') {
      project.riskModifier = typeof project.risk === 'number' ? project.risk : 0;
    }
    delete project.risk;
  });
  state.lastResult = migrateText(state.lastResult);
  if (state.pendingReport) {
    state.pendingReport.title = migrateText(state.pendingReport.title);
    state.pendingReport.body = migrateText(state.pendingReport.body);
  }
  state.termReports = (state.termReports || []).map((report) => ({
    ...report,
    title: migrateText(report.title),
    body: migrateText(report.body),
  }));
  return state;
}

export const loadState = () => normalizeState(safeParse(STORAGE_KEY));
export const saveState = (state, showTip = false) => {
  const ok = safeSet(STORAGE_KEY, state);
  return ok;
};

export const getLegacy = () => safeParse(LEGACY_KEY);
export const getProfile = () => {
  const stored = safeParse(PROFILE_KEY);
  const profile = normalizeProfile(stored || { unlocked: [], points: 0 });
  if (stored && JSON.stringify(profile) !== JSON.stringify(stored)) {
    safeSet(PROFILE_KEY, profile);
  }
  return profile;
};
export const saveProfile = (data) => safeSet(PROFILE_KEY, normalizeProfile(data));
export const saveLegacy = (data) => safeSet(LEGACY_KEY, data);
export const clearLegacy = () => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(LEGACY_KEY); return true;
  }
  catch { return false; }
};
export const removeState = () => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(STORAGE_KEY); return true;
  }
  catch { return false; }
};

export const STORAGE_KEYS = { STORAGE_KEY, LEGACY_KEY, PROFILE_KEY };
