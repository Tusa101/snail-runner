import { SECTOR_TYPES } from '../config.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class HUD {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.distanceEl = this.$('distance');
    this.dewEl = this.$('dew');
    this.toastEl = this.$('toast');
    this.shellMap = this.$('shellmap');
    this.boostEl = this.$('boost');
    this.boostRing = this.$('boostRing');
    this.hudEl = this.$('hud');
    this._toastTimer = null;
    this._lastDistance = -1;
    this._lastDew = -1;
    this._dewPop = 0;
    this._lastShellKey = '';
  }

  toast(text, ms = 900, cls = '') {
    this.toastEl.textContent = text;
    this.toastEl.className = 'show ' + cls;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toastEl.className = ''; }, ms);
  }

  showRunHud(visible) { this.hudEl.style.display = visible ? '' : 'none'; }

  // Small schematic shell (GDD §29): color per sector, darkens with damage, disappears when destroyed.
  drawShellMap(snapshot) {
    const key = snapshot.map((s) => s.type + s.state).join('|');
    if (key === this._lastShellKey) return;
    this._lastShellKey = key;
    const parts = [];
    snapshot.forEach((s, i) => {
      // Slot 0 (front) at the top; clockwise like the logical zones.
      const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2 - Math.PI / 6;
      const a1 = a0 + Math.PI / 3;
      const r = 42, ri = 12;
      const p = (a, rr) => `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
      const opacity = { healthy: 1, damaged: 0.7, critical: 0.4, destroyed: 0 }[s.state];
      parts.push(`<path d="M${p(a0, ri)} L${p(a0, r)} A${r},${r} 0 0 1 ${p(a1, r)} L${p(a1, ri)} A${ri},${ri} 0 0 0 ${p(a0, ri)} Z" fill="${hex(SECTOR_TYPES[s.type].color)}" stroke="rgba(255,255,255,0.85)" stroke-width="2" opacity="${opacity}"/>`);
    });
    this.shellMap.innerHTML = parts.join('');
  }

  setBoost(available, readiness, active) {
    if (!available) {
      this.boostEl.classList.add('unavailable');
      this.boostEl.classList.remove('active', 'ready');
      this.boostRing.style.setProperty('--fill', '0');
      return;
    }
    this.boostEl.classList.remove('unavailable');
    this.boostEl.classList.toggle('active', active);
    this.boostEl.classList.toggle('ready', !active && readiness >= 1);
    this.boostRing.style.setProperty('--fill', String(readiness));
  }

  update(game, dt) {
    const d = Math.floor(game.distance);
    if (d !== this._lastDistance) {
      this._lastDistance = d;
      this.distanceEl.textContent = `${d} m`;
    }
    if (game.dew !== this._lastDew) {
      this._lastDew = game.dew;
      this.dewEl.textContent = String(game.dew);
      this._dewPop = 1;
    }
    if (this._dewPop > 0) {
      this._dewPop = Math.max(0, this._dewPop - dt * 6);
      this.dewEl.style.transform = `scale(${1 + this._dewPop * 0.25})`;
    }
  }

  // ---- screens (GDD §11, §31)
  showMenu(save) {
    this.$('menuBest').textContent = `BEST: ${save.bestDistance} m`;
    this.$('menuDew').textContent = `DEW: ${save.dew}`;
    this.$('menuStats').textContent = save.runs ? `${save.runs} runs · ${save.obstaclesDestroyed} smashed` : 'Swipe or tap to run';
    this.$('menu').classList.add('open');
  }
  hideMenu() { this.$('menu').classList.remove('open'); }

  showRunOver({ distance, dew, newBest, newUnlock }) {
    this.$('overDistance').textContent = `Distance: ${distance} m`;
    this.$('overDew').textContent = `Dew: ${dew}`;
    this.$('overNote').textContent = newUnlock
      ? `New sector unlocked: ${SECTOR_TYPES[newUnlock].name}`
      : newBest ? 'New best distance!' : '';
    this.$('runover').classList.add('open');
  }
  hideRunOver() { this.$('runover').classList.remove('open'); }
}
