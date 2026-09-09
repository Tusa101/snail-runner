import * as THREE from 'three';
import { CONFIG } from '../config.js';

// A trail of transparent flat ellipses that get carried backward with the world.
export class SlimeTrail {
  constructor(scene) {
    this.scene = scene;
    this.blobs = [];
    this.acc = 0;
    this.geo = new THREE.CircleGeometry(0.34, 12);
    this.baseMat = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.slime,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.lifetime = 1.1;
    this.boostFactor = 1;
  }

  _spawn(x, z, scaleX, scaleY, life, opacity) {
    const m = new THREE.Mesh(this.geo, this.baseMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.scale.set(scaleX, scaleY, 1);
    m.renderOrder = 1;
    this.scene.add(m);
    this.blobs.push({ mesh: m, life, maxLife: life, opacity });
  }

  splash(x, z = 0.2) {
    this._spawn(x, z, 1.4, 1.2, 0.6, 0.7);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this._spawn(x + Math.cos(a) * 0.7, z + Math.sin(a) * 0.5, 0.35, 0.35, 0.45, 0.6);
    }
  }

  update(dt, speed, snail) {
    this.acc += dt;
    const interval = 0.14 / (speed / CONFIG.startSpeed);
    if (!snail.jumping && this.acc >= interval) {
      this.acc = 0;
      this._spawn(snail.x, 0.6, 1, 1.5, this.lifetime * this.boostFactor, 0.55);
    }
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.life -= dt;
      b.mesh.position.z += speed * dt;
      const k = Math.max(0, b.life / b.maxLife);
      b.mesh.material.opacity = b.opacity * k;
      if (b.life <= 0 || b.mesh.position.z > 14) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.blobs.splice(i, 1);
      }
    }
  }

  clear() {
    for (const b of this.blobs) { this.scene.remove(b.mesh); b.mesh.material.dispose(); }
    this.blobs.length = 0;
  }
}
