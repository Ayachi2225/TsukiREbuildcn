// Checks for TODO item 110 (2026-11-09): fast forward at the game's speed. The numbers are the frames counted on native runs of the
// PC build with ZR held (web-dev/audit/FIXES.md, "TODO item 110"): chains of each kind of wait, a step marker shown by each.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };

const { VM } = await import("../../web/app/js/vm.js");
const { AnimationClock, layerState } = await import("../../web/app/js/animation.js");
const { effectOffset } = await import("../../web/app/js/effects.js");
const { splitSample, startLines, linesDue, linesBatch } = await import("../../web/app/js/screenfx.js");
const textbox = await import("../../web/app/js/textbox.js");
const { Level, Audio } = await import("../../web/app/js/audio.js");

const FRAME = 1000 / 60;

// A machine on a clock the test moves, its frame steps taken by hand (as main.js takes them, one a frame).
function machine() {
  let now = 1000;
  const node = { innerHTML: "", style: { top: "" } };
  globalThis.document = { getElementById: () => node };
  const calls = [];
  const text = { pageParts: [], typing: false, intro: false, rate: 0, clear() { this.pageParts = []; }, setIntro() {}, setOpen() {},
    fadeOut(ms) { calls.push(`out:${ms}`); }, fadeIn(ms) { calls.push(`in:${ms}`); }, closeNow() {}, closeQuick() {}, add: () => Promise.resolve(), log() {}, beginMessage() {} };
  const audio = { snapshot: () => ({}), restore() {}, stopVoice() {}, speed: 1, setSpeed(k) { this.speed = k; } };
  const gfx = { load: async () => ({ tex: null, w: 100, h: 100 }), tex: new Map(), fades: [], beginFade(ms, mask, start) { this.fades.push({ ms, start }); this.fade = { ms, start }; } };
  const vm = new VM({ gfx, text, audio });
  vm.clock = new AnimationClock(() => now);
  vm.frameClock = new AnimationClock(() => now);
  vm.externalTicks = true;
  vm.script = { name: "synthetic", ops: [] };
  vm.running = true;
  return { vm, calls, gfx, audio, pass: (ms) => { now += ms; } };
}
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
// How many frame steps a wait takes: the script goes on after that many.
async function stepsOf(vm, promise, limit = 400) {
  let done = false;
  promise.then(() => { done = true; });
  await settle();
  for (let n = 0; n <= limit; n++) {
    if (done) return n;
    vm.tick();
    await settle();
  }
  return -1;
}

test("New Game: the white between the title and the story waits for the first FADS, once, and a stopped script lets it go (native frames: white throughout)", async () => {
  const { vm, pass } = machine();
  const fade = () => { vm.fade(1, 0, 0, 0); return settle(); };
  let lifted = 0;
  vm.onFirstFade = () => { lifted++; };
  await settle();
  assert.equal(lifted, 0);
  await fade();
  assert.equal(lifted, 1);
  await fade();
  assert.equal(lifted, 1, "only the first");
  vm.onFirstFade = () => { lifted++; };
  vm.stop();
  vm.stop();
  assert.equal(lifted, 2, "stopping lifts it, once");
  for (let i = 0; i < 3; i++) { pass(1000); await new Promise((res) => setTimeout(res, 60)); }   // the fades' waits run out, so nothing is left polling
});

test("Item 110: under fast forward the story's clock stands between frames and each frame step moves it 33 frames (0x4a5b0: 64 / 2 + 1)", () => {
  const { vm, pass, audio } = machine();
  const t0 = vm.now();
  vm.skip = true;
  assert.equal(vm.speeding, true);
  assert.equal(vm.fast, false);
  assert.equal(audio.speed, 65);                 // the mixer: its own frame and 64 more (0x9b7f0(64))
  pass(500);
  assert.equal(vm.now(), t0);                    // real time does not move it
  vm.tick();
  assert.ok(Math.abs(vm.now() - t0 - 33 * FRAME) < 1e-6);
  assert.ok(Math.abs(vm.frameNow() - (t0 + 500)) < 1e-6);   // the display's frames go on as they are
  vm.skip = false;
  assert.equal(audio.speed, 1);
  pass(100);
  assert.ok(Math.abs(vm.now() - t0 - 33 * FRAME - 100) < 1e-6);
  // a menu holds the frame step (0x40ed0 returns before it)
  vm.skip = true;
  vm.paused = true;
  const held = vm.now();
  vm.tick();
  assert.equal(vm.now(), held);
  vm.paused = false;
  vm.stop();
});

test("Item 110: a WTTM loses 64 frames a frame of fast forward (0x81b30): 1000 ms one frame, 1067 ms one, 1084 ms two, 5000 ms five", async () => {
  for (const [ms, fixed, frames] of [[1000, "1", 1], [2000, "1", 2], [3000, "1", 3], [5000, "1", 5], [1000, "0", 1], [3000, "0", 3], [100, "1", 1], [17, "1", 1], [1067, "1", 1], [1084, "1", 2]]) {
    const { vm } = machine();
    vm.skip = true;
    assert.equal(await stepsOf(vm, vm.op_WTTM(String(ms), fixed)), frames, `WTTM(${ms},${fixed})`);
    vm.stop();
  }
});

test("Item 110: a WTTM is counted in frames, ms x 3 / 50 cut to a whole number and at least one (17 ms is one frame, not two)", async () => {
  const { vm } = machine();
  const waits = [];
  vm.sleep = async (ms, clickable, wttm) => { waits.push([Math.round(ms * 60 / 1000), clickable, wttm]); };
  await vm.op_WTTM("17", "1"); await vm.op_WTTM("34"); await vm.op_WTTM("100", "1"); await vm.op_WTTM("1000", "0"); await vm.op_WTTM("0", "1");
  assert.deepEqual(waits, [[1, false, true], [2, true, true], [6, false, true], [60, true, true]]);
});

test("Item 110: fast forward starting leaves a timed wait running; only a press ends a WTTM that may be passed", async () => {
  const { vm } = machine();
  let done = false;
  vm.op_WTTM("5000", "0").then(() => { done = true; });
  await settle();
  vm.skip = true;
  vm.advance(false);                             // what main.js does as fast forward starts
  await settle();
  assert.equal(done, false);
  vm.tick(); await settle();
  assert.equal(done, false);                     // 300 frames: five frames of it
  vm.advance();                                  // the player's press
  await settle();
  assert.equal(done, true);
  vm.stop();
});

test("Item 110: FADS under fast forward: no time, 100 ms and 500 ms take 3 frames, 1700 ms 6, 3000 ms 8", async () => {
  for (const [type, ms, frames] of [["1", "0", 3], ["0", "100", 3], ["0", "500", 3], ["0", "1700", 6], ["0", "3000", 8], ["2", "1700", 6]]) {
    const { vm, gfx } = machine();
    vm.skip = true;
    const t0 = vm.now();
    assert.equal(await stepsOf(vm, vm.op_FADS(type, ms, type === "2" ? "5" : "0")), frames, `FADS(${type},${ms})`);
    if (ms !== "0") {
      // the level starts on the frame after the command's own and runs in frames of 16.666 ms (0x4b740)
      assert.ok(Math.abs(gfx.fades[0].start - (t0 + 33 * FRAME)) < 1e-6);
      assert.ok(Math.abs(gfx.fades[0].ms - Number(ms) * FRAME / 16.666) < 1e-6);
    } else assert.equal(gfx.fades.length, 0);
    vm.stop();
  }
});

test("Item 110: FADS at normal speed waits its level's steps and two frames more: no time 3 frames, 100 ms 9, 500 ms 33 (native chains)", async () => {
  for (const [type, ms, frames] of [["1", "0", 3], ["0", "100", 9], ["0", "500", 33], ["0", "1700", 105]]) {
    const { vm } = machine();
    const waits = [];
    vm.sleep = async (t) => { waits.push(t); };
    await vm.op_FADS(type, ms, "0");
    assert.equal(Math.round(waits.reduce((a, b) => a + b, 0) / FRAME), frames, `FADS(${type},${ms})`);
  }
});

test("Item 110: tweens run on under fast forward and STCF waits for them: a 3000 ms STGS takes 6 frames, a 1000 ms one 2", async () => {
  const { vm } = machine();
  vm.op_STCH("4", "test");
  await vm.commit();
  vm.skip = true;
  vm.op_STGS("4", "255", "0", "3000", "0");
  const l = vm.layerFor(4);
  assert.equal(l.alpha.done(vm.now()), false);   // not put at its end
  let frames = 0, seen = [];
  const wait = vm.op_STCF("4");
  let done = false;
  wait.then(() => { done = true; });
  await settle();
  while (!done && frames < 20) { vm.tick(); frames++; seen.push(Math.round(layerState(l, vm.now()).alpha)); await settle(); }
  assert.equal(frames, 6);
  // 180 frames: 22 / 4096 a frame, 33 frames a step; the game's frames show 83, 65, 47 and 29 % of the picture, then none
  assert.deepEqual(seen.slice(0, 5).map((a) => Math.round(a / 255 * 100)), [82, 65, 47, 29, 11]);
  vm.op_STGS("4", "0", "255", "1000", "0");
  assert.equal(await stepsOf(vm, vm.op_STCF("4")), 2);
  // with nothing moving the command still takes its frame
  assert.equal(await stepsOf(vm, vm.op_STCF("4")), 1);
  vm.stop();
});

test("Item 110: fast forward coming on leaves tweens, motions and effects running; a run that draws nothing ends them", () => {
  const { vm } = machine();
  vm.op_STCH("4", "test");
  vm.op_STGS("4", "255", "0", "3000", "0");
  vm.op_SQK2("4", "15", "15", "50", "2000");
  vm.skip = true;
  const l = vm.layerFor(4);
  assert.equal(l.alpha.done(vm.now()), false);
  assert.ok(l.effects.quake);
  vm.op_SHK2("4", "0", "15", "300", "2000");      // a timed effect started under fast forward is played
  assert.ok(l.effects.oscillation);
  vm.op_SHOK("20", "0", "300", "20");
  assert.ok(vm.gfx.shake);
  vm.op_MSQK("1000", "5", "5");
  assert.ok(vm.gfx.textShake);
  vm.skip = false;
  vm.skipPaced = false;
  vm.op_STGS("4", "255", "0", "3000", "0");
  vm.skip = true;
  assert.equal(l.alpha.done(vm.now()), true);
  assert.equal(l.effects.quake, undefined);
  assert.equal(vm.gfx.shake, null);
  vm.stop();
});

test("Item 110: SHOK under fast forward steps 33 frames a frame (native frames: 0.87 of its level down, none, 0.87 up ...)", () => {
  const { vm } = machine();
  vm.skip = true;
  vm.op_SHOK("20", "0", "300", "20");            // 18 frames a turn, 20 turns
  const xs = [];
  for (let i = 0; i < 12; i++) { vm.tick(); xs.push(effectOffset(vm.gfx.shake, vm.now())[0]); }
  // sin(2 pi 33 n / 18) x (1 - 33 n / 360) x 20
  const want = (n) => Math.sin(2 * Math.PI * 33 * n / 18) * Math.max(0, 1 - 33 * n / 360) * 20;
  for (let i = 0; i < 10; i++) assert.ok(Math.abs(xs[i] - want(i + 1)) < 1e-6, `frame ${i + 1}: ${xs[i]} against ${want(i + 1)}`);
  assert.equal(xs[10], 0);                       // 363 frames: over
  vm.stop();
});

test("Item 110: the RGB split counts the display's frames: a FADE 41 under fast forward still fades for 60 of them (0x2f910 has no step)", () => {
  const { vm, pass } = machine();
  vm.op_FADE("40", "-1", "8");
  vm.skip = true;
  for (let i = 0; i < 4; i++) { vm.tick(); pass(FRAME); }
  assert.equal(splitSample(vm.gfx.split, vm.frameNow()).alpha, 1);
  vm.op_FADE("41");
  assert.ok(vm.gfx.split);                       // not cut off
  for (let i = 0; i < 30; i++) { vm.tick(); pass(FRAME); }
  assert.ok(Math.abs(splitSample(vm.gfx.split, vm.frameNow()).alpha - 0.5) < 0.02);   // half way after 30 frames, the script 990 frames on
  for (let i = 0; i < 31; i++) { vm.tick(); pass(FRAME); }
  assert.equal(splitSample(vm.gfx.split, vm.frameNow()).alpha, 0);
  vm.stop();
});

test("Item 110: the window commands take a frame each, and fast forward keeps CLO4's and CLO5's times", async () => {
  const { vm, calls } = machine();
  vm.skip = true;
  assert.equal(await stepsOf(vm, Promise.resolve(vm.op_CLO4("1000"))), 1);
  assert.equal(await stepsOf(vm, Promise.resolve(vm.op_CLO5("1000"))), 1);
  assert.equal(await stepsOf(vm, Promise.resolve(vm.op_CLO3())), 1);
  assert.equal(await stepsOf(vm, Promise.resolve(vm.op_CLO2())), 1);
  assert.deepEqual(calls, ["out:1000", "in:1000"]);
  vm.stop();
});

// The page's elements, enough for TextBox.
function textDom() {
  class El {
    constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.className = ""; this._text = ""; this.dataset = { dashFor: "" }; const me = this;
      this.style = { opacity: "", setProperty() {}, getPropertyValue: () => "set" };
      this.classList = { add(c) { const s = new Set(me.className.split(" ").filter(Boolean)); s.add(c); me.className = [...s].join(" "); },
        remove(c) { me.className = me.className.split(" ").filter((x) => x && x !== c).join(" "); },
        contains(c) { return me.className.split(" ").includes(c); } }; }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    after() {}
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
    set textContent(t) { this._text = t; this.children = []; }
    closest(tag) { for (let n = this; n; n = n.parent) if (n.tag === tag) return n; return null; }
    all(t) { const out = [], walk = (n) => { for (const c of n.children) { if (t(c)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelectorAll(sel) {
      if (sel === "rt .ch") return this.all((c) => c.tag !== "#text" && c.classList.contains("ch") && c.closest("rt"));
      if (sel[0] === ".") return this.all((c) => c.tag !== "#text" && c.classList.contains(sel.slice(1)));
      return this.all((c) => c.tag === sel);
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    getClientRects() { return []; }
  }
  const els = { text: new El("div"), panel: new El("div"), note: new El("div") };
  globalThis.document = { getElementById: (id) => els[id] || null, createElement: (t) => new El(t), createTextNode: (t) => { const n = new El("#text"); n.textContent = t; return n; } };
  return els;
}

test("Item 110: a line under fast forward: nothing on the frame it is set, whole on the next, typed on the third; an MSAD's is there at once", () => {
  textDom();
  try {
    const box = new textbox.TextBox();
    box.setOpen(true, true); box.closed = false; box.speed = 250; box.charFade = true;
    let typed = false;
    box.add("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123", { rush: true }).then(() => { typed = true; });
    const shown = () => box.run ? box.run.chars.filter((c) => c.classList.contains("on")).length : -1;
    box.tick(1, 33); assert.equal(shown(), 0);
    box.tick(1, 33); assert.equal(shown(), 30);
    assert.equal(box.typing, true);
    box.tick(1, 33); assert.equal(box.typing, false);
    // an MSAD's text is set with no hold: whole on its first frame, typed on the second
    box.add("Bbbb", { inline: true, rush: true });
    box.tick(1, 33); assert.equal(shown(), 4);
    box.tick(1, 33); assert.equal(box.typing, false);
    // at the text's own speed the same line takes its letters' time
    box.add("ABCD", {});
    box.tick(1); box.tick(1); assert.equal(shown(), 1);
  } finally { delete globalThis.document; }
});

test("Item 110: the window's fades go 33 frames a frame of fast forward (0x38d40): a closed window is whole on the message's first frame", () => {
  textDom();
  try {
    const box = new textbox.TextBox();
    box.setOpen(true, true); box.closed = false; box.speed = 35; box.charFade = false;
    box.closeForFade();
    box.beginMessage();                          // fades back in over 18 frames
    box.add("Gggg", { rush: true });
    const shown = () => box.run ? box.run.chars.filter((c) => c.classList.contains("on")).length : 4;
    box.tick(1, 33);
    assert.equal(box.fade, 1); assert.equal(box.rate, 0); assert.equal(shown(), 0);
    box.tick(1, 33); assert.equal(shown(), 4);
    // CLO4 of 1000 ms: 33 / 60 a frame, so the window (which shows above a level of a half) is gone on the first frame
    box.fadeOut(1000);
    box.tick(1, 33);
    assert.ok(Math.abs(box.fade - 0.45) < 1e-9);
    box.tick(1, 33);
    assert.equal(box.fade, 0);
    // at normal speed the same fade-in takes its 18 frames
    box.beginMessage();
    for (let i = 0; i < 17; i++) box.tick(1);
    assert.ok(box.fade < 1);
    box.tick(1);
    assert.equal(box.fade, 1);
  } finally { delete globalThis.document; }
});

test("Item 110: a message takes three frame steps under fast forward and an MSAD two, whatever the text box (20 pages a second)", async () => {
  const { vm } = machine();
  vm.skip = true;
  const from = vm.ticks;
  assert.equal(await stepsOf(vm, vm.ticksSince(from, 3)), 3);
  assert.equal(await stepsOf(vm, vm.ticksSince(vm.ticks, 2)), 2);
  // not under a run that draws nothing, nor at normal speed
  vm.skip = false;
  assert.equal(await stepsOf(vm, vm.ticksSince(vm.ticks, 3)), 0);
  vm.stop();
});

test("Item 110: the mixer's levels move 65 times as fast while fast forward runs, from where they are", () => {
  const a = new Audio();
  const rec = { lv: new Level(0, 0, 100, 100 / 180), state: 1 };   // a 3 s fade-in
  a.bgm = rec;
  a.ctx = { currentTime: 1 };
  a.schedule = () => {};
  assert.ok(Math.abs(rec.lv.at(1) - 100 / 3) < 1e-6);
  a.setSpeed(65);
  assert.ok(Math.abs(rec.lv.at(1) - 100 / 3) < 1e-6);            // no jump as it changes
  assert.equal(rec.lv.at(1 + 2 / 65 + 1e-9), 100);               // the 2 s left take 2 / 65 s
  a.setSpeed(1);
  const slow = new Level(1, 0, 100, 100 / 180);
  assert.ok(Math.abs(slow.at(2) - 100 / 3) < 1e-6);
});

test("Item 110: speed lines make one batch a frame of fast forward, not one for each of its 33 frames", async () => {
  const presets = JSON.parse((await import("node:fs")).readFileSync(new URL("../../web/assets/effects.json", import.meta.url), "utf8")).focusLines;
  const s = startLines(19, 0);
  let n = 0;
  const now = 33 * FRAME * 3;                    // three frames of fast forward on
  while (linesDue(s, presets, now) !== null && n < 100) { linesBatch(s, presets, now); n++; }
  assert.equal(n, 1);
});
