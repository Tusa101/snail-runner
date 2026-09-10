import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCollision, speedAt, tierAt, boostCooldown, magnetRadius, jumpHeightMul, OBSTACLES, MILESTONES } from '../src/core/rules.js';
import { BoostState } from '../src/core/BoostState.js';
import { defaultSave, loadSave, persistSave, endRun, upgrade, canUpgrade, upgradeCost, layoutFrom, swapSlots, setSlot, SAVE_KEY } from '../src/core/SaveState.js';
import { CHUNKS } from '../src/track/chunks.js';
import { CONFIG } from '../src/config.js';

describe('GDD §4 — speed schedule', () => {
  test('starts at startSpeed, steps every interval, capped at maxSpeed (values tuned in CONFIG)', () => {
    const { startSpeed: s0, speedStep: st, speedInterval: iv, maxSpeed: mx } = CONFIG;
    assert.equal(speedAt(0), s0);
    assert.equal(speedAt(iv - 0.01), s0);
    assert.equal(speedAt(iv), s0 + st);
    assert.equal(speedAt(iv * 2), s0 + st * 2);
    assert.equal(speedAt(10000), mx);
    assert.ok(mx > s0 * 1.8, 'ramps to nearly double: the run must get demanding');
  });
});

describe('GDD §22 — difficulty tiers', () => {
  test('0-20 / 20-40 / 40-60 / 60+', () => {
    assert.equal(tierAt(0), 0); assert.equal(tierAt(19.9), 0);
    assert.equal(tierAt(20), 1); assert.equal(tierAt(40), 2); assert.equal(tierAt(60), 3);
  });
});

describe('GDD §20/§42 — collision resolution', () => {
  test('obstacle damage table', () => {
    assert.equal(OBSTACLES.rock.damage, 35); assert.equal(OBSTACLES.mushroom.damage, 45); assert.equal(OBSTACLES.branch.damage, 50);
    assert.equal(OBSTACLES.salt.damage, 30); assert.equal(OBSTACLES.pot.damage, 100); assert.equal(OBSTACLES.apple.damage, 100); assert.equal(OBSTACLES.bird.damage, 100);
  });
  test('no spike: breakables hit the shell for full damage', () => {
    assert.deepEqual(resolveCollision('rock'), { outcome: 'hit', shellDamage: 35, spikeDamage: 0, slow: null });
    assert.equal(resolveCollision('mushroom').shellDamage, 45);
  });
  test('spike breaks rock/mushroom taking only 15 self damage', () => {
    const r = resolveCollision('rock', { hasSpike: true });
    assert.equal(r.outcome, 'break'); assert.equal(r.shellDamage, 0); assert.equal(r.spikeDamage, 15);
  });
  test('spike breaks branch but takes 20', () => {
    const r = resolveCollision('branch', { hasSpike: true });
    assert.equal(r.outcome, 'break'); assert.equal(r.spikeDamage, 20);
  });
  test('RAM MODE (spike + boost) breaks without any damage', () => {
    const r = resolveCollision('mushroom', { hasSpike: true, boostActive: true });
    assert.deepEqual(r, { outcome: 'break', shellDamage: 0, spikeDamage: 0, slow: null });
  });
  test('Garden Pot: plain spike does not help, RAM breaks it', () => {
    assert.equal(resolveCollision('pot', { hasSpike: true }).outcome, 'hit');
    assert.equal(resolveCollision('pot', { hasSpike: true }).shellDamage, 100);
    assert.equal(resolveCollision('pot', { hasSpike: true, boostActive: true }).outcome, 'break');
  });
  test('Salt Patch: unbreakable, 30 damage and a 0.55× slow for 1 s, even in RAM', () => {
    const r = resolveCollision('salt', { hasSpike: true, boostActive: true });
    assert.equal(r.outcome, 'hit'); assert.equal(r.shellDamage, 30);
    assert.deepEqual(r.slow, { factor: 0.55, duration: 1 });
  });
  test('Apple and Bird are never breakable', () => {
    for (const t of ['apple', 'bird']) {
      const r = resolveCollision(t, { hasSpike: true, boostActive: true });
      assert.equal(r.outcome, 'hit'); assert.equal(r.shellDamage, 100);
    }
  });
  test('boost alone (no spike) does not break anything', () => {
    assert.equal(resolveCollision('rock', { boostActive: true }).outcome, 'hit');
  });
  test('debug damage multiplier scales shell damage', () => {
    assert.equal(resolveCollision('rock', { damageMul: 2 }).shellDamage, 70);
    assert.equal(resolveCollision('rock', { damageMul: 0 }).shellDamage, 0);
  });
  test('jumpable obstacles have a finite clear height; pot/apple/bird cannot be jumped', () => {
    for (const t of ['rock', 'mushroom', 'branch', 'salt']) assert.ok(OBSTACLES[t].height < CONFIG.jump.height);
    for (const t of ['pot', 'apple', 'bird']) assert.equal(OBSTACLES[t].jumpable, false);
  });
});

describe('GDD §12.4/§32 — Boost', () => {
  test('+50% for 1.5 s, cooldown 8/7/6 by level', () => {
    const b = new BoostState();
    assert.equal(b.activate(true, 1), true);
    assert.equal(b.speedMul, 1.5);
    b.update(1.4); assert.equal(b.active, true);
    b.update(0.2); assert.equal(b.active, false); assert.equal(b.speedMul, 1);
    assert.equal(boostCooldown(1), 8); assert.equal(boostCooldown(2), 7); assert.equal(boostCooldown(3), 6);
  });
  test('cannot re-activate during cooldown; ready after 8 s total', () => {
    const b = new BoostState();
    b.activate(true, 1);
    b.update(2);
    assert.equal(b.activate(true, 1), false);
    b.update(6.1);
    assert.equal(b.ready, true);
    assert.equal(b.activate(true, 1), true);
  });
  test('unavailable without a living Boost sector; cancel stops an active boost', () => {
    const b = new BoostState();
    assert.equal(b.activate(false), false);
    b.activate(true); b.cancel();
    assert.equal(b.active, false);
  });
  test('readiness goes 0→1 over the cooldown for the HUD ring', () => {
    const b = new BoostState();
    b.activate(true, 3); b.update(1.5);
    assert.ok(Math.abs(b.readiness - 0.25) < 1e-9);
    b.update(4.5);
    assert.equal(b.readiness, 1);
  });
});

describe('GDD §12.5/§15/§32 — Magnet and Jump scaling', () => {
  test('magnet radius by level, doubled during boost (Vacuum Rush)', () => {
    assert.equal(magnetRadius(1), 3.5); assert.equal(magnetRadius(2), 4.5); assert.equal(magnetRadius(3), 5.5);
    assert.equal(magnetRadius(1, true), 7); assert.equal(magnetRadius(0), 0);
  });
  test('jump height 100/110/120% and +20% Heavy Bounce', () => {
    assert.equal(jumpHeightMul(1), 1); assert.equal(jumpHeightMul(2), 1.1); assert.equal(jumpHeightMul(3), 1.2);
    assert.ok(Math.abs(jumpHeightMul(1, true) - 1.2) < 1e-9);
  });
});

describe('GDD §16/§32/§36/§47 — save & progression', () => {
  const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

  test('first run: only Armor, 6 Armor slots', () => {
    const s = defaultSave();
    assert.deepEqual(s.unlocked, ['armor']);
    assert.deepEqual(layoutFrom(s), Array(6).fill({ type: 'armor', level: 1 }));
  });
  test('one unlock per run in order Jump → Boost → Spike → Magnet, placed into the shell', () => {
    const s = defaultSave();
    assert.equal(endRun(s, { distance: 100, dew: 10 }).newUnlock, 'jump');
    assert.equal(s.shell[2], 'jump');
    assert.equal(endRun(s, { distance: 100, dew: 10 }).newUnlock, 'boost');
    assert.equal(endRun(s, { distance: 100, dew: 10 }).newUnlock, 'spike');
    assert.equal(endRun(s, { distance: 100, dew: 10 }).newUnlock, 'magnet');
    assert.deepEqual(s.shell, ['armor', 'spike', 'jump', 'armor', 'boost', 'magnet']);
    assert.equal(endRun(s, { distance: 100, dew: 10 }).newUnlock, null);
    assert.equal(s.runs, 5);
  });
  test('stats: dew accumulates, best distance tracked, destroyed obstacles counted', () => {
    const s = defaultSave();
    assert.equal(endRun(s, { distance: 742.9, dew: 184, obstaclesDestroyed: 3 }).newBest, true);
    assert.equal(s.bestDistance, 742);
    assert.equal(endRun(s, { distance: 500, dew: 20 }).newBest, false);
    assert.equal(s.dew, 204); assert.equal(s.obstaclesDestroyed, 3);
  });
  test('upgrades cost 100 then 250, max level 3, requires unlock and enough dew', () => {
    const s = defaultSave();
    s.dew = 99;
    assert.equal(canUpgrade(s, 'armor'), false);
    s.dew = 100;
    assert.equal(upgrade(s, 'armor'), true); assert.equal(s.dew, 0); assert.equal(s.upgrades.armor, 2);
    assert.equal(upgradeCost(s, 'armor'), 250);
    s.dew = 250; upgrade(s, 'armor');
    assert.equal(s.upgrades.armor, 3); assert.equal(upgradeCost(s, 'armor'), null);
    assert.equal(canUpgrade(s, 'armor'), false);
    s.dew = 1000;
    assert.equal(upgrade(s, 'spike'), false, 'not unlocked yet');
  });
  test('shell builder: swap two slots, set a slot to an unlocked type only', () => {
    const s = defaultSave();
    endRun(s, { distance: 1, dew: 0 }); // unlocks jump into slot 2
    assert.equal(swapSlots(s, 2, 0), true);
    assert.equal(s.shell[0], 'jump');
    assert.equal(setSlot(s, 5, 'spike'), false);
    assert.equal(setSlot(s, 5, 'jump'), true);
    assert.equal(setSlot(s, 9, 'jump'), false);
  });
  test('persist/load roundtrip; corrupt or missing data falls back to defaults', () => {
    const st = fakeStorage();
    const s = defaultSave(); s.dew = 425; s.bestDistance = 1242;
    persistSave(st, s);
    assert.deepEqual(loadSave(st), s);
    st.setItem(SAVE_KEY, '{not json');
    assert.deepEqual(loadSave(st), defaultSave());
    st.setItem(SAVE_KEY, JSON.stringify({ shell: ['x'] }));
    assert.deepEqual(loadSave(st), defaultSave());
    assert.deepEqual(loadSave(null), defaultSave());
  });
});

describe('GDD §21/§35 — chunk library and milestones', () => {
  test('12+ templates, all items valid, inside the chunk length', () => {
    assert.ok(CHUNKS.length >= 12);
    const names = new Set();
    for (const c of CHUNKS) {
      assert.ok(!names.has(c.name)); names.add(c.name);
      assert.ok(c.tier >= 0 && c.tier <= 3);
      for (const it of c.items) {
        assert.ok([0, 1, 2].includes(it.l), `${c.name}: lane ${it.l}`);
        assert.ok(it.z >= 0 && it.z <= CONFIG.chunkLength, `${c.name}: z ${it.z}`);
        assert.ok(it.t === 'dew' || it.t in OBSTACLES, `${c.name}: type ${it.t}`);
      }
    }
  });
  test('early tier uses only rock/mushroom/branch; salt/pot appear from tier 1; apple/bird from tier 2', () => {
    for (const c of CHUNKS) {
      const types = new Set(c.items.map((i) => i.t));
      if (c.tier === 0) for (const t of types) assert.ok(['dew', 'rock', 'mushroom', 'branch'].includes(t), c.name);
      if (types.has('salt') || types.has('pot')) assert.ok(c.tier >= 1, c.name);
      if (types.has('apple') || types.has('bird')) assert.ok(c.tier >= 2, c.name);
    }
    assert.ok(CHUNKS.some((c) => c.items.some((i) => i.t === 'apple')));
    assert.ok(CHUNKS.some((c) => c.items.some((i) => i.t === 'bird')));
  });
  test('a dedicated RAM chunk with several breakables in one lane exists', () => {
    const ram = CHUNKS.find((c) => c.ram);
    assert.ok(ram);
    const lanes = ram.items.filter((i) => i.t !== 'dew').map((i) => i.l);
    assert.ok(lanes.length >= 3 && new Set(lanes).size === 1);
  });
  test('milestones 250/500/1000/1500/2000', () => {
    assert.deepEqual(MILESTONES, [250, 500, 1000, 1500, 2000]);
  });
});
