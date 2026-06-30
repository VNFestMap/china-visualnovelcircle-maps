import { $ } from './dom.js';

let lastFocus = null;

export function trapFocus(container) {
  lastFocus = document.activeElement;
  const focusable = () => Array.from(
    container.querySelectorAll(
      'a, button:not([disabled]), select, textarea, input, [tabindex]:not([tabindex="-1"])',
    ),
  );
  const first = focusable()[0];
  if (first) first.focus();
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    if (e.shiftKey) {
      if (idx <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    } else {
      if (idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
  }
  container.addEventListener('keydown', onKey);
  return () => {
    container.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
}

export function announce(message) {
  const region = $('#a11yAnnouncer') || (() => {
    const r = document.createElement('div');
    r.id = 'a11yAnnouncer';
    r.setAttribute('role', 'status');
    r.setAttribute('aria-live', 'polite');
    r.setAttribute('aria-atomic', 'true');
    Object.assign(r.style, {
      position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden',
    });
    document.body.appendChild(r);
    return r;
  })();
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 30);
}
