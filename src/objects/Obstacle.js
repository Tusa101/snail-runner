import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { OBSTACLES } from '../core/rules.js';
import { mat, shadowed, rand } from '../utils.js';

const c = CONFIG.colors;
export const OBSTACLE_TYPES = OBSTACLES;

const geoCache = {};
const geo = (key, make) => (geoCache[key] ||= make());

// ---------------------------------------------------------------- builders
// Each builder returns { group, debrisColors, breakParts?: [{mesh, velocity}] }

function buildRock() {
  const g = new THREE.Group();
  const m = shadowed(new THREE.Mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.62, 0)), mat(c.rock)));
  m.position.y = 0.5;
  m.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1));
  m.scale.set(rand(1.1, 1.35), rand(0.8, 1.0), rand(1.0, 1.2));
  g.add(m);
  return { group: g, debrisColors: [c.rock, 0xb9b7a9] };
}

function buildMushroom() {
  const g = new THREE.Group();
  const stem = shadowed(new THREE.Mesh(geo('mstem', () => new THREE.CylinderGeometry(0.22, 0.3, 0.75, 8)), mat(c.mushroomStem)));
  stem.position.y = 0.37;
  g.add(stem);
  const cap = new THREE.Group();
  const capMesh = shadowed(new THREE.Mesh(geo('mcap', () => new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), mat(c.spike)));
  capMesh.scale.set(1.05, 0.85, 1.05);
  cap.add(capMesh);
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(geo('mdot', () => new THREE.SphereGeometry(0.09, 6, 5)), mat(0xffffff));
    const a = rand(0, Math.PI * 2);
    const r = rand(0.25, 0.5);
    dot.position.set(Math.cos(a) * r, Math.sqrt(Math.max(0, 0.38 - r * r * 0.9)) * 0.9, Math.sin(a) * r);
    cap.add(dot);
  }
  cap.position.y = 0.62;
  g.add(cap);
  g.rotation.y = rand(0, Math.PI * 2);
  // GDD §20.2: the cap flies up on destruction
  return { group: g, debrisColors: [c.spike, c.mushroomStem], breakParts: [{ mesh: cap, velocity: new THREE.Vector3(rand(-1, 1), 9, 3) }] };
}

function buildBranch() {
  const g = new THREE.Group();
  const log = shadowed(new THREE.Mesh(geo('branch', () => new THREE.CylinderGeometry(0.18, 0.22, 2.1, 7)), mat(c.branch)));
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.3;
  g.add(log);
  for (const s of [-0.6, 0.5]) {
    const knot = shadowed(new THREE.Mesh(geo('knot', () => new THREE.CylinderGeometry(0.08, 0.11, 0.5, 6)), mat(c.branch)));
    knot.position.set(s, 0.5, rand(-0.15, 0.15));
    knot.rotation.z = rand(-0.4, 0.4);
    g.add(knot);
  }
  const leaf = new THREE.Mesh(geo('leaf', () => new THREE.SphereGeometry(0.18, 6, 4)), mat(0x6fae52));
  leaf.scale.set(1.6, 0.4, 1);
  leaf.position.set(0.9, 0.55, 0.1);
  g.add(leaf);
  return { group: g, debrisColors: [c.branch, 0x6fae52] };
}

function buildSalt() {
  const g = new THREE.Group();
  const patch = new THREE.Mesh(geo('salt', () => new THREE.CircleGeometry(1, 10)), mat(c.salt));
  patch.rotation.x = -Math.PI / 2;
  patch.scale.set(0.9, 1.3, 1);
  patch.position.y = 0.03;
  patch.receiveShadow = true;
  g.add(patch);
  for (let i = 0; i < 6; i++) {
    const grain = new THREE.Mesh(geo('grain', () => new THREE.BoxGeometry(0.16, 0.12, 0.16)), mat(0xffffff));
    grain.position.set(rand(-0.6, 0.6), 0.08, rand(-1, 1));
    grain.rotation.y = rand(0, 1);
    g.add(grain);
  }
  return { group: g, debrisColors: [c.salt] };
}

function buildPot() {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(geo('potbody', () => new THREE.CylinderGeometry(0.62, 0.48, 1.05, 10)), mat(0xd08a5b)));
  body.position.y = 0.52;
  g.add(body);
  const rim = shadowed(new THREE.Mesh(geo('potrim', () => new THREE.CylinderGeometry(0.7, 0.7, 0.2, 10)), mat(0xdc9868)));
  rim.position.y = 1.0;
  g.add(rim);
  const soil = new THREE.Mesh(geo('potsoil', () => new THREE.CylinderGeometry(0.58, 0.58, 0.08, 10)), mat(0x6b4a34));
  soil.position.y = 1.08;
  g.add(soil);
  const sprout = shadowed(new THREE.Mesh(geo('sprout', () => new THREE.DodecahedronGeometry(0.38, 0)), mat(0x85c46a)));
  sprout.position.y = 1.4;
  g.add(sprout);
  return { group: g, debrisColors: [0xd08a5b, 0xdc9868, 0x6b4a34] };
}

function buildApple() {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(geo('apple', () => new THREE.SphereGeometry(0.62, 12, 10)), mat(0xd9483f)));
  body.scale.set(1, 0.92, 1);
  body.position.y = 0.6;
  g.add(body);
  const stalk = new THREE.Mesh(geo('astalk', () => new THREE.CylinderGeometry(0.05, 0.05, 0.35, 5)), mat(0x6b4a34));
  stalk.position.set(0, 1.25, 0);
  g.add(stalk);
  const leaf = new THREE.Mesh(geo('aleaf', () => new THREE.SphereGeometry(0.2, 6, 4)), mat(0x6fae52));
  leaf.scale.set(1.5, 0.35, 0.8);
  leaf.position.set(0.15, 1.25, 0);
  g.add(leaf);
  return { group: g, debrisColors: [0xd9483f], body };
}

function buildBird() {
  const g = new THREE.Group();
  const shadow = new THREE.Mesh(geo('bshadow', () => new THREE.CircleGeometry(0.9, 14)), new THREE.MeshBasicMaterial({ color: 0x2f3a2a, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);
  const bird = new THREE.Group();
  const body = shadowed(new THREE.Mesh(geo('bbody', () => new THREE.SphereGeometry(0.45, 10, 8)), mat(0x5a6d8a)));
  body.scale.set(1, 0.8, 1.3);
  bird.add(body);
  const beak = shadowed(new THREE.Mesh(geo('bbeak', () => new THREE.ConeGeometry(0.16, 0.5, 6)), mat(0xf2c14e)));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.05, -0.7);
  bird.add(beak);
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = shadowed(new THREE.Mesh(geo('bwing', () => new THREE.BoxGeometry(1.1, 0.08, 0.55)), mat(0x4a5b75)));
    wing.position.set(s * 0.75, 0.1, 0);
    wing.rotation.z = s * 0.3;
    bird.add(wing);
    wings.push({ wing, s });
  }
  bird.position.y = 6;
  g.add(bird);
  return { group: g, debrisColors: [0x5a6d8a], shadow, bird, wings };
}

const BUILDERS = { rock: buildRock, mushroom: buildMushroom, branch: buildBranch, salt: buildSalt, pot: buildPot, apple: buildApple, bird: buildBird };

// ---------------------------------------------------------------- factory

export function createObstacle(type, lane, z) {
  const def = OBSTACLES[type];
  if (!def) throw new Error(`Unknown obstacle type: ${type}`);
  const built = BUILDERS[type]();
  const group = built.group;
  group.position.set(CONFIG.lanes[lane], 0, z);

  const o = {
    kind: 'obstacle',
    type,
    def,
    lane,
    z,
    group,
    hit: false,
    active: true,       // dynamic obstacles toggle this while they're not a hazard
    persistent: false,  // salt stays on the ground after a hit
    debrisColors: built.debrisColors,
    breakParts: built.breakParts || [],
    update: null,
  };

  if (type === 'salt') o.persistent = true;

  if (type === 'apple') {
    // Rolls across all three lanes, entering from a random side (GDD §20.6).
    const dir = lane === 0 ? 1 : -1;
    group.position.x = CONFIG.lanes[lane] - dir * 5;
    const crossSpeed = 5.5;
    o.update = (dt) => {
      if (o.z < -40) return; // wait until it's on screen
      group.position.x += dir * crossSpeed * dt;
      built.body.rotation.z -= dir * crossSpeed * dt / 0.62;
    };
  }

  if (type === 'bird') {
    // Shadow first, beak strikes after 0.8 s (GDD §20.7).
    let t = -1;
    o.active = false;
    built.bird.visible = false;
    o.update = (dt) => {
      if (t < 0) { if (o.z > -30) t = 0; else return; }
      t += dt;
      const s = built.shadow;
      s.scale.setScalar(1 + Math.sin(t * 12) * 0.08);
      if (t > 0.55) built.bird.visible = true;
      if (t < 0.8) {
        built.bird.position.y = 6 - (t / 0.8) * 4.8;
      } else if (t < 1.4) {
        built.bird.position.y = 0.9 - Math.sin((t - 0.8) / 0.6 * Math.PI) * 0.3;
        o.active = true;
      } else {
        o.active = false;
        built.bird.position.y = 0.9 + (t - 1.4) * 9;
        s.material.opacity = Math.max(0, 0.35 - (t - 1.4) * 0.6);
      }
      for (const { wing, s: side } of built.wings) wing.rotation.z = side * (0.3 + Math.sin(t * 25) * 0.5);
    };
  }

  return o;
}

// Visual destruction: named parts fly, then a burst of fragments.
export function breakObstacle(o, debris, power = 6) {
  const pos = new THREE.Vector3();
  o.group.getWorldPosition(pos);
  for (const part of o.breakParts) debris.add(part.mesh, part.velocity.clone(), 2.2);
  debris.burst(pos, o.debrisColors, o.def.heavy ? 10 : 6, power);
}
