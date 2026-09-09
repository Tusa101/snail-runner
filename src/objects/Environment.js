import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mat, shadowed, rand, pick, randInt } from '../utils.js';

const c = CONFIG.colors;

// Static ground: road, grass planes, distant background shapes. Never moves.
export function createStaticEnvironment(scene) {
  const road = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(7.2, 400), mat(c.road)), false, true);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -150);
  scene.add(road);

  for (const side of [-1, 1]) {
    const grass = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(60, 400), mat(c.grass)), false, true);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(side * 33.5, -0.02, -150);
    scene.add(grass);
    // soft road edge
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 400), mat(0x9dc774));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side * 3.7, 0.005, -150);
    scene.add(edge);
  }

  // Distant blurred plant shapes (parallax backdrop, static)
  for (let i = 0; i < 9; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(rand(6, 11), 7, 5), mat(pick([0x8fcf73, 0x79b862, 0xa3d98a])));
    leaf.scale.set(1, rand(1.4, 2.4), 0.5);
    leaf.position.set(side * rand(8, 26), rand(2, 7), -rand(95, 120));
    scene.add(leaf);
  }
}

// --- Side props (spawned with chunks, move with the world) --------------------

const geos = {};
const g = (k, f) => (geos[k] ||= f());

function grassTuft() {
  const grp = new THREE.Group();
  const n = randInt(3, 5);
  for (let i = 0; i < n; i++) {
    const blade = shadowed(new THREE.Mesh(g('blade', () => new THREE.ConeGeometry(0.16, 1.1, 5)), mat(pick([0x6fae52, 0x85c46a, 0x5f9d45]))));
    blade.position.set(rand(-0.4, 0.4), 0.55, rand(-0.4, 0.4));
    blade.rotation.set(rand(-0.3, 0.3), 0, rand(-0.3, 0.3));
    blade.scale.setScalar(rand(0.8, 1.6));
    grp.add(blade);
  }
  return grp;
}

function flower() {
  const grp = new THREE.Group();
  const h = rand(2.2, 3.6);
  const stem = shadowed(new THREE.Mesh(g('stem', () => new THREE.CylinderGeometry(0.09, 0.14, 1, 6)), mat(0x5f9d45)));
  stem.scale.y = h;
  stem.position.y = h / 2;
  grp.add(stem);
  const head = new THREE.Group();
  head.position.y = h;
  const petalColor = pick([0xf6a5c0, 0xffd166, 0xf28c45, 0xc9a2ff, 0xffffff]);
  for (let i = 0; i < 6; i++) {
    const p = shadowed(new THREE.Mesh(g('petal', () => new THREE.SphereGeometry(0.42, 7, 5)), mat(petalColor)));
    const a = (i / 6) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
    p.scale.set(1.2, 0.35, 0.8);
    p.rotation.y = -a;
    head.add(p);
  }
  const center = shadowed(new THREE.Mesh(g('fcenter', () => new THREE.SphereGeometry(0.34, 8, 6)), mat(0xf2c14e)));
  center.scale.y = 0.6;
  head.add(center);
  head.rotation.x = rand(0.2, 0.5);
  grp.add(head);
  const leaf = shadowed(new THREE.Mesh(g('fleaf', () => new THREE.SphereGeometry(0.5, 6, 4)), mat(0x6fae52)));
  leaf.scale.set(1.6, 0.25, 0.7);
  leaf.position.set(0.7, h * 0.4, 0);
  leaf.rotation.z = 0.5;
  grp.add(leaf);
  return grp;
}

function pebble() {
  const grp = new THREE.Group();
  const n = randInt(1, 3);
  for (let i = 0; i < n; i++) {
    const s = shadowed(new THREE.Mesh(g('pebble', () => new THREE.DodecahedronGeometry(0.45, 0)), mat(pick([0xb9b7a9, 0x9c9a8c, 0xd0cbb8]))));
    s.position.set(rand(-0.6, 0.6), 0.25, rand(-0.6, 0.6));
    s.scale.set(rand(0.6, 1.4), rand(0.5, 0.9), rand(0.6, 1.2));
    s.rotation.set(rand(0, 1), rand(0, 3), 0);
    grp.add(s);
  }
  return grp;
}

function pot() {
  const grp = new THREE.Group();
  const s = rand(1.4, 2.2);
  const body = shadowed(new THREE.Mesh(g('pot', () => new THREE.CylinderGeometry(0.8, 0.6, 1.2, 10)), mat(0xd08a5b)));
  body.position.y = 0.6 * s;
  body.scale.setScalar(s);
  grp.add(body);
  const rim = shadowed(new THREE.Mesh(g('rim', () => new THREE.CylinderGeometry(0.9, 0.9, 0.22, 10)), mat(0xdc9868)));
  rim.position.y = 1.15 * s;
  rim.scale.setScalar(s);
  grp.add(rim);
  const soil = new THREE.Mesh(g('soil', () => new THREE.CylinderGeometry(0.75, 0.75, 0.1, 10)), mat(0x6b4a34));
  soil.position.y = 1.2 * s;
  soil.scale.setScalar(s);
  grp.add(soil);
  const bush = shadowed(new THREE.Mesh(g('bush', () => new THREE.DodecahedronGeometry(0.75, 1)), mat(pick([0x6fae52, 0x85c46a]))));
  bush.position.y = 1.7 * s;
  bush.scale.setScalar(s * 0.9);
  grp.add(bush);
  return grp;
}

function bigLeaf() {
  const grp = new THREE.Group();
  const leaf = shadowed(new THREE.Mesh(g('bigleaf', () => new THREE.SphereGeometry(1, 8, 5)), mat(pick([0x6fae52, 0x8fcf73, 0x5f9d45]))));
  leaf.scale.set(rand(1.6, 2.6), 0.18, rand(0.9, 1.4));
  leaf.position.y = 0.15;
  leaf.rotation.y = rand(0, Math.PI);
  leaf.rotation.z = rand(-0.15, 0.15);
  grp.add(leaf);
  return grp;
}

const PROPS = [
  { make: grassTuft, weight: 6 },
  { make: pebble, weight: 3 },
  { make: bigLeaf, weight: 3 },
  { make: flower, weight: 3 },
  { make: pot, weight: 1 },
];
const totalWeight = PROPS.reduce((s, p) => s + p.weight, 0);

export function createRandomProp() {
  let r = Math.random() * totalWeight;
  for (const p of PROPS) {
    r -= p.weight;
    if (r <= 0) return p.make();
  }
  return grassTuft();
}

// Lane divider dashes that move with the world so speed reads well.
export function createLaneDash(x, z) {
  const m = new THREE.Mesh(g('dash', () => new THREE.PlaneGeometry(0.12, 1.6)), mat(0xc9e69c));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  return m;
}
