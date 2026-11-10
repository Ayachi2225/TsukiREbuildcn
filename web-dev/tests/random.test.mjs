// TODO item 120: the game's random numbers. A sway and the speed lines draw from the C library's rand(), which the game
// never seeds, so they come out the same at every launch; the port draws the same numbers at the same moments.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { crand, crandBetween, crandSeed, crandState, crandUnit } from "../../web/app/js/random.js";
import { advanceRandom, carrySway, effectOffset, layerShiftPixels, makeEffect, rebaseEffect, swayCycle } from "../../web/app/js/effects.js";
import { linesSample, startLines, stopLines } from "../../web/app/js/screenfx.js";
import { AnimationClock } from "../../web/app/js/animation.js";

const F = 1000 / 60;
const at = (f) => f * F + 0.01;
const cycle = (e, axis) => { const c = swayCycle(e, axis); return c && [c.amplitude, c.period, c.sign]; };
const SWAY = [7, 15, 1000, 2000, 1, -1, 0];

test("rand() is musl's: state x 6364136223846793005 + 1, top 31 bits, from a state of 0 (SDK 0x557850)", () => {
  crandSeed(0);
  assert.deepEqual([crand(), crand(), crand()], [0, 740882966, 1616430695]);
  assert.equal(crandState(), ((1n * 6364136223846793005n + 1n) * 6364136223846793005n + 1n) & ((1n << 64n) - 1n));
  crandSeed(0);
  assert.equal(crandUnit(), 0);
  crandSeed(0);
  assert.equal(crandBetween(7, 15), 7);            // r = 0
  assert.equal(crandBetween(60, 120), 80);         // r = 0.345
  crandSeed(0); crand();
  assert.equal(crandBetween(120, 60), 99);         // the ends as given: 120 - 60 r, cut towards zero
});

test("the first sway after launch is the game's: amplitude, period and sign per cycle as on native frames", () => {
  crandSeed(0);
  const e = makeEffect("sway", SWAY, 0);
  assert.deepEqual(effectOffset(e, at(0)), [0, 0]);
  assert.equal(cycle(e, 0), null);                 // nothing drawn before the first step
  assert.deepEqual(effectOffset(e, at(1)), [0, 0]);
  // the first step draws x's amplitude, period and sign, then y's
  assert.deepEqual([cycle(e, 0), cycle(e, 1)], [[7, 80, -1], [13, 106, 1]]);
  const [x, y] = effectOffset(e, at(21));          // timer 20
  assert.ok(Math.abs(x - -7) < 1e-9);              // -7 sin(2 pi 20 / 80)
  assert.ok(Math.abs(y - 13 * Math.sin(2 * Math.PI * 20 / 106)) < 1e-9);
  // each cycle lasts period + 1 frames; the native run showed these cycles in this order on each axis
  const seen = [[], []];
  for (let f = 0; f <= 400; f++) {
    effectOffset(e, at(f));
    for (const axis of [0, 1]) { const c = swayCycle(e, axis); if (c && seen[axis].at(-1)?.at !== c.at) seen[axis].push(c); }
  }
  assert.deepEqual(seen[0].map((c) => [c.at, c.amplitude, c.period]), [[1, 7, 80], [82, 8, 96], [179, 10, 92], [272, 12, 119], [392, 9, 86]]);
  assert.deepEqual(seen[1].map((c) => [c.at, c.amplitude, c.period]), [[1, 13, 106], [108, 9, 100], [209, 12, 86], [296, 11, 87], [384, 7, 87]]);
  assert.ok(seen[0].every((c) => c.sign === -1) && seen[1].every((c) => c.sign === 1));   // the sign is drawn once
  // the same moment sampled again draws nothing more
  const s = crandState();
  effectOffset(e, at(400)); effectOffset(e, at(100));
  assert.equal(crandState(), s);
});

test("a sway's ends are used as given, and its numbers are drawn even when it moves nothing", () => {
  crandSeed(0);
  const e = makeEffect("sway", [15, 7, 2000, 1000, 1, -1, 0], 0);
  assert.deepEqual([e.amp, e.per], [[15, 7], [120, 60]]);
  effectOffset(e, at(1));
  assert.deepEqual(cycle(e, 0), [15, 99, -1]);     // 15 - 8 x 0, 120 - 60 x 0.345
  crandSeed(0);
  const still = makeEffect("sway", [1, 6, 500, 600, 0, -1, 0], 0);   // SSW2's factor 0.5 reads as 0
  assert.deepEqual(effectOffset(still, at(50)), [0, 0]);
  assert.notEqual(crandState(), 0n);
  assert.ok(cycle(still, 0));
  // a sway that is over draws no more
  crandSeed(0);
  const short = makeEffect("sway", [3, 7, 50, 150, 1, 800, 0], 0);
  for (let f = 0; f < 48; f++) effectOffset(short, at(f));
  const s = crandState();
  for (let f = 48; f < 400; f++) assert.deepEqual(effectOffset(short, at(f)), [0, 0]);
  assert.equal(crandState(), s);
});

test("draws come in the game's order: frame by frame, layers by number (x, then y), then the speed lines", () => {
  const presets = { 19: [[0, 540, 453, 119, 324, 25, 50, 0, 20], [200, 540, 453, 119, 324, 25, 50, 255, 20]] };
  const layer = (id, args, t) => ({ id, parent: -1, link: -1, effects: { oscillation: makeEffect("sway", args, t) } });
  // two layers swaying from the same frame, the higher number made first: the lower still draws first
  crandSeed(0);
  const b = layer(4, [15, 7, 2000, 1000, 1, -1, 0], 0), a = layer(3, SWAY, 0);
  advanceRandom([b, a], null, presets, at(1));
  assert.deepEqual([cycle(a.effects.oscillation, 0), cycle(a.effects.oscillation, 1)], [[7, 80, -1], [13, 106, 1]]);
  crandSeed(0); for (let i = 0; i < 6; i++) crand();
  const want = [crandBetween(15, 7), crandBetween(120, 60)];
  assert.deepEqual(cycle(b.effects.oscillation, 0).slice(0, 2), want);
  // a batch of speed lines takes one number for its count and one for each line, after that frame's sways
  crandSeed(0);
  const c = layer(3, SWAY, 0), lines = startLines(19, 0, 1);
  advanceRandom([c], lines, presets, at(2));
  crandSeed(0); for (let i = 0; i < 6; i++) crand();
  const count = 25 + crand() % 25;
  assert.equal(linesSample(lines, presets, at(2)).length, count);
  const used = 6 + 1 + count;
  crandSeed(0); for (let i = 0; i < used; i++) crand();
  const s = crandState();
  crandSeed(0);
  const c2 = layer(3, SWAY, 0), lines2 = startLines(19, 0, 1);
  for (let f = 0; f <= 2; f++) advanceRandom([c2], lines2, presets, at(f));   // stepped a frame at a time or all at once: the same
  assert.equal(crandState(), s);
  // a frame that came late draws what the frames in between would have drawn, in their order
  crandSeed(0);
  const p = layer(1, SWAY, 0), q = layer(2, SWAY, 20 * F);
  for (let f = 0; f <= 300; f++) advanceRandom([p, q], null, presets, at(f));
  const each = [swayCycle(p.effects.oscillation, 0), swayCycle(q.effects.oscillation, 1), crandState()];
  crandSeed(0);
  const p2 = layer(1, SWAY, 0), q2 = layer(2, SWAY, 20 * F);
  advanceRandom([p2], null, presets, at(10));
  advanceRandom([p2, q2], null, presets, at(300));
  assert.deepEqual([swayCycle(p2.effects.oscillation, 0), swayCycle(q2.effects.oscillation, 1), crandState()], each);
  // the offsets the renderer asks for afterwards draw nothing
  layerShiftPixels(p2, new Map([[1, p2], [2, q2]]), at(300));
  assert.equal(crandState(), each[2]);
});

test("speed lines: count first + rand() % span (never the upper end), whole distances, 2 frames a batch at 20 ms", () => {
  const presets = { 19: [[0, 540, 453, 119, 324, 25, 50, 0, 20], [200, 540, 453, 119, 324, 25, 50, 255, 20]], 4: [[0, 640, 360, 600, 200, 300, 400, 255, 32]] };
  crandSeed(0);
  const s = startLines(19, 0, 7);
  assert.deepEqual(linesSample(s, presets, at(1)), []);
  let batches = 0, last = null;
  for (let f = 2; f <= 240; f++) {
    const list = linesSample(s, presets, at(f));
    const key = JSON.stringify(list.map((l) => [l.angle, l.radius]));
    if (key !== last) { batches++; last = key; assert.equal(f % 2, 0); }
    assert.ok(list.length >= 25 && list.length <= 49);
    for (const l of list) { const r = l.radius / 1.05; assert.ok(Math.abs(r - Math.round(r)) < 1e-6 && Math.round(r) >= 119 && Math.round(r) <= 323); }
  }
  assert.equal(batches, 120);
  assert.equal(linesSample(s, presets, at(6))[0]?.alpha ?? 0, linesSample(s, presets, at(6))[0]?.alpha ?? 0);
  // the lines on screen are kept when FCSP starts the fade, and the same moment gives the same lines
  const before = linesSample(s, presets, at(240)), state = crandState();
  const off = stopLines(s, 1000, at(240));
  assert.deepEqual(linesSample(off, presets, at(240)).map((l) => [l.angle, l.radius]), before.map((l) => [l.angle, l.radius]));
  assert.equal(crandState(), state);
  // types under 9 show half the count: 300 + rand() % 100, halved
  crandSeed(0);
  const n = linesSample(startLines(4, 0, 7), presets, at(2)).length;
  crandSeed(0);
  assert.equal(n, Math.trunc((300 + crand() % 100) / 2));
  // different seeds turn the lines differently (the angle is the engine's other generator), the distances stay
  crandSeed(0); const one = linesSample(startLines(19, 0, 1), presets, at(2));
  crandSeed(0); const two = linesSample(startLines(19, 0, 2), presets, at(2));
  assert.deepEqual(one.map((l) => l.radius), two.map((l) => l.radius));
  assert.notDeepEqual(one.map((l) => l.angle), two.map((l) => l.angle));
});

test("a restore keeps the cycle of a sway still running on the layer, and draws anew for one that was not", () => {
  crandSeed(0);
  const live = makeEffect("sway", SWAY, 0);
  for (let f = 0; f <= 100; f++) effectOffset(live, at(f));
  const saved = JSON.parse(JSON.stringify(rebaseEffect(live, at(50), 0)));   // a record made at frame 50
  // a rewind at frame 100: the record's effect comes back 50 frames into its life, the live cycle goes on
  const back = rebaseEffect(saved, 0, at(100));
  const state = crandState(), [x, y] = effectOffset(live, at(100));
  carrySway(back, live, at(100));
  assert.equal(crandState(), state);
  assert.deepEqual(effectOffset(back, at(100)), [x, y]);
  assert.deepEqual(effectOffset(back, at(105)), effectOffset(live, at(105)));
  assert.deepEqual([cycle(back, 0), cycle(back, 1)], [cycle(live, 0), cycle(live, 1)]);
  effectOffset(back, at(108));                     // y's next cycle comes when the live one's would have
  assert.equal(swayCycle(back, 1).at - swayCycle(back, 0).at, 108 - 82);
  assert.notEqual(crandState(), state);
  // a load with no sway on the layer: the first step after it draws all six again
  const fresh = rebaseEffect(saved, 0, at(100));
  carrySway(fresh, undefined, at(100));
  crandSeed(0);
  effectOffset(fresh, at(100));
  assert.deepEqual([cycle(fresh, 0), cycle(fresh, 1)], [[7, 80, -1], [13, 106, 1]]);
  assert.deepEqual(effectOffset(fresh, at(100)), [0, 0]);
  assert.ok(Math.abs(effectOffset(fresh, at(120))[0] - -7) < 1e-9);
});

test("a sway saved before item 120 (sorted ends, periods in ms) still runs", () => {
  crandSeed(0);
  const old = { kind: "sway", start: 0, delay: 0, duration: -1, x: 0, y: 0, min: 7, max: 15, periodMin: 1000, periodMax: 2000, factor: 1, seed: 5 };
  effectOffset(old, at(1));
  assert.deepEqual(cycle(old, 0), [7, 80, -1]);
});

test("the machine: a rewind carries a running sway's cycle; the frame loop's step leaves nothing for the samples to draw", async () => {
  const { VM } = await import("../../web/app/js/vm.js");
  const node = { innerHTML: "", style: { top: "" } };
  globalThis.document = { getElementById: () => node };
  const text = { pageParts: [], typing: false, intro: false, clear() { this.pageParts = []; }, setIntro() {}, setOpen() {}, closeNow() {}, closeQuick() {},
    fadeOut() {}, fadeIn() {}, addBreak() {}, beginMessage() {}, continueMessage() {}, setWhole() {}, log() {}, unlog() {}, add: async () => {}, finish() {}, rows: () => ({}) };
  const audio = { snapshot: () => ({ bgm: null, se: [], last: Array(20).fill(-1), lastMusic: 0 }), restore() {}, stopVoice() {}, playVoice() {}, characterOf: () => -1, voiceDone: () => new Promise(() => {}) };
  const vm = new VM({ gfx: { load: async () => ({ tex: null, w: 100, h: 100 }), tex: new Map() }, text, audio });
  vm.script = { name: "synthetic", ops: [], labels: {} };
  vm.lines = []; vm.read = new Uint8Array(16); vm.waitAdvance = async () => {};
  vm.getScript = async () => vm.script;
  let t = 0;
  vm.clock = new AnimationClock(() => t);
  crandSeed(0);
  vm.op_STCH("3", "WHITE", "240", "136", "100", "255", "30", "", "CC");
  await vm.commit();
  vm.op_SSW2("3", "7", "15", "1000", "2000", "1", "-1", "0");
  const e = () => vm.layerFor(3).effects.oscillation;
  for (let f = 0; f <= 50; f++) { t = at(f); advanceRandom(vm.allLayers().values(), vm.gfx.lines, null, vm.now()); }
  assert.deepEqual(cycle(e(), 0), [7, 80, -1]);
  const s = vm.snapshot(); s.waiting = false;
  for (let f = 51; f <= 100; f++) { t = at(f); advanceRandom(vm.allLayers().values(), vm.gfx.lines, null, vm.now()); }
  assert.deepEqual(cycle(e(), 0), [8, 96, -1]);                 // the second cycle, from frame 82
  const state = crandState(), was = effectOffset(e(), vm.now());
  await vm.restore(s, { rewind: true });
  assert.equal(crandState(), state);
  assert.deepEqual(cycle(e(), 0), [8, 96, -1]);
  assert.deepEqual(effectOffset(e(), vm.now()), was);
  // the layer staged again from itself keeps the cycle (the same record); a plain STCH starts from a cleared state: no sway
  // (native run: the box stops dead at such a STCH's commit)
  const blank = Array(9).fill("");
  vm.op_STCH("3", "WHITE", "240", "136", "100", "255", "30", "", "CC", ...blank, "3");
  await vm.commit();
  assert.equal(crandState(), state);
  assert.deepEqual(effectOffset(e(), vm.now()), was);
  vm.op_STCH("3", "WHITE", "240", "136", "100", "255", "30", "", "CC");
  await vm.commit();
  assert.equal(e(), undefined);
  // the scripts' order: the picture staged, SSW2, then the commit: the sway starts at once with the next numbers
  vm.op_STCH("5", "WHITE", "240", "136", "100", "255", "30", "", "CC");
  vm.op_SSW2("5", "7", "15", "1000", "2000", "1", "-1", "0");
  await vm.commit();
  const e5 = vm.layerFor(5).effects.oscillation, from = Math.round(vm.now() / F);
  for (let f = from; f <= from + 2; f++) { t = at(f); advanceRandom(vm.allLayers().values(), vm.gfx.lines, null, vm.now()); }
  crandSeed(state);
  assert.deepEqual(cycle(e5, 0).slice(0, 2), [crandBetween(7, 15), crandBetween(60, 120)]);
});

test("the story's speed-line presets have no range of one value (the game would divide by its span)", () => {
  const file = new URL("../../web/assets/effects.json", import.meta.url);
  if (!existsSync(file)) return;
  const rows = Object.values(JSON.parse(readFileSync(file)).focusLines).flat();
  for (const p of rows) { assert.notEqual(p[3], p[4]); assert.ok(p[5] < p[6]); }
});
