import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './stubs/dom.js';
import { DEBUG } from '../src/config.js';

// The DOM must exist before Game (and its UI modules) are imported.
const dom = installDom([]);
const { Game } = await import('../src/game/Game.js');

const DT = 1 / 60;
function makeGame() {
  const container = document.getElementById('game');
  const game = new Game(container, dom.storage);
  game.clock.dt = DT;
  return game;
}
function frames(game, n) { for (let i = 0; i < n; i++) game._frame(); }
function seconds(game, s) { frames(game, Math.round(s / DT)); }

// Keep the snail on a lane and spam-collide with a given obstacle type
function plantObstacle(game, type, lane = 1, z = -0.9) {
  const { createObstacle } = game.__obstacleFactory;
  const o = createObstacle(type, game.snail.laneIndex, z);
  game.track.world.add(o.group);
  game.track.obstacles.push(o);
  return o;
}

describe('GDD §30 — game states and screens', () => {
  test('boots into MENU, tap starts a RUN, R restarts', () => {
    const game = makeGame();
    game.start();
    assert.equal(game.state, 'MENU');
    assert.ok(document.getElementById('menu').classList.contains('open'));
    game.input.h.tap();
    assert.equal(game.state, 'RUN');
    assert.ok(!document.getElementById('menu').classList.contains('open'));
    seconds(game, 2);
    assert.ok(game.distance > 20, 'distance accumulates');
    assert.ok(game.renderer.frames > 100, 'frames render');
  });

  test('phone view toggles a body class, persists, and resizes the renderer', () => {
    const game = makeGame();
    game.start();
    let resized = 0; game._resize = () => { resized++; };
    game.setPhoneView(true);
    assert.ok(document.body.classList.contains('phone'));
    assert.equal(dom.storage.getItem('snail-runner-view'), 'phone');
    game.setPhoneView(false);
    assert.ok(!document.body.classList.contains('phone'));
    assert.equal(resized, 2);
  });

  test('plain hits leave the obstacle in place and stumble the snail; only breaks remove it', () => {
    dom.storage.map.clear();
    const game = makeGame();
    game.start(); game.startRun();
    const mod = game.__obstacleFactory; // set by the scenario suite when it runs first; fall back to import
    return (mod ? Promise.resolve(mod) : import('../src/objects/Obstacle.js')).then((m) => {
      const o = m.createObstacle('rock', 1, -0.9);
      game.track.world.add(o.group); game.track.obstacles.push(o);
      frames(game, 6);
      assert.equal(o.hit, true);
      assert.ok(game.track.world.children.includes(o.group), 'rock is still on the road after a plain hit');
      assert.ok(game.slowFactor < 1, 'snail stumbles');
      assert.ok(game.snail.bump > 0.5, 'wheel jolts backward');
    });
  });

  test('menu shows best distance and total dew from the save', () => {
    dom.storage.setItem('snail-runner-save-v1', JSON.stringify({ dew: 540, bestDistance: 1240, runs: 3, unlocked: ['armor', 'jump'], shell: ['armor','armor','jump','armor','armor','armor'], upgrades: {} }));
    const game = makeGame();
    game.start();
    assert.match(document.getElementById('menuBest').textContent, /1240/);
    assert.match(document.getElementById('menuDew').textContent, /540/);
    dom.storage.map.clear();
  });
});

describe('GDD §50 — first test scenario, played headlessly', () => {
  let game;
  before(async () => {
    const mod = await import('../src/objects/Obstacle.js');
    const dewMod = await import('../src/objects/Dew.js');
    dom.storage.map.clear();
    game = makeGame();
    game.__obstacleFactory = mod;
    game.__dewFactory = dewMod;
    game.start();
  });

  test('Run 1: six Armor sectors, no jump; hits break sectors one by one until the slug flops', () => {
    game.startRun();
    assert.deepEqual(game.shellState.slots.map((s) => s.type), Array(6).fill('armor'));
    assert.equal(game.shellState.hasAbility('jump'), false);
    game._onJumpInput();
    assert.equal(game.snail.jumping, false, 'jump input is refused without a Jump sector');

    let destroyedSeen = 0;
    const seen = new Set();
    for (let i = 0; i < 60 && game.state === 'RUN'; i++) {
      const o = plantObstacle(game, 'mushroom');       // 45 dmg per hit
      frames(game, 6);                                   // hit-stop + a few frames
      assert.equal(o.hit, true, 'obstacle registered a hit');
      const snap = game.shellState.snapshot();
      snap.forEach((s) => seen.add(s.state));
      destroyedSeen = snap.filter((s) => s.state === 'destroyed').length;
      seconds(game, 0.4);
    }
    assert.ok(seen.has('damaged') && seen.has('critical'), 'sectors pass through damaged and critical');
    assert.equal(destroyedSeen, 6, 'all six sectors destroyed');
    assert.equal(game.state, 'GAME_OVER');
    assert.ok(game.debris.items.length >= 6, 'detached sector meshes are flying as debris');
    assert.ok(game.sound.played.filter((n) => n === 'krrchak').length >= 6, 'KRR-CHAK per sector');

    // Slug sequence plays out, then RUN OVER appears with stats
    seconds(game, 8);
    assert.ok(document.getElementById('runover').classList.contains('open'), 'RUN OVER screen shown');
    assert.ok(game.sound.played.includes('plop'), 'PLOP on the belly flop');
    assert.match(document.getElementById('overDistance').textContent, /\d+ m/);
    assert.equal(game.save.runs, 1);
    assert.ok(game.save.unlocked.includes('jump'), 'Jump unlocks after the first Game Over');
    assert.equal(game.save.shell[2], 'jump');
    assert.ok(dom.storage.getItem('snail-runner-save-v1'), 'progress persisted to localStorage');
  });

  test('Run 2: Jump works, then the Jump sector breaks and jumping stops mid-run (JUMP LOST)', () => {
    game.startRun();
    assert.equal(game.shellState.hasAbility('jump'), true);
    game._onJumpInput();
    assert.equal(game.snail.jumping, true);
    seconds(game, 1);

    game._applyShellEvents(game.shellState.breakSlot(2));
    assert.equal(game.shellState.hasAbility('jump'), false);
    assert.equal(document.getElementById('toast').textContent, 'JUMP LOST');
    game._onJumpInput();
    assert.equal(game.snail.jumping, false, 'cannot jump after losing the sector');

    game._applyShellEvents(game.shellState.breakAll());
    seconds(game, 8);
    assert.equal(game.save.runs, 2);
    assert.ok(game.save.unlocked.includes('boost'));
  });

  test('Run 3: Boost is +50% speed for 1.5 s with a cooldown; FOV rises; losing the sector cancels it', () => {
    game.startRun();
    seconds(game, 1);
    const before = game.speed;
    assert.equal(game.activateBoost(), true);
    assert.equal(game.boost.active, true);
    seconds(game, 0.8);
    assert.ok(game.speed > before * 1.3, `boost speed ${game.speed} > ${before * 1.3}`);
    assert.ok(game.camera.fov > game.fovBase + 4, 'FOV pushed up during boost');
    seconds(game, 1);
    assert.equal(game.boost.active, false, 'boost ends after 1.5 s');
    assert.equal(game.activateBoost(), false, 'cooldown blocks re-activation');
    seconds(game, 8.1);
    assert.equal(game.activateBoost(), true, 'ready again after cooldown');
    game._applyShellEvents(game.shellState.breakSlot(4));
    assert.equal(game.boost.active, false, 'boost cancelled when its sector dies');
    assert.equal(document.getElementById('toast').textContent, 'BOOST LOST');
    game._applyShellEvents(game.shellState.breakAll());
    seconds(game, 8);
    assert.ok(game.save.unlocked.includes('spike'));
  });

  test('Run 4: Spike smashes a mushroom (CRUNCH) for 15 self-damage, cannot break a Pot, salt slows', () => {
    game.startRun();
    assert.equal(game.shellState.hasAbility('spike'), true);
    const spikeSlot = game.shellState.slots.find((s) => s.type === 'spike');
    const hpBefore = spikeSlot.hp;
    const m = plantObstacle(game, 'mushroom');
    frames(game, 6);
    assert.equal(m.hit, true);
    assert.equal(spikeSlot.hp, hpBefore - 15);
    assert.equal(game.obstaclesDestroyed, 1);
    assert.equal(document.getElementById('toast').textContent, 'CRUNCH');

    const armorHp = () => game.shellState.slots.filter((s) => s.type === 'armor').reduce((a, s) => a + s.hp, 0);
    const a0 = armorHp() + spikeSlot.hp;
    seconds(game, 0.5);
    const pot = plantObstacle(game, 'pot');
    frames(game, 6);
    assert.equal(pot.hit, true);
    assert.equal(game.obstaclesDestroyed, 1, 'plain Spike cannot break a Pot');
    const lost = a0 - (armorHp() + spikeSlot.hp);
    assert.ok(lost >= 85 && lost <= 100, `pot deals up to 100 (capped by the sector's remaining HP): ${lost}`);

    seconds(game, 0.5);
    plantObstacle(game, 'salt');
    frames(game, 6);
    assert.ok(game.slowFactor < 1, 'salt slows the snail');
    seconds(game, 1.2);
    assert.equal(game.slowFactor, 1, 'slow wears off after 1 s');

    game._applyShellEvents(game.shellState.breakAll());
    seconds(game, 8);
    assert.ok(game.save.unlocked.includes('magnet'));
  });

  test('Run 5: RAM MODE — Boost + Spike ploughs through mushroom, rock, mushroom, pot without damage', () => {
    game.startRun();
    const total = () => game.shellState.slots.reduce((a, s) => a + s.hp, 0);
    const t0 = total();
    seconds(game, 0.5);
    assert.equal(game.activateBoost(), true);
    assert.equal(document.getElementById('toast').textContent, 'RAM MODE');
    for (const type of ['mushroom', 'rock', 'mushroom', 'pot']) {
      const o = plantObstacle(game, type);
      frames(game, 5);
      assert.equal(o.hit, true, `${type} was hit`);
    }
    assert.equal(total(), t0, 'no HP lost in RAM MODE');
    assert.equal(game.obstaclesDestroyed, 4);
    assert.equal(document.getElementById('toast').textContent, 'COMBO x4', 'chained breaks show a combo');
    assert.ok(game.sound.played.includes('crash') && game.sound.played.includes('combo'));
    assert.ok(game.dew >= 3 + 3 + 3 + 6, `dew explosion credited: ${game.dew}`);
    const bursting = game.track.dews.filter((d) => d.burst || d.collected).length;
    assert.ok(bursting >= 6, 'dew drops are flying toward the snail');
    seconds(game, 1);
    assert.ok(game.track.dews.every((d) => !d.burst), 'burst phase ends and drops get collected');
  });

  test('Magnet pulls dew from a neighbouring lane; radius doubles during Boost', () => {
    game.startRun();
    assert.equal(game.shellState.hasAbility('magnet'), true);
    game.snail.moveLane(-1); // go to the left lane so the right lane is 4 units away
    seconds(game, 0.4);
    assert.equal(game.snail.x, -2);
    const { createDew } = game.__dewFactory;
    const plant = () => {
      const dew = createDew(2, -0.5); // 4 units over: outside the L1 radius of 3.5
      game.track.world.add(dew.group); game.track.dews.push(dew);
      return dew;
    };
    const far = plant();
    const x0 = far.group.position.x;
    frames(game, 10);
    assert.equal(far.group.position.x, x0, 'two lanes away is outside the level-1 radius');
    const near = createDew(1, -0.5); // 2 units over: inside
    game.track.world.add(near.group); game.track.dews.push(near);
    const nx0 = near.group.position.x;
    frames(game, 10);
    assert.ok(Math.abs(near.group.position.x - game.snail.x) < Math.abs(nx0 - game.snail.x), 'adjacent-lane dew is pulled in');
    // Boost doubles the radius: now the far one moves too
    seconds(game, 0.3);
    const far2 = plant();
    const fx0 = far2.group.position.x;
    assert.equal(game.activateBoost(), true);
    frames(game, 10);
    assert.ok(Math.abs(far2.group.position.x - game.snail.x) < Math.abs(fx0 - game.snail.x), 'vacuum rush reaches two lanes over');
  });

  test('Shell Builder: swap slots, place a palette type, upgrade with dew, run with the new layout', () => {
    game.save.dew = 400;
    game.openShellBuilder();
    assert.equal(game.state, 'SHELL_BUILDER');
    const b = game.builder;
    assert.ok(b.isOpen);
    assert.equal(b.ring.children.length, 6);
    assert.equal(b.palette.children.length, 5, 'all five types unlocked by now');

    // drag slot 1 (spike) onto slot 4 (boost) → swap
    const from = b.ring.children[1], to = b.ring.children[4];
    const before = [...game.save.shell];
    b._onDown({ target: from, clientX: 0, clientY: 0, pointerId: 1, preventDefault() {} });
    b._onMove({ clientX: 50, clientY: 50 });
    dom.setElementAt(to);
    b._onUp({ clientX: 50, clientY: 50 });
    assert.equal(game.save.shell[1], before[4]);
    assert.equal(game.save.shell[4], before[1]);

    // drag palette "magnet" onto slot 0
    const chip = [...b.palette.children].find((c) => c.dataset.type === 'magnet');
    const slot0 = b.ring.children[0];
    b._onDown({ target: chip, clientX: 0, clientY: 0, pointerId: 2, preventDefault() {} });
    b._onMove({ clientX: 40, clientY: 40 });
    dom.setElementAt(slot0);
    b._onUp({ clientX: 40, clientY: 40 });
    assert.equal(game.save.shell[0], 'magnet');

    // tap a slot → info + upgrade
    b._onDown({ target: b.ring.children[0], clientX: 0, clientY: 0, pointerId: 3, preventDefault() {} });
    b._onUp({ clientX: 0, clientY: 0 });
    assert.match(b.info.innerHTML, /MAGNET/);
    const dew0 = game.save.dew;
    document.getElementById('btnUpgrade').click();
    assert.equal(game.save.dew, dew0 - 100);
    assert.equal(game.save.upgrades.magnet, 2);

    // persisted and applied to the next run
    const saved = JSON.parse(dom.storage.getItem('snail-runner-save-v1'));
    assert.equal(saved.shell[0], 'magnet');
    document.getElementById('btnBuilderRun').click();
    assert.equal(game.state, 'RUN');
    assert.equal(game.shellState.slots[0].type, 'magnet');
    assert.equal(game.shellState.slots[0].maxHp, 90, 'level 2 magnet HP');
  });

  test('debug: invulnerability and HP multiplier', () => {
    game.startRun();
    DEBUG.invulnerable = true;
    const total = () => game.shellState.slots.reduce((a, s) => a + s.hp, 0);
    const t0 = total();
    plantObstacle(game, 'pot');
    frames(game, 6);
    assert.equal(total(), t0);
    DEBUG.invulnerable = false;
    DEBUG.sectorHpMul = 2;
    game.applyHpMultiplier();
    assert.equal(game.shellState.slots.find((s) => s.type === 'armor').maxHp, 360);
    DEBUG.sectorHpMul = 1;
    game.applyHpMultiplier();
  });
});

describe('long soak — 3 minutes of random play with no errors or leaks', () => {
  test('objects stay bounded, difficulty tiers spawn every obstacle type', () => {
    dom.storage.map.clear();
    const game = makeGame();
    game.start();
    game.save.unlocked = ['armor', 'jump', 'spike', 'boost', 'magnet'];
    game.save.shell = ['armor', 'spike', 'jump', 'armor', 'boost', 'magnet'];
    DEBUG.invulnerable = true;
    game.startRun();
    const types = new Set();
    for (let i = 0; i < 180 * 60; i++) {
      if (Math.random() < 0.02) game.snail.moveLane(Math.random() < 0.5 ? -1 : 1);
      if (Math.random() < 0.02) game._onJumpInput();
      if (Math.random() < 0.005) game.activateBoost();
      game._frame();
      for (const o of game.track.obstacles) types.add(o.type);
    }
    DEBUG.invulnerable = false;
    assert.equal(game.state, 'RUN');
    for (const t of ['rock', 'mushroom', 'branch', 'salt', 'pot', 'apple', 'bird']) assert.ok(types.has(t), `${t} spawned`);
    assert.ok(game.track.obstacles.length < 60);
    assert.ok(game.track.dews.length < 200);
    assert.ok(game.track.props.length < 400, `props ${game.track.props.length}`);
    assert.ok(game.trail.blobs.length < 80);
    assert.ok(game.debris.items.length < 200);
    assert.ok(game.speed <= 30 * 1.5 + 0.01);
  });
});
