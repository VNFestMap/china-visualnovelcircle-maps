import { $ } from './dom.js';
import { clamp } from '../utils/math.js';
import { avgFatigue } from '../game/lifecycle.js';
import { formatState } from '../utils/format.js';
import { calcRecruitChance } from '../game/formulas.js';

export function renderDiagnostics(s) {
  const burn = clamp(s.resources.pressure * 0.42 + avgFatigue(s) * 0.58);
  const recruit = clamp(calcRecruitChance(s) * 100);
  const carry = clamp(s.stats.org * 0.28 + s.stats.exec * 0.25 + (100 - s.resources.pressure) * 0.22 + (100 - avgFatigue(s)) * 0.25);
  const handover = clamp(s.detail.docs * 0.28 + s.detail.juniors * 0.28 + s.detail.permission * 0.22 + s.detail.obSupport * 0.22);

  const items = [
    ['燃尽风险', burn, burn >= 66 ? '高压力企划要谨慎。' : '还在可控范围。', 'burnRisk'],
    ['招新转化', recruit, recruit >= 58 ? '宣传能接住新人。' : '需要看板与引导。'],
    ['企划承载', carry, carry >= 58 ? '可以推进中大型项目。' : '先补组织底盘。'],
    ['交接准备', handover, handover >= 58 ? '新人接班条件较好。' : '需要整理 SOP。'],
  ];

  $('#diagGrid').innerHTML = items.map(([n, v, p, type]) => {
    const st = formatState(v, type || 'default');
    const barCls = st.level;
    return `<div class="diag">
      <div class="diag-head"><span>${n}</span><b class="${st.level}">${v}</b></div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${n}"><div style="width:${v}%;background:linear-gradient(90deg,${barCls === 'bad' ? 'var(--danger)' : barCls === 'warn' ? 'var(--warn)' : 'var(--green)'},var(--gold))"></div></div>
      <p>${p}</p>
    </div>`;
  }).join('');
}
