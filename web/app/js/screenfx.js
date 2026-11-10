// screenfx.js - screen-wide effects the scripts switch on and off. Pure state and sampling; the renderer draws them.
//
// FADE(40, level, preset) / FADE(41): an RGB split (0x5f420 sets it; 0x2f910 animates it per frame; 0x2fc50 draws
//   each channel of the screen alone, shifted along an angle that swings between -30 and 30 degrees, and lays the
//   result over the screen with the overlay shader, so the picture stays put and the shifted copy tints it).
// FCLN(..., type) / FCSP(ms): speed lines (0x86470 starts and stops; 0x86850 and 0x862e0 make them, using the
//   presets build_effects.py exports from 0x35153c).
// STNS(layer, n): film grain - moving static drawn in the layer's place, through its shape (0x35fc0).
import { crand } from "./random.js";

const FRAME = 1000 / 60;
const frames = (ms) => Math.max(0, Math.floor(ms / FRAME + 1e-7));

// Random numbers from integers, standing in for the engine's own generator (random.js: seeded anew at every launch of the
// game, so it has no sequence to copy): the grain's place and a speed line's angle.
export function random(...n) {
  let h = 0x9e3779b9;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  }
  return (h >>> 0) / 0x100000000;
}

// ---- RGB split ------------------------------------------------------------------------------------------------
// The preset (FADE arg 2) picks the strength and the wobble of the pulse (0x2e430).
const SPLIT = { 6: [2.5, 200], 7: [2.5, 200], 8: [3.5, 200], 9: [3.1, 105], 10: [3.1, 150], 12: [2.5, 200], 13: [1.5, 105] };

// FADE 40 (0x5f420 -> 0x2e3e0 -> 0x2e280). While the split is on (state +0x898 = 4) it keeps its counters and alpha
// and takes the new level and preset; otherwise (off, or fading out after FADE 41) the counters start again and the
// alpha goes on from where it is. A level other than 0 puts the alpha at 1 at once; else it rises 1/60 a frame.
export function startSplit(level, preset, now, prev = null) {
  const alpha = prev ? splitSample(prev, now)?.alpha ?? 0 : 0;
  const on = !!prev && prev.end === null;
  const s = on ? { ...prev } : { kind: "split", start: now, end: null };
  // 0x2e280 keeps the amplitude while the split is on, so a new preset's strength only arrives at 0x2f910's next step,
  // every sixth frame (N2-106): the old preset is used until the step after the change.
  if (on && (preset || 0) !== prev.preset) { s.oldPreset = prev.preset; s.presetAt = now; }
  return Object.assign(s, { level: level || 0, preset: preset || 0, alphaFrom: level ? 1 : alpha, alphaAt: now });
}

export function stopSplit(s, now) {
  if (!s || s.end !== null) return s;
  return { ...s, end: now, endAlpha: splitSample(s, now).alpha };
}

// alpha 0-1; (dx, dy): how far red moves on the screen, in pixels, y down (green moves by -(dx, dy), blue by
// -2(dx, dy)); gain: each channel pass's colour, (255 + level) / 255, which the channel gets twice (splitPixel).
export function splitSample(s, now) {
  if (!s) return null;
  const f = frames(now - s.start);
  let alpha = Math.min(1, (s.alphaFrom ?? 0) + frames(now - (s.alphaAt ?? s.start)) / 60);
  if (s.end !== null) alpha = Math.max(0, s.endAlpha - frames(now - s.end) / 60);
  let preset = s.preset;
  if (s.oldPreset !== undefined && Math.floor(frames(now - s.start) / 6) <= Math.floor(frames(s.presetAt - s.start) / 6)) preset = s.oldPreset;
  const [strength, wobble] = SPLIT[preset] || [3.1, 200];
  // 0x2f910 moves the pulse and the swing on every sixth frame (its counter 0xafebec runs 0-5: `cmp w9, #5; b.lt`).
  // The pulse counter steps by 100 and, past 3333, goes on from c + 100 - 3333 (`sub w8, w9, #0xca1`; listing
  // 0x2faa0-0x2faec); after that first lap the wobble stops.
  const k = Math.floor(f / 6);
  const c = k === 0 ? 0 : (100 * k - 1) % 3333 + 1, first = 100 * k <= 3333;
  const tri = c < 1667 ? c : 3333 - c;
  let pulse = 0.5 - 0.5 * Math.cos(tri * Math.PI / 1666);
  if (first) pulse += wobble / 100 * Math.sin(c * Math.PI / 3333);
  const amp = strength * (pulse * 80 + 20) / 100 * 2;           // the engine works at 960 wide
  const m = k % 40, degrees = m <= 20 ? 30 - 3 * m : -30 + 3 * (m - 20);
  const a = degrees * Math.PI / 180;
  let level = s.level;
  if (s.preset === 16) level = Math.min(0, level + Math.floor(f * 90 * 0.125 / 60));
  return { alpha, dx: Math.cos(a) * amp, dy: -Math.sin(a) * amp, gain: Math.max(0, 255 + level) / 255, level };
}

export const splitDone = (s, now) => !!s && s.end !== null && splitSample(s, now).alpha <= 0;

// One pixel of the split as 0x2fc50 makes it (renderer.js FS_SPLIT does the same on the GPU). Per channel, three
// draws (0xa5690): the screen at (0, 0) into a cleared buffer, the screen moved into the same buffer over it (shader
// `noalpha`, opaque: the unmoved copy shows only where the moved one leaves the screen), then that buffer into the
// split picture; each draw's colour is the channel's mask with (255 + level) in it, so the channel gets gain twice.
// Red moves by (dx, dy), green by -(dx, dy), blue by -2(dx, dy) (checked against the native build's frames, y down).
// The picture goes over the screen with `overlay` (shader table position 31, 0xa2790(0x16)) at the split's alpha:
// mix(b, b < 0.5 ? 2bs : 1 - 2(1 - b)(1 - s), alpha), b the screen, s the split picture. screen(x, y) gives the
// screen's [r, g, b] (0-1) at a point (x right, y down, 0..w by 0..h); x, y: the point drawn.
export const overlay = (b, s) => (b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s));
export function splitPixel(screen, x, y, s, w = 1920, h = 1080) {
  const b = screen(x, y);
  if (!s || s.alpha <= 0) return b;
  const k = s.gain * s.gain;
  const from = (f, c) => {
    const px = x - f * s.dx, py = y - f * s.dy;
    return (px < 0 || py < 0 || px > w || py > h ? b : screen(px, py))[c];
  };
  const v = [from(1, 0), from(-1, 1), from(-2, 2)].map((c) => c * k);
  return b.map((bc, c) => bc + (overlay(bc, v[c]) - bc) * s.alpha);
}

// ---- speed lines ----------------------------------------------------------------------------------------------
// seed: mixed into the lines' angles, which the game draws from its launch-seeded generator (0x862e0 -> 0xa8f90).
export function startLines(type, now, seed = Math.floor(Math.random() * 0x100000000)) {
  return { kind: "lines", type, start: now, end: null, fadeMs: 0, seed };
}

export function stopLines(s, ms, now) {
  if (!s) return null;
  if (!(ms > 0)) return null;
  const r = { ...s, end: now, fadeMs: ms };
  if (BATCH.has(s)) BATCH.set(r, BATCH.get(s));   // the lines on screen stay until the next batch
  return r;
}

// How a line is drawn (0x87150): a 960 x 2 strip of EFFECT_PARTS/FocusLine (1920 x 128) from (u, v) (table
// 0x3527c0 by type), in the 640 x 448 view at x scale sx and y scale 448/1080: 960 sx units long from its start
// point outwards (2880 sx px) and 2 px wide. sx starts at 640/1920 each frame and some types change it by the
// line's angle (a, -32768..32767); a change carries over to the lines after it.
const STRIP = { 6: [0, 10], 7: [0, 40], 10: [0, 30], 18: [850, 120] };
export function lineScale(type, a, sx) {
  const near0 = a >= -7999 && a <= 7999;
  switch (type) {
    case 7: return 2 / 3;
    case 8: return near0 ? 1 / 6 : (a < -27000 || a > 27000) ? 0.4 : sx;
    case 9: case 10: return 0.5;
    case 13: case 19: return 0.4;
    case 15: case 16: case 17: return 0.6;
    case 18: return a < -21000 || a > 21000 ? 0.43333 : sx;
    case 20: return near0 ? 0.4 : sx;
    case 21: case 22: case 23: return a >= -7999 && a < 0 ? 0.4 : sx;
    case 26: case 27: return near0 ? 0.6 : sx;
    case 28: case 29: case 30: case 31: return 0.53333;
    case 32: return a < -27000 || a > 27000 ? 0.53333 : sx;
    default: return sx;
  }
}

// The batch on screen, kept beside the effect (a save holds the type only; a restore starts the lines again):
// { last: the frame of the last batch, counted from FCLN, n: batches so far, x, y, alpha, list: [[angle, distance]] }.
const BATCH = new WeakMap();
// Further behind than this, one batch is made for now: the page slept, or fast forward runs, whose frames are 33 each and make one batch
// apiece (0x86850 gets the step; a batch is due whenever the frames since the last reach the interval).
const LATE = 30;
const batchState = (s) => BATCH.get(s) || (BATCH.set(s, { last: 0, n: 0, list: [] }), BATCH.get(s));
const phaseAt = (phases, t) => { let i = 0; while (i + 1 < phases.length && phases[i + 1][0] <= t) i++; return i; };

// The frame (counted from FCLN) of the next batch: the first one at which the frames since the last batch, as ms, reach
// the row's interval (0x86a6c-0x86ab0): 20, 30 and 32 ms give 2 frames, 50 ms 3; the first batch comes that long after
// FCLN (N2-101).
function nextBatch(s, phases) {
  const st = batchState(s);
  for (let f = st.last + 1; ; f++) {
    const p = phases[phaseAt(phases, f * FRAME)];
    if ((f - st.last) * 1000 / 60 >= p[8] - 1e-9 || f - st.last >= 6000) return f;
  }
}

// The story-clock frame of a batch that has come due by now, or null (effects.js advanceRandom orders it with the sways).
export function linesDue(s, presets, now) {
  const phases = s && presets ? presets[s.type] : null;
  if (!phases || !phases.length) return null;
  const f = nextBatch(s, phases);
  if (f > frames(now - s.start)) return null;
  if (s.end !== null && f * FRAME >= s.end - s.start + s.fadeMs) return null;   // faded out: 0x86850 no longer runs
  return Math.floor(s.start / FRAME + f + 1e-7);
}

// Makes the batch that is due (0x86ab4-0x86b80, each line by 0x862e0). From rand(): the count, first + rand() % |second -
// first| (the upper end never comes out; at most 400, halved for the types under 9), then for each line its distance from
// the centre, the lower end + rand() % |difference|, in 1280-wide units x 0.7. The angle is a random short from the
// engine's other generator. The lines keep the centre and the alpha of the moment they were made.
export function linesBatch(s, presets, now) {
  const phases = presets[s.type], st = batchState(s);
  let f = nextBatch(s, phases);
  if (frames(now - s.start) - f > LATE) f = frames(now - s.start);
  const t = f * FRAME, i = phaseAt(phases, t), p = phases[i], q = phases[i + 1];
  // Alpha moves from this phase's to the next one's.
  let alpha = p[7];
  if (q) alpha += (t - p[0]) * (q[7] - p[7]) / Math.max(1, q[0] - p[0]);
  // the game divides by the span as it is: a span of 0 leaves rand() itself (no row has one)
  const within = (span) => (span ? crand() % span : crand());
  let count = Math.min(400, p[5] + within(Math.abs(p[6] - p[5])));
  if (s.type < 9) count = Math.trunc(count / 2);
  const list = [];
  for (let n = 0; n < count; n++) {
    const a = Math.min(32767, Math.floor(random(s.seed, s.type, st.n + 1, n) * 65536) - 32768);
    list.push([a, Math.min(p[3], p[4]) + within(Math.abs(p[4] - p[3]))]);
  }
  BATCH.set(s, { last: f, n: st.n + 1, x: p[1], y: p[2], alpha, list });
}

// A sample taken without advanceRandom having run for this moment makes its own batches.
function settleLines(s, presets, now) {
  for (let n = 0; n < 100000 && linesDue(s, presets, now) !== null; n++) linesBatch(s, presets, now);
}

// The lines to draw now: centre, start radius, length and width in screen pixels, angle, alpha, picture strip.
export function linesSample(s, presets, now) {
  if (!s || !presets) return [];
  const phases = presets[s.type];
  if (!phases || !phases.length) return [];
  let fade = 1;
  if (s.end !== null) fade = Math.max(0, 1 - (now - s.end) / s.fadeMs);
  if (fade <= 0) return [];
  settleLines(s, presets, now);
  const st = batchState(s);
  const out = [];
  const [u, v] = STRIP[s.type] || [0, 0];
  let sx = 640 / 1920;
  for (const [a, r] of st.list) {
    sx = lineScale(s.type, a, sx);
    out.push({ x: st.x * 1.5, y: st.y * 1.5, angle: a * Math.PI / 32768, radius: r * 0.7 * 1.5,   // 1280-wide units to pixels
      length: 960 * sx * 3, width: 2, u, v, alpha: Math.max(0, Math.min(1, st.alpha / 255)) * fade });
  }
  return out;
}

export const linesDone = (s, now) => !!s && s.end !== null && now - s.end >= s.fadeMs;

// ---- film grain -----------------------------------------------------------------------------------------------
// The noise moves every frame; its orientation steps when its counter passes the period (n <= 2: 3, else 1) and the step
// applies the mod-4 increment twice, so it goes normal, mirrored across, normal ... (0x36014-0x360a0, N2-93): every second
// frame for n > 2, every third for the others.
export function grainSample(n, now) {
  const f = frames(now);
  const steps = n > 2 ? Math.floor(f / 2) : Math.max(0, Math.floor((f - 1) / 3));
  return {
    texture: n % 10 === 2 ? "noisehd1" : "noisehd0",
    x: -random(f, 7) * 160, y: -random(f, 8) * 90,
    // 0x35fc0: the orientation 0 / 2 of the record: mirrored across or not, never up and down
    sx: steps % 2 ? -1 : 1, sy: 1,
  };
}
