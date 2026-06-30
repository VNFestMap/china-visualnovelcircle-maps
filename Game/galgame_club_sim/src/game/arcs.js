import { characterArcs } from '../data/characterArcs.js';
import { rand } from '../utils/math.js';
import { matches } from '../content/conditions.js';

export function checkArcs(s) {
  if (s.event || s.pendingArc || s.pendingRecruit) return null;
  for (const m of s.members) {
    const arcList = characterArcs[m.name];
    if (!arcList) continue;
    const seen = s.arcSeenFor[m.name] || [];
    for (const arc of arcList) {
      if (seen.includes(arc.id)) continue;
      let ok = false;
      try { ok = matches(s, null, m, arc.require); } catch { ok = false; }
      if (ok) {
        s.arcSeenFor[m.name] = [...seen, arc.id];
        return { member: m.name, arc };
      }
    }
  }
  return null;
}

export function resolveArc(s, arc, choiceIndex) {
  const choice = arc.arc.choices[choiceIndex];
  if (!choice) return;
  return { arc, choice, fnRef: choice.fnRef };
}
