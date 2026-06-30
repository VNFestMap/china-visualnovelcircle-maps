// src/content/conditions.js
// Declarative conditions DSL engine with fn: fallback for complex expressions.

const operators = {
  gte: (a, b) => a >= b,
  gt: (a, b) => a > b,
  lte: (a, b) => a <= b,
  lt: (a, b) => a < b,
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  includes: (a, b) => Array.isArray(a) && a.includes(b),
  notIncludes: (a, b) => Array.isArray(a) && !a.includes(b),
  truthy: (a) => !!a,
};

/**
 * Resolve a dotted path with prefix-aware routing.
 * - 'legacy.X' → X in legacy object only
 * - 'member.X' → X in member object only
 * - 'X' or 'a.b.c' → member → state → legacy priority order
 * Throws if path not found in any source.
 */
export function getPath(state, legacy, member, dotted) {
  // Prefix routing: strip prefix, resolve in specified source only (don't throw on miss)
  if (dotted.startsWith('legacy.')) {
    return _lookup(legacy, dotted.slice(7), false);
  }
  if (dotted.startsWith('member.')) {
    return _lookup(member, dotted.slice(7), false);
  }

  // Plain path: priority member → state → legacy
  for (const root of [member, state, legacy]) {
    if (root == null) continue;
    const val = _lookup(root, dotted, false);
    if (val !== undefined) return val;
  }
  throw new Error(`conditions.getPath: '${dotted}' not found in state/legacy/member`);
}

function _lookup(root, dotted, throwOnMiss = true) {
  if (root == null) return undefined;
  const parts = dotted.split('.');
  let val = root;
  for (const p of parts) {
    if (val == null || !(p in val)) return undefined;
    val = val[p];
  }
  if (throwOnMiss && val === undefined) {
    throw new Error(`conditions.getPath: '${dotted}' not found`);
  }
  return val;
}

/**
 * Evaluate a require object against state/legacy/member.
 * @param {object} state  — full game state
 * @param {object|null} legacy — legacy archive object
 * @param {object|null} member — specific member (for arc conditions)
 * @param {object} require — condition declarations
 * @returns {boolean}
 */
export function matches(state, legacy, member, require) {
  for (const [path, rules] of Object.entries(require)) {
    if (path.startsWith('fn:')) {
      if (!rules.fn(state, legacy, member)) return false;
      continue;
    }
    const value = getPath(state, legacy, member, path);
    for (const [op, expected] of Object.entries(rules)) {
      const compare = operators[op];
      if (!compare) throw new Error(`conditions: unknown operator '${op}'`);
      if (!compare(value, expected)) return false;
    }
  }
  return true;
}
