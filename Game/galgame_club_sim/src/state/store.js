let _state = null;
const _subs = new Set();

export function getState() { return _state; }

export function setState(next) {
  _state = next;
  for (const fn of _subs) fn(_state);
}

export function update(mutator) {
  const prevRes = _state ? { ..._state.resources } : null;
  setState(mutator(_state));
  if (prevRes) {
    const deltas = {};
    for (const k in prevRes) {
      if (k.startsWith('__')) continue;
      const diff = (_state.resources[k] || 0) - (prevRes[k] || 0);
      if (diff !== 0) deltas[`res_${k}`] = diff;
    }
    _state.__deltas = deltas;
  }
}

export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}
