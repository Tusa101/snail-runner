import { SECTOR_TYPES } from '../config.js';
import { ShellState } from '../core/ShellState.js';
import { setSlot, swapSlots, levelOf, upgradeCost, canUpgrade, upgrade } from '../core/SaveState.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// Synergy blurbs for the info card (GDD §15).
const SYNERGY_TEXT = {
  spike: '+ BOOST → RAM MODE',
  boost: '+ SPIKE → RAM MODE · + MAGNET → VACUUM RUSH',
  jump: 'next to ARMOR → +20% jump',
  armor: 'next to JUMP → +20% jump',
  magnet: '+ BOOST → radius ×2',
};

// Slot positions around the ring (percent of the ring box). Slot 0 = front = top.
const SLOT_POS = [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { left: 50 + Math.cos(a) * 38, top: 50 + Math.sin(a) * 38 };
});

/**
 * One functional screen. Drag from the palette onto a slot to place a type,
 * drag a slot onto another slot to swap. Tap anything for the info card.
 * Works with pointer events, so it's the same code for mouse and touch.
 */
export class ShellBuilder {
  constructor(save, { onRun, onBack, onChange } = {}) {
    this.save = save;
    this.onRun = onRun;
    this.onBack = onBack;
    this.onChange = onChange;
    this.el = document.getElementById('builder');
    this.ring = document.getElementById('builderRing');
    this.palette = document.getElementById('builderPalette');
    this.info = document.getElementById('builderInfo');
    this.dewEl = document.getElementById('builderDew');
    this.selected = null; // { kind: 'slot'|'palette', index?, type }
    this.drag = null;
    this.ghost = document.getElementById('builderGhost');

    document.getElementById('btnBuilderRun').addEventListener('click', () => this.onRun && this.onRun());
    document.getElementById('btnBuilderBack').addEventListener('click', () => this.onBack && this.onBack());
    document.getElementById('btnUpgrade').addEventListener('click', () => this._upgradeSelected());

    this.el.addEventListener('pointerdown', (e) => this._onDown(e));
    this.el.addEventListener('pointermove', (e) => this._onMove(e));
    this.el.addEventListener('pointerup', (e) => this._onUp(e));
    this.el.addEventListener('pointercancel', () => this._endDrag(null));
  }

  open(save) {
    if (save) this.save = save;
    this.el.classList.add('open');
    this.selected = null;
    this.render();
  }

  close() { this.el.classList.remove('open'); }
  get isOpen() { return this.el.classList.contains('open'); }

  render() {
    const s = this.save;
    this.dewEl.textContent = `💧 ${s.dew}`;

    // Slots
    this.ring.innerHTML = '';
    s.shell.forEach((type, i) => {
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = String(i);
      d.style.left = SLOT_POS[i].left + '%';
      d.style.top = SLOT_POS[i].top + '%';
      d.style.background = hex(SECTOR_TYPES[type].color);
      d.innerHTML = `<span>${SECTOR_TYPES[type].name}</span><small>${i === 0 ? 'front' : ''}</small>`;
      if (this.selected && this.selected.kind === 'slot' && this.selected.index === i) d.classList.add('selected');
      this.ring.appendChild(d);
    });

    // Palette (unlocked types)
    this.palette.innerHTML = '';
    for (const type of s.unlocked) {
      const d = document.createElement('div');
      d.className = 'chip';
      d.dataset.type = type;
      d.style.background = hex(SECTOR_TYPES[type].color);
      d.innerHTML = `<span>${SECTOR_TYPES[type].name}</span><small>L${levelOf(s, type)}</small>`;
      if (this.selected && this.selected.kind === 'palette' && this.selected.type === type) d.classList.add('selected');
      this.palette.appendChild(d);
    }

    this._renderInfo();
  }

  _renderInfo() {
    const btn = document.getElementById('btnUpgrade');
    if (!this.selected) {
      this.info.innerHTML = '<div class="tip">Drag a sector onto a slot. Drag slots to swap. Tap for details.</div>';
      btn.style.display = 'none';
      return;
    }
    const type = this.selected.type;
    const def = SECTOR_TYPES[type];
    const lvl = levelOf(this.save, type);
    const hp = def.hp[lvl - 1];
    const cost = upgradeCost(this.save, type);
    const lines = [
      `<div class="name" style="color:${hex(def.color)}">${def.name.toUpperCase()} <small>L${lvl}</small></div>`,
      `<div>HP: ${hp}</div>`,
      `<div>${def.blurb || ''}</div>`,
      `<div class="syn">Synergy: ${SYNERGY_TEXT[type] || '—'}</div>`,
    ];
    this.info.innerHTML = lines.join('');
    if (cost == null) {
      btn.style.display = '';
      btn.textContent = 'MAX LEVEL';
      btn.disabled = true;
    } else {
      btn.style.display = '';
      btn.textContent = `UPGRADE · ${cost} 💧`;
      btn.disabled = !canUpgrade(this.save, type);
    }
  }

  _upgradeSelected() {
    if (!this.selected) return;
    if (upgrade(this.save, this.selected.type)) {
      this._changed();
      this.render();
    }
  }

  _changed() { if (this.onChange) this.onChange(this.save); }

  // ---------------------------------------------------------------- pointer handling

  _hit(target) {
    const slot = target.closest && target.closest('.slot');
    if (slot) return { kind: 'slot', index: Number(slot.dataset.slot), type: this.save.shell[Number(slot.dataset.slot)], el: slot };
    const chip = target.closest && target.closest('.chip');
    if (chip) return { kind: 'palette', type: chip.dataset.type, el: chip };
    return null;
  }

  _onDown(e) {
    const h = this._hit(e.target);
    if (!h) return;
    e.preventDefault();
    this.drag = { from: h, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  }

  _onMove(e) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) > 8) {
      this.drag.moved = true;
      this.ghost.style.display = 'grid';
      this.ghost.style.background = hex(SECTOR_TYPES[this.drag.from.type].color);
      this.ghost.textContent = SECTOR_TYPES[this.drag.from.type].name;
    }
    if (this.drag.moved) {
      this.ghost.style.left = e.clientX + 'px';
      this.ghost.style.top = e.clientY + 'px';
      const over = this._slotAt(e.clientX, e.clientY);
      for (const s of this.ring.children) s.classList.toggle('hover', s === over);
    }
  }

  _slotAt(x, y) {
    this.ghost.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest('.slot') : null;
  }

  _onUp(e) {
    if (!this.drag) return;
    const d = this.drag;
    if (!d.moved) {
      // Tap → select / info
      this.selected = { kind: d.from.kind, index: d.from.index, type: d.from.type };
      this._endDrag(null);
      this.render();
      return;
    }
    const over = this._slotAt(e.clientX, e.clientY);
    this._endDrag(over);
  }

  _endDrag(overSlot) {
    const d = this.drag;
    this.drag = null;
    this.ghost.style.display = 'none';
    for (const s of this.ring.children) s.classList.remove('hover');
    if (!d || !overSlot) return;
    const to = Number(overSlot.dataset.slot);
    let changed = false;
    if (d.from.kind === 'palette') changed = setSlot(this.save, to, d.from.type);
    else if (d.from.kind === 'slot' && d.from.index !== to) changed = swapSlots(this.save, d.from.index, to);
    if (changed) {
      this.selected = { kind: 'slot', index: to, type: this.save.shell[to] };
      this._changed();
      this.render();
    }
  }

  // Preview of what the run would start with (for the 3D snail behind the screen).
  previewState() {
    return new ShellState(this.save.shell.map((type) => ({ type, level: levelOf(this.save, type) })));
  }
}
