// Keyboard (A/D/←/→, W/↑/Space, Shift, R, `) and touch (swipe L/R/Up, double tap).
export class InputSystem {
  constructor(element, handlers) {
    this.h = handlers;
    this.swipeThreshold = 28;
    this.doubleTapWindow = 300;
    this._lastTap = 0;
    this._touch = null;

    window.addEventListener('keydown', (e) => this._onKey(e));

    const target = element;
    target.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    target.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });

    // Mouse drag as a fallback for testing swipes on desktop.
    target.addEventListener('mousedown', (e) => { this._touch = { x: e.clientX, y: e.clientY, t: performance.now(), done: false }; });
    target.addEventListener('mouseup', (e) => this._resolveGesture(e.clientX, e.clientY));
  }

  _onKey(e) {
    if (e.repeat) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    switch (e.code) {
      case 'KeyA': case 'ArrowLeft': this.h.left(); break;
      case 'KeyD': case 'ArrowRight': this.h.right(); break;
      case 'KeyW': case 'ArrowUp': case 'Space': e.preventDefault(); this.h.jump(); break;
      case 'ShiftLeft': case 'ShiftRight': this.h.boost(); break;
      case 'KeyR': this.h.restart(); break;
      case 'Escape': if (this.h.back) this.h.back(); break;
      case 'KeyM': if (this.h.mute) this.h.mute(); break;
      case 'Backquote': this.h.toggleDebug(); break;
      default: return;
    }
  }

  _onTouchStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this._touch = { x: t.clientX, y: t.clientY, t: performance.now(), done: false };
  }

  _onTouchEnd(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this._resolveGesture(t.clientX, t.clientY);
  }

  _resolveGesture(x, y) {
    if (!this._touch || this._touch.done) return;
    this._touch.done = true;
    const dx = x - this._touch.x;
    const dy = y - this._touch.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const now = performance.now();

    if (Math.max(adx, ady) >= this.swipeThreshold) {
      if (adx > ady) {
        dx > 0 ? this.h.right() : this.h.left();
      } else if (dy < 0) {
        this.h.jump();
      }
      this._lastTap = 0;
      return;
    }

    // Tap
    if (now - this._lastTap < this.doubleTapWindow) {
      this._lastTap = 0;
      this.h.boost();
    } else {
      this._lastTap = now;
      if (this.h.tap) this.h.tap();
    }
  }
}
