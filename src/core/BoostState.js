import { BOOST, boostCooldown } from './rules.js';

export class BoostState {
  constructor() {
    this.active = false;
    this.timeLeft = 0;
    this.cooldownLeft = 0;
    this.cooldownTotal = boostCooldown(1);
  }

  get ready() { return !this.active && this.cooldownLeft <= 0; }
  get speedMul() { return this.active ? BOOST.speedMul : 1; }
  // 0..1 fill for the HUD ring.
  get readiness() {
    if (this.active) return 1;
    return this.cooldownTotal > 0 ? 1 - this.cooldownLeft / this.cooldownTotal : 1;
  }

  /** @param {boolean} available  whether a living Boost sector exists */
  activate(available, level = 1) {
    if (!available || !this.ready) return false;
    this.active = true;
    this.timeLeft = BOOST.duration;
    this.cooldownTotal = boostCooldown(level);
    this.cooldownLeft = this.cooldownTotal;
    return true;
  }

  // Called when the Boost sector dies mid-boost: boost stops immediately (GDD §13).
  cancel() {
    this.active = false;
    this.timeLeft = 0;
  }

  reset() {
    this.active = false;
    this.timeLeft = 0;
    this.cooldownLeft = 0;
  }

  update(dt) {
    if (this.active) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.active = false; this.timeLeft = 0; }
    }
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
  }
}
