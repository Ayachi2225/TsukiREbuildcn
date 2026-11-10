// Shake, quake and sway sampling. A saved effect is plain JSON, and sampling the same game time always gives the same
// result (including while paused). A sway's numbers come from the game's rand() (random.js) as its cycles come due.
import { crandBetween, crandUnit } from "./random.js";
import { linesBatch, linesDue } from "./screenfx.js";

const FRAME = 1000 / 60;
const frames = (ms) => Math.max(0, Math.floor(ms / FRAME + 1e-7)) * FRAME;
const number = (v, fallback) => Number.isFinite(v) ? v : fallback;
const random = (n) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
};

export function makeEffect(kind, args, now, prev = null) {
  const a = (i, fallback) => number(args[i], fallback);
  const e = { kind, start: now, delay: 0, duration: -1, x: 0, y: 0 };
  if (kind === "quake") {
    Object.assign(e, { x: a(0, 15), y: a(1, 15), interval: (a(2, 0) < 0 ? 2 : Math.max(3, Math.floor(a(2, 0) / FRAME) + 2)) * FRAME,
      duration: a(3, -1), delay: frames(a(4, 0)), ramp: frames(a(6, 0)), mode: a(5, 0) });
  } else if (kind === "shake") {
    Object.assign(e, { x: a(0, 0), y: a(1, 15), period: frames(a(2, 300)) || 1000,
      duration: a(3, -1), delay: frames(a(4, 0)), decay: !!a(5, 0), ramp: frames(a(6, 0)), multiplicity: Math.max(1, a(7, 1)) });
  } else if (kind === "sway") {
    // SSW2(layer, a, b, ms, ms, factor, duration, delay) (0x91cf0 -> 0x63520, type 3): the amplitude's two ends and the
    // period's two ends (ms x 3 / 50 whole frames; blank 60 and 120) are kept as given, not sorted: 0x3c970 draws
    // r x (b - a) + a from them.
    Object.assign(e, { amp: [a(0, 7), a(1, 15)], per: [Math.trunc(a(2, 1000) * 3 / 50), Math.trunc(a(3, 2000) * 3 / 50)],
      factor: a(4, 1), duration: a(5, -1), delay: frames(a(6, 0)) });
  } else if (kind === "impact") {
    // SHOK(x, y, ms, count, delay) (0x2ee70, stepped by 0x2ef30): the period in frames is ms x 3 / 50 kept as a float
    // (80 ms = 4.8 frames; 0 counts as 1), the phase steps 2 pi / period a tick, the level falls 1 / (period x count) a
    // tick, and the shake ends after (ms x count x 3) / 50 whole frames (0 at count 0: no shake). A delay waits in a pending
    // slot, taking 16 ms off per tick (the whole-tick division in 0x2ef30), and the shake already running goes on until it
    // runs out (N2-86, N2-87, N2-88, N2-89). Blanks: 300 ms, 3 times (0x5f8f0).
    const ms = a(2, 300), count = a(3, 3), delay = a(4, 0);
    const periodFrames = ms * 3 / 50 || 1, total = Math.trunc(ms * count * 3 / 50);
    Object.assign(e, { x: a(0, 0), y: a(1, 0), periodFrames, count: Math.max(1, count), duration: Math.max(0, total) * FRAME,
      delay: delay > 0 ? Math.ceil(delay / 16) * FRAME : 0, prev: delay > 0 ? prev || null : null });
  } else if (kind === "text") {
    // MSQK(ms = 1000, x = 5, y = 5) (0x77790 'M' "SQK" -> 0x39110; over 10000 ms counts as 1000). Each frame
    // 0x3c970 picks a new offset at random within +-x, +-y until ms has passed.
    const ms = a(0, 1000);
    Object.assign(e, { duration: ms >= 0 && ms <= 10000 ? ms : 1000, x: a(1, 5), y: a(2, 5), interval: FRAME });
  }
  if (e.duration >= 0) e.duration = frames(e.duration);
  if (kind === "sway") SWAY.set(e, { base: 0, axes: [null, null] });
  else e.seed = Math.round(now * 60) ^ Math.round((e.x || 0) * 131 + (e.y || 0) * 17);
  return e;
}

// ---- sway: the game's rand() (TODO item 120) -----------------------------------------------------------------------
// Each axis keeps a timer in frames and the cycle's amplitude and period (record +0x188 / +0x18c for x, +0x18a / +0x18e
// for y, timers +0x172 / +0x194). When the timer passes the period (0x3d1e8: period < timer) it goes back to 0 and
// rand() gives, in this order, a new amplitude, a new period and, the first time only, the sign (0x3d224-0x3d2a8, then
// the same for y at 0x3d504-0x3d584): so a cycle lasts period + 1 frames. SSW2 zeroes all of it (0x63520), so the first
// frame after the command draws all six. 0x3c970 does this for layers 0 to 39 in order, x before y, and then runs the
// speed lines (0x86850), which draw from the same rand(): advanceRandom keeps that order.
// The state is kept beside the effect, not in it: a save holds the command's numbers only (the state block's +0xfa4),
// and what a restore finds is whatever the live record has (0x5baf0 copies the numbers over it; carrySway).
const SWAY = new WeakMap();   // effect -> { base, axes: [x, y] }, an axis { at, period, amplitude, sign }, frames in the effect's own count
const LATE = 3600;            // further behind than this (the page slept), an axis starts again from now
const swayFrame = (e, now) => Math.floor((now - e.start - e.delay) / FRAME + 1e-7);
// Effects saved before item 120 kept sorted ends, the periods in ms.
const swayAmp = (e) => e.amp || [e.min, e.max];
const swayPer = (e) => e.per || [Math.round(e.periodMin / FRAME), Math.round(e.periodMax / FRAME)];
function swayState(e, now) {
  let s = SWAY.get(e);
  // an effect met with no state (one put back by a restore): its record is empty, so the next step draws
  if (!s) SWAY.set(e, s = { base: Math.max(0, swayFrame(e, now) - 1), axes: [null, null] });
  return s;
}
// The frame at which an axis draws anew, when that is no later than now; else null. The numbers are drawn whether or
// not the sway moves anything (a factor of 0), as long as it runs.
function swayDue(e, axis, now) {
  const cur = swayFrame(e, now);
  if (cur < 1) return null;
  const s = swayState(e, now), a = s.axes[axis];
  const f = a ? a.at + Math.max(0, a.period) + 1 : s.base + 1;
  if (f > cur || (e.duration >= 0 && f * FRAME >= e.duration)) return null;
  return cur - f > LATE ? cur : f;
}
function swayDraw(e, axis, f) {
  const s = SWAY.get(e), amp = swayAmp(e), per = swayPer(e);
  const amplitude = crandBetween(amp[0], amp[1]);
  const period = crandBetween(per[0], per[1]);
  const sign = s.axes[axis]?.sign || (crandUnit() < 0.5 ? 1 : -1);
  s.axes[axis] = { at: f, period, amplitude, sign };
}
// One effect by itself (a sample taken without advanceRandom having run for this moment).
function settleSway(e, now) {
  for (let n = 0; n < 100000; n++) {
    const fx = swayDue(e, 0, now), fy = swayDue(e, 1, now);
    if (fx === null && fy === null) return;
    if (fy === null || (fx !== null && fx <= fy)) swayDraw(e, 0, fx); else swayDraw(e, 1, fy);
  }
}
// A restore leaves the live record's cycle as it is (0x5baf0 writes the command's numbers only): the sway put back
// on a layer goes on from the cycle the layer's sway was in, if it had one running.
export function carrySway(to, from, now) {
  if (to?.kind !== "sway" || from?.kind !== "sway" || !SWAY.has(from)) return;
  if (from.duration >= 0 && now >= from.start + from.delay + from.duration) return;
  const s = SWAY.get(from), d = swayFrame(to, now) - swayFrame(from, now);
  SWAY.set(to, { base: s.base + d, axes: s.axes.map((a) => a && { ...a, at: a.at + d }) });
}
// For tests and tools: an axis' cycle as it stands (null before the first draw).
export const swayCycle = (e, axis) => { const a = SWAY.get(e)?.axes[axis]; return a ? { ...a } : null; };

// Draws every number that has come due by now from rand(), in the game's order: frame by frame, the layers' sways by
// layer number (x, then y), then the speed lines' batch (0x3c970, which ends with 0x86850). Called once a frame before
// the layers are sampled; a sample taken without it settles its own effect (settleSway, screenfx.js settleLines).
export function advanceRandom(layers, lines, presets, now) {
  const sways = [];
  for (const l of [...layers].sort((a, b) => a.id - b.id)) {
    const e = l.effects?.oscillation;
    if (e?.kind === "sway" && !sways.includes(e)) sways.push(e);
  }
  for (let n = 0; n < 100000; n++) {
    let best = null, at = Infinity;
    for (const e of sways) for (let axis = 0; axis < 2; axis++) {
      const f = swayDue(e, axis, now);
      if (f === null) continue;
      const g = Math.floor((e.start + e.delay) / FRAME + f + 1e-7);   // the frame on the story's clock
      if (g < at) { at = g; best = [e, axis, f]; }
    }
    const g = linesDue(lines, presets, now);
    if (g !== null && g < at) linesBatch(lines, presets, now);
    else if (best) swayDraw(...best);
    else return;
  }
}

export function effectAlive(e, now) {
  return !!e && (e.kind === "sway" ? e.factor !== 0 && swayAmp(e).some((v) => v !== 0) : e.x !== 0 || e.y !== 0)
    && (e.duration < 0 || now < e.start + e.delay + e.duration);
}

export function effectOffset(e, now) {
  if (e?.kind === "sway") settleSway(e, now);
  if (!effectAlive(e, now)) return [0, 0];
  const t = now - e.start - e.delay;
  if (t < 0) return e.prev ? effectOffset(e.prev, now) : [0, 0];   // a delayed SHOK leaves the one running as it is
  if (e.kind === "impact") {
    // the frames stepped since it started; the first frame shows the first step. Started under fast forward (lead 0), the clock's own
    // step of 33 frames is that first step (vm.js tick)
    const n = Math.floor(t / FRAME + 1e-7) + (e.lead ?? 1);
    const level = Math.max(0, 1 - n / (e.periodFrames * e.count));
    const v = Math.sin(n * 2 * Math.PI / e.periodFrames) * level;
    return [e.x * v, e.y * v];
  }
  let scale = e.ramp ? Math.min(1, t / e.ramp) : 1;
  if ((e.kind === "quake" && !e.ramp || e.decay) && e.duration > 0) scale *= 1 - Math.min(1, t / e.duration);
  if (e.kind === "quake" || e.kind === "text") {
    // a new offset within +-x, +-y each interval, evenly spread (0xa8f70(-1, 1) x the amplitude, from the engine's
    // generator, which is seeded anew at every launch: random.js)
    const frame = Math.floor(t / e.interval);
    return [(random(e.seed + frame * 2) * 2 - 1) * e.x * scale, (random(e.seed + frame * 2 + 1) * 2 - 1) * e.y * scale];
  }
  if (e.kind === "shake") {
    let v = Math.sin(t / e.period * 2 * Math.PI) * scale;
    // Multiplicity above 1: one frame in five (a number from the engine's generator, 0x3d3e4: n % 5 == 0) shows the
    // wave at 1 / multiplicity, the others nothing. One SHK2 in the scripts has one (10).
    if (e.multiplicity > 1) v *= random(e.seed + Math.floor(t / FRAME)) < 0.2 ? 1 / e.multiplicity : 0;
    return [e.x * v, e.y * v];
  }
  if (e.kind === "sway") {
    // sign x amplitude x factor x sin(2 pi timer / period) (0x3d444-0x3d49c, 0x3d59c-0x3d5fc); nothing before the first
    // draw. (A period of 0 divides 0 by 0 in the game; no script's range reaches it.)
    const frameNo = swayFrame(e, now), s = SWAY.get(e);
    return [0, 1].map((axis) => {
      const c = s?.axes[axis];
      if (!c || !c.period) return 0;
      return Math.sin(Math.max(0, frameNo - c.at) * 2 * Math.PI / c.period) * c.amplitude * e.factor * c.sign || 0;
    });
  }
  return [0, 0];
}

export function rebaseEffect(e, fromNow, toNow) { return e ? { ...e, start: e.start - fromNow + toNow } : null; }

// The story's layers are drawn in a 640 x 448 view (draw task 10, 0x3bba0 -> 0x37f50 -> 0x34440): 3 px across and
// 1080 / 448 px down a unit at 1920 x 1080.
export const VIEW_PX = { x: 1920 / 640, y: 1080 / 448 };

// SHOK's offset in pixels: 0x2ef30 gives x x 640/1280 and y x 480/720 view units, and 0x34440 adds it twice to every
// layer's position (and 0x32050 to a panel's clip): 3 px across and 3.21 px down a unit of the script's amplitude.
// (0x3fdd0 also draws the buffers of screen tasks such as XSTP at the offset cut to whole units; the port has none.)
export function impactPixels(e, now) {
  const [dx, dy] = effectOffset(e, now);
  return [2 * dx * 640 / 1280 * VIEW_PX.x || 0, 2 * dy * 480 / 720 * VIEW_PX.y || 0];
}

// A layer's quake, shake and sway (SQK2/STQK, SHK2, SSW2) in pixels: 0x3c970 keeps the amplitude times the wave or a
// random value, and 0x34440 adds a third of it to the layer's position in view units: 1 px across, 0.80 px down.
export function layerEffectPixels(effects, now) {
  let x = 0, y = 0;
  for (const e of Object.values(effects || {})) {
    const [dx, dy] = effectOffset(e, now);
    x += dx; y += dy;
  }
  return [x / 3 * VIEW_PX.x, y / 3 * VIEW_PX.y];
}

// ---- which offsets a layer adds (FIX-CHECKLIST V10) ---------------------------------------------------------------
// 0x3c970 keeps two stored offsets per layer record, the quake slot (+0x184 / +0x18c) and the shake / sway slot
// (+0x188 / +0x190). A quake's offset is drawn at random for each layer on its own (the seed has the layer number,
// vm.js layerEffect); with SQK2's sixth argument (`mode`) not 0, layers 2 and up instead copy, at their own ticks,
// layer 1's stored offset (layer 0's when there is no layer 1 at z other than 0; nothing when neither is there).
function quakeTick(e, now) {
  const t = now - e.start - e.delay;
  return t < 0 ? null : e.start + e.delay + Math.floor(t / e.interval) * e.interval;
}
function storedShift(l, all, now, slot) {
  const e = l?.effects?.[slot];
  if (!e || !effectAlive(e, now)) return [0, 0];
  if (slot === "quake" && e.mode && l.id >= 2) {
    const src = [1, 0].map((i) => all.get(i)).find((s) => s && s.z !== 0);
    const tick = quakeTick(e, now);
    return src?.effects?.quake && tick !== null ? effectOffset(src.effects.quake, tick) : [0, 0];
  }
  return effectOffset(e, now);
}

// 0x34440: what a layer with an effect in that slot adds: an SBAS child, the stored offset of its root-most ancestor
// that has one; a layer linked to a layer that has one, the link's, or nothing when the link is a panel (its clip
// carries the layer, below); otherwise its own.
export function slotShift(l, all, now, slot) {
  if (!l?.effects?.[slot]) return [0, 0];
  // 0x34440 walks the parents or the link only for the quake's slot (the flag 1, listing 0x347cc / 0x348e8): SHK2 and SSW2
  // (flags 2, 3) always add the layer's own offset (N2-92).
  if (slot !== "quake") return storedShift(l, all, now, slot);
  let src = l;
  if (l.parent >= 0 && l.parent !== l.id) {
    for (let p = all.get(l.parent), n = 0; p && n < 40; n++) {
      if (p.effects?.[slot]) src = p;
      p = p.parent >= 0 && p.parent !== p.id ? all.get(p.parent) : null;
    }
  } else if (l.link >= 0 && l.link !== l.id) {
    const k = all.get(l.link);
    if (k?.effects?.[slot]) {
      if (k.clip && k.clip.some(Boolean)) return [0, 0];
      src = k;
    }
  }
  return storedShift(src, all, now, slot);
}

// 0x32050: a panel's clip, and with it the layers linked to it (0x37f50 adds the clip's origin), moves by both stored
// offsets of the panel's root ancestor, or of its link, or its own.
export function clipShift(owner, all, now) {
  let src = owner;
  if (owner.parent >= 0 && owner.parent !== owner.id) {
    for (let p = all.get(owner.parent), n = 0; p && n < 40; n++) {
      src = p;
      p = p.parent >= 0 && p.parent !== p.id ? all.get(p.parent) : null;
    }
  } else if (owner.link >= 0 && owner.link !== owner.id) src = all.get(owner.link) || owner;
  const [qx, qy] = storedShift(src, all, now, "quake"), [ox, oy] = storedShift(src, all, now, "oscillation");
  return [(qx + ox) / 3 * VIEW_PX.x, (qy + oy) / 3 * VIEW_PX.y];
}

// A layer's own quake and shake / sway, in pixels (a third of the stored offsets, as layerEffectPixels).
export function layerShiftPixels(l, all, now) {
  const [qx, qy] = slotShift(l, all, now, "quake"), [ox, oy] = slotShift(l, all, now, "oscillation");
  return [(qx + ox) / 3 * VIEW_PX.x, (qy + oy) / 3 * VIEW_PX.y];
}

// MSQK's text offset in pixels: x x 640/1280 and y x 448/720 view units (0x39110), added to the window's places in
// 0x391a0 as they are: 1.5 px a unit both ways.
export function textShakePixels(e, now) {
  const [dx, dy] = effectOffset(e, now);
  return [dx * 640 / 1280 * VIEW_PX.x, dy * 448 / 720 * VIEW_PX.y];
}

// STRA's heat haze, per layer record (0x645f0 writes it, 0x3c970 runs it each frame, 0x362a0 draws it): n is the
// table entry on screen (record +0x238), start the time its phase counter (+0x23a, whole frames) was 0, ramp a fade-in
// in frames (+0x23c), stop a fade-out's length in frames (+0x23e) and left the frames it had left (+0x240) at leftAt.
// The counter, the fade-in and the fade-out run only while n is 1 or more: the counter wraps at 31416, the fade-in is
// dropped once the counter reaches it, and when the fade-out has run down n and stop become 0.
const whole = (ms) => Math.max(0, Math.floor(ms / FRAME + 1e-7));
export function hazeState(h, now) {
  if (!h || !(h.n >= 1)) return null;
  const f = whole(now - h.start);
  let left = 0;
  if (h.stop >= 1) {
    left = h.left - whole(now - h.leftAt);
    if (left < 1) return null;
  }
  return { n: h.n, phase: f % 31416, ramp: h.ramp > 0 && f < h.ramp ? h.ramp : 0, left };
}

// Brings a record up to now before it is changed: a passed fade-in is dropped, a run-down fade-out ends the haze, and
// the frames a fade-out has left are counted (they stay put while n is 0).
export function settleHaze(h, now) {
  if (!(h.n >= 1)) return h;
  if (h.ramp > 0 && whole(now - h.start) >= h.ramp) h.ramp = 0;
  if (h.stop >= 1) {
    const d = whole(now - h.leftAt);
    h.left -= d;
    h.leftAt += d * FRAME;
    if (h.left < 1) { h.n = 0; h.stop = 0; h.left = 0; }
  }
  return h;
}

// The haze shader's constants (0x362a0 -> 0xb0810: c3[3] for the x shift, c3[4] for y): texture size, amplitude in
// texture pixels (render width / 1024 x strength x p6 x p2 or p5), waves per texture height, and the wave's phase.
// The strength (0-1000) rises with the fade-in over p9 ms, falls with the fade-out, else is full. The shader
// (nexl_nxshader_haze, SPIR-V 33906951eb996a33) then shifts the picture's texture coordinate by
// sin(2pi(fract(phase) + fract(v x waves))) x amplitude / size across and cos(...) down, v being the coordinate down
// the picture for both.
export function hazeConstants(h, entry, now, texW, texH, renderW = 1920, renderH = 1080) {
  const s = hazeState(h, now);
  if (!s || !entry) return null;
  const p = entry;
  let k = 1000;
  // 0x36300-0x36378: with a fade-in, min(phase in ms, p9) x 1000 / p9 (0 when p9 is 0: the NaN converts to 0)
  if (s.ramp) k = Math.trunc(Math.min(Math.trunc(s.phase * 1000 / 60), Math.trunc(p[9])) * 1000 / p[9]) || 0;
  else if (h.stop >= 1) k = Math.trunc(s.left * 1000 / h.stop) || 0;
  const a = renderW / 1024 * 0.001 * k, t = s.phase / 60;
  const frac = (v) => v - Math.trunc(v);   // 0xe21c0
  return {
    x: [texW, a * p[6] * p[2], (p[0] + p[7] * 0.1) * (texH / renderH) * 0.5, frac(p[8] / 3 * (t + p[1]))],
    y: [texH, a * p[6] * p[5], (p[3] + p[7] * 0.1) * (texW / renderW) * 0.5, frac(p[8] / 3 * (t + p[4]))],
  };
}

// The shift the haze shader gives the texture coordinate at v (0 at the picture's top), in texture coordinates.
export function hazeShift(c, v) {
  const fract = (x) => x - Math.floor(x);
  const dx = c.x[0] > 0 ? Math.sin((fract(c.x[3]) + fract(v * c.x[2])) * 2 * Math.PI) * c.x[1] / c.x[0] : 0;
  const dy = c.y[0] > 0 ? Math.cos((fract(c.y[3]) + fract(v * c.y[2])) * 2 * Math.PI) * c.y[1] / c.y[0] : 0;
  return [dx, dy];
}

// STTR's wipe (the layer shader mirrors this): how much of a layer at this alpha shows where the rule picture is
// r (0-1). 0xa7190 passes threshold x = alpha, softness 128, direction -1 to the shader.
export function ruleWipe(r, alpha, soft = 128) {
  const lo = ((255 + 2 * soft) * alpha - 1.5 * soft) / 255;
  const k = Math.min(1, Math.max(0, (r - lo) * 255 / soft));
  return 1 - k * k * (3 - 2 * k);
}
