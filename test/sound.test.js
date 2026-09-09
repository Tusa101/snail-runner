import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/systems/Sound.js';

describe('Sound — procedural SFX', () => {
  test('is a safe no-op without an AudioContext but still logs events', () => {
    const s = new Sound(null);
    assert.equal(s.available, false);
    assert.equal(s.unlock(), false);
    s.krrchak(); s.dew({ streak: 3 }); s.plop();
    assert.deepEqual(s.played, ['krrchak', 'dew', 'plop']);
  });

  test('every recipe builds a graph on a fake AudioContext, mute silences the master gain', () => {
    const calls = [];
    class FakeParam { setValueAtTime(){ return this; } linearRampToValueAtTime(){ return this; } exponentialRampToValueAtTime(){ return this; } }
    class FakeNode { constructor(k){ this.kind=k; this.gain=new FakeParam(); this.frequency=new FakeParam(); this.Q={}; } connect(n){ calls.push(this.kind+'>'+n.kind); return n; } start(){ calls.push('start'); } stop(){} }
    class FakeCtx {
      constructor(){ this.currentTime=0; this.sampleRate=8000; this.state='running'; this.destination=new FakeNode('dest'); }
      createGain(){ return new FakeNode('gain'); } createOscillator(){ return new FakeNode('osc'); } createBiquadFilter(){ return new FakeNode('filter'); }
      createBufferSource(){ return new FakeNode('src'); } createBuffer(){ return { getChannelData(){ return new Float32Array(8000); } }; }
    }
    const s = new Sound(FakeCtx);
    assert.equal(s.unlock(), true);
    for (const n of ['jump','land','dew','hit','crack','krrchak','crunch','crash','boost','lost','plop','milestone','combo','ui']) s.play(n, { streak: 2, count: 3 });
    assert.ok(calls.filter((c) => c === 'start').length >= 14, 'each recipe started at least one source');
    s.setMuted(true);
    assert.equal(s.master.gain.value, 0);
    const before = calls.length;
    s.krrchak();
    assert.equal(calls.length, before, 'muted: nothing scheduled');
  });
});
