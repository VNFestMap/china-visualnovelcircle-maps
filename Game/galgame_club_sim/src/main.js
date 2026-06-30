import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pregame.css';

import { $ } from './ui/dom.js';
import { getState, setState, update, subscribe } from './state/store.js';
import { loadState, saveState, saveLegacy, clearLegacy, removeState } from './state/persistence.js';
import { initialState, buildLegacy } from './game/lifecycle.js';
import { executeAction } from './game/week.js';
import { render } from './ui/render.js';
import { openModal, closeModal } from './ui/modal.js';
import { announce } from './ui/a11y.js';
import { pickEnding } from './data/endings.js';
import { checkAndUnlock } from './game/achievements.js';
import { showPregameScreen } from './ui/pregame.js';
import { statNames } from './data/stats.js';
import { routeName } from './game/lifecycle.js';
import { hydrateIcons, icon } from './ui/icons.js';
import { initNavigation } from './ui/navigation.js';

function startGame(config) {
  const initial = initialState(config);
  setState(initial);
  saveState(initial);
  render();
}

function initStore() {
  const loaded = loadState();
  if (loaded && !loaded.gameOver) {
    setState(loaded);
    render();
  } else {
    showPregameScreen(startGame);
  }
}

function showPendingReport(s) {
  if (!s.pendingReport) return;
  openModal(s.pendingReport.title, s.pendingReport.body);
  delete s.pendingReport;
  saveState(s);
}

function showEnding(s) {
  const legacy = s.pendingLegacy || buildLegacy(s);
  const ending = pickEnding(s, legacy);
  const lines = Object.entries(s.stats)
    .filter(([k]) => !k.startsWith('__'))
    .map(([k, v]) => `${statNames[k]} ${v}`).join('｜');
  const html = `
    <div class="ending-card">
      <div class="ending-card__icon" aria-hidden="true">${icon('trophy')}</div>
      <div>
        <div class="ending-card__name">${ending.name}</div>
        <p class="ending-card__sub">${ending.sub}</p>
      </div>
    </div>
    <p>${ending.body}</p>
    <p><b>最终路线倾向：</b>${routeName(s)}</p>
    <p><b>最终六维：</b>${lines}</p>
    <p><b>继承档案：</b>档案 ${legacy.archive} / 外联 ${legacy.network} / 管理 ${legacy.management} / 创作 ${legacy.creative}</p>
    <p>已解锁成就: <b>${(s.achievements?.unlocked || []).length}</b> 个。</p>
    <div class="modal-actions">
      <button class="btn secondary" id="inheritBtn">继承到新同好会</button>
      <button class="btn ghost" id="stayBtn">留在本局查看</button>
    </div>`;
  openModal('学年结束 · ' + ending.name, html);
  s.pendingEnding = { ending, legacy };

  setTimeout(() => {
    $('#inheritBtn')?.addEventListener('click', () => {
      saveLegacy(s.pendingEnding.legacy);
      removeState();
      closeModal();
      showPregameScreen(startGame);
    });
    $('#stayBtn')?.addEventListener('click', () => closeModal());
  }, 0);
}

function flashResult(text) {
  update((cur) => { cur.lastResult = text; return cur; });
  render();
}

function doExecute() {
  const s = getState();
  if (!s || s.event || s.pendingArc || s.pendingRecruit || s.gameOver) return;
  update((cur) => { executeAction(cur); return cur; });
  const after = getState();
  saveState(after);
  if (after.pendingReport) showPendingReport(after);
  else if (after.gameOver && after.pendingLegacy) showEnding(after);
  render();
  const fresh = getState();
  const newly = fresh.achievements?.recentlyUnlocked || [];
  if (newly.length) {
    announce(`解锁 ${newly.length} 个新成就:${newly.join('、')}`);
  }
}

function bindEvents() {
  $('#doBtn').addEventListener('click', doExecute);
  $('#saveBtn').addEventListener('click', () => {
    saveState(getState());
    flashResult('已保存当前进度。');
    announce('已保存当前进度');
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('确定要重新开局吗?当前进度会丢失。')) return;
    removeState();
    closeModal();
    showPregameScreen(startGame);
  });
  $('#clearLegacyBtn').addEventListener('click', () => {
    if (!confirm('确定要清除继承档案吗?')) return;
    clearLegacy();
    flashResult('已清除继承。');
  });

  $('#policySelect').addEventListener('click', (event) => {
    const button = event.target.closest('[data-policy]');
    if (!button) return;
    update((cur) => { cur.policy = button.dataset.policy; return cur; });
    render();
    saveState(getState());
  });
  $('#closeModal').addEventListener('click', closeModal);
  $('#modalMask').addEventListener('click', (e) => {
    if (e.target === $('#modalMask')) closeModal();
  });

}

hydrateIcons();
initNavigation();
initStore();
bindEvents();

// Re-render when state changes
subscribe(() => {});

// Check for pending report (on load after previous session)
const s0 = getState();
if (s0) {
  if (s0.pendingReport) showPendingReport(s0);
  else if (s0.gameOver && s0.pendingLegacy) showEnding(s0);
}

// Periodically auto-save (every 30s as safety net)
setInterval(() => { const st = getState(); if (st) saveState(st); }, 30000);
