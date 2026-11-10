import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { grainSample, linesDone, linesSample, splitDone, splitSample, startLines, startSplit, stopLines, stopSplit } from "../../web/app/js/screenfx.js";
import { VM } from "../../web/app/js/vm.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test("the RGB split fades in over a second, swings its angle, and fades out after FADE 41", () => {
  const s = startSplit(0, 0, 0);
  near(splitSample(s, 0).alpha, 0);
  near(splitSample(s, 500).alpha, 30 / 60);
  near(splitSample(s, 2000).alpha, 1);
  // a level other than 0 starts it at full alpha (0x2e3e0)
  near(splitSample(startSplit(-90, 0, 0), 0).alpha, 1);
  near(splitSample(startSplit(-90, 0, 0), 0).gain, 165 / 255);
  // angle 30 degrees at the start: red moves right and up
  const a = splitSample(s, 0);
  assert.ok(a.dx > 0 && a.dy < 0);
  // twenty steps of six frames later the angle is -30
  const b = splitSample(s, 20 * 6 * 1000 / 60 + 1);
  assert.ok(b.dy > 0);
  const off = stopSplit(s, 2000);
  near(splitSample(off, 2500).alpha, 1 - 30 / 60);
  assert.ok(splitDone(off, 3100));
  assert.ok(!splitDone(s, 99999));
});

test("speed lines follow their preset, the same lines for the same moment, and fade with FCSP", () => {
  const presets = { 4: [[0, 640, 360, 600, 200, 300, 400, 255, 32]], 20: [[0, 428, 376, 175, 395, 25, 50, 0, 20], [200, 428, 376, 175, 395, 25, 50, 255, 20]] };
  const s = startLines(4, 0);
  assert.deepEqual(linesSample(s, presets, 10), []);   // the first batch comes after 2 whole frames (32 ms: N2-101)
  const a = linesSample(s, presets, 40), b = linesSample(s, presets, 40);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 150 && a.length <= 200);       // 300-400, halved below type 9
  for (const l of a) { assert.equal(l.x, 960); assert.equal(l.y, 540); assert.ok(l.radius >= 200 * 1.05 - 1e-9 && l.radius <= 600 * 1.05 + 1e-9); }
  assert.notDeepEqual(linesSample(s, presets, 40), linesSample(s, presets, 90));
  const t = startLines(20, 0);
  near(linesSample(t, presets, 100)[0].alpha, 0.5);    // halfway between the two phases
  const off = stopLines(s, 1000, 0);
  near(linesSample(off, presets, 500)[0].alpha, 0.5);
  assert.ok(linesDone(off, 1000));
  assert.equal(stopLines(s, 0, 0), null);
});

test("grain draws the static itself through the layer's shape, with no holes cut in the picture (0x35fc0, native frames 2026-11-09)", () => {
  const src = readFileSync(new URL("../../web/app/js/renderer.js", import.meta.url), "utf8");
  assert.match(src, /c\.rgb = working\(texture\(grain, fract\(p \* grainAt\.zw\)\)\.rgb\) \* mul \* c\.a;/);
  assert.doesNotMatch(src, /texture\(grain[^\n]*discard/);
});

test("grain turns between normal and mirrored across: every third frame, or every second from n = 3 (0x36014-0x360a0)", () => {
  const f = (n) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => grainSample(n, k * 1000 / 60 + 1)).map((g) => `${g.sx}${g.sy}`);
  assert.deepEqual(f(1), ["11", "11", "11", "11", "-11", "-11", "-11", "11"]);
  assert.deepEqual(f(11), ["11", "11", "-11", "-11", "11", "11", "-11", "-11"]);
  assert.equal(grainSample(2, 0).texture, "noisehd1");
  assert.equal(grainSample(11, 0).texture, "noisehd0");
});

function machine() {
  const node = { innerHTML: "", style: { top: "" } };
  globalThis.document = { getElementById: () => node };
  const text = { pageParts: [], typing: false, intro: false, clear() { this.pageParts = []; }, setIntro() {}, setOpen() {} };
  const audio = { snapshot: () => ({}), restore() {}, stopVoice() {} };
  const gfx = { load: async () => ({ tex: null, w: 100, h: 100 }), tex: new Map() };
  const vm = new VM({ gfx, text, audio });
  vm.script = { name: "synthetic", ops: [] };
  return vm;
}

test("the commands set their state, and saves keep it", async () => {
  const vm = machine();
  vm.op_STCH("1", "img0001");
  vm.op_STNS("1", "11");
  vm.op_STTR("1", "26");
  vm.op_STRA("1", "111");
  const l = vm.layerFor(1);
  assert.equal(l.grain, 11);
  assert.deepEqual(l.rule, { name: "RULE_26", flip: 0 });
  assert.equal(vm.hazes[1].next, 111);   // STRA's state; the picture is not on screen yet, so the commit brings it
  assert.equal(vm.hazes[1].n, 0);
  vm.op_STTR("1", "-1");
  assert.equal(l.rule, null);
  vm.op_FADE("40", "-90", "5");
  assert.equal(vm.gfx.split.level, -90);
  vm.op_FCLN("300", "400", "", "", "32", "8");
  assert.equal(vm.gfx.lines.type, 8);
  await vm.commit();
  assert.equal(vm.hazes[1].n, 111);
  const s = JSON.parse(JSON.stringify(vm.snapshot()));
  vm.op_FADE("41");
  vm.op_FCSP();
  assert.equal(vm.gfx.lines, null);
  vm.getScript = async () => vm.script;
  vm.loop = () => {};
  await vm.restore(s);
  assert.equal(vm.gfx.lines.type, 8);
  assert.equal(vm.gfx.split.end, null);
  assert.equal(vm.layers.get(1).grain, 11);
  assert.equal(vm.hazes[1].n, 111);
  assert.equal(vm.hazes[1].next, 111);
});

test("a speed line is a 960 x 2 strip of FocusLine drawn 1:1, longer for some presets, the scale carrying over (0x87150)", async () => {
  const { lineScale, linesSample } = await import("../../web/app/js/screenfx.js");
  assert.equal(lineScale(4, 0, 1 / 3), 1 / 3);
  assert.equal(lineScale(7, 20000, 1 / 3), 2 / 3);
  assert.equal(lineScale(8, 5000, 1 / 3), 1 / 6);
  assert.equal(lineScale(8, 30000, 1 / 3), 0.4);
  assert.equal(lineScale(8, 15000, 1 / 6), 1 / 6);      // no rule for this angle: the last scale stays
  assert.equal(lineScale(21, -100, 1 / 3), 0.4);
  assert.equal(lineScale(21, 100, 1 / 3), 1 / 3);
  const presets = { 18: [[0, 640, 360, 100, 200, 4, 5, 255, 100]] };   // 4 + rand() % 1 lines
  const lines = linesSample({ kind: "lines", type: 18, start: 0, end: null, fadeMs: 0 }, presets, 120);   // after the first batch's 6 frames
  assert.equal(lines.length, 4);
  for (const ln of lines) {
    assert.equal(ln.width, 2);
    assert.deepEqual([ln.u, ln.v], [850, 120]);
    assert.ok(Math.abs(ln.length - 960) < 1e-9 || Math.abs(ln.length - 960 * 0.43333 * 3) < 1e-9);
  }
});
