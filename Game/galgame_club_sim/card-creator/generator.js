export function calcMemberState(m) {
  if (m.fatigue >= 78) return { label: '燃尽边缘', cls: 'burn', color: '#d96b78' };
  if (m.fatigue >= 58) return { label: '疲劳', cls: 'tired', color: '#d89b45' };
  return { label: m.heat >= 70 ? '热情中' : '稳定', cls: 'ok', color: m.heat >= 70 ? '#e89ab3' : '#78bf8a' };
}

export function calcCapacity(m) {
  return Math.round(Math.min(100, Math.max(0, 35 + m.heat * 0.35 - m.fatigue * 0.4 + m.growth * 0.25 + m.trust * 0.1)));
}

export function generateCardHTML(m) {
  const state = calcMemberState(m);
  const cap = calcCapacity(m);
  const firstChar = m.name.charAt(0);

  return `<div style="
    width:320px; border-radius:20px; overflow:hidden;
    background:linear-gradient(180deg,#fffdf8,#fff0f6);
    box-shadow:0 8px 32px rgba(157,98,114,.18);
    font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
    position:relative;
  ">
    <div style="padding:18px 20px 20px">
      <!-- 头像 + 基本信息 -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div style="
          width:52px;height:52px;border-radius:50%;
          background:linear-gradient(135deg,#d9b87a,rgba(255,255,255,.4));
          display:flex;align-items:center;justify-content:center;
          font-size:24px;font-weight:900;color:#fff;
          text-shadow:0 2px 4px rgba(0,0,0,.12);
          box-shadow:0 4px 12px rgba(217,184,122,.15);
        ">${firstChar}</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:900;color:#5a3f48;line-height:1.3">${m.name}</div>
          <div style="font-size:12px;color:#9a7a84">${m.grade} · ${m.role}</div>
        </div>
      </div>

      <!-- 特质 -->
      <div style="font-size:13px;color:#7a5a64;line-height:1.6;margin-bottom:14px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.58);border:1px solid rgba(246,167,188,.16)">
        <span style="font-weight:900;color:#5a3f48">特质：</span>${m.trait}
      </div>

      <!-- 状态徽章 -->
      <div style="text-align:center;margin-bottom:14px">
        <span style="
          padding:4px 14px;border-radius:999px;
          background:${state.color}18;color:${state.color};
          font-size:13px;font-weight:900;
          border:1px solid ${state.color}33;
        ">${state.label}</span>
      </div>

      <!-- 五维条 -->
      ${renderBar('热情', m.heat, 'linear-gradient(90deg,#d9b87a,#e89ab3)')}
      ${renderBar('疲劳', m.fatigue, 'linear-gradient(90deg,#d89b45,#d96b78)')}
      ${renderBar('成长', m.growth, 'linear-gradient(90deg,#8fc1d9,#a9cfe3)')}
      ${renderBar('信任', m.trust, 'linear-gradient(90deg,#7fc1d9,#d9b87a)')}
      ${renderBar('可用', cap, 'linear-gradient(90deg,#78bf8a,#7fc1d9)')}

      <!-- 分隔线 -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(246,167,188,.3),transparent);margin:14px 0"></div>

      <!-- 技能卡 -->
      <div style="padding:12px;border-radius:14px;background:rgba(255,255,255,.58);border:1px dashed rgba(230,185,94,.28)">
        <div style="font-size:13px;font-weight:900;color:#5a3f48;margin-bottom:4px">
          ${m.skillName || '无技能'}
          <span style="float:right;font-size:11px;color:${m.skillCd ? '#d89b45' : '#78bf8a'}">${m.skillCd ? `冷却 ${m.skillCd} 周` : '可发动'}</span>
        </div>
        <div style="font-size:12px;color:#9a7a84;line-height:1.6">${m.skillDesc || '暂无专属技能。'}</div>
      </div>

      <!-- 标签 -->
      ${m.tags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${m.tags.map(t => `<span style="padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.66);border:1px solid rgba(246,167,188,.16);color:#9a7a84;font-size:11px;font-weight:900">${t}</span>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function renderBar(label, value, gradient) {
  const pct = Math.min(100, Math.max(0, value));
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="width:32px;font-size:12px;color:#9a7a84;font-weight:900">${label}</span>
    <div style="flex:1;height:8px;border-radius:999px;background:rgba(196,142,155,.14);overflow:hidden">
      <div style="height:100%;width:${pct}%;border-radius:inherit;background:${gradient};transition:.3s"></div>
    </div>
    <b style="width:28px;text-align:right;font-size:13px;color:#6a4a55">${pct}</b>
  </div>`;
}

export function generateGalleryHTML(members, opts = {}) {
  const title = opts.title || '角色一览';
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>
<style>
  body { margin:0; padding:30px 20px; background:linear-gradient(135deg,#fff5f0,#f0fafa,#fff5f8); min-height:100vh; font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif; }
  .gallery-title { text-align:center; margin-bottom:30px; }
  .gallery-title h1 { margin:0; font-size:28px; color:#49333b; letter-spacing:.03em; }
  .gallery-title p { margin:8px 0 0; color:#9a7a84; font-size:14px; }
  .gallery-grid { display:flex; flex-wrap:wrap; gap:24px; justify-content:center; }
</style></head>
<body>
  <div class="gallery-title"><h1>${title}</h1><p>共 ${members.length} 名角色</p></div>
  <div class="gallery-grid">${members.map(m => generateCardHTML(m)).join('\n    ')}</div>
</body></html>`;
}