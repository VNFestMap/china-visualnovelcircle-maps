import { $ } from './dom.js';
import { trapFocus, announce } from './a11y.js';

let releaseTrap = null;

export function openModal(title, html) {
  const mask = $('#modalMask');
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  mask.hidden = false;
  mask.classList.add('show');
  releaseTrap = trapFocus(mask);
  announce(`弹窗:${title}`);
  setTimeout(() => {
    mask.querySelectorAll('button').forEach((b) => b.addEventListener('click', onModalClick));
  }, 0);
}

export function closeModal() {
  const mask = $('#modalMask');
  mask.classList.remove('show');
  mask.hidden = true;
  mask.querySelectorAll('button').forEach((b) => b.removeEventListener('click', onModalClick));
  if (releaseTrap) { releaseTrap(); releaseTrap = null; }
}

function onModalClick(e) {
  if (e.target.closest('#closeModal')) closeModal();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const mask = $('#modalMask');
    if (mask && !mask.hidden) closeModal();
  }
});
