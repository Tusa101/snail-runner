// Pure gameplay model of the shell. No Three.js here — fully unit-testable.
// GDD §6-§9, §12-§15, §38-§40.

import { SECTOR_TYPES } from '../config.js';

// Logical zones for the 6 outer slots (GDD §8). Slot 0 is always front.
export const ZONES = ['front', 'frontRight', 'backRight', 'back', 'backLeft', 'frontLeft'];
export const FRONT_HIT_WEIGHTS = { front: 0.6, frontLeft: 0.2, frontRight: 0.2 };
// Fallback order when front zones are gone: closest to the impact first.
const ZONE_FALLBACK_ORDER = ['front', 'frontLeft', 'frontRight', 'backLeft', 'backRight', 'back'];

export const STATES = { healthy: 'healthy', damaged: 'damaged', critical: 'critical', destroyed: 'destroyed' };

// GDD §9 thresholds.
export function sectorState(hp, maxHp) {
  if (hp <= 0) return STATES.destroyed;
  const r = hp / maxHp;
  if (r > 0.6) return STATES.healthy;
  if (r > 0.3) return STATES.damaged;
  return STATES.critical;
}

export function sectorMaxHp(type, level = 1, hpMul = 1) {
  const def = SECTOR_TYPES[type];
  if (!def) throw new Error(`Unknown sector type: ${type}`);
  const lvl = Math.min(Math.max(level, 1), def.hp.length);
  return Math.round(def.hp[lvl - 1] * hpMul);
}

export class ShellState {
  /**
   * @param {Array<{type:string, level?:number}>} layout  6 entries
   * @param {{hpMul?:number, rng?:()=>number}} opts
   */
  constructor(layout, opts = {}) {
    if (!Array.isArray(layout) || layout.length !== 6) throw new Error('Shell layout must have 6 slots');
    this.rng = opts.rng || Math.random;
    this.hpMul = opts.hpMul ?? 1;
    this.slots = layout.map((s, i) => {
      const level = s.level ?? 1;
      const maxHp = sectorMaxHp(s.type, level, this.hpMul);
      return { index: i, zone: ZONES[i], type: s.type, level, maxHp, hp: maxHp };
    });
  }

  get(i) { return this.slots[i]; }
  isAlive(i) { return this.slots[i].hp > 0; }
  alive() { return this.slots.filter((s) => s.hp > 0); }
  aliveCount() { return this.alive().length; }
  isDestroyed() { return this.aliveCount() === 0; }
  stateOf(i) { const s = this.slots[i]; return sectorState(s.hp, s.maxHp); }

  // GDD §40: abilities are derived from living sectors.
  hasAbility(ability) {
    return this.slots.some((s) => s.hp > 0 && SECTOR_TYPES[s.type].ability === ability);
  }
  abilities() {
    return ['jump', 'spike', 'boost', 'magnet'].filter((a) => this.hasAbility(a));
  }
  aliveOfType(type) { return this.slots.filter((s) => s.hp > 0 && s.type === type); }
  bestLevelOf(type) { return Math.max(0, ...this.aliveOfType(type).map((s) => s.level)); }

  // Ring adjacency (5 wraps to 0).
  static adjacent(i, j) {
    const d = Math.abs(i - j);
    return d === 1 || d === 5;
  }

  // GDD §15 Heavy Bounce: a living Jump next to a living Armor.
  hasHeavyBounce() {
    return this.slots.some((s) =>
      s.hp > 0 && s.type === 'jump' &&
      this.slots.some((o) => o.hp > 0 && o.type === 'armor' && ShellState.adjacent(s.index, o.index)));
  }

  // GDD §8: 60% front, 20% front-left, 20% front-right, restricted to living sectors.
  pickHitSlot() {
    const byZone = {};
    for (const s of this.slots) if (s.hp > 0) byZone[s.zone] = s;
    const candidates = Object.entries(FRONT_HIT_WEIGHTS)
      .filter(([zone]) => byZone[zone])
      .map(([zone, w]) => [byZone[zone], w]);
    if (candidates.length === 0) {
      for (const zone of ZONE_FALLBACK_ORDER) if (byZone[zone]) return byZone[zone];
      return null;
    }
    const total = candidates.reduce((a, [, w]) => a + w, 0);
    let r = this.rng() * total;
    for (const [slot, w] of candidates) {
      r -= w;
      if (r <= 0) return slot;
    }
    return candidates[candidates.length - 1][0];
  }

  /**
   * Apply damage to a slot (or an automatically picked front slot).
   * Returns a list of events describing what happened, in order:
   *  { type:'damaged', slot, prevState, state, hp }
   *  { type:'destroyed', slot }
   *  { type:'abilityLost', ability }
   *  { type:'shellDestroyed' }
   */
  damage(amount, slotIndex = null) {
    const events = [];
    if (amount <= 0) return events;
    const slot = slotIndex == null ? this.pickHitSlot() : this.slots[slotIndex];
    if (!slot || slot.hp <= 0) return events;

    const abilitiesBefore = this.abilities();
    const prevState = sectorState(slot.hp, slot.maxHp);
    slot.hp = Math.max(0, slot.hp - amount);
    const state = sectorState(slot.hp, slot.maxHp);
    events.push({ type: 'damaged', slot: slot.index, prevState, state, hp: slot.hp, amount });

    if (slot.hp === 0) {
      events.push({ type: 'destroyed', slot: slot.index, sectorType: slot.type });
      for (const a of abilitiesBefore) if (!this.hasAbility(a)) events.push({ type: 'abilityLost', ability: a });
      if (this.isDestroyed()) events.push({ type: 'shellDestroyed' });
    }
    return events;
  }

  // Damage a living sector of a given type (e.g. Spike self-damage, GDD §12.3).
  damageType(type, amount) {
    const target = this.aliveOfType(type)[0];
    if (!target) return [];
    return this.damage(amount, target.index);
  }

  breakSlot(i) { return this.damage(Infinity, i); }
  breakAll() {
    const events = [];
    for (const s of this.slots) if (s.hp > 0) events.push(...this.breakSlot(s.index));
    return events;
  }

  // GDD §33: no repair economy — everything restores after a run.
  repairAll() {
    for (const s of this.slots) { s.maxHp = sectorMaxHp(s.type, s.level, this.hpMul); s.hp = s.maxHp; }
  }

  snapshot() {
    return this.slots.map((s) => ({ type: s.type, level: s.level, currentHp: s.hp, maxHp: s.maxHp, state: sectorState(s.hp, s.maxHp) }));
  }
}
