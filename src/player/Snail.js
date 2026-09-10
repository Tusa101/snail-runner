import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Shell, SHELL_RADIUS } from './Shell.js';
import { lerp, clamp, damp, easeOutCubic, mat, shadowed } from '../utils.js';

// During a run the snail is asleep, curled up inside its shell, and the shell
// rolls along the track like a wheel. When the last sector breaks the snail
// wakes up, drops onto the road, looks at you sadly and crawls off the field.
// The snail faces -Z (forward). It stays near the origin; the world moves toward it.
export class Snail {
  /** @param {import('../core/ShellState.js').ShellState} shellState */
  constructor(shellState) {
    this.group = new THREE.Group();

    this.laneIndex = 1;
    this.x = 0; this.fromX = 0; this.toX = 0; this.laneT = 1; this.lookDir = 0;

    this.y = 0; this.jumping = false; this.jumpT = 0; this.jumpHeightMul = 1;

    this.tilt = 0; this.shellTilt = 0; this.squashY = 1; this.hitTimer = 0; this.time = 0;
    this.boosting = false;
    this.bump = 0; // backward jolt on a plain hit

    this.slug = null;
    this.onLand = null;
    this.onJump = null;

    this._build(shellState);
  }

  _build(shellState) {
    const c = CONFIG.colors;
    const bodyMat = mat(c.snailBody);

    // ---- the wheel: shell + sleeper, lifted so the rim touches the ground
    this.body = new THREE.Group();
    this.body.position.y = SHELL_RADIUS;
    this.group.add(this.body);

    this.shell = new Shell(shellState);
    this.body.add(this.shell.group);

    // Sleeping snail curled in the hollow. Doesn't rotate with the shell.
    this.sleeper = new THREE.Group();
    this.body.add(this.sleeper);
    const curl = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), bodyMat));
    curl.scale.set(1.0, 0.85, 1.15);
    curl.position.set(0, -0.1, 0.05);
    this.sleeper.add(curl);
    const snout = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bodyMat));
    snout.position.set(0, -0.05, -0.5);
    snout.scale.set(0.9, 0.8, 1.1);
    this.sleeper.add(snout);
    // Folded stalks with closed eyes (a dark line on a white ball)
    this.sleepEyes = [];
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 0.16, 0.15, -0.55);
      g.rotation.x = 0.9;
      g.rotation.z = -side * 0.5;
      const stalk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.34, 8), bodyMat));
      stalk.position.y = 0.17;
      g.add(stalk);
      const eye = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(0xffffff)));
      eye.position.y = 0.36;
      g.add(eye);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.05), mat(0x1c1c1c));
      lid.position.set(0, 0, -0.11);
      eye.add(lid);
      this.sleeper.add(g);
      this.sleepEyes.push({ g, eye });
    }
    // Zzz bubbles
    this.zzz = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + i * 0.03, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      b.visible = false;
      this.body.add(b);
      this.zzz.push(b);
    }
    this.zzzT = 0;

    // ---- the awake slug (Game Over only): elongated body, head, stalks, eyes
    this.slugBody = new THREE.Group();
    this.slugBody.visible = false;
    this.group.add(this.slugBody);

    const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.5, 6, 12), bodyMat));
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.34, 0.15);
    torso.scale.set(1.1, 0.95, 1);
    this.slugBody.add(torso);
    const tail = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 10), bodyMat));
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0.26, 1.25);
    this.slugBody.add(tail);
    this.tail = tail;
    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), bodyMat));
    head.position.set(0, 0.46, -0.85);
    head.scale.set(1, 0.9, 1.05);
    this.slugBody.add(head);

    this.eyes = [];
    for (const side of [-1, 1]) {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(side * 0.17, 0.72, -0.95);
      stalkGroup.rotation.x = 1.3; // starts drooped (just woke up)
      stalkGroup.rotation.z = -side * 0.18;
      const stalk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.62, 8), bodyMat));
      stalk.position.y = 0.31;
      stalkGroup.add(stalk);
      const eye = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xffffff)));
      eye.position.y = 0.66;
      stalkGroup.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(0x1c1c1c));
      pupil.position.set(0, 0, -0.1);
      eye.add(pupil);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.06), mat(0x1c1c1c));
      lid.position.set(0, 0, -0.14);
      eye.add(lid);
      this.slugBody.add(stalkGroup);
      this.eyes.push({ stalkGroup, eye, pupil, lid, side });
    }
  }

  reset() {
    this.laneIndex = 1;
    this.x = this.fromX = this.toX = 0;
    this.laneT = 1;
    this.y = 0; this.jumping = false; this.jumpT = 0;
    this.tilt = 0; this.shellTilt = 0; this.squashY = 1; this.hitTimer = 0; this.bump = 0;
    this.slug = null;
    this.boosting = false;
    this.group.position.set(0, 0, 0);
    this.body.visible = true;
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.body.position.set(0, SHELL_RADIUS, 0);
    this.sleeper.visible = true;
    this.slugBody.visible = false;
    this.slugBody.position.set(0, 0, 0);
    this.slugBody.rotation.set(0, 0, 0);
    this.slugBody.scale.set(1, 1, 1);
    for (const e of this.eyes) { e.stalkGroup.rotation.set(1.3, 0, -e.side * 0.18); e.eye.scale.set(1, 1, 1); e.lid.visible = true; e.pupil.visible = false; }
    this.shell.reset();
  }

  moveLane(dir) {
    if (this.slug) return false;
    const next = clamp(this.laneIndex + dir, 0, 2);
    if (next === this.laneIndex) return false;
    this.laneIndex = next;
    this.fromX = this.x;
    this.toX = CONFIG.lanes[next];
    this.laneT = 0;
    this.lookDir = dir;
    return true;
  }

  jump() {
    if (this.jumping || this.slug) return false;
    this.jumping = true;
    this.jumpT = 0;
    this.squashY = 1.25;
    if (this.onJump) this.onJump();
    return true;
  }

  // Plain collision: the wheel jolts back and squashes; the obstacle stays where it is.
  hitReact() {
    this.hitTimer = 0.35;
    this.squashY = 0.7;
    this.bump = 1;
    this.shell.flash();
  }

  // GDD §11: the shell is gone. The snail wakes up and drops onto the road.
  enterSlugMode() {
    this.slug = { t: 0, phase: 'drop', vy: 2.5, blinked: false, side: this.x >= 0 ? 1 : -1 };
    this.jumping = false;
    this.sleeper.visible = false;
    this.body.visible = false;
    for (const b of this.zzz) b.visible = false;
    this.slugBody.visible = true;
    this.slugBody.position.set(0, SHELL_RADIUS - 0.4, 0);
    this.slugBody.rotation.set(0.35, 0, 0.25);
    this.squashY = 1.1;
    for (const e of this.eyes) { e.lid.visible = true; e.pupil.visible = false; }
  }

  _updateSlug(dt) {
    const s = this.slug;
    const b = this.slugBody;
    s.t += dt;
    if (s.phase === 'drop') {
      s.vy -= 20 * dt;
      b.position.y += s.vy * dt;
      b.position.z -= 1.5 * dt;
      if (b.position.y <= 0) {
        b.position.y = 0;
        s.phase = 'lie'; s.t = 0;
        this.squashY = 0.5;
        if (this.onLand) this.onLand(this.x, b.position.z);
      }
    } else if (s.phase === 'lie') {
      b.rotation.x = damp(b.rotation.x, 0, 8, dt);
      b.rotation.z = damp(b.rotation.z, 0, 8, dt);
      this.squashY = damp(this.squashY, 0.7, 5, dt);
      if (s.t > 0.9) { s.phase = 'wake'; s.t = 0; }
    } else if (s.phase === 'wake') {
      // stalks rise slowly, eyes open, look at the camera (+z)
      for (const e of this.eyes) {
        e.stalkGroup.rotation.x = damp(e.stalkGroup.rotation.x, 0.6, 2.5, dt);
        e.stalkGroup.rotation.y = damp(e.stalkGroup.rotation.y, Math.PI, 2.5, dt);
        if (s.t > 0.7) { e.lid.visible = false; e.pupil.visible = true; }
      }
      this.squashY = damp(this.squashY, 0.9, 3, dt);
      if (s.t > 1.5 && !s.blinked) {
        s.blinked = true;
        const e = this.eyes[1];
        e.eye.scale.y = 0.08;
        setTimeout(() => { e.eye.scale.y = 1; }, 140);
      }
      if (s.t > 2.3) { s.phase = 'crawl'; s.t = 0; }
    } else if (s.phase === 'crawl') {
      // sadly crawls off the road, stalks drooping forward again
      b.rotation.y = damp(b.rotation.y, -s.side * Math.PI / 2, 3, dt);
      b.position.x += s.side * 1.6 * dt;
      this.tail.scale.z = 1 + Math.sin(s.t * 9) * 0.25;
      this.squashY = 0.9 + Math.sin(s.t * 9) * 0.05;
      for (const e of this.eyes) e.stalkGroup.rotation.y = damp(e.stalkGroup.rotation.y, 0, 2, dt);
      if (s.t > 2.6) s.phase = 'done';
    }
    const sx = 1 / Math.sqrt(this.squashY);
    b.scale.set(sx, this.squashY, sx);
    return s.phase === 'done';
  }

  update(dt, speed) {
    this.time += dt;
    if (this.slug) return this._updateSlug(dt);

    const prevX = this.x;
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / CONFIG.laneChangeTime);
      this.x = lerp(this.fromX, this.toX, easeOutCubic(this.laneT));
    }
    const vx = dt > 0 ? (this.x - prevX) / dt : 0;

    if (this.jumping) {
      this.jumpT += dt / CONFIG.jump.duration;
      const t = this.jumpT;
      if (t >= 1) {
        this.jumping = false;
        this.y = 0;
        this.squashY = 0.72;
        if (this.onLand) this.onLand(this.x, 0);
      } else {
        this.y = CONFIG.jump.height * this.jumpHeightMul * 4 * t * (1 - t);
        this.squashY = t < 0.5 ? lerp(1.25, 1.0, t * 2) : lerp(1.0, 0.92, (t - 0.5) * 2);
      }
    } else {
      this.squashY = damp(this.squashY, this.boosting ? 0.94 : 1, 14, dt);
    }

    // Lean into the turn like a bike
    const targetTilt = clamp(-vx * 0.05, -0.45, 0.45);
    this.tilt = damp(this.tilt, targetTilt, 16, dt);
    this.shellTilt = damp(this.shellTilt, this.tilt, 8, dt);

    if (this.hitTimer > 0) this.hitTimer -= dt;
    this.bump = damp(this.bump, 0, 6, dt);

    this.group.position.set(this.x, this.y, this.bump * 0.9);
    this.body.rotation.z = this.tilt;
    const sy = this.squashY;
    const sx = 1 / Math.sqrt(sy);
    // Squash the wheel vertically, keep it from getting wider along the axle
    this.body.scale.set(1, sy, sx);
    this.body.position.y = SHELL_RADIUS * sy + Math.abs(Math.sin(this.time * speed * 0.35)) * 0.03;

    if (this.hitTimer > 0) {
      this.body.position.x = (Math.random() - 0.5) * 0.12;
    } else {
      this.body.position.x = 0;
    }

    // Sleeper breathes and leans into the roll; stays upright as the shell spins
    this.sleeper.scale.setScalar(1 + Math.sin(this.time * 2.2) * 0.03);
    this.sleeper.rotation.z = -this.tilt * 0.5;
    this.sleeper.rotation.x = this.boosting ? -0.25 : -0.08;

    // Zzz bubbles drift up from the wheel
    this.zzzT += dt;
    this.zzz.forEach((b, i) => {
      const t = (this.zzzT * 0.6 + i * 0.33) % 1;
      b.visible = !this.boosting;
      b.position.set(0.55 + i * 0.12, 0.45 + t * 1.1, -0.2 + i * 0.1);
      b.material.opacity = 0.85 * (1 - t);
      b.scale.setScalar(0.6 + t * 0.8);
    });

    this.shell.update(dt, speed, this.shellTilt - this.tilt);
    return false;
  }
}
