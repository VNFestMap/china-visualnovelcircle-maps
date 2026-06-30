import { announce } from './a11y.js';

const ROUTES = ['command', 'members', 'archive', 'projects', 'achievements'];
let currentRoute = 'command';

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(route) ? route : 'command';
}

function routeLabel(route) {
  return {
    command: '指挥台',
    members: '成员管理',
    archive: '同好会档案',
    projects: '企划报告',
    achievements: '成就收藏室',
  }[route];
}

export function applyRoute({ focus = false } = {}) {
  currentRoute = routeFromHash();
  document.querySelectorAll('[data-view]').forEach((view) => {
    const active = view.dataset.view === currentRoute;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
    view.tabIndex = active ? -1 : 0;
  });
  document.querySelectorAll('.game-nav__item').forEach((button) => {
    const active = button.dataset.route === currentRoute;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.body.dataset.route = currentRoute;
  if (focus) {
    const view = document.querySelector(`[data-view="${currentRoute}"]`);
    view?.focus({ preventScroll: true });
    announce(`已进入${routeLabel(currentRoute)}`);
  }
}

export function navigate(route, { replace = false } = {}) {
  const target = ROUTES.includes(route) ? route : 'command';
  const hash = `#${target}`;
  if (window.location.hash === hash) {
    applyRoute({ focus: true });
    return;
  }
  if (replace) history.replaceState(null, '', hash);
  else window.location.hash = hash;
}

export function initNavigation() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('button[data-route], a[data-route]');
    if (!trigger) return;
    event.preventDefault();
    navigate(trigger.dataset.route);
  });
  window.addEventListener('hashchange', () => applyRoute({ focus: true }));
  if (!window.location.hash) navigate('command', { replace: true });
  applyRoute();
}

export function getCurrentRoute() {
  return currentRoute;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentRoute !== 'command') navigate('command');
});
