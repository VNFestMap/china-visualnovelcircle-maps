import { clamp } from './math.js';

const THRESHOLDS = {
  pressure: { ok: 60, warn: 78, bad: 100, dir: 'higher-is-bad' },
  funds: { ok: 80, warn: 40, bad: 0, dir: 'higher-is-good' },
  fame: { ok: 40, warn: 20, bad: 0, dir: 'higher-is-good' },
  heat: { ok: 60, warn: 35, bad: 0, dir: 'higher-is-good' },
  fatigue: { ok: 40, warn: 60, bad: 78, dir: 'higher-is-bad' },
  burnRisk: { ok: 35, warn: 60, bad: 100, dir: 'higher-is-bad' },
  default: { ok: 60, warn: 40, bad: 0, dir: 'higher-is-good' },
};

export function formatState(value, type = 'default') {
  const t = THRESHOLDS[type] || THRESHOLDS.default;
  const bad = t.dir === 'higher-is-bad' ? value >= t.warn : value <= t.warn;
  const hot = t.dir === 'higher-is-bad' ? value >= t.bad : value <= t.bad;
  let level, icon, text;
  if (hot) {
    level = 'bad'; icon = '⚠'; text = t.dir === 'higher-is-bad' ? '高危' : '极低';
  } else if (bad) {
    level = 'warn'; icon = '●'; text = t.dir === 'higher-is-bad' ? '偏高' : '偏低';
  } else {
    level = 'good'; icon = '✓'; text = '正常';
  }
  return { level, icon, text, label: `${value}` };
}

export function trendArrow(current, prev) {
  if (prev == null) return { symbol: '·', cls: 'trend--flat' };
  const diff = current - prev;
  if (diff >= 2) return { symbol: '▲', cls: 'trend--up' };
  if (diff <= -2) return { symbol: '▼', cls: 'trend--down' };
  return { symbol: '·', cls: 'trend--flat' };
}

export function pct(value) { return clamp(value); }
