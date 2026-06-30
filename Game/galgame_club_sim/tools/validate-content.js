// tools/validate-content.js
// Content integrity validator — run with: node tools/validate-content.js
// Checks cross-file references for consistency.
import { actions } from '../src/data/actions.js';
import { skills } from '../src/data/skills.js';
import { coreSeed, recruitPool } from '../src/data/members.js';
import { eventPool } from '../src/data/events.js';
import { characterArcs } from '../src/data/characterArcs.js';
import { achievementDefs } from '../src/data/achievements.js';
import { actionDetailMap } from '../src/data/stats.js';
import { eventHandlers, arcHandlers } from '../src/game/eventHandlers.js';

let errors = 0;
function check(desc, condition) {
  if (!condition) { console.error(`  ✗ ${desc}`); errors++; }
  else { console.log(`  ✓ ${desc}`); }
}

// 1. Action IDs unique
const actionIds = actions.map(a => a.id);
check('action IDs are unique', new Set(actionIds).size === actionIds.length);

// 2. Seasons valid
const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
actions.forEach(a => {
  a.seasons.forEach(s => {
    check(`season '${s}' in action '${a.id}' is valid`, validSeasons.includes(s));
  });
});

// 3. Skill references in members
const allMembers = [...coreSeed, ...recruitPool];
allMembers.forEach(m => {
  check(`member '${m.name}' skill '${m.skill}' exists`, !!skills[m.skill]);
});

// 4. Skill.ids reference valid action IDs
Object.entries(skills).forEach(([skId, sk]) => {
  sk.ids.forEach(aId => {
    check(`skill '${skId}'.ids includes '${aId}' which is a valid action`, actionIds.includes(aId));
  });
});

// 5. actionDetailMap keys -> valid actions
Object.keys(actionDetailMap).forEach(aId => {
  check(`actionDetailMap key '${aId}' has matching action`, actionIds.includes(aId));
});

// 6. fnRefs in events -> handlers
const eventFnRefs = new Set();
eventPool.forEach(ev => ev.choices.forEach(c => eventFnRefs.add(c.fnRef)));
eventFnRefs.forEach(fn => {
  check(`event fnRef '${fn}' has handler`, typeof eventHandlers[fn] === 'function');
});

// 7. fnRefs in arcs -> handlers
const arcFnRefs = new Set();
Object.values(characterArcs).forEach(arcList =>
  arcList.forEach(arc => arc.choices.forEach(c => arcFnRefs.add(c.fnRef)))
);
arcFnRefs.forEach(fn => {
  check(`arc fnRef '${fn}' has handler`, typeof arcHandlers[fn] === 'function');
});

// 8. Action tags are in known tags
const allTags = new Set();
allMembers.forEach(m => m.tags.forEach(t => allTags.add(t)));
['文案', '宣传', '绘图', '主持', '组织', '排版', '校对', '日语',
 '脚本', '音乐', '前端', '资料整理', '摊位', '休整'].forEach(t => allTags.add(t));

let invalidTags = 0;
actions.forEach(a => (a.tags || []).forEach(t => {
  if (!allTags.has(t)) { invalidTags++; console.error(`  ✗ action '${a.id}' has unknown tag '${t}'`); }
}));
check(`actions have no unknown tags`, invalidTags === 0);

// Summary
console.log(`\n${errors === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${errors} CHECK(S) FAILED`}`);
process.exit(errors > 0 ? 1 : 0);
