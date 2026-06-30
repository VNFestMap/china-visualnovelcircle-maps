import { allMembers, coreSeed } from '../data/members.js';
import { skills } from '../data/skills.js';
import { $ } from './dom.js';

const MAX_SELECT = 6;

let selected = [];
let fundsVal = 780;
let policyVal = 'balanced';

export function showPregameScreen(onConfirm) {
  // Default pool order
  const pool = [...allMembers];

  // Default: first 6 from coreSeed
  const defaultNames = coreSeed.slice(0, 6).map(m => m.name);
  selected = pool.filter(m => defaultNames.includes(m.name));
  fundsVal = 780;
  policyVal = 'balanced';

  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'pregame-overlay';
  overlay.id = 'pregameOverlay';
  overlay.innerHTML = `
    <div class="pregame-inner">
      <header class="pregame-header">
        <h1>Galgame同好会模拟器</h1>
        <p>新学年开始前，选择你的初始团队（49选6）</p>
      </header>
      <div class="pregame-body">
        <div class="pregame-left">
          <h3>已选阵容 <span id="rosterCount">${selected.length}/6</span></h3>
          <div class="roster-grid" id="rosterGrid"></div>
          <div class="team-summary" id="teamSummary"></div>
        </div>
        <div class="pregame-right">
          <h3>可选角色 <span class="pool-hint">按稀有度排列，点击选择</span></h3>
          <div class="pool-grid" id="poolGrid"></div>
        </div>
      </div>
      <div class="pregame-footer">
        <div class="pregame-settings">
          <label>初始经费 <b id="fundsLabel">780</b></label>
          <input type="range" id="fundsSlider" min="500" max="1500" step="50" value="780" />
          <span class="pregame-settings__label" id="pregamePolicyLabel">初始策略</span>
          <div class="policy-options policy-options--pregame" id="pregamePolicyOptions" role="radiogroup" aria-labelledby="pregamePolicyLabel">
            <button class="active" type="button" data-pregame-policy="balanced" role="radio" aria-checked="true">平衡经营</button>
            <button type="button" data-pregame-policy="aggressive" role="radio" aria-checked="false">冲刺推进</button>
            <button type="button" data-pregame-policy="safe" role="radio" aria-checked="false">稳健运营</button>
          </div>
        </div>
        <div class="pregame-actions">
          <button class="btn" id="confirmBtn">确认出征</button>
          <button class="btn ghost" id="randomBtn">随机阵容</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Render
  renderPool(pool);
  renderRoster();
  renderSummary();

  // Events
  $('#fundsSlider').addEventListener('input', (e) => {
    fundsVal = Number(e.target.value);
    $('#fundsLabel').textContent = fundsVal;
  });
  const policyOptions = $('#pregamePolicyOptions');
  policyOptions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pregame-policy]');
    if (!button) return;
    policyVal = button.dataset.pregamePolicy;
    policyOptions.querySelectorAll('[data-pregame-policy]').forEach((option) => {
      const active = option === button;
      option.classList.toggle('active', active);
      option.setAttribute('aria-checked', String(active));
    });
  });

  $('#confirmBtn').addEventListener('click', () => {
    if (selected.length !== MAX_SELECT) return;
    overlay.remove();
    onConfirm({ selectedMembers: [...selected], funds: fundsVal, policy: policyVal });
  });

  $('#randomBtn').addEventListener('click', () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    selected = shuffled.slice(0, MAX_SELECT);
    renderPool(pool);
    renderRoster();
    renderSummary();
  });

  // Close on Escape
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  });
}

function renderPool(pool) {
  const grid = $('#poolGrid');
  if (!grid) return;

  grid.innerHTML = pool.map(m => {
    const isSel = selected.some(s => s.name === m.name);
    const sk = skills[m.skill];
    const bar = (v, label, color) => `<div class="pool-stat"><span>${label}</span><div class="mini-bar"><div style="width:${v}%;background:${color}"></div></div></div>`;
    const passiveText = m.passive ? m.passive.map(p => p.desc || '').filter(Boolean).join('；') : '';
    const weaknessText = m.weakness ? m.weakness.desc : '';

    return `<div class="pool-card${isSel ? ' selected' : ''}" data-name="${m.name}">
      <div class="pool-card-top">
        <span class="pool-grade">${m.grade}</span>
      </div>
      <div class="pool-name">${m.name}</div>
      <div class="pool-role">${m.role}</div>
      <div class="pool-tags">${(m.tags || []).map(t => `<span>${t}</span>`).join('')}</div>
      ${bar(m.heat, '热情', 'var(--gold)')}${bar(m.fatigue, '疲劳', 'var(--rose)')}${bar(m.trust, '信任', 'var(--cyan)')}${bar(m.growth, '成长', 'var(--green)')}
      <div class="pool-skill">技能：<b>${sk ? sk.name : '—'}</b></div>
      ${passiveText ? `<div class="pool-passive">被动：${passiveText}</div>` : ''}
      ${weaknessText ? `<div class="pool-weakness">弱点：${weaknessText}</div>` : ''}
    </div>`;
  }).join('');

  // Click handler
  grid.querySelectorAll('.pool-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const member = pool.find(m => m.name === name);
      if (!member) return;
      const idx = selected.findIndex(s => s.name === name);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else if (selected.length < MAX_SELECT) {
        selected.push(member);
      }
      renderPool(pool);
      renderRoster();
      renderSummary();
    });
  });
}

function renderRoster() {
  const grid = $('#rosterGrid');
  const count = $('#rosterCount');
  if (!grid) return;
  if (count) count.textContent = `${selected.length}/${MAX_SELECT}`;

  const slots = [];
  for (let i = 0; i < MAX_SELECT; i++) {
    const m = selected[i];
    if (m) {
      const sk = skills[m.skill];
      slots.push(`<div class="roster-slot filled" data-idx="${i}">
        <b>${m.name}</b>
        <small>${m.role}</small>
        <small>技能：${sk ? sk.name : '—'}</small>
        <span class="roster-remove">×</span>
      </div>`);
    } else {
      slots.push(`<div class="roster-slot empty"><span>+ 待选</span></div>`);
    }
  }
  grid.innerHTML = slots.join('');

  // Remove handler
  grid.querySelectorAll('.roster-slot.filled').forEach(slot => {
    slot.addEventListener('click', () => {
      const idx = Number(slot.dataset.idx);
      if (!isNaN(idx) && selected[idx]) {
        selected.splice(idx, 1);
        renderPool([...allMembers]);
        renderRoster();
        renderSummary();
      }
    });
  });
}

function renderSummary() {
  const el = $('#teamSummary');
  if (!el) return;

  const allTags = new Set();
  let totalHeat = 0, totalFatigue = 0;
  selected.forEach(m => {
    (m.tags || []).forEach(t => allTags.add(t));
    totalHeat += m.heat;
    totalFatigue += m.fatigue;
  });

  const avgHeat = selected.length ? Math.round(totalHeat / selected.length) : 0;
  const avgFatigue = selected.length ? Math.round(totalFatigue / selected.length) : 0;

  el.innerHTML = `
    <div class="summary-row"><span>标签覆盖</span><b>${[...allTags].join(' · ')}</b></div>
    <div class="summary-row"><span>平均属性</span><b>热情 ${avgHeat} / 疲劳 ${avgFatigue}</b></div>
  `;
}
