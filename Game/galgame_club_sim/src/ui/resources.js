import { $ } from './dom.js';
import { resNames } from '../data/resources.js';
import { formatState } from '../utils/format.js';

export function renderResources(s) {
  const deltas = s.__deltas || {};
  const arrow = (key) => {
    const diff = deltas['res_' + key];
    if (!diff) return '';
    return diff > 0 ? '<span class="delta delta--up">▲</span>' : '<span class="delta delta--down">▼</span>';
  };
  $('#resGrid').innerHTML = Object.entries(resNames).map(([k, n]) => {
    const v = s.resources[k];
    const st = formatState(v, k);
    return `<div class="res-card res-card--${st.level}">
      <span class="res-label">${n}</span>
      <span class="res-value ${st.level}">${v}${arrow(k)}</span>
    </div>`;
  }).join('');
}
