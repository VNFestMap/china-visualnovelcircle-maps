import { $ } from './dom.js';

export function renderResultBox(s) {
  const box = $('#resultBox');
  box.innerHTML = `<h4>本周体验反馈</h4><p>${s.lastResult || '选择一项行动，开始经营本周的同好会。'}</p>`;
}
