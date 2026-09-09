import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Shell } from './Shell.js';
import { lerp, clamp, damp, easeOutCubic, mat, shadowed } from '../utils.js';

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

    // Slug (Game Over) sequence state
    this.slug = null;

    this.onLand = null;
    this.onJump = null;

    this._build(shellState);
  }

  _build(shellState) {
    const c = CONFIG.colors;
    const bodyMat = mat(c.snailBody);

    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.5, 6, 12), bodyMat));
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.34, 0.15);
    torso.scale.set(1.1, 0.95, 1);
    this.body.add(torso);

    const tail = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 10), bodyMat));
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0.26, 1.25);
    this.body.add(tail);

    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), bodyMat));
    head.position.set(0, 0.46, -0.85);
    head.scale.set(1, 0.9, 1.05);
    this.body.add(head);

    this.eyes = [];
    for (const side of [-1, 1]) {
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(side * 0.17, 0.72, -0.95);
      stalkGroup.rotation.x = -0.45;
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
      this.body.add(stalkGroup);
      this.eyes.push({ stalkGroup, eye, pupil, side });
    }

    this.shell = new Shell(shellState);
    this.shell.group.position.set(0, 0.95, 0.35);
    this.body.add(this.shell.group);
  }

  reset() {
    this.laneIndex = 1;
    this.x = this.fromX = this.toX = 0;
    this.laneT = 1;
    this.y = 0; this.jumping = false; this.jumpT = 0;
    this.tilt = 0; this.squashY = 1; this.hitTimer = 0;
    this.slug = null;
    this.boosting = false;
    this.group.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    for (const e of this.eyes) { e.stalkGroup.rotation.set(-0.45, 0, -e.side * 0.18); e.eye.scale.set(1, 1, 1); }
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

  hitReact() {
    this.hitTimer = 0.35;
    this.squashY = 0.8;
    this.shell.flash();
  }

  // GDD §11: the shell is gone. Kick off the slug flop timeline.
  enterSlugMode() {
    this.slug = { t: 0, phase: 'fly', vz: -9, vy: 6.5, blinked: false };
    this.jumping = false;
  }

  _updateSlug(dt) {
    const s = this.slug;
    s.t += dt;
    if (s.phase === 'fly') {
      s.vy -= 22 * dt;
      this.group.position.y += s.vy * dt;
      this.group.position.z += s.vz * dt;
      this.body.rotation.x = clamp(-s.vy * 0.06, -0.5, 0.5);
      this.squashY = 1.25;
      if (this.group.position.y <= 0) {
        this.group.position.y = 0;
        s.phase = 'flop';
        s.t = 0;
        this.squashY = 0.45;
        if (this.onLand) this.onLand(this.group.position.x, this.group.position.z);
      }
    } else if (s.phase === 'flop') {
      this.body.rotation.x = damp(this.body.rotation.x, 0, 10, dt);
      this.squashY = damp(this.squashY, 0.62, 4, dt); // stays flattened
      for (const e of this.eyes) e.stalkGroup.rotation.x = damp(e.stalkGroup.rotation.x, 1.35, 6, dt); // stalks droop
      if (s.t > 1.0) { s.phase = 'look'; s.t = 0; }
    } else if (s.phase === 'look') {
      // eyes rise slowly and turn toward the camera (+z)
      for (const e of this.eyes) {
        e.stalkGroup.rotation.x = damp(e.stalkGroup.rotation.x, 0.75, 2.2, dt);
        e.stalkGroup.rotation.y = damp(e.stalkGroup.rotation.y, Math.PI, 2.5, dt);
      }
      if (s.t > 1.4 && !s.blinked) {
        s.blinked = true;
        const e = this.eyes[1];
        e.eye.scale.y = 0.08;
        setTimeout(() => { e.eye.scale.y = 1; }, 140);
      }
      if (s.t > 2.4) s.phase = 'done';
    }
    const sx = 1 / Math.sqrt(this.squashY);
    this.body.scale.set(sx, this.squashY, sx);
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
      this.squashY = damp(this.squashY, this.boosting ? 0.9 : 1, 14, dt);
    }

    const targetTilt = clamp(-vx * 0.05, -0.45, 0.45);
    this.tilt = damp(this.tilt, targetTilt, 16, dt);
    this.shellTilt = damp(this.shellTilt, this.tilt, 8, dt);

    if (this.hitTimer > 0) this.hitTimer -= dt;

    this.group.position.set(this.x, this.y, 0);
    this.body.rotation.z = this.tilt;
    this.body.rotation.y = this.tilt * 0.4;
    const sx = 1 / Math.sqrt(this.squashY);
    this.body.scale.set(this.boosting ? sx * 0.95 : sx, this.squashY, this.boosting ? sx * 1.12 : sx);

    const crawl = Math.sin(this.time * speed * 0.9) * 0.02;
    this.body.position.y = crawl;

    if (this.hitTimer > 0) {
      this.body.position.x = (Math.random() - 0.5) * 0.12;
      this.body.rotation.x = (Math.random() - 0.5) * 0.1;
    } else {
      this.body.position.x = 0;
      this.body.rotation.x = this.boosting ? -0.08 : 0;
    }

    const look = this.laneT < 1 ? this.lookDir : Math.sin(this.time * 1.3) * 0.25;
    for (const e of this.eyes) {
      e.stalkGroup.rotation.z = damp(e.stalkGroup.rotation.z, -e.side * 0.18 - look * 0.35, 10, dt);
      e.pupil.position.x = damp(e.pupil.position.x, look * 0.06, 12, dt);
      const fold = this.jumping ? -0.75 : this.boosting ? -1.0 : -0.45 - (speed - CONFIG.startSpeed) * 0.012;
      e.stalkGroup.rotation.x = damp(e.stalkGroup.rotation.x, fold, 8, dt);
    }

    this.shell.update(dt, speed, this.shellTilt - this.tilt);
    return false;
  }
}
