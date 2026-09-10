import * as THREE from 'three';
import { SECTOR_TYPES } from '../config.js';
import { damp, mat, shadowed, rand } from '../utils.js';

// The shell is a wheel: a thick ring standing on its edge (plane y-z, axle along x)
// that rolls forward while the snail sleeps curled up in the hollow middle.
export const SHELL_RADIUS = 1.15;
export const SHELL_INNER = 0.62;
export const SHELL_DEPTH = 0.8;

export function makeWedgeGeometry(index, count = 6, radius = SHELL_RADIUS, depth = SHELL_DEPTH) {
  const gap = 0.04;
  const a0 = (index / count) * Math.PI * 2 + gap;
  const a1 = ((index + 1) / count) * Math.PI * 2 - gap;
  const shape = new THREE.Shape();
  const inner = SHELL_INNER;
  shape.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
  shape.lineTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
  shape.absarc(0, 0, radius, a0, a1, false);
  shape.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
  shape.absarc(0, 0, inner, a1, a0, true);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 2, curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// Per-type silhouette detail so sectors read at a glance (GDD §12).
function addTypeDetail(type, wedge, index) {
  const mid = ((index + 0.5) / 6) * Math.PI * 2;
  const r = (SHELL_RADIUS + SHELL_INNER) / 2;
  const cx = Math.cos(mid) * r, cy = Math.sin(mid) * r;
  const z = SHELL_DEPTH / 2 + 0.06;
  // Face details go on both sides of the wheel so they read from either lane.
  const add = (m) => { m.position.set(cx, cy, z); wedge.add(m); const m2 = m.clone(); m2.position.z = -z; wedge.add(m2); return m; };
  switch (type) {
    case 'spike': {
      for (const off of [-0.2, 0, 0.2]) {
        const s = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 6), mat(0xffffff)));
        const a = mid + off;
        s.position.set(Math.cos(a) * (SHELL_RADIUS + 0.12), Math.sin(a) * (SHELL_RADIUS + 0.12), 0);
        s.rotation.z = a - Math.PI / 2;
        wedge.add(s);
      }
      break;
    }
    case 'jump': {
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10), mat(0xffffff));
      add(spring);
      break;
    }
    case 'boost': {
      // Nozzles on the rim, pointing back-ish out of the tread
      for (const off of [-0.17, 0.17]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 8), mat(0x4a3220));
        const a = mid + off;
        nozzle.position.set(Math.cos(a) * (SHELL_RADIUS + 0.02), Math.sin(a) * (SHELL_RADIUS + 0.02), 0);
        nozzle.rotation.z = a - Math.PI / 2;
        wedge.add(nozzle);
      }
      break;
    }
    case 'magnet': {
      const u = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 10, Math.PI), mat(0xffffff));
      u.rotation.z = mid + Math.PI / 2;
      add(u);
      break;
    }
    default: {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), mat(0xb08650));
      plate.rotation.x = Math.PI / 2;
      add(plate);
    }
  }
}

function makeCrack(index, size) {
  const g = new THREE.Group();
  const mid = ((index + 0.5) / 6) * Math.PI * 2;
  const dark = mat(0x2a1f14);
  const n = size === 'big' ? 4 : 2;
  let r = SHELL_INNER + 0.05, a = mid + rand(-0.2, 0.2);
  for (let i = 0; i < n; i++) {
    const len = rand(0.18, 0.3);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, len, 0.03), dark);
    const r2 = r + len;
    const am = a + rand(-0.25, 0.25);
    seg.position.set(Math.cos(am) * (r + len / 2), Math.sin(am) * (r + len / 2), SHELL_DEPTH / 2 + 0.09);
    seg.rotation.z = am - Math.PI / 2 + rand(-0.3, 0.3);
    g.add(seg);
    r = r2; a = am;
  }
  return g;
}

export class Shell {
  /** @param {import('../core/ShellState.js').ShellState} state */
  constructor(state) {
    this.group = new THREE.Group();
    this.spin = new THREE.Group();
    this.group.add(this.spin);
    this.sectors = [];
    this.flashT = 0;
    this.collapsed = false;
    // Stand the ring on its edge: local z (extrusion axis) becomes world x = the axle.
    this.group.rotation.y = Math.PI / 2;
    this.bind(state);
  }

  bind(state) {
    this.state = state;
    for (const s of this.sectors) this.spin.remove(s.mesh);
    this.sectors = [];
    this.collapsed = false;
    state.slots.forEach((slot, i) => {
      const def = SECTOR_TYPES[slot.type];
      const material = mat(def.color).clone();
      const mesh = shadowed(new THREE.Mesh(makeWedgeGeometry(i), material));
      addTypeDetail(slot.type, mesh, i);
      this.spin.add(mesh);
      this.sectors.push({
        index: i, type: slot.type, mesh, material, baseColor: new THREE.Color(def.color),
        state: 'healthy', crack: null, shake: 0, alive: true,
      });
    });
  }

  reset() {
    this.bind(this.state);
    this.flashT = 0;
  }

  flash() { this.flashT = 0.25; }

  // Reacts to ShellState events (GDD §9-§10).
  applyEvents(events, debris) {
    for (const e of events) {
      if (e.type === 'damaged') this._setState(e.slot, e.state);
      if (e.type === 'destroyed') this._detach(e.slot, debris);
    }
  }

  _setState(i, state) {
    const s = this.sectors[i];
    if (!s.alive || s.state === state) return;
    s.state = state;
    if (s.crack) { s.mesh.remove(s.crack); s.crack = null; }
    if (state === 'damaged') {
      s.crack = makeCrack(i, 'small');
      s.mesh.add(s.crack);
      s.material.color.copy(s.baseColor).multiplyScalar(0.92);
    } else if (state === 'critical') {
      s.crack = makeCrack(i, 'big');
      s.mesh.add(s.crack);
      s.material.color.copy(s.baseColor).multiplyScalar(0.7);
    } else {
      s.material.color.copy(s.baseColor);
    }
  }

  _detach(i, debris, power = 1) {
    const s = this.sectors[i];
    if (!s.alive) return;
    s.alive = false;
    const pos = new THREE.Vector3();
    s.mesh.getWorldPosition(pos);
    // Fly back and up relative to the camera (world moves +z, so +z is "back").
    const vel = new THREE.Vector3(rand(-2, 2), rand(4, 7) * power, rand(5, 9) * power);
    debris.add(s.mesh, vel, 2.6);
    debris.burst(pos, [s.baseColor.getHex(), 0x8c6b3f], 4, 4);
    this.flash();
  }

  // GDD §11: the whole remaining shell falls apart.
  collapse(debris) {
    if (this.collapsed) return;
    this.collapsed = true;
    for (const s of this.sectors) if (s.alive) this._detach(s.index, debris, 1.4);
    const pos = new THREE.Vector3();
    this.group.getWorldPosition(pos);
    debris.burst(pos, [0x8c6b3f, 0xc99b5d], 6, 5);
  }

  update(dt, speed, lag) {
    // Rolls like a wheel (GDD §43): gameplay slots stay logical, only the mesh spins.
    this.spin.rotation.z -= (speed / SHELL_RADIUS) * dt;
    this.group.rotation.x = lag * 1.5; // lean lag (axle tilts slightly behind the body)

    for (const s of this.sectors) {
      if (!s.alive) continue;
      if (s.state === 'critical') {
        s.mesh.position.set((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0);
      }
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / 0.25);
      for (const s of this.sectors) if (s.alive) s.material.emissive.setRGB(k * 0.9, k * 0.9, k * 0.9);
      this.group.position.x = (Math.random() - 0.5) * 0.1;
    } else {
      this.group.position.x = damp(this.group.position.x, 0, 20, dt);
    }
  }
}
