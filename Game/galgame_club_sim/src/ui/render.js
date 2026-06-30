import { $ } from './dom.js';
import { getState } from '../state/store.js';
import { renderHud } from './hud.js';
import { renderOverview } from './overview.js';
import { renderResources } from './resources.js';
import { renderDiagnostics } from './diagnostics.js';
import { renderCommon, renderLegacy, renderMembers } from './members.js';
import { renderActions, renderMissionBoard } from './actions.js';
import { renderProjects } from './projects.js';
import { renderCulture } from './culture.js';
import { renderLogs } from './logs.js';
import { renderRefs } from './ref.js';
import { renderAchievements } from './achievements.js';
import { renderEventBox } from './event.js';
import { renderResultBox } from './result.js';

function safeRender(name, fn) {
  try { fn(); } catch (e) { console.error(`[render] ${name} failed`, e); }
}

export function render() {
  const s = getState();
  if (!s) return;
  safeRender('renderHud', () => renderHud(s));
  safeRender('renderOverview', () => renderOverview(s));
  safeRender('renderResources', () => renderResources(s));
  safeRender('renderDiagnostics', () => renderDiagnostics(s));
  safeRender('renderCommon', () => renderCommon(s));
  safeRender('renderLegacy', () => renderLegacy(s));
  safeRender('renderMembers', () => renderMembers(s));
  safeRender('renderActions', () => renderActions(s));
  safeRender('renderProjects', () => renderProjects(s));
  safeRender('renderCulture', () => renderCulture(s));
  safeRender('renderLogs', () => renderLogs(s));
  safeRender('renderRefs', () => renderRefs(s));
  safeRender('renderAchievements', () => renderAchievements(s));
  safeRender('renderEventBox', () => renderEventBox());
  safeRender('renderResultBox', () => renderResultBox(s));
  safeRender('renderMissionBoard', () => renderMissionBoard(s));
  // disable exec when blocked
  safeRender('doBtn state', () => {
    const doBtn = $('#doBtn');
    if (doBtn) doBtn.disabled = !!(s.event || s.pendingArc || s.pendingRecruit || s.gameOver);
  });
  // clear deltas after render so arrows only show for one cycle
  delete s.__deltas;
}
