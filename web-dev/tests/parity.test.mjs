// Checks for the behaviour restored from the parity audit (web-dev/audit): sound, script commands, text markup and the title
// stage. No browser or game data needed.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };

const { Audio, parseOpts } = await import("../../web/app/js/audio.js");
const { VM } = await import("../../web/app/js/vm.js");
const { parseMarkup, plain, charFadeMs, TextBox } = await import("../../web/app/js/textbox.js");
const { nextTitleStage } = await import("../../web/app/js/uifx.js");

const { withContext } = await import("./fake-audio.mjs");

// An Audio on a stand-in context: `started` lists the sources it starts.
function fakeAudio() {
  const audio = new Audio();
  const { ctx, gainOf } = withContext(audio);
  return { audio, started: ctx.sources, ctx, gainOf };
}

test("waiting for a voice waits for one that is still loading (RA-06)", async () => {
  const { audio, started } = fakeAudio();
  let decoded;
  audio.buffer = () => new Promise((r) => { decoded = r; });
  const playing = audio.playVoice("A00_01_00_0000_0", true);
  let done = false;
  const wait = audio.voiceDone().then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(done, false, "voiceDone must not pass while the voice loads");
  assert.equal(audio.voicePlaying, true);
  decoded({ duration: 2 });
  await playing;
  assert.equal(started.length, 1);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(done, false, "nor while it plays");
  started[0].end();
  await wait;
  assert.equal(done, true);
});

test("looped sound effects keep the wave's own loop region (RA-05); music too, from 069's sample (RA-07)", async () => {
  const { audio, started, gainOf } = fakeAudio();
  audio.seLoops = { MOON_SE03023: [541520, 2366986, 48000] };
  audio.musicLoops = { MOON01_BGM01: [1340383, 10315268] };
  audio.table = { bgm: { 7: "MOON01_BGM01", 8: "MOON01_BGM02" } };   // music 8 is sound index 7
  await audio.playSE(3, true, "moon_se03023", parseOpts(["`017:50", "`018:96"]));
  const se = started.at(-1);
  assert.equal(se.loop, true);
  assert.deepEqual([se.loopStart, se.loopEnd], [541520 / 48000, 2366986 / 48000]);
  assert.equal(gainOf(se), audio.seGain(50));
  assert.deepEqual(audio.se.get(3).n.matrix, [[Math.SQRT1_2, Math.SQRT1_2], [0, 1]], "018 96: nn::atk pan 1.0 (A6)");
  await audio.playBGM(8, parseOpts(["`017:100", "`069:502272"]));
  const bgm = started.at(-1);
  assert.equal(bgm.started.offset, 502272 / 48000);
  assert.deepEqual([bgm.loopStart, bgm.loopEnd], [1340383 / 48000, 10315268 / 48000]);
  await audio.playBGM(9, parseOpts(["`049:0"]));
  assert.equal(started.at(-1).loop, false);
});

test("the menu volume is its own group, not a master volume (UI-01); music and effects carry their own amplitude", async () => {
  const { audio, started, gainOf } = fakeAudio();
  audio.setVolume("sys", 0.25);
  assert.equal(audio.groups.sys.gain.value, 0.25);
  assert.equal(audio.groups.bgm.gain.value, 1);
  assert.equal(audio.groups.se.gain.value, 1);
  await audio.playSE(2, false, "DOOR", parseOpts(["`017:100"]));
  assert.ok(gainOf(started.at(-1)) > 0);
  audio.setVolume("seMute", true);
  assert.equal(gainOf(started.at(-1)), 0, "SE Mute silences the effect playing");
  assert.equal(audio.vol.master, undefined);
});

test("a voice's character comes from its file's first letters; a muted row does not play (UI-04)", async () => {
  const { audio, started, gainOf } = fakeAudio();
  audio.voices = { prefixes: { A00: 1, A10: 2, M00: 23 }, speakers: [262144, 1, 2, ...Array(20).fill(262144), 262144] };
  assert.equal(audio.characterOf("A00_01_00_0000_0"), 0);
  assert.equal(audio.characterOf("A10_02_00_0001_0"), 1);
  assert.equal(audio.characterOf("M00_xx"), -1, "speaker 23 never counts as heard (0x29300)");
  audio.setCharacter(1, { on: false });
  await audio.playVoice("A10_02_00_0001_0");
  assert.equal(started.length, 0);
  audio.setCharacter(1, { on: true, volume: 40 });
  await audio.playVoice("A10_02_00_0001_0");
  assert.equal(gainOf(started.at(-1)), 0.4);
});

// A VM with stand-ins: the text box records the window commands.
function vmWith(extra = {}) {
  const calls = [];
  const text = {
    pageParts: [], typing: false, intro: false, closed: false,
    clear() { this.pageParts = []; calls.push("clear"); }, setIntro() {}, setOpen() {},
    closeNow() { calls.push("CLO2"); }, closeQuick() { this.closed = true; calls.push("CLO3"); },
    fadeOut(ms) { calls.push(`CLO4:${ms}`); }, fadeIn(ms) { calls.push(`CLO5:${ms}`); },
  };
  const { audio } = fakeAudio();
  const vm = new VM({ gfx: {}, audio, text, ...extra });
  vm.script = { name: "T", ops: [], labels: { L: 5 } };
  vm.snapshot = () => ({ pc: vm.pc, script: 0, name: "T", logged: 0 });
  return { vm, calls, audio };
}

test("the window commands are four different things (VM-02)", () => {
  const { vm, calls } = vmWith();
  vm.op_CLO2(); vm.op_CLO3(); vm.op_CLO4("1000"); vm.op_CLO5("2000");
  assert.deepEqual(calls, ["CLO2", "CLO3", "CLO4:1000", "CLO5:2000"]);
  vm.skipPaced = false;   // a run that draws nothing; fast forward keeps the time and steps it 33 frames a frame (item 110)
  vm.skip = true;
  vm.op_CLO4("3000");
  assert.equal(calls.at(-1), "CLO4:0");
  vm.skipPaced = true;
  vm.op_CLO4("3000");
  assert.equal(calls.at(-1), "CLO4:3000");
  vm.stop();
});

test("ATSV makes a checkpoint, also while skipping, except with flag 8 (VM-01, S20)", () => {
  const { vm } = vmWith();
  vm.pc = 12;
  vm.op_ATSV("8");
  assert.equal(vm.savePoint, null);
  vm.op_ATSV();
  assert.equal(vm.savePoint.pc, 12);
  assert.equal(vm.savePoint.waiting, false);
  vm.skip = true; vm.pc = 20;
  vm.op_ATSV("1");
  assert.equal(vm.savePoint.pc, 20);   // only a load's silent run passes ATSV (0x146e638), not skipping
});

test("SELA asks Save Progress? only when F1118 is 0 (VM-01; skipping does not pass it, S31)", async () => {
  const asked = [];
  const { vm, calls } = vmWith({ onAskSave: async (q) => { asked.push(q); return true; } });
  vm.vars.F1118 = 1;
  await vm.op_SELA("_D000", "");
  assert.equal(asked.length, 0);
  vm.vars.F1118 = 0;
  await vm.op_SELA("_D000", "");
  assert.deepEqual(asked, ["Save Progress?"]);
  assert.equal(vm.vars.F000, 1);
  assert.equal(calls.at(-1), "CLO2");
  vm.skip = true;
  await vm.op_SELA("_D000", "");
  assert.equal(asked.length, 2);
});

test("WTSV does not wait (not a native command, S4); IFSC branches except in a gallery replay (VM-04)", async () => {
  const { vm, audio } = vmWith();
  audio.voiceDone = () => new Promise(() => {});
  assert.equal(vm.op_WTSV(), undefined);
  vm.pc = 0;
  vm.op_IFSC("", "L");
  assert.equal(vm.pc, 5);
  vm.pc = 0; vm.replay = true;
  vm.op_IFSC("", "L");
  assert.equal(vm.pc, 0);
});

test("XSTP .. XRSM lock the controls; RTM2 keeps the music; PGST is kept (VM-06, VM-07, VM-03)", () => {
  const locks = [];
  const { vm } = vmWith({ onLock: (on) => locks.push(on) });
  vm.op_XSTP();
  assert.equal(vm.locked, true);
  vm.waitResolve = () => { throw new Error("a locked game takes no clicks"); };
  vm.advance();
  vm.op_XRSM();
  assert.deepEqual(locks, [true, false]);
  vm.op_RTM2();
  assert.equal(vm.keepMusic, true);
  vm.op_PGST("210");
  assert.equal(vm.page, 210);
});

test("068 holds a sound effect back on the game clock; a skip lets it through (RA-07)", async () => {
  const { vm, audio } = vmWith();
  const played = [];
  audio.playSE = (ch, loop, name) => played.push(name);
  vm.op_SEPL("4", "0", "A", "`068:40");
  assert.deepEqual(played, []);
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(played, ["A"]);
  vm.op_SEPL("4", "0", "B", "`068:5000");
  vm.op_SEPL("4", "0", "C");
  assert.deepEqual(played, ["A", "C"], "the next command on the channel replaces the waiting one");
  vm.cancelDelayed();
});

test("message marks: @e goes on without a click, ^ is a new line, literal text is shown (VM-08)", () => {
  const { vm } = vmWith();
  vm.lines = ["", "First", "Second"];
  assert.deepEqual(vm.parseMessage("$1@k@e"), { ids: [1], text: "First", color: 0, edge: 0, noWait: false, noClick: true, glue: false, keep: true });
  // @k only at the end of the copy (it stops at @e / @n); @x anywhere puts the line on the previous row (T2, T9)
  assert.equal(vm.parseMessage("$1@k@e@n").keep, true);
  assert.equal(vm.parseMessage("$1").keep, false);
  assert.equal(vm.parseMessage("@x$2@n").glue, true);
  assert.equal(vm.parseMessage("$1^@n").text, "First^");   // the text parser breaks the row there, counting no letter
  assert.equal(plain(vm.parseMessage("$1^@n").text), "First\n");
  // the colour marks stay as runs (web-dev/tests/colours.test.mjs): red up to @r, then the message's own colour
  assert.equal(plain(vm.parseMessage("@c1$1^@r$2@c1").text), "First\nSecond");
  assert.equal(vm.parseMessage("こんにちは").text, "こんにちは");
});

test("[ber00] / [zap00] runs become one glyph strip each (RA-09)", () => {
  const parts = parseMarkup("\"[ber00][ber00][ber00]―!\"");
  assert.deepEqual(parts.filter((p) => p.glyph), [{ glyph: "ber", n: 3 }]);
  assert.equal(plain("[zap00][zap00]"), "――");
  const long = parseMarkup("[ber00]".repeat(25)).filter((p) => p.glyph);
  assert.deepEqual(long.map((p) => p.n), [21, 4]);
  // each letter fades in over one letter interval (0xc0684: min(front - i, 1)), T3
  assert.equal(charFadeMs(35), 35);
  assert.equal(charFadeMs(250), 250);
  assert.equal(charFadeMs(0), 0);
});

test("the title stage moves one step each time the title is entered (UI-10)", () => {
  const all = new Set([560, 383, 562]);
  let s = 0;
  const seen = [];
  for (let i = 0; i < 4; i++) { s = nextTitleStage(s, all); seen.push(s); }
  assert.deepEqual(seen, [1, 3, 5, 5]);
  assert.equal(nextTitleStage(2, all), 0);
  assert.equal(nextTitleStage(1, new Set([560])), 1);
});

test("the text box's window commands are not shadowed by its settings", () => {
  const box = new TextBox();
  for (const m of ["fadeIn", "fadeOut", "closeNow", "closeQuick", "beginMessage", "setWindow", "state", "setState", "tick"]) {
    assert.equal(typeof box[m], "function", m);
  }
  assert.equal(box.charFade, true);
});

test("the window fades by its rates frame by frame (CLO5 in, CLO4 out, a message on a faded window)", () => {
  const els = {};
  const fakeEl = () => ({ style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} }, textContent: "", querySelectorAll: () => [] });
  globalThis.document = { getElementById: (id) => (els[id] ||= fakeEl()) };
  const box = new TextBox();
  box.fadeIn(2000);                       // 1/120 a frame
  assert.equal(box.fade, 0);
  for (let i = 0; i < 60; i++) box.tick(1);
  assert.ok(Math.abs(box.fade - 0.5) < 1e-9);
  // picture and text show only in the upper half of the fade: g = panel x max(0, 2 (fade - 0.5)) (T1)
  assert.ok(Number(els.text.style.opacity) < 1e-9);
  assert.ok(Number(els.panel.style.opacity) < 1e-9);
  for (let i = 0; i < 30; i++) box.tick(1);   // fade 0.75: g 0.5, the picture at g x panel, the text at g x g
  assert.ok(Math.abs(Number(els.panel.style.opacity) - 0.5) < 1e-6);
  assert.ok(Math.abs(Number(els.text.style.opacity) - 0.25) < 1e-6);
  for (let i = 0; i < 30; i++) box.tick(1);
  for (let i = 0; i < 1; i++) box.tick(1);   // the 120th step can round just short of 1; the next one clamps
  assert.equal(box.fade, 1);
  assert.equal(box.rate, 0);
  box.fadeOut(1000);
  for (let i = 0; i < 61; i++) box.tick(1);
  assert.equal(box.fade, 0);
  box.beginMessage();                     // 18 frames back in
  for (let i = 0; i < 18; i++) box.tick(1);
  assert.ok(box.fade > 0.999);
  box.closeQuick();
  box.tick(2);
  assert.ok(Math.abs(box.panelAlpha - 0.47916668) < 1e-7);   // 0.26041666 a frame, twice the 16.667 / 128 window rate
  delete globalThis.document;
});

test("STBR numbers pick the native shaders (0x34dd70 -> 0xa2790), not table position n + 14", async () => {
  const { blendShader, SHADER } = await import("../../web/app/js/renderer.js");
  // The glows (IMG2228 and friends) are added, not drawn with add_alpha's unweighted colour.
  assert.equal(blendShader(11), SHADER.ps_add);
  assert.equal(blendShader(1), SHADER.ps_add);
  assert.equal(blendShader(23), SHADER.ps_screen);
  // Black vignettes soften the light, a black screen fades by subtraction, a white one dodges: none is a no-op.
  assert.equal(blendShader(24), SHADER.softlight);
  assert.equal(blendShader(10), SHADER.sub);
  assert.equal(blendShader(5), SHADER.dodge);
  assert.equal(blendShader(7), SHADER.ps_mul);
  assert.equal(blendShader(22), SHADER.overlay);
  assert.equal(blendShader(8), SHADER.noalpha);
  assert.equal(blendShader(29), SHADER.sub_noalpha);
  for (const n of [0, 2, 3, 27, 255]) assert.equal(blendShader(n), 0);
});

test("music numbers are 1-based: MPLY n plays stream n - 1 (0x6f0), and the Music Player rows name their own stream", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const { streamOf } = await import("../../web/app/js/audio.js");
  const table = { bgm: { 0: "MOON01_BGM01", 1: "MOON01_BGM02", 2: "MOON01_BGM03" } };
  assert.equal(streamOf(table, 1), "MOON01_BGM01");
  assert.equal(streamOf(table, 2), "MOON01_BGM02");    // the title music (0x8e1c0 plays 2)
  assert.equal(streamOf(table, 0), null);
  const gallery = new URL("../../web/assets/gallery.json", import.meta.url), system = new URL("../../web/assets/system.json", import.meta.url);
  const tables = new URL("../../web/assets/audio_tables.json", import.meta.url);
  if (!existsSync(gallery) || !existsSync(system) || !existsSync(tables)) return;   // generated files stay local
  const music = JSON.parse(readFileSync(gallery)).music, loops = JSON.parse(readFileSync(system)).musicLoops;
  const bgm = JSON.parse(readFileSync(tables));
  assert.equal(music.length, 95);
  for (const t of music) {
    assert.equal(t.stream, streamOf(bgm, t.music), t.title);
    const [a, b] = loops[t.stream];
    assert.ok(Math.abs(a - t.loopStart) <= 2 && Math.abs(b - t.loopEnd) <= 2, `${t.title}: loop of ${t.stream}`);
  }
  assert.equal(music[0].title, "Moon Princess: re");
  assert.equal(music[0].stream, "MOON01_BGM01");
});

test("Music Player rows unlock by any of their music numbers, and the songs by their movie or scene", async () => {
  const { musicUnlocked } = await import("../../web/app/js/unlocks.js");
  const state = (music = [], movies = [], started = []) => ({ unlocks: { music: new Set(music), movies: new Set(movies) }, flow: { started: new Set(started) } });
  const light = { music: 13, also: [14] };
  assert.equal(musicUnlocked(light, state([12])), false);
  assert.equal(musicUnlocked(light, state([14])), true);
  const seimeisen = { music: 80, also: [], movie: "op1_arc" };
  assert.equal(musicUnlocked(seimeisen, state([], ["op1_arc"])), true);
  assert.equal(musicUnlocked(seimeisen, state([], ["op2_ciel"])), false);
  const lost = { music: 82, also: [81], scene: 560 };
  assert.equal(musicUnlocked(lost, state([], [], [560])), true);
  assert.equal(musicUnlocked(lost, state()), false);
});

test("the touch ring grows to 48 (cubic out) and fades (quadratic in) over 0.5 s (0xe00, 0x1034)", async () => {
  const { rippleAt, RIPPLE } = await import("../../web/app/js/touchfx.js");
  assert.equal(RIPPLE.slots, 16);
  assert.deepEqual(rippleAt(0), { radius: 0, alpha: 1 });
  const mid = rippleAt(0.25);
  assert.ok(Math.abs(mid.radius - 48 * 0.875) < 1e-9);   // 1 - (1/2)^3
  assert.ok(Math.abs(mid.alpha - 0.75) < 1e-9);          // 1 - (1/2)^2
  assert.equal(rippleAt(0.5), null);
  assert.equal(rippleAt(-0.1), null);
});

test("FADS holds the last drawn frame until its transition starts (native 0xa4560 / 0xa46f0)", async () => {
  const seen = [];
  const gfx = {
    hold(on) { seen.push(`hold:${on}`); },
    load: async (name) => { seen.push(`load:${name}`); return { tex: {}, w: 1, h: 1 }; },
    beginFade(ms, rule) { seen.push(`begin:${Math.round(ms)}:${!!rule}`); },   // the level's own time: ms in frames of 16.666 (0x4b740)
  };
  const { vm } = vmWith({ gfx });
  vm.sleep = async () => {};
  await vm.op_FADS("2", "1200", "13");
  assert.deepEqual(seen, ["hold:true", "load:RULE_13", "begin:1200:true", "hold:false"]);
  seen.length = 0;
  await vm.op_FADS("1", "0", "0");
  assert.deepEqual(seen, ["hold:true", "hold:false"]);
});

test("FADS draws its rule only for type 2 (0x47dd0): type 0 with a rule is a crossfade", async () => {
  const seen = [];
  const gfx = {
    hold() {}, load: async (name) => { seen.push(`load:${name}`); return { tex: {}, w: 1, h: 1 }; },
    beginFade(ms, rule) { seen.push(`begin:${Math.round(ms)}:${!!rule}`); },
  };
  const { vm } = vmWith({ gfx });
  vm.sleep = async () => {};
  await vm.op_FADS("0", "200", "1");    // 02_00_ARC02_1D op 46
  assert.deepEqual(seen, ["begin:200:false"]);
  seen.length = 0;
  await vm.op_FADS("2", "800", "1");
  assert.deepEqual(seen, ["load:RULE_01", "begin:800:true"]);
});

test("FADS's fourth argument closes the text window for the transition (0x60610, config +0x63 = 1)", async () => {
  const { fadeClosesWindow } = await import("../../web/app/js/vm.js");
  assert.equal(fadeClosesWindow(undefined, 1000), false);   // needs config +0x63 = 0
  assert.equal(fadeClosesWindow(-1, 1000), false);
  assert.equal(fadeClosesWindow(0, 1000), false);
  assert.equal(fadeClosesWindow(1, 0), true);
  assert.equal(fadeClosesWindow(2, 700), true);
  assert.equal(fadeClosesWindow(2, 1), false);              // ms must be over 1
  assert.equal(fadeClosesWindow(2, 700, -0.05), false);     // a CLO4 / CLO5 fade is running
  const gfx = { hold() {}, load: async () => ({ tex: {}, w: 1, h: 1 }), beginFade() {} };
  const { vm } = vmWith({ gfx });
  vm.sleep = async () => {};
  await vm.op_FADS("0", "700", "0", "2");
  assert.equal(vm.text.closed, true);
  assert.equal(vm.vars.F1103, 1);
  // the text box: a closed window draws no text, its panel stays
  const nodes = { text: { style: {} }, panel: { style: {} } };
  globalThis.document = { getElementById: (id) => nodes[id] || null };
  const box = new TextBox();
  box.panelAlpha = 1; box.fade = 1; box.closed = false; box.render();
  assert.equal(nodes.text.style.opacity, "1");
  box.closeForFade();
  assert.equal(nodes.text.style.opacity, "0");
  // the picture's group is composited only while F1103 is 0 (0x391a0, L_3A6EC): it goes with the text (T1)
  assert.equal(nodes.panel.style.opacity, "0");
  box.beginMessage();   // the next message fades the window back in over 18 frames (0x6e0d0)
  assert.equal(box.closed, false);
  assert.equal(box.fade, 0);
  assert.ok(Math.abs(box.rate - 1 / 18) < 1e-12);
});

test("staged layers go on screen at the next wait, FANX does nothing (0x802c0 -> 0x5d3a0(0, 0); 0x77814)", async () => {
  const gfx = { hold() {}, load: async () => ({ tex: {}, w: 1, h: 1 }), tex: new Map() };
  const { vm } = vmWith({ gfx });
  const committed = [];
  vm.sleep = async () => { committed.push([...vm.layers.keys()].join(",")); };
  vm.script.ops = [["STCH", "4", "pic"], ["FANX", "1", "0", "0"], ["STCH", "5", "pic"], ["WTTM", "800", "1"], ["STCC", "4"], ["WTTM", "100", "1"]];
  vm.pc = 0; vm.running = true;
  const gen = vm.generation;
  vm.op_STCH("4", "pic"); vm.op_FANX("1", "0", "0");
  assert.equal(vm.layers.size, 0);       // FANX shows nothing
  assert.equal(vm.pending.size, 1);
  vm.pending.clear();
  await vm.loop(gen);
  assert.deepEqual(committed, ["4,5", "5"]);
});

test("fast forward gives a message three frames and an MSAD two (native 0x802c0, 0x81b30), a test jump and the smoke test none", async () => {
  const { vm } = vmWith();
  vm.skip = true;
  // the frames are the message's own (item 110): the wait at its end passes on the frame the game has seen the line typed
  let passed = false;
  const from = vm.ticks;
  const p = vm.ticksSince(from, 3).then(() => { passed = true; });
  vm.tick(); vm.tick();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(passed, false);   // two frames are not enough
  vm.tick();
  await p;
  assert.equal(passed, true);
  passed = false;
  vm.waitAdvance().then(() => { passed = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(passed, true);
  vm.skipUntil = 99;
  passed = false;
  const q = vm.waitAdvance().then(() => { passed = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(passed, true);
  await q;
  vm.skipUntil = 0; vm.skipPaced = false;
  passed = false;
  vm.waitAdvance().then(() => { passed = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(passed, true);
});

test("italics (U+E000 + ASCII) become italic text; the other special letters are the story font's, flipped", () => {
  const it = (s) => [...s].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xE000)).join("");
  const parts = parseMarkup(`I can't go anywhere. I ${it("can't")} go anywhere.`);
  assert.deepEqual(parts, [{ t: "I can't go anywhere. I ", i: false }, { t: "can't", i: true }, { t: " go anywhere.", i: false }]);
  assert.equal(plain(`a ${it("b!")}`), "a b!");
  // ".reh" in the mirrored set: the story font's letters in the stored order, each drawn flipped; plain text (the
  // backlog, save notes) reads it the right way round
  const mirrored = "";
  assert.deepEqual(parseMarkup(`I ${mirrored}`), [{ t: "I ", i: false }, { t: ".reh", i: false, m: true, it: true }]);   // bank 2: mirrored and italic
  assert.equal(plain(mirrored), "her.");
  assert.equal(plain(""), "hi.");   // the U+E080 set
  assert.equal(parseMarkup("")[0].it, false);   // bank 1: mirrored, upright
  const line = [..."over her."].reverse().map((c) => c === " " ? " " : String.fromCharCode(c.charCodeAt(0) + 0xE100)).join("");
  assert.equal(plain(`  ${line}`), "  over her.");
  // the archaic serif is its own calligraphic style (one run with its spaces), the upside-down letters flip top to bottom in reading order, the exponent is
  // superscript digits: all in the story font
  assert.deepEqual(parseMarkup(" "), [{ t: "In a", i: false, a: true }]);
  assert.deepEqual(parseMarkup(""), [{ t: "Shi", i: false, u: true }]);
  assert.equal(plain("10m"), "10⁻³⁵m");
  assert.deepEqual(parseMarkup("10m")[1], { t: "−35", i: false, s: true });   // drawn in <sup>
});
