import { clamp } from '../utils/math.js';
import { applyRes, applyStat, addLog } from '../state/mutations.js';
import { avgFatigue } from './lifecycle.js';

export function projectRisk(p, s) {
  const base = p.load * 2.1 + s.resources.pressure * 0.35 + avgFatigue(s) * 0.28
    - s.stats.org * 0.22 - s.stats.exec * 0.18 - p.quality * 0.15
    + (p.riskModifier || 0);
  return clamp(base);
}

export function startOrAdvanceProject(s, action, member, fit, skillPack) {
  if (!action.project) return;
  let p = s.projects.find((x) => x.id === action.project.id);
  if (!p) {
    p = {
      id: action.project.id,
      title: action.project.title,
      goal: action.project.goal,
      progress: action.project.progress,
      quality: action.project.quality,
      load: action.project.load,
      riskModifier: 0,
      owner: member.name,
    };
    s.projects.push(p);
  } else {
    p.progress = clamp(p.progress + Math.round(10 + fit * 0.08));
    p.quality = clamp(p.quality + Math.round(3 + 6));
    p.load = clamp(p.load + Math.round(2 + (s.policy === 'aggressive' ? 4 : s.policy === 'safe' ? 1 : 2)), 0, 100);
    p.owner = member.name;
  }
  if (skillPack?.project) {
    for (const k in skillPack.project) {
      if (k === 'risk') {
        p.riskModifier = clamp((p.riskModifier || 0) + skillPack.project[k], -100, 100);
      } else if (typeof p[k] === 'number') {
        p[k] = clamp(p[k] + skillPack.project[k], 0, 100);
      }
    }
  }
  if (p.progress >= 100 && !p.done) {
    p.done = true;
    p._justCompleted = true;
    const completionFunds = {
      magazine: 140,
      booth: 220,
      alliance: 40,
      vn: 40,
      handover: 0,
    }[p.id] || 0;
    applyRes(s, {
      fame: 8, influence: 8, credit: 2,
      relations: action.cat === 'external' ? 5 : 0,
      pressure: -4,
      funds: completionFunds,
    });
    applyStat(s, {
      content: action.id === 'vn' || action.id === 'magazine' ? 4 : 2,
      external: action.cat === 'external' ? 3 : 0,
      succession: action.id === 'handover' ? 5 : 0,
    });
    s.stats.__completed = [...(s.stats.__completed || []), p.id];
    addLog(s, `大型企划【${p.title}】顺利完成，同好会留下了新的成果。`, 'major');
  }
}
