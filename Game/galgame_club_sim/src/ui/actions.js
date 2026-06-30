import { $ } from './dom.js';
import { actions } from '../data/actions.js';
import { categoryInfo, resNames } from '../data/resources.js';
import { statNames } from '../data/stats.js';
import { getSeason, detailSupport, previewSkill } from '../game/week.js';
import { currentMember } from '../game/lifecycle.js';
import { getState, update } from '../state/store.js';
import { saveState } from '../state/persistence.js';
import { render } from './render.js';
import { announce } from './a11y.js';
import { calcActionCost, calcFitBreakdown } from '../game/formulas.js';
import { icon } from './icons.js';

const actionIcon = (action) => {
  if (action.id === 'funding') return 'funds';
  return {
    campus: 'campus',
    content: 'content',
    external: 'external',
    creative: 'creative',
    succession: 'succession',
    rest: 'rest',
  }[action.cat] || 'command';
};

function availableActions(s) {
  const sea = getSeason(s.week);
  return actions.filter((a) => s.activeTab === 'all' || a.cat === s.activeTab)
    .filter((a) => a.seasons.includes(sea.key) || s.activeTab === 'all' || a.cat === s.activeTab);
}

export function renderTabs(s) {
  const tabs = $('#tabs');
  tabs.innerHTML = Object.entries(categoryInfo).map(([k, n]) =>
    `<button class="tab ${s.activeTab === k ? 'active' : ''}" data-tab="${k}" role="tab" aria-selected="${s.activeTab === k}">${n}</button>`,
  ).join('');
  tabs.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => {
      update((cur) => { cur.activeTab = b.dataset.tab; return cur; });
      renderActions(getState());
      announce(`切换到 ${b.textContent} 分类`);
    });
  });
}

function actionPreview(s, a) {
  const m = currentMember(s);
  const sup = detailSupport(s, a);
  const sk = previewSkill(m, a);
  const fitPack = calcFitBreakdown(a, m, sup, !!sk?.ready);
  const pressure = a.res.pressure || 0;
  const fat = a.fatigue || 0;
  const main = Object.entries(a.stats).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).map(([k, v]) => `<span class="ptag good">${statNames[k].replace('度', '').replace('力', '')} +${v}</span>`).join('');
  const resRows = Object.entries(a.res || {}).filter(([k]) => k !== 'pressure').map(([k, v]) => {
    const label = resNames[k] || k;
    const sign = v >= 0 ? '+' : '';
    return `<span class="ptag ${v > 0 ? 'good' : v < 0 ? 'bad' : ''}">${label} ${sign}${v}</span>`;
  }).join('');
  const pressureTag = pressure !== 0 ? `<span class="ptag ${pressure >= 12 ? 'bad' : pressure >= 6 ? 'warn' : 'good'}">压力 ${pressure >= 0 ? '+' : ''}${pressure}</span>` : '';
  const fatTag = fat !== 0 ? `<span class="ptag ${fat >= 14 ? 'bad' : fat >= 8 ? 'warn' : 'good'}">疲劳 ${fat >= 0 ? '+' : ''}${fat}</span>` : '';
  const skillTag = sk ? `<span class="ptag ${sk.ready ? 'good' : 'warn'}">技能:${sk.ready ? sk.name : `冷却 ${sk.cd}`}</span>` : '';
  return `<span class="preview-stats">${main}${resRows}${pressureTag}${fatTag}${skillTag}</span>`;
}

export function renderActions(s) {
  renderTabs(s);
  const list = availableActions(s);
  $('#actionCountBadge').textContent = `可选行动 ${list.length}`;

  $('#actions').innerHTML = list.map((a) => {
    const season = getSeason(s.week);
    const ok = a.seasons.includes(season.key);
    const actionCost = calcActionCost(s, a);
    const fund = s.resources.funds >= actionCost;
    const cooldown = s.actionCooldowns?.[a.id] || 0;
    const projectDone = a.project && s.projects.some((project) => project.id === a.project.id && project.done);
    const dis = !ok || !fund || cooldown > 0 || projectDone || !!s.event || !!s.pendingArc || !!s.pendingRecruit || s.gameOver;
    const sel = s.selectedAction === a.id;
    const m = currentMember(s);
    const sup = detailSupport(s, a);
    const selectedSkill = previewSkill(m, a);
    const fitPack = calcFitBreakdown(a, m, sup, !!selectedSkill?.ready);
    const fit = fitPack.score;
    const fitCls = fit >= 72 ? 'good' : fit >= 52 ? 'warn' : 'bad';
    const tags = [
      ...a.tags.slice(0, 3).map((t) => `<span class="tag">${t}</span>`),
      `<span class="tag ${actionCost > 180 ? 'warn' : 'good'}">经费 ${actionCost ? '-' + actionCost : '免费'}</span>`,
      a.project ? `<span class="tag good">企划</span>` : '',
      !fund ? `<span class="tag bad">经费不足</span>` : '',
      cooldown ? `<span class="tag warn">等待 ${cooldown} 周</span>` : '',
      projectDone ? `<span class="tag good">本年已完成</span>` : '',
    ].join('');
    const aria = `${a.title},适配度 ${fit},${a.seasons.includes(season.key) ? '当前季节可用' : '当前季节不可用'},${actionCost ? `消耗 ${actionCost} 经费` : '免费'},${cooldown ? `还需等待 ${cooldown} 周` : '无行动冷却'},${a.project ? '跨周企划' : '单次行动'}`;
    return `<button class="action ${sel ? 'sel' : ''}" data-id="${a.id}" ${dis ? 'disabled aria-disabled="true"' : ''} role="option" aria-selected="${sel}" aria-label="${aria}">
      <div class="action-head"><div><b>${a.title}</b></div><div class="icon">${icon(actionIcon(a))}</div></div>
      <p>${a.desc}</p>
      <div class="tags">${tags}</div>
      <div class="preview">
        <span class="fit-label">适配度</span>
        <span class="fit-badge ${fitCls}">${fit}</span>
        <span class="fit-rating fit-rating--${fitCls}">${fitPack.rating}</span>
        ${actionPreview(s, a)}
      </div>
    </button>`;
  }).join('');

  $('#actions').querySelectorAll('.action').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.disabled) return;
      update((cur) => { cur.selectedAction = b.dataset.id; return cur; });
      renderActions(getState());
      renderMissionBoard(getState());
      saveState(getState());
      const title = b.querySelector('b')?.textContent;
      if (title) announce(`已选择行动 ${title}`);
    });
  });

  renderMissionBoard(s);
}

function policyName(p) {
  return p === 'balanced' ? '平衡' : p === 'aggressive' ? '冲刺' : '稳健';
}

export function renderMissionBoard(s) {
  const a = actions.find((x) => x.id === s.selectedAction) || actions[0];
  const m = currentMember(s);
  const sup = detailSupport(s, a);
  const sk = previewSkill(m, a);
  const fitPack = calcFitBreakdown(a, m, sup, !!sk?.ready);
  const fit = fitPack.score;
  const recommendations = [...s.members]
    .map((member) => {
      const memberSkill = previewSkill(member, a);
      return { member, fit: calcFitBreakdown(a, member, sup, !!memberSkill?.ready) };
    })
    .sort((x, y) => y.fit.score - x.fit.score)
    .slice(0, 3);
  const advice = a.cat === 'campus' ? '适合补招新、活动节奏和校内扎根。'
    : a.cat === 'content' ? '适合拉高内容沉淀、平台与刊物积累。'
    : a.cat === 'external' ? '适合扩展外联和展会影响，但要小心压力。'
    : a.cat === 'creative' ? '适合做原创项目，长期收益高。'
    : a.cat === 'succession' ? '适合交接和传承布局。'
    : '适合缓解疲劳与整理节奏。';
  const cooldown = s.actionCooldowns?.[a.id] || 0;
  $('#missionBoard').innerHTML = `<h3>${a.title}</h3><p>${a.desc}</p><div class="result-tags" style="margin-top:10px"><span class="tag">负责人：${m.name}</span><span class="state-pill state-pill--${fit >= 74 ? 'good' : fit >= 58 ? 'warn' : 'bad'}"><span class="state-pill__icon" aria-hidden="true">${fit >= 74 ? '✓' : fit >= 58 ? '●' : '⚠'}</span>${fitPack.rating} ${fit}</span><span class="tag">专长 ${fitPack.aptitude}</span><span class="tag">经营策略：${policyName(s.policy)}</span>${cooldown ? `<span class="tag warn">行动冷却 ${cooldown} 周</span>` : ''}${sk ? `<span class="tag ${sk.ready ? 'good' : 'warn'}">技能 ${sk.ready ? '可发动' : `冷却 ${sk.cd} 周`}</span>` : ''}</div><div class="recommend-list" aria-label="推荐负责人">${recommendations.map(({ member, fit: pack }, index) => `<button type="button" class="recommend-chip" data-recommend-member="${member.name}"><span>${index + 1}. ${member.name}</span><b>${pack.rating} ${pack.score}</b></button>`).join('')}</div><div class="section-note">推荐思路：${advice}</div>`;
  $('#missionBoard').querySelectorAll('[data-recommend-member]').forEach((button) => {
    button.addEventListener('click', () => {
      update((cur) => { cur.selectedMember = button.dataset.recommendMember; return cur; });
      render();
      saveState(getState());
    });
  });
}
