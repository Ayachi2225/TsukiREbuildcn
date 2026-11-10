// Checks for the ten "Priority 1" items of web-dev/audit/TODO.md (2026-11-09): 58, 116, 64, 63, 62, 61, 66, 111, 67, 68.
// Each was compared with the native build where the item says so (web-dev/audit/FIXES.md, "Priority 1 of TODO.md").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };

const { VM } = await import("../../web/app/js/vm.js");
const { Audio } = await import("../../web/app/js/audio.js");
const { withContext } = await import("./fake-audio.mjs");

const source = (name) => readFileSync(new URL(`../../web/app/${name}`, import.meta.url), "utf8");
const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));

// A script machine with stand-ins for drawing, text and sound.
function machine(extra = {}) {
  const node = { innerHTML: "", style: { top: "" } };
  globalThis.document = { getElementById: () => node };
  const text = { pageParts: [], typing: false, intro: false, clear() { this.pageParts = []; }, setIntro() {}, setOpen() {},
    closeNow() {}, closeQuick() {}, fadeOut() {}, fadeIn() {}, addBreak() {}, beginMessage() {}, continueMessage() {},
    setWhole() {}, log() {}, unlog() {}, add: async () => {}, finish() {}, rows: () => ({}), ...extra.text };
  const audio = { snapshot: () => ({ bgm: null, se: [], last: Array(20).fill(-1), lastMusic: 0 }), restore() {}, stopVoice() {}, playVoice() {}, characterOf: () => -1,
    voiceDone: () => new Promise(() => {}), ...extra.audio };
  const gfx = { load: async () => ({ tex: null, w: 100, h: 100 }), tex: new Map(), hold() {}, ...extra.gfx };
  const vm = new VM({ gfx, text, audio, ...extra.hooks });
  vm.script = { name: "synthetic", ops: [], labels: {} };
  vm.lines = [];
  vm.read = new Uint8Array(16);
  vm.armAuto = () => {};
  return vm;
}

// ---- 58: a first line that goes on without a click is its page's checkpoint as it starts ---------------------------
test("Item 58: a first line with @e or @n is the checkpoint as the MSG starts (0x6e0d0 -> 0x5a910 -> 0x527f0), not the page's first wait", async () => {
  const vm = machine();
  vm.vars.F823 = 1;
  vm.op_VPLY("V1");
  vm.pc = 4;                                                   // the MSG is op 3
  await vm.message("one@k@e", false);
  const cp = vm.savePoint;
  assert.equal(cp.pc, 3);                                      // the MSG itself: a load runs it again
  assert.equal(cp.msgStart, true);
  assert.equal(cp.waiting, false);
  assert.equal(cp.voice, "V1");                                // the record's voice (0xae08b0)
  assert.equal(cp.noteText, "one");
  assert.equal(cp.vars.F823, 1);
  vm.vars.F823 = 2;                                            // line two waits: the checkpoint stays on the first line
  vm.pc = 9;
  const p = vm.message("two", false);
  await waitFor(1); vm.advance(); await p;
  assert.equal(vm.savePoint, cp);
  assert.equal(vm.trail.at(-1).pc, 9);                         // the wait's own rewind point is still made

  // @n, commands, then the MSAD that waits: the MSG's record stays the newest (no record until the next MSG, 0x146e644),
  // so the MSAD copies it again with its own text (0x6e950) and a load plays the stretch between them again
  vm.vars.F823 = 1;
  vm.pc = 21;
  await vm.message("three@n", false);
  const cp2 = vm.savePoint;
  assert.equal(cp2.pc, 20);
  assert.equal(cp2.msgStart, true);
  vm.pc = 25;
  const q = vm.message("four", true);
  await waitFor(1); vm.advance(); await q;
  assert.equal(vm.savePoint, cp2);
  assert.equal(cp2.noteText, "four");
  assert.equal(cp2.pc, 20);
  vm.stop();
});

test("Item 58: a first line that waits for its click keeps the wait's record, and a later line or a locked stretch moves nothing", async () => {
  const vm = machine();
  vm.vars.F823 = 1;
  vm.pc = 3;
  let p = vm.message("one", false);
  await waitFor(1); vm.advance(); await p;
  assert.equal(vm.savePoint.pc, 3);
  assert.equal(vm.savePoint.waiting, true);
  assert.equal(vm.savePoint.msgStart, undefined);
  const cp = vm.savePoint;
  vm.vars.F823 = 2;                                            // a later line with @e: not a first line, nothing moves
  vm.pc = 5;
  await vm.message("two@e", false);
  assert.equal(vm.savePoint, cp);
  vm.vars.F823 = 1;
  vm.locked = true;                                            // XSTP .. XRSM holds records back (+0x35c0)
  vm.pc = 7;
  await vm.message("three@e", false);
  assert.equal(vm.savePoint, cp);
  vm.locked = false;
  // "Display whole text": a line that does not end the page goes on by itself, so the first line's record is the checkpoint
  vm.wholeRead = vm.wholeUnread = true;
  vm.pageEnd = false;
  vm.pc = 11;
  await vm.message("four", false);
  assert.equal(vm.savePoint.pc, 10);
  assert.equal(vm.savePoint.msgStart, true);
  vm.stop();
});

test("Item 58: loading that checkpoint runs the first line again, with its voice, and goes on to the next line; the label Z commands do not run twice", async () => {
  const shown = [], played = [], steps = [];
  const vm = machine({ text: { add: async (t) => { shown.push(t); } }, audio: { playVoice: (n) => played.push(n) } });
  vm.script = { name: "synthetic", labels: {}, zl: { 1: [[0x501, ""]] }, zm: { 1: 0x502, 5: 0x503 },
    ops: [["VPLY", "V1"], ["MSG", "one@k@e"], ["VPLY", "V2"], ["WKAD", "F823", "1"], ["WNTY", "1"], ["MSG", "two"], ["END_"]] };
  vm.getScript = async () => vm.script;
  const zStep = vm.zStep.bind(vm);
  vm.zStep = (c) => { steps.push(c); zStep(c); };
  vm.vars.F823 = 1;
  vm.running = true;
  vm.generation = 1;
  vm.loop(1);
  await waitFor(20);
  assert.deepEqual(shown, ["one", "two"]);
  assert.deepEqual(played, ["V1", "V2"]);
  assert.deepEqual(steps, [0x501, 0x502, 0x503]);
  const save = JSON.parse(JSON.stringify(vm.savePoint));       // as a save stores it
  assert.equal(save.pc, 1);
  shown.length = played.length = steps.length = 0;
  await vm.restore(save);
  await waitFor(20);
  assert.deepEqual(shown, ["one", "two"]);                     // the game types line one again, then line two (native run)
  assert.deepEqual(played, ["V1", "V2"]);
  assert.deepEqual(steps, [0x502, 0x503]);                     // the ZZ before the MSG ran before the record was made
  assert.equal(vm.savePoint.pc, 1);
  assert.equal(vm.waitResolve !== null, true);                 // waiting on line two
  vm.stop();
  // a save's note is the line's text (the record's +0x3684), as the page is still empty at that point
  assert.match(source("js/main.js"), /s\.note = p\.noteText \?\? /);
});

test("Item 58: a first line that went on without a click keeps its record: a rewind from the next page lands on it and waits there (0x814c0; native run)", async () => {
  const shown = [];
  const vm = machine({ text: { add: async (t) => { shown.push(t); }, retype: async () => { shown.push("retyped"); } } });
  vm.getScript = async () => vm.script;
  vm.script = { name: "synthetic", labels: {}, ops: [["END_"], ["END_"], ["END_"], ["END_"], ["END_"], ["END_"], ["END_"], ["END_"], ["END_"], ["END_"]] };
  vm.vars.F823 = 1;                                            // page 1, one line
  vm.pc = 1;
  let p = vm.message("page one", false);
  await waitFor(1); vm.advance(); await p;
  vm.vars.F823 = 1;                                            // page 2: an @e first line, then a line that waits
  vm.pc = 3;
  await vm.message("first@k@e", false);
  assert.equal(vm.trail.length, 2);
  assert.equal(vm.trail[1].passed, true);
  assert.equal(vm.trail[1].pc, 3);
  assert.equal(vm.rewindTarget(false), 0);                     // until the next MSG starts, that record is where the player is: the page before
  vm.vars.F823 = 2;
  vm.pc = 5;
  p = vm.message("second", false);
  await waitFor(1);
  assert.equal(vm.rewindTarget(false), 1);                     // from the second line: the page's own first line
  vm.advance(); await p;
  vm.vars.F823 = 1;                                            // page 3
  vm.pc = 7;
  p = vm.message("page three", false);
  await waitFor(1);
  assert.equal(vm.rewindTarget(false), 1);                     // one page back, not two
  shown.length = 0;
  await vm.rewind();
  await waitFor(5);
  assert.deepEqual(shown, ["retyped"]);
  assert.equal(vm.pc, 3);
  assert.ok(vm.waitResolve, "the rewind waits on the line for a click");
  // a Quick Jump runs the message again (0x28d50 -> 0x5baf0 with 0), so the line goes on by itself as it did
  const rec = { ...vm.trail.at(-1) };
  vm.stop();
  shown.length = 0;
  await vm.restore({ ...rec, passed: true }, { rewind: true, restartMusic: true, retype: true, voice: true });
  await waitFor(5);
  assert.equal(vm.waitResolve, null);
  assert.equal(vm.running, false);                             // ran on to the END_ at op 3
  vm.stop();
  // a record made while the controls are locked is no rewind target (+0x35c0, 0x816e4)
  const held = machine();
  held.vars.F823 = 1; held.pc = 1;
  p = held.message("page one", false);
  await waitFor(1); held.advance(); await p;
  held.locked = true; held.pc = 3;
  await held.message("locked@e", false);
  held.locked = false; held.vars.F823 = 2; held.pc = 5;
  p = held.message("after", false);
  await waitFor(1);
  assert.equal(held.rewindTarget(false), 0);
  held.stop();
});

test("Found with item 58: a record made inside an instant run holds the run's recorded sound, not the silence it runs in", async () => {
  let playing = { bgm: { n: 5, vol: 1, loop: true }, se: [], last: Array(20).fill(-1), lastMusic: 100 };
  const vm = machine({ audio: { snapshot: () => structuredClone(playing), restore(s) { playing = structuredClone(s); },
    stopPlaying() { playing = { ...playing, bgm: null, se: [] }; } } });
  vm.lines = ["a line not read yet"];
  vm.running = true;
  vm.fastForwardRead = true;
  vm.beginInstant();                                           // a read scene's skip: everything stops, the music is only recorded
  assert.equal(playing.bgm, null);
  vm.vars.F823 = 1;
  vm.pc = 1;
  vm.message("$0", false);                                     // the run stops at this line and the music comes back
  await waitFor(5);
  assert.equal(vm.instant, false);
  assert.equal(playing.bgm.n, 5);
  assert.equal(vm.trail.at(-1).audio.bgm.n, 5);                // the line's record, which is also the checkpoint a save takes
  assert.equal(vm.savePoint.audio.bgm.n, 5);
  vm.stop();
});

// ---- 116: the text window's pictures go into the frame before the display curve ------------------------------------
test("Item 116: the window's pictures are the renderer's to draw, at the window's opacity, placed as the page's elements were (0x391a0)", async () => {
  const { TextBox } = await import("../../web/app/js/textbox.js");
  const els = {};
  const fakeEl = () => ({ style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} }, textContent: "", querySelectorAll: () => [], after() {} });
  globalThis.document = { getElementById: (id) => (els[id] ||= fakeEl()), createElement: fakeEl, fonts: null };
  const box = new TextBox();
  assert.deepEqual(box.pictures(), [{ path: "DISP_PARTS_JA/txtwindow01-1920", full: true, alpha: 0 }]);
  box.fadeIn(2000);
  for (let i = 0; i < 90; i++) box.tick(1);                    // fade 0.75: the picture at g x panel
  assert.ok(Math.abs(box.pictures()[0].alpha - Number(els.panel.style.opacity)) < 1e-12);
  assert.ok(box.pictures()[0].alpha > 0);
  box.windows = { styles: [["txtwindow01-1920", 0, 0, 0, 0, 0], ["txtwindow02-1920", 0, 0, 0, 0, 0], ["txtwindow03-1920", 0, 0, 0, 0, 0],
    ["balloonA", 525, 414, 98, 80, 300], ["balloonB", 100, 50, 10, 10, 200]], x: [0, 30], y: [0, 20] };
  box.setWindow({ style: 1, x: 0, y: 0, style2: 0, x2: 0, y2: 0 });
  assert.deepEqual(box.pictures().map((p) => [p.path, p.full]), [["DISP_PARTS_JA/txtwindow02-1920", true]]);
  box.setWindow({ style: 3, x: 1, y: 1, style2: 4, x2: 0, y2: 0 });   // a balloon at its table place plus the chosen offsets, and a second one
  const [a, b] = box.pictures();
  assert.deepEqual([a.path, a.x, a.y, a.full], ["DISP_PARTS_JA/balloonA", (525 + 30) * 1.5, (414 + 20) * 1.5, undefined]);
  assert.deepEqual([b.path, b.x, b.y], ["DISP_PARTS_JA/balloonB", 150, 75]);
  box.panelAlpha = 1; box.fade = 1; box.closed = false; box.intro = false; box.render();
  assert.ok(Math.abs(a.alpha - box.pictures()[0].alpha) < 1 && Math.abs(box.pictures()[0].alpha - 200 / 255) < 1e-12);   // balloons at 200 / 255
  box.intro = true; box.render();                              // F1104: the text without the window picture
  assert.equal(box.pictures()[0].alpha, 0);
});

test("Item 116: the renderer blends the window in before its last pass, as a picture read through working(); the page's elements only stand in until it has loaded", () => {
  const src = source("js/renderer.js"), main = source("js/main.js"), css = source("style.css");
  const present = src.slice(src.indexOf("  present(now, window = true) {"));
  assert.ok(present.indexOf("this.drawWindow()") > 0 && present.indexOf("this.drawWindow()") < present.indexOf("this.displayProg.p"), "the window goes in before the display curve");
  assert.ok(present.indexOf("this.drawWindow()") > present.indexOf("this.menuB.tex"), "and over the menu's blurred frame, as the element lay");
  const fs = src.slice(src.indexOf("const FS_WINDOW"), src.indexOf("const FS_FADE"));
  assert.match(fs, /working\(s\) \* c\.a, c\.a\) \* alpha/);   // premultiplied, in the working space
  const draw = src.slice(src.indexOf("  drawWindow() {"), src.indexOf("  present(now, window = true) {"));
  assert.match(draw, /blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/);
  assert.match(draw, /this\.windowReady = list\.length > 0 && list\.every/);
  // the display curve is why it matters: a stored 40 behind the 0.4 veil shows as 17 through the curve, 21 with the veil laid on after it
  const show = (v) => { const l = (v / 255) ** 2.2; return 255 * (l > 0.0031308 ? 1.055 * l ** (1 / 2.4) - 0.055 : 12.92 * l); };
  assert.equal(Math.round(show(40 * 0.6)), 17);
  assert.equal(Math.round(show(40) * 0.6), 21);
  // native frame (grey steps behind the window): 35 -> 16, 61 -> 33, 96 -> 55, 145 -> 85; the curve gives them within a level
  for (const [stored, seen] of [[40, 16], [64, 33], [96, 55], [144, 85]]) assert.ok(Math.abs(show(stored * 0.6) - seen) <= 1.2, `${stored}`);
  assert.match(main, /gfx\.windowPics = windowPictures\(tx, ty\);\n  gfx\.present\(now\);/);
  assert.match(main, /c\.contains\("notext"\) \|\| c\.contains\("in-log"\)\) return \[\]/);
  assert.match(main, /--under-menu/);
  assert.match(main, /gfx\.present\(vm\.now\(\), false\);/);   // a save's picture is taken without the window
  assert.match(css, /\.canvas-window #panel, \.canvas-window #panel2 \{ visibility: hidden; \}/);
});

// ---- 64, 63: the voice wait and a muted speaker ---------------------------------------------------------------------
// An Audio on the fake context whose voices are told apart by name; rows: every name's row is its first letter's (A = 0, B = 1).
function voices() {
  const audio = new Audio();
  const h = withContext(audio);
  audio.rowOf = (name) => name.charCodeAt(0) - 65;
  for (let r = 0; r < 4; r++) { audio.vol.charOn[r] = true; audio.vol.chars[r] = 1; }
  const made = [];
  audio.buffer = async (url) => { made.push(decodeURIComponent(url.split("/").pop()).replace(".ogg", "")); return { duration: 5, numberOfChannels: 1 }; };
  return { audio, h, made };
}

test("Item 64 (N2-126): a voice wait ends with the newest voice, not with an older one still playing on the other handle (0x9c400 -> 0x9b520(-1))", async () => {
  const { audio, h } = voices();
  await audio.playVoice("A_long", true);                       // VPL2
  await audio.playVoice("B_short", true);                      // VPL2 over it: handles 2 and 3 in turn (0x9b570)
  const [long, short] = h.ctx.sources.filter((s) => s.started);
  assert.equal(audio.voice.length, 2);
  let done = false;
  audio.voiceDone().then(() => { done = true; });
  await waitFor(1);
  assert.equal(done, false);
  assert.equal(audio.voicePlaying, true);
  short.end();                                                 // the newest ends; the older one plays on
  await waitFor(1);
  assert.equal(done, true, "the wait is over (native run: 0.8 s after the second voice, with 7.5 s of the first left)");
  assert.equal(audio.voicePlaying, false);
  assert.equal(audio.voice.length, 1);
  assert.equal(long.stopped, false);
  // the other way round: the older ends first, and the wait goes on for the newest
  await audio.playVoice("A_two", true);
  await audio.playVoice("B_two", true);
  const [, , , newest] = h.ctx.sources.filter((s) => s.started);
  const older = h.ctx.sources.filter((s) => s.started)[2];
  done = false;
  audio.voiceDone().then(() => { done = true; });
  older.end();
  await waitFor(1);
  assert.equal(done, false);
  assert.equal(audio.voicePlaying, true);
  // a voice started during the wait becomes the one waited for
  await audio.playVoice("A_three", true);
  const third = h.ctx.sources.filter((s) => s.started).at(-1);
  newest.end();
  await waitFor(1);
  assert.equal(done, false);
  third.end();
  await waitFor(1);
  assert.equal(done, true);
  // busy from the moment it is asked for, while its file loads
  let release;
  audio.buffer = () => new Promise((r) => { release = () => r({ duration: 1, numberOfChannels: 1 }); });
  audio.playVoice("A_four");
  assert.equal(audio.voicePlaying, true);
  release();
});

test("Item 63 (N2-125): a line whose speaker's row is switched off starts no voice and leaves the one playing alone (0x6e6dc before 0x9c3b0)", async () => {
  const { audio, h, made } = voices();
  await audio.playVoice("A_line1");
  const first = h.ctx.sources.filter((s) => s.started)[0];
  const handle = audio.voiceHandle;
  audio.vol.charOn[1] = false; audio.vol.chars[1] = 0;         // B's row off
  await audio.playVoice("B_line2");                            // the next line's voice
  assert.equal(first.stopped, false, "the earlier voice plays on (native run: to its end, 8.4 s)");
  assert.deepEqual(made, ["A_line1"]);
  assert.equal(audio.voiceHandle, handle);                     // the handle in use is still the first voice's: a VCWT waits for it
  assert.equal(audio.voicePlaying, true);
  await audio.playVoice("B_vpl2", true);                       // VPL2 tests the row too (0x7a49c)
  assert.equal(audio.voice.length, 1);
  audio.vol.charOn[1] = true; audio.vol.chars[1] = 1;          // with the row on the line cuts it, as before
  await audio.playVoice("B_line3");
  assert.equal(first.stopped, true);
  // the script machine: no voice of its own for that line, so nothing to wait for or to cut at the click
  const calls = [];
  const vm = machine({ audio: { voiceOff: (n) => n === "MUTED", playVoice: (n) => calls.push(n) } });
  vm.pendingVoice = "MUTED";
  assert.equal(vm.startPendingVoice(), false);
  vm.pendingVoice = "HEARD";
  assert.equal(vm.startPendingVoice(), true);
  assert.deepEqual(calls, ["HEARD"]);
});

// ---- 62: the delay slots go on counting behind a menu ---------------------------------------------------------------
test("Item 62 (N2-123): a delayed sound command counts down while a menu is open (0x65e50 from the mixer, every frame); the story's clock stands still", async () => {
  const calls = [];
  const vm = machine({ audio: { playSE: (ch, loop, name) => calls.push(name), volSE: (ch) => calls.push(`vol${ch}`), fadeSE: (ch) => calls.push(`fade${ch}`) } });
  let t = 1000;
  vm.clock.read = vm.soundClock.read = () => t;
  const later = async (ms) => { t += ms; await waitFor(70); };
  vm.op_SEPL("3", "0", "DOOR", "`068:500");
  vm.op_SEFD("4", "`001:300", "`068:500");
  vm.op_SEVL("5", "`017:40", "`068:500");
  vm.running = true;
  vm.paused = true;                                            // the system menu, the backlog, a dialog: ui.js sets it for any page
  const frozen = vm.now();
  await later(600);
  assert.equal(vm.now(), frozen, "pictures and waits are held");
  assert.deepEqual(calls.sort(), ["DOOR", "fade4", "vol5"], "the sound commands act behind the menu (native run: on time, with the menu open)");
  assert.equal(vm.delayed.size, 0);
  // a record made with the menu open keeps what is left on the sound clock
  vm.op_SEPL("6", "0", "LATE", "`068:1000");
  await later(400);
  const left = vm.delayedState()[0].left;
  assert.ok(left > 550 && left <= 600, String(left));
  vm.paused = false;
  // the port's own holds stop both clocks: pictures still loading, a hidden tab
  vm.holdClocks("hidden", true);
  await later(2000);
  assert.equal(vm.delayed.size, 1);
  vm.holdClocks("hidden", false);
  await later(700);
  assert.deepEqual(calls.at(-1), "LATE");
  vm.stop();
  assert.match(source("js/main.js"), /vm\.holdClocks\("hidden", document\.hidden\)/);
});

// ---- 66: a delayed sound after Return to Title and a load in the same run --------------------------------------------
test("Item 66: a load made in the same run as a Return to Title puts the delay slot back and the sound plays (native run: it plays there too; no change)", async () => {
  const played = [];
  const vm = machine({ audio: { playSE: (ch, loop, name) => played.push(name), volSE() {}, fadeSE() {} } });
  vm.getScript = async () => vm.script;
  vm.script = { name: "synthetic", labels: {}, ops: [["END_"]] };
  vm.op_SEPL("3", "0", "LATER", "`068:150");                   // queued just before a page's first line
  const save = JSON.parse(JSON.stringify(vm.point()));         // the checkpoint the automatic save takes on the way to the title
  assert.equal(save.delayed.length, 1);
  vm.stop();                                                   // Return to Title: the slots are emptied (0x5f200)
  assert.equal(vm.delayed.size, 0);
  await waitFor(220);
  assert.deepEqual(played, [], "nothing plays at the title");
  await vm.restore(save);                                      // Continue, the same run
  assert.equal(vm.delayed.size, 1);
  await waitFor(220);
  assert.deepEqual(played, ["LATER"]);                         // the game: a 15 s delay sounds 15 s after the load, as after a fresh start
  vm.stop();
});

// ---- 61: a stop-all leaves the track fading on the other music handle -----------------------------------------------
test("Item 61 (N2-127): a load, Quick Jump, Return to Previous Scene or Return to Title stops the music handle in use only; the old track of a crossfade falls on (0x9c650, 0x9c610)", async () => {
  const play = async () => {
    const audio = new Audio();
    const h = withContext(audio);
    audio.table = { bgm: Array.from({ length: 40 }, (_, i) => `T${i}`) };
    await audio.playBGM(5, { "017": 100 });
    h.ctx.currentTime = 2;
    await audio.playBGM(9, { "017": 100, "001": 4000 });       // a crossfade: track 5 moves to the other handle and falls over 4 s
    h.ctx.currentTime = 3;
    return { audio, h, old: audio.bgmOld, cur: audio.bgm };
  };
  for (const stop of ["stopAll", "stopPlaying", "restore"]) {
    const { audio, h, old, cur } = await play();
    const level = old.lv.at(3);
    assert.ok(level > 50 && level < 100, `${stop}: the old track is a quarter down (${level})`);
    if (stop === "restore") audio.restore({ bgm: null, se: [], last: Array(20).fill(-1), lastMusic: 100 }, { restartMusic: true });
    else audio[stop]();
    assert.equal(cur.state, 0, `${stop}: the track in use stops at once`);
    assert.equal(audio.bgm, null);
    assert.equal(audio.bgmOld, old, `${stop}: the old one keeps its handle`);
    assert.equal(old.state, 2);
    assert.ok(Math.abs(old.lv.at(4) - 50) < 1, `${stop}: and goes on falling at its rate`);
    // the next track takes that handle, cutting what was left (0x9c6d0 / 0x9c470)
    await audio.playBGM(7, { "017": 100 });
    assert.equal(old.state, 0);
    assert.equal(h.ctx.sources.length >= 3, true);
  }
});

test("Item 61: the three stops no longer touch the other handle", () => {
  const src = source("js/audio.js");
  const body = (name) => { const at = src.indexOf(`  ${name}(`); return src.slice(at, src.indexOf("\n  }\n", at)); };
  assert.doesNotMatch(body("stopAll"), /bgmOld/);
  assert.doesNotMatch(body("stopPlaying"), /bgmOld/);
  assert.doesNotMatch(body("restore"), /kill\(this\.bgmOld\)/);
});

// ---- 67: a story movie counts as seen from its end -------------------------------------------------------------------
test("Item 67 (N2-171): TOMP records nothing; the movie counts as seen when its showing ends or is passed (0x40a00 -> 0x923c0)", () => {
  const started = [];
  const vm = machine({ hooks: { playMovie: (name, opts) => { started.push([name, opts.seen]); return new Promise(() => {}); } } });
  vm.movies = { 5: "op1_arc" };
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  vm.unlocks.storage = store;
  vm.unlocks.movies.clear();
  vm.op_TOMP("5");
  assert.deepEqual(started, [["op1_arc", false]]);
  assert.equal(vm.unlocks.movies.has("op1_arc"), false, "nothing is recorded while it plays: a page closed now leaves it unseen");
  vm.unlocks.save();                                           // what closing the page writes
  assert.doesNotMatch(store.data["tsuki.unlocks.v1"], /op1_arc/);
  vm.unlocks.watched("op1_arc");                               // its end (main.js playMovie's finish)
  vm.op_TOMP("5");
  assert.deepEqual(started[1], ["op1_arc", true]);             // the next showing can be passed
  const main = source("js/main.js");
  const finish = main.slice(main.indexOf("    const finish = () => {"), main.indexOf("    moviesDone = () => {"));
  assert.match(finish, /if \(rule\) vm\.setVar\("G005", vm\.getVar\("G005"\) \| \(1 << rule\[0\]\)\);\n\s+if \(opts\.story\) \{ vm\.unlocks\.watched\(name\); vm\.unlocks\.save\(\); \}/);
  const tomp = source("js/vm.js");
  assert.doesNotMatch(tomp.slice(tomp.indexOf("  op_TOMP(n) {"), tomp.indexOf("  async op_TOMW() {")), /watched\(/);
});

test("a click does not pass a phase title; other movies and the keys are unchanged (TODO 140)", () => {
  const main = source("js/main.js");
  assert.match(main, /movieClicks = !name\.startsWith\("phasetitle_"\);/);
  assert.match(main, /if \(moviesDone\) \{ if \(movieClicks\) passMovie\(\); return; \}/);
  assert.match(main, /if \(moviesDone\) passMovie\(\); else if \(!showText\(\)\) vm\.press\(\);/);
});

test("trying to pass the prologue's first showing asks first, the movie held; a seen one passes as before", () => {
  const main = source("js/main.js");
  assert.match(main, /movieAsk = movieQuestion\(opts\.number, !!opts\.gallery \|\| !!opts\.seen \|\|/);   // uifx.js movieQuestion, tested in function-map.test.mjs
  const pass = main.slice(main.indexOf("const passMovie = async"), main.indexOf("// Start-up, as native"));
  assert.match(pass, /if \(!movieAsk\) \{ if \(!movieCanPass \|\| movieCanPass\(\)\) moviesDone\(\); return; \}/);
  assert.match(pass, /v\.pause\(\);\n\s+movieAsking = true;\n\s+const yes = await ui\.confirmSystem\(movieAsk, \{ startNo: true \}\);/);
  assert.match(pass, /if \(!moviesDone \|\| movieAsking \|\|/, "a second try while it asks does nothing");
  assert.match(pass, /if \(yes\) \{ movieAsk = null; moviesDone\(\); \}/, "nor one during the fade after Yes");
  assert.match(main, /case "menu":\n\s+if \(askingSkip\(\)\) passMovie\(\);/);   // the System menu key (Esc), and the pad's B
});

// ---- 68: Jump to Next Scene in a replay from the gallery's flowchart -------------------------------------------------
test("Item 68 (0x4e0c0): Jump to Next Scene is off in a replay started from the gallery's flowchart, on in the story and in an Ending List replay", async () => {
  const { UI } = await import("../../web/app/js/ui.js");
  const fake = () => { const e = { style: {}, classList: { add() {}, remove() {}, toggle() {} }, children: [], append(...c) { this.children.push(...c); }, after() {},
    addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] }; return e; };
  globalThis.document = { createElement: fake, getElementById: fake };
  const vm = { choosing: null, instant: false, replay: false, replaySource: null, previousScene: () => null, canRewind: () => false };
  let asked = 0;
  const ui = Object.assign(Object.create(UI.prototype), { vm, env: { nextScene: () => { asked++; }, hasQuickSave: () => true }, audio: { start() {} }, sound() {}, renderPanel() {} });
  ui.buildPanel();
  const defs = ui.panel.defs;
  const jump = defs.findIndex((d) => d.id === "nextScene");
  assert.equal(jump, 4);                                       // the fifth button, as on the game's panel (0xd3: its ids run 0xcf-0xd6)
  const can = (id) => defs.find((d) => d.id === id).can();
  assert.equal(can("nextScene"), true);
  vm.replay = true; vm.replaySource = "flowchart";             // *0xae0288 == 2 (0x50f0)
  assert.equal(can("nextScene"), false);
  assert.equal(can("quickSave"), false);                       // and, in any replay, the two quick buttons (0x47b10)
  assert.equal(can("quickLoad"), false);
  ui.pressPanel(jump);
  assert.equal(asked, 0, "a press on the disabled button asks nothing");
  vm.replaySource = "ending";                                  // the Ending List's replay: the section id is not the flowchart's
  assert.equal(can("nextScene"), true);
  assert.equal(can("quickSave"), false);
  ui.pressPanel(jump);
  assert.equal(asked, 1);
  vm.replay = false; vm.replaySource = null;
  vm.choosing = {};                                            // as before: not at a choice, not inside an instant run
  assert.equal(can("nextScene"), false);
});

// ---- 111: panel edges ------------------------------------------------------------------------------------------------
// The turned band's pieces, read out of FS_FRAME and worked out in JavaScript: each `piece(q, at, size, uv0, uv1, inv)` line.
function turnedPieces(W, H, w) {
  const src = source("js/renderer.js");
  const body = src.slice(src.indexOf("float turnedBand(vec2 q, vec2 wh, float w) {"), src.indexOf("void main() {", src.indexOf("float turnedBand(")));
  const env = { W, H, w };
  const vec2 = (x, y = x) => [x, y];
  const add = (a, b) => (typeof b === "number" ? [a[0] + b, a[1] + b] : [a[0] + b[0], a[1] + b[1]]);
  const sub = (a, b) => (typeof b === "number" ? [a[0] - b, a[1] - b] : [a[0] - b[0], a[1] - b[1]]);
  // the four hanging points, then the pieces' arguments (only +, - of vectors and plain arithmetic of W, H, w appear)
  const points = { c0: [0.5 * w, 0.5 * w], c1: [W - 0.5 * w, 0.5 * w], c2: [0.5 * w, H - 0.5 * w], c3: [W - 0.5 * w, H - 0.5 * w] };
  const term = (s) => {
    s = s.trim();
    const m = /^(c[0-3])(?: ([+-]) (.+))?$/.exec(s);
    if (m) return !m[2] ? points[m[1]] : (m[2] === "+" ? add : sub)(points[m[1]], term(m[3]));
    const v = /^vec2\((.+)\)$/.exec(s);
    if (v) { const parts = split(v[1]); return parts.length === 1 ? vec2(num(parts[0])) : [num(parts[0]), num(parts[1])]; }
    return num(s);
  };
  const num = (s) => Function("W", "H", "w", `return (${s});`)(env.W, env.H, env.w);
  const split = (s) => { const out = []; let depth = 0, cur = ""; for (const ch of s) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  return [...body.matchAll(/k = piece\(q, (.+)\); a \+= \(1\.0 - a\) \* k;/g)].map((m) => {
    const [at, size, uv0, uv1, inv] = split(m[1]);
    return { at: term(at), size: term(size), uv0: term(uv0), uv1: term(uv1), inv: inv === "1" };
  });
}

test("Item 111 (0x34a70's turned branch): a turned panel's band is hung on points half a width in from each side, so its sides differ and its corners leave gaps", () => {
  const W = 900, H = 500, w = 30;
  const pieces = turnedPieces(W, H, w);
  assert.equal(pieces.length, 16);                            // two for each corner and each side
  const rect = (p) => [p.at[0], p.at[1], p.at[0] + p.size[0], p.at[1] + p.size[1]];
  const find = (x0, y0, x1, y1) => pieces.find((p) => rect(p).every((v, i) => Math.abs(v - [x0, y0, x1, y1][i]) < 1e-9));
  // the top side: a strip 2 w deep ending half a width inside the edge (the blob's column rising to its peak there), then one w deep, falling
  const top1 = find(w, -1.5 * w, W - w, 0.5 * w), top2 = find(2 * w, 0.5 * w, W - 2 * w, 1.5 * w);
  assert.deepEqual([top1.uv0, top1.uv1, top2.uv0, top2.uv1], [[0.5, 0], [0.5, 0.5], [0.5, 0.5], [0.5, 1]]);
  // the bottom side is hung the same way round, so there the long rise is the part inside: from 2.5 w in, with the peak half a width before the edge
  const bottom1 = find(w, H - 2.5 * w, W - w, H - 0.5 * w), bottom2 = find(2 * w, H - 0.5 * w, W - 2 * w, H + 0.5 * w);
  assert.deepEqual([bottom1.uv0, bottom1.uv1, bottom2.uv0, bottom2.uv1], [[0.5, 0], [0.5, 0.5], [0.5, 0.5], [0.5, 1]]);
  // left as the top, right as the bottom
  assert.ok(find(-1.5 * w, w, 0.5 * w, H - w) && find(0.5 * w, 2 * w, 1.5 * w, H - 2 * w));
  assert.ok(find(W - 2.5 * w, w, W - 0.5 * w, H - w) && find(W - 0.5 * w, 2 * w, W + 0.5 * w, H - 2 * w));
  // the corners: the blob's quarter half a width out of place, the inverted blob's quarter next to it
  const tl = find(-0.5 * w, -0.5 * w, 0.5 * w, 0.5 * w), tlInv = find(0.5 * w, 0.5 * w, 1.5 * w, 1.5 * w);
  assert.equal(tl.inv, false); assert.equal(tlInv.inv, true);
  assert.deepEqual([tl.uv0, tl.uv1], [[0, 0], [0.5, 0.5]]);
  const br = find(W - 0.5 * w, H - 0.5 * w, W + 0.5 * w, H + 0.5 * w), brInv = find(W - 1.5 * w, H - 1.5 * w, W - 0.5 * w, H - 0.5 * w);
  assert.deepEqual([br.uv0, br.uv1, brInv.inv], [[0.5, 0.5], [1, 1], true]);
  assert.ok(find(-0.5 * w, H - 0.5 * w, 0.5 * w, H + 0.5 * w) && find(W - 0.5 * w, -0.5 * w, W + 0.5 * w, 0.5 * w));
  // nothing covers the strip between a corner's square and the side's first strip: x from w / 2 to w along the top edge (the notch on native frames)
  const covers = (x, y) => pieces.some((p) => { const [x0, y0, x1, y1] = rect(p); return x >= x0 && x < x1 && y >= y0 && y < y1; });
  assert.equal(covers(0.75 * w, 0.25 * w), false);
  assert.equal(covers(1.25 * w, 0.25 * w), true);
  assert.equal(covers(W / 2, H - 2.4 * w), true);              // the bottom and right bands reach 2.5 w in ...
  assert.equal(covers(W - 2.4 * w, H / 2), true);
  assert.equal(covers(W / 2, 1.6 * w), false);                 // ... the top and left ones stop at 1.5 w
  assert.equal(covers(1.6 * w, H / 2), false);
});

test("Item 111: a lone turned panel with a band is composed in a buffer, picture then band then mask, as its group would be (0x36520)", () => {
  const src = source("js/renderer.js");
  const alone = src.slice(src.indexOf("    const turnedAlone = (l) => {"), src.indexOf("    // The engine's group machine"));
  assert.match(alone, /return !!g\.band && !g\.band\.solid;/);
  assert.match(alone, /drawOne\(l, 1, false, 1, true\);\s+this\.drawFrame\(clip, 1, true\);\s+this\.fadeGroupEdge\(clip\);/);
  assert.match(alone, /this\.layGroup\(this\.panelTarget, alpha\);/);
  assert.equal((src.match(/if \(turnedAlone\(l\)\) drawTurnedAlone\(l, this\.scene\.fbo\);/g) || []).length, 2);   // both draw loops
  assert.match(src, /if \(solid == 0\) a = turnedBand\(p - outer\.xy, outer\.zw, b\) \* maskFade\(p\);/);
});

test("Item 111 (0x32e30): the mask reads the blob's own halves, so style 7's lopsided blob puts the right and bottom fades 2 px further out", () => {
  const src = source("js/renderer.js");
  const fades = src.match(/vec2 uv = vec2\(d\.x > 0\.0 \? 0\.5 \+ \(past\.x > 0\.0 \? 0\.5 : -0\.5\) \* q\.x : 0\.5 - half_\.x, d\.y > 0\.0 \? 0\.5 \+ \(past\.y > 0\.0 \? 0\.5 : -0\.5\) \* q\.y : 0\.5 - half_\.y\);/g) || [];
  assert.equal(fades.length, 2);                               // FS_LAYER and FS_GROUP_EDGE
  // the edge pieces' rectangles in the game's table (0x572990, the 64 px blob): quarters, and the row and column just before the middle
  const h = 32;
  const rects = [[0, 0, h, h], [h - 1, 0, h, h], [h, 0, 2 * h, h], [0, h - 1, h, h], [h, h - 1, 2 * h, h], [0, h, h, 2 * h], [h - 1, h, h, 2 * h], [h, h, 2 * h, 2 * h]];
  assert.deepEqual(rects[4], [32, 31, 64, 32]);                // the right side's row is the blob's right half
  assert.deepEqual(rects[6], [31, 32, 32, 64]);                // the bottom side's column its lower half
  // measured on the shipped art: the plain blob is the same both ways, the _2 one reaches its half level about a texel sooner from the right / bottom
  // (9.3 texels from the top, 8.3 from the bottom at 64 px: 1.9 px of a 60 px fade), which native frames of a style 7 panel show as 2 px
  assert.ok(Math.abs((9.31 - 8.33) * 60 / 32 - 1.84) < 0.01);
});

// ---- 139: the current line in a second balloon -----------------------------------------------------------------------
// A stand-in for the page's elements with what placeCurrent needs: parents, moving a node, a class query.
function pageDom() {
  const make = (tag) => {
    const n = { tag, className: "", textContent: "", children: [], parentNode: null, dataset: { dashFor: "" }, style: { opacity: "", setProperty() {}, getPropertyValue: () => "set" } };
    const has = (e, c) => (e.className || "").split(" ").includes(c);
    n.classList = { add(c) { if (!has(n, c)) n.className = `${n.className} ${c}`.trim(); }, remove(c) { n.className = n.className.split(" ").filter((x) => x && x !== c).join(" "); },
      toggle(c, on) { if (on ?? !has(n, c)) this.add(c); else this.remove(c); }, contains: (c) => has(n, c) };
    const detach = (c) => { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c); };
    n.appendChild = (c) => { detach(c); c.parentNode = n; n.children.push(c); return c; };
    n.insertBefore = (c, ref) => { detach(c); c.parentNode = n; n.children.splice(n.children.indexOf(ref), 0, c); return c; };
    n.remove = () => { detach(n); n.parentNode = null; };
    n.after = () => {};
    n.querySelectorAll = (sel) => { const want = sel.replace(/^\./, "").split(":")[0], out = []; const walk = (e) => { for (const c of e.children || []) { if (has(c, want)) out.push(c); walk(c); } }; walk(n); return out; };
    n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
    n.closest = (sel) => { for (let e = n; e; e = e.parentNode) if (has(e, sel.replace(/^\./, ""))) return e; return null; };
    return n;
  };
  const els = { text: make("div"), panel: make("div"), note: make("div") };
  globalThis.document = { getElementById: (id) => els[id] || null, createElement: make, createTextNode: (t) => ({ tag: "#text", textContent: t, parentNode: null }) };
  return els;
}

test("Item 139 (0x391a0, the trailing draw): with a second balloon up the page's current line is drawn in it, one row up; earlier lines stay in the first", async () => {
  const { TextBox } = await import("../../web/app/js/textbox.js");
  const els = pageDom();
  const box = new TextBox();
  // system.json's rows for QA_09 op 1647-1659: style 22 with offsets 9 / 36, then style 4 with offsets 19 / 17
  box.windows = { styles: [], x: [], y: [] };
  box.windows.styles[22] = ["tw_t_L___V13b____-58", 94, 44, 79, 67, 299.833];
  box.windows.styles[4] = ["tw_t_L___V13b_E__-40", 525, 414, 98, 80, 299.833];
  box.windows.x[9] = 50; box.windows.x[19] = -100; box.windows.y[36] = -60; box.windows.y[17] = 65;
  box.setOpen(true, true);
  box.setWindow({ style: 22, x: 9, y: 36, style2: 0, x2: 0, y2: 0 });
  assert.equal(box.second, null);
  els.text.dataset.dashFor = els.text.className;               // (no font to measure here)
  box.add("You're dead, punk!", { instant: true });
  assert.equal(els.text.querySelector(".second"), null);       // one balloon: the page's flow as ever
  box.setWindow({ style: 22, x: 9, y: 36, style2: 4, x2: 19, y2: 17 });
  assert.equal(els.text.querySelector(".second"), null, "setting the variables moves nothing: the line on screen is not drawn again before the next MSG");
  box.add("Come at me!", { instant: true });
  const host = els.text.querySelector(".second");
  assert.ok(host, "the new line has its own element");
  assert.deepEqual(host.children.map((s) => s.className.split(" ")[0]), ["seg"]);
  assert.equal(host.children[0], box.lines[1].segs[0]);
  assert.equal(box.lines[0].segs[0].parentNode, els.text);      // line one stays where it was
  // its place: the second balloon's text origin less the first's, on the balloon's first row (the line is row 1 of the page, drawn a row up)
  const first = { left: (94 + 79 + 50) * 1.5 - 3, top: (44 + 67 - 60) * 1.5 - 11 }, second = { left: (525 + 98 - 100) * 1.5 - 3, top: (414 + 80 + 65) * 1.5 - 11 };
  assert.equal(host.style.left, `${second.left - first.left}px`);
  assert.equal(host.style.top, `${second.top - first.top}px`);
  assert.equal(host.style.width, `${299.833 * 3}px`);           // the row width is the first style's (0x34defc by F1105)
  assert.equal(box.pictures().length, 2);
  // an MSAD goes on in the same balloon
  box.add(" Now!", { inline: true, instant: true });
  assert.equal(host.children.length, 2);
  // a third line makes the second an earlier one: back into the flow, and the new line a row further down (row 2, less one)
  box.add("Third.", { instant: true });
  assert.equal(box.lines[1].segs[0].parentNode, els.text);
  assert.deepEqual(host.children, box.lines[2].segs);
  assert.equal(host.style.top, `${second.top - first.top + 77.5}px`);
  // the balloon goes: the line goes back with it
  box.setWindow({ style: 22, x: 9, y: 36, style2: 0, x2: 0, y2: 0 });
  assert.equal(els.text.querySelector(".second"), null);
  assert.equal(box.lines[2].segs[0].parentNode, els.text);
  assert.equal(els.text.querySelectorAll(".seg").length, 4);
  // with both set before the page's first line the line is the current one at row 0: a row above the balloon's first (native frame)
  const lone = new TextBox(); lone.windows = box.windows;
  const els2 = pageDom();
  lone.setOpen(true, true);
  lone.setWindow({ style: 22, x: 9, y: 36, style2: 4, x2: 19, y2: 17 });
  els2.text.dataset.dashFor = els2.text.className;
  lone.add("Alone.", { instant: true });
  assert.equal(els2.text.querySelector(".second").style.top, `${second.top - first.top - 77.5}px`);
  delete globalThis.document;
  assert.match(source("style.css"), /#text \.second \{ position: absolute; display: block; \}/);
});
