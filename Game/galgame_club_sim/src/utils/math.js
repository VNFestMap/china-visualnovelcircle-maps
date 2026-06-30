export const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)));
export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const clone = (x) => JSON.parse(JSON.stringify(x));
