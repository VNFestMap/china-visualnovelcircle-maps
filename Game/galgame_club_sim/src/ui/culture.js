import { $ } from './dom.js';
import { cultureNames } from '../data/culture.js';

export function renderCulture(s) {
  $('#cultureList').innerHTML = Object.entries(cultureNames)
    .sort((a, b) => s.culture[b[0]] - s.culture[a[0]])
    .map(([k, n], index) => `<div class="culture">
      <div class="culture__rank">${String(index + 1).padStart(2, '0')}</div>
      <div class="culture__content">
        <h4><span>${n}</span><b>${s.culture[k]}</b></h4>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.culture[k]}" aria-label="${n}"><div style="width:${s.culture[k]}%"></div></div>
      </div>
    </div>`)
    .join('');
}
