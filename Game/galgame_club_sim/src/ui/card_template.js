import { skills } from '../data/skills.js';
import { memberState, capacity } from '../game/lifecycle.js';

export function memberCard(m, idx) {
  const [lab, cls] = memberState(m);
  const cap = capacity(m);
  const sk = skills[m.skill] || { name: '无技能', desc: '暂无专属技能。' };
  return `<button class="member" data-member="${m.name}" role="article">
    <div class="member-head">
      <div>
        <div class="member-name">${m.name} · ${m.grade}</div>
        <div class="member-role">${m.role}｜${m.trait}</div>
      </div>
      <span class="state ${cls}">${lab}</span>
    </div>
    <div class="mini-row"><span>热情</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.heat}"><div style="width:${m.heat}%;background:linear-gradient(90deg,var(--gold),var(--rose))"></div></div><b>${m.heat}</b></div>
    <div class="mini-row"><span>疲劳</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.fatigue}"><div style="width:${m.fatigue}%;background:linear-gradient(90deg,var(--warn),var(--danger))"></div></div><b>${m.fatigue}</b></div>
    <div class="mini-row"><span>成长</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.growth}"><div style="width:${m.growth}%"></div></div><b>${m.growth}</b></div>
    <div class="mini-row"><span>信任</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.trust}"><div style="width:${m.trust}%;background:linear-gradient(90deg,var(--cyan),var(--gold))"></div></div><b>${m.trust}</b></div>
    <div class="mini-row"><span>可用</span><div class="mini" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cap}"><div style="width:${cap}%;background:linear-gradient(90deg,var(--green),var(--cyan))"></div></div><b>${cap}</b></div>
    <div class="skill"><h5>${sk.name}<span class="${m.skillCd ? 'cd' : 'ready'}">${m.skillCd ? `冷却 ${m.skillCd} 周` : '可发动'}</span></h5><p>${sk.desc}</p></div>
    <div class="member-tags">${m.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
  </button>`;
}

export function memberCardCompact(m, idx) {
  const [lab, cls] = memberState(m);
  const sk = skills[m.skill];
  return `<div class="member" data-member="${m.name}" style="cursor:default;width:100%">
    <div class="member-head">
      <div>
        <div class="member-name">${m.name}</div>
        <div class="member-role">${m.role}</div>
      </div>
      <span class="state ${cls}">${lab}</span>
    </div>
    <div class="mini-row"><span>热情</span><div class="mini"><div style="width:${m.heat}%"></div></div><b>${m.heat}</b></div>
    <div class="mini-row"><span>疲劳</span><div class="mini"><div style="width:${m.fatigue}%;background:var(--warn)"></div></div><b>${m.fatigue}</b></div>
    <div class="mini-row"><span>成长</span><div class="mini"><div style="width:${m.growth}%"></div></div><b>${m.growth}</b></div>
    <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${m.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
    ${sk ? `<div class="tiny" style="margin-top:6px;color:var(--sub)">技能：${sk.name}</div>` : ''}
    <div class="tiny" style="margin-top:2px">${m.trait}</div>
  </div>`;
}

export function memberCardSimple(m) {
  const [lab, cls] = memberState(m);
  return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
    <span class="state ${cls}" style="font-size:10px;padding:2px 6px">${lab}</span>
    <b style="color:#5a3f48">${m.name}</b>
    <span class="tiny">${m.role}</span>
    <span style="margin-left:auto;font-size:11px;color:var(--sub)">热${m.heat} 疲${m.fatigue}</span>
  </div>`;
}

export function recruitCard(m) {
  const sk = skills[m.skill] || { name: '无技能', desc: '' };
  return `<div class="member" style="cursor:default;border-color:rgba(143,216,223,.34);width:100%">
    <div class="member-head">
      <div>
        <div class="member-name">${m.name} · ${m.grade}</div>
        <div class="member-role">${m.role}</div>
    </div>
    </div>
    <div style="color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:8px">${m.trait}</div>
    <div class="mini-row"><span>热情</span><div class="mini"><div style="width:${m.heat}%"></div></div><b>${m.heat}</b></div>
    <div class="mini-row"><span>成长</span><div class="mini"><div style="width:${m.growth}%"></div></div><b>${m.growth}</b></div>
    <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">${m.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
    <div class="tiny" style="margin-top:6px;color:var(--sub)">技能：${sk.name}</div>
  </div>`;
}