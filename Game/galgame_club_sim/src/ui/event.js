import { $ } from './dom.js';
import { resolveEvent, resolvePendingArc, resolveRecruitChoice } from '../game/week.js';
import { calcAptitude } from '../game/formulas.js';
import { actions } from '../data/actions.js';
import { saveState } from '../state/persistence.js';
import { getState, update } from '../state/store.js';
import { render } from './render.js';

export function renderEventBox() {
  const s = getState();
  const box = $('#eventBox');
  if (!s.event && !s.pendingArc && !s.pendingRecruit) { box.innerHTML = ''; return; }
  if (s.pendingRecruit) {
    const recruit = s.pendingRecruit;
    const sourceAction = actions.find((action) => action.id === recruit.sourceAction) || actions[0];
    box.innerHTML = `<div class="event recruit-event" role="dialog" aria-labelledby="recruitTitle">
      <h3 id="recruitTitle">${recruit.title}</h3>
      <p>${recruit.text}</p>
      <div class="recruit-candidates">${recruit.candidates.map((member, index) => {
        const top = Object.entries(member.aptitudes || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
        return `<button class="recruit-choice" data-i="${index}">
          <strong>${member.name}</strong>
          <small>${member.role}</small>
          <span class="recruit-choice__fit">本次契机 ${calcAptitude(sourceAction, member)}</span>
          <span class="recruit-choice__tags">${top.map(([id, value]) => {
            const action = actions.find((item) => item.id === id);
            return `<i>${action?.title || id} ${value}</i>`;
          }).join('')}</span>
        </button>`;
      }).join('')}</div>
    </div>`;
    box.querySelectorAll('.recruit-choice').forEach((button) => {
      button.addEventListener('click', () => {
        update((cur) => { resolveRecruitChoice(cur, Number(button.dataset.i)); return cur; });
        saveState(getState());
        render();
      });
    });
    return;
  }
  if (s.event) {
    const e = s.event;
    box.innerHTML = `<div class="event" role="alertdialog" aria-labelledby="eventTitle"><h3 id="eventTitle">突发事件：${e.title}</h3><p>${e.text}</p>${e.choices.map((c, i) => `<button class="choice" data-i="${i}">${c.label}</button>`).join('')}</div>`;
    box.querySelectorAll('.choice').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = +b.dataset.i;
        update((cur) => { resolveEvent(cur, idx); return cur; });
        render();
      });
    });
    return;
  }
  if (s.pendingArc) {
    const a = s.pendingArc;
    box.innerHTML = `<div class="event arc" role="alertdialog" aria-labelledby="arcTitle"><h3 id="arcTitle">${a.member}：${a.arc.title}</h3><p>${a.arc.text}</p>${a.arc.choices.map((c, i) => `<button class="choice" data-i="${i}">${c.label}</button>`).join('')}</div>`;
    box.querySelectorAll('.choice').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = +b.dataset.i;
        update((cur) => { resolvePendingArc(cur, idx); return cur; });
        render();
      });
    });
  }
}
