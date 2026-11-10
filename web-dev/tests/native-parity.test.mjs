// Checks for the second native parity pass (web-dev/audit/NATIVE-PARITY.md): script variables, choices and the flowchart,
// voices, music and sound effect channels, easing, motion splines, tween defaults and the config defaults.
// No browser or game data needed.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };

const { Audio, VOLUME_DEFAULTS, parseOpts } = await import("../../web/app/js/audio.js");
const { VM } = await import("../../web/app/js/vm.js");
const { ease, Motion, Value } = await import("../../web/app/js/animation.js");
const { FlowProgress } = await import("../../web/app/js/flowchart-model.js");

const { withContext } = await import("./fake-audio.mjs");

function fakeAudio() {
  const audio = new Audio();
  const { ctx, gainOf } = withContext(audio);
  return { audio, started: ctx.sources, ctx, gainOf };
}

function vmWith(extra = {}) {
  const rows = [];
  const text = { pageParts: [], typing: false, intro: false, addBreak(n) { rows.push(n); } };
  const { audio } = fakeAudio();
  const vm = new VM({ gfx: {}, audio, text, ...extra });
  vm.script = { name: "T", ops: [], labels: {} };
  vm.snapshot = () => ({ pc: vm.pc, script: 0, name: "T", logged: 0 });
  return { vm, rows, audio };
}

test("WKAD C847 0 adds no blank row; WKAD C847 n adds n (Cn = F(F823 + n), 0x7a2b0 / 0x391a0)", () => {
  const { vm, rows } = vmWith();
  vm.op_WKAD("C847", "0");
  vm.op_WKAD("C847", "1");
  assert.deepEqual(rows, [1]);
});

test("SELD's second argument shows every branch of the choice in the flowchart (0x92a60, table 0x3594d0)", async () => {
  const { vm } = vmWith({ onChoice: async () => 1 });
  vm.flow = new FlowProgress({ getItem: () => null, setItem() {} });
  vm.flowChart = { choiceFlags: { 23: [662, 661] } };
  vm.remember = () => {};
  vm.choices = ["a", "b"];
  await vm.op_SELD("_D000", "23");
  assert.ok(vm.flow.secondary.has(661) && vm.flow.secondary.has(662));
  assert.equal(vm.vars._D000, 1);
});

test("VPLY's voice starts with the next message, after any wait between them (0xae04c8, 0x6e0d0)", () => {
  const { vm, audio } = vmWith();
  const played = [];
  audio.playVoice = (name) => played.push(name);
  vm.op_VPLY("A00_01_00_0001_0");
  assert.deepEqual(played, [], "nothing plays at VPLY");
  assert.equal(vm.lastVoice, "A00_01_00_0001_0");
  vm.startPendingVoice();
  assert.deepEqual(played, ["A00_01_00_0001_0"]);
  vm.startPendingVoice();
  assert.equal(played.length, 1, "once");
});

test("MPLY: the track playing goes on unchanged; with no fade-in the old one is cut, else it fades over 011 or 001", async () => {
  const { audio, started, ctx, gainOf } = fakeAudio();
  audio.table = { bgm: ["A", "B", "C"] };
  await audio.playBGM(1, parseOpts(["`017:50"]));
  assert.equal(started.length, 1);
  const before = gainOf(started[0]);
  await audio.playBGM(1, parseOpts(["`017:100", "`001:500"]));
  assert.equal(started.length, 1, "MPLY of the music playing does nothing (0x649e0 / 0x9c460)");
  assert.equal(gainOf(started[0], 1), before, "not even its volume");
  ctx.currentTime = 10;
  await audio.playBGM(2, parseOpts(["`017:100"]));
  assert.equal(gainOf(started[0], 10 + 1 / 60), 0, "no fade-in: the old track is gone within a frame (0x9c470, 416.67 a frame)");
  ctx.currentTime = 20;
  await audio.playBGM(3, parseOpts(["`001:2000", "`011:800"]));
  // the old track (level 100) falls at 1666.67 / 800 a frame: level 50 at 0.4 s, 0 at 0.8 s (0x9c9b0)
  assert.ok(Math.abs(gainOf(started[1], 20.4) - audio.musicGain(50)) < 1e-4);
  assert.equal(gainOf(started[1], 20.81), 0, "and gone after 0.8 s");
});

test("a loop asked for again on its channel goes on as it is (0x6a340)", async () => {
  const { audio, started } = fakeAudio();
  await audio.playSE(3, true, "RAIN", parseOpts(["`017:60"]));
  await audio.playSE(3, true, "rain", parseOpts(["`017:100"]));
  assert.equal(started.length, 1);
  assert.equal(audio.se.get(3).lv.target, 60);
  await audio.playSE(3, false, "RAIN", parseOpts([]));
  assert.equal(started.length, 2, "played once, it replaces the loop");
});

test("068: a second delayed command runs the one waiting; an undelayed one only stops its countdown (0x66200, 0x6a340)", async () => {
  const { vm, audio } = vmWith();
  const played = [];
  audio.playSE = (ch, loop, name) => played.push(name);
  audio.stopSE = () => {};
  vm.op_SEPL("4", "0", "A", "`068:5000");
  vm.op_SEPL("4", "0", "B", "`068:5000");
  assert.deepEqual(played, ["A"], "A runs when B takes the slot");
  vm.op_SEPL("4", "0", "C");
  assert.deepEqual(played, ["A", "C"], "C plays; B's countdown stops");
  await new Promise((r) => setTimeout(r, 20));
  vm.op_SEPL("4", "0", "D", "`068:5000");
  assert.deepEqual(played, ["A", "C", "B"], "B, still in the slot, runs when D takes it");
  vm.op_SESP("4");
  vm.op_SEPL("4", "0", "E", "`068:5000");
  assert.deepEqual(played, ["A", "C", "B"], "SESP emptied the slot");
  vm.cancelDelayed();
});

test("N2-24: sound effects played once are passed over while fast-forwarding or in a read-scene skip, loops go on (0x6a340, 0xae0670)", () => {
  const { vm, audio } = vmWith();
  const played = [];
  audio.playSE = (ch, loop, name) => played.push(name);
  vm.skip = true;
  vm.op_SEPL("1", "0", "DOOR");
  vm.instant = true;   // the read-scene skip's instant run (0xae0568)
  vm.op_SEPL("1", "0", "STEP");
  vm.instant = false;
  vm.op_SEPL("2", "1", "RAIN");
  assert.deepEqual(played, ["RAIN"]);
});

// Penner's equations as the engine has them (0x30c80), written out independently.
const P = {
  26: (x) => 2 ** (10 * (x - 1)) - 0.001,
  27: (x) => 1.001 * (1 - 2 ** (-10 * x)),
  28: (x) => (x < 0.5 ? 0.5 * 2 ** (10 * (2 * x - 1)) - 0.0005 : 0.5 * 1.0005 * (2 - 2 ** (-10 * (2 * x - 1)))),
  32: (x) => {
    const f = 2 * x - 1, s = Math.sin(((f * 1 - 0.45 * 0.25) * 2 * Math.PI) / 0.45);
    return 2 * x < 1 ? 2 ** (10 * f) * s * -0.5 : 2 ** (-10 * f) * s * 0.5 + 1;
  },
  33: (x) => {
    // Penner returns the ends exactly (t = 0: b, t = d: b + c), as the engine's case 0x21 does.
    const outE = (y) => (y === 0 || y === 1 ? y : 2 ** (-10 * y) * Math.sin(((y - 0.3 * 0.25) * 2 * Math.PI) / 0.3) + 1);
    const inE = (y) => (y === 0 || y === 1 ? y : -(2 ** (10 * (y - 1))) * Math.sin((((y - 1) - 0.3 * 0.25) * 2 * Math.PI) / 0.3));
    return x < 0.5 ? 0.5 * outE(2 * x) : 0.5 + 0.5 * inE(2 * x - 1);
  },
  36: (x) => {
    const p = 2 * x;
    if (p < 1) return 0.5 * p * p * (p * 3.5949097 - 2.5949097);
    const f = p - 2;
    return 0.5 * (f * f * (f * 3.5949097 + 2.5949097) + 2);
  },
  37: (x) => (x < 0.5 ? 0.5 * (((2 * x - 1) ** 2) * ((2 * x - 1) * 2.70158 + 1.70158) + 1)
    : 0.5 + 0.5 * ((2 * x - 1) ** 2) * ((2 * x - 1) * 2.70158 - 1.70158)),
  4: (x) => (x < 0.5 ? 2 * x * x : -0.5 * ((2 * x - 1) * (2 * x - 3) - 1)),
  20: (x) => -0.5 * (Math.cos(Math.PI * x) - 1),
};

test("easing follows the engine's Penner table (0x30c80), including its own in-out curves", () => {
  for (const [id, f] of Object.entries(P)) {
    for (const x of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
      assert.ok(Math.abs(ease(Number(id), x) - f(x)) < 1e-6, `ease ${id} at ${x}: ${ease(Number(id), x)} vs ${f(x)}`);
    }
  }
  assert.equal(ease(0, 0.3), 0.3);
  assert.equal(ease(42, 0.3), 0.3);
});

test("motion keys in mode 1 follow the engine's natural spline over the channel's keys (0x972c0 / 0x97710)", () => {
  const S = -32767, R = -100001;
  const frame = (t, x, mode) => [t, 0, mode, x, S, S, R, S, S, S, S];
  // later keys give no mode (-32767, as every real track does): the mode stays the first key's
  const track = { duration: 3000, loop: 0, frames: [frame(0, 0, 1), frame(1000, 100, S), frame(2000, 0, S), frame(3000, 100, S)] };
  const motion = new Motion(1, track, { x: 0, y: 0, alpha: 255, rot: 0, zx: 1000, zy: 1000, blurX: 0, blurY: 0 }, 0);
  // y = 0, 100, 0, 100: differences 100, -100, 100. R1 = -200, R2 = (100 - (-100)) - 1 = 199 (the engine's solve subtracts 1,
  // N2-103), b1 = 4, b2 = 3.75: m2 = 199 / 3.75, m1 = (-200 - m2) / 4.
  const m2 = 199 / 3.75, m1 = (-200 - m2) / 4;
  const m = [0, m1, m2, 0], ys = [0, 100, 0, 100];
  const seg = (i, k) => ys[i] + k * (ys[i + 1] - ys[i]) - k * (2 * m[i] + m[i + 1]) + 3 * m[i] * k * k + (m[i + 1] - m[i]) * k ** 3;
  for (const t of [250, 500, 1500, 2600]) {
    const i = Math.floor(t / 1000), k = (t % 1000) / 1000;
    assert.ok(Math.abs(motion.sample(t).x - seg(i, k)) < 1e-9, `t ${t}: ${motion.sample(t).x} vs ${seg(i, k)}`);
  }
});

test("tween blanks: the start is the last target, the end is 0 for STGS / STRT and the last target for STZ4", () => {
  const v = new Value(255);
  v.to(255, 0, 1000, 0, 0, 0);
  v.to(undefined, 128, 1000, 0, 500, 0);
  assert.equal(v.a, 0, "a fade cut short starts from where it was going (+0x1e4)");
  v.to(200, undefined, 0, 0, 2000, 0);
  assert.equal(v.b, 0, "STGS with no end fades to 0 (0x637a0)");
  const z = new Value(1000);
  z.to(1000, 1500, 0, 0, 0, "last");
  z.to(800, undefined, 500, 0, 0, "last");
  assert.equal(z.b, 1500, "STZ4 with no end keeps its last target (0x62d20)");
  const { vm } = vmWith();
  const layer = { alpha: new Value(255), motion: null };
  vm.layerFor = () => layer;
  vm.op_STGS("16", "", "", "300", "0");
  assert.equal(layer.alpha.b, 0);
});

test("a click does not stop the voice while F1123 is set (0x802c0, state +0x8c6)", async () => {
  const { vm, audio } = vmWith();
  let stops = 0;
  audio.stopVoice = () => { stops++; };
  vm.onWait = () => {};
  vm.vars.F1123 = 1;
  const w = vm.waitAdvance();
  vm.advance();
  await w;
  assert.equal(stops, 0);
  vm.vars.F1123 = 0;
  const w2 = vm.waitAdvance();
  vm.advance();
  await w2;
  assert.equal(stops, 1);
});

test("the sound page starts from the game's defaults (0x46b080): BGM 40, SE 40, menu 10, voices 50", () => {
  assert.equal(VOLUME_DEFAULTS.bgm, 0.4);
  assert.equal(VOLUME_DEFAULTS.se, 0.4);
  assert.equal(VOLUME_DEFAULTS.sys, 0.1);
  assert.ok(VOLUME_DEFAULTS.chars.every((v) => v === 50));
});

test("the patch's text conventions: letter-spaced ruby is read back, italic ruby kept, bank 2 mirrored and italic", async () => {
  const { unspaceRuby, parseMarkup } = await import("../../web/app/js/textbox.js");
  assert.equal(unspaceRuby("p r e y  "), "prey");
  assert.equal(unspaceRuby("T h e  s t a r s   t w i n k l e          "), "The stars twinkle");
  assert.equal(unspaceRuby("M u c h   a s   I   y e a r n"), "Much as I yearn");
  assert.equal(unspaceRuby("y o u ' r e"), "you're");
  assert.equal(unspaceRuby("そで"), "そで", "ruby that is not spaced out stays");
  assert.equal(unspaceRuby("two words "), "two words");
  const it = (s) => [...s].map((c) => (c === " " ? " " : String.fromCharCode(c.charCodeAt(0) + 0xE000))).join("");
  const [r] = parseMarkup(`<I killed him|${it("c h i r p   ")}>`);
  assert.deepEqual([r.base, r.ruby, r.rubyItalic], ["I killed him", "chirp", true]);
  const bank2 = [..."ab"].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xE100)).join("");
  assert.deepEqual(parseMarkup(bank2), [{ t: "ab", i: false, m: true, it: true }]);
});

test("a run of dashes is one piece, drawn closed up past the font's gap so it reads as one line", async () => {
  const { dashRuns, dashJoin } = await import("../../web/app/js/textbox.js");
  assert.deepEqual(dashRuns("After all―――"), ["After all", "―――"]);
  assert.deepEqual(dashRuns("this tea――it's ― good"), ["this tea", "――", "it's ― good"], "a lone dash stays text");
  // Georgia at 42 px: a 36 px advance around 28 px of ink closes by the 8 px gap plus a solid overlap (12% of the ink)
  const m = { width: 36, actualBoundingBoxLeft: -4, actualBoundingBoxRight: 32 };
  assert.ok(Math.abs(dashJoin(m) - (8 + 0.12 * 28)) < 1e-9);
});
