import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ShellState, sectorState, sectorMaxHp, ZONES } from '../src/core/ShellState.js';

const armor6 = () => Array(6).fill({ type: 'armor' });
const preset = () => ['armor', 'spike', 'jump', 'armor', 'boost', 'magnet'].map((type) => ({ type }));

// Deterministic rng for weighted picks
const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };

describe('GDD §7/§12/§32 — sector HP tables', () => {
  test('starting shell is 6 Armor at 180 HP', () => {
    const s = new ShellState(armor6());
    assert.equal(s.slots.length, 6);
    for (const slot of s.slots) { assert.equal(slot.type, 'armor'); assert.equal(slot.hp, 180); }
  });
  test('per-type, per-level HP', () => {
    assert.equal(sectorMaxHp('armor', 1), 180); assert.equal(sectorMaxHp('armor', 2), 220); assert.equal(sectorMaxHp('armor', 3), 270);
    assert.equal(sectorMaxHp('spike', 1), 100); assert.equal(sectorMaxHp('spike', 3), 160);
    assert.equal(sectorMaxHp('jump', 1), 90); assert.equal(sectorMaxHp('boost', 1), 80); assert.equal(sectorMaxHp('magnet', 1), 70);
  });
  test('level is clamped to the table and debug HP multiplier applies', () => {
    assert.equal(sectorMaxHp('armor', 9), 270);
    assert.equal(new ShellState(armor6(), { hpMul: 0.5 }).slots[0].hp, 90);
  });
  test('rejects a layout that is not 6 slots or has unknown types', () => {
    assert.throws(() => new ShellState([{ type: 'armor' }]));
    assert.throws(() => new ShellState(Array(6).fill({ type: 'wings' })));
  });
});

describe('GDD §9 — sector states by HP ratio', () => {
  test('thresholds: >60% healthy, 31-60% damaged, 1-30% critical, 0 destroyed', () => {
    assert.equal(sectorState(100, 100), 'healthy');
    assert.equal(sectorState(61, 100), 'healthy');
    assert.equal(sectorState(60, 100), 'damaged');
    assert.equal(sectorState(31, 100), 'damaged');
    assert.equal(sectorState(30, 100), 'critical');
    assert.equal(sectorState(1, 100), 'critical');
    assert.equal(sectorState(0, 100), 'destroyed');
  });
  test('state transitions are reported on damage', () => {
    const s = new ShellState(armor6());
    const e1 = s.damage(80, 0); // 100/180 = 55% → damaged
    assert.equal(e1[0].prevState, 'healthy'); assert.equal(e1[0].state, 'damaged');
    const e2 = s.damage(60, 0); // 40/180 = 22% → critical
    assert.equal(e2[0].state, 'critical');
  });
});

describe('GDD §8 — which sector takes the hit', () => {
  test('slot zones are front, front-right, back-right, back, back-left, front-left', () => {
    assert.deepEqual(ZONES, ['front', 'frontRight', 'backRight', 'back', 'backLeft', 'frontLeft']);
  });
  test('60% front / 20% front-left / 20% front-right', () => {
    let x = 0;
    const s = new ShellState(armor6(), { rng: () => { x = (x + 0.61803398875) % 1; return x; } });
    const counts = {};
    for (let i = 0; i < 10000; i++) { const slot = s.pickHitSlot(); counts[slot.zone] = (counts[slot.zone] || 0) + 1; }
    assert.ok(Math.abs(counts.front / 10000 - 0.6) < 0.03, `front ${counts.front}`);
    assert.ok(Math.abs(counts.frontLeft / 10000 - 0.2) < 0.03, `fl ${counts.frontLeft}`);
    assert.ok(Math.abs(counts.frontRight / 10000 - 0.2) < 0.03, `fr ${counts.frontRight}`);
    assert.equal(counts.back, undefined);
  });
  test('dead front sector redistributes to the remaining front zones only', () => {
    const s = new ShellState(armor6(), { rng: seq([0.1, 0.9]) });
    s.breakSlot(0);
    for (let i = 0; i < 50; i++) assert.ok(['frontLeft', 'frontRight'].includes(s.pickHitSlot().zone));
  });
  test('when all front zones are gone the hit falls back to the nearest living sector, never null while alive', () => {
    const s = new ShellState(armor6());
    s.breakSlot(0); s.breakSlot(1); s.breakSlot(5);
    assert.equal(s.pickHitSlot().zone, 'backLeft');
    s.breakSlot(4);
    assert.equal(s.pickHitSlot().zone, 'backRight');
    s.breakSlot(2);
    assert.equal(s.pickHitSlot().zone, 'back');
    s.breakSlot(3);
    assert.equal(s.pickHitSlot(), null);
  });
});

describe('GDD §10/§11 — destruction and Game Over', () => {
  test('a Small(35)+Medium(60)+Heavy(100) chain destroys a 180 HP Armor exactly', () => {
    const s = new ShellState(armor6());
    s.damage(35, 0); s.damage(60, 0);
    const events = s.damage(100, 0);
    assert.equal(s.get(0).hp, 0);
    assert.ok(events.some((e) => e.type === 'destroyed' && e.slot === 0));
    assert.equal(s.aliveCount(), 5);
  });
  test('HP never goes negative and dead sectors ignore further damage', () => {
    const s = new ShellState(armor6());
    s.damage(999, 0);
    assert.equal(s.get(0).hp, 0);
    assert.deepEqual(s.damage(10, 0), []);
  });
  test('shellDestroyed fires only when the last sector dies', () => {
    const s = new ShellState(armor6());
    let fired = 0;
    for (let i = 0; i < 6; i++) fired += s.breakSlot(i).filter((e) => e.type === 'shellDestroyed').length;
    assert.equal(fired, 1);
    assert.ok(s.isDestroyed());
  });
  test('repairAll restores every sector to max (GDD §33: no repair economy)', () => {
    const s = new ShellState(preset());
    s.breakAll();
    s.repairAll();
    assert.equal(s.aliveCount(), 6);
    assert.equal(s.get(1).hp, 100);
  });
});

describe('GDD §13/§40 — abilities derive from living sectors', () => {
  test('preset shell exposes jump, spike, boost, magnet; armor-only exposes nothing', () => {
    assert.deepEqual(new ShellState(preset()).abilities(), ['jump', 'spike', 'boost', 'magnet']);
    assert.deepEqual(new ShellState(armor6()).abilities(), []);
  });
  test('losing the Jump sector removes jump immediately and reports abilityLost', () => {
    const s = new ShellState(preset());
    const events = s.breakSlot(2);
    assert.equal(s.hasAbility('jump'), false);
    assert.ok(events.some((e) => e.type === 'abilityLost' && e.ability === 'jump'));
  });
  test('an ability survives while another sector of the same type lives', () => {
    const layout = ['jump', 'jump', 'armor', 'armor', 'armor', 'armor'].map((type) => ({ type }));
    const s = new ShellState(layout);
    const e1 = s.breakSlot(0);
    assert.equal(s.hasAbility('jump'), true);
    assert.ok(!e1.some((e) => e.type === 'abilityLost'));
    const e2 = s.breakSlot(1);
    assert.ok(e2.some((e) => e.type === 'abilityLost' && e.ability === 'jump'));
  });
  test('Spike self-damage lands on a living Spike sector', () => {
    const s = new ShellState(preset());
    s.damageType('spike', 15);
    assert.equal(s.get(1).hp, 85);
    s.breakSlot(1);
    assert.deepEqual(s.damageType('spike', 15), []);
  });
});

describe('GDD §15 — Armor + Jump adjacency (Heavy Bounce)', () => {
  test('preset: Jump at slot 2 next to Armor at slot 3 → active', () => {
    assert.equal(new ShellState(preset()).hasHeavyBounce(), true);
  });
  test('ring wraps: slot 5 is adjacent to slot 0', () => {
    const layout = ['armor', 'spike', 'spike', 'spike', 'spike', 'jump'].map((type) => ({ type }));
    assert.equal(new ShellState(layout).hasHeavyBounce(), true);
    assert.equal(ShellState.adjacent(0, 5), true);
    assert.equal(ShellState.adjacent(0, 3), false);
  });
  test('synergy disappears when the neighbouring Armor breaks', () => {
    const s = new ShellState(preset());
    s.breakSlot(3);
    assert.equal(s.hasHeavyBounce(), false);
  });
});
