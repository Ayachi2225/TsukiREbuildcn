// Checks for the fixes from the function-by-function review (web-dev/audit/FUNCTION-MAP.md, FIX-CHECKLIST.md). Each test
// names its checklist item. Tests that read generated assets skip when those files are not there (they stay local).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };

const asset = (p) => new URL(`../../web/assets/${p}`, import.meta.url);
const readAsset = (p) => JSON.parse(readFileSync(asset(p), "utf8"));

test("S1: jump numbers 2000-2007 follow the native table 0x350d58 (2000 = FLAG0, which sets F069 = 1)", () => {
  if (!existsSync(asset("scripts/index.json"))) return;
  const index = readAsset("scripts/index.json");
  const script = (n) => readAsset(`scripts/${index.jump[n]}.json`);
  for (const [base, stem] of [[2000, "12_01_CIEL12_3C"], [2002, "13_01_01_CIEL13_1B"], [2004, "13_01_01_CIEL13_1"], [2006, "13_01_01_CIEL13_2"]]) {
    const even = script(base), odd = script(base + 1);
    assert.equal(even.name, `${stem}_FLAG0`);
    assert.equal(odd.name, `${stem}_FLAG1`);
    assert.deepEqual(even.ops[0], ["WKST", "F069", "eq", "1"]);
    assert.deepEqual(odd.ops[0], ["WKST", "F069", "eq", "0"]);
  }
  // The callers keep F069: `IF__ F069 eq 0 L; JUMP 2001; L: JUMP 2000` (the label is taken when the test fails).
  const caller = readAsset(`scripts/${index.names.indexOf("12_01_CIEL12_3B")}.json`);
  const at = caller.ops.findIndex((o) => o[0] === "JUMP" && o[1] === "2001");
  assert.deepEqual(caller.ops[at - 1].slice(0, 4), ["IF__", "F069", "eq", "0"]);
  assert.equal(caller.ops[at + 1][1], "2000");
  // Every script position the engine numbers, and the numbers no story script reaches (110 START_SCRIPT, 3000 ARCHIVE).
  assert.equal(index.names[index.jump[110]], "START_SCRIPT");
  assert.equal(index.names[index.jump[3000]], "ARCHIVE");
  assert.equal(index.names[index.jump[1000]], "QA_01");
  if (!existsSync(asset("flowchart.json"))) return;
  const chart = readAsset("flowchart.json");
  const parts = chart.groups.flatMap((g) => g.parts).filter((p) => p.jump >= 2000 && p.jump <= 2007);
  assert.equal(parts.length, 8);
  for (const p of parts) assert.equal(index.names[p.script], readAsset(`scripts/${index.jump[p.jump]}.json`).name);
});

const { VM, WAITS } = await import("../../web/app/js/vm.js");

// A script machine with stand-ins for drawing, text and sound.
function machine(extra = {}) {
  const node = { innerHTML: "", style: { top: "" } };
  globalThis.document = { getElementById: () => node };
  const text = { pageParts: [], typing: false, intro: false, clear() { this.pageParts = []; }, setIntro() {}, setOpen() {},
    closeNow() {}, closeQuick() {}, fadeOut() {}, fadeIn() {}, addBreak() {}, ...extra.text };
  const audio = { snapshot: () => ({}), restore() {}, stopVoice() {}, voiceDone: () => new Promise(() => {}), ...extra.audio };
  const gfx = { load: async () => ({ tex: null, w: 100, h: 100 }), tex: new Map(), ...extra.gfx };
  const vm = new VM({ gfx, text, audio, ...extra.hooks });
  vm.script = { name: "synthetic", ops: [], labels: {} };
  return vm;
}

test("S2-S4: SNX4, STQK and WTSV are passed over as the native dispatch does (0x77814)", () => {
  const vm = machine();
  vm.op_STCH("29", "img0001");
  vm.op_SNX4("29", "8", "8");
  assert.equal(vm.layerFor(29).blurX, 0);
  assert.equal(vm.layerFor(29).blurY, 0);
  vm.op_STQK("29", "200", "4", "4");
  assert.deepEqual(vm.layerFor(29).effects, {});
  assert.equal(vm.op_WTSV(), undefined);   // no wait for the voice
  assert.equal(WAITS.has("WTSV"), false);  // and no commit of waiting layer changes
});

const { ChoiceFx, choiceStep } = await import("../../web/app/js/uifx.js");
const { storyDialogKey } = await import("../../web/app/js/ui.js");

test("S5/S6: SELR rows keep their value, number and lock; SELD stores the row's value (0x7dab8, 0x83e50)", async () => {
  const picked = [];
  const vm = machine({ hooks: { onChoice: async (rows) => { picked.push(rows); return 1; } } });
  vm.system = { messages: Object.fromEntries([...Array(10)].map((_, k) => [String(1433 + k), `${k}.`])) };
  vm.lines = [" Will take off my glasses.", " Won't take off my glasses."];
  vm.remember = () => {};
  vm.op_SELR("0", "$0");
  vm.op_SELR("1", "$1", "1");
  await vm.op_SELD("_D000", "75");
  assert.deepEqual(picked[0], [{ label: "1. Will take off my glasses.", locked: false }, { label: "2. Won't take off my glasses.", locked: true }]);
  assert.equal(vm.vars._D000, 1);
  // The value, not the row, is what SELD stores; the tenth row is numbered "0.".
  for (let k = 0; k < 10; k++) vm.op_SELR(String(k + 3), "$0");
  vm.onChoice = async (rows) => { picked.push(rows); return 9; };
  await vm.op_SELD("_D000", "1");
  assert.equal(picked[1][9].label, "0. Will take off my glasses.");
  assert.equal(vm.vars._D000, 12);
  // A save made at a choice before this change kept the rows as plain texts.
  vm.choices = ["a", "b"];
  vm.onChoice = async (rows) => { picked.push(rows); return 1; };
  await vm.op_SELD("_D000", "1");
  assert.deepEqual(picked[2].map((r) => r.label), ["1.a", "2.b"]);
  assert.equal(vm.vars._D000, 1);
});

test("S5/S7: the choice cursor starts on nothing, skips locked rows and wraps only on a fresh press (0x83e50)", () => {
  const locked = [false, true, false, false];
  assert.equal(choiceStep(-1, "down", locked), 0);
  assert.equal(choiceStep(-1, "up", locked), 0);
  assert.equal(choiceStep(-1, "left", locked), -1);
  assert.equal(choiceStep(-1, "right", locked), 3);
  assert.equal(choiceStep(0, "down", locked), 2);        // row 1 is locked
  assert.equal(choiceStep(2, "up", locked), 0);
  assert.equal(choiceStep(3, "down", locked, true), 0);  // a fresh press wraps
  assert.equal(choiceStep(3, "down", locked, false), 3); // a held repeat stops at the end
  assert.equal(choiceStep(0, "up", locked, false), 0);
  assert.equal(choiceStep(0, "up", locked, false, true), 3);  // the wheel wraps
  assert.equal(choiceStep(3, "left", locked, false), 3); // Left / Right only on a press
  assert.equal(choiceStep(3, "left", [true, false, false, false]), 1);
  const fx = new ChoiceFx(2, 768, [false, true]);
  for (let i = 0; i < 30; i++) fx.step(1, [1, 1]);
  assert.equal(fx.state, 3);
  assert.equal(fx.cur, -1);
  assert.equal(fx.take(), false);      // A with nothing selected
  assert.equal(fx.tap(1), null);       // a locked row ignores taps
  assert.equal(fx.tap(0), "moved");    // the first tap picks
  assert.equal(fx.tap(0), "taken");    // the second takes
});

test("S7: the story's yes / no starts on neither; Up is No, Down is Yes; A needs a button (0x83e50 modes 2 and 3)", () => {
  assert.equal(storyDialogKey(-1, "Enter"), null);
  assert.equal(storyDialogKey(-1, "ArrowUp"), 0);
  assert.equal(storyDialogKey(-1, "ArrowDown"), 1);
  assert.equal(storyDialogKey(-1, "ArrowRight"), 0);
  assert.equal(storyDialogKey(1, "ArrowRight", true), 0);
  assert.equal(storyDialogKey(1, "ArrowRight", false), 1);
  assert.equal(storyDialogKey(-1, "ArrowLeft", true), 1);
  assert.equal(storyDialogKey(0, "ArrowLeft", false), 0);
  assert.equal(storyDialogKey(1, "Enter"), "decide");
});

test("S8: CLO2-CLO5 end the frame, so layer changes staged before them show at once (0x7fef0, 0x802c0)", async () => {
  for (const op of ["CLO2", "CLO3", "CLO4", "CLO5"]) assert.ok(WAITS.has(op), op);
  const vm = machine({ text: { closed: false, rate: 0 } });
  vm.script = { name: "T", labels: {}, ops: [["STCH", "34", "img0001"], ["CLO3"], ["END_"]] };
  vm.running = true;
  vm.text.closeQuick = () => { vm.text.closed = true; };
  const seen = [];
  const orig = vm.op_CLO3.bind(vm);
  vm.op_CLO3 = () => { seen.push(vm.layers.has(34)); return orig(); };
  await vm.loop(vm.generation);
  assert.deepEqual(seen, [true]);   // committed before the CLO3 handler ran: no transition left for a later FADS
});

const { FlowProgress, ROUTE_FLAGS } = await import("../../web/app/js/flowchart-model.js");
const memoryStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const realChart = existsSync(asset("flowchart.json")) ? readAsset("flowchart.json") : null;
const chartFlow = () => { const f = new FlowProgress(memoryStore()); f.migrated = true; f.install(realChart); return f; };

test("S10: RTST makes a scene current only for 533-557 or in a replay; RDED completes only the current scene", () => {
  const f = new FlowProgress(memoryStore());
  f.read(55);
  assert.equal(f.current, 0);                  // normal play: the JUMP decides
  assert.ok(f.path.has(55));
  assert.equal(f.finish(55), false);
  f.read(540);
  assert.equal(f.current, 540);                // a Ciel-sensei episode
  assert.equal(f.finish(540), true);
  f.read(57, true);
  assert.equal(f.current, 57);                 // a gallery replay (F024)
  if (!realChart) return;
  // 01_00_ARC01_4_3 -> 01_00_ARC01_4_1 is (57 -> 55), which 0x93d10 leaves unmarked: 57 stays current, so the shared
  // script's `RDED 55; RDED 57` completes 57, not 55.
  const g = chartFlow();
  g.jump(54, 57);
  assert.equal(g.current, 57);
  g.read(57);
  g.jump(57, 55);
  assert.equal(g.current, 57);
  g.read(55);
  assert.equal(g.finish(55), false);
  assert.equal(g.finish(57), true);
});

test("S11: 0x93d10's special cases mark the rows of the scene actually played, virtual nodes and extra lines", () => {
  if (!realChart) return;
  const row = (a, b) => realChart.transitions.find((t) => t.from === a && t.to === b);
  // 55 -> 58 after 57 was played marks 57 -> 58 instead.
  let f = chartFlow();
  f.path.add(57);
  f.jump(55, 58);
  assert.equal(f.current, 58);
  for (const n of row(57, 58).global) assert.ok(f.secondary.has(n));
  for (const n of row(55, 58)?.global || []) if (!row(57, 58).global.includes(n)) assert.ok(!f.secondary.has(n));
  // 101 -> 102 goes through the virtual node of the answer taken (501 / 502 / 503).
  f = chartFlow();
  f.jump(101, 102, { lastChoice: 1 });
  assert.ok(f.completed.has(502) && f.started.has(502) && f.path.has(502));
  assert.ok(!f.completed.has(501) && !f.completed.has(503));
  assert.equal(f.current, 102);
  // START_SCRIPT (no exit flag) to the prologue scene 486 inserts the opening, 485 -> 528 -> 486.
  f = chartFlow();
  f.jump(-1, 486);
  assert.ok(f.completed.has(485) && f.completed.has(528));
  assert.equal(f.current, 486);
  // 66 -> 52 with F050 set marks nothing and leaves the current scene; 136 -> 137 also reveals line 734.
  f = chartFlow();
  f.current = 66;
  f.jump(66, 52, { getVar: (k) => (k === "F050" ? 1 : 0) });
  assert.equal(f.current, 66);
  f.jump(136, 137);
  assert.ok(f.secondary.has(734));
  assert.equal(f.current, 137);
  // 181 -> 184 with F054 = 0 stops at the virtual node 520, so 184's RDED completes nothing.
  f = chartFlow();
  f.jump(181, 184);
  assert.equal(f.current, 520);
  f.read(184);
  assert.equal(f.finish(184), false);
  // A pair the table does not list, between real scenes, marks its own row; one from outside 1-530 marks nothing.
  f = chartFlow();
  const plain = realChart.transitions.find((t) => t.from > 0 && t.from <= 530 && t.to > 0 && t.to < 486 && t.global.length && ![55, 66, 101].includes(t.from));
  f.jump(plain.from, plain.to);
  assert.equal(f.current, plain.to);
  for (const n of plain.global) assert.ok(f.secondary.has(n));
  f = chartFlow();
  f.current = 7;
  f.jump(-1, plain.to);
  assert.equal(f.current, 7);
});

test("S12: SELD 72 / 73 mark their virtual nodes; the second lines (1168, 1120) only off that path (0x92a60)", () => {
  const f = new FlowProgress(memoryStore());
  f.path.add(270);
  f.choice(72, [907, 908]);
  assert.ok(f.secondary.has(907) && f.secondary.has(1167) && !f.secondary.has(1168));
  assert.ok(f.started.has(523) && f.completed.has(523) && f.path.has(523));
  assert.equal(f.current, 0);
  f.choice(73, [917, 918], true);
  assert.ok(f.secondary.has(1119) && f.secondary.has(1120));   // 446 is not on this path
  assert.equal(f.current, 517);                                 // in a replay the virtual node becomes current
  if (!realChart) return;
  assert.deepEqual(realChart.choiceFlags["72"], [907, 908]);    // the exported table has only 0x3594d0's rows
});

test("S13: a rewind keeps the route flags of earlier rows and the path up to the chosen row (0x95800, 0x11a58)", () => {
  // 0x95800: a row before group 204 clears F069; group 204 or later keeps it.
  const cleared = (g) => ROUTE_FLAGS.filter(([, from]) => g < from).map(([n]) => n).sort((a, b) => a - b);
  assert.deepEqual(cleared(204), []);
  assert.deepEqual(cleared(203), [69]);
  assert.deepEqual(cleared(161), [63, 64, 65, 66, 67, 68, 69]);   // F062 only below 161 (0x95800: g != 0xa1)
  assert.deepEqual(cleared(160), [62, 63, 64, 65, 66, 67, 68, 69]);
  assert.equal(cleared(10).length, 19);                        // F054-F069 and F072-F074 (not F070, F071)
  if (!realChart) return;
  const f = chartFlow();
  const groups = realChart.groups;
  const scene = (gi) => groups[gi].parts.find((p) => p.flag > 0)?.flag;
  const early = groups.findIndex((g, i) => i > 30 && g.day >= 1 && scene(i));
  const late = groups.findIndex((g, i) => i > early + 5 && scene(i));
  f.path.add(scene(early)); f.path.add(scene(late));
  f.rewindPath(realChart, groups[early].index);
  assert.ok(f.path.has(scene(early)));
  assert.ok(!f.path.has(scene(late)));
  assert.equal(realChart.rewind.keep.length, 274);            // 0x34ba16 up to its -1
  assert.ok(realChart.rewind.keep.includes(201) && realChart.rewind.keep.includes(687));   // the path bits ride along
  assert.equal(realChart.rewind.flags.length, 42);
  assert.ok(realChart.rewind.flags.includes(69) && realChart.rewind.flags[0] === 998);
});

test("S9: in a gallery replay the scene's RDED ends the script, as RTM_ does (0x79bdc -> 0x7f9e8)", () => {
  const vm = machine();
  vm.flow = new FlowProgress(memoryStore());
  vm.script = { name: "T", labels: {}, ops: [["RTST", "57"], ["RDED", "57"], ["MSG", "$0"]] };
  vm.replay = true;
  vm.op_RTST("57");
  vm.pc = 2;
  vm.op_RDED("57");
  assert.equal(vm.pc, 3);                       // past the end: the replay is over
  assert.ok(vm.flow.completed.has(57));
  vm.replay = false; vm.pc = 2;
  vm.flow.current = 57;
  vm.op_RDED("57");
  assert.equal(vm.pc, 2);                       // normal play goes on
});

const { STORY_MOVIES, movieLook, movieQuestion, titleMovieUp } = await import("../../web/app/js/uifx.js");
test("The title's still stays away once the movie has a picture: a seek back at the loop or a stall does not bring it back", () => {
  const movie = (readyState, display = "block") => ({ readyState, style: { display } });
  assert.equal(titleMovieUp(false, movie(1)), false, "not before the first picture");
  assert.equal(titleMovieUp(false, movie(2)), true);
  assert.equal(titleMovieUp(true, movie(1)), true, "a seek drops readyState to 1 for a moment");
  assert.equal(titleMovieUp(true, movie(4, "none")), false, "a movie taken off the screen");
  assert.equal(titleMovieUp(true, null), false);
});
test("Movies: the openings cannot be passed the first time and ask from then on, the end credits always ask, the prologue asks only the first time", () => {
  for (const n of [5, 6]) {
    assert.equal(movieQuestion(n, false), null);
    assert.equal(movieQuestion(n, true), "Skip opening animation?");
    assert.ok(STORY_MOVIES[n], "and the rule that holds a first showing");
  }
  for (const n of [35, 36, 37]) for (const seen of [false, true]) assert.equal(movieQuestion(n, seen), "Skip Outro?");
  assert.equal(movieQuestion(4, false), "Skip intro video?");
  assert.equal(movieQuestion(4, true), null);
  for (const n of [undefined, 8, 13, 39]) assert.equal(movieQuestion(n, false), null);   // the logos, a phase title, a staff card
});

test("S14/S15: story movies — which wait until seen (G005 bits), covers, fades and sound 7 (0x40480, 0x40a00)", () => {
  // 0x40a00: the bit each movie sets when it ends; 0x40480 lets only these be passed once their bit is set.
  assert.deepEqual(Object.fromEntries(Object.entries(STORY_MOVIES).map(([n, [bit]]) => [n, bit])), { 4: 2, 5: 0, 6: 1, 35: 3, 36: 4, 37: 5 });
  assert.equal(STORY_MOVIES[4][1], 23040);              // the prologue's picture until frame 23040 (384 s)
  const title = movieLook(9);                           // phasetitle_02_00
  assert.deepEqual([title.fadeIn, title.leaveAt, title.fadeOut, title.chime, title.white], [48, 312, 48, 0, false]);
  assert.deepEqual([movieLook(13).chime, movieLook(13).leaveAt], [210, 540]);   // sound 7 at frame 210
  assert.equal(movieLook(4).chime, null);
  assert.equal(movieLook(5).white, true);               // op1_arc and ed03_ciel come out of white
  assert.equal(movieLook(37).white, true);
  assert.equal(movieLook(40).leaveAt, 618);             // the credits
});

test("S16: a read scene's RDAS starts an instant run after 4 frames; it stops at the next ATSV, choice or unread line", async () => {
  const frames = [];
  globalThis.requestAnimationFrame = (f) => { frames.push(1); return setTimeout(() => f(0), 0); };
  try {
    const vm = machine();
    vm.flow = new FlowProgress(memoryStore());
    vm.flow.completed.add(29);
    vm.skipRead = true; vm.skipConfirm = false; vm.running = true;
    vm.op_RDAS("29");
    assert.equal(vm.instant, false);           // the script goes on during the countdown
    // four frames, however slowly the timers run (the whole suite at once can stretch them)
    for (let t = 0; t < 200 && !(frames.length >= 5 && vm.instant); t++) await new Promise((r) => setTimeout(r, 5));
    assert.equal(frames.length >= 4, true);
    assert.equal(vm.instant, true);
    assert.equal(vm.skip, true);
    vm.op_ATSV("");                            // the next checkpoint ends it, and is recorded
    assert.equal(vm.instant, false);
    assert.equal(vm.skip, false);
    // An unread line ends it with fast forward on "Read"; a read one does not.
    vm.lines = ["a", "b"]; vm.read = new Uint8Array(1); vm.read[0] = 1;   // line 0 read, line 1 not
    vm.fastForwardRead = true;
    vm.text = { ...vm.text, beginMessage() {}, setIntro() {}, rows: () => ({}), pageParts: [], setWhole() {}, log() {}, add: async () => {}, finish() {} };
    vm.waitAdvance = async () => {};
    vm.beginInstant();
    await vm.message("$0", false);
    assert.equal(vm.instant, true);
    await vm.message("$1", false);
    assert.equal(vm.instant, false);
    for (const op of ["SELD", "SELS", "SELA", "XSTP", "RTM_", "END_"]) {
      vm.beginInstant();
      if (op === "SELD") { vm.onChoice = async () => 0; vm.remember = () => {}; await vm.op_SELD("_D000", "1"); }
      else if (op === "SELS") { vm.onConfirm = async () => true; vm.remember = () => {}; await vm.op_SELS("_D000"); }
      else if (op === "SELA") await vm.op_SELA("_D000");
      else vm[`op_${op}`]();
      assert.equal(vm.instant, false, op);
    }
  } finally { delete globalThis.requestAnimationFrame; }
});

test("S17: on \"Read\" the skip toggle waits at unread text and goes on at read text; \"Full\" passes it (0x418b0)", async () => {
  const vm = machine();
  vm.lines = ["read 1", "new 2", "read 3"]; vm.read = new Uint8Array(1); vm.read[0] = 0b101;
  vm.text = { ...vm.text, beginMessage() {}, setIntro() {}, pageParts: [], setWhole() {}, log() {}, add: async () => {}, finish() {} };
  vm.waitAdvance = async () => {};
  vm.markRead = () => {};
  vm.fastForwardRead = true;
  vm.skip = true;                     // the toggle (not forced)
  await vm.message("$0", false);
  assert.equal(vm.skip, true);
  await vm.message("$1", false);      // unread: stops as if off, the toggle stays on
  assert.equal(vm.skip, false);
  assert.equal(vm.skipOn, true);
  await vm.message("$2", false);      // read again: goes on by itself
  assert.equal(vm.skip, true);
  vm.fastForwardRead = false;         // "Full"
  await vm.message("$1", false);
  assert.equal(vm.skip, true);
});

test("S18: a click ends VCWT and stops the voice under \"Voices stop on input\" unless F1123 (0x77f9c, 0x802c0)", async () => {
  let stopped = 0, release;
  const vm = machine({ audio: { voicePlaying: true, voiceDone: () => new Promise((r) => { release = r; }), stopVoice: () => { stopped++; } } });
  vm.text.typing = false;
  let done = false;
  const p = vm.op_VCWT().then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false);
  vm.advance();                 // the click
  await p;
  assert.equal(stopped, 1);
  vm.vars.F1123 = 1;            // a line that goes on through the next scene: the click does not stop it
  const q = vm.op_VCWT();
  await new Promise((r) => setTimeout(r, 5));
  vm.advance();
  await q;
  assert.equal(stopped, 1);
  vm.audio.voicePlaying = false;  // no voice: no wait at all
  assert.equal(await vm.op_VCWT(), undefined);
  release?.();
});

test("S20: the checkpoint moves at ATSV (also while skipping) and a page's first line, not at every wait or at SELD (N2-1)", async () => {
  const vm = machine();
  let n = 0;
  vm.snapshot = () => ({ n: ++n });
  vm.remember = () => { vm.trail.push(vm.snapshot()); };
  vm.skip = true;
  vm.op_ATSV("");
  assert.deepEqual(vm.savePoint, { n: 1, waiting: false, choice: false, voice: null });
  vm.op_ATSV("8");                       // flag 8 records none
  assert.equal(vm.savePoint.n, 1);
  vm.skip = false;
  vm.lines = ["a", "b"]; vm.read = new Uint8Array(1);
  vm.text = { ...vm.text, beginMessage() {}, setIntro() {}, pageParts: [], setWhole() {}, log() {}, add: async () => {}, finish() {} };
  vm.armAuto = () => {};
  const click = () => setTimeout(() => vm.advance(), 1);
  vm.vars.F823 = 1;                      // the page's first line
  click(); await vm.message("$0", false);
  const first = vm.savePoint.n;
  assert.ok(first > 1);
  vm.vars.F823 = 2;                      // a later line: the checkpoint stays on the first
  click(); await vm.message("$1", false);
  assert.equal(vm.savePoint.n, first);
  vm.onChoice = async () => 0;
  vm.choices = ["x"];
  await vm.op_SELD("_D000", "1");
  assert.equal(vm.savePoint.n, first);   // a save at the choice resumes at the page's first line (0x7f850 is never reached)
});

test("S21: Return to Previous Scene goes to the last ATSV point, or the one before within two lines of it; never to the first one (0x81a50)", () => {
  const vm = machine();
  let n = 0;
  vm.snapshot = () => ({ n: ++n });
  assert.equal(vm.previousScene(false), null);
  vm.op_ATSV("");               // point 1: the first since the story started, which the game's count (from -1) cannot go back to (TODO item 51)
  vm.nearScene = 0;
  assert.equal(vm.previousScene(false), null, "unlit through the first scene");
  vm.op_ATSV("4");              // flag 4: a checkpoint, but not on the ring
  assert.equal(vm.scenePoints.length, 1);
  vm.op_ATSV("1");              // point 3
  assert.equal(vm.nearScene, 2);
  assert.equal(vm.previousScene(false), null, "within two lines of the second: the one before is the first, so none");
  vm.nearScene = 0;             // two lines on: the start of what is being read
  assert.equal(vm.previousScene(false).n, 3);
  vm.op_ATSV("");               // point 4
  assert.equal(vm.previousScene(false).n, 3);   // right after it: the one before
  vm.nearScene = 0;
  assert.equal(vm.previousScene(false).n, 4);
  vm.choosing = { pc: 1, list: [] };            // at a choice: the one before
  assert.equal(vm.previousScene().n, 3);
  assert.equal(vm.scenePoints.length, 2);
  assert.equal(vm.nearScene, 2);
});

test("S22-S30: the exported save, header and dialog tables (0x591558, 0x592484, 0x3506b0, 0x3c9340, SYSMES 395 + F022)", () => {
  if (!existsSync(asset("system.json"))) return;
  const sys = readAsset("system.json");
  const t = sys.saves;
  assert.deepEqual(t.phaseCells[9], [24, 408, 592, 488]);        // F023 9: chapter 4's cell
  assert.deepEqual(t.saveTitleCells[9], [32, 312, 288, 352]);
  assert.deepEqual(t.phaseCells[0], [0, 0, 1, 1]);              // nothing before the story
  assert.equal(t.infoPictures.length, 26);                      // F023 11-36
  assert.equal(t.infoPictures[0], "saveinfobg_unknown");        // slot 550
  assert.equal(t.infoPictures[3], "saveinfobg_arc");            // slot 548 = SAVE_PARTS_JA texture 3
  assert.equal(t.infoPictures[1], "saveinfobg_ciel");           // slot 549 = texture 4
  assert.equal(t.sceneNames.length, 517);
  assert.equal(t.sceneNames[1], sys.messages["396"] ?? t.sceneNames[1]);
  assert.equal(sys.dialogs[2], 180);                            // Overwrite?
  assert.equal(sys.dialogs[8], 229);                            // Return to Title Screen?
  assert.equal(sys.dialogs[12], 234);                           // End Scene Playback?
  for (const n of ["180", "183", "184", "212", "234", "239", "1496"]) assert.ok(sys.messages[n], n);
});

// ---- section 2: look ----------------------------------------------------------------------------------------------

const { hazeConstants, hazeShift, hazeState } = await import("../../web/app/js/effects.js");

test("V1: STRA's haze table is exported (0x352bd4, entries 1-557 of 10 floats, read through 0x91520)", () => {
  if (!existsSync(asset("effects.json"))) return;
  const { haze } = readAsset("effects.json");
  assert.equal(haze.length, 558);
  assert.equal(haze[0], null);
  assert.deepEqual(haze[1], [1, 1, 1, 1, 1, 1, 2, 1, 1, 0]);
  assert.deepEqual(haze[286], [1, 1, 1, 0, 0, 0, 1, 15, 1, 0]);   // 12_00_ARC12_2 op 1102
  assert.equal(haze[326][9], 1250);                               // its fade-in: `STRA 26 326 1250` in 13_00_ARC13_4
  assert.deepEqual(haze[557].slice(6, 9), [100, 480, 20]);
});

test("V1: the haze constants follow 0x362a0 and the shift the haze shader (nexl_nxshader_haze)", () => {
  const F = 1000 / 60;
  const e286 = [1, 1, 1, 0, 0, 0, 1, 15, 1, 0];
  // full strength one second in (phase 60): amplitude 1920 / 1024 texture pixels, 2.5 waves per 1080 of texture height
  let c = hazeConstants({ n: 286, start: 0, ramp: 0, stop: 0 }, e286, 60 * F, 1280, 720);
  assert.deepEqual(c.x.slice(0, 2), [1280, 1.875]);
  assert.ok(Math.abs(c.x[2] - 2.5 * 720 / 1080 * 0.5) < 1e-12);
  assert.ok(Math.abs(c.x[3] - 2 / 3) < 1e-9);                     // frac(p8 / 3 x (1 s + p1))
  assert.deepEqual(c.y.slice(0, 2), [720, 0]);                    // p5 = 0: no shift down
  // the fade-in (entry 326: p9 = 1250 ms): half a second in, 400 of 1000; past its 75 frames, full
  const e326 = [1, 1, 1, 0, 0, 0, 3, 3, 1, 1250];
  c = hazeConstants({ n: 326, start: 0, ramp: 75, stop: 0 }, e326, 30 * F, 1280, 720);
  assert.ok(Math.abs(c.x[1] - 1.875 * 0.4 * 3) < 1e-9);
  c = hazeConstants({ n: 326, start: 0, ramp: 75, stop: 0 }, e326, 80 * F, 1280, 720);
  assert.ok(Math.abs(c.x[1] - 1.875 * 3) < 1e-9);
  // a fade-in on an entry with p9 = 0 draws nothing until it is dropped (0 / 0 converts to 0)
  assert.equal(hazeConstants({ n: 286, start: 0, ramp: 10, stop: 0 }, e286, 5 * F, 1280, 720).x[1], 0);
  // the fade-out: 60 frames, 15 gone: 750; run down: nothing
  c = hazeConstants({ n: 286, start: 0, ramp: 0, stop: 60, left: 60, leftAt: 0 }, e286, 15 * F, 1280, 720);
  assert.ok(Math.abs(c.x[1] - 1.875 * 0.75) < 1e-9);
  assert.equal(hazeConstants({ n: 286, start: 0, ramp: 0, stop: 60, left: 60, leftAt: 0 }, e286, 61 * F, 1280, 720), null);
  assert.equal(hazeState({ n: 0, start: 0 }, 100), null);
  // the shader: sin(2pi(fract(phase) + fract(v x waves))) x amplitude / texture width across
  const [dx, dy] = hazeShift({ x: [1280, 64, 1, 0.25], y: [720, 0, 1, 0] }, 0);
  assert.ok(Math.abs(dx - 64 / 1280) < 1e-12);
  assert.equal(dy, 0);
});

test("V1: STRA writes the record on screen and the layer's state, which each commit copies (0x645f0, 0x5d3a0)", async () => {
  const vm = machine();
  let t = 1000;
  vm.now = () => t;
  vm.op_STCH("12", "img2179");
  vm.op_STRA("12", "1");                 // no picture on screen yet: only the state
  assert.equal(vm.hazes[12].n, 0);
  assert.equal(vm.hazes[12].next, 1);
  await vm.commit();
  assert.equal(vm.hazes[12].n, 1);
  assert.equal(vm.hazes[12].start, 1000);
  t = 2000;
  vm.op_STRA("12", "5");                 // on screen: at once, phase 0
  assert.deepEqual([vm.hazes[12].n, vm.hazes[12].start], [5, 2000]);
  // with a time: a fade-in now, the number at the next commit
  vm.op_STRA("12", "326", "1250");
  assert.deepEqual([vm.hazes[12].n, vm.hazes[12].ramp, vm.hazes[12].next], [5, 75, 326]);
  t = 3000;
  await vm.commit();
  assert.equal(vm.hazes[12].n, 326);
  assert.equal(vm.hazes[12].ramp, 75);   // the counter (60 frames, it kept running) has not reached it yet
  const e326 = [1, 1, 1, 0, 0, 0, 3, 3, 1, 1250];
  assert.ok(Math.abs(hazeConstants(vm.hazes[12], e326, 3000, 1280, 720).x[1] - 1.875 * 0.8 * 3) < 1e-9);
  t = 3500;
  vm.op_STRA("14", "1");                 // (a record is brought up to date when anything changes it)
  await vm.commit();
  assert.equal(vm.hazes[12].ramp, 0);    // 90 frames: dropped
  // STCH clears the record at once but keeps the state: the new picture gets the haze from phase 0 at the commit
  vm.op_STCH("12", "img0597");
  assert.equal(vm.hazes[12].n, 0);
  t = 4000;
  await vm.commit();
  assert.deepEqual([vm.hazes[12].n, vm.hazes[12].start], [326, 4000]);
  // SCH2 from another layer takes that layer's state
  vm.op_SCH2("13", "img0597", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "12");
  await vm.commit();
  assert.equal(vm.hazes[13].n, 326);
  // a fade-out (a time and 0) is cut by the next commit, which copies the 0
  vm.op_STRA("12", "0", "1000");
  assert.deepEqual([vm.hazes[12].n, vm.hazes[12].stop, vm.hazes[12].next], [326, 60, 0]);
  t = 4500;
  await vm.commit();
  assert.equal(vm.hazes[12].n, 0);
  assert.equal(vm.hazes[12].left, 30);   // what it had left stays for the next haze on this record
  // STCC clears the state; -1 is every layer
  vm.op_STCC("13");
  await vm.commit();
  assert.equal(vm.hazes[13].n, 0);
  vm.op_STRA("-1", "7");
  assert.ok(vm.hazes.every((h) => h.next === 7));
  assert.equal(vm.hazes[39].n, 0);       // no picture on layer 39
  vm.op_STRA("40", "7");                 // past the last layer: nothing
  // STNS's change alone also ends the frame with a commit
  vm.op_STNS("12", "1");
  assert.equal(vm.staged, true);
  await vm.settle();
  assert.equal(vm.staged, false);
});

const { place } = await import("../../web/app/js/transform.js");
const { stretchMatrix, drawn } = await import("../../web/app/js/renderer.js");

test("V2: STZ4's eighth argument zooms along the screen's axes after the rotation (0x37f50, 0xb3780, 0xbbb28)", async () => {
  const vm = machine();
  vm.op_STCH("6", "img2138");
  vm.op_STZ4("6", "1441", "743", "1441", "743", "0", "0", "1");
  const l = vm.layerFor(6);
  assert.equal(l.stretch, true);
  vm.op_STZ4("6", "1441", "743", "1441", "743", "0", "0");     // blank keeps it (state +0x874)
  assert.equal(l.stretch, true);
  vm.op_SCH2("6", "img2139");                                   // SCH2 without a source clears it (0x60840)
  assert.equal(vm.layerFor(6).stretch, false);
  vm.op_STZ4("6", "", "", "", "", "", "", "0");
  assert.equal(vm.layerFor(6).stretch, false);
  // placement: the zoom leaves the picture's own scale and becomes the stretch
  const base = { id: 6, image: "img2138", parent: -1, link: -1, pivot: null, clip: null, border: 0, clipRot: 0, absolute: false, offset: null, scale: 1000 };
  const a = { ...base, stretch: true }, b = { ...base, stretch: false };
  const s = { x: 240, y: 136, zx: 1441, zy: 743, rot: 4500, alpha: 255 };
  const info = () => [1000, 1000];
  const pa = place([a], new Map([[a, s]]), info).get(a), pb = place([b], new Map([[b, s]]), info).get(b);
  assert.deepEqual([pa.zx, pa.zy, pa.stretch], [1, 1, [1.441, 0.743]]);
  assert.deepEqual([pb.zx, pb.zy, pb.stretch], [1.441, 0.743, null]);
  // a square turned 45 degrees and then stretched keeps its stretch level: its bounds are 1.441 : 0.743
  const c = Math.cos(Math.PI / 4), sn = Math.sin(Math.PI / 4);
  const m = stretchMatrix([100 * c, 100 * sn, 0, -100 * sn, 100 * c, 0, 500 - 50 * c + 50 * sn, 500 - 50 * sn - 50 * c, 1], pa.stretch, 500, 500);
  const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [m[0] * u + m[3] * v + m[6], m[1] * u + m[4] * v + m[7]]);
  const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
  const h = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
  assert.ok(Math.abs(w / h - 1.441 / 0.743) < 1e-9);
  assert.ok(Math.abs((pts[0][0] + pts[3][0]) / 2 - 500) < 1e-9);   // about the anchor
  assert.deepEqual(stretchMatrix([1, 2, 0, 3, 4, 0, 5, 6, 1], null, 0, 0), [1, 2, 0, 3, 4, 0, 5, 6, 1]);
});

test("V3: a layer linked to a layer that is not there is not drawn (0x37f50: alpha factor 0)", () => {
  const base = { image: "img0001", parent: -1, link: -1, pivot: null, clip: null, border: 0, clipRot: 0, absolute: false, offset: null, scale: 1000 };
  const owner = { ...base, id: 32, clip: [100, 100, 800, 600] }, child = { ...base, id: 3, link: 32 };
  const s = { x: 240, y: 136, zx: 1000, zy: 1000, rot: 0, alpha: 255 };
  const info = () => [1280, 720];
  // with its owner: clipped by it and drawn
  let at = place([child], new Map([[child, s]]), info, new Map([[3, child], [32, owner]])).get(child);
  assert.equal(at.alpha, 1);
  assert.deepEqual(at.clip.rect, [100, 100, 800, 600]);
  // the owner removed (13_01_01_CIEL13_5B: layer 3 after layer 32 is cleared): not drawn
  at = place([child], new Map([[child, s]]), info, new Map([[3, child]])).get(child);
  assert.equal(at.alpha, 0);
  // no link: drawn as before
  const lone = { ...base, id: 4 };
  assert.equal(place([lone], new Map([[lone, s]]), info).get(lone).alpha, 1);
});

test("V4: layers with z 0 or less are not drawn; a blank STCH z is the layer number x 10 (0x3bba0, 0x60840)", async () => {
  const vm = machine();
  vm.op_STCH("7", "img0001", "240", "136", "1000", "255", "");
  assert.equal(vm.layerFor(7).z, 70);
  vm.op_STCH("8", "img0001", "240", "136", "1000", "255", "518");
  assert.equal(vm.layerFor(8).z, 518);
  vm.op_STCP("8", "0");
  const ready = { tex: {} };
  assert.equal(drawn({ z: 0, ready }, { alpha: 1 }), false);     // STCP 0: hidden
  assert.equal(drawn({ z: -5, ready }, { alpha: 1 }), false);
  assert.equal(drawn({ z: 1, ready }, { alpha: 1 }), true);
  assert.equal(drawn({ z: 70, ready: null }, { alpha: 1 }), false);
  assert.equal(drawn({ z: 70, ready }, { alpha: 0 }), false);
  // a hidden layer still places its children and links: place() works on every layer
  const base = { image: "img0001", parent: -1, link: -1, pivot: null, clip: null, border: 0, clipRot: 0, absolute: false, offset: null, scale: 1000 };
  const owner = { ...base, id: 8, z: 0, clip: [0, 0, 960, 540] }, child = { ...base, id: 9, z: 90, link: 8 };
  const s = { x: 240, y: 136, zx: 1000, zy: 1000, rot: 0, alpha: 255 };
  const at = place([child], new Map([[child, s]]), () => [1280, 720], new Map([[8, owner], [9, child]])).get(child);
  assert.deepEqual(at.clip.rect, [0, 0, 960, 540]);
  assert.equal(at.alpha, 1);
});

const { clipGeometry } = await import("../../web/app/js/transform.js");

test("V5: panel edges feather at and up to the width past the screen's edge; style 7 doubles it and has no band", () => {
  // 11_00_ARC11_2 op 4710-like: a clip from the left edge, 60 px border: the left side feathers (x 0 > -60)
  let g = clipGeometry({ rect: [0, 200, 900, 500], border: 60, rot: 0, frame: 0 });
  assert.deepEqual(g.sides, [1, 1, 1, 1]);
  // 60 px or more past the edge: cut hard; less: feathered
  assert.deepEqual(clipGeometry({ rect: [-60, 200, 900, 500], border: 60, rot: 0 }).sides, [0, 1, 1, 1]);
  assert.deepEqual(clipGeometry({ rect: [-59, 200, 900, 500], border: 60, rot: 0 }).sides, [1, 1, 1, 1]);
  assert.deepEqual(clipGeometry({ rect: [1000, -10, 980, 1100], border: 60, rot: 0 }).sides, [1, 1, 0, 1]);   // right at 1980
  // exactly the screen's width (or height): none across (down)
  assert.deepEqual(clipGeometry({ rect: [0, 100, 1920, 500], border: 60, rot: 0 }).sides, [0, 1, 0, 1]);
  // style 7: the mask's width doubled, no band; styles 1-6: the band at the plain width
  g = clipGeometry({ rect: [300, 200, 900, 500], border: 60, rot: 0, frame: 7 });
  assert.equal(g.border, 120);
  assert.equal(g.band, null);
  g = clipGeometry({ rect: [300, 200, 900, 500], border: 60, rot: 0, frame: 1 });
  assert.deepEqual([g.border, g.band.border, g.colour], [60, 60, [0, 0, 0]]);
  // the mask's width is rounded up to even (the band's is not), and both are cut to half the clip's size
  g = clipGeometry({ rect: [300, 200, 900, 500], border: 15, rot: 0, frame: 2 });
  assert.deepEqual([g.border, g.band.border], [16, 15]);
  assert.equal(clipGeometry({ rect: [300, 200, 100, 40], border: 60, rot: 0 }).border, 20);
  assert.equal(clipGeometry({ rect: [300, 200, 900, 500], border: 1, rot: 0, frame: 1 }).band, null);   // under 2
});

test("V6: SCH2 resets the blend mode to normal, as STCH does (0x60840, 0x62088-0x620b8)", () => {
  const vm = machine();
  vm.op_STCH("28", "img2474");
  vm.op_STBR("28", "2");
  vm.op_STCH("32", "img2474");
  vm.op_STBR("32", "23");
  vm.op_SCH2("28", "img2475");            // QA_21 op 1275: a new picture, no new STBR
  vm.op_SCH2("33", "img2475", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "32");
  assert.equal(vm.layerFor(28).blend, 0);
  assert.equal(vm.layerFor(33).blend, 0);
  assert.equal(vm.layerFor(32).blend, 23);  // the source keeps its own
});

const { Motion } = await import("../../web/app/js/animation.js");
const { motionClosesWindow } = await import("../../web/app/js/vm.js");

test("V7: STMA's third argument closes the text window and its fourth steps the motion (0x99620, 0x95938)", () => {
  assert.equal(motionClosesWindow(1, 0.1), true);
  assert.equal(motionClosesWindow(2, 0), true);
  assert.equal(motionClosesWindow(2, 0.1), false);   // a CLO4 / CLO5 fade is running
  assert.equal(motionClosesWindow(0, 0), false);
  assert.equal(motionClosesWindow(-1, 0), false);    // config +0x63 is 1
  assert.equal(motionClosesWindow(undefined, 0), false);
  let closed = 0;
  const vm = machine({ text: { closeForFade() { closed++; } } });
  vm.motions = { 21: { duration: 1000, loop: 0, frames: [[0, 0, 0, 0, -32767, -32767, -100001, -32767, -32767, -32767, -32767], [1000, 0, 0, 600, -32767, -32767, -100001, -32767, -32767, -32767, -32767]] } };
  vm.op_STCH("5", "img0001");
  vm.op_STMA("5", "21", "2");                        // 09_00_ARC09_3_1 op 1459: the text goes for the motion
  assert.equal(closed, 1);
  assert.equal(vm.vars.F1103, 1);
  assert.equal(vm.layerFor(5).motion.step, 0);
  vm.op_STMA("5", "21", "", "3");                    // 14_01B_02_CIEL14B_3B: every third frame
  assert.equal(closed, 1);
  const m = vm.layerFor(5).motion;
  assert.equal(m.step, 3);
  const at = (ms) => m.sample(m.start + ms).x;
  assert.equal(at(40), 0);                           // 2.4 frames: still frame 0
  assert.ok(Math.abs(at(60) - 30) < 1e-9);           // 3.6 frames: frame 3 = 50 ms of 1000 -> 30 of 600
  assert.ok(Math.abs(at(99) - 30) < 1e-9);           // 5.9 frames: still frame 3
  assert.ok(Math.abs(at(100) - 60) < 1e-9);          // frame 6
  // a step is kept in saves
  assert.equal(Motion.restore(m.snapshot(m.start + 10), vm.motions, 0).step, 3);
});

const { startSplit, stopSplit, splitSample } = await import("../../web/app/js/screenfx.js");

test("V8: the RGB split steps every 6 frames, starts at full alpha for a level, and is not restarted while on (0x2f910, 0x2e3e0)", () => {
  const F = 1000 / 60;
  const s = startSplit(0, 0, 0);
  // the swing moves 3 degrees a step, a step every sixth frame
  const angle = (t) => { const r = splitSample(s, t); return Math.round(Math.atan2(-r.dy, r.dx) * 180 / Math.PI); };
  assert.equal(angle(5 * F), 30);
  assert.equal(angle(6 * F), 27);
  assert.equal(angle(11 * F), 27);
  assert.equal(angle(12 * F), 24);
  // the pulse counter after its first lap: step 34 is c = 67 (3300 + 100 - 3333), so it matches step 0.67 of a lap
  const amp = (t) => { const r = splitSample(s, t); return Math.hypot(r.dx, r.dy); };
  const pulse = (c) => { const tri = c < 1667 ? c : 3333 - c; return 0.5 - 0.5 * Math.cos(tri * Math.PI / 1666); };
  assert.ok(Math.abs(amp(34 * 6 * F) - 3.1 * (pulse(67) * 80 + 20) / 100 * 2) < 1e-9);
  // alpha: no level, from 0 over 60 frames; a level, 1 at once (02_00_ARC02_1-style FADE 40 -90 5)
  assert.equal(splitSample(s, 30 * F).alpha, 0.5);
  assert.equal(splitSample(startSplit(-90, 5, 0), 0).alpha, 1);
  // FADE 40 again while on keeps the counters and the alpha (no blink), taking the new level
  const again = startSplit(-40, 0, 30 * F, s);
  assert.equal(again.start, 0);
  assert.equal(splitSample(again, 30 * F).alpha, 1);              // a level: full at once
  const plain = startSplit(0, 0, 30 * F, s);
  assert.equal(splitSample(plain, 30 * F).alpha, 0.5);            // no level: goes on rising from where it was
  assert.equal(splitSample(plain, 54 * F).alpha, 0.9);
  assert.equal(plain.start, s.start);                             // the swing and pulse go on as they were
  // after FADE 41 the counters start again, the alpha going on from the fade-out
  const off = stopSplit(s, 60 * F);
  const back = startSplit(0, 0, 90 * F, off);
  assert.equal(back.start, 90 * F);
  assert.equal(splitSample(back, 90 * F).alpha, 0.5);
});

test("V15: the RGB split goes over the screen with overlay, red +d, green -d, blue -2d, the pass colour twice (0x2fc50)", async () => {
  const { splitPixel, overlay } = await import("../../web/app/js/screenfx.js");
  const { FS_SPLIT } = await import("../../web/app/js/renderer.js");
  const F = 1000 / 60;
  const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
  // the motion 0x2f910 gives, as the native build's frames of 00_00 op 4777 showed it (step = frames since FADE 40
  // / 6): 1.24 px at 30 degrees at once, 15.50 px at -12 at step 14, 15.16 at -30 at step 20, and after the first
  // lap (step 34, the wobble gone) 1.26 px at 12
  const s = startSplit(0, 0, 0);
  const motion = (k) => { const r = splitSample(s, k * 6 * F + 1); return [Math.hypot(r.dx, r.dy), Math.round(Math.atan2(-r.dy, r.dx) * 180 / Math.PI)]; };
  for (const [k, amp, deg] of [[0, 1.24, 30], [14, 15.5032, -12], [20, 15.1608, -30], [34, 1.2598, 12]]) {
    const [a, d] = motion(k);
    near(a, amp, 1e-4);
    assert.equal(d, deg);
  }
  // a screen whose channels tell where they were read: r = x / 1920, g = y / 1080, b = (x + y) / 3000
  const screen = (x, y) => [x / 1920, y / 1080, (x + y) / 3000];
  const split = { alpha: 1, dx: 12, dy: -5, gain: 1 };
  const [r, g, b] = splitPixel(screen, 900, 500, split);
  near(r, overlay(900 / 1920, (900 - 12) / 1920));            // red moved by +d: read from (x - dx, y - dy)
  near(g, overlay(500 / 1080, (500 - 5) / 1080));             // green by -d: read from (x + dx, y + dy)
  near(b, overlay(1400 / 3000, (900 + 24 + 500 - 10) / 3000)); // blue by -2d
  // the overlay keeps the picture where it is: a flat screen only changes contrast, it does not move
  const flat = () => [0.2, 0.6, 0.5];
  assert.deepEqual(splitPixel(flat, 10, 10, split).map((v) => Math.round(v * 1e6) / 1e6), [0.08, 0.68, 0.5]);
  // past the screen's edge a channel keeps the unmoved copy drawn first (red read from x - 12 < 0)
  near(splitPixel(screen, 5, 500, split)[0], overlay(5 / 1920, 5 / 1920));
  // a level: the channel's pass colour (255 + level) / 255 twice; and the alpha mixes with the screen
  const dim = splitPixel(screen, 900, 500, { ...split, gain: 165 / 255 });
  near(dim[0], overlay(900 / 1920, (888 / 1920) * (165 / 255) ** 2));
  const half = splitPixel(screen, 900, 500, { ...split, alpha: 0.5 });
  near(half[0], 900 / 1920 + (r - 900 / 1920) * 0.5);
  // the shader does the same (renderer.js): red from uv - d, green from uv + d, blue from uv + 2d, then overlay
  for (const part of ["moved(uv - d, b).r", "moved(uv + d, b).g", "moved(uv + 2.0 * d, b).b", "b < 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s)", "mix(b, vec3(ovl(b.r, s.r), ovl(b.g, s.g), ovl(b.b, s.b)), alpha)"]) {
    assert.ok(FS_SPLIT.includes(part), part);
  }
});

test("V9: the menu background is the engine's Gaussian (s 2.25, 15 taps 1.75 px apart, both passes twice) faded in over 12 frames (0xa0a90, 0x3bba0)", async () => {
  const { GAUSS, menuBlurAlpha } = await import("../../web/app/js/renderer.js");
  assert.equal(GAUSS.length, 15);                    // 2 x ceil(3 s) + 1 (frintp at 0xa0acc)
  const s = 2.25;
  assert.ok(Math.abs(GAUSS[7] - 1 / Math.sqrt(2 * Math.PI * s * s)) < 1e-12);
  assert.ok(Math.abs(GAUSS[0] - Math.exp(-49 / (2 * s * s)) / Math.sqrt(2 * Math.PI * s * s)) < 1e-12);
  const sum = GAUSS.reduce((a, b) => a + b, 0);
  assert.ok(sum > 0.999 && sum < 1);                 // not normalised, as the engine's
  // sigma in pixels: one pass is s taps of 1.75 px; the engine runs each direction twice, so sqrt(2) of that (a native
  // frame's edges fit 5.5 to 5.7 px)
  const pass = Math.sqrt(GAUSS.reduce((a, w, i) => a + w * ((i - 7) * 1.75) ** 2, 0) / sum);
  assert.ok(Math.abs(pass - 3.92) < 0.05);
  assert.ok(Math.abs(pass * Math.SQRT2 - 5.55) < 0.1);
  // 0x2e000 starts at 0.001 and adds 1/12 a frame; the first frame only freezes the picture; 0xa2680 cuts the level to 1/255
  assert.equal(menuBlurAlpha(1), 0);
  assert.equal(menuBlurAlpha(2), Math.trunc((0.001 + 2 / 12) * 255) / 255);
  assert.ok(Math.abs(menuBlurAlpha(2) - (0.001 + 2 / 12)) < 1 / 255);
  assert.equal(menuBlurAlpha(12), 1);
  assert.equal(menuBlurAlpha(40), 1);
});

test("V10: each layer's quake draws its own offsets; groups follow 0x34440's choice; mode 1 copies layer 1 (0x3c970)", async () => {
  const { slotShift, clipShift } = await import("../../web/app/js/effects.js");
  const vm = machine();
  let t = 1000;
  vm.now = () => t;
  for (const id of ["1", "4", "5", "6", "7", "8"]) vm.op_STCH(id, "img0001");
  await vm.commit();
  vm.op_SBAS("6", "5");                                  // 6 is 5's child
  vm.layerFor(7).link = 8;                               // 7 is linked to 8, which is a panel
  vm.layerFor(8).clip = [100, 100, 600, 400];
  vm.op_SQK2("-1", "20", "20", "0", "-1", "0", "0");    // every layer, mode 0
  t = 1200;
  const all = vm.layers;
  const at = (id, slot = "quake") => slotShift(all.get(id), all, t, slot);
  assert.notDeepEqual(at(4), at(5));                     // independent layers jitter against each other
  assert.deepEqual(at(6), at(5));                        // a child moves with its parent
  assert.deepEqual(at(7), [0, 0]);                       // a panel's layer adds none of its own ...
  const [px, py] = clipShift(all.get(8), all, t);        // ... its panel's clip (and origin) carries it
  assert.ok(px !== 0 || py !== 0);
  // mode 1: layers 2 and up copy layer 1's stored offset at their ticks
  vm.op_SQK2("-1", "20", "20", "0", "-1", "0", "1");
  t = 1500;
  assert.deepEqual(at(4), at(1));
  assert.deepEqual(at(5), at(1));
  vm.op_STCP("1", "0");                                  // layer 1 at z 0: nobody to copy (no layer 0) ...
  assert.deepEqual(at(4), at(1));                        // ... once a commit has put the depth on the record (0x62a40, 0x32450)
  await vm.commit();
  assert.deepEqual(at(4), [0, 0]);
});

test("V6 (zoom): SCH2 takes STZ4's zoom target and flag from its source, else 1000 and none; a commit ends zoom tweens (0x60840, 0x5d3a0)", async () => {
  const vm = machine();
  let t = 1000;
  vm.now = () => t;
  vm.op_STCH("39", "img2138");
  vm.op_STZ4("39", "1000", "1000", "1500", "800", "1000", "0", "1");   // a zoom on its way to 1500 x 800, flag set
  vm.op_STCH("18", "img0001");
  vm.op_STZ4("18", "1300", "1300", "1300", "1300", "0", "0", "1");
  await vm.commit();                                                    // the commit puts 39 at its target at once
  assert.equal(vm.layers.get(39).zx.at(t), 1500);
  assert.equal(vm.layers.get(39).zy.at(t), 800);
  vm.op_STZ4("39", "1500", "800", "2000", "2000", "1000", "0");        // another tween, half done
  t = 1500;
  // with a source (01_00_ARC01_3_1 op 434: SCH2 3 from 39): the source's target and flag, no tween
  vm.op_SCH2("3", "img2139", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "39");
  const l3 = vm.layerFor(3);
  assert.deepEqual([l3.zx.at(t), l3.zy.at(t), l3.zx.done(t), l3.stretch], [2000, 2000, true, true]);
  // without a source (10_01_CIEL10_4_2C op 438): 1000 and no flag, whatever the layer had
  vm.op_SCH2("18", "sie_a_37_00_n01");
  const l18 = vm.layerFor(18);
  assert.deepEqual([l18.zx.at(t), l18.zy.at(t), l18.stretch], [1000, 1000, false]);
  // the commit also ends 39's tween
  assert.ok(vm.layers.get(39).zx.at(t) < 2000);
  await vm.commit();
  assert.equal(vm.layers.get(39).zx.at(t), 2000);
});

test("V6 (STCH source): STCH's argument 18 copies the source layer as SCH2 does, then its own defaults (0x60840)", async () => {
  const vm = machine();
  let t = 1000;
  vm.now = () => t;
  vm.op_STCH("29", "img0001", "100", "50", "800", "120", "600");
  vm.op_STEC("29", "17");
  vm.op_SNX2("29", "20");
  vm.op_STZ4("29", "1500", "700", "1500", "700", "0", "0", "1");
  vm.op_STPV("29", "10", "20");
  vm.op_STRT("29", "4500", "4500", "0", "0");
  vm.op_STTR("29", "5");
  vm.op_STRA("29", "286");
  vm.op_STCH("21", "img0002"); vm.op_SBAS("21", "29");                  // 21 is 29's SBAS child
  vm.op_STCH("26", "img0003"); vm.layerFor(26).link = 29;              // 26 is linked to 29
  vm.op_STCH("31", "img0004"); vm.op_STNS("31", "2");                    // 31 has grain of its own
  await vm.commit();
  // QA_18 op 422-like: STCH 31 <picture> with x, y, scale, alpha and z blank and argument 18 = 29
  vm.op_STCH("31", "img0005", ...Array(16).fill(""), "29");
  const l = vm.layerFor(31), s = vm.layerFor(29);
  assert.deepEqual([l.x.at(t), l.y.at(t), l.scale], [100, 50, 800]);        // copied
  assert.deepEqual([l.zx.at(t), l.zy.at(t), l.stretch], [1500, 700, true]);  // STZ4's target and flag
  assert.deepEqual([l.effect, l.bright], [17, s.bright]);                   // STEC, SNX2
  assert.deepEqual([l.alpha.at(t), l.z, l.rot.at(t), l.pivot], [255, 310, 0, null]);   // STCH's defaults
  assert.deepEqual([l.rule, l.blend, l.grain], [null, 0, 2]);               // no rule; the grain stays with layer 31
  assert.equal(vm.hazes[31].next, 286);                                      // the haze state
  // the source's SBAS child and linked layer are moved over to the new layer
  assert.equal(vm.layers.get(21).parent, 31);
  assert.equal(vm.layers.get(26).link, 31);
  // without argument 18 a blank x / y / scale keeps the layer number's state (0x60840 writes them only when given):
  // on a number with no layer, the cleared state of 0x57450 / 0x62140
  vm.op_STCH("32", "img0006");
  assert.deepEqual([vm.layerFor(32).x.at(t), vm.layerFor(32).y.at(t), vm.layerFor(32).scale, vm.layerFor(32).zx.at(t)], [0, 0, 1000, 1000]);
  // SCH2 goes through the same branch: the source's SBAS child moves over, STTR's rule is not kept, and the grain is
  // the layer number's; without a source 0x60840 starts SACL, the link and STEC again (listing 0x60fbc on)
  vm.op_STCH("5", "img0007"); vm.op_STTR("5", "3"); vm.op_SACL("5", "1"); vm.op_STEC("5", "17");
  vm.layerFor(5).link = 26;
  vm.op_STCH("6", "img0008"); vm.op_SBAS("6", "5");
  await vm.commit();
  vm.op_SCH2("7", "img0009", ...Array(16).fill(""), "5");
  assert.deepEqual([vm.layerFor(7).rule, vm.layerFor(7).absolute, vm.layerFor(7).link, vm.layerFor(7).effect, vm.layerFor(7).grain], [null, true, 26, 17, 0]);
  assert.equal(vm.layers.get(6).parent, 7);
  vm.op_SCH2("5", "img0010");
  assert.deepEqual([vm.layerFor(5).absolute, vm.layerFor(5).link, vm.layerFor(5).effect, vm.layerFor(5).rule], [false, -1, 0, null]);
  assert.equal(vm.layerFor(5).x.at(t), 0);   // what it does not start again stays (layer 5's x from its STCH)
  // and STCH without a source on a number that holds a layer: the same, then STCH's own defaults
  vm.op_STCH("12", "img0011", "300", "40", "700", "", "", "", "", "", "", "", "100", "20", "600", "400", "8", "2");
  vm.op_SBAS("12", "6"); vm.op_SOXY("12", "", "", "9", "6"); vm.op_STEC("12", "17"); vm.op_STGS("12", "", "80", "0");
  vm.layerFor(12).link = 7;
  await vm.commit();
  vm.op_STCH("12", "img0012");
  const k = vm.layerFor(12);
  assert.deepEqual([k.x.at(t), k.y.at(t), k.scale, k.parent, k.offset, k.clip, k.border, k.frame], [300, 40, 700, 6, [9, 6], [100, 20, 600, 400], 8, 2]);
  assert.deepEqual([k.link, k.effect, k.alpha.at(t), k.z], [-1, 0, 255, 120]);
  // STCC clears the number: the next STCH starts from x 0, y 0 again, even before the commit
  vm.op_STCC("12");
  vm.op_STCH("12", "img0013");
  assert.deepEqual([vm.layerFor(12).x.at(t), vm.layerFor(12).y.at(t), vm.layerFor(12).parent, vm.layerFor(12).clip], [0, 0, -1, null]);
});

test("V6 (empty number): a layer number keeps its state with no picture on it; STCP's blank z is 0 (0x62a40, 0x57450)", async () => {
  const vm = machine();
  let t = 1000;
  vm.now = () => t;
  // 10_00_ARC10_8_2 ops 1232-1238: layer 0 is cleared, given depth 2, then copied to layer 1 by SCH2
  vm.op_STCH("0", "img0597", "240", "136", "1000", "255", "2");
  await vm.commit();
  vm.op_STCC("0");
  vm.op_STCP("0", "2");
  await vm.commit();
  assert.equal(vm.layers.get(0), undefined);                 // nothing drawn on layer 0
  vm.op_SCH2("1", "img0597", ...Array(16).fill(""), "0");
  assert.deepEqual([vm.layerFor(1).z, vm.layerFor(1).x.at(t), vm.layerFor(1).y.at(t)], [2, 0, 0]);
  // what SBAS, STCL and SOXY write on an empty number stays for its next STCH without a source; STCC clears it
  vm.op_SBAS("7", "1"); vm.op_STCL("0", "7", "", "", "300", "90", "0"); vm.op_SOXY("7", "", "", "6", "3");
  vm.op_STCH("7", "img0002");
  assert.deepEqual([vm.layerFor(7).parent, vm.layerFor(7).x.at(t), vm.layerFor(7).y.at(t), vm.layerFor(7).offset], [1, 300, 90, [6, 3]]);
  vm.op_STCC("7"); vm.op_STCP("7", "5"); vm.op_STCC("7");
  vm.op_STCH("8", "img0003", ...Array(16).fill(""), "7");     // copies the cleared number 7
  assert.deepEqual([vm.layerFor(8).x.at(t), vm.layerFor(8).parent, vm.layerFor(8).z], [0, -1, 80]);
  // the state is saved with the game
  vm.op_STCP("20", "9");
  const snap = JSON.parse(JSON.stringify(vm.snapshot()));
  vm.getScript = async () => vm.script;
  vm.loop = () => {};
  await vm.restore(snap);
  vm.op_SCH2("21", "img0004", ...Array(16).fill(""), "20");
  assert.equal(vm.layerFor(21).z, 9);
  // STCP with a blank z hides the layer (z 0), where the port kept the old depth
  vm.op_STCP("21", "");
  assert.equal(vm.layerFor(21).z, 0);
});

test("V6 (pivot): SCH2 moves the source's STPV pivot by the two pictures' own pivots; without a source it drops it (0x60840)", () => {
  // two A-size poses whose own pivots differ across (0.5 and 0.3 of the width); imageSize: 400 x 800 px -> 150 x 302.2
  const images = { SIE_A_00_00_N00: [400, 800, 1, 0.5, 0.9], SIE_A_00_01_N00: [400, 800, 1, 0.3, 0.9] };
  const vm = machine({ gfx: { images } });
  vm.op_STCH("3", "sie_a_00_00_n00", "200", "200");
  vm.op_STPV("3", "100", "50");
  vm.op_SCH2("4", "sie_a_00_01_n00", ...Array(16).fill(""), "3");
  const [px, py] = vm.layerFor(4).pivot;
  assert.ok(Math.abs(px - (100 - 75 + 45)) < 1e-9 && Math.abs(py - 50) < 1e-9);   // 25 right of the own pivot, still
  vm.op_SCH2("3", "sie_a_00_00_n00", ...Array(16).fill(""), "3");             // same picture: unchanged
  assert.ok(Math.abs(vm.layerFor(3).pivot[0] - 100) < 1e-9 && Math.abs(vm.layerFor(3).pivot[1] - 50) < 1e-9);
  vm.op_SCH2("3", "sie_a_00_01_n00");                                           // no source: the picture's own
  assert.equal(vm.layerFor(3).pivot, null);
});

test("open items: the table pivot cut to whole units, the pivot record shift, SACL's own clip, blobs by width (0x60840, 0x34440, 0x37f50, 0x32e30 / 0x34a70)", async () => {
  const { place, pivotOf } = await import("../../web/app/js/transform.js");
  const { bandBlob } = await import("../../web/app/js/renderer.js");
  // a 400 x 800 picture (150 x 302.2 script units, 200 x 402.2 table units); its table pivot loses 0.25 / 200 across
  const info = () => [400, 800, 1, 0.5, 0.5, 0.25 / 200, 0];
  const at = (l) => place([l], new Map([[l, { x: 100, y: 100, zx: 1000, zy: 1000, rot: 0, alpha: 255 }]]), info).get(l);
  const base = { id: 1, image: "x", parent: -1, link: -1, scale: 1000, z: 10 };
  // cut: the pivot is the table's less its fraction, and the record matches it: no shift
  const cut = at({ ...base, cut: true }), whole = at({ ...base });
  assert.ok(Math.abs(pivotOf({ image: "x", cut: true }, info())[0] - (75 - 0.25 * 0.75)) < 1e-9);
  assert.ok(Math.abs(cut.x - (100 * 4)) < 1e-9);
  // an uncut table pivot (STCH from a source, no record given) is shifted by its fraction: 0.25 units x 3 px
  assert.ok(Math.abs(whole.x - (400 + 0.75)) < 1e-9);
  // an STPV pivot of 100 script units is 133.33 table units: drawn 0.333 x 3 px = 1 px right
  const stpv = at({ ...base, pivot: [100, null] });
  assert.ok(Math.abs(stpv.x - 401) < 1e-9);
  // STCH from a source keeps the copied pivot's record: 20 units left of the table's own -> drawn 60 px right
  const rec = at({ ...base, base: [80, 201] });
  assert.ok(Math.abs(rec.x - (400 + 20 * 3)) < 1e-6);
  // SACL: the layer is not moved by its link's clip, but the panel group (0x3bba0, by link) still bounds it
  const owner = { ...base, id: 2, clip: [100, 100, 400, 300] };
  const all = new Map([[1, null], [2, owner]]);
  const layer = { ...base, link: 2, clip: null, absolute: true, cut: true };
  all.set(1, layer);
  const states = new Map([[layer, { x: 100, y: 100, zx: 1000, zy: 1000, rot: 0, alpha: 255 }], [owner, { x: 0, y: 0, zx: 1000, zy: 1000, rot: 0, alpha: 255 }]]);
  const sacl = place([layer], states, info, all).get(layer);
  assert.deepEqual([sacl.clip.rect, sacl.x], [[100, 100, 400, 300], 400]);
  // the blob by edge width in 960-wide units
  assert.deepEqual([5, 10, 31, 32, 40, 64, 127, 128, 300].map(bandBlob), ["020", "064", "064", "080", "128", "256", "256", "512", "512"]);
});

test("open items in the VM: STCH / SCH2 without a source cut the pivot; STCH from an STPV'd source records its pivot (0x60840)", () => {
  const images = { SIE_A_00_00_N00: [400, 800, 1, 0.5, 0.9], SIE_A_00_01_N00: [400, 800, 1, 0.3, 0.9] };
  const vm = machine({ gfx: { images } });
  vm.op_STCH("3", "sie_a_00_00_n00", "200", "200");
  assert.deepEqual([vm.layerFor(3).cut, vm.layerFor(3).base, vm.layerFor(3).pivot], [true, null, null]);
  vm.op_STPV("3", "100", "50");
  vm.op_STCH("4", "sie_a_00_01_n00", ...Array(16).fill(""), "3");
  const l = vm.layerFor(4);
  // the copy moved the pivot to 70, 50 script units (as SCH2 would); STCH then takes the table's, keeping the record
  assert.deepEqual([l.cut, l.pivot, l.base], [false, null, [Math.trunc(70 * 4 / 3), Math.trunc(50 * 362 / 272)]]);
  vm.op_SCH2("5", "sie_a_00_01_n00", ...Array(16).fill(""), "3");
  assert.deepEqual([vm.layerFor(5).cut, vm.layerFor(5).base], [false, null]);
  vm.op_STPV("4", "10", "10");
  assert.equal(vm.layerFor(4).base, null);
});

// ---- section 3: sound (audio.js, with a stand-in Web Audio context) ------------------------------------------------
const { Audio, parseOpts, curveOf, bezier } = await import("../../web/app/js/audio.js");
const { withContext } = await import("./fake-audio.mjs");
const soundTables = existsSync(asset("system.json")) ? readAsset("system.json") : null;
function sound() {
  localStorage.removeItem("tsuki.volumes");   // the game's defaults: BGM 40, SE 40, menu 10, rows 50
  const audio = new Audio();
  const h = withContext(audio);
  if (soundTables?.volumeCurve) audio.setTables(soundTables);
  audio.table = { bgm: ["M1", "M2", "M3"] };
  return { audio, started: h.ctx.sources, ...h };
}
const near = (a, b, msg = "", e = 1e-4) => assert.ok(Math.abs(a - b) < e, `${msg} ${a} vs ${b}`);
const frames = (n) => n / 60;

test("A1: music is ca0(B(L x BGM)), plain effects ca0(L x SE), through the table at 0x3355f0 (0x9b5d0, 0x9b690, 0xca0)", async () => {
  if (!soundTables?.volumeCurve) return;
  const T = soundTables.volumeCurve;
  assert.deepEqual([T[10], T[20], T[25], T[40], T[50], T[99], T[100]].map((v) => Math.round(v * 1e4) / 1e4), [0.0218, 0.0692, 0.1, 0.2115, 0.3115, 0.9885, 1]);   // T99 is used only as the top of the 0.98 step
  // ca0's ends: the value itself below 0.0014423, 0 up to 0.01, 1 from 0.99; B is the 0.77 Bezier
  assert.deepEqual([curveOf(T, 0.001), curveOf(T, 0.005), curveOf(T, 0.995)], [0.001, 0, 1]);
  near(bezier(0.5), 1.54 * 0.5 - 0.54 * 0.25, "B(0.5)", 1e-6);
  const { audio, started, gainOf } = sound();
  // 0x48ac0 re-applies BGM 40 as floor(floor(256 x 40 / 200) x 100 / 128) = 39; 50 stays 50; Mute is 0
  assert.equal(audio.musicByte(), 39);
  // the values at the defaults (web-dev/audit/function-map/audio.md): music 0.3367 at 017 100; SE 0.2115 / 0.0692 / 0.0308
  near(audio.musicGain(100), 0.3367);
  near(audio.seGain(100), 0.2115);
  near(audio.seGain(50), 0.0692);
  near(audio.seGain(30), 0.0308);
  // music and effects carry their amplitude per sound: their groups stay at 1, the menu group at the menu volume
  assert.deepEqual([audio.groups.bgm.gain.value, audio.groups.se.gain.value, audio.groups.sys.gain.value], [1, 1, 0.1]);
  await audio.playBGM(1, parseOpts(["`017:100"]));
  await audio.playSE(4, true, "RAIN", parseOpts(["`017:50"]));
  const [music, rain] = started;
  near(gainOf(music), 0.3367);
  near(gainOf(rain), 0.0692);
  // a setting moved reaches what plays at once (0x9d1c0, the mixer tracking snd+0xa)
  audio.setVolume("bgm", 1);
  audio.setVolume("se", 1);
  near(gainOf(music), 1);
  near(gainOf(rain), 0.3115);
  audio.setVolume("bgm", 0.5);
  near(audio.musicGain(50), curveOf(T, bezier(0.25)));
  audio.setVolume("bgmMute", true);
  assert.equal(gainOf(music), 0);
  // the Music Player: ca0(B(its own volume)), no BGM setting (0x9c8f0)
  assert.equal(audio.playerGain(0.6), curveOf(T, bezier(0.6)));
  // the second interface player: ca0(SE / 100) (0xacfa0); SE Test: SE / 100, linear (0x29140)
  await audio.playSys(7, "se");
  near(gainOf(started.at(-1)), curveOf(T, 1));
  await audio.playTest("se", "MOON_SE03001");
  assert.equal(gainOf(started.at(-1)), 1);
});

test("A2: a voiced effect (070) with no fade-in follows its row and the voice switch, linear; not the SE volume or Mute (0x9caa0, 0x9cd40)", async () => {
  const { audio, started, gainOf } = sound();
  await audio.playSE(5, true, "SEV_X", parseOpts(["`017:100", "`070:3"]));   // character 3: row 2
  const sev = started.at(-1);
  assert.equal(audio.se.get(5).kind, "voiced");
  assert.equal(gainOf(sev), 0.5, "017 100 x row 50, no curve");
  audio.setVolume("se", 0.1);
  audio.setVolume("seMute", true);
  assert.equal(gainOf(sev), 0.5, "neither the SE volume nor its Mute");
  audio.setCharacter(2, { volume: 80 });
  assert.equal(gainOf(sev), 0.8, "the row's volume, while it plays");
  audio.setVoiceSwitch(false);
  assert.equal(gainOf(sev), 0, "Play all voices off");
  audio.setVoiceSwitch(true);
  audio.setCharacter(2, { on: false });
  assert.equal(gainOf(sev), 0, "its row muted");
  audio.setCharacter(2, { on: true });
  audio.setVolume("seMute", false);
  // with a fade-in it is a type-1 channel: SE volume and curve, the row only deciding whether it sounds (0x9cbf0)
  await audio.playSE(6, false, "SEV_Y", parseOpts(["`017:100", "`070:3", "`001:800"]));
  assert.equal(audio.se.get(6).kind, "se");
  assert.equal(gainOf(started.at(-1), 1), audio.seGain(100));
  // a row off when it starts: volume 0 for good (0x6a340 zeroes 017)
  audio.setCharacter(3, { on: false });
  await audio.playSE(7, true, "SEV_Z", parseOpts(["`017:100", "`070:4"]));
  audio.setCharacter(3, { on: true });
  assert.equal(gainOf(started.at(-1)), 0);
  assert.equal(audio.seLast[7], 0);
});

test("A3: fades are linear in level, so the amplitude follows the curve; MPLY's fade-in ends after 017/100 x 001; +1000 ms on a channel fading out", async () => {
  const { audio, started, ctx, gainOf } = sound();
  await audio.playBGM(1, parseOpts(["`017:80", "`001:2000"]));
  const m = started[0];
  near(audio.bgm.lv.end(), 1.6, "0 -> 80 at 1666.67 / 2000 a frame", 1e-3);
  near(gainOf(m, 0.8), audio.musicGain(40), "half way: level 40");
  assert.equal(gainOf(m, 1.7), audio.musicGain(80));
  // MFAD 1000: at the last volume's rate (80 x 1000/60/1000 a frame), linear in level
  ctx.currentTime = 2;
  audio.fadeBGM(1000);
  near(gainOf(m, 2.5), audio.musicGain(40), "level 40 at half time, not half the amplitude");
  assert.ok(gainOf(m, 2.5) < audio.musicGain(80) / 2);
  assert.equal(gainOf(m, 3.01), 0);
  // SEFD from the level it is at over 001 (0x9d020)
  ctx.currentTime = 10;
  await audio.playSE(2, true, "RAIN", parseOpts(["`017:100"]));
  const rain = started.at(-1);
  audio.fadeSE(2, 1000);
  near(gainOf(rain, 10.5), audio.seGain(50));
  // an SEPL fade-in on a channel still fading out takes 1000 ms more (0x6a340: 001 + 1000 when 0x9cfc0 is 2)
  ctx.currentTime = 10.2;
  await audio.playSE(2, true, "WIND", parseOpts(["`017:100", "`001:500"]));
  assert.ok(rain.stopped, "the new sound replaces the one fading out");
  near(audio.se.get(2).lv.end() - 10.2, 1.5, "fade-in 1500 ms", 1e-6);
  // ... and 001:0 there is a 1000 ms fade-in too; on a quiet channel 001 under 2 is none
  await audio.playSE(3, false, "DOOR", parseOpts(["`017:100", "`001:1"]));
  assert.equal(audio.se.get(3).lv.at(10.2), 100);
});

test("A4: an undelayed SEVL retunes a waiting SEPL (it plays after its delay); an undelayed SEFD drops it (0x6ae10, 0x6b310)", async () => {
  const calls = [];
  const audio = {
    playSE: (ch, loop, name, o, f) => calls.push(["play", ch, name, o["017"], f.delayed]),
    volSE: (ch, o, f) => calls.push(["vol", ch, o["017"], f.delayed]),
    fadeSE: (ch, ms, f) => calls.push(["fade", ch, ms, f.delayed]),
    stopSE: (ch) => calls.push(["stop", ch]),
  };
  const vm = machine({ audio });
  let t = 0;
  vm.clock.read = vm.soundClock.read = () => t;   // the delay slots count on their own clock (TODO item 62, N2-123)
  const later = async (ms) => { t += ms; await new Promise((r) => setTimeout(r, 70)); };
  // 14_01B_01_CIEL14B_1D ops 660-685: delayed loops retuned by plain SEVLs
  vm.op_SEPL("4", "1", "WOH_SE12031", "`017:100", "`068:500");
  vm.op_SEVL("4", "`017:40", "`001:1000");
  assert.deepEqual(calls, [], "the SEVL only changes the waiting SEPL's volume");
  await later(600);
  assert.deepEqual(calls, [["play", 4, "WOH_SE12031", 40, true]]);
  // a plain SEFD while an SEPL counts down: the SEPL is gone for good (0x6b310 clears counter and kind)
  calls.length = 0;
  vm.op_SEPL("5", "0", "A", "`068:500");
  vm.op_SEFD("5", "`001:300");
  vm.op_SEPL("5", "0", "B", "`068:500");
  assert.deepEqual(calls, [["fade", 5, 300, false]], "A does not run when B takes the slot");
  await later(600);
  assert.deepEqual(calls.at(-1), ["play", 5, "B", undefined, true]);
  // a waiting SEPL whose countdown a plain SEPL zeroed stays in the slot: SEFD leaves it, SEVL retunes it
  calls.length = 0;
  vm.op_SEPL("6", "0", "C", "`017:90", "`068:500");
  vm.op_SEPL("6", "0", "D");
  vm.op_SEFD("6", "`001:200");
  vm.op_SEVL("6", "`017:30");
  vm.op_SEPL("6", "0", "E", "`068:500");
  assert.deepEqual(calls, [["play", 6, "D", undefined, false], ["fade", 6, 200, false], ["play", 6, "C", 30, true]]);
  // a waiting SEVL or SEFD is left alone by plain commands
  calls.length = 0;
  vm.op_SEVL("7", "`017:20", "`001:100", "`068:300");
  vm.op_SEVL("7", "`017:60");
  vm.op_SEFD("7", "`001:100");
  await later(400);
  assert.deepEqual(calls, [["vol", 7, 60, false], ["fade", 7, 100, false], ["vol", 7, 20, true]]);
  // channel -1: every channel's slot (0x66200) and every channel's sound (0x6b310)
  calls.length = 0;
  vm.op_SEFD("-1", "`001:500");
  assert.equal(calls.length, 20);
  vm.op_SEFD("-1", "`001:500", "`068:200");
  assert.equal(vm.delayed.size, 20);
  vm.cancelDelayed();
});

test("A5: the speaker 23 voices (M00, M01, M02, M11, M12) play at row 18's volume and Mute, and are never 'heard' (0x29390, 0x29300)", async () => {
  const { audio, started, gainOf } = sound();
  audio.voices = soundTables?.voices || { prefixes: { M00: 23, A00: 1 }, speakers: [0x40000, 1, ...Array(21).fill(0x40000), 0x40000], rowFlags: [] };
  assert.equal(audio.rowOf("M00_01_00_0001_0"), 18);
  assert.equal(audio.characterOf("M00_01_00_0001_0"), -1);
  audio.setCharacter(18, { volume: 30 });
  await audio.playVoice("M00_01_00_0001_0");
  assert.equal(gainOf(started.at(-1)), 0.3);
  audio.setCharacter(18, { on: false });
  const n = started.length;
  await audio.playVoice("M11_01_00_0001_0");
  assert.equal(started.length, n, "row 18 muted: not played");
});

test("A6: nn::atk's pan law (0x12d108 / 0x12a1a8, sqrt curve 0x3cf91c): 018 doubled only for immediate plain effects (0x9ce60)", async () => {
  const { audio } = sound();
  const m = (ch) => audio.se.get(ch).n.matrix;
  const T = (i) => Math.sqrt(1 - i / 256);   // the table at 0x3cf91c
  // a stereo effect wave, dual mode: channel 0 at q - 1, channel 1 at q + 1; 018 96 is p 0.5
  await audio.playSE(1, false, "A", parseOpts(["`017:100", "`018:96"]));
  assert.deepEqual(m(1), [[T(128), T(128)], [0, 1]], "immediate: q = 2p = 1, the left channel to the centre");
  await audio.playSE(2, false, "B", parseOpts(["`017:100", "`018:96"]), { delayed: true });
  assert.deepEqual(m(2), [[T(64), T(192)], [0, 1]], "delayed: q = p = 0.5 (0x65780 has no 0x9ce60)");
  // a voiced effect is a mono wave (SEV_*): it sits at q, 0.7071 each side when centred
  await audio.playSE(3, false, "SEV_C", parseOpts(["`017:100", "`018:96", "`070:2"]));
  assert.deepEqual(m(3), [[T(192), T(64)]], "type 2: q = p");
  await audio.playSE(4, false, "SEV_D", parseOpts(["`017:100", "`018:32", "`070:2", "`001:500"]));
  assert.deepEqual(m(4), [[1, 0]], "a voiced effect with a fade-in is type 1: q = 2p = -1, all left");
  await audio.playSE(5, false, "SEV_E", parseOpts(["`017:100", "`070:2"]));
  assert.deepEqual(m(5), [[Math.SQRT1_2, Math.SQRT1_2]]);
  // no 018: a stereo wave plays as it is
  await audio.playSE(6, false, "E", parseOpts(["`017:100"]));
  assert.deepEqual(m(6), [[1, 0], [0, 1]]);
  // streams are in balance mode: music's channels each on their side at 0.7071, a voice (mono) 0.7071 each side
  await audio.playBGM(1, parseOpts(["`017:100"]));
  assert.deepEqual(audio.bgm.n.matrix, [[Math.SQRT1_2, 0], [0, Math.SQRT1_2]]);
  assert.equal(audio.streamShare, Math.SQRT1_2);
  await audio.playVoice("A00_1");
  assert.deepEqual(audio.voice.at(-1).matrix, [[Math.SQRT1_2, Math.SQRT1_2]]);
});

test("A7: a delayed fade-in SEPL rises at |017 - the channel's last volume| x 1000/60/001 a frame (0x65780 -> 0x9d0b0)", async () => {
  const { audio } = sound();
  const play = (ch, o) => audio.playSE(ch, true, "RAIN", parseOpts(o), { delayed: true });
  // after an SEFD (last 0): exactly 001
  audio.seLast[1] = 100;
  audio.fadeSE(1, 500);
  await play(1, ["`017:100", "`001:2000"]);
  near(audio.se.get(1).lv.end(), 2, "", 1e-6);
  // the last volume repeated: rate 0, so 0.2 a frame: 100 / 0.2 = 500 frames
  audio.seLast[2] = 100;
  await play(2, ["`017:100", "`001:2000"]);
  near(audio.se.get(2).lv.end(), frames(500), "", 1e-6);
  // half the difference: twice as long
  audio.seLast[3] = 50;
  await play(3, ["`017:100", "`001:2000"]);
  near(audio.se.get(3).lv.end(), 4, "", 1e-6);
  // the immediate path keeps 001
  audio.seLast[4] = 100;
  await audio.playSE(4, true, "RAIN", parseOpts(["`017:100", "`001:2000"]));
  near(audio.se.get(4).lv.end(), 2, "", 1e-6);
  // the end of a script puts every last volume back to -1 (0x5f200)
  audio.stopAll();
  assert.ok(audio.seLast.every((v) => v === -1));
});

test("A8: fast forward does not cut MFAD / SEFD fades; the read-scene skip and test jumps do (0x64fa0, 0x6b310)", () => {
  const calls = [];
  const vm = machine({ audio: { fadeSE: (ch, ms) => calls.push(["SEFD", ms]), fadeBGM: (ms) => calls.push(["MFAD", ms]) } });
  vm.skip = true;
  vm.op_SEFD("3", "`001:2000");
  vm.op_MFAD("`001:1500", "`011:0");
  vm.instant = true;
  vm.op_SEFD("3", "`001:2000");
  vm.op_MFAD("`001:1500", "`011:0");
  vm.instant = false;
  vm.skipUntil = 99;
  vm.op_MFAD("`001:1500", "`011:0");
  assert.deepEqual(calls, [["SEFD", 2000], ["MFAD", 1500], ["SEFD", 0], ["MFAD", 0], ["MFAD", 0]]);
});

test("A10, N2-25: the archive's 96 / 127 and the system's 127 / 96 cancel; delayed loops restart; two voice handles; MVOL at the last volume crawls; a finished track keeps its number", async () => {
  const { audio, started, ctx } = sound();
  // (a) every sound of the archive has volume 96 of 127 and the sound system's master (+0x2c) is 127 / 96 (N2-25, measured on a native run's mix)
  assert.ok(Math.abs(audio.master.gain.value - 1) < 1e-12, String(audio.master.gain.value));
  // (b) the delayed path has no same-loop check (0x65780)
  await audio.playSE(3, true, "RAIN", parseOpts(["`017:60"]));
  await audio.playSE(3, true, "RAIN", parseOpts(["`017:60"]));
  assert.equal(started.length, 1);
  await audio.playSE(3, true, "RAIN", parseOpts(["`017:60"]), { delayed: true });
  assert.equal(started.length, 2);
  // (c) voices take handles 2 and 3 in turn: a third VPL2 voice cuts the oldest; a message's voice stops both
  const v0 = started.length;
  await audio.playVoice("A00_1");
  await audio.playVoice("A00_2", true);
  await audio.playVoice("A00_3", true);
  const [a, b, c] = started.slice(v0);
  assert.deepEqual([a.stopped, b.stopped, c.stopped], [true, false, false]);
  await audio.playVoice("A00_4");
  assert.deepEqual([b.stopped, c.stopped], [true, true]);
  // (d) MVOL to the last volume during a fade-in: rate 0, 0.2 a frame (0x653b0)
  await audio.playBGM(1, parseOpts(["`017:100", "`001:2000"]));
  ctx.currentTime = 0.5;
  audio.volBGM(parseOpts(["`017:100", "`001:500"]));
  near(audio.bgm.lv.at(0.5), 25);
  near(audio.bgm.lv.end() - 0.5, frames(75 / 0.2), "", 1e-6);
  // (e) a track played once keeps its number when it ends: MPLY of it does nothing (0xac0688)
  await audio.playBGM(2, parseOpts(["`017:100", "`049:0"]));
  const once = started.at(-1);
  once.end();
  const n = started.length;
  await audio.playBGM(2, parseOpts(["`017:100", "`049:0"]));
  assert.equal(started.length, n);
  assert.equal(audio.bgmState.n, 2);
});

test("A11: a fade, MFAD or cut asked for while the track is still being decoded moves its level; the sound starts on it", async () => {
  const { audio, started, gainOf, ctx } = sound();
  audio.playBGM(2, {});   // not awaited: the stream is still loading
  assert.equal(audio.bgm.music, 2);
  assert.equal(audio.bgm.n, undefined, "no node yet");
  audio.stopBGM(500);     // threw before: rec.n held the number 2
  await new Promise((r) => setTimeout(r, 0));
  const s = started.at(-1);
  near(gainOf(s, 0), audio.musicGain(100));
  near(gainOf(s, 0.25), audio.musicGain(50), "half way down 500 ms");
  // MFAD on a loading track
  ctx.currentTime = 10;
  audio.playBGM(3, {});
  audio.fadeBGM(1000);
  await new Promise((r) => setTimeout(r, 0));
  near(gainOf(started.at(-1), 10.5), audio.musicGain(50));
  // a cut before it loads: nothing plays
  const k = started.length;
  audio.playBGM(1, {});
  audio.stopBGM(0);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(started.length, k);
});

// ---- section 4: M4 (voice rows) and M12 (the scroll bar) ----------------------------------------------------------
const { UI } = await import("../../web/app/js/ui.js");
const { SCROLLBAR, ScrollBarFx, py } = await import("../../web/app/js/uifx.js");

test("M4: a voice marks its row heard also while skipping (0x7a420 -> 0x29300); Shiki's row in the game follows F023 and the script (0x29fa0)", async () => {
  const vm = machine({ audio: { characterOf: () => 2, playVoice() {} } });
  vm.system = { voices: { rowFlags: Array.from({ length: 19 }, (_, i) => 100 + i) } };
  vm.skip = true;
  vm.op_VPLY("A20_01_00_0001_0");
  vm.op_VPL2("A20_01_00_0002_0");
  assert.equal(vm.getVar("G102") & 4, 4);
  // the rows: Shiki (0) and row 2 heard
  const v = { rowFlags: Array.from({ length: 19 }, (_, i) => 100 + i), hiddenNames: 0 };
  const vars = { G100: 4, G102: 4, F023: 0 };
  const fake = { vm: { system: { voices: v }, getVar: (k) => vars[k] || 0, flow: { started: new Set([485, 1]) }, scriptIndex: 10 } };
  const rows = (fromTitle) => UI.prototype.voiceRows.call(fake, fromTitle).map((r) => [r.i, r.face, r.name]);
  assert.deepEqual(rows(true), [[0, 0, 0], [2, 2, 2]], "from the title: by scenes 485 and 1");
  assert.deepEqual(rows(false), [[2, 2, 2]], "in the game with F023 = 0: no Shiki row");
  vars.F023 = 12;
  assert.deepEqual(rows(false)[0], [0, 0, 0]);
  fake.vm.scriptIndex = 1;   // 00_00
  assert.deepEqual(rows(false)[0], [0, 19, 0]);
  fake.vm.scriptIndex = 3;   // 00_02
  assert.deepEqual(rows(false)[0], [0, 18, 19]);
});

test("M4: a voice Test plays at row x the voice switch on interface handle 4; later sound changes re-level the voice playing or stop it (0x2b930, 0x2a9b0, 0x9d240)", async () => {
  const { audio, started, gainOf } = sound();
  audio.setCharacter(5, { volume: 70 });
  await audio.playTest("voice", "B00_TEST", 5);
  const t = started.at(-1);
  assert.equal(gainOf(t), 0.7);
  assert.equal(audio.testRow, 5);
  audio.setVoiceSwitch(false);
  await audio.playTest("voice", "B00_TEST", 5);
  const t2 = started.at(-1);
  assert.equal(gainOf(t2), 0, "silent with Play all voices off, but played");
  assert.ok(t.stopped, "the previous Test stopped (handle 4)");
  audio.setVoiceSwitch(true);
  for (let i = 0; i < 4; i++) await audio.playSys(1);   // the interface sounds go round handles 4-7
  assert.ok(t2.stopped, "the one landing on handle 4 cut the Test voice");
  // a story voice playing, then a config change: it takes the Test row's volume
  await audio.playVoice("A00_1");
  const story = started.at(-1);
  audio.setCharacter(5, { volume: 30 });
  assert.equal(gainOf(story), 0.3);
  audio.setCharacter(5, { on: false });
  assert.ok(story.stopped, "the Test row muted: the voices stop (0x9c3b0)");
  // pressing Test on a muted row plays nothing
  const n = started.length;
  await audio.playTest("voice", "B00_TEST", 5);
  assert.equal(started.length, n);
  // no sample: no test row, no change
  await audio.playTest("voice", undefined, 6);
  assert.equal(audio.testRow, -1);
});

test("M12: the scroll bar sits where 0x9ad04 puts it and eases to a new position over 12 frames, quadratic out (0x9ae58, 0x9b0c4)", () => {
  assert.deepEqual([SCROLLBAR.bar, SCROLLBAR.thumbX, SCROLLBAR.top, SCROLLBAR.frames, SCROLLBAR.strip],
    [[615.6666870117188, 43.55555725097656], 613, 41.06666564941406, 12, [613, 41, 639, 409]]);
  // docked: 1:1 on the stage, the thumb's top from 99 to 707 px
  assert.ok(Math.abs(py(SCROLLBAR.top) - 99) < 0.01 && Math.abs(py(SCROLLBAR.top + SCROLLBAR.track) - 707) < 0.01);
  const fx = new ScrollBarFx(0);
  fx.set(1);
  fx.step(6);
  assert.equal(fx.shown(), 0.75, "half way in time, 1 - (1 - 0.5)^2 of the way");
  fx.set(0);   // a new target starts from where it is shown
  assert.equal(fx.shown(), 0.75);
  fx.step(12);
  assert.equal(fx.shown(), 0);
  fx.set(0.5, { now: true });
  assert.equal(fx.shown(), 0.5);
});

const { ConfigScroll, configFollow, voiceScrollMax, CONFIG: CONF } = await import("../../web/app/js/uifx.js");

test("M20: a config page's scroll moves as the bar's thumb does; keys keep the widget 260-870 px down; the Sound page's range is 122 a row less 113 (0x2aa80, 0x29bf0, 0x2a730)", () => {
  assert.deepEqual([CONF.clip, CONF.tabs, CONF.tabBg, CONF.pageBg], [[407, 165, 1402, 858], [[408, 96], [656, 96], [888, 96], [1536, 96]], [400, 96], [386, 164]]);
  assert.deepEqual([voiceScrollMax(0), voiceScrollMax(1), voiceScrollMax(19)], [0, 9, 2205]);
  const s = new ConfigScroll(485, 600);
  assert.equal(s.target, 485, "held in range");
  s.jump(0);
  s.set(100);
  assert.equal(s.shown(), 0);
  s.step(6);
  assert.equal(s.shown(), 75, "half way in time, 1 - (1 - 0.5)^2 of the way");
  s.set(0);   // a new position starts from where the page is shown
  assert.equal(s.shown(), 75);
  s.step(12);
  assert.equal(s.shown(), 0);
  s.set(-30.7);
  assert.equal(s.target, 0);
  // the follow: 260 px of room above, 210 below (870 from the top)
  assert.equal(configFollow(0, 243), 0, "row 0 stays");
  assert.equal(configFollow(0, 1392, { max: 485 }), 485, "the last row: as far as the range goes");
  assert.equal(configFollow(400, 879), 400, "in view: no change");
  assert.equal(configFollow(700, 879), 619, "above the top: 260 px above it");
  assert.equal(configFollow(0, 1000), 130, "below: 870 px below it");
  // a character row's slider counts from 108 / 98 px lower than its place (its picture's top)
  assert.equal(configFollow(0, 784, { voiceKnob: true }), 12);
  assert.equal(configFollow(0, 892), 22, "the row's minus");
  assert.equal(configFollow(1000, 784, { voiceKnob: true }), 632);
});

test("M20: the config's widgets come from the engine's tables: places, hit boxes and each state's cells (0x46b370, 0x46eb20, 0x46cdb0, 0x29fa0, 0x2d980)", () => {
  if (!soundTables?.config) return;
  const cfg = soundTables.config;
  // the slider's knob: the white dot (conf_sbtn's lower row) normally, the cyan ring lit
  const knob = cfg.buttons["58"];
  assert.deepEqual([knob.states[0][0].rect, knob.states[1][0].rect], [[0, 256, 936, 504], [0, 0, 936, 248]]);
  assert.deepEqual(knob.hit, [432, 94.018, 501, 151.875]);
  // a choice: normal, lit and on 256 px apart in btn_base1, from x -10, drawn 10 px up and left of the place
  const on = cfg.buttons["69"].states;
  assert.deepEqual([on[0][0].rect, on[1][0].rect, on[2][0].rect], [[-10, 6, 130, 74], [246, 6, 386, 74], [502, 6, 642, 74]]);
  assert.deepEqual([on[0][0].x, on[0][0].y], [-10, -10]);
  assert.deepEqual(cfg.buttons["70"].states[2][0].rect, [502, 90, 642, 158], "OFF's on cell sits 4 px higher");
  const place = (p, id) => cfg.pages[p].rows.flatMap((r) => r.widgets).find((w) => w.id === id);
  assert.deepEqual([place(0, 71).x, place(0, 71).y], [871, 868], "Display confirmation beside the choices");
  assert.deepEqual([place(0, 69).x, place(0, 69).y], [731, 879]);
  assert.deepEqual([place(1, 84).x, place(1, 84).y], [1430, 307], "SE Mute");
  assert.deepEqual([place(1, 85).x, place(1, 85).y], [1682, 310], "SE Test");
  assert.equal(place(1, 99).x, null, "the character rows are placed when the page opens");
  assert.deepEqual(cfg.pages.map((p) => p.scrollMax), [485, 2338, 0]);
  assert.deepEqual(cfg.pages[1].rows[1].widgets.map((w) => w.kind), [3, 4, 5, 2, 1], "the cursor's order: minus, slider, plus, Mute, Test");
  for (const b of Object.values(cfg.buttons)) for (const st of b.states) assert.equal(st.length, 1);
});

test("M20: the System and Sound pages built from the tables: knobs, choices, Display confirmation, names under faces, voice_bg in pieces, the arrival flash", () => {
  if (!soundTables?.config) return;
  const { El } = galleryPage();
  globalThis.document.getElementById = () => new El("div");
  const fx = [];
  const make = () => Object.assign(Object.create(UI.prototype), {
    items: [], fx, sel: 0, animate(f) { fx.push(f); }, sound() {}, showCaption() {},
    conf: { grid: [], cols: [], colOf: [], cur: { row: -1, col: 0 }, buttons: [], hold: null, page: 0 },
    confMem: { scroll: [0, 0, 0], cur: [null, null, null], tab: null },
    env: { settings: { textSpeed: 33, readSpeed: 15, autoPage: 3000, autoClick: 2200, skipRead: false, fastForward: "full", fadeUnread: true,
      fadeRead: true, voiceOn: true, voiceStop: true }, setSetting() {} },
    audio: { vol: { bgm: 0.4, se: 0.4, sys: 0.1, bgmMute: false, seMute: false, sysMute: false, chars: Array(19).fill(50), charOn: Array(19).fill(true) },
      setVolume() {}, setCharacter() {}, start() {}, playSeTest() {}, playTest() {} },
    vm: { system: soundTables, flow: { started: new Set([1, 485]) }, getVar: () => 7, scriptIndex: 5 },
  });
  const all = (el, out = []) => { for (const c of el.children) { out.push(c); all(c, out); } return out; };
  const at = (el) => { const m = /left:(-?[\d.]+)px;top:(-?[\d.]+)px/.exec(el.style.cssText || ""); return m ? [Number(m[1]), Number(m[2])] : null; };
  const bg = (el) => /background-position:(-?[\d.]+)px (-?[\d.]+)px/.exec(el.style.cssText)?.slice(1).map(Number);
  // System
  const sys = make(), box = new El("div");
  sys.buildConfigPage(box, "system", true);
  const btn = (ui, id) => ui.conf.buttons.find((b) => b.confId === id);
  assert.deepEqual(at(btn(sys, 71)), [871, 868], "Display confirmation at its place (hit box from (0, 0))");
  assert.deepEqual(at(btn(sys, 70)), [731, 928 + 4.821], "OFF's hit box starts 2 units down");
  const [offArt] = btn(sys, 70).children, [onArt] = btn(sys, 69).children;
  assert.deepEqual([at(offArt), bg(offArt)], [[-10, -14.821], [-502, -90]], "OFF is the choice: its on cell, no shift to the right");
  assert.deepEqual(bg(onArt), [10, -6], "ON: its normal cell");
  const k = btn(sys, 58), [knobArt, knobFlash] = k.children;
  assert.deepEqual(at(k), [362 + (33 / 250) * 508 + 432, 135 + 94.018], "the knob at its place + 33 / 250 of the track");
  assert.deepEqual(bg(knobArt), [0, -256], "normal: the white dot");
  k.setSelected(true);
  k.tick(1);
  assert.deepEqual(bg(knobArt), [0, 0], "lit: the cyan ring");
  assert.equal(knobFlash.style.opacity, "0.9", "the arrival flash, falling 0.1 a frame");
  k.tick(1);
  assert.equal(knobFlash.style.opacity, "0.8");
  assert.equal(sys.conf.scroll.max, 485);
  const ids = sys.conf.buttons.map((b) => b.confId);
  const layer = btn(sys, 55).parent;
  const bars = layer.children.filter((b) => b.confId === 1e6);
  assert.equal(bars.length, 4, "a bar under each of the four sliders, for a press anywhere along it");
  assert.deepEqual(layer.children.slice(0, 4), bars, "under the widgets");
  assert.deepEqual(layer.children.slice(4).map((b) => b.confId), [...ids].sort((a, b) => b - a), "higher ids under lower ones (0xaeec0)");
  // Sound, every character row listed
  const snd = make(), sbox = new El("div");
  snd.conf.page = 1;
  snd.buildConfigPage(sbox, "sound", true);
  assert.equal(snd.conf.scroll.max, 2205);
  const sprites = all(sbox).filter((e) => /background-image/.test(e.style.cssText || "") && !e.parent?.confId);
  const where = (name) => sprites.filter((e) => e.style.cssText.includes(`/${name}.webp`)).map(at);
  assert.deepEqual(where("voice_bg").slice(0, 3), [[386, 482], [386, 868], [386, 990]], "voice_bg's head, then a band a row");
  assert.deepEqual(where("voice_bg").at(-1), [386, 868 + 122 * 19], "and its foot after the last");
  assert.deepEqual(where("conf_faceicon")[0], [432, 880]);
  assert.deepEqual(where("conf_name")[0], [432, 952], "the name under the face");
  assert.deepEqual(where("conf_name")[1], [432, 1074]);
  assert.deepEqual([at(btn(snd, 97)), at(btn(snd, 98))], [[1429, 880], [1681, 883]], "Shiki's Mute and Test");
  assert.deepEqual(at(btn(snd, 95)), [735, 892]);
  assert.equal(btn(snd, 99).voiceKnob, true);
  assert.deepEqual(at(btn(snd, 85)), [1682, 310], "the SE Test");
  assert.deepEqual(snd.conf.cols.slice(0, 8), [4, 5, 4, 1, 1, 1, 1, 5]);
});

const { MenuCursor, MENU_COLUMN } = await import("../../web/app/js/uifx.js");

test("M21: the column's cursor fades out while a screen beside it has the focus, and its light swings at 1/120 after the first rise (0x4c370)", () => {
  const c = new MenuCursor();
  for (let i = 0; i < 60; i++) c.step(1);
  assert.ok(c.light > 0.99 && c.line === 1);
  let n = 0;
  while (!(c.dir > 0) || n === 0) { c.step(1); n++; if (n > 200) break; }   // down to half at -1/120 ...
  assert.ok(n > 55 && n < 65, String(n));
  assert.equal(c.light, 0.5);
  assert.equal(c.dir, 1 / 120, "... and up again at 1/120, not 1/60");
  c.step(1, true);   // a screen's control takes the focus
  assert.ok(Math.abs(c.line - 0.9) < 1e-9 && Math.abs(c.light - 0.4) < 1e-9 && c.dir === 1 / 60);
  for (let i = 0; i < 20; i++) c.step(1, true);
  assert.deepEqual([c.line, c.light], [0, 0]);
  c.step(1);   // the cursor back on the column: the line comes back, the light rises from nothing at 1/60
  assert.ok(Math.abs(c.line - 0.1) < 1e-9 && Math.abs(c.light - 1 / 60) < 1e-9);
});

test("M21: the column's buttons sit and draw as the system menu's table has them; choosing with a screen open gives it the cursor back or closes it first (0x4c370, 0x591438, 0x4d580, 0x4d340)", () => {
  assert.deepEqual([MENU_COLUMN.x, MENU_COLUMN.y, MENU_COLUMN.step, MENU_COLUMN.cell, MENU_COLUMN.cellX, MENU_COLUMN.cellY, MENU_COLUMN.cellStep],
    [80, 105, 75, [224, 88], [24, 264, 504], 24, 104]);
  const { El } = galleryPage();
  const fx = [], calls = [];
  const make = (active) => Object.assign(Object.create(UI.prototype), {
    items: [], fx, sel: 0, animate(f) { fx.push(f); }, sound() {}, showCaption() {}, vm: { replay: false, system: {} },
    savesScreen: (m) => calls.push(`saves ${m}`), config: () => calls.push("config"), flowchartFromMenu: () => calls.push("flowchart"),
    returnToTitle: () => calls.push("title"),
  });
  const run = (n) => { for (let i = 0; i < n; i++) for (const f of [...fx]) f(1); };
  const ui = make("Config"), col = new El("div");
  ui.screenFocus = () => calls.push("focus");
  ui.screenClose = (next) => { calls.push("close"); next(); };
  UI.prototype.column.call(ui, col, "Config");
  const btns = col.children.filter((e) => e.tag === "button");
  assert.equal(btns.length, 5);
  assert.deepEqual(btns.map((b) => /left:(\d+)px;top:(\d+)px/.exec(b.style.cssText).slice(1).map(Number)), [[80, 105], [80, 180], [80, 255], [80, 330], [80, 405]]);
  const cell = (b) => b.children[0].style.backgroundPosition;
  assert.equal(cell(btns[0]), "-24px -24px", "Save: its normal cell");
  assert.equal(cell(btns[2]), "-504px -232px", "Config is on: the screen open beside it");
  btns[1].setSelected(true);
  run(1);
  assert.equal(cell(btns[1]), "-264px -128px", "Load lit");
  assert.equal(btns[1].children[1].style.opacity, "0.9", "with the arrival flash");
  ui.items[2].fn();   // Config again: the config takes the cursor back, nothing reopens
  ui.items[0].fn();   // Save: the config closes first, then Save opens
  assert.deepEqual(calls, ["focus", "close", "saves save"]);
  // the menu alone: a choice acts at once (native frames: the next screen's fade starts two frames after the press), and the button
  // stays pressed for 10 frames on whichever page draws the column next
  const menu = make(null), col2 = new El("div");
  fx.length = 0; calls.length = 0;
  UI.prototype.column.call(menu, col2, null);
  menu.items[1].fn();
  assert.deepEqual(calls, ["saves load"]);
  assert.deepEqual(menu.menuPressed, { row: 1, left: 10 });
  run(9);
  assert.equal(menu.menuPressed.left, 1);
  run(1);
  assert.equal(menu.menuPressed, null);
});

test("M21: from the title the config has no system menu column or header, so nothing of the in-game menu can be chosen (0x8e200 runs 0x2b460 / 0x2c810 itself)", () => {
  if (!soundTables?.config) return;
  const { El, root } = galleryPage();
  globalThis.document.getElementById = () => new El("div");
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  const fx = [];
  const ui = Object.assign(Object.create(UI.prototype), {
    root, items: [], fx, sel: 0, animate(f) { fx.push(f); }, sound() {}, showCaption() {}, setBack() {}, stopFx() {}, closePanel() {},
    menuBackground() { return new El("div"); }, helpBar() {},
    env: { settings: { textSpeed: 33, readSpeed: 15, autoPage: 3000, autoClick: 2200 }, setSetting() {} },
    audio: { vol: { chars: [], charOn: [] } }, vm: { system: soundTables, flow: { started: new Set() }, getVar: () => 0, scriptIndex: 0, running: false },
    begin() { for (const c of [...root.children]) c.remove(); this.items = []; this.sel = 0; this.screenFocus = this.screenClose = null; const p = new El("div"); root.append(p); return p; },
  });
  UI.prototype.config.call(ui, "system", true);
  const all = (el, out = []) => { for (const c of el.children) { out.push(c); all(c, out); } return out; };
  const els = all(root);
  assert.equal(els.filter((e) => e.cls.has("menucol")).length, 0, "no column buttons");
  assert.equal(els.filter((e) => /system_titlebg|menu_window|underline/.test(e.style.cssText || "")).length, 0, "no header or column picture");
  assert.equal(ui.screenFocus, null);
  assert.equal(ui.items.filter((it) => it.el.getAttribute?.("aria-label") === "Config" || it.el.attrs?.["aria-label"] === "Config").length, 0);
  assert.ok(!ui.items.some((it) => it.el.cls.has("sel")), "nothing lit during the fade (0x2b770 places the cursor at its end)");
  for (let i = 0; i < 43; i++) for (const f of [...fx]) f(1);
  assert.equal(ui.sel, ui.conf.grid[0][0], "the first opening has row 0's first widget (0x2b010, 0x2b770)");
  delete globalThis.addEventListener;
  delete globalThis.removeEventListener;
});

const { SE_TEST } = await import("../../web/app/js/audio.js");

test("M3: the SE Test plays one of 0x46b138's 14 effects at random, stopping the one before (0x29140, 0xa8f90(0, 13))", async () => {
  const { audio, started } = sound();
  const urls = [];
  const buffer = audio.buffer;
  audio.buffer = async (url) => { urls.push(url); return buffer(url); };
  assert.equal(SE_TEST.length, 14);
  await audio.playSeTest(() => 0);
  await audio.playSeTest(() => 0.9999);
  await audio.playSeTest(() => 0.5);
  assert.deepEqual(urls, ["/assets/se/MOON_SE02009.ogg", "/assets/se/MOON_SE09005.ogg", "/assets/se/MOON_SE02058.ogg"]);
  assert.ok(started.at(-2).stopped, "the Test before stops");
});

const { NoticeFx, NOTICE } = await import("../../web/app/js/uifx.js");

test("M8: a notice comes in at 0.07 a frame, stays its frames, and closes on a press unless held (0x4abe0, 0x49750, 0x4abd0, 0x4acd0)", () => {
  const n = new NoticeFx();
  assert.equal(NOTICE.hold, 480);
  assert.equal(n.press(), false, "no press while it comes in");
  for (let i = 0; i < 15; i++) n.step(1);
  assert.equal(n.state, 2);
  assert.equal(n.press(), true);
  for (let i = 0; i < 15; i++) n.step(1);
  assert.equal(n.closed, true);
  // its frames run out by themselves
  const t = new NoticeFx(30);
  for (let i = 0; i < 15 + 30; i++) t.step(1);
  assert.equal(t.state, 3);
  // held: no press and no running out closes it; the caller's close does
  const h = new NoticeFx(10, true);
  for (let i = 0; i < 60; i++) h.step(1);
  assert.equal(h.press(), false);
  assert.equal(h.state, 2);
  h.close();
  for (let i = 0; i < 15; i++) h.step(1);
  assert.equal(h.closed, true);
});

test("M13: a read scene's skip counts down with the black cover's level each frame, then runs (0x40ed0 state 3: 0x3f110(1.5 + v / -30), 0x3b5b0(4))", async () => {
  globalThis.requestAnimationFrame = (f) => setTimeout(() => f(0), 0);
  const vm = machine();
  vm.flow = new FlowProgress(memoryStore());
  vm.flow.completed.add(29);
  vm.skipRead = true; vm.skipConfirm = false; vm.running = true;
  const seen = [];
  vm.onCountdown = (v) => seen.push([v, vm.instant]);
  vm.op_RDAS("29");
  for (let t = 0; t < 200 && !vm.instant; t++) await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(seen, [[3, false], [2, false], [1, false], [0, false]]);
  assert.equal(vm.instant, true);
  // the levels drawn: 1.4 ... 1.5, the screen black (min(level, 1)) until 12 frames after the run, then back over 25
  assert.deepEqual(seen.map(([v]) => Math.round((1.5 + v / -30) * 1000) / 1000), [1.4, 1.433, 1.467, 1.5]);
  vm.endInstant();
});

const { CONFIG, configMove, configStep, sliderValue, SampleFx, sampleTrail } = await import("../../web/app/js/uifx.js");

test("M5: config steps are 1, or 50 for maxima of 1000 and up; a held minus / plus repeats after 20 frames; the pointer sets whole values (0x2b930)", () => {
  assert.deepEqual([configStep(100), configStep(250), configStep(999), configStep(1000), configStep(10000)], [1, 1, 1, 50, 50]);
  assert.equal(CONFIG.hold, 20);
  // the track: (x / 3 - 276.67) / 169.33 of the maximum, cut to whole numbers and held in range
  assert.equal(sliderValue(830, 100), 0);
  assert.equal(sliderValue(1338, 100), 100);
  assert.equal(sliderValue(1084, 250), 125);
  assert.equal(sliderValue(1085, 100), 50, "50.2 is cut to 50");
  assert.equal(sliderValue(700, 100), 0);
  assert.equal(sliderValue(1500, 10000), 10000);
});

test("M5: the config's cursor moves on its page's grid; the tabs' row above; Left from the first widget or tab gives the column the cursor in the game (0x29bf0)", () => {
  const cols = [4, 4, 3, 3, 2, 1, 1];   // the System page's first rows (0x46cdb0: widgets 0x37-0x46)
  const m = (cur, dir, opts) => configMove(cols, cur, dir, opts);
  assert.deepEqual(m({ row: 0, col: 3 }, "down"), { row: 1, col: 3 });
  assert.deepEqual(m({ row: 1, col: 3 }, "down"), { row: 2, col: 2 }, "a shorter row: its last widget");
  assert.deepEqual(m({ row: 4, col: 1 }, "down"), { row: 5, col: 0 });
  assert.equal(m({ row: 6, col: 0 }, "down"), null, "the last row");
  assert.deepEqual(m({ row: 0, col: 2 }, "up", { tab: 1 }), { row: -1, col: 1 }, "up from row 0: the tabs, where they were");
  assert.deepEqual(m({ row: -1, col: 1 }, "down", { colOf: [2] }), { row: 0, col: 2 }, "down from the tabs: row 0 at its own column");
  assert.deepEqual(m({ row: 0, col: 1 }, "left"), { row: 0, col: 0 });
  assert.equal(m({ row: 0, col: 0 }, "left"), "column");
  assert.equal(m({ row: 0, col: 0 }, "left", { inGame: false }), null, "from the title nothing");
  assert.equal(m({ row: -1, col: 0 }, "left"), "column");
  assert.deepEqual(m({ row: -1, col: 2 }, "right"), { row: -1, col: 3 }, "the tabs' row ends at Default");
  assert.equal(m({ row: -1, col: 3 }, "right"), null);
  assert.equal(m({ row: 0, col: 3 }, "right"), null);
  // rows without widgets are passed over (the Sound page's characters not heard yet)
  assert.deepEqual(configMove([5, 0, 0, 5], { row: 3, col: 4 }, "up"), { row: 0, col: 4 });
});

test("M7: the System page's samples restart once the click wait has passed from ten whole letters (0x2d570, 0x3b2d0, 0x3b330)", () => {
  near(sampleTrail(35), (1000 / 60 / 35) * (3.5 / 35) * 60, "35 ms");
  assert.equal(sampleTrail(0), 0);
  near(sampleTrail(250), (1000 / 60 / 250) * 0.5 * 60, "the trail's share stops at a half");
  const fx = new SampleFx();
  let f = 0;
  while (fx.hi < 10) { fx.step(1, 35, 1000); f++; }
  // the front moves 0.476 letters a frame and the trail lags 2.86 letters: ten whole letters at frame 27, which counts
  // as the wait's first frame
  assert.equal(f, 27);
  for (let i = 0; i < 59; i++) fx.step(1, 35, 1000);
  assert.ok(fx.lo > 0, "60 frames counted: the 1000 ms wait is not over (0x2d570 restarts once it is exceeded)");
  fx.step(1, 35, 1000);
  assert.deepEqual([fx.lo, fx.hi], [0, 0], "the 61st: started again");
  // at speed 0 the text is whole at once and the wait counts from the start
  const z = new SampleFx();
  z.step(1, 0, 1000);
  assert.deepEqual([z.lo, z.wait], [768, 1]);
});

const { BACKLOG, backlogPages, backlogStep } = await import("../../web/app/js/uifx.js");
const { TextBox } = await import("../../web/app/js/textbox.js");

test("M2: the backlog's pages: the page on screen and the oldest choice rows left out, a page ended by each F799 (0x27eb0, 0x28950)", () => {
  const rec = (name, pageEnd, kind = "msg") => ({ name, pageEnd, kind });
  // oldest first: page A, page B, a choice's rows (the last a page end), then the page on screen
  const records = [rec("a1", 0), rec("a2", 1), rec("b1", 0), rec("b2", 1), rec("c1", 0, "choice"), rec("c2", 1, "choice"), rec("d1", 0), rec("d2", 1)];
  const names = (pages) => pages.map((p) => p.map((r) => r.name).join(" "));
  assert.deepEqual(names(backlogPages(records)), ["c1 c2", "b1 b2", "a1 a2"], "newest page first, each oldest first");
  assert.deepEqual(names(backlogPages(records, true)), ["c1 c2", "b1 b2"], "a log that let records go leaves out its oldest page");
  // the newest record is never listed, even when it ends its page; a page end at the oldest record makes a page of one
  assert.deepEqual(names(backlogPages([rec("x", 1), rec("y", 0), rec("z", 1), rec("w", 1)])), ["y z", "x"]);
  // nothing before the page on screen, a single record, or no page end at all: an empty backlog
  assert.deepEqual(backlogPages([rec("d1", 0), rec("d2", 1)]), []);
  assert.deepEqual(backlogPages([rec("a", 1)]), []);
  assert.deepEqual(backlogPages([rec("a", 0), rec("b", 0), rec("c", 0)]), []);
  // the oldest choice rows go before the pages are cut: here only they would have been older than "b"
  assert.deepEqual(names(backlogPages([rec("c1", 0, "choice"), rec("c2", 1, "choice"), rec("a", 1), rec("b", 1)])), ["a"]);
  assert.deepEqual([BACKLOG.rate, BACKLOG.veil, BACKLOG.tapX], [0.05, 0.75, 543]);
});

test("M2: the backlog's keys: Up an older page and Down a newer one, wrapping on a fresh press; Left / Right the ends (0x28a90)", () => {
  assert.equal(backlogStep(0, 3, "up"), 1);
  assert.equal(backlogStep(3, 3, "up", false), 3, "a held Up stops at the oldest");
  assert.equal(backlogStep(3, 3, "up", true), 0, "a fresh Up wraps to the newest");
  assert.equal(backlogStep(0, 3, "down", false), 0);
  assert.equal(backlogStep(0, 3, "down", true), 3);
  assert.equal(backlogStep(2, 3, "down", false), 1);
  assert.equal(backlogStep(1, 3, "left"), 3);
  assert.equal(backlogStep(2, 3, "right"), 0);
  assert.equal(backlogStep(2, 3, "right", false), 2, "Left / Right act on fresh presses only");
  assert.equal(backlogStep(0, 0, "up", true), 0, "one page: nothing moves");
});

test("M2: a record per MSG with its page end and blank rows; MSAD joins the newest record; a choice's rows; rewinding takes parts back (0x6e0d0, 0x6e950, 0x7f74c)", () => {
  const t = new TextBox();
  t.log("First line.", "V1", { pageEnd: false, skips: [0, 1] });
  t.log(" And more.", null, { inline: true, pageEnd: true });   // MSAD: no record of its own, the MSG's page end stays
  assert.equal(t.history.length, 1);
  assert.equal(t.history[0].text, "First line. And more.");
  assert.equal(t.history[0].pageEnd, false);
  assert.deepEqual(t.history[0].parts.map((p) => p.seq), [1, 2]);
  t.log("Second.", null, { pageEnd: true, glue: true, color: 2 });
  t.logChoice(["1.Yes", "2.No"]);
  assert.deepEqual(t.history.map((r) => [r.kind, r.seq, r.pageEnd]), [["msg", 1, false], ["msg", 3, true], ["choice", 4, false], ["choice", 4, true]]);
  t.unlog(3);
  assert.equal(t.history.length, 2, "the choice's rows go with a rewind to before them");
  t.unlog(1);
  assert.deepEqual([t.history.length, t.history[0].text, t.history[0].parts.length], [1, "First line.", 1]);
  // 800 records, then the oldest go and the log says so
  const u = new TextBox();
  for (let i = 0; i < 801; i++) u.log(`L${i}`);
  assert.deepEqual([u.history.length, u.history[0].text, u.dropped], [800, "L1", true]);
});

test("M2: Quick Jump goes to the page's first line, or for a choice's rows to the choice itself (0x28d50 restores SELR's type 0xd record)", () => {
  const vm = machine();
  vm.trail = [{ logged: 1, choice: false }, { logged: 3, choice: false }, { logged: 3, choice: true }, { logged: 5, choice: false }];
  vm.waitResolve = () => {};   // at a wait: the last point is where the player is
  assert.equal(vm.jumpTarget(2), 1, "the wait after the line");
  assert.equal(vm.jumpTarget(4, true), 2, "rows logged as 4: the choice point kept at 3");
  assert.equal(vm.jumpTarget(5), -1, "the page on screen");
  assert.equal(vm.canJump(9, true), false);
});

// ---- section 4: the gallery (G1-G11, G13) ---------------------------------------------------------------------------
const gal = await import("../../web/app/js/gallery.js");
const { EASE } = await import("../../web/app/js/uifx.js");
const { Unlocks, cgUnlocked, cgLists, CG_GATES, COMPLETION_SCENE } = await import("../../web/app/js/unlocks.js");
const galleryAsset = existsSync(asset("gallery.json")) ? readAsset("gallery.json") : null;
const pic = (image, cell, bits, flag = 0) => ({ image, cell, x: 0, y: 0, w: 2880, h: 1620, flag, bits });
const tinyGallery = () => ({
  cg: [
    { gate: 0, variants: [pic("IMG0001", 0, [1]), pic("IMG0002", 1, [2])] },
    { gate: 1, variants: [pic("IMG0003", 2, [3])] },   // waits for scene 2
    { gate: 0, variants: [pic("IMG0004", 3, [4], 1)] },   // drawn mirrored
    { gate: 0, variants: [pic("IMG0005", 4, [])] },   // only once QA_25 is complete
  ],
  seen: { IMG0001: 1, IMG0002: 2, IMG0003: 3, IMG0004: 4, SPRITE_A_01: 4 },
  music: [
    { title: "One", credits: { composer: "A" }, music: 1, stream: "M1", also: [], ms: 120000, loopStart: 48000, loopEnd: 48000 * 100 },
    { title: "Two", credits: { singer: "S", lyrics: "L", composer: "C", arrangement: "R" }, music: 2, stream: "M2", also: [], ms: 0, loopStart: 0, loopEnd: 48000 * 200 },
    { title: "Three", credits: { composer: "B" }, music: 3, stream: "M3", also: [], ms: 90000, loopStart: 0, loopEnd: 48000 * 80 },
  ],
  musicText: { locked: "？？？", labels: ["Singer:", "Lyrics:", "Composer:", "Arrangement:"] },
  movies: ["op1_arc", "op2_ciel", "prologue"],
  movieList: [{ name: "prologue", number: 4, row: 2, bit: null }, { name: "op1_arc", number: 5, row: 0, bit: 0 }, { name: "op2_ciel", number: 6, row: 1, bit: 1 }],
  endings: null,
});
const ctxOf = (unlocks, started = [], completed = []) => ({ unlocks, flow: { started: new Set(started), completed: new Set(completed) } });
function unlocksWith(data, seen = []) {
  const u = new Unlocks(memoryStore());
  u.install(data);
  for (const b of seen) u.seen.add(b);
  return u;
}

// A small stand-in for the page the gallery builds: enough of the DOM for openGallery and its sections.
function galleryPage() {
  const images = [];
  const ctx2d = { fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, drawImage() {}, putImageData() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), createImageData: () => ({ data: new Uint8ClampedArray(4) }) };
  class El {
    constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.style = {}; this.dataset = {}; this.attrs = {}; this.on = {}; this.cls = new Set(); this.text = ""; }
    set className(c) { this.cls = new Set(String(c).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.cls].join(" "); }
    get classList() { const s = this.cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, on = !s.has(c)) => { if (on) s.add(c); else s.delete(c); return on; }, contains: (c) => s.has(c) }; }
    append(...cs) { for (const c of cs) { if (typeof c === "string") { this.text += c; continue; } c.remove(); c.parent = this; this.children.push(c); } }
    appendChild(c) { this.append(c); return c; }
    remove() { if (this.parent) { const p = this.parent.children; p.splice(p.indexOf(this), 1); this.parent = null; } }
    get isConnected() { let e = this; while (e.parent) e = e.parent; return e === root; }
    set textContent(t) { for (const c of [...this.children]) c.remove(); this.text = String(t); }
    get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
    set innerHTML(t) { this.textContent = t; }
    addEventListener(t, f) { (this.on[t] ||= []).push(f); }
    removeEventListener(t, f) { this.on[t] = (this.on[t] || []).filter((g) => g !== f); }
    fire(t, e = {}) { for (const f of this.on[t] || []) f({ stopPropagation() {}, preventDefault() {}, ...e }); }
    setAttribute(k, v) { this.attrs[k] = v; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1920, height: 1080 }; }
    getContext() { return ctx2d; }
    get offsetHeight() { return 34; }
    findAll(fn, out = []) { for (const c of this.children) { if (fn(c)) out.push(c); c.findAll(fn, out); } return out; }
  }
  const root = new El("div");
  globalThis.document = { createElement: (t) => new El(t), getElementById: () => null };
  globalThis.Image = class { constructor() { this.complete = false; images.push(this); } };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.getComputedStyle = () => ({ backgroundColor: "#000" });
  globalThis.requestAnimationFrame = () => 0;
  const fx = [], sounds = [];
  const ui = {
    root, keyFn: null, backFn: null, sounds, dialogs: [],
    begin() { for (const c of [...root.children]) c.remove(); const p = new El("div"); root.append(p); return p; },
    menuBackground() {}, animate(fn) { fx.push(fn); }, sound(n) { sounds.push(n); }, setBack() {}, ghost() {},
    helpScreens: [], helpBar(parent, labels, screen) { this.helpScreens.push(screen); parent.append(new El("div")); }, notify() {}, dialog(q) { this.dialogs.push(q); }, title() { this.titled = true; },
    frames(n) { for (let i = 0; i < n; i++) for (const f of [...fx]) f(1); },
    key(k, extra = {}) { return this.keyFn({ key: k, repeat: false, type: "keydown", ...extra }); },
  };
  const find = (fn) => root.findAll(fn);
  return { ui, El, root, images, find };
}
function galleryVm(data, { started = [], completed = [], seen = [], music = [], g005 = 0 } = {}) {
  const { audio } = sound();
  const unlocks = unlocksWith(data, seen);
  for (const n of music) unlocks.music.add(n);
  return { gallery: data, unlocks, flow: { started: new Set(started), completed: new Set(completed) }, audio, getVar: (k) => (k === "G005" ? g005 : 0), system: {}, gfx: {} };
}
function galleryEnv(vm, extra = {}) {
  const env = { titleMusicCalls: 0, movies: [], toast() {}, titleVideo() {}, flowchart() {}, endMovie() {}, playEpisode() {}, ...extra };
  env.titleMusic = () => { env.titleMusicCalls++; vm.audio.playBGM(2, {}); };
  env.playMovie = (name, opts) => new Promise((res) => env.movies.push({ name, opts, res }));
  return env;
}

test("G1: the CG alias table (0x4525c8, 0x51e0) and the seen bits (0x77610): pictures seen through their source", () => {
  // the rule on a small table: a sprite shown sets the bit its alias row reads
  const data = tinyGallery();
  const u = unlocksWith(data);
  assert.equal(cgUnlocked(data.cg[2], data.cg[2].variants[0], ctxOf(u)), false);
  u.image("sprite_a_01.mzp");   // the name as a script gives it: upper-cased up to its '.'
  assert.ok(u.seen.has(4));
  assert.equal(cgUnlocked(data.cg[2], data.cg[2].variants[0], ctxOf(u)), true);
  u.image("NOT_A_GALLERY_PICTURE");
  assert.equal(u.seen.size, 1, "names with no bit the gallery reads are not kept");
  // names recorded before seen bits stand for their bits
  const store = memoryStore();
  store.setItem("tsuki.unlocks.v1", JSON.stringify({ images: ["IMG0001"] }));
  const old = new Unlocks(store);
  old.install(data);
  assert.ok(old.seen.has(1));
  clearTimeout(old.timer);
  if (!galleryAsset) return;
  // the exported table: 105 alias rows, 97 pictures reachable only through them
  const all = galleryAsset.cg.flatMap((e, index) => e.variants.map((v) => ({ e, v, index })));
  const byImage = Object.fromEntries(all.map((p) => [p.v.image, p]));
  const seen = galleryAsset.seen;
  assert.equal(all.filter((p) => p.v.bits.length && seen[p.v.image] !== p.v.bits[0]).length, 97);
  assert.equal(all.filter((p) => p.v.bits.length).length, 954 + 97);
  assert.deepEqual(byImage.IMG3954.v.bits, [seen.SIE_A_63_00_N00]);   // IMG3954 -> SIE_A_63_00_N00
  assert.deepEqual(byImage.IMG3690.v.bits, [seen.IMG1286]);           // an IMG alternate decides alone
  assert.equal(byImage.IMG3757.v.bits.length, 2);                     // AOK_A_30_00_N00 or BOY_A_30_00_N00
  assert.equal(seen.IMG0003_04_04, seen.IMG0003, "a +0x43 expression record stands for its picture");
  const real = unlocksWith(galleryAsset);
  real.image("SIE_A_63_00_N00");
  const e = byImage.IMG3954;
  assert.equal(cgUnlocked(e.e, e.v, ctxOf(real)), true);
});

test("G2: CG entry gates (0xb58c): 188 entries wait for their route day's scene", () => {
  assert.deepEqual(CG_GATES[1], [2]);
  assert.deepEqual(CG_GATES[5], [383]);
  assert.deepEqual(CG_GATES[15], [275, 276]);
  assert.deepEqual(CG_GATES[19], [309]);
  assert.equal(Object.keys(CG_GATES).length, 19);
  const data = tinyGallery();
  const u = unlocksWith(data, [3]);
  assert.equal(cgUnlocked(data.cg[1], data.cg[1].variants[0], ctxOf(u)), false, "seen, but scene 2 has not started");
  assert.equal(cgUnlocked(data.cg[1], data.cg[1].variants[0], ctxOf(u, [2])), true);
  const either = { gate: 15 };
  assert.equal(cgUnlocked(either, pic("X", 0, [3]), ctxOf(u, [276])), true);
  if (!galleryAsset) return;
  assert.equal(galleryAsset.cg.filter((e) => e.gate).length, 188);
  const gateOf = (image) => galleryAsset.cg.find((e) => e.variants.some((v) => v.image === image)).gate;
  assert.deepEqual(CG_GATES[gateOf("IMG1779")], [2]);    // shown on day 1, listed from day 2
  assert.deepEqual(CG_GATES[gateOf("IMG1873")], [11]);   // a Ciel route picture listed with Arcueid's day 11
  assert.deepEqual(CG_GATES[gateOf("IMG2083")], [297]);
});

test("G3: completing QA_25 (RDED 557) lists every picture past its gate (0x4470 -> 0x922c0(0x22d))", () => {
  assert.equal(COMPLETION_SCENE, 557);
  const data = tinyGallery();
  const u = unlocksWith(data);
  const never = data.cg[3].variants[0];
  assert.equal(cgUnlocked(data.cg[3], never, ctxOf(u)), false);
  assert.equal(cgUnlocked(data.cg[3], never, ctxOf(u, [], [557])), true);
  assert.equal(cgUnlocked(data.cg[1], data.cg[1].variants[0], ctxOf(u, [], [557])), false, "the gate still holds");
  assert.equal(cgLists(data.cg, ctxOf(u, [2], [557])).flat.length, 5);
});

test("G4: an entry with two or more pictures opens its sub-grid; the viewer closes onto its last picture's grid (0x8d08, 0x9384)", () => {
  const data = tinyGallery();
  const lists = cgLists(data.cg, ctxOf(unlocksWith(data, [1, 2, 4])));
  assert.deepEqual(lists.entries.map((e) => [e.index, e.pictures.length]), [[0, 2], [2, 1]]);
  assert.deepEqual(lists.flat.map((p) => p.variant.image), ["IMG0001", "IMG0002", "IMG0004"]);
  const [a, b, d] = lists.flat;
  assert.deepEqual(gal.viewerReturn(lists, { kind: "sub", entry: 0 }, b), { kind: "sub", entry: 0, sel: 1 });
  assert.deepEqual(gal.viewerReturn(lists, { kind: "main", entry: 1 }, d), { kind: "main", entry: 1, sel: 1 });
  assert.deepEqual(gal.viewerReturn(lists, { kind: "main", entry: 1 }, a), { kind: "sub", entry: 0, sel: 0 }, "another entry with two pictures: its sub-grid");
  assert.deepEqual(gal.viewerReturn(lists, { kind: "sub", entry: 0 }, d), { kind: "main", entry: 1, sel: 1 });
  // on the page: Enter on the first entry shows its two pictures; Back returns to the entries
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  const thumbs = () => find((e) => e.cls.has("gl-thumb"));
  ui.key("ArrowRight");   // into the grid
  assert.equal(thumbs().length, 2);
  ui.key("Enter");
  ui.frames(31);   // the main grid's crossfade out
  assert.deepEqual(thumbs().map((t) => t.style.backgroundPosition), ["0px 0px", "-231px 0px"]);
  ui.key("Escape");
  ui.frames(31);
  assert.equal(thumbs().length, 2, "back in the main grid");
  assert.equal(ui.sounds.at(-1), 2);
});

test("G5: the viewer's Left / Right go through every unlocked picture, round and round (0xc56c)", () => {
  assert.equal(gal.viewerStep(3, 2, 1), 0);
  assert.equal(gal.viewerStep(3, 0, -1), 2);
  assert.equal(gal.viewerStep(1, 0, 1), 0, "one picture: no change");
  const data = tinyGallery();
  const { ui, find, images } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  ui.key("ArrowRight"); ui.key("ArrowRight");   // into the grid, then the second entry (one picture)
  ui.key("Enter");
  const img = find((e) => e.tag === "img")[0];
  assert.equal(img.src, "/assets/img/IMG0004.avif");
  ui.frames(31);   // the viewer's fade in; keys wait for it
  for (const r of images.slice(-2)) r.complete = true;   // rule_26 / rule_27
  ui.key("ArrowRight");
  assert.equal(img.src, "/assets/img/IMG0001.avif", "on past the last picture to the first, another entry's");
  assert.equal(ui.sounds.at(-1), 0);
});

test("G6: the viewer fades in and out over half a second; its help band comes in, holds 2 s and goes (0xc498, 0xce60, 0x604c)", () => {
  const g = new gal.GuideFx();
  g.show();
  g.step(15);
  near(g.alpha, 0.25);   // quadratic in
  near(g.offset, 0.75 * 25 * 1080 / 448);
  g.step(15);
  assert.equal(g.phase, "hold");
  g.step(119);
  assert.equal(g.phase, "hold");
  g.step(1);
  assert.equal(g.phase, "out", "after 2 s");
  g.step(15);
  near(g.alpha, 0.25);   // 1 - (1 - (1 - 0.5)^2)
  g.show();               // shown again from where it is (each picture change)
  near(g.alpha, 0.0625);  // the new tween is advanced by alpha x 0.5 s: quadratic in at 0.25
  // on the page: the viewer's box opacity follows 0 -> 1 (quadratic in), and 1 -> 0 (quadratic out) as it closes
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  ui.key("ArrowRight"); ui.key("Enter");
  const box = find((e) => e.cls.has("gl-viewer"))[0];
  ui.frames(15);
  near(Number(box.style.opacity), 0.25);
  ui.frames(16);
  ui.key("Escape");
  ui.frames(15);
  near(Number(box.style.opacity), 0.25);
  ui.frames(16);
  assert.equal(box.isConnected, false);
});

test("G7: variant flag 1 is a horizontal mirror; the zoom stays for a picture of the same entry and size (0xbe84, 0x254bc)", () => {
  const same = { index: 0, variant: { w: 10, h: 20 } };
  assert.equal(gal.viewerKeeps(same, { index: 0, variant: { w: 10, h: 20 } }), true);
  assert.equal(gal.viewerKeeps(same, { index: 0, variant: { w: 10, h: 21 } }), false);
  assert.equal(gal.viewerKeeps(same, { index: 1, variant: { w: 10, h: 20 } }), false);
  if (galleryAsset) {
    const flagged = galleryAsset.cg.flatMap((e) => e.variants).filter((v) => v.flag).map((v) => v.image).sort();
    assert.deepEqual(flagged, ["IMG0850", "IMG0851", "IMG0852", "IMG0853", "IMG0854", "IMG1740"]);
  }
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  assert.equal(find((e) => e.cls.has("gl-thumb"))[0].style.transform, "scaleX(-1)", "its thumbnail too (0xaf78)");
  ui.key("ArrowRight"); ui.key("Enter");
  const img = find((e) => e.tag === "img")[0];
  Object.assign(img, { naturalWidth: 1920, naturalHeight: 1080 });
  img.onload();
  assert.match(find((e) => e.cls.has("gl-crop"))[0].style.transform, /scaleX\(-1\)$/);
});

test("G8: the Music Player's keys, 0.01 volume, row choice, Play from the start, fade and stop at the end, labels (0x1a7fc, 0x1c9fc, 0x1cc68, 0x1d314, 0x1dab8)", async () => {
  // the list: wrap only on a fresh press
  assert.deepEqual(gal.musicListKey(0, "ArrowUp", true, 95), { sel: 94 });
  assert.equal(gal.musicListKey(0, "ArrowUp", false, 95), null);
  assert.deepEqual(gal.musicListKey(94, "ArrowDown", true, 95), { sel: 0 });
  assert.deepEqual(gal.musicListKey(5, "ArrowLeft", true, 95), { column: true });
  assert.deepEqual(gal.musicListKey(5, "ArrowRight", true, 95), { panel: true });
  // the panel: play pause stop repeat / prev next
  assert.deepEqual(gal.musicPanelKey(0, "ArrowLeft"), { list: true });
  assert.deepEqual(gal.musicPanelKey(4, "ArrowLeft"), { list: true });
  assert.deepEqual(gal.musicPanelKey(2, "ArrowLeft"), { btn: 1 });
  assert.equal(gal.musicPanelKey(3, "ArrowRight"), null);
  assert.deepEqual(gal.musicPanelKey(1, "ArrowDown"), { btn: 4 });
  assert.deepEqual(gal.musicPanelKey(3, "ArrowDown"), { btn: 5 });
  assert.deepEqual(gal.musicPanelKey(5, "ArrowDown"), { volume: true });
  assert.deepEqual(gal.musicPanelKey(5, "ArrowUp"), { btn: 2 });
  // the volume: 0.01 a step in single precision, within 0 and 1; shown cut to a whole number
  let v = 0.6;
  for (let i = 0; i < 7; i++) v = gal.musicVolumeStep(v, -1);
  assert.equal(gal.musicVolumeShown(v), 53);
  assert.equal(gal.musicVolumeStep(0.005, -1), 0);
  assert.equal(gal.musicVolumeStep(0.995, 1), 1);
  // the text: labelled credits, the block placed by its number of lines
  const data = tinyGallery();
  assert.deepEqual(gal.musicCredits(data.music[1], data.musicText.labels), { lines: ["Singer: S", "Lyrics: L", "Composer: C", "Arrangement: R"], top: 180 });
  assert.equal(gal.musicCredits(data.music[0], data.musicText.labels).top, 212);
  // the end: a fade from the loop end (1.5 s before it when the row's length is 0), then nothing next
  assert.equal(gal.musicFadeAt(data.music[0]), 100000);
  assert.equal(gal.musicFadeAt(data.music[1]), 200000 - 1500);
  const { audio, ctx } = sound();
  const jb = new gal.Jukebox(audio);
  gal.session.volume = 0.6; gal.session.repeat = false;
  await jb.play(data.music[0]);
  const first = ctx.sources.at(-1);
  assert.deepEqual([first.started.offset, first.loop], [0, false]);
  ctx.currentTime = 100.02;
  jb.update();
  const g = jb.gain.gain, at = (t) => g.at(t);
  near(at(100.02), audio.playerGain(0.6) * audio.streamShare);
  near(at(100.02 + 0.75), audio.playerGain(0.3) * audio.streamShare);
  ctx.currentTime = 101.53;
  jb.update();
  assert.equal(jb.state, "stopped");
  assert.ok(first.stopped);
  assert.equal(ctx.sources.length, 1, "no next track");
  // Play starts the row again from its beginning, whatever plays; repeat loops between its points
  await jb.play(data.music[2]);
  ctx.currentTime = 110;
  await jb.play(data.music[2]);
  assert.ok(ctx.sources.at(-2).stopped);
  assert.equal(ctx.sources.at(-1).started.offset, 0);
  jb.setRepeat(true);
  assert.equal(ctx.sources.at(-1).loop, true);
  jb.stop();
  // volume and repeat are the running game's only
  jb.setVolume(0.25);
  assert.equal(JSON.parse(localStorage.getItem("tsuki.gallery") || "{}").volume, undefined);
  gal.session.volume = 0.6; gal.session.repeat = false;
  // on the page: a locked row reads SYSMES 244; Enter on the playing row stops it
  const page = galleryPage();
  const vm = galleryVm(data, { music: [1, 3] });
  gal.openGallery(page.ui, vm, galleryEnv(vm), "music");
  page.ui.frames(31);
  const rows = page.find((e) => e.cls.has("gl-track"));
  assert.equal(rows[1].text, "？？？");
  page.ui.key("ArrowRight");
  page.ui.key("Enter");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(vm.audio.ctx.sources.at(-1).started.offset, 0);
  page.ui.key("Enter");
  assert.ok(vm.audio.ctx.sources.at(-1).stopped, "the row playing, chosen again, stops");
  assert.equal(page.ui.sounds.filter((s) => s === 1).length, 0, "choosing a row plays no menu sound");
});

test("G9: the title's music plays on in the gallery; the Music Player cuts it and restarts it as it closes for another section (0x19838, 0x8400, 0x7624)", async () => {
  const data = tinyGallery();
  const { ui } = galleryPage();
  const vm = galleryVm(data, { music: [1] });
  const env = galleryEnv(vm);
  vm.audio.playBGM(2, {});   // the title's
  gal.openGallery(ui, vm, env, "cg");
  assert.equal(env.titleMusicCalls, 1);
  assert.equal(vm.audio.bgmState.n, 2, "still playing");
  ui.frames(31);
  ui.key("ArrowDown"); ui.key("Enter");   // Music Player
  ui.frames(31);
  assert.equal(vm.audio.bgmState, null, "cut as the Music Player opens");
  ui.key("Enter");   // play row 0
  await new Promise((r) => setTimeout(r, 0));
  const track = vm.audio.ctx.sources.at(-1);
  ui.key("Escape");   // to the column
  ui.key("ArrowUp"); ui.key("Enter");   // CG Gallery
  ui.frames(30);
  assert.equal(track.stopped, false, "plays while the section fades out");
  ui.frames(1);
  assert.ok(track.stopped);
  assert.equal(env.titleMusicCalls, 2);
  assert.equal(vm.audio.bgmState.n, 2);
  // leaving for the title from the Music Player: its track stops, the gallery does not start the title's music
  const p2 = galleryPage();
  const vm2 = galleryVm(data, { music: [1] });
  const env2 = galleryEnv(vm2);
  gal.openGallery(p2.ui, vm2, env2, "music");
  assert.equal(env2.titleMusicCalls, 0);
  p2.ui.frames(31);
  p2.ui.key("Escape");
  p2.ui.frames(31);
  assert.ok(p2.ui.titled);
  assert.equal(env2.titleMusicCalls, 0);
});

test("G10: the movie gallery lists the prologue, op1_arc, op2_ciel; plays at once; covers, music faded, music 2 at 360 s, music back (0x17dd0, 0x183ec, 0x18d60-0x19280)", async () => {
  const data = tinyGallery();
  const listed = (g005) => {
    const { ui, find } = galleryPage();
    const vm = galleryVm(data, { g005 });
    gal.openGallery(ui, vm, galleryEnv(vm), "movie");
    return find((e) => e.cls.has("gl-movie")).map((b) => b.attrs["aria-label"]);
  };
  assert.deepEqual(listed(0), ["prologue"]);
  assert.deepEqual(listed(2), ["prologue", "op2_ciel"]);
  assert.deepEqual(listed(3), ["prologue", "op1_arc", "op2_ciel"]);
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { g005: 1 });
  const env = galleryEnv(vm);
  vm.audio.playBGM(2, {});
  await new Promise((r) => setTimeout(r, 0));   // the title's music, playing
  gal.openGallery(ui, vm, env, "movie");
  ui.frames(31);
  ui.key("ArrowRight"); ui.key("ArrowRight");   // into the list, then op1_arc
  ui.key("Enter");
  assert.equal(ui.dialogs.length, 0, "no question first (state 3 is never entered)");
  assert.equal(ui.sounds.at(-1), 1);
  const cover = find((e) => e.cls.has("gl-movie-cover"))[0];
  assert.equal(cover.style.background, "#fff");
  assert.equal(vm.audio.bgmState, null, "the music fades");
  ui.frames(15);
  near(Number(cover.style.opacity), 0.75);   // 0 -> 1, quadratic out
  ui.frames(16);
  assert.deepEqual(env.movies.map((m) => [m.name, m.opts.number, m.opts.music]), [["op1_arc", 5, null]]);
  env.movies[0].res();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(cover.style.background, "#000");
  ui.frames(31);
  assert.equal(cover.isConnected, false);
  assert.equal(vm.audio.bgmState.n, 2, "the music kept starts again");
  await new Promise((r) => setTimeout(r, 0));
  // the prologue's music cue
  ui.key("ArrowLeft"); ui.key("Enter");
  ui.frames(31);
  assert.deepEqual(env.movies[1].opts.music, { at: 360, n: 2 });
});

test("G11: a section goes out before the next comes in; thumbnails cascade in; the grid scrolls over 1/6 s (0x7328, 0xb318, 0xa968)", () => {
  // the scroll targets of 0xa968 (10 rows)
  assert.equal(gal.cgScrollTarget(5, 4, 0, 10), null);
  assert.equal(gal.cgScrollTarget(6, 5, 0, 10), 139);
  assert.equal(gal.cgScrollTarget(9, 8, 139, 10), 4 * 139 - 69.5);
  assert.equal(gal.cgScrollMax(10), 4 * 139 - 69.5);
  assert.equal(gal.cgScrollTarget(2, 3, 486.5, 10), 139 + 69.5);
  assert.equal(gal.cgScrollTarget(0, 1, 139, 10), 0);
  // the cascade: (column + row) / 50 s for the 42 cells from the first row shown
  assert.equal(gal.cgCascadeDelay(0, 0), 0);
  near(gal.cgCascadeDelay(13, 0), (1 + 2) * 0.02);
  near(gal.cgCascadeDelay(13, 139), (1 + 1) * 0.02);
  assert.equal(gal.cgCascadeDelay(48, 0), 0);
  // on the page: the open section fades 1 -> 0 (quadratic out), then the next is built and fades 0 -> 1 (quadratic in)
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4], music: [1] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  const content = find((e) => e.cls.has("gl-content"))[0];
  ui.frames(15);
  const thumb = find((e) => e.cls.has("gl-thumb"))[1];   // column 1: 0.02 s late
  near(Number(thumb.style.opacity), EASE.quad.in((0.25 - 0.02) / 0.5));
  ui.frames(16);
  ui.key("ArrowDown"); ui.key("Enter");
  ui.frames(15);
  near(Number(content.style.opacity), 0.25);
  assert.ok(find((e) => e.cls.has("gl-thumb")).length > 0, "the grid is still there");
  ui.frames(16);
  assert.equal(find((e) => e.cls.has("gl-thumb")).length, 0);
  ui.frames(15);
  near(Number(content.style.opacity), 0.25);
});

test("G13: grid and list keys: the CG grid, the ending list and the movie list (0x9cbc, 0xe7a4, 0x183ec)", () => {
  // CG grid: Left on column 0 to the gallery's column, no wrap at the right, Down only onto a cell
  assert.deepEqual(gal.cgGridKey(14, 6, "ArrowLeft"), { column: true });
  assert.equal(gal.cgGridKey(14, 5, "ArrowRight"), null);
  assert.equal(gal.cgGridKey(14, 13, "ArrowRight"), null);
  assert.deepEqual(gal.cgGridKey(14, 7, "ArrowDown"), { sel: 13 });
  assert.equal(gal.cgGridKey(14, 9, "ArrowDown"), null, "nothing below in the last row");
  assert.equal(gal.cgGridKey(14, 2, "ArrowUp"), null);
  // movies: Left from the first to the column, Right stops
  assert.deepEqual(gal.movieListKey(3, 0, "ArrowLeft"), { column: true });
  assert.equal(gal.movieListKey(3, 2, "ArrowRight"), null);
  assert.equal(gal.movieListKey(3, 1, "ArrowUp"), null);
  // the ending list: seen places only, Left past the first to the column, Up / Down to the nearest of the next row
  const seenSet = new Set(["0,0", "0,2", "1,1", "1,6", "2,3", "3,4"]);
  const seen = (r, c) => seenSet.has(`${r},${c}`);
  assert.deepEqual(gal.endingKey(seen, false, { row: 0, col: 2 }, "ArrowLeft"), { row: 0, col: 0 });
  assert.deepEqual(gal.endingKey(seen, false, { row: 0, col: 0 }, "ArrowLeft"), { column: true });
  assert.deepEqual(gal.endingKey(seen, false, { row: 1, col: 1 }, "ArrowRight"), { row: 1, col: 6 });
  assert.equal(gal.endingKey(seen, false, { row: 1, col: 6 }, "ArrowRight"), null);
  assert.deepEqual(gal.endingKey(seen, false, { row: 0, col: 2 }, "ArrowDown"), { row: 1, col: 6 }, "ending 2 stands over column 7");
  assert.deepEqual(gal.endingKey(seen, false, { row: 1, col: 6 }, "ArrowUp"), { row: 0, col: 2 });
  assert.deepEqual(gal.endingKey(seen, false, { row: 1, col: 1 }, "ArrowDown"), { row: 2, col: 3 });
  assert.deepEqual(gal.endingKey(seen, false, { row: 2, col: 3 }, "ArrowDown"), { row: 3, col: 4 });
  assert.equal(gal.endingKey(seen, false, { row: 3, col: 4 }, "ArrowRight"), null);
  // with the final episode offered (all complete): it sits at row 3 column 5
  const all = (r, c) => (r === 0 ? c < 3 : r === 3 ? c < 6 : c < 8);
  assert.deepEqual(gal.endingKey(all, true, { row: 3, col: 4 }, "ArrowRight"), { row: 3, col: 5 });
  assert.deepEqual(gal.endingKey(all, true, { row: 2, col: 7 }, "ArrowDown"), { row: 3, col: 5 });
  assert.deepEqual(gal.endingKey(all, true, { row: 3, col: 5 }, "ArrowUp"), { row: 2, col: 7 });
  // on the page: Left on the grid's first column gives the cursor to the column
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  const line = find((e) => e.cls.has("gl-cursorline"))[0];
  ui.key("ArrowRight");
  assert.equal(line.style.visibility, "hidden");
  ui.key("ArrowLeft");
  assert.equal(line.style.visibility, "visible");
  assert.equal(ui.sounds.at(-1), 0);
});

test("G6 (wipe): the capture leaves the rule's dark parts first (0x9fe00: threshold 1 - a/255, softness 128, direction +1)", () => {
  for (const r of [0, 0.3, 0.7, 1]) { near(gal.wipeAlpha(r, 0), 1); assert.equal(gal.wipeAlpha(r, 1), 0); }
  // half way: gone where the rule is dark, still at full where it is bright (G19: no fade of its own)
  assert.equal(gal.wipeAlpha(0, 0.5), 0);
  assert.equal(gal.wipeAlpha(1, 0.5), 1);
  assert.ok(gal.wipeAlpha(0.6, 0.4) > gal.wipeAlpha(0.4, 0.4), "brighter stays longer");
});

test("G19: a picture change keeps the old screen 8 frames, then wipes it away through the rule in 30 frames at full strength; the new picture never shows first (0xca54, 0xcd58, 0x9fe00)", () => {
  assert.equal(gal.CHANGE_HOLD, 8);
  assert.equal(gal.CHANGE_FRAMES, 30);
  // the alpha byte moves only the threshold: whatever it has not reached is still at 1
  for (const n of [1, 2, 3]) for (const r of [0, 0.5, 1]) assert.equal(gal.wipeAlpha(r, n / 30), 1, "the first three wipe frames change nothing (x <= 0.125)");
  assert.ok(gal.wipeAlpha(0, 4 / 30) < 1, "the rule's darkest part starts to go on the 4th");
  assert.equal(gal.wipeAlpha(1, 29 / 30), 0, "gone everywhere before its last frame (x >= 0.875)");
  // the native frames (PC build, rule_27, its red channel): the capture's alpha by rule level at two moments
  const native = [[0.39, [[0, 0], [0.2, 0.28], [0.4, 0.84], [0.6, 1], [1, 1]]], [0.6, [[0.4, 0], [0.6, 0.234], [0.8, 0.793], [1, 1]]]];
  for (const [p, pts] of native) for (const [r, a] of pts) near(gal.wipeAlpha(r, p), a, `p ${p} r ${r}`, 0.03);

  // on the page, frame by frame
  const data = tinyGallery();
  const { ui, find, images } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  ui.key("ArrowRight"); ui.key("ArrowRight");
  ui.key("Enter");   // the viewer, on IMG0004
  const rules = images.slice(-2);
  const box = find((e) => e.cls.has("gl-viewer"))[0];
  const band = find((e) => e.cls.has("gl-viewer-band"))[0];
  const img = find((e) => e.tag === "img")[0];
  const load = () => { Object.assign(img, { naturalWidth: 1920, naturalHeight: 1080, complete: true }); img.onload(); };
  load();
  ui.frames(31 + 30 + 120 + 31);   // opened, and its band has come and gone
  assert.equal(band.style.opacity, "0");
  const cover = () => find((e) => e.cls.has("gl-wipe"))[0];

  // 1. the rule not loaded yet: the old screen still covers at once, and stays until it is
  ui.key("ArrowRight");
  assert.equal(img.src, "/assets/img/IMG0001.avif");
  assert.ok(cover(), "covered at the key");
  assert.equal(box.children.at(-1), cover(), "over everything, the band included");
  assert.equal(cover().wipe.p, 0);
  load();
  ui.frames(20);
  assert.equal(cover().wipe.p, 0, "waits for the rule");
  for (const r of rules) r.complete = true;
  ui.frames(1);
  near(cover().wipe.p, 1 / 30);
  ui.frames(29);
  assert.equal(cover(), undefined);

  // 2. loaded at once: 8 frames held (no band yet), the 9th is the wipe's first, the 38th takes it away
  ui.frames(200);   // its band has gone again
  assert.equal(band.style.opacity, "0");
  ui.key("ArrowRight");
  const first = cover();
  load();
  for (let f = 1; f <= 8; f++) {
    ui.frames(1);
    assert.equal(first.wipe.p, 0, `frame ${f}`);
    assert.equal(band.style.opacity, "0", `no band yet at frame ${f}`);
  }
  ui.frames(1);
  near(first.wipe.p, 1 / 30, "frame 9");
  assert.ok(Number(band.style.opacity) > 0, "the band comes in again (0x604c), under the capture");
  assert.equal(box.children.at(-1), first);
  ui.frames(28);
  near(first.wipe.p, 29 / 30, "frame 37");
  ui.key("ArrowRight");
  assert.equal(img.src, "/assets/img/IMG0002.avif", "no keys while it runs");
  ui.frames(1);
  assert.equal(cover(), undefined, "frame 38: done");
  ui.key("ArrowRight");
  assert.equal(img.src, "/assets/img/IMG0004.avif");

  // 3. a picture that loads late: held at full until the frame after it is in
  ui.frames(12);
  assert.equal(cover().wipe.p, 0);
  load();
  ui.frames(1);
  near(cover().wipe.p, 1 / 30);
});

test("G20: the gallery opened from the title: thumbnails 0.49 s into their cascade and the scroll bar 0.245 s into its fade on the first frame, the column from 0, the second frame 0.1 s long (native frames, 0xef08c)", async () => {
  const { GALLERY_OPEN, EASE: E } = await import("../../web/app/js/uifx.js");
  assert.deepEqual(GALLERY_OPEN, { hold: 0.35, cascade: 0.49, scrollBar: 0.245, second: 0.1 });
  const open = (opts) => {
    const data = tinyGallery();
    const page = galleryPage();
    const vm = galleryVm(data, { seen: [1, 2, 4] });
    gal.openGallery(page.ui, vm, galleryEnv(vm), "cg", opts);
    const q = (c) => page.find((e) => e.cls.has(c));
    const bar = page.find((e) => String(e.style.cssText || "").includes("scroll_bar"))[0];
    return { ...page, thumbs: () => q("gl-thumb"), content: q("gl-content")[0], item: q("gl-item")[0], bar };
  };
  const cascade = (t, delay) => E.quad.in(Math.min(1, Math.max(0, (t - delay) / 0.5)));
  // from the title: as built (the frame that builds it) the first frame; the first tick 0.1 s (6 frames) long
  const a = open({ fromTitle: true });
  near(Number(a.item.style.opacity), 0, "the column from 0");
  assert.equal(a.content.style.opacity, "1", "the grid is not faded with the column");
  near(Number(a.thumbs()[1].style.opacity), cascade(0.49, 0.02), "thumbnail 1, 0.02 s behind");
  near(Number(a.bar.style.opacity), (0.245 / 0.5) ** 2, "the scroll bar's own fade");
  near(Number(a.find((e) => e.cls.has("gl-guide"))[0].style.opacity), (0.245 / 0.5) ** 2, "the band, as far into its fade");
  a.ui.frames(1);
  near(Number(a.item.style.opacity), (6 / 30) ** 2, "the second frame: 0.1 s");
  near(Number(a.thumbs()[1].style.opacity), cascade(0.49 + 0.1, 0.02));
  near(Number(a.bar.style.opacity), ((0.245 + 0.1) / 0.5) ** 2);
  a.ui.frames(1);
  near(Number(a.item.style.opacity), (7 / 30) ** 2, "then a frame at a time");
  // opened otherwise (a replay's return, a test): no head starts, the cascade from 0
  const b = open({});
  b.ui.frames(1);
  near(Number(b.item.style.opacity), (1 / 30) ** 2);
  assert.equal(b.thumbs()[1].style.opacity, "0");
  b.ui.frames(1);
  near(Number(b.item.style.opacity), (2 / 30) ** 2, "no long second frame");
});

test("G20: the system menu's background keeps one set of sparkles for the session: the gallery's goes on with the title's, drawn from its first frame, moved by the newest (0xb34bc8, 0x4bd10)", async () => {
  const { menuSparkles } = await import("../../web/app/js/ui.js");
  const saved = { document: globalThis.document, Image: globalThis.Image };
  const drawn = [], fx = [];
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 82; } };
  globalThis.document = { createElement: (tag) => ({ tag, style: {}, dataset: {}, children: [], append(...c) { this.children.push(...c); },
    getContext: () => ({ globalAlpha: 1, clearRect() {}, drawImage: (...a) => drawn.push(a) }) }) };
  try {
    const fake = { animate: (fn) => fx.push(fn) }, page = { append() {} };
    Object.assign(menuSparkles, { set: null, star: null, owner: null, canvas: null, render: null });
    UI.prototype.menuBackground.call(fake, page, { settled: true });   // the title's GALLERY
    for (let i = 0; i < 120; i++) fx.forEach((f) => f(1));
    const set = menuSparkles.set;
    assert.equal(set.p.length, 100, "full after two seconds");
    drawn.length = 0;
    UI.prototype.menuBackground.call(fake, page, { settled: true });   // the gallery's
    assert.equal(menuSparkles.set, set, "the same set");
    assert.ok(drawn.length > 50, "drawn as they are on its first frame");
    const q = set.p[0], age = q.age;
    fx.forEach((f) => f(1));   // both backgrounds' frames run: only the newest moves them
    assert.equal(q.age, age + 1);
  } finally { Object.assign(globalThis, saved); Object.assign(menuSparkles, { set: null, star: null, owner: null, canvas: null, render: null }); }
});

test("M17: opening the Music Player marks the music playing heard, so the title's music 2 lists its rows (0x19518 -> 0x9c460, 0x64f60)", async () => {
  const data = tinyGallery();
  data.music[0].also = [2];   // as row 0 (music 1, also 2)
  const { ui, find } = galleryPage();
  const vm = galleryVm(data);
  vm.audio.playBGM(2, {});   // the title's
  await new Promise((r) => setTimeout(r, 0));
  gal.openGallery(ui, vm, galleryEnv(vm), "music");
  assert.ok(vm.unlocks.music.has(2));
  assert.equal(find((e) => e.cls.has("gl-track"))[0].text, "One");
  // with nothing playing nothing is marked
  const p2 = galleryPage();
  const vm2 = galleryVm(tinyGallery());
  gal.openGallery(p2.ui, vm2, galleryEnv(vm2), "music");
  assert.equal(vm2.unlocks.music.size, 0);
});

test("G14: the gallery's help band: the column's kind 10, a section's own, hidden under the viewer (0x6124, 0x6934, 0x74f0, 0x82bc / 0x82d0, 0x5c4c)", () => {
  // 0x5c4c: another kind while shown goes out, then comes in with the new one; the same kind does nothing
  const g = new gal.GuideFx(10);
  g.to(10);
  g.step(31);
  assert.deepEqual([g.phase, g.alpha, g.kind], ["on", 1, 10]);
  g.to(0);
  assert.equal(g.phase, "out");
  g.step(15);
  near(g.alpha, 0.25);
  assert.equal(g.kind, 10, "the old kind while it goes out");
  g.step(16);
  assert.deepEqual([g.phase, g.kind], ["in", 0]);
  g.step(31);
  assert.equal(g.phase, "on", "it stays (no hold)");
  // on the page
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4], music: [1] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  const band = find((e) => e.cls.has("gl-guide"))[0];
  ui.frames(31);
  assert.deepEqual(ui.helpScreens, [10]);
  near(Number(band.style.opacity), 1);
  ui.key("ArrowRight");   // the grid (two entries: no scrolling) keeps 10
  ui.frames(31);
  assert.deepEqual(ui.helpScreens, [10]);
  ui.key("Enter");        // a sub-grid: still 10
  ui.key("Enter");        // the viewer: the band goes
  ui.frames(31);
  near(Number(band.style.opacity), 0);
  ui.key("Escape");
  ui.frames(31);
  near(Number(band.style.opacity), 1);
  // the Music Player: its list asks for 0 (with Scroll), its panel for 10
  ui.key("Escape"); ui.key("Escape");   // to the sub-grid's entries, then the column
  ui.key("ArrowDown"); ui.key("Enter");
  ui.frames(31 + 31);
  assert.equal(ui.helpScreens.at(-1), 0);
  ui.key("ArrowRight");   // to the panel
  ui.frames(31 + 31);
  assert.equal(ui.helpScreens.at(-1), 10);
});

// ---- the gallery's pictures against the sprite class's draw (0x254bc) ---------------------------------------------
const spritesOf = (find, name, pos) => find((e) => (e.style.cssText || "").includes(`/${name}.webp`) && (!pos || e.style.cssText.includes(`background-position:${pos};`)));
const ancestors = (e) => { const out = []; for (let p = e.parent; p; p = p.parent) out.push(p); return out; };

test("G15: the CG viewer's backdrop is 0xba18's grey rectangle (0.847), behind the picture", () => {
  const css = readFileSync(new URL("../../web/app/style.css", import.meta.url), "utf8");
  const rule = css.split("\n").find((l) => l.startsWith(".gl-viewer {") && l.includes("background"));
  assert.match(rule, /background: rgb\(216, 216, 216\)/);
  assert.equal(Math.round(0.847 * 255), 216);
});

test("G16: the CG grid cursor is a frame and a light cut to y 109-1014; the light flashes 15 frames from each placing; the column line grows linearly (0x9578, 0xa968, 0x337380, 0x3372d8, 0x1fd48)", () => {
  // op 19 to -1 over 30 frames from alpha 1: drawn while above 0
  assert.deepEqual([0, 7.5, 15, 30, 45].map(gal.cgCursorLight), [1, 0.5, 0, 0, 0]);
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4], music: [1] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  // the column's line: x scale 0 -> 1 over 12 frames, in a straight line
  const line = find((e) => e.cls.has("gl-cursorline"))[0];
  ui.key("ArrowDown");
  ui.frames(6);
  near(Number(/scaleX\(([\d.e-]+)\)/.exec(line.style.transform)[1]), 0.5);
  ui.key("ArrowUp");
  ui.frames(31);
  const [frame] = spritesOf(find, "cg_cursor", "-8px -8px"), [light] = spritesOf(find, "cg_cursor", "-264px -8px");
  assert.ok(frame && light, "two cells of cg_cursor");
  assert.ok(frame.style.cssText.includes("width:248px;height:144px"));
  assert.equal(light.parent, frame.parent);
  assert.ok(light.parent.children.indexOf(light) > light.parent.children.indexOf(frame), "the light in front (z 210 < 250)");
  assert.ok(ancestors(frame).some((e) => e.cls.has("gl-thumb-clip")), "cut like the thumbnails");
  ui.key("ArrowRight");   // the grid takes the cursor: placed, so the light flashes
  assert.equal(light.style.opacity, "1");
  ui.frames(5);
  near(Number(light.style.opacity), 1 - 10 / 30);
  ui.key("ArrowRight");   // a move starts it again
  assert.equal(light.style.opacity, "1");
  ui.frames(15);
  assert.equal(Number(light.style.opacity), 0);
});

test("G17: the Music Player's buttons are 88 x 80 cells at the native places; on-sprites over Play / Pause / Repeat; Stop / Prev / Next flash (0x1b7d8, 0x469ac0, 0x1e98c)", () => {
  assert.deepEqual(gal.CONTROLS, { play: [1432, 576], pause: [1512, 576], stop: [1592, 576], repeat: [1672, 576], prev: [1512, 656], next: [1592, 656] });
  assert.deepEqual(gal.CONTROL_CELL, { w: 88, h: 80, x: 8, dx: 96, rows: [8, 96, 184] });
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(gal.musicFlashes), [false, false, true, false, true, true]);
  near(gal.MUSIC_FLASH, 1 / 6);
  const data = tinyGallery();
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4], music: [1] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  let tick = null;
  globalThis.requestAnimationFrame = (f) => { tick = f; return 1; };
  ui.key("ArrowDown"); ui.key("Enter");
  ui.frames(31 + 31);
  const buttons = find((e) => e.cls.has("gl-control"));
  assert.deepEqual(buttons.map((b) => [b.style.left, b.style.top, b.style.width, b.style.height]),
    [["1432px", "576px", "88px", "80px"], ["1512px", "576px", "88px", "80px"], ["1592px", "576px", "88px", "80px"],
      ["1672px", "576px", "88px", "80px"], ["1512px", "656px", "88px", "80px"], ["1592px", "656px", "88px", "80px"]]);
  assert.deepEqual(buttons.map((b) => b.style.backgroundPosition), ["-8px -8px", "-104px -8px", "-200px -8px", "-296px -8px", "-392px -8px", "-488px -8px"]);
  const flash = find((e) => e.cls.has("gl-control-flash"))[0];
  ui.key("ArrowRight"); ui.key("ArrowRight"); ui.key("ArrowRight");   // the panel's Play, then Pause, then Stop
  tick();
  assert.equal(buttons[2].style.backgroundPosition, "-200px -96px", "the selected row");
  ui.key("Enter");
  assert.deepEqual([flash.style.left, flash.style.top, flash.style.backgroundPosition, flash.style.visibility, flash.style.opacity],
    ["1592px", "576px", "-200px -96px", "visible", "1"]);
  ui.frames(5);
  near(Number(flash.style.opacity), 1 - 0.5 ** 2, "quadratic in");
  ui.frames(6);
  assert.equal(flash.style.visibility, "hidden");
  // Repeat (button 3) does not flash; its row-184 sprite shows over it while repeat is on
  ui.key("ArrowRight"); ui.key("Enter");
  assert.equal(flash.style.visibility, "hidden");
  tick();
  const on = buttons[3].children.find((c) => c.cls.has("gl-control-on"));
  assert.ok(on.style.cssText.includes("background-position:-296px -184px;"));
  assert.equal(on.style.visibility, "visible");
  ui.key("Enter");
  tick();
  assert.equal(on.style.visibility, "hidden");
  globalThis.requestAnimationFrame = () => 0;
  gal.session.repeat = false;
});

test("G18: the lists' scroll bar is DISP_PARTS_JA's (0x276b0, 0x2788c), the Music list is cut to y 109-1014 (0x1a058), thumbnails have no outline", () => {
  assert.deepEqual(gal.SCROLL_BAR, { x: 1847, y: 105, thumbX: 1839, top: 99, travel: 610 });
  assert.deepEqual([[0, 100], [50, 100], [100, 100], [150, 100], [5, 0], [5, -2]].map(([v, m]) => gal.scrollThumbY(v, m)), [99, 404, 709, 709, 99, 99]);
  const css = readFileSync(new URL("../../web/app/style.css", import.meta.url), "utf8");
  assert.ok(!/\.gl-thumb \{[^}]*box-shadow/.test(css));
  // the CG grid: two entries do not scroll, so no bar
  const data = tinyGallery();
  const many = Array.from({ length: 20 }, (_, k) => ({ ...data.music[k % 3], title: `T${k}` }));
  data.music = many;
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { seen: [1, 2, 4], music: [1, 2, 3] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  const bars = () => spritesOf(find, "scroll_bar");
  const thumbs = () => spritesOf(find, "scroll_slider", "-48px -24px");
  assert.equal(bars().length, 1);
  assert.equal(bars()[0].style.display, "none");
  assert.ok(bars()[0].style.cssText.includes("left:1847px;top:105px;width:16px;height:888px"));
  // the Music list: 20 rows, 5 past the 15 shown
  ui.key("ArrowDown"); ui.key("Enter");
  ui.frames(31 + 31);
  const list = find((e) => e.cls.has("gl-music-list"))[0];
  assert.deepEqual([list.style.left, list.style.top, list.style.width, list.style.height], ["392px", "109px", "960px", "905px"]);
  assert.equal(thumbs()[0].style.display, "");
  assert.equal(thumbs()[0].style.top, "99px");
  for (let i = 0; i < 19; i++) ui.key("ArrowDown");   // to the last row: scrolled 5
  assert.equal(thumbs()[0].style.top, "709px");
});

// ---- section 4: the flowchart (F1-F4) -------------------------------------------------------------------------------
const fcm = await import("../../web/app/js/flowchart-model.js");
const fcPage = await import("../../web/app/js/flowchart.js");
// A small authored chart: A (day 0) splits at B into B / placeholder Q for scene 3 (piece 9 at column 1), then D / C,
// E / placeholder F for scene 6 under C, a row of two bare lines, and G (day 2).
const fcPart = (flag, line, secondary, extra = {}) => ({ flag, line, secondary, jump: 300 + Math.abs(flag), phase: -1, thumb: Math.abs(flag), preview: Math.abs(flag), previewName: `PV${Math.abs(flag)}`, title: `T${flag}`, note: `N${flag}`, script: flag > 0 ? flag : undefined, ...extra });
const fcChart = () => ({
  version: 2,
  layout: realChart?.layout || { firstColumnX: 438, columnPitch: 96, rowPitch: 56, rowNodeY: 4, rowConnectorY: -1, dayGap: 13, phaseTitleX: 208, previewPanel: [1352, 96, 488, 596] },
  connectorRects: Array.from({ length: 26 }, (_, i) => [i, 0, 96, 14]),
  phaseRects: Array.from({ length: 29 }, (_, i) => [0, i * 32, 200, 32]),
  groups: [
    { index: 0, day: 0, parts: [fcPart(1, 3, 564, { phase: 0 })] },
    { index: 1, day: 1, parts: [fcPart(2, 5, 565, { phase: 1 }), fcPart(-3, 9, 566)] },
    { index: 2, day: 1, parts: [fcPart(4, 3, 567), fcPart(3, 3, 568)] },
    { index: 3, day: 1, parts: [fcPart(5, 3, 569), fcPart(-6, 3, 570)] },
    { index: 4, day: 2, parts: [fcPart(0, 7, 571), fcPart(0, 7, 572)] },
    { index: 5, day: 2, parts: [fcPart(7, 3, 573)] },
  ],
});
const fcProgress = ({ completed = [], started = [], lines = [], path = [], pathLines = [] } = {}) => {
  const f = new FlowProgress(memoryStore());
  f.migrated = true;
  for (const n of completed) { f.completed.add(n); f.started.add(n); }
  for (const n of started) f.started.add(n);
  for (const n of lines) f.secondary.add(n);
  for (const n of path) f.path.add(n);
  for (const n of pathLines) f.pathSecondary.add(n);
  return f;
};
const pieceAt = (L, row, col, path = false) => L.pieces.filter((p) => p.path === path && p.x === 438 + 96 * col && p.y === L.rows[row].y - 1).map((p) => p.rect - (path ? 13 : 0));

test("F1: line pieces follow what is revealed: junctions re-chosen, placeholder pieces and drops, the row filter (0xfffc, 0x14824, 0x14d10, 0x153b8)", () => {
  const chart = fcChart();
  // B's authored junction 5 (up, down, right): with Q's line hidden it is a straight line down (3), with it a junction
  let L = fcm.layoutChart(chart, fcProgress({ completed: [1, 2], lines: [564, 565] }));
  assert.deepEqual(pieceAt(L, 1, 0), [3]);
  L = fcm.layoutChart(chart, fcProgress({ completed: [1, 2], lines: [564, 565, 566] }));
  assert.deepEqual(pieceAt(L, 1, 0), [5]);
  assert.deepEqual(pieceAt(L, 1, 1), [9], "Q's own piece");
  assert.equal(L.part(1, 1).node, "non", "a placeholder neither completed nor started");
  // started, the placeholder hides and its down piece gets the drop (piece 1, 14 lower)
  L = fcm.layoutChart(chart, fcProgress({ completed: [1, 2], started: [3], lines: [564, 565, 566] }));
  assert.equal(L.part(1, 1).node, undefined);
  assert.ok(L.pieces.some((p) => !p.path && p.rect === 1 && p.y === L.rows[1].y - 1 + 14));
  // piece 3 under placeholder F only once C (above it) drew its piece and is completed
  const base = { completed: [1, 2, 3, 5], lines: [564, 565, 566, 568, 569, 570] };
  L = fcm.layoutChart(chart, fcProgress(base));
  assert.deepEqual(pieceAt(L, 3, 1), [3]);
  L = fcm.layoutChart(chart, fcProgress({ ...base, completed: [1, 2, 5] }));
  assert.deepEqual(pieceAt(L, 3, 1), []);
  // a day's first row with piece 3 gets piece 0 above it; the rows: day gap 13 (8 + 5), rows 56 apart
  L = fcm.layoutChart(chart, fcProgress({ completed: [1, 2, 7], lines: [564, 565, 573] }));
  assert.deepEqual(L.rows.map((r) => [r.index, r.y]), [[0, 0], [1, 69], [5, 138]]);
  assert.ok(L.pieces.some((p) => p.rect === 0 && p.y === 138 - 1 - 13));
  // the filter: two bare lines are no row (nothing distinct); one alone in its row would be
  L = fcm.layoutChart(chart, fcProgress({ completed: [1, 7], lines: [564, 571, 572, 573] }));
  assert.deepEqual(L.rows.map((r) => r.index), [0, 5]);
  const one = fcChart();
  one.groups[4].parts = [fcPart(0, 3, 571)];
  assert.deepEqual(fcm.keptGroups(one, fcProgress({ completed: [1, 7], lines: [571] })).map((g) => g.index), [0, 4, 5]);
  // the day titles: phase 0 then 28 at 8 and 40; day 1's phase 1 at its first row + 8
  L = fcm.layoutChart(chart, fcProgress({ completed: [1, 2], lines: [564, 565] }));
  assert.deepEqual(L.labels.map((d) => d.labels.map((l) => [l.phase, l.y])), [[[0, 8], [28, 40]], [[1, 77]]]);
  // the real chart: every row and scene once everything is revealed
  if (realChart) {
    const parts = realChart.groups.flatMap((g) => g.parts);
    const all = fcProgress({ completed: parts.filter((p) => p.flag > 0).map((p) => p.flag), lines: parts.map((p) => p.secondary).filter((s) => s >= 564) });
    const R = fcm.layoutChart(realChart, all);
    assert.deepEqual([R.rows.length, R.nodes.length], [277, 495]);
  }
});

test("F2: the cursor moves as 0x1262c / 0x1280c / 0x129f4 / 0x12b68 do; a selection scrolls by 0x10d5c; a scroll re-selects (0x12d1c)", () => {
  const chart = fcChart();
  const done = { completed: [1, 2, 3, 4, 5], lines: [564, 565, 566, 567, 568, 569, 570] };
  // gallery: Up from C follows its line up through placeholder Q's piece 9 to B's junction and on to A
  let L = fcm.layoutChart(chart, fcProgress(done));
  assert.deepEqual(fcm.moveCursor(L, { row: 2, col: 1 }, "up"), { row: 0, col: 0 });
  assert.deepEqual(fcm.moveCursor(L, { row: 0, col: 0 }, "down"), { row: 1, col: 0 });
  assert.deepEqual(fcm.moveCursor(L, { row: 2, col: 0 }, "right"), { row: 2, col: 1 });
  // Right at a row's end: one column over in the row below, then above
  assert.deepEqual(fcm.moveCursor(L, { row: 1, col: 0 }, "right"), { row: 2, col: 1 });
  assert.equal(fcm.moveCursor(L, { row: 0, col: 0 }, "up"), null);
  // game: only scenes on the path in days 1 on; Up stops at day 0
  L = fcm.layoutChart(chart, fcProgress({ ...done, path: [1, 2, 3] }), { game: true });
  assert.deepEqual(L.nodes.map((n) => n.flag), [2, 3]);
  assert.deepEqual(fcm.moveCursor(L, { row: 1, col: 0 }, "down"), { row: 2, col: 1 });
  assert.equal(fcm.moveCursor(L, { row: 1, col: 0 }, "up"), null);
  // the nearest column (0x1303c): mode 0 keeps to its side of column 4
  const row = (regs) => ({ parts: regs.map((r) => ({ reg: r })) });
  const fake = { rows: [row([1, 0, 0, 0, 0, 1])], part(r, c) { return this.rows[r]?.parts[c] ?? null; } };
  assert.equal(fcm.nearestColumn(fake, 0, 3, 0), 0);
  assert.equal(fcm.nearestColumn(fake, 0, 4, 0), 5);
  assert.equal(fcm.nearestColumn(fake, 0, 3, 1), 5, "mode 1: +2 before -3");
  // the selection's scroll: below 966 the row below comes to 966, above 2 the row above to 4
  if (realChart) {
    const parts = realChart.groups.flatMap((g) => g.parts);
    const R = fcm.layoutChart(realChart, fcProgress({ completed: parts.filter((p) => p.flag > 0).map((p) => p.flag), lines: parts.map((p) => p.secondary).filter((s) => s >= 564) }));
    assert.equal(fcm.scrollFor(R, { row: 20, col: 0 }, 0), R.rows[21].parts[0].y - 966);
    assert.equal(fcm.scrollFor(R, { row: 20, col: 0 }, R.rows[20].parts[0].y - 500), null);
    assert.equal(fcm.scrollFor(R, { row: 20, col: 0 }, R.rows[20].parts[0].y + 10), R.rows[19].parts[0].y - 4);
    const to = fcm.reselect(R, { row: 0, col: 0 }, 3000);
    const y = R.part(to.row, to.col).y - 3000;
    assert.ok(y >= 4 && y < 994 && R.part(to.row - 1, 0).y - 3000 < 4, `${to.row} at ${y}`);
    const n = R.nodes[3];
    assert.equal(fcm.reselect(R, { row: n.row, col: n.col }, 0), null, "still in view");
  }
});

test("F3: the gallery's flowchart draws no path and selects completed scenes; the game's draws the path and hides placeholders on it (0x13fd4, 0x149b4)", () => {
  const chart = fcChart();
  const pr = { completed: [1, 2, 4], lines: [564, 565, 566, 567], path: [1, 2, 3, 4], pathLines: [564, 565, 567] };
  const G = fcm.layoutChart(chart, fcProgress(pr));
  assert.ok(G.pieces.every((p) => !p.path));
  assert.deepEqual(G.nodes.map((n) => n.flag), [1, 2, 4]);
  assert.equal(G.part(1, 1).node, "non", "the gallery shows the placeholder");
  const I = fcm.layoutChart(chart, fcProgress(pr), { game: true });
  assert.deepEqual(pieceAt(I, 1, 0, true), [3], "B's path junction: Q is not on the path's lines");
  assert.ok(I.pieces.some((p) => p.path));
  assert.equal(I.part(1, 1).node, undefined, "on the path: hidden in the game");
  assert.deepEqual(I.nodes.map((n) => n.flag), [2, 4], "day 0 is not selectable in the game");
});

test("F4: fades in and out in the game, the preview's cross-fade, the cursor's flash, 'This scene', the scroll bar, titles that stick (0x110d4, 0x11bec, 0x16e00, 0x10ba4, 0x11eb4)", async () => {
  // titles at 8 and 40 (bottom 72) under a separator at 300: at rest, stuck at 8, then pushed up
  assert.equal(fcPage.stickyShift([108, 140], 300, 0), 0);
  assert.equal(fcPage.stickyShift([108, 140], 300, 150), 50);
  // scrolled 250: stuck they would sit 150 lower (8 - 108 + 250), but the separator at 50 on screen pushes the stack
  // (bottom 8 + 32 + 32 = 72) up by 22
  assert.equal(fcPage.stickyShift([108, 140], 300, 250), 128);
  near(fcPage.PREVIEW_FADE, 1 / 12);
  const chart = fcChart();
  const { ui, El, find } = galleryPage();
  globalThis.document.getElementById = () => new El("div");
  const items = [];
  Object.assign(ui, {
    sel: 0, items,
    begin() { for (const c of [...ui.root.children]) c.remove(); items.length = 0; const p = new El("div"); ui.root.append(p); return p; },
    add(el, fn, o = {}) { items.push({ el, fn, ...o }); return el; },
    select(i) { ui.sel = i; items[i]?.onSelect?.(); },
    move(i) { ui.select(i); ui.sound(0); },
    system() { ui.systemShown = true; },
    back() { ui.sound(2); ui.backFn?.(); },
    env: { toast() {} },
  });
  const vm = { flowChart: chart, flow: fcProgress({ completed: [1, 2, 3, 4], lines: [564, 565, 566, 567, 568], path: [1, 2, 3, 4] }), running: true, system: {} };
  vm.flow.current = 2;
  await fcPage.openFlowchart(ui, vm, () => {});
  const view = find((e) => e.cls.has("fc-view"))[0];
  near(Number(view.style.opacity), 0, "the game's flowchart fades in too");
  assert.ok(find((e) => (e.style.cssText || "").includes("/flow_info.webp")).length === 1, "'This scene'");
  const titles = () => find((e) => e.cls.has("fc-preview-title"));
  assert.deepEqual(titles().map((t) => t.text), ["T2"]);
  ui.frames(31);
  near(Number(view.style.opacity), 1);
  const [cursor, flash] = find((e) => e.cls.has("fc-cursor"));
  assert.equal(cursor.style.backgroundPosition, "-8px -8px", "the path changes no cursor");
  // Down: to the next row's first scene on the path (D, scene 4); the preview cross-fades and the flash runs
  ui.items[ui.sel].down();
  assert.equal(ui.sounds.at(-1), 0);
  assert.deepEqual(titles().map((t) => t.text), ["T2", "T4"]);
  assert.equal(flash.style.opacity, "1");
  ui.frames(3);
  near(Number(titles()[1].style.opacity), EASE.quad.in(3 / 5));
  near(Number(titles()[0].style.opacity), 1 - EASE.quad.in(3 / 5));
  near(Number(flash.style.opacity), 1 - 6 / 30);
  ui.frames(3);
  assert.deepEqual(titles().map((t) => t.text), ["T4"]);
  // a change within 12 frames of the last swaps the texts at once, so two never lie over each other
  assert.equal(fcPage.PREVIEW_QUICK, 12);
  const notes = () => find((e) => e.cls.has("fc-preview-note"));
  ui.frames(12);
  ui.items[ui.sel].up();                                    // a lone change still cross-fades
  assert.equal(titles().length, 2);
  assert.equal(notes().length, 2);
  ui.frames(1);
  ui.items[ui.sel].down();                                  // the next one, a frame later
  assert.deepEqual(titles().map((t) => t.text), ["T4"]);
  assert.equal(notes().length, 1);
  assert.equal(titles()[0].style.opacity, "1", "shown at once");
  ui.frames(1);
  ui.items[ui.sel].up();                                    // and another: still one text
  assert.equal(titles().length, 1);
  assert.equal(notes().length, 1);
  ui.frames(11);
  ui.items[ui.sel].down();                                  // still within 12 frames of the last
  assert.deepEqual(titles().map((t) => t.text), ["T4"]);
  ui.frames(12);
  ui.items[ui.sel].up();                                    // 12 frames on it is a lone change again
  assert.equal(titles().length, 2);
  ui.frames(6);
  ui.items[ui.sel].down();
  ui.frames(6);
  assert.deepEqual(titles().map((t) => t.text), ["T4"]);
  // the scroll bar: this chart does not scroll
  assert.equal(spritesOf(find, "scroll_bar")[0].style.display, "none");
  // Back: the titles go at once, the rest over half a second, then the system menu
  ui.back();
  assert.equal(find((e) => e.cls.has("fc-titles"))[0].style.visibility, "hidden");
  ui.frames(15);
  near(Number(view.style.opacity), 1 - EASE.quad.out(0.5));
  assert.ok(!ui.systemShown);
  ui.frames(16);
  assert.ok(ui.systemShown);
});

// ---- F5-F9: the rest of the flowchart, checked against the native build with the user's save -------------------------
// A flowchart page in the fake document (as in F4); window listeners are kept so a test can send keyup.
const winListeners = {};
async function fcOpen(chart, flow, opts = {}, vmExtra = {}) {
  const { ui, El, find } = galleryPage();
  globalThis.document.getElementById = () => new El("div");
  for (const k of Object.keys(winListeners)) delete winListeners[k];
  globalThis.addEventListener = (t, f) => (winListeners[t] ||= []).push(f);
  globalThis.removeEventListener = (t, f) => { winListeners[t] = (winListeners[t] || []).filter((g) => g !== f); };
  const items = [];
  Object.assign(ui, {
    sel: 0, items,
    begin() { for (const c of [...ui.root.children]) c.remove(); items.length = 0; const p = new El("div"); ui.root.append(p); return p; },
    add(el, fn, o = {}) { items.push({ el, fn, ...o }); return el; },
    select(i) { ui.sel = i; items[i]?.onSelect?.(); },
    move(i) { ui.select(i); ui.sound(0); },
    system() { ui.systemShown = true; },
    back() { ui.sound(2); ui.backFn?.(); },
    dialog(q, yes, no) { ui.dialogs.push(q); ui.yes = yes; ui.no = no; },
    env: { toast() {} },
  });
  const jumps = [];
  const vm = { flowChart: chart, flow, running: true, system: {}, ...vmExtra };
  await fcPage.openFlowchart(ui, vm, (i, p) => jumps.push([i, p.flag]), null, opts);
  const view = find((e) => e.cls.has("fc-view"))[0];
  const help = find((e) => e.cls.has("fc-help"))[0];
  const title = () => find((e) => e.cls.has("fc-preview-title")).at(-1)?.text;
  return { ui, El, find, view, help, jumps, title, vm };
}
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// The user's save (data/tsuki/reference-saves/discord-2026-11-07, decoded by tools/decode_save.py): every scene but
// 496 / 497 / 531 / 532 / 558-575 completed, lines 565-1194 revealed.
const savedFlow = () => fcProgress({ completed: [...R(1, 495), ...R(498, 530), ...R(533, 557)], started: [560, 561, 562], lines: R(565, 1194) });

test("F5: day bands from the top to the chart's bottom, broken by the separators; the scroll's end from 0x14b58's bottom + 56 (0x13b54, 0x13d04, 0x14b58, 0xfffc)", async () => {
  // rows at 0 (day 0), 69 (day 1), 138 (day 2): separators at 64 and 133, the bottom at 194 + 8
  const L = fcm.layoutChart(fcChart(), fcProgress({ completed: [1, 2, 7], lines: [564, 565, 573] }));
  assert.deepEqual(L.bands.map((b) => [b.name.replace(/flow_sam_bg_|_fullhd/g, ""), b.y, b.h]), [
    ["middle", 0, 67], ["under", 64, 5], ["upper", 72, 5],
    ["middle", 74, 62], ["under", 133, 5], ["upper", 141, 5],
    ["middle", 143, 62], ["under", 202, 5]]);
  assert.equal(L.bottom, 202);
  assert.equal(L.scrollMax, 202 + 56 + 4 - 1022 - 28);
  assert.deepEqual(L.labels.map((d) => d.limit), [72, 141, null], "titles stop at the next separator's second edge");
  // the page draws them: middle stretched (fc-band), under / upper as 1440 x 5 sprites, in front
  const { find } = await fcOpen(fcChart(), fcProgress({ completed: [1, 2, 7], lines: [564, 565, 573] }), { gallery: true });
  assert.deepEqual(find((e) => e.cls.has("fc-band")).map((e) => [e.style.top, e.style.height]), [["0px", "67px"], ["74px", "62px"], ["143px", "62px"]]);
  assert.equal(find((e) => (e.style.cssText || "").includes("flow_sam_bg_upper_fullhd")).length, 2);
  if (!realChart) return;
  // the native captures with the user's save: day 0 ends with the under piece at 232 and the upper at 240 (native rows
  // 232-244 at x 100); the scroll's end 14697 lets the game open on scene 309 at 14689 as the native does (the old end,
  // bottom + 4 - 1022 less 84, stopped at 14641)
  const G = fcm.layoutChart(realChart, savedFlow());
  assert.deepEqual(G.bands.slice(0, 4).map((b) => [b.y, b.h]), [[0, 235], [232, 5], [240, 5], [242, 1126]]);
  assert.equal(G.scrollMax, 14697);
  const flow = savedFlow(); flow.path.add(309);
  const I = fcm.layoutChart(realChart, flow, { game: true });
  const p = I.rows.flatMap((r) => r.parts).find((q) => q.flag === 309);
  assert.equal(fcm.scrollFor(I, p, 0), 14689);
  assert.deepEqual(I.bands.filter((b) => !b.name.includes("middle") && b.y > 14689 && b.y < 14689 + 1022).map((b) => b.y - 14689), [845, 853]);
});

test("F6: the first stick, PageUp / PageDown, the wheel and a drag scroll as 0x11418 does; a node in view takes the selection (0x27bd4, 0x40c, 0xb3a18, 0x12d1c)", async () => {
  // the stick: past 80 of 128, (|y| - 40) / 44 x 504 from the scroll; full tilt 1008
  assert.equal(fcm.stickTarget(0, -128), 1008);
  assert.equal(fcm.stickTarget(5000, 128), 3992);
  assert.equal(fcm.stickTarget(0, 80), null);
  assert.equal(fcm.stickTarget(0, -81), 469);
  assert.equal(fcPage.stickY([{ mapping: "standard", axes: [0, 1] }]), -128, "the left stick pushed down");
  assert.equal(fcPage.stickY([], new Set(["PageUp"])), 128);
  // the pad's pulses: at the push, after 15 frames, then every 5
  const pr = new fcm.PadRepeat(), pulses = [];
  for (let i = 0; i < 30; i++) if (pr.step(true, 1)) pulses.push(i);
  assert.deepEqual(pulses, [0, 15, 20, 25]);
  assert.equal(pr.step(false), false);
  assert.equal(pr.step(true), true, "a new push pulses at once");
  // the drag: the largest -dy in touch pixels, x 0.9 a frame, 6 x it ahead of the scroll
  const fl = new fcm.DragFlick();
  assert.deepEqual([fl.step(100, 0), fl.step(90, 0), fl.step(null, 0), fl.step(null, 0)], [null, 60, 54, 48]);
  assert.equal(fcPage.wheelPixels({ deltaY: 3, deltaMode: 1 }), 120);
  if (!realChart) return;
  const { ui, view, title } = await fcOpen(realChart, savedFlow(), { gallery: true });
  ui.frames(31);
  assert.deepEqual([view.scrollTop, title()], [0, "Glass Moon"]);
  // the wheel: its own distance, eased over 1/6 s (quadratic out); then the selection is a node in view
  view.fire("wheel", { deltaY: 300, deltaMode: 0 });
  ui.frames(1);
  near(view.scrollTop, 300 * EASE.quad.out(0.1));
  ui.frames(10);
  assert.equal(view.scrollTop, 300);
  assert.notEqual(title(), "Glass Moon", "Glass Moon left the view: another node took the selection");
  // PageDown (the PC build's SDOWN): one pulse of 1008, the next 15 frames later while held, none after the key is up
  ui.key("PageDown");
  ui.frames(11);
  assert.equal(view.scrollTop, 1308);
  ui.frames(4);
  assert.equal(view.scrollTop, 1308);
  ui.frames(1);
  assert.ok(view.scrollTop > 1308);
  for (const f of winListeners.keyup || []) f({ type: "keyup", key: "PageDown" });
  ui.frames(30);
  assert.equal(view.scrollTop, 2316);
  // a drag up of 30 stage pixels (20 touch pixels) a frame, then let go: it coasts and stops
  view.fire("pointerdown", { button: 0, clientX: 700, clientY: 600, pointerId: 1 });
  ui.frames(1);
  for (let k = 1; k <= 5; k++) { view.fire("pointermove", { clientX: 700, clientY: 600 - 30 * k }); ui.frames(1); }
  const held = view.scrollTop;
  assert.ok(held > 2316 + 5 * 15 && held < 2316 + 5 * 40, `${held}`);
  view.fire("pointerup", {});
  ui.frames(60);
  const end = view.scrollTop;
  assert.ok(end > held + 100, "it coasts");
  ui.frames(10);
  assert.equal(view.scrollTop, end, "and stops");
  // a drag that starts over the preview (x > 1360) does nothing
  view.fire("pointerdown", { button: 0, clientX: 1500, clientY: 600, pointerId: 2 });
  for (let k = 1; k <= 5; k++) { view.fire("pointermove", { clientX: 1500, clientY: 600 - 30 * k }); ui.frames(1); }
  view.fire("pointerup", {});
  ui.frames(20);
  assert.equal(view.scrollTop, end);
});

test("F7: Decide acts on the part at the selection when it is no node: the game's rewind question, the gallery's replay (0x11418, 0xf8fc, 0x11a58, 0x5040)", async () => {
  // in the game the current scene 6 has only a placeholder (-6): the selection stays on row 0, column 0 (scene 1, day 0,
  // not selectable in the game): no cursor, its preview; Decide asks to rewind to scene 1 (the port's Enter used to act
  // on the first selectable node)
  const flow = fcProgress({ completed: [1, 2, 3, 4, 5], lines: [564, 565, 566, 567, 568, 569, 570], path: [1, 2, 4] });
  flow.current = 6;
  let pg = await fcOpen(fcChart(), flow);
  pg.ui.frames(31);
  assert.equal(pg.title(), "T1");
  assert.equal(pg.find((e) => e.cls.has("fc-cursor"))[0].style.display, "none");
  assert.equal(pg.ui.key("Enter"), true);
  assert.equal(pg.ui.sounds.at(-1), 1);
  assert.equal(pg.ui.dialogs.length, 1);
  pg.ui.yes();
  assert.deepEqual(pg.jumps, [[1, 1]]);
  // a move from there goes on from row 0 as usual
  pg = await fcOpen(fcChart(), flow);
  pg.ui.frames(31);
  pg.ui.items[pg.ui.sel].down();
  assert.equal(pg.title(), "T2");
  // the gallery: scene 1 not completed but its line revealed is a flow_sam_non node, not selectable; Decide replays it
  pg = await fcOpen(fcChart(), fcProgress({ completed: [2], lines: [564, 565] }), { gallery: true }, { audio: sound().audio });
  pg.ui.frames(31);
  assert.equal(pg.title(), "T1");
  pg.ui.key("Enter");
  assert.deepEqual(pg.jumps, [], "the replay waits for its cover");
  pg.ui.frames(31);
  assert.deepEqual(pg.jumps, [[1, 1]]);
  // a part with no scene to start (a placeholder) starts nothing
  assert.equal(fcm.layoutChart(fcChart(), fcProgress()).rows.length, 0);
});

test("F8: the help band is a gallery guide of the flowchart's kind (0x123f4: 0 with Scroll while it scrolls, else 10); from the gallery it switches from the column's, in the game it follows the fade (0x7624 -> 0x5c4c, 0x1776c, 0x1783c)", async () => {
  assert.deepEqual(fcPage.HELP[0], ["Back", "Choose", "Move", "Scroll"]);
  assert.equal(fcPage.helpKind({ scrollMax: 1 }), 0);
  assert.equal(fcPage.helpKind({ scrollMax: 0 }), 10);
  // a chart that does not scroll: kind 10, in the game at the chart's fade, not sliding
  let pg = await fcOpen(fcChart(), fcProgress({ completed: [1, 2], lines: [564, 565] }));
  assert.deepEqual(pg.ui.helpScreens, [10]);
  assert.equal(pg.help.style.opacity, pg.view.style.opacity);
  pg.ui.frames(15);
  near(Number(pg.help.style.opacity), EASE.quad.in(0.5));
  assert.equal(pg.help.style.transform, "");
  assert.equal(pg.find((e) => e.cls.has("fc-back")).length, 0, "the port's own text bar is gone");
  if (!realChart) return;
  // from the gallery: the column's kind 10 goes out over half a second, sliding down 25 units, and kind 0 comes in
  pg = await fcOpen(realChart, savedFlow(), { gallery: true, guide: { kind: 10, alpha: 1 } });
  assert.deepEqual(pg.ui.helpScreens, [0, 10]);
  pg.ui.frames(15);
  near(Number(pg.help.style.opacity), 1 - EASE.quad.out(0.5));
  assert.ok(pg.help.style.transform.startsWith("translateY("));
  pg.ui.frames(16);
  assert.deepEqual(pg.ui.helpScreens, [0, 10, 0]);
  pg.ui.frames(31);
  assert.deepEqual([pg.help.style.opacity, pg.help.style.transform], ["1", "translateY(0px)"]);
});

test("F9: the user's save decoded (tools/decode_save.py) gives the native captures' flowcharts: the gallery's Down path and scroll, the game's opening on scene 309 at the end", async () => {
  if (!realChart) return;
  const root = new URL("../../", import.meta.url).pathname;
  const py = `${root}web-research/.venv/bin/python`, save = `${root}data/tsuki/reference-saves/discord-2026-11-07/savedata000`;
  if (!existsSync(py) || !existsSync(save)) return;
  const { execFileSync } = await import("node:child_process");
  const d = JSON.parse(execFileSync(py, [`${root}web-dev/tools/decode_save.py`, save], { encoding: "utf8" }));
  assert.deepEqual([d.flow.started.length, d.flow.completed.length, d.flow.secondary.length], [556, 553, 630]);
  assert.deepEqual([d.play.record, d.play.current, d.play.path.length, d.play.secondary.length], [85, 309, 273, 348]);
  const flow = fcProgress({ completed: d.flow.completed, lines: d.flow.secondary });
  for (const n of d.flow.started) flow.started.add(n);
  // the gallery's flowchart (native run: title -> Gallery -> Flowchart, then 17 Downs): row 0 first, the same 18 scenes
  const G = fcm.layoutChart(realChart, flow);
  let at = { row: 0, col: 0 };
  const seen = [G.part(0, 0).title];
  for (let k = 0; k < 17; k++) { at = fcm.moveCursor(G, at, "down"); seen.push(G.part(at.row, at.col).title); }
  assert.deepEqual(seen.slice(0, 3), ["Glass Moon", "Prologue", "Early morning; The city awakens"]);
  assert.equal(seen.at(-1), "Eldest Son's Room");
  // its scroll then: the row below at 966 (native and web frames match at offset 0, scroll 171)
  let s = 0;
  at = { row: 0, col: 0 };
  for (let k = 0; k < 17; k++) { at = fcm.moveCursor(G, at, "down"); const to = fcm.scrollFor(G, at, s); if (to !== null) s = to; }
  assert.equal(s, 171);
  // the game (Continue -> system menu -> FlowChart): F110 = 309 at row 276 column 5, scroll 14689; Down does nothing on
  // the last row, Up goes One Last Parting Dream -> Retroflow -> Mystic Eyes, as natively
  flow.restore({ path: d.play.path, secondary: d.play.secondary, current: d.play.current });
  const I = fcm.layoutChart(realChart, flow, { game: true });
  const p = I.rows.flatMap((r) => r.parts).find((q) => q.flag === 309);
  assert.deepEqual([p.row, p.col, fcm.scrollFor(I, p, 0)], [276, 5, 14689]);
  assert.equal(fcm.moveCursor(I, p, "down"), null);
  const ups = [];
  for (let q = p, k = 0; k < 3; k++) { q = fcm.moveCursor(I, q, "up"); ups.push(I.part(q.row, q.col).title); }
  assert.deepEqual(ups.map((t) => t.split(" ")[0]), ["One", "Retroflow", "Mystic"]);
});

// ---- TODO items 34, 35, 37, 38, 41, 42 ---------------------------------------------------------------------------------
test("N2-58: the column's window, inner panel and underline are drawn from their descriptors' places (0x6124, 0x44e2f8 / 0x44e320 / 0x44e348)", () => {
  const { ui, find } = galleryPage();
  const vm = galleryVm(tinyGallery(), { seen: [1, 2, 4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  const at = (name) => /left:([\d.]+)px;top:([\d.]+)px/.exec(spritesOf(find, name)[0].style.cssText).slice(1).map(Number);
  assert.deepEqual(at("gallerymenu_window"), [56, 0]);
  assert.deepEqual(at("config_innerbg"), [365, 0]);
  assert.deepEqual(at("underline"), [0, 72]);
});

test("N2-67: Music rows are white at half alpha, the cursor's row at full, with no glow or colours of their own (0x1a1a4, 0x1b2f0, 0x1b43c)", () => {
  const css = readFileSync(new URL("../../web/app/style.css", import.meta.url), "utf8").split("\n");
  const rule = (sel) => css.find((l) => l.startsWith(`${sel} {`));
  assert.match(rule(".gl-track"), /color: rgba\(255, 255, 255, \.55\)/);
  assert.match(rule(".gl-music-rows.focused .gl-track.sel"), /color: #fff/);
  assert.ok(!/text-shadow/.test(rule(".gl-music-rows.focused .gl-track.sel")));
  assert.equal(rule(".gl-track.locked"), undefined);
  assert.equal(rule(".gl-track.playing"), undefined);
});

test("N2-60: Choosing the open section enters it at once, nothing closes or is rebuilt; the pointer only plays the sound (0x6e28)", async () => {
  const { ui, find } = galleryPage();
  const vm = galleryVm(tinyGallery(), { seen: [1, 2, 4], music: [1, 3] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  const q = (c) => find((e) => e.cls.has(c));
  const first = q("gl-thumb")[0];
  q("gl-item")[0].fire("click");
  assert.equal(ui.sounds.at(-1), 1);
  assert.equal(q("gl-cursor")[0].style.display, "none", "the pointer leaves the cursor on the column");
  ui.key("Enter");
  assert.equal(ui.sounds.at(-1), 1);
  assert.equal(q("gl-thumb")[0], first, "the grid is not built again");
  assert.equal(q("gl-cursor")[0].style.display, "block", "the grid has the cursor");
  ui.frames(1);
  assert.equal(q("gl-content")[0].style.opacity, "1", "no fade");
  // a track playing goes on
  const page = galleryPage();
  const vm2 = galleryVm(tinyGallery(), { seen: [1, 2, 4], music: [1, 3] });
  gal.openGallery(page.ui, vm2, galleryEnv(vm2), "music");
  page.ui.frames(31);
  page.ui.key("Enter");   // the open section's row: into the list
  page.ui.key("Enter");   // the first row plays
  await new Promise((r) => setTimeout(r, 0));
  const source = vm2.audio.ctx.sources.at(-1);
  page.ui.key("Escape");   // the cursor back on the column
  page.ui.key("Enter");
  page.ui.frames(31);
  assert.ok(!source.stopped, "the track goes on");
  assert.equal(page.find((e) => e.cls.has("gl-music-rows"))[0].cls.has("focused"), true);
  gal.session.repeat = false;
});

test("N2-56: the gallery reopens on the section it was left on in this run; the Title row leaves none (0x49b0, 0x6124, 0x82e4, 0x8400)", () => {
  gal.session.section = null;
  const data = tinyGallery();
  const openHere = () => {
    const page = galleryPage();
    const vm = galleryVm(data, { seen: [1, 2, 4], music: [1, 3] });
    gal.openGallery(page.ui, vm, galleryEnv(vm));
    page.ui.frames(31);
    return page;
  };
  let page = openHere();
  assert.equal(spritesOf(page.find, "cg_title").length, 1, "the first opening: the CG Gallery");
  page.ui.key("ArrowDown"); page.ui.key("Enter");   // Music Player
  page.ui.frames(62);
  page.ui.key("Escape"); page.ui.key("Escape");     // the column, then out
  page.ui.frames(31);
  assert.ok(page.ui.titled);
  page = openHere();
  assert.equal(spritesOf(page.find, "music_title").length, 1, "back on the Music Player");
  for (let k = 0; k < 4; k++) page.ui.key("ArrowDown");
  page.ui.key("Enter");     // the Title row
  page.ui.frames(31);
  assert.ok(page.ui.titled);
  page = openHere();
  assert.equal(spritesOf(page.find, "cg_title").length, 1, "after the Title row: the CG Gallery again");
  gal.session.section = null;
});

test("N2-64, N2-186: a sub-grid crossfades the old thumbnails out under its cascade, and each grid brings its cursor and scroll bar in (0x8d08, 0xa4f4, 0x9970, 0x9bdc)", () => {
  const { ui, find } = galleryPage();
  const vm = galleryVm(tinyGallery(), { seen: [1, 2, 4] });
  gal.openGallery(ui, vm, galleryEnv(vm), "cg");
  ui.frames(31);
  ui.key("Enter");   // into the grid
  ui.frames(61);
  const thumbs = () => find((e) => e.cls.has("gl-thumb")), layers = () => find((e) => e.cls.has("gl-layer"));
  const over = layers().find((l) => l.findAll((e) => e.cls.has("gl-cursor")).length);
  assert.equal(over.style.opacity, "1");
  const main = thumbs();
  ui.key("Enter");   // the first entry has two pictures
  assert.equal(thumbs().length, main.length + 2, "the old thumbnails stay");
  const old = main[0].parent;
  assert.equal(old.style.pointerEvents, "none");
  const fresh = thumbs().filter((t) => !main.includes(t));
  assert.ok(fresh.every((t) => t.style.opacity === "0"), "the new ones come from 0");
  assert.equal(over.style.opacity, "0", "the cursor from 0");
  ui.frames(15);
  near(Number(old.style.opacity), 1 - EASE.quad.out(0.5), "quadratic out", 1e-3);
  near(Number(over.style.opacity), EASE.quad.in(0.5), "quadratic in", 1e-3);
  ui.frames(16);
  assert.equal(old.parent, null, "gone after half a second");
  assert.equal(thumbs().length, 2);
  // Back goes the same way, onto the main grid
  const sub = thumbs();
  ui.key("Escape");
  assert.equal(thumbs().length, sub.length + main.length);
  assert.equal(over.style.opacity, "0");
  ui.frames(31);
  assert.equal(thumbs().length, main.length);
  // the viewer's return replaces the grid outright (0x9384) and brings its cursor in again
  ui.key("ArrowRight");
  ui.key("Enter");   // the second entry has one picture: the viewer
  ui.frames(31);
  ui.key("Escape");
  assert.equal(thumbs().length, main.length, "no old grid kept");
  assert.equal(over.style.opacity, "0");
  ui.frames(15);
  near(Number(over.style.opacity), EASE.quad.in(0.5), "quadratic in", 1e-3);
});

test("N2-57, N2-63: Yes on an ending fades the column, band and music over half a second, the menu's background at 0.04 a frame, then plays (0x5040, 0x826c, 0x7ac4)", async () => {
  const data = tinyGallery();
  data.endings = { list: [{ kind: "main", scene: 544, script: "QA_12", label: null, title: "Ep", prompt: "Play?" }] };
  const { ui, find } = galleryPage();
  const vm = galleryVm(data, { started: [544] });
  const played = [];
  let yes = null;
  ui.dialog = (q, y) => { yes = y; };
  gal.openGallery(ui, vm, galleryEnv(vm, { playEpisode: (e) => played.push(e.script) }), "ending");
  ui.frames(31);
  ui.key("Enter");   // the open section's row
  ui.key("Enter");   // the ending: the question
  vm.audio.playBGM(2, {});
  await new Promise((r) => setTimeout(r, 0));
  yes();
  assert.deepEqual(played, [], "not yet");
  const item = find((e) => e.cls.has("gl-item"))[0];
  ui.frames(15);
  near(Number(item.style.opacity), 0.25, "the column, quadratic out", 1e-3);
  assert.equal(vm.audio.bgmState, null, "the music is on its way out");
  assert.deepEqual(played, []);
  ui.frames(16);
  assert.deepEqual(played, ["QA_12"]);
});

test("N2-62: a Flowchart replay goes to black over half a second, the band going too (0x11418, 0x5040, 0x7918)", async () => {
  const pg = await fcOpen(fcChart(), fcProgress({ completed: [2], lines: [564, 565] }), { gallery: true }, { audio: sound().audio });
  pg.ui.frames(31);
  pg.ui.key("Enter");
  const cover = pg.find((e) => e.cls.has("fc-replay-cover"))[0];
  assert.ok(cover);
  pg.ui.frames(15);
  near(Number(cover.style.opacity), EASE.quad.out(0.5), "quadratic out", 1e-3);
  assert.equal(pg.ui.keyFn, null);
  pg.ui.backFn();
  assert.deepEqual(pg.jumps, [], "Back does nothing meanwhile");
  assert.equal(pg.ui.systemShown, undefined);
  pg.ui.frames(16);
  assert.deepEqual(pg.jumps, [[1, 1]]);
  pg.ui.frames(5);
  assert.deepEqual(pg.jumps, [[1, 1]], "once");
});
