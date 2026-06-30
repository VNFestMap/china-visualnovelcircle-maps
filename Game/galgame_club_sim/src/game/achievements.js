import { achievementDefs } from '../data/achievements.js';
import { matches } from '../content/conditions.js';
import { getProfile, saveProfile } from '../state/persistence.js';

export function checkAndUnlock(s) {
  const unlocked = s.achievements?.unlocked || [];
  const set = new Set(unlocked);
  const recently = [];
  for (const def of achievementDefs) {
    if (set.has(def.id)) continue;
    let ok = false;
    try { ok = matches(s, s.legacy || {}, null, def.require); } catch { ok = false; }
    if (ok) {
      set.add(def.id);
      recently.push(def.id);
    }
  }
  s.achievements = {
    unlocked: Array.from(set),
    recentlyUnlocked: recently,
  };
  if (recently.length) {
    const profile = getProfile();
    const profileSet = new Set([...(profile.unlocked || []), ...set]);
    saveProfile({
      unlocked: Array.from(profileSet),
      points: achievementDefs
        .filter((achievement) => profileSet.has(achievement.id))
        .reduce((sum, achievement) => sum + achievement.points, 0),
    });
  }
  return recently;
}
