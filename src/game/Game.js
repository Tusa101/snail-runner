import * as THREE from 'three';
import { CONFIG, DEBUG, SECTOR_TYPES } from '../config.js';
import { ShellState } from '../core/ShellState.js';
import { BoostState } from '../core/BoostState.js';
import { resolveCollision, speedAt, jumpHeightMul, magnetRadius, BOOST, MILESTONES } from '../core/rules.js';
import { loadSave, persistSave, endRun, layoutFrom } from '../core/SaveState.js';
import { Snail } from '../player/Snail.js';
import { TrackManager } from '../track/TrackManager.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { SlimeTrail } from '../objects/SlimeTrail.js';
import { SpeedLines } from '../objects/SpeedLines.js';
import { DebrisSystem } from '../objects/Debris.js';
import { breakObstacle } from '../objects/Obstacle.js';
import { createDew } from '../objects/Dew.js';
import { Sound } from '../systems/Sound.js';
import { createStaticEnvironment } from '../objects/Environment.js';
import { HUD } from '../ui/HUD.js';
import { DebugPanel } from '../ui/DebugPanel.js';
import { ShellBuilder } from '../ui/ShellBuilder.js';
import { damp } from '../utils.js';

const ABILITY_LOST_TEXT = { jump: 'JUMP LOST', spike: 'SPIKES LOST', boost: 'BOOST LOST', magnet: 'MAGNET LOST' };

export class Game {
  constructor(container, storage = globalThis.localStorage) {
    this.container = container;
    this.storage = storage;
    this.save = loadSave(storage);
    this.state = 'MENU';

    this.elapsed = 0; this.distance = 0; this.dew = 0; this.obstaclesDestroyed = 0;
    this.speed = CONFIG.startSpeed;
    this.hitStop = 0; this.shake = 0;
    this.timeScale = 1; this.timeScaleTarget = 1;
    this.slowT = 0; this.slowFactor = 1;
    this.nextMilestone = 0; this.newBestShown = false;
    this.boost = new BoostState();
    this.ramMode = false;
    this.sound = new Sound();
    this.dewStreak = 0; this.dewStreakT = 0;
    this.combo = 0; this.comboT = 0;

    this._initRenderer();
    this._initScene();

    this.shellState = new ShellState(layoutFrom(this.save), { hpMul: DEBUG.sectorHpMul });
    this.snail = new Snail(this.shellState);
    this.scene.add(this.snail.group);
    this.snail.onLand = (x, z) => this._onLand(x, z);

    this.track = new TrackManager(this.scene);
    this.trail = new SlimeTrail(this.scene);
    this.speedLines = new SpeedLines(this.scene);
    this.debris = new DebrisSystem(this.scene);
    this.collision = new CollisionSystem(this);
    this.hud = new HUD();

    const handlers = {
      left: () => this.state === 'RUN' && this.snail.moveLane(-1),
      right: () => this.state === 'RUN' && this.snail.moveLane(1),
      jump: () => this._onJumpInput(),
      boost: () => this.state === 'RUN' && this.activateBoost(),
      restart: () => this.startRun(),
      toggleDebug: () => this.debug.toggle(),
      tap: () => { if (this.state === 'MENU') this.startRun(); },
      back: () => { if (this.state === 'SHELL_BUILDER') this.showMenu(); },
      mute: () => this.toggleMute(),
    };
    for (const k of Object.keys(handlers)) { const fn = handlers[k]; handlers[k] = (...a) => { this.sound.unlock(); return fn(...a); }; }
    this.input = new InputSystem(this.renderer.domElement, handlers);
    this.debug = new DebugPanel(this);
    this.builder = new ShellBuilder(this.save, {
      onRun: () => this.startRun(),
      onBack: () => this.showMenu(),
      onChange: (save) => { persistSave(this.storage, save); this._previewShell(); },
    });
    this._bindScreens();

    window.addEventListener('resize', () => this._resize());
    this.clock = new THREE.Clock();
  }

  // ---------------------------------------------------------------- setup

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    const c = CONFIG.colors;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(c.sky);
    this.scene.fog = new THREE.Fog(c.sky, 45, 115);

    const cam = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.1, 200);
    this.camera.position.set(cam.x, cam.y, cam.z);
    this._resize();

    this.scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x6fa85a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-12, 22, 8);
    sun.target.position.set(0, 0, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -22; s.right = 22; s.top = 30; s.bottom = -30; s.near = 1; s.far = 80;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun); this.scene.add(sun.target);

    createStaticEnvironment(this.scene);
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fovBase = CONFIG.camera.fov + (w < h ? 10 : 0);
    this.camera.fov = this.fovBase;
    this.camera.updateProjectionMatrix();
  }

  _bindScreens() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btnRun', () => this.startRun());
    on('btnShell', () => this.openShellBuilder());
    on('btnRunAgain', () => this.startRun());
    on('btnRebuild', () => this.openShellBuilder());
    on('btnMute', () => this.toggleMute());
    on('btnView', () => this.setPhoneView(!document.body.classList.contains('phone')));
    let phone = false;
    try { phone = this.storage && this.storage.getItem('snail-runner-view') === 'phone'; } catch { /* ignore */ }
    this.setPhoneView(phone);
    // Pause the clock while the tab is hidden so we don't get a giant catch-up step.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); });
  }

  // Desktop-only preview of the portrait phone layout (GDD §26: portrait is the target).
  setPhoneView(on) {
    document.body.classList.toggle('phone', on);
    const b = document.getElementById('btnView');
    if (b) b.textContent = on ? 'LAPTOP VIEW' : 'PHONE VIEW';
    try { this.storage && this.storage.setItem('snail-runner-view', on ? 'phone' : 'laptop'); } catch { /* ignore */ }
    this._resize();
  }

  toggleMute() {
    this.sound.unlock();
    this.sound.setMuted(!this.sound.muted);
    const b = document.getElementById('btnMute');
    if (b) b.textContent = this.sound.muted ? '🔇' : '🔊';
    this.hud.toast(this.sound.muted ? 'MUTED' : 'SOUND ON', 500);
  }

  start() {
    this.showMenu();
    this._frame();
  }

  // ---------------------------------------------------------------- states

  showMenu() {
    this.state = 'MENU';
    this.builder.close();
    this.hud.hideRunOver();
    this.hud.showRunHud(false);
    this.hud.showMenu(this.save);
    this._resetRunObjects();
  }

  openShellBuilder() {
    this.state = 'SHELL_BUILDER';
    this.hud.hideMenu();
    this.hud.hideRunOver();
    this.hud.showRunHud(false);
    this._resetRunObjects();
    this.builder.open(this.save);
  }

  // Rebuild the 3D shell from the current save so edits are visible behind the builder card.
  _previewShell() {
    this.shellState = new ShellState(layoutFrom(this.save), { hpMul: DEBUG.sectorHpMul });
    this.snail.shell.bind(this.shellState);
    this.hud.drawShellMap(this.shellState.snapshot());
  }

  _resetRunObjects() {
    this.shellState = new ShellState(layoutFrom(this.save), { hpMul: DEBUG.sectorHpMul });
    this.snail.shell.bind(this.shellState);
    this.snail.reset();
    this.track.reset();
    this.trail.clear();
    this.debris.clear();
    this.boost.reset();
    this.hud.drawShellMap(this.shellState.snapshot());
  }

  startRun() {
    this.builder.close();
    this.hud.hideMenu();
    this.hud.hideRunOver();
    this.hud.showRunHud(true);
    this._resetRunObjects();
    this.state = 'RUN';
    this.elapsed = 0; this.distance = 0; this.dew = DEBUG.dewAmount; this.obstaclesDestroyed = 0;
    this.speed = CONFIG.startSpeed;
    this.hitStop = 0; this.shake = 0;
    this.timeScale = this.timeScaleTarget = 1;
    this.slowT = 0; this.slowFactor = 1;
    this.nextMilestone = 0; this.newBestShown = false;
    this.ramMode = false;
    this.dewStreak = 0; this.combo = 0; this.comboT = 0;
    this.trail.boostFactor = 1;
    this.hud.toast('GO!', 700);
    this.sound.ui();
  }

  _startGameOver() {
    if (this.state !== 'RUN') return;
    this.state = 'GAME_OVER';
    this._runOverShown = false;
    this.timeScaleTarget = 0.2;   // GDD §11: world slows to ~20%
    this.boost.cancel();
    this.snail.boosting = false;
    this.snail.shell.collapse(this.debris);
    this.snail.enterSlugMode();
    this.hitStop = 0.07;
    this.shake = 1;
    this.sound.krrchak();
  }

  _finishGameOver() {
    const summary = endRun(this.save, { distance: this.distance, dew: this.dew, obstaclesDestroyed: this.obstaclesDestroyed });
    persistSave(this.storage, this.save);
    this.hud.showRunOver(summary);
    if (summary.newUnlock) this.hud.toast(`NEW: ${SECTOR_TYPES[summary.newUnlock].name.toUpperCase()}`, 1500, 'good');
  }

  // ---------------------------------------------------------------- input → abilities

  _onJumpInput() {
    if (this.state === 'MENU') { this.startRun(); return; }
    if (this.state !== 'RUN') return;
    if (!this.shellState.hasAbility('jump')) {
      this.hud.toast('NO JUMP', 400, 'bad');
      this.snail.squashY = 0.85;
      return;
    }
    this.snail.jumpHeightMul = jumpHeightMul(this.shellState.bestLevelOf('jump'), this.shellState.hasHeavyBounce());
    if (this.snail.jump()) this.sound.jump();
  }

  activateBoost(force = false) {
    if (this.state !== 'RUN') return false;
    const available = force || this.shellState.hasAbility('boost');
    if (!available) { this.hud.toast('NO BOOST', 400, 'bad'); return false; }
    const level = Math.max(1, this.shellState.bestLevelOf('boost'));
    const ok = this.boost.activate(true, level);
    if (!ok) return false;
    this.snail.boosting = true;
    this.trail.boostFactor = 1.9;
    const ram = this.shellState.hasAbility('spike');
    this.hud.toast(ram ? 'RAM MODE' : 'BOOST', 700, ram ? 'ram' : 'good');
    this.shake = Math.max(this.shake, 0.3);
    this.sound.boost();
    return true;
  }

  applyHpMultiplier() {
    const wasRunning = this.state === 'RUN';
    this.shellState.hpMul = DEBUG.sectorHpMul;
    this.shellState.repairAll();
    if (wasRunning) { this.snail.shell.reset(); this.hud.drawShellMap(this.shellState.snapshot()); }
  }

  debugDamage(amount) {
    if (this.state !== 'RUN') return;
    this._applyShellEvents(this.shellState.damage(amount));
    this.snail.hitReact(); this.shake = 0.5; this.hitStop = 0.05;
  }

  debugBreakSector() {
    if (this.state !== 'RUN') return;
    const slot = this.shellState.pickHitSlot();
    if (slot) { this._applyShellEvents(this.shellState.breakSlot(slot.index)); this.snail.hitReact(); }
  }

  // ---------------------------------------------------------------- events

  onObstacleHit(o) {
    o.hit = true;
    if (DEBUG.invulnerable) { this._dustPuff(o); return; }

    const res = resolveCollision(o.type, {
      hasSpike: this.shellState.hasAbility('spike'),
      boostActive: this.boost.active,
      damageMul: DEBUG.obstacleDamageMul,
    });

    if (res.outcome === 'break') {
      // GDD §10: the destruction fantasy — big fragments, impulse, hit-stop.
      breakObstacle(o, this.debris, this.boost.active ? 9 : 6);
      this.track.world.remove(o.group);
      this.obstaclesDestroyed += 1;
      this.hitStop = this.boost.active ? 0.03 : 0.045;
      this.shake = Math.max(this.shake, this.boost.active ? 0.55 : 0.45);
      this.snail.squashY = 0.85;
      // Combo: breaks within 1.5 s of each other stack up (GDD §52 Test D feedback)
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = 1.5;
      if (this.combo >= 2) {
        this.hud.toast(`COMBO x${this.combo}`, 500, 'ram');
        this.sound.combo({ count: this.combo });
        this.shake = Math.max(this.shake, 0.4 + this.combo * 0.1);
      } else {
        this.hud.toast(this.boost.active ? 'CRASH' : 'CRUNCH', 350, this.boost.active ? 'ram' : 'good');
      }
      if (this.boost.active) { this.sound.crash(); this._dewExplosion(o); }
      else this.sound.crunch();
      if (res.spikeDamage > 0) this._applyShellEvents(this.shellState.damageType('spike', res.spikeDamage));
      return;
    }

    // Plain hit: the obstacle stays put — the snail is the one that gets knocked.
    this.sound.hit();
    this.hitStop = 0.08;
    this.shake = Math.max(this.shake, 0.8);
    this.snail.hitReact();
    this._dustPuff(o);
    if (res.slow) { this.slowT = res.slow.duration; this.slowFactor = res.slow.factor; }
    else { this.slowT = 0.5; this.slowFactor = 0.45; } // stumble
    this._applyShellEvents(this.shellState.damage(res.shellDamage));
  }

  _dustPuff(o) {
    const pos = new THREE.Vector3();
    o.group.getWorldPosition(pos);
    pos.z += 0.6;
    this.debris.burst(pos, [0xe8f0dc, 0xd8e6c8], 5, 2.5);
  }

  // RAM MODE payoff (GDD §50 run 5): smashed things spray dew that flies to the snail.
  _dewExplosion(o) {
    const n = o.def.heavy ? 6 : 3;
    const pos = new THREE.Vector3();
    o.group.getWorldPosition(pos);
    for (let i = 0; i < n; i++) {
      const d = createDew(o.lane, pos.z, 0.8, false);
      d.group.position.set(pos.x + (Math.random() - 0.5) * 0.6, 0.8, pos.z);
      const a = (i / n) * Math.PI * 2;
      d.burst = { vx: Math.cos(a) * 4, vy: 5 + Math.random() * 3, vz: Math.sin(a) * 2 + 3, t: 0.3 + Math.random() * 0.15 };
      d.target = this.snail;
      this.dew += d.value;
      this.track.world.add(d.group);
      this.track.dews.push(d);
    }
  }

  _removeObstacle(o, power) {
    const pos = new THREE.Vector3();
    o.group.getWorldPosition(pos);
    this.debris.burst(pos, o.debrisColors, 5, power);
    this.track.world.remove(o.group);
  }

  _applyShellEvents(events) {
    if (!events.length) return;
    this.snail.shell.applyEvents(events, this.debris);
    for (const e of events) {
      if (e.type === 'destroyed') {
        this.hitStop = Math.max(this.hitStop, 0.06);
        this.shake = Math.max(this.shake, 0.85);
        this.sound.krrchak();
      } else if (e.type === 'damaged' && e.state !== e.prevState && e.hp > 0) {
        this.sound.crack();
      } else if (e.type === 'abilityLost') {
        this.hud.toast(ABILITY_LOST_TEXT[e.ability], 1100, 'bad');
        this.sound.lost();
        if (e.ability === 'boost') { this.boost.cancel(); this.snail.boosting = false; this.trail.boostFactor = 1; }
      } else if (e.type === 'shellDestroyed') {
        this._startGameOver();
      }
    }
    this.hud.drawShellMap(this.shellState.snapshot());
  }

  onDewCollect(d) {
    d.collected = true;
    d.target = this.snail;
    this.dew += d.value;
    this.dewStreak = this.dewStreakT > 0 ? this.dewStreak + 1 : 0;
    this.dewStreakT = 0.6;
    this.sound.dew({ streak: this.dewStreak });
  }

  _onLand(x, z = 0) {
    this.trail.splash(x, z);
    this.shake = Math.max(this.shake, this.state === 'GAME_OVER' ? 0.5 : 0.15);
    if (this.state === 'GAME_OVER') this.sound.plop(); else this.sound.land();
  }

  // ---------------------------------------------------------------- loop

  _frame() {
    requestAnimationFrame(() => this._frame());
    const realDt = Math.min(this.clock.getDelta(), 0.05);
    let dt = realDt;
    if (this.hitStop > 0) { this.hitStop -= realDt; dt = 0; }
    dt *= DEBUG.gameSpeed;
    this.timeScale = damp(this.timeScale, this.timeScaleTarget, 6, realDt);
    const worldDt = dt * this.timeScale;

    if (this.state === 'RUN') this._updateRun(worldDt);
    else if (this.state === 'GAME_OVER') this._updateGameOver(worldDt, dt);
    else this._updateMenu(realDt); // MENU and SHELL_BUILDER share the idle snail

    this._updateCamera(realDt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateRun(dt) {
    this.elapsed += dt;
    this.boost.update(dt);
    if (!this.boost.active && this.snail.boosting) { this.snail.boosting = false; this.trail.boostFactor = 1; }
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowFactor = 1; }
    if (this.dewStreakT > 0) this.dewStreakT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    const target = speedAt(this.elapsed) * DEBUG.playerSpeed * this.boost.speedMul * this.slowFactor;
    this.speed = damp(this.speed, target, this.boost.active ? 10 : 3, dt);
    this.distance += this.speed * dt;

    this.snail.update(dt, this.speed);
    this.track.update(dt, this.speed, this.elapsed);
    this._updateMagnet(dt);
    this.trail.update(dt, this.speed, this.snail);
    this.speedLines.update(dt, this.boost.active, this.speed);
    this.debris.update(dt, this.speed);
    this.collision.update(dt);

    this.hud.update(this, dt);
    this.hud.setBoost(this.shellState.hasAbility('boost'), this.boost.readiness, this.boost.active);

    if (this.nextMilestone < MILESTONES.length && this.distance >= MILESTONES[this.nextMilestone]) {
      this.hud.toast(`${MILESTONES[this.nextMilestone]} m!`, 1000, 'good');
      this.nextMilestone += 1;
      this.sound.milestone();
    }
    if (!this.newBestShown && this.save.bestDistance > 0 && this.distance > this.save.bestDistance) {
      this.newBestShown = true;
      this.hud.toast('NEW DISTANCE!', 1200, 'good');
      this.sound.milestone();
    }
  }

  _updateMagnet(dt) {
    const level = this.shellState.bestLevelOf('magnet');
    if (level < 1) return;
    const radius = magnetRadius(level, this.boost.active);
    const sx = this.snail.x, sy = this.snail.y + 0.6;
    for (const d of this.track.dews) {
      if (d.collected) continue;
      const p = d.group.position;
      const dx = sx - p.x, dz = 0 - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > radius) continue;
      const k = Math.min(1, dt * (this.boost.active ? 14 : 8));
      p.x += dx * k;
      d.y += (sy - d.y) * k;
      d.z += dz * k * 0.5;
    }
  }

  _updateGameOver(worldDt, dt) {
    // The world crawls; the slug moves at real speed so the flop stays snappy.
    this.track.update(worldDt, this.speed, this.elapsed);
    this.debris.update(dt, this.speed * this.timeScale);
    this.trail.update(worldDt, this.speed, this.snail);
    this.speedLines.update(dt, false, this.speed);
    const done = this.snail.update(dt, this.speed * this.timeScale);
    if (done && !this._runOverShown) {
      this._runOverShown = true;
      this._finishGameOver();
    }
  }

  _updateMenu(dt) {
    // Idle snail in the menu (GDD §31).
    this.snail.update(dt, 4);
    this.trail.update(dt, 0, this.snail);
    this.debris.update(dt, 0);
  }

  _updateCamera(dt) {
    const cam = CONFIG.camera;
    this.shake = Math.max(0, this.shake - dt * 3);
    const k = this.shake * this.shake * 0.35;
    const sx = (Math.random() - 0.5) * k;
    const sy = (Math.random() - 0.5) * k;

    const target = this.snail.group.position.clone();
    if (this.snail.slug) target.add(this.snail.slugBody.position);
    const followX = target.x * 0.3;
    this.camera.position.x = damp(this.camera.position.x, followX, 8, dt) + sx;
    this.camera.position.y = cam.y + target.y * 0.25 + sy;
    this.camera.position.z = cam.z;
    const lookZ = this.state === 'GAME_OVER' ? damp(cam.lookZ, target.z, 1, 1) : cam.lookZ;
    this.camera.lookAt(target.x * 0.4 + sx, cam.lookY + target.y * 0.3, lookZ);

    const speedFov = (this.speed - CONFIG.startSpeed) * 0.35;
    const boostFov = this.boost.active ? BOOST.fovBonus : 0;
    const targetFov = this.fovBase + speedFov + boostFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, targetFov, this.boost.active ? 7 : 4, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
