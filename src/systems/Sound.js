// Tiny synth SFX so the prototype needs no audio files. Every sound is built
// from oscillators / filtered noise. Safe to call anywhere: if there's no
// AudioContext (tests, old browsers) every method is a no-op.

const NAMES = ['jump', 'land', 'dew', 'hit', 'crack', 'krrchak', 'crunch', 'crash', 'boost', 'lost', 'plop', 'milestone', 'combo', 'ui'];

export class Sound {
  constructor(AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.ctx = null;
    this.AudioCtx = AudioCtx || null;
    this.muted = false;
    this.volume = 0.5;
    this.played = []; // event log — handy in tests and the debug panel
    this._noise = null;
    for (const n of NAMES) this[n] = (opts) => this.play(n, opts);
  }

  get available() { return !!this.AudioCtx; }

  // Browsers only allow audio after a user gesture — call this from input handlers.
  unlock() {
    if (!this.AudioCtx) return false;
    if (!this.ctx) {
      this.ctx = new this.AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  play(name, opts = {}) {
    this.played.push(name);
    if (this.played.length > 64) this.played.shift();
    if (!this.ctx || this.muted) return;
    const fn = RECIPES[name];
    if (fn) fn(this, opts);
  }

  // ---- building blocks ----------------------------------------------------

  _tone({ type = 'sine', from = 440, to = from, dur = 0.15, gain = 0.3, attack = 0.005, delay = 0 }) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noiseBurst({ dur = 0.2, gain = 0.4, filter = 1200, q = 0.8, type = 'lowpass', delay = 0, sweepTo = null }) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    if (!this._noise) {
      const len = c.sampleRate * 1;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    const src = c.createBufferSource();
    src.buffer = this._noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filter, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}

// Each recipe is a little sound design note. Tweak freely.
const RECIPES = {
  jump: (s) => s._tone({ type: 'triangle', from: 320, to: 720, dur: 0.16, gain: 0.25 }),
  land: (s) => { s._noiseBurst({ dur: 0.08, gain: 0.25, filter: 500 }); s._tone({ type: 'sine', from: 180, to: 90, dur: 0.1, gain: 0.2 }); },
  // Pitch climbs with the pickup streak (opts.streak)
  dew: (s, o) => { const n = Math.min(o.streak || 0, 12); s._tone({ type: 'sine', from: 880 * Math.pow(1.06, n), to: 1320 * Math.pow(1.06, n), dur: 0.09, gain: 0.18 }); },
  hit: (s) => { s._noiseBurst({ dur: 0.12, gain: 0.5, filter: 700 }); s._tone({ type: 'square', from: 120, to: 60, dur: 0.12, gain: 0.25 }); },
  crack: (s) => s._noiseBurst({ dur: 0.05, gain: 0.35, filter: 3000, type: 'highpass' }),
  // KRR-CHAK (GDD §10): grinding noise then a hard click
  krrchak: (s) => {
    s._noiseBurst({ dur: 0.14, gain: 0.55, filter: 2500, q: 2, type: 'bandpass', sweepTo: 600 });
    s._noiseBurst({ dur: 0.06, gain: 0.7, filter: 4000, type: 'highpass', delay: 0.12 });
    s._tone({ type: 'square', from: 200, to: 70, dur: 0.14, gain: 0.35, delay: 0.12 });
  },
  crunch: (s) => { s._noiseBurst({ dur: 0.16, gain: 0.5, filter: 1800, q: 1.5, type: 'bandpass', sweepTo: 300 }); s._tone({ type: 'triangle', from: 300, to: 110, dur: 0.12, gain: 0.3 }); },
  crash: (s) => { s._noiseBurst({ dur: 0.3, gain: 0.7, filter: 3000, sweepTo: 200 }); s._tone({ type: 'sawtooth', from: 220, to: 55, dur: 0.25, gain: 0.35 }); },
  boost: (s) => { s._noiseBurst({ dur: 0.5, gain: 0.3, filter: 400, type: 'highpass', sweepTo: 4000 }); s._tone({ type: 'sawtooth', from: 150, to: 600, dur: 0.4, gain: 0.15 }); },
  // Ability lost: descending minor pair
  lost: (s) => { s._tone({ type: 'square', from: 440, to: 330, dur: 0.18, gain: 0.2 }); s._tone({ type: 'square', from: 330, to: 220, dur: 0.3, gain: 0.2, delay: 0.16 }); },
  // PLOP (GDD §11)
  plop: (s) => { s._tone({ type: 'sine', from: 260, to: 70, dur: 0.22, gain: 0.45 }); s._noiseBurst({ dur: 0.18, gain: 0.3, filter: 350 }); },
  milestone: (s) => { [523, 659, 784, 1047].forEach((f, i) => s._tone({ type: 'triangle', from: f, dur: 0.18, gain: 0.18, delay: i * 0.07 })); },
  combo: (s, o) => { const n = Math.min(o.count || 2, 8); s._tone({ type: 'triangle', from: 500 + n * 90, to: 700 + n * 120, dur: 0.12, gain: 0.22 }); },
  ui: (s) => s._tone({ type: 'sine', from: 600, to: 800, dur: 0.06, gain: 0.15 }),
};
