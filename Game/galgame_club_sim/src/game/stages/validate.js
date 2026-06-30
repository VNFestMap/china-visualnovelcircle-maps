// src/game/stages/validate.js
import { calcActionCost, getSeason } from '../formulas.js';
import { seasons as allSeasons } from '../../data/seasons.js';

export function validate(s, action) {
  if (s.event || s.pendingRecruit || s.gameOver) return { ok: false, msg: '请先处理待办事件。' };

  const season = getSeason(s.week, allSeasons);
  if (!action.seasons.includes(season.key)) {
    return { ok: false, msg: '这个阶段不太适合执行这项行动。' };
  }

  if (s.resources.funds < calcActionCost(s, action)) {
    return { ok: false, msg: '经费不足。' };
  }

  if ((s.actionCooldowns?.[action.id] || 0) > 0) {
    return { ok: false, msg: `该行动还需等待 ${s.actionCooldowns[action.id]} 周。` };
  }

  if (action.project && s.projects.some((project) => project.id === action.project.id && project.done)) {
    return { ok: false, msg: '该企划本学年已经完成。' };
  }

  return { ok: true };
}
