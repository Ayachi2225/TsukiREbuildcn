import test from "node:test";
import assert from "node:assert/strict";
import { VM } from "../../web/app/js/vm.js";

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

test("STEC keeps the preset, and a colour only for the silhouette preset", () => {
  const vm = machine();
  vm.op_STCH("1", "img0001");
  vm.op_STEC("1", "1", "0xEFAD4A");
  const l = vm.layerFor(1);
  assert.equal(l.effect, 1);
  assert.deepEqual(l.tint.map((v) => Math.round(v * 255)), [0xef, 0xad, 0x4a]);
  vm.op_STEC("1", "44");
  assert.equal(l.effect, 44);
  assert.equal(l.tint, null);
  vm.op_STEC("1", "99");   // not a preset: unchanged
  assert.equal(l.effect, 44);
  vm.op_STEC("1", "0");
  assert.equal(l.effect, 0);
});

test("SNX2 and SNX3 are brightness and contrast, not blur; SNX4 does nothing", () => {
  const vm = machine();
  vm.op_STCH("2", "img0001");
  vm.op_SNX2("2", "64");
  vm.op_SNX3("2", "88");
  const l = vm.layerFor(2);
  assert.equal(l.blurX, 0);
  assert.equal(l.blurY, 0);
  assert.ok(Math.abs(l.bright - (64 / 255 + 1)) < 1e-9);
  assert.ok(Math.abs(l.contrast - 1.88) < 1e-9);
  // SNX4 is not a native command (S2): the blur comes only from STCH / SCH2 args 9-10.
  vm.op_SNX4("2", "4", "6");
  assert.equal(l.blurX, 0);
  assert.equal(l.blurY, 0);
  vm.op_SCH2("2", "", "", "", "", "", "", "", "", "4", "6");
  assert.equal(vm.layerFor(2).blurX, 4);
  assert.equal(vm.layerFor(2).blurY, 6);
});

test("a new picture clears the colour; an expression change keeps it; saves keep it", async () => {
  const vm = machine();
  vm.op_STCH("3", "img0001");
  vm.op_STEC("3", "17");
  vm.op_SNX2("3", "20");
  // the scripts' expression changes name their source (argument 18), often the layer itself: 0x60840's copy branch
  vm.op_SCH2("3", "img0002", ...Array(16).fill(""), "3");
  assert.equal(vm.layerFor(3).effect, 17);
  assert.ok(vm.layerFor(3).bright > 1);
  // without a source 0x60840 starts STEC's colour and SNX2 / SNX3 again (listing 0x60fbc on)
  const bare = machine();
  bare.op_STCH("4", "img0001");
  bare.op_STEC("4", "17");
  bare.op_SNX2("4", "20");
  bare.op_SCH2("4", "img0002");
  assert.equal(bare.layerFor(4).effect, 0);
  assert.equal(bare.layerFor(4).bright, 1);
  await vm.commit();
  const s = JSON.parse(JSON.stringify(vm.snapshot()));
  vm.op_STCH("3", "img0003");
  assert.equal(vm.layerFor(3).effect, 0);
  assert.equal(vm.layerFor(3).bright, 1);
  vm.getScript = async () => vm.script;
  vm.loop = () => {};
  await vm.restore(s);
  assert.equal(vm.layers.get(3).effect, 17);
  assert.ok(vm.layers.get(3).bright > 1);
});

test("SHOK moves the layers 3 px across and 3.21 px down a unit, layer quakes 1 px and 0.80 px, MSQK the text 1.5 px", async () => {
  const { makeEffect, impactPixels, layerEffectPixels, textShakePixels, effectOffset } = await import("../../web/app/js/effects.js");
  const F = 1000 / 60;
  // SHOK 0 7 120 5 (0x2ef30: y x 480/720 view units, added twice by 0x34440; 1080/448 px a unit)
  const e = makeEffect("impact", [0, 7, 120, 5], 0);
  for (let t = 0; t < 600; t += F) {
    const [x, y] = impactPixels(e, t);
    assert.equal(x, 0);
    assert.ok(Math.abs(y - effectOffset(e, t)[1] * 2 * (480 / 720) * (1080 / 448)) < 1e-9);
  }
  assert.ok(Math.abs(impactPixels(makeEffect("impact", [10, 0, 120, 1], 0), 30)[0] - effectOffset(makeEffect("impact", [10, 0, 120, 1], 0), 30)[0] * 3) < 1e-9);
  assert.deepEqual(impactPixels(e, 600), [0, 0]);            // over after period x count
  // a layer's quake: a third of the amplitude in view units (0x34440)
  const q = { quake: makeEffect("quake", [6, 9, 0, -1], 0) };
  const [qx, qy] = effectOffset(q.quake, 100);
  const [px, py] = layerEffectPixels(q, 100);
  assert.ok(Math.abs(px - qx) < 1e-9 && Math.abs(py - qy * 1080 / 448 / 3) < 1e-9);
  assert.deepEqual(layerEffectPixels({}, 100), [0, 0]);
  // MSQK 300 5 5: within +-7.5 px, a new offset every frame, still after 300 ms
  const m = makeEffect("text", [300, 5, 5], 0);
  for (let t = 0; t < 300; t += F) for (const v of textShakePixels(m, t)) assert.ok(Math.abs(v) <= 7.5 + 1e-9);
  assert.notDeepEqual(effectOffset(m, 0), effectOffset(m, F));
  assert.deepEqual(textShakePixels(m, 300), [0, 0]);
  assert.ok(Math.abs(makeEffect("text", [], 0).duration - 1000) < 1e-6);        // 0x77790 'M' "SQK": ms defaults to 1000
  assert.ok(Math.abs(makeEffect("text", [20000, 5, 5], 0).duration - 1000) < 1e-6);   // 0x39110: over 10000 counts as 1000
});

test("STTR turns the layer's alpha into a wipe through the rule, dark parts first; its third argument flips the rule", async () => {
  const { ruleWipe } = await import("../../web/app/js/effects.js");
  for (const r of [0, 0.3, 0.7, 1]) { assert.equal(ruleWipe(r, 0), 0); assert.equal(ruleWipe(r, 1), 1); }
  assert.ok(ruleWipe(0.1, 0.4) > ruleWipe(0.9, 0.4));    // dark parts of the rule come in first
  assert.ok(ruleWipe(0.5, 0.3) < ruleWipe(0.5, 0.6));    // and more shows as the alpha rises
  const vm = machine();
  vm.op_STCH("22", "test");
  vm.op_STTR("22", "26", "1");
  assert.deepEqual(vm.layerFor(22).rule, { name: "RULE_26", flip: 1 });
  vm.op_STTR("22", "26");
  assert.equal(vm.layerFor(22).rule.flip, 0);
  vm.op_STTR("22", "-1");
  assert.equal(vm.layerFor(22).rule, null);
});
