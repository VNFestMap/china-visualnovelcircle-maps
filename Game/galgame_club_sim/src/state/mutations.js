import { clamp } from '../utils/math.js';
import { detailDefs } from '../data/stats.js';

export function applyRes(s, obj) {
  for (const k in obj) {
    if (k === 'funds') s.resources[k] = Math.max(0, s.resources[k] + obj[k]);
    else s.resources[k] = clamp(s.resources[k] + obj[k]);
  }
}

export function applyStat(s, obj) {
  for (const k in obj) {
    if (typeof s.stats[k] === 'number') s.stats[k] = clamp(s.stats[k] + obj[k]);
  }
}

export function touchDetail(s, obj) {
  const before = summarizeDetail(s.detail);
  for (const k in obj) {
    if (typeof s.detail[k] === 'number') s.detail[k] = clamp(s.detail[k] + obj[k]);
  }
  const after = summarizeDetail(s.detail);
  for (const k in after) {
    const delta = after[k] - before[k];
    if (typeof s.stats[k] !== 'number') s.stats[k] = after[k];
    else s.stats[k] = clamp(s.stats[k] + delta);
  }
}

export function summarizeDetail(detail) {
  const o = {};
  for (const [stat, def] of Object.entries(detailDefs)) {
    o[stat] = clamp(def.keys.reduce((s, k) => s + (detail[k] || 0), 0) / def.keys.length);
  }
  return o;
}

export function addLog(s, entry, type = '') {
  const payload = typeof entry === 'string'
    ? { summary: entry, detail: '', actors: [], changes: [], type }
    : {
      summary: entry.summary || entry.text || '',
      detail: entry.detail || '',
      quote: entry.quote || '',
      actors: entry.actors || [],
      changes: entry.changes || [],
      category: entry.category || '日常',
      outcome: entry.outcome || '',
      type: entry.type || type,
    };
  s.logs.push({ week: s.week, ...payload });
  if (s.logs.length > 120) s.logs.shift();
}

export function boostProjectType(s, id, delta) {
  const p = s.projects.find((x) => x.id === id);
  if (!p) return;
  for (const k in delta) {
    if (typeof p[k] === 'number') p[k] = clamp(p[k] + delta[k], 0, 100);
    else p[k] = clamp((p[k] || 0) + delta[k], 0, 100);
  }
}

export function initialDetail() {
  return {
    schedule: 34, division: 28, finance: 22, compliance: 24,
    planning: 30, materials: 24, publicity: 26, offline: 22,
    newcomer: 28, retention: 30, chat: 34, review: 18,
    articles: 20, archive: 18, design: 22, projectOutput: 15,
    crossTrust: 16, eventLink: 10, platform: 18, schoolLink: 18,
    docs: 14, juniors: 18, permission: 12, obSupport: 16,
  };
}
