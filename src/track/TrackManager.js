import * as THREE from 'three';
import { CONFIG, DEBUG } from '../config.js';
import { CHUNKS } from './chunks.js';
import { createObstacle } from '../objects/Obstacle.js';
import { createDew } from '../objects/Dew.js';
import { createRandomProp, createLaneDash } from '../objects/Environment.js';
import { rand, randInt, pick } from '../utils.js';

// The player stays at z≈0. Everything here is spawned at negative z and
// moves toward +z at the world speed, then is removed behind the camera.
export class TrackManager {
  constructor(scene) {
    this.scene = scene;
    this.world = new THREE.Group();
    scene.add(this.world);
    this.obstacles = [];
    this.dews = [];
    this.props = [];
    this.forcedChunk = null;
    this.lastChunkName = null;
    this.time = 0;
    this.reset();
  }

  reset() {
    for (const list of [this.obstacles, this.dews, this.props]) {
      for (const o of list) this.world.remove(o.group);
      list.length = 0;
    }
    this.nextChunkZ = -22; // first chunk starts a little ahead of the snail
    this.time = 0;
    // Fill the initial stretch with decor so the first frame isn't empty
    for (let z = 10; z > -22; z -= 5) this._spawnDecorAt(z, 5);
  }

  // Used by the debug panel "SPAWN RAM TEST"
  forceChunk(predicate) {
    this.forcedChunk = CHUNKS.find(predicate) || null;
  }

  tier(elapsed) {
    if (elapsed < 20) return 0;
    if (elapsed < 40) return 1;
    if (elapsed < 60) return 2;
    return 3;
  }

  update(dt, speed, elapsed) {
    this.time += dt;
    const dz = speed * dt;

    for (const list of [this.obstacles, this.dews, this.props]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        o.z += dz;
        o.group.position.z = o.z;
        if (o.update) o.update(dt, this.time);
        if (o.z > CONFIG.despawnZ || (o.kind === 'dew' && o.collected && o.collectT >= 1)) {
          this.world.remove(o.group);
          list.splice(i, 1);
        }
      }
    }

    this.nextChunkZ += dz;
    while (this.nextChunkZ > CONFIG.spawnAheadZ) {
      this._spawnChunk(elapsed);
    }
  }

  _pickChunk(elapsed) {
    if (this.forcedChunk) {
      const c = this.forcedChunk;
      this.forcedChunk = null;
      return c;
    }
    const tier = this.tier(elapsed);
    const pool = CHUNKS.filter((c) => c.tier <= tier && c.name !== this.lastChunkName);
    return pick(pool);
  }

  _spawnChunk(elapsed) {
    const chunk = this._pickChunk(elapsed);
    this.lastChunkName = chunk.name;
    const start = this.nextChunkZ;
    const len = CONFIG.chunkLength;

    for (const it of chunk.items) {
      const z = start - it.z;
      if (it.t === 'dew') {
        const d = createDew(it.l, z, it.y ?? 0.6, !!it.big);
        this.world.add(d.group);
        this.dews.push(d);
      } else {
        const o = createObstacle(it.t, it.l, z);
        this.world.add(o.group);
        this.obstacles.push(o);
      }
    }

    // Decor for the whole chunk length (+ gap)
    let gap = CONFIG.chunkGap / DEBUG.spawnDensity;
    if (elapsed > 60) gap *= 0.6;
    if (elapsed > 90) gap *= 0.7;
    const total = len + gap;
    for (let z = 0; z < total; z += 5) this._spawnDecorAt(start - z, 5);

    this.nextChunkZ = start - total;
  }

  _spawnDecorAt(z0, span) {
    // lane dashes
    for (const x of [-1, 1]) {
      const dash = createLaneDash(x, z0 - span / 2);
      this._addProp(dash, z0 - span / 2);
    }
    // side props
    for (const side of [-1, 1]) {
      const n = Math.random() < 0.25 ? 0 : randInt(1, 2);
      for (let i = 0; i < n; i++) {
        const p = createRandomProp();
        const z = z0 - rand(0, span);
        p.position.set(side * rand(4.6, 11), 0, z);
        this._addProp(p, z);
      }
    }
  }

  _addProp(group, z) {
    this.world.add(group);
    this.props.push({ kind: 'prop', group, z, update: null });
  }
}
