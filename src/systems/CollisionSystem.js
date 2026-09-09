import { CONFIG } from '../config.js';

// Cheap checks: x distance (works for lane-bound and rolling obstacles),
// overlapping z, and height for jumps.
export class CollisionSystem {
  constructor(game) {
    this.game = game;
    this.snailHalfLen = 0.7;
    this.laneTolerance = 1.0;
  }

  update() {
    const { snail, track } = this.game;
    const sx = snail.x;
    const sy = snail.y;

    for (const o of track.obstacles) {
      if (o.hit || !o.active) continue;
      const ox = o.group.position.x;
      if (Math.abs(sx - ox) > this.laneTolerance) continue;
      if (Math.abs(o.z) > o.def.halfLen + this.snailHalfLen) continue;
      if (o.def.jumpable && sy > o.def.height) continue;
      this.game.onObstacleHit(o);
    }

    for (const d of track.dews) {
      if (d.collected) continue;
      const dx = Math.abs(sx - d.group.position.x);
      if (dx > 0.95) continue;
      if (Math.abs(d.group.position.z) > 0.9) continue;
      if (Math.abs((sy + 0.6) - d.group.position.y) > 1.0) continue;
      this.game.onDewCollect(d);
    }
  }
}
