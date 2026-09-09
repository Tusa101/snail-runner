import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mat, damp } from '../utils.js';

let dewGeo = null;
let dewMat = null;

export function createDew(lane, z, y = 0.6, big = false) {
  if (!dewGeo) {
    dewGeo = new THREE.OctahedronGeometry(0.24, 0);
    dewGeo.scale(1, 1.45, 1);
    dewMat = mat(CONFIG.colors.dew, { emissive: 0x1a6f80 });
  }
  const mesh = new THREE.Mesh(dewGeo, dewMat);
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  const scale = big ? 1.7 : 1;
  group.scale.setScalar(scale);
  group.position.set(CONFIG.lanes[lane], y, z);

  const dew = {
    kind: 'dew',
    lane,
    z,
    y,
    value: big ? 5 : 1,
    group,
    mesh,
    collected: false,
    collectT: 0,
    phase: Math.random() * Math.PI * 2,
    target: null,
    burst: null, // { vx, vy, vz, t } — scatter for a moment, then get collected (RAM dew explosion)
    update(dt, t) {
      if (this.burst) {
        const b = this.burst;
        b.t -= dt;
        b.vy -= 20 * dt;
        group.position.x += b.vx * dt;
        group.position.y = Math.max(0.3, group.position.y + b.vy * dt);
        this.z += b.vz * dt;
        mesh.rotation.y += dt * 12;
        if (b.t <= 0) { this.burst = null; this.collected = true; this.y = group.position.y; }
        return;
      }
      if (!this.collected) {
        mesh.rotation.y += dt * 2.2;
        group.position.y = this.y + Math.sin(t * 3 + this.phase) * 0.08;
      } else {
        // fly toward the snail and shrink
        this.collectT += dt / 0.18;
        const k = Math.min(1, this.collectT);
        const tp = this.target;
        group.position.x = damp(group.position.x, tp.x, 30, dt);
        group.position.y = damp(group.position.y, tp.y + 0.8, 30, dt);
        group.position.z = damp(group.position.z, 0.2, 30, dt);
        group.scale.setScalar(scale * (1 - k) * 1.3);
        mesh.rotation.y += dt * 20;
      }
    },
  };
  return dew;
}
