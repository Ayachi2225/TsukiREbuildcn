// A Web Audio stand-in for the audio tests: a context whose clock the test moves, gains whose automation can be read
// back at any time (setValueAtTime, linearRampToValueAtTime, cancelScheduledValues), and sources that record how they
// were started and stopped. No sound, no browser.

class Param {
  constructor(ctx, v) { this.ctx = ctx; this.base = v; this.events = []; }
  get value() { return this.at(this.ctx.currentTime); }
  set value(v) { this.base = v; this.events = []; }
  setValueAtTime(v, t) { this.events.push({ ramp: false, v, t }); this.events.sort((a, b) => a.t - b.t); }
  linearRampToValueAtTime(v, t) { this.events.push({ ramp: true, v, t }); this.events.sort((a, b) => a.t - b.t); }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e.t < t); }
  // The value at time t, as Web Audio computes it from the events.
  at(t) {
    let v = this.base, from = -Infinity;
    for (const e of this.events) {
      if (e.t <= t) { v = e.v; from = e.t; continue; }
      if (e.ramp) return from === -Infinity ? e.v : v + ((e.v - v) * (t - from)) / (e.t - from);
      return v;
    }
    return v;
  }
}

export function fakeContext() {
  const ctx = {
    currentTime: 0,
    sources: [],
    state: "running",
    createGain() { return { gain: new Param(ctx, 1), connect(out) { this.out = out; } }; },
    createChannelSplitter(n) { return { n, connect(out) { this.out = out; } }; },
    createChannelMerger(n) { return { n, connect(out) { this.out = out; } }; },
    createBufferSource() {
      const s = {
        buffer: null, loop: false, loopStart: 0, loopEnd: 0, onended: null, listeners: [], started: null, stopped: false,
        connect(out) { this.out = out; },
        start(when, offset) { this.started = { when, offset }; },
        stop() { this.stopped = true; },
        addEventListener(_, f) { this.listeners.push(f); },
        // what the browser does when the sound ends by itself
        end() { this.onended?.(); for (const f of this.listeners) f(); },
      };
      ctx.sources.push(s);
      return s;
    },
  };
  return ctx;
}

// An Audio with the fake context and groups, buffers that load at once, and helpers to read what plays.
export function withContext(audio) {
  const ctx = fakeContext();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.groups = {};
  for (const g of ["bgm", "se", "sys", "voice"]) audio.groups[g] = ctx.createGain();
  // as the converted files are: voices and the voiced effects (SEV_) mono, everything else stereo
  audio.buffer = async (url) => ({ duration: 300, numberOfChannels: /\/voice\/|SEV_/.test(url) ? 1 : 2 });
  audio.applyVolumes();
  // the gain a source plays at (its own gain node, the source's first connection) at time t
  const gainOf = (s, t = ctx.currentTime) => s.out.gain.at(t);
  return { ctx, gainOf };
}
