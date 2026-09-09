import { DEBUG } from '../config.js';

export class DebugPanel {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('debug');
    this.toggleBtn = document.getElementById('debugToggle');
    this.toggleBtn.addEventListener('click', () => this.toggle());

    for (const input of this.el.querySelectorAll('input[data-key]')) {
      const key = input.dataset.key;
      const label = this.el.querySelector(`[data-val="${key}"]`);
      if (input.type === 'checkbox') input.checked = DEBUG[key]; else input.value = DEBUG[key];
      if (label) label.textContent = String(DEBUG[key]);
      input.addEventListener('input', () => {
        DEBUG[key] = input.type === 'checkbox' ? input.checked : parseFloat(input.value);
        if (label) label.textContent = String(DEBUG[key]);
        if (key === 'dewAmount') game.dew = DEBUG.dewAmount;
        if (key === 'sectorHpMul') game.applyHpMultiplier();
      });
    }

    const actions = {
      damageShell: () => game.debugDamage(40),
      breakSector: () => game.debugBreakSector(),
      activateBoost: () => game.activateBoost(true),
      spawnRam: () => { game.track.forceChunk((c) => c.ram); game.hud.toast('RAM chunk queued', 700); },
      restart: () => game.startRun(),
    };
    for (const btn of this.el.querySelectorAll('button[data-action]')) {
      btn.addEventListener('click', () => { actions[btn.dataset.action](); btn.blur(); });
    }
  }

  toggle() { this.el.classList.toggle('open'); }
}
