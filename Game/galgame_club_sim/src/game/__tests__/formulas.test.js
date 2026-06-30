// src/game/__tests__/formulas.test.js
import { calcFit, calcCapacity, calcFatigueDelta, calcSupport } from '../formulas.js';

function test(desc, fn) {
  try { fn(); console.log(`  ✓ ${desc}`); } catch (e) { console.error(`  ✗ ${desc}: ${e.message}`); process.exitCode = 1; }
}

// calcFit
test('calcFit with match=2, support=0.45, cap=50', () => {
  const r = calcFit(2, 0.45, 50);
  if (r !== 73) throw new Error(`expected 73, got ${r}`);
});
test('calcFit clamped at 0', () => {
  const r = calcFit(-10, 0, 10);
  if (r !== 0) throw new Error(`expected 0, got ${r}`);
});
test('calcFit clamped at 100', () => {
  const r = calcFit(10, 1, 100);
  if (r !== 100) throw new Error(`expected 100, got ${r}`);
});

// calcCapacity
test('calcCapacity baseline', () => {
  const r = calcCapacity({ heat: 50, fatigue: 30, growth: 30, trust: 30 });
  if (r < 40 || r > 60) throw new Error(`unexpected: ${r}`);
});

// calcFatigueDelta
test('calcFatigueDelta aggressive', () => {
  if (calcFatigueDelta(10, 'aggressive') !== 12) throw new Error('expected 12');
});
test('calcFatigueDelta safe', () => {
  if (calcFatigueDelta(10, 'safe') !== 9) throw new Error('expected 9');
});
test('calcFatigueDelta balanced', () => {
  if (calcFatigueDelta(10, 'balanced') !== 10) throw new Error('expected 10');
});

// calcSupport
test('calcSupport no detail keys returns 0.45', () => {
  const r = calcSupport({ id: 'unknown' }, {}, {});
  if (r !== 0.45) throw new Error(`expected 0.45, got ${r}`);
});
test('calcSupport full detail returns ~1.0', () => {
  const detailMap = { test_action: ['a', 'b'] };
  const detail = { a: 100, b: 100 };
  const r = calcSupport({ id: 'test_action' }, detail, detailMap);
  if (r !== 1.0) throw new Error(`expected 1.0, got ${r}`);
});

console.log('formulas.test.js done');
