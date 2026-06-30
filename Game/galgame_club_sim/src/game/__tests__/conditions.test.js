// src/game/__tests__/conditions.test.js
import { matches, getPath } from '../../content/conditions.js';

function test(desc, fn) {
  try { fn(); console.log(`  ✓ ${desc}`); } catch (e) { console.error(`  ✗ ${desc}: ${e.message}`); process.exitCode = 1; }
}

// getPath
test('getPath from state', () => {
  const val = getPath({ a: { b: 1 } }, null, null, 'a.b');
  if (val !== 1) throw new Error(`expected 1, got ${val}`);
});
test('getPath from member (priority)', () => {
  const val = getPath({ a: 10 }, null, { a: 5 }, 'a');
  if (val !== 5) throw new Error(`expected 5 (member), got ${val}`);
});
test('getPath from legacy (plain path)', () => {
  const val = getPath({}, { archive: 10 }, null, 'archive');
  if (val !== 10) throw new Error(`expected 10, got ${val}`);
});
test('getPath legacy. prefix', () => {
  const val = getPath({}, { archive: 10, network: 5 }, null, 'legacy.archive');
  if (val !== 10) throw new Error(`expected 10, got ${val}`);
});
test('getPath legacy. prefix missing key returns undefined', () => {
  const val = getPath({}, { archive: 10 }, null, 'legacy.network');
  if (val !== undefined) throw new Error(`expected undefined, got ${val}`);
});
test('getPath legacy. prefix with null legacy', () => {
  const val = getPath({}, null, null, 'legacy.archive');
  if (val !== undefined) throw new Error(`expected undefined, got ${val}`);
});
test('getPath member. prefix', () => {
  const val = getPath({}, null, { trust: 75, heat: 60 }, 'member.trust');
  if (val !== 75) throw new Error(`expected 75, got ${val}`);
});
test('getPath throws on undefined path', () => {
  let threw = false;
  try { getPath({ a: 1 }, null, null, 'b.c'); } catch { threw = true; }
  if (!threw) throw new Error('expected throw');
});

// matches - operators
test('matches gte: equal', () => {
  if (!matches({ a: 10 }, null, null, { a: { gte: 10 } })) throw new Error('should match');
});
test('matches gte: greater', () => {
  if (!matches({ a: 11 }, null, null, { a: { gte: 10 } })) throw new Error('should match');
});
test('matches gte: less (false)', () => {
  if (matches({ a: 9 }, null, null, { a: { gte: 10 } })) throw new Error('should not match');
});
test('matches lte, gt, lt, eq, neq', () => {
  if (!matches({ a: 10 }, null, null, { a: { lte: 10 } })) throw new Error('lte');
  if (!matches({ a: 11 }, null, null, { a: { gt: 10 } })) throw new Error('gt');
  if (!matches({ a: 9 }, null, null, { a: { lt: 10 } })) throw new Error('lt');
  if (!matches({ a: 10 }, null, null, { a: { eq: 10 } })) throw new Error('eq');
  if (!matches({ a: 10 }, null, null, { a: { neq: 11 } })) throw new Error('neq');
});
test('matches includes', () => {
  if (!matches({ arr: [1, 2, 3] }, null, null, { arr: { includes: 2 } })) throw new Error('includes');
});
test('matches notIncludes', () => {
  if (!matches({ arr: [1, 2, 3] }, null, null, { arr: { notIncludes: 4 } })) throw new Error('notIncludes');
});
test('matches truthy', () => {
  if (!matches({ x: true }, null, null, { x: { truthy: true } })) throw new Error('truthy');
  if (matches({ x: false }, null, null, { x: { truthy: true } })) throw new Error('truthy false');
  if (matches({ x: 0 }, null, null, { x: { truthy: true } })) throw new Error('truthy 0');
  if (matches({ x: null }, null, null, { x: { truthy: true } })) throw new Error('truthy null');
});
test('matches empty require = true', () => {
  if (!matches({}, null, null, {})) throw new Error('empty should match');
});
test('matches fn: fallback', () => {
  const r = matches({ members: [{ n: 'a' }, { n: 'b' }] }, null, null, {
    'fn:count': { fn: (s) => s.members.length >= 2 },
  });
  if (!r) throw new Error('fn: should match');
});
test('matches with member param', () => {
  const r = matches({}, null, { trust: 60, heat: 60 }, {
    'trust': { gte: 60 },
    'heat': { gte: 60 },
  });
  if (!r) throw new Error('member conditions should match');
});

console.log('conditions.test.js done');
