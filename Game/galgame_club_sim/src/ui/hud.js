import { $ } from './dom.js';
import { getSeason } from '../game/week.js';
import { routeName } from '../game/lifecycle.js';
import { formatState } from '../utils/format.js';

export function renderHud(s) {
  const sea = getSeason(s.week);
  const deltas = s.__deltas || {};
  const arrow = (key) => {
    const diff = deltas['res_' + key];
    if (!diff) return '';
    return diff > 0 ? '<span class="delta delta--up">▲</span>' : '<span class="delta delta--down">▼</span>';
  };
  $('#hudWeek').textContent = s.week;
  $('#hudSeason').textContent = sea.name;
  $('#hudFunds').innerHTML = s.resources.funds + arrow('funds');
  $('#hudFame').innerHTML = s.resources.fame + arrow('fame');
  $('#hudPressure').innerHTML = s.resources.pressure + arrow('pressure');
  const yearProgress = Math.round((s.week / 48) * 100);
  $('#hudYear').textContent = `${yearProgress}%`;
  $('#hudYearBar').style.width = `${yearProgress}%`;
  $('#hudActiveMembers').textContent = s.common?.active ?? 0;
  $('#hudMemberStage').textContent = `${s.common?.stage || '萌芽期'} · 总计 ${s.common?.total || 0}`;
  $('#clubRoute').textContent = `路线倾向：${routeName(s)}`;

  // pressure alert
  const pressureState = formatState(s.resources.pressure, 'pressure');
  const pressureBox = $('#hudPressureBox');
  const pressureNote = $('#hudPressureNote');
  if (pressureState.level === 'bad') {
    pressureBox.classList.add('alert');
    pressureNote.textContent = '建议休整,压力过高';
    pressureBox.setAttribute('aria-label', `同好会压力 ${s.resources.pressure},高危,建议休整`);
  } else if (pressureState.level === 'warn') {
    pressureBox.classList.remove('alert');
    pressureNote.textContent = '压力偏高,注意节奏';
    pressureBox.setAttribute('aria-label', `同好会压力 ${s.resources.pressure},偏高`);
  } else {
    pressureBox.classList.remove('alert');
    pressureNote.textContent = '过高会导致燃尽与翻车';
    pressureBox.setAttribute('aria-label', `同好会压力 ${s.resources.pressure},正常`);
  }
}
