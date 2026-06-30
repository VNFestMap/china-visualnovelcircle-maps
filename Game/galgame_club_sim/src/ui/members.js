import { $ } from './dom.js';
import { skills } from '../data/skills.js';
import { memberState, capacity } from '../game/lifecycle.js';
import { getState, update } from '../state/store.js';
import { saveState } from '../state/persistence.js';
import { render } from './render.js';
import { announce } from './a11y.js';
import { actions } from '../data/actions.js';
import { actionDetailMap } from '../data/stats.js';
import { calcFitBreakdown, calcSupport } from '../game/formulas.js';
import { previewSkill } from '../game/week.js';
import { icon } from './icons.js';

export function renderCommon(s) {
  const activeRate = Math.round(s.common.active / Math.max(1, s.common.total) * 100);
  const stageTarget = s.common.total < 20 ? 20 : s.common.total < 50 ? 50 : s.common.total < 100 ? 100 : 300;
  const stageProgress = Math.min(100, Math.round(s.common.total / stageTarget * 100));
  $('#commonPanel').innerHTML = `<div class="ordinary-box">
    <div class="ordinary-overview">
      <div class="ordinary-head">
        <div><span class="eyebrow">COMMUNITY SCALE</span><h3>普通成员池</h3><div class="tiny">${s.common.stage || '萌芽期'} · 活跃率 ${activeRate}%</div></div>
        <div class="ordinary-total"><strong>${s.common.total}</strong><span>当前总人数</span></div>
      </div>
      <div class="ordinary-stage">
        <div><span>下一阶段目标</span><b>${stageTarget} 人</b></div>
        <div class="community-stage" role="progressbar" aria-label="社群规模进度" aria-valuemin="0" aria-valuemax="${stageTarget}" aria-valuenow="${s.common.total}"><span style="width:${stageProgress}%"></span></div>
      </div>
    </div>
    <div class="ordinary-grid">
      <div class="ordinary-item"><span>潜在关注</span><b>${s.common.prospects || 0}</b></div>
      <div class="ordinary-item"><span>新加入</span><b>${s.common.newcomer}</b></div>
      <div class="ordinary-item"><span>活跃成员</span><b>${s.common.active}</b></div>
      <div class="ordinary-item"><span>沉默成员</span><b>${s.common.silent || 0}</b></div>
      <div class="ordinary-item"><span>群体心情</span><b>${s.common.mood}</b></div>
      <div class="ordinary-item"><span>群体疲劳</span><b>${s.common.fatigue}</b></div>
    </div>
  </div>`;
}

export function renderLegacy(s) {
  const l = s.legacy || s.pendingLegacy;
  if (!l || !l.points) {
    $('#legacyPanel').innerHTML = `<div class="legacy-empty">
      <div class="legacy-empty__icon">${icon('archive')}</div>
      <div><b>尚未建立继承档案</b><p>完成一个学年后，组织经验、人脉与创作积累会保留到下一周目。</p></div>
    </div>`;
    return;
  }
  $('#legacyPanel').innerHTML = `<div class="legacy-box"><h3 style="margin:0 0 5px">继承档案</h3><div class="tiny" style="margin-bottom:10px">上一局留下的模板、人脉和经验，会改变新同好会的起点。</div><div class="legacy-grid"><div class="legacy-mini"><span>档案</span><b>${l.archive}</b></div><div class="legacy-mini"><span>外联</span><b>${l.network}</b></div><div class="legacy-mini"><span>管理</span><b>${l.management}</b></div><div class="legacy-mini"><span>创作</span><b>${l.creative}</b></div></div></div>`;
}

export function renderMembers(s) {
  // Quick-select member chips
  const quickSel = $('#memberQuickSelect');
  if (quickSel) {
    const selectedAction = actions.find((action) => action.id === s.selectedAction) || actions[0];
    const support = calcSupport(selectedAction, s.detail, actionDetailMap);
    quickSel.innerHTML = s.members.map((m) => {
      const sk = skills[m.skill] || { name: '' };
      const actionSkill = previewSkill(m, selectedAction);
      const fit = calcFitBreakdown(selectedAction, m, support, !!actionSkill?.ready);
      return `<button class="member-chip ${s.selectedMember === m.name ? 'sel' : ''}" data-member="${m.name}" aria-pressed="${s.selectedMember === m.name}">
        <span class="chip-row"><span class="chip-name">${m.name}</span><span class="chip-fit">${fit.score}</span></span>
        <span class="chip-role">${sk.name || m.role}</span>
      </button>`;
    }).join('');
    quickSel.querySelectorAll('.member-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        update((cur) => { cur.selectedMember = chip.dataset.member; return cur; });
        render();
        saveState(getState());
        announce(`已选择核心成员 ${chip.dataset.member}`);
      });
    });
  }

  if (!s.members.some((m) => m.name === s.selectedMember)) {
    s.selectedMember = s.members[0]?.name;
  }
  document.querySelectorAll('#policySelect [data-policy]').forEach((button) => {
    const active = button.dataset.policy === s.policy;
    button.classList.toggle('active', active);
    button.setAttribute('aria-checked', String(active));
  });

  const selected = s.members.find((m) => m.name === s.selectedMember) || s.members[0];
  $('#coreMemberCount').textContent = `${s.members.length} / 10`;
  if (selected) {
    const [lab, cls] = memberState(selected);
    const cap = capacity(selected);
    const sk = skills[selected.skill] || { name: '无技能', desc: '暂无专属技能。' };
    const topAptitudes = Object.entries(selected.aptitudes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, value]) => ({ title: actions.find((action) => action.id === id)?.title || id, value }));
    $('#memberDetail').innerHTML = `<div class="member-focus__identity">
      <div><span class="eyebrow">SELECTED CORE MEMBER</span><h3>${selected.name}<small>${selected.grade}</small></h3><p>${selected.role}</p></div>
      <span class="state ${cls}">${lab}</span>
    </div>
    <div class="member-focus__stats">
      <div><span>热情</span><b>${selected.heat}</b></div>
      <div><span>疲劳</span><b>${selected.fatigue}</b></div>
      <div><span>成长</span><b>${selected.growth}</b></div>
      <div><span>可用度</span><b>${cap}</b></div>
    </div>
    <div class="member-focus__ability">
      <div class="member-focus__skill"><span>专属技能</span><h4>${sk.name}<small class="${selected.skillCd ? 'cd' : 'ready'}">${selected.skillCd ? `冷却 ${selected.skillCd} 周` : '可发动'}</small></h4><p>${sk.desc}</p></div>
      <div class="member-focus__aptitudes"><span>优势行动</span>${topAptitudes.map((item) => `<b>${item.title}<em>${item.value}</em></b>`).join('')}</div>
    </div>
    <div class="member-focus__traits">
      <p>${selected.trait}</p>
      ${selected.passive ? selected.passive.map((passive) => `<span class="passive"><b>被动</b>${passive.desc || ''}</span>`).join('') : ''}
      ${selected.weakness ? `<span class="weakness"><b>弱点</b>${selected.weakness.desc || ''}</span>` : ''}
    </div>`;
  }

  $('#memberList').innerHTML = s.members.map((m, idx) => {
    const [lab, cls] = memberState(m);
    const cap = capacity(m);
    const sk = skills[m.skill] || { name: '无技能', desc: '暂无专属技能。' };
    const topAptitudes = Object.entries(m.aptitudes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id, value]) => `${actions.find((action) => action.id === id)?.title || id} ${value}`);
    const aria = `${m.name},${m.role},${m.trait},热情 ${m.heat},疲劳 ${m.fatigue},成长 ${m.growth},可用度 ${cap},状态 ${lab},技能 ${sk.name}${m.skillCd ? ` 冷却 ${m.skillCd} 周` : ' 可发动'}`;
    return `<button class="member ${s.selectedMember === m.name ? 'sel' : ''}" data-member="${m.name}" role="article" aria-labelledby="member-name-${idx}" aria-label="${aria}" aria-pressed="${s.selectedMember === m.name}">
      <div class="member-head">
        <div class="member-card__identity"><div><div class="member-name" id="member-name-${idx}">${m.name}</div><div class="member-role">${m.grade} · ${sk.name}</div></div></div>
        <span class="state ${cls}">${lab}</span>
      </div>
      <div class="mini-row"><span>热情</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.heat}" aria-label="热情"><div style="width:${m.heat}%;background:linear-gradient(90deg,var(--gold),var(--rose))"></div></div><b>${m.heat}</b></div>
      <div class="mini-row"><span>疲劳</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.fatigue}" aria-label="疲劳"><div style="width:${m.fatigue}%;background:linear-gradient(90deg,var(--warn),var(--danger))"></div></div><b>${m.fatigue}</b></div>
      <div class="mini-row"><span>可用</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cap}" aria-label="可用度"><div style="width:${cap}%;background:linear-gradient(90deg,var(--green),var(--cyan))"></div></div><b>${cap}</b></div>
      <div class="member-specialties"><span>擅长</span>${topAptitudes.map((item) => `<b>${item}</b>`).join('')}</div>
    </button>`;
  }).join('');

  $('#memberList').querySelectorAll('.member').forEach((card) => {
    card.addEventListener('click', () => {
      update((cur) => { cur.selectedMember = card.dataset.member; return cur; });
      render();
      saveState(getState());
      announce(`已选择核心成员 ${card.dataset.member}`);
    });
  });
}
