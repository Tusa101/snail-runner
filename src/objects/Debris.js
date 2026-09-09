import * as THREE from 'three';
import { mat, rand, pick } from '../utils.js';

// Small chunks that fly off things (obstacles now, shell sectors in M2).
// Also accepts whole meshes to detach (used for shell sectors later).
export class DebrisSystem {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geos = [
      new THREE.TetrahedronGeometry(0.16, 0),
      new THREE.BoxGeometry(0.18, 0.12, 0.2),
      new THREE.DodecahedronGeometry(0.13, 0),
    ];
  }

  burst(position, colors, count = 6, power = 5) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(pick(this.geos), mat(pick(colors)));
      mesh.castShadow = true;
      mesh.position.copy(position);
      mesh.position.x += rand(-0.3, 0.3);
      mesh.position.y += rand(0, 0.6);
      mesh.scale.setScalar(rand(0.7, 1.5));
      const velocity = new THREE.Vector3(rand(-1, 1) * power * 0.6, rand(0.6, 1.2) * power, rand(0.4, 1.4) * power);
      this.add(mesh, velocity, rand(1.6, 2.6));
    }
  }

  // Detach an existing mesh and let it fly. Reparented to the scene in world space.
  add(mesh, velocity, lifetime = 2.5) {
    if (mesh.parent !== this.scene) {
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      mesh.updateWorldMatrix(true, false);
      mesh.matrixWorld.decompose(pos, quat, scl);
      this.scene.add(mesh);
      mesh.position.copy(pos);
      mesh.quaternion.copy(quat);
      mesh.scale.copy(scl);
    }
    this.items.push({
      mesh,
      velocity,
      angular: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      lifetime,
      maxLife: lifetime,
      gravity: 18,
    });
  }

  update(dt, worldSpeed) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      d.lifetime -= dt;
      d.velocity.y -= d.gravity * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.position.z += worldSpeed * dt; // carried backward with the world
      d.mesh.rotation.x += d.angular.x * dt;
      d.mesh.rotation.y += d.angular.y * dt;
      d.mesh.rotation.z += d.angular.z * dt;
      if (d.mesh.position.y < 0.08) {
        d.mesh.position.y = 0.08;
        d.velocity.y *= -0.35;
        d.velocity.x *= 0.7;
        d.angular.multiplyScalar(0.6);
      }
      if (d.lifetime < 0.4) d.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (d.lifetime <= 0 || d.mesh.position.z > 15) {
        this.scene.remove(d.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const d of this.items) this.scene.remove(d.mesh);
    this.items.length = 0;
  }
}
