// GDD §16, §32, §36, §47. Pure functions + a tiny persistence wrapper.
import { SECTOR_TYPES } from '../config.js';
import { UNLOCK_ORDER, UNLOCK_SLOT, UPGRADE_COST, MAX_LEVEL } from './rules.js';

export const SAVE_KEY = 'snail-runner-save-v1';

export function defaultSave() {
  return {
    dew: 0,
    bestDistance: 0,
    runs: 0,
    obstaclesDestroyed: 0,
    unlocked: ['armor'],
    shell: ['armor', 'armor', 'armor', 'armor', 'armor', 'armor'],
    upgrades: { armor: 1 },
  };
}

function isValidSave(s) {
  return s && typeof s === 'object'
    && Array.isArray(s.shell) && s.shell.length === 6 && s.shell.every((t) => t in SECTOR_TYPES)
    && Array.isArray(s.unlocked) && typeof s.dew === 'number' && typeof s.runs === 'number';
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!isValidSave(parsed)) return defaultSave();
    return { ...defaultSave(), ...parsed, upgrades: { ...parsed.upgrades } };
  } catch {
    return defaultSave();
  }
}

export function persistSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function levelOf(save, type) { return save.upgrades[type] || 1; }

// Layout suitable for ShellState.
export function layoutFrom(save) {
  return save.shell.map((type) => ({ type, level: levelOf(save, type) }));
}

/**
 * Apply the results of a finished run. Mutates and returns a summary.
 * GDD §16: one new sector type after each run, placed into the shell automatically.
 */
export function endRun(save, { distance, dew, obstaclesDestroyed = 0 }) {
  const d = Math.floor(distance);
  save.runs += 1;
  save.dew += dew;
  save.obstaclesDestroyed += obstaclesDestroyed;
  const newBest = d > save.bestDistance;
  if (newBest) save.bestDistance = d;

  let newUnlock = null;
  const next = UNLOCK_ORDER.find((t) => !save.unlocked.includes(t));
  if (next) {
    save.unlocked.push(next);
    save.upgrades[next] = save.upgrades[next] || 1;
    save.shell[UNLOCK_SLOT[next]] = next;
    newUnlock = next;
  }
  return { newBest, newUnlock, distance: d, dew };
}

export function upgradeCost(save, type) {
  const lvl = levelOf(save, type);
  return lvl >= MAX_LEVEL ? null : UPGRADE_COST[lvl];
}

export function canUpgrade(save, type) {
  if (!save.unlocked.includes(type)) return false;
  const cost = upgradeCost(save, type);
  return cost != null && save.dew >= cost;
}

export function upgrade(save, type) {
  if (!canUpgrade(save, type)) return false;
  save.dew -= upgradeCost(save, type);
  save.upgrades[type] = levelOf(save, type) + 1;
  return true;
}

// Shell Builder helpers (GDD §17). Slots may hold any unlocked type; swapping is free.
export function setSlot(save, index, type) {
  if (index < 0 || index > 5 || !save.unlocked.includes(type)) return false;
  save.shell[index] = type;
  return true;
}

export function swapSlots(save, a, b) {
  if (a < 0 || b < 0 || a > 5 || b > 5) return false;
  [save.shell[a], save.shell[b]] = [save.shell[b], save.shell[a]];
  return true;
}
