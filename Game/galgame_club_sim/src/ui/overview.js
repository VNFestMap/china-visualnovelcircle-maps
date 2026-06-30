import { $ } from './dom.js';
import { getSeason } from '../game/week.js';
import { statNames } from '../data/stats.js';
import { clamp } from '../utils/math.js';
import { drawRadar } from './radar.js';

export function renderOverview(s) {
  const sea = getSeason(s.week);
  $('#seasonPill').textContent = sea.name;
  $('#weekNumber').textContent = `第 ${s.week} 周`;
  $('#weekHint').textContent = sea.hint;
  $('#seasonNote').textContent = sea.note;
  const [start, end] = sea.range;
  const pct = (s.week - start) / (end - start) * 100;
  $('#termProgress').style.width = `${clamp(pct, 0, 100)}%`;
  $('#termProgressBar').setAttribute('aria-valuenow', String(clamp(pct, 0, 100)));
  $('#statList').innerHTML = Object.entries(statNames).map(([k, n]) =>
    `<div class="stat-row"><span>${n.replace('度', '').replace('力', '')}</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.stats[k]}" aria-label="${n}"><div style="width:${s.stats[k]}%"></div></div><b>${s.stats[k]}</b></div>`,
  ).join('');
  drawRadar(s);
}
