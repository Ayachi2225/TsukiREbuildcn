import test from "node:test";
import assert from "node:assert/strict";
import { AnimationClock, Motion, Value, ease, layerState } from "../../web/app/js/animation.js";
import { makeEffect, effectAlive, effectOffset, rebaseEffect } from "../../web/app/js/effects.js";
import { VM } from "../../web/app/js/vm.js";

const H = -32767, S = -32766, R = -100001;
const base = { x: 240, y: 136, alpha: 255, rot: 0, zx: 1000, zy: 1000, blurX: 0, blurY: 0 };
const key = (t, x, curve = 0, mode = 0) => [t, curve, mode, x, H, H, R, H, H, H, H];
const track = (frames, loop = 0) => ({ duration: 1000, loop, frames });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("motion reads keyframes in script units and holds its final position", () => {
  const m = new Motion(1, track([key(0, 100), key(1000, 300)]), base, 5000);
  near(m.sample(5500).x, 200);
  near(m.sample(9000).x, 300);
  assert.equal(m.sample(5500).alpha, undefined);
});

test("a hold key and an omitted key have different timing", () => {
  const hold = new Motion(1, track([key(0, 0), key(500, H), key(1000, 100)]), base, 0);
  const omit = new Motion(1, track([key(0, 0), key(500, S), key(1000, 100)]), base, 0);
  near(hold.sample(500).x, 0);
  near(hold.sample(750).x, 50);
  near(omit.sample(500).x, 50);
});

test("a start key left as a hold keeps the layer's own value until the next key (0x97710); SGMA overrides a key", () => {
  const m = new Motion(1, track([key(0, H), key(1000, 440)]), base, 0);
  assert.equal(m.sample(500).x, undefined);
  near(m.sample(1000).x, 440);
  const captured = new Motion(1, track([key(0, 0), key(1000, 100)]), base, 0, { ...base, x: 80 });
  near(captured.sample(500).x, 90);
  assert.equal(captured.sample(500).zx, undefined);
});

test("original easing IDs and step interpolation affect playback", () => {
  near(ease(2, 0.5), 0.25);
  near(ease(3, 0.5), 0.75);
  const eased = new Motion(1, track([key(0, 0, 3), key(1000, 100)]), base, 0);
  near(eased.sample(500).x, 75);
  const step = new Motion(1, track([key(0, 0, 0, 2), key(1000, 100)]), base, 0);
  near(step.sample(999).x, 0);
  near(step.sample(1000).x, 100);
  for (let id = 0; id <= 41; id++) for (const x of [0, 0.1, 0.5, 0.9, 1]) assert.ok(Number.isFinite(ease(id, x)));
});

test("spline motion is continuous at keys and never returns NaN", () => {
  const m = new Motion(1, track([key(0, 0, 0, 1), key(400, 100, 0, 1), key(1000, 50)]), base, 0);
  near(m.sample(400).x, 100);
  assert.ok(Math.abs(m.sample(399.999).x - m.sample(400.001).x) < 0.01);
});

test("loop points repeat the whole track or only its tail without blocking a wait", () => {
  const full = new Motion(1, track([key(0, 0), key(1000, 100)], 1), base, 0);
  near(full.sample(1250).x, 25);
  assert.equal(full.remaining(1), 0);
  const tail = new Motion(1, track([key(0, 0), key(1000, 100)], 400), base, 0);
  near(tail.sample(1250).x, 65);
});

test("menu/visibility pauses compose and motion snapshots resume at the same phase", () => {
  let real = 100;
  const clock = new AnimationClock(() => real);
  const m = new Motion(1, track([key(0, 0), key(1000, 100)]), base, clock.now());
  real = 400; clock.pause("menu", true);
  real = 900; clock.pause("hidden", true); clock.pause("menu", false);
  near(m.sample(clock.now()).x, 30);
  real = 1400; clock.pause("hidden", false);
  real = 1500; near(m.sample(clock.now()).x, 40);
  const saved = JSON.parse(JSON.stringify(m.snapshot(clock.now())));
  const loaded = Motion.restore(saved, { 1: m.track }, 10000);
  near(loaded.sample(10000).x, 40);
  near(loaded.sample(10200).x, 60);
  loaded.pause(true, 10200);
  near(loaded.sample(90000).x, 60);
  loaded.pause(false, 90000);
  near(loaded.sample(90100).x, 70);
});

// A tween's progress: frames = ms x 60 / 1000, step = 4096 / frames (whole), progress = n x step / 4096 at frame n (N2-91).
const tweenAt = (a, b, ms, t) => {
  const frames = Math.trunc(ms * 60 / 1000), step = Math.trunc(4096 / frames);
  return a + (b - a) * Math.min(1, (t / (1000 / 60)) * step / 4096);
};

test("tweens preserve their remaining animation when saved", () => {
  const v = new Value(10);
  v.to(undefined, 110, 1000, 0, 100);
  near(v.at(600), tweenAt(10, 110, 1000, 500), 1e-9);
  const loaded = Value.restore(v.snapshot(600), 0, 5000);
  near(loaded.at(5250), tweenAt(10, 110, 1000, 750), 1e-9);
  near(loaded.at(5500), tweenAt(10, 110, 1000, 1000), 1e-9);
  near(loaded.at(5600), 110);
  v.to(0, 100, 1000, 3, 0);
  const eased = Value.restore(v.snapshot(500), 0, 10000);
  near(eased.at(10200), v.at(700));
});

test("quake is deterministic, respects delay/expiry, and indefinite effects keep playing", () => {
  const q = makeEffect("quake", [4, 8, 0, 600, 100], 0);
  assert.deepEqual(effectOffset(q, 50), [0, 0]);
  assert.deepEqual(effectOffset(q, 150), effectOffset(q, 150));
  const [x, y] = effectOffset(q, 150);
  assert.ok(Math.abs(x) <= 4 && Math.abs(y) <= 8);
  assert.deepEqual(effectOffset(q, 700), [0, 0]);
  assert.equal(effectAlive(q, 700), false);
  const forever = makeEffect("quake", [2, 3, 0, -1], 0);
  assert.equal(effectAlive(forever, 1000000), true);
  assert.deepEqual(effectOffset(makeEffect("quake", [0, 0], 0), 100), [0, 0]);
});

test("directional shake and saved effects retain their phase", () => {
  const e = makeEffect("shake", [-5, 0, 1000, -1], 100);
  near(effectOffset(e, 350)[0], -5);
  near(effectOffset(e, 350)[1], 0);
  const saved = rebaseEffect(e, 350, 0);
  const loaded = rebaseEffect(JSON.parse(JSON.stringify(saved)), 0, 9000);
  assert.deepEqual(effectOffset(e, 350), effectOffset(loaded, 9000));
  const sway = makeEffect("sway", [2, 5, 500, 1000, 0.5, -1], 0);
  for (let t = 0; t < 5000; t += 43) for (const v of effectOffset(sway, t)) assert.ok(Math.abs(v) <= 2.5);
});

function machine() {
  let now = 1000;
  const node = { innerHTML: "", style: { top: "" } };
  globalThis.document = { getElementById: () => node };
  const text = { pageParts: [], typing: false, intro: false, clear() { this.pageParts = []; }, setIntro() {}, setOpen() {} };
  const audio = { snapshot: () => ({}), restore() {}, stopVoice() {} };
  const gfx = { load: async () => ({ tex: null, w: 100, h: 100 }), tex: new Map() };
  const vm = new VM({ gfx, text, audio });
  vm.clock = new AnimationClock(() => now);
  vm.motions = { 1: track([key(0, 0), key(1000, 100)]), 2: track([key(0, 0), key(1000, 100)], 1) };
  vm.script = { name: "synthetic", ops: [] };
  return { vm, setTime: (t) => { now = t; } };
}

test("VM waits respect STCF masks, and looping motion does not stall story scripts", async () => {
  const { vm } = machine();
  vm.op_STCH("1", "test"); vm.op_STMA("1", "1"); vm.op_STGS("1", "0", "255", "200", "0");
  const waits = []; vm.sleep = async (ms) => { waits.push(ms); };
  await vm.op_STCF("1", "8");
  near(waits[0], 13 * 1000 / 60, 1e-9);   // 200 ms: 12 frames, step 341: 13 frames (N2-91)
  await vm.op_STCF("1");
  near(waits[1], 1000);
  vm.op_STMA("1", "2");
  await vm.op_STCF("1", "32");
  near(waits[1], 1000);
});

test("layer clones inherit independent effects; stopping one family preserves the other", () => {
  const { vm } = machine();
  vm.op_STCH("1", "test"); vm.op_STMA("1", "1");
  vm.op_SQK2("1", "2", "3", "0", "-1"); vm.op_SHK2("1", "0", "5", "1000", "-1");
  const args = Array(19).fill(""); args[0] = "2"; args[1] = "other"; args[18] = "1";
  vm.op_SCH2(...args);
  const a = vm.layerFor(1), b = vm.layerFor(2);
  assert.notEqual(a.motion, b.motion);
  assert.notEqual(a.effects.quake, b.effects.quake);
  vm.op_SQS2("2"); assert.ok(a.effects.quake); assert.equal(b.effects.quake, undefined); assert.ok(b.effects.oscillation);
  vm.op_SHS2("-1"); assert.equal(a.effects.oscillation, undefined); assert.equal(b.effects.oscillation, undefined);
});

test("STMA(0) bakes the current pose, and a run that draws nothing finishes finite motion", () => {
  const { vm, setTime } = machine();
  vm.op_STCH("1", "test"); vm.op_STMA("1", "1");
  setTime(1500); vm.op_STMA("1", "0");
  near(layerState(vm.layerFor(1), vm.now()).x, 50);
  vm.op_STMA("1", "1"); vm.op_SQK2("1", "4", "5", "0", "600"); vm.op_SSW2("1", "2", "5", "500", "1000", "1", "-1");
  vm.skipPaced = false;   // the smoke test's run, like a test jump or an instant run; fast forward plays it all (item110.test.mjs)
  vm.skip = true;
  near(layerState(vm.layerFor(1), vm.now()).x, 100);
  assert.equal(vm.layerFor(1).effects.quake, undefined);
  assert.ok(vm.layerFor(1).effects.oscillation);
});

test("a run that draws nothing keeps endless ambient effects, including ones started in it", () => {
  const { vm } = machine();
  vm.op_STCH("1", "test"); vm.op_SQK2("1", "1", "7", "0", "-1");
  vm.skipPaced = false;
  vm.skip = true;
  assert.ok(vm.layerFor(1).effects.quake);
  vm.op_STCH("2", "test"); vm.op_SQK2("2", "1", "7", "0", "-1"); vm.op_SHK2("2", "0", "5", "300", "800");
  assert.ok(vm.layerFor(2).effects.quake);
  assert.equal(vm.layerFor(2).effects.oscillation, undefined);
  vm.op_SSW2("2", "2", "5", "500", "1000", "1", "-1"); vm.op_SHK2("2", "0", "5", "300", "800");
  assert.equal(vm.layerFor(2).effects.oscillation, undefined);
  vm.skip = false;
  assert.ok(vm.layerFor(1).effects.quake);
});

test("changing a motion preserves independent opacity animation", () => {
  const { vm, setTime } = machine();
  vm.op_STCH("1", "test"); vm.op_STGS("1", "0", "200", "1000", "0");
  setTime(1250); vm.op_STMA("1", "1");
  setTime(1500); near(layerState(vm.layerFor(1), vm.now()).alpha, tweenAt(0, 200, 1000, 500), 1e-9);
  vm.op_STMA("1", "0");
  setTime(1750); near(layerState(vm.layerFor(1), vm.now()).alpha, tweenAt(0, 200, 1000, 750), 1e-9);
});

test("loading pictures holds animation time instead of consuming a short track", async () => {
  const { vm, setTime } = machine();
  let loaded;
  const wait = vm.waitImages([new Promise((r) => { loaded = r; })]);
  setTime(6000); near(vm.now(), 1000);
  loaded(); await wait;
  setTime(6100); near(vm.now(), 1100);
});

test("VM saves/restores motion, effect phase, and pending layers", async () => {
  const { vm, setTime } = machine();
  vm.op_STCH("1", "test"); vm.op_STMA("1", "1"); vm.op_SQK2("1", "4", "5", "0", "-1");
  setTime(1500);
  const save = JSON.parse(JSON.stringify(vm.snapshot()));
  const offset = effectOffset(vm.layerFor(1).effects.quake, vm.now());
  setTime(10000); vm.getScript = async () => vm.script;
  await vm.restore(save);
  near(layerState(vm.layerFor(1), vm.now()).x, 50);
  assert.deepEqual(effectOffset(vm.layerFor(1).effects.quake, vm.now()), offset);
  setTime(10200); near(layerState(vm.layerFor(1), vm.now()).x, 70);
});
