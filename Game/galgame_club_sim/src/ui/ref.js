import { $ } from './dom.js';
import { refs } from '../data/refs.js';

export function renderRefs(s) {
  const el = $('#refList');
  if (!el) return;
  const i = (s.week - 1) % refs.length;
  const j = (i + 2) % refs.length;
  const k = (i + 4) % refs.length;
  el.innerHTML = [refs[i], refs[j], refs[k]]
    .map((r) => `<div class="insight" role="article" aria-label="${r.title}"><h4>${r.title}</h4><p>${r.body}</p></div>`)
    .join('');
}
