// Chunk templates (GDD §21). Each item: { t: type, l: lane 0..2, z: offset into chunk, y?, big? }
// z grows in the direction of travel; z=0 is the chunk's near edge.
// tier = minimum difficulty tier (GDD §22: 0: 0-20s, 1: 20-40s, 2: 40-60s, 3: 60s+).
// For 'apple', l is the side it rolls in from (0 = from left, 2 = from right).

const L = 0, C = 1, R = 2;

function dewLine(lane, z0, count, step = 1.6, y = 0.6) {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ t: 'dew', l: lane, z: z0 + i * step, y });
  return out;
}

function dewShift(from, to, z0, step = 1.5) {
  const out = [];
  const dir = Math.sign(to - from);
  let lane = from, z = z0;
  for (;;) {
    out.push({ t: 'dew', l: lane, z });
    out.push({ t: 'dew', l: lane, z: z + step });
    if (lane === to) break;
    lane += dir;
    z += step * 2;
  }
  return out;
}

// Arc over an obstacle centered at zc
function dewArc(lane, zc) {
  const ys = [0.6, 1.4, 1.9, 1.4, 0.6];
  return ys.map((y, i) => ({ t: 'dew', l: lane, z: zc + (i - 2) * 1.6, y }));
}

export const CHUNKS = [
  // ---- tier 0: rock / mushroom / branch only
  { name: '01 rock center', tier: 0, items: [
    ...dewLine(L, 4, 6), { t: 'rock', l: C, z: 10 },
  ]},
  { name: '02 mushroom + rock', tier: 0, items: [
    { t: 'mushroom', l: L, z: 11 }, ...dewLine(C, 3, 8), { t: 'rock', l: R, z: 11 },
  ]},
  { name: '03 branch arc', tier: 0, items: [
    { t: 'branch', l: C, z: 12 }, ...dewArc(C, 12),
  ]},
  { name: '04 rocks left+right', tier: 0, items: [
    { t: 'rock', l: L, z: 8 }, { t: 'rock', l: R, z: 8 }, ...dewLine(C, 2, 9),
  ]},
  { name: '05 shift around mushroom', tier: 0, items: [
    ...dewShift(L, R, 3), { t: 'mushroom', l: C, z: 14 }, { t: 'dew', l: R, z: 14, big: true },
  ]},
  { name: '06 breather dew all lanes', tier: 0, items: [
    ...dewLine(L, 4, 5), ...dewLine(C, 4, 5), ...dewLine(R, 4, 5),
  ]},
  { name: '07 branch wall (all lanes)', tier: 0, items: [
    { t: 'branch', l: L, z: 12 }, { t: 'branch', l: C, z: 12 }, { t: 'branch', l: R, z: 12 },
    ...dewArc(C, 12),
  ]},

  // ---- tier 1: + salt, pot
  { name: '08 triple mushroom (RAM)', tier: 1, ram: true, items: [
    { t: 'mushroom', l: C, z: 6 }, { t: 'mushroom', l: C, z: 11 }, { t: 'mushroom', l: C, z: 16 },
    ...dewLine(L, 5, 8), ...dewLine(R, 5, 8), { t: 'dew', l: C, z: 21, big: true },
  ]},
  { name: '09 stagger', tier: 1, items: [
    { t: 'rock', l: L, z: 5 }, { t: 'rock', l: C, z: 12 }, { t: 'mushroom', l: R, z: 19 },
    ...dewLine(R, 3, 5), ...dewLine(L, 12, 5),
  ]},
  { name: '10 jump lane', tier: 1, items: [
    { t: 'mushroom', l: L, z: 10 }, { t: 'branch', l: C, z: 10 }, { t: 'rock', l: R, z: 10 },
    ...dewArc(C, 10), { t: 'dew', l: C, z: 16, big: true },
  ]},
  { name: '11 salt lane', tier: 1, items: [
    { t: 'salt', l: L, z: 10 }, ...dewLine(C, 3, 8), { t: 'rock', l: R, z: 10 },
  ]},
  { name: '12 pot center', tier: 1, items: [
    ...dewLine(L, 4, 6), { t: 'pot', l: C, z: 12 }, ...dewLine(R, 4, 6),
  ]},
  { name: '13 risk path', tier: 1, items: [
    ...dewLine(L, 4, 4),
    { t: 'branch', l: R, z: 6 }, ...dewLine(R, 9, 6), { t: 'dew', l: R, z: 19, big: true }, { t: 'rock', l: R, z: 21 },
  ]},
  { name: '14 salt + branch', tier: 1, items: [
    { t: 'salt', l: C, z: 8 }, { t: 'branch', l: L, z: 8 }, ...dewLine(R, 4, 6), { t: 'pot', l: R, z: 18 }, ...dewArc(L, 8),
  ]},

  // ---- tier 2: + apple, bird
  { name: '15 rolling apple', tier: 2, items: [
    ...dewLine(C, 2, 4), { t: 'apple', l: L, z: 13 }, ...dewLine(L, 17, 4),
  ]},
  { name: '16 bird strike', tier: 2, items: [
    ...dewLine(C, 2, 5), { t: 'bird', l: C, z: 14 }, ...dewLine(R, 10, 5),
  ]},
  { name: '17 RAM gauntlet', tier: 2, ram: true, items: [
    { t: 'mushroom', l: C, z: 4 }, { t: 'rock', l: C, z: 9 }, { t: 'mushroom', l: C, z: 14 }, { t: 'pot', l: C, z: 19 },
    ...dewLine(L, 3, 4), ...dewLine(R, 3, 4), ...dewLine(C, 21, 2, 1.4), { t: 'dew', l: C, z: 23, big: true },
  ]},
  { name: '18 apple from right + salt', tier: 2, items: [
    { t: 'apple', l: R, z: 10 }, { t: 'salt', l: L, z: 18 }, ...dewLine(C, 14, 6),
  ]},

  // ---- tier 3: two-action combos
  { name: '19 zigzag', tier: 3, items: [
    { t: 'rock', l: L, z: 5 }, { t: 'rock', l: C, z: 5 },
    { t: 'mushroom', l: C, z: 13 }, { t: 'mushroom', l: R, z: 13 },
    { t: 'rock', l: L, z: 19 }, { t: 'branch', l: C, z: 19 },
    ...dewLine(R, 2, 3), ...dewLine(L, 10, 3), ...dewArc(C, 19),
  ]},
  { name: '20 wall + bird', tier: 3, items: [
    { t: 'salt', l: L, z: 8 }, { t: 'pot', l: C, z: 8 }, { t: 'rock', l: R, z: 8 },
    { t: 'bird', l: R, z: 18 }, ...dewArc(L, 8), ...dewLine(C, 14, 4),
  ]},
];
