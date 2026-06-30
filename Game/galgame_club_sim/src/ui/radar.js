import { $ } from './dom.js';
import { statNames } from '../data/stats.js';

export function drawRadar(s) {
  const c = $('#radar');
  if (!c) return;
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 + 4;
  const R = 82;
  const es = Object.entries(statNames);
  const step = (Math.PI * 2) / es.length;

  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let ring = 1; ring <= 4; ring++) {
    const r = (R * ring) / 4;
    ctx.beginPath();
    es.forEach(([, l], i) => {
      const a = -Math.PI / 2 + i * step;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(160,120,135,.18)';
    ctx.stroke();
  }

  es.forEach(([, l], i) => {
    const a = -Math.PI / 2 + i * step;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.strokeStyle = 'rgba(160,120,135,.12)';
    ctx.stroke();
    ctx.fillStyle = '#7A6670';
    ctx.fillText(l.replace('度', '').replace('力', ''), cx + Math.cos(a) * (R + 32), cy + Math.sin(a) * (R + 22));
  });

  ctx.beginPath();
  es.forEach(([k], i) => {
    const a = -Math.PI / 2 + i * step;
    const r = (R * s.stats[k]) / 100;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,143,168,.22)';
  ctx.strokeStyle = 'rgba(91,184,195,.95)';
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
}
