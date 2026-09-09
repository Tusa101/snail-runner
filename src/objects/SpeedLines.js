import * as THREE from 'three';
import { rand } from '../utils.js';

// Thin streaks that fly past the camera during Boost.
export class SpeedLines {
  constructor(scene, count = 14) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.lines = [];
    const geo = new THREE.PlaneGeometry(0.05, 3);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      m.rotation.x = -Math.PI / 2;
      this._place(m, true);
      this.group.add(m);
      this.lines.push(m);
    }
    this.intensity = 0;
  }

  _place(m, randomZ = false) {
    const side = Math.random() < 0.5 ? -1 : 1;
    m.position.set(side * rand(2.6, 6), rand(0.4, 5.5), randomZ ? rand(-30, 8) : -30);
  }

  update(dt, active, speed) {
    const target = active ? 1 : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * 8);
    this.mat.opacity = this.intensity * 0.55;
    if (this.intensity < 0.01) return;
    for (const m of this.lines) {
      m.position.z += speed * 3 * dt;
      if (m.position.z > 9) this._place(m);
    }
  }
}
