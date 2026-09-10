// Pure rules derived from the GDD. No rendering, no state — just functions and tables.
import { CONFIG } from '../config.js';

// GDD §20. `height` is how high the snail must be to clear it; `halfLen` the z half-length.
export const OBSTACLES = {
  rock:     { damage: 35,  breakable: true,  heavy: false, jumpable: true, height: 0.9,  halfLen: 0.6 },
  mushroom: { damage: 45,  breakable: true,  heavy: false, jumpable: true, height: 1.15, halfLen: 0.5 },
  branch:   { damage: 50,  breakable: true,  heavy: false, jumpable: true, height: 0.55, halfLen: 0.3, spikeSelfDamage: 20 },
  salt:     { damage: 30,  breakable: false, heavy: false, jumpable: true, height: 0.25, halfLen: 1.2, slow: { factor: 0.55, duration: 1 } },
  pot:      { damage: 100, breakable: true,  heavy: true,  jumpable: false, height: 99,  halfLen: 0.7 },
  apple:    { damage: 100, breakable: false, heavy: false, jumpable: false, height: 99,  halfLen: 0.7, dynamic: true },
  bird:     { damage: 100, breakable: false, heavy: false, jumpable: false, height: 99,  halfLen: 0.5, dynamic: true },
};

export const SPIKE_SELF_DAMAGE = 15;   // GDD §12.3

/**
 * GDD §42 collision pipeline.
 * @returns {{outcome:'break'|'hit', shellDamage:number, spikeDamage:number, slow:object|null}}
 */
export function resolveCollision(type, { hasSpike = false, boostActive = false, damageMul = 1 } = {}) {
  const o = OBSTACLES[type];
  if (!o) throw new Error(`Unknown obstacle: ${type}`);
  const ram = hasSpike && boostActive;
  const none = { outcome: 'hit', shellDamage: 0, spikeDamage: 0, slow: null };

  if (o.breakable) {
    if (o.heavy) {
      if (ram) return { ...none, outcome: 'break' };
      // Plain spike can't break heavy — regular damage
    } else {
      if (ram) return { ...none, outcome: 'break' };
      if (hasSpike) return { ...none, outcome: 'break', spikeDamage: o.spikeSelfDamage ?? SPIKE_SELF_DAMAGE };
    }
  }
  return { outcome: 'hit', shellDamage: Math.round(o.damage * damageMul), spikeDamage: 0, slow: o.slow || null };
}

// GDD §4 speed schedule (numbers live in CONFIG; tuned after playtest).
export function speedAt(elapsed, cfg = CONFIG) {
  const ramp = Math.floor(elapsed / cfg.speedInterval) * cfg.speedStep;
  return Math.min(cfg.maxSpeed, cfg.startSpeed + ramp);
}

// GDD §22 difficulty tiers.
export function tierAt(elapsed) {
  if (elapsed < 20) return 0;
  if (elapsed < 40) return 1;
  if (elapsed < 60) return 2;
  return 3;
}

// GDD §12.4 / §32
export const BOOST = { speedMul: 1.5, duration: 1.5, cooldownByLevel: [8, 7, 6], fovBonus: 8 };
export function boostCooldown(level) { return BOOST.cooldownByLevel[Math.min(Math.max(level, 1), 3) - 1]; }

// GDD §12.5 / §15 / §32
export const MAGNET_RADIUS = [3.5, 4.5, 5.5];
export function magnetRadius(level, boostActive = false) {
  if (level < 1) return 0;
  const r = MAGNET_RADIUS[Math.min(level, 3) - 1];
  return boostActive ? r * 2 : r;
}

// GDD §32 jump height by level, §15 Heavy Bounce.
export const JUMP_HEIGHT_MUL = [1.0, 1.1, 1.2];
export function jumpHeightMul(level, heavyBounce = false) {
  const base = JUMP_HEIGHT_MUL[Math.min(Math.max(level, 1), 3) - 1];
  return base * (heavyBounce ? 1.2 : 1);
}

// GDD §32 upgrade prices.
export const UPGRADE_COST = { 1: 100, 2: 250 };
export const MAX_LEVEL = 3;

// GDD §35 distance milestones.
export const MILESTONES = [250, 500, 1000, 1500, 2000];

// GDD §16 unlock order after each run.
export const UNLOCK_ORDER = ['jump', 'boost', 'spike', 'magnet'];
// Where a freshly unlocked sector is placed in the starting Armor shell (GDD §17 preset).
export const UNLOCK_SLOT = { spike: 1, jump: 2, boost: 4, magnet: 5 };
