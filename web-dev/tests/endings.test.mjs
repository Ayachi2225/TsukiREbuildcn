import test from "node:test";
import assert from "node:assert/strict";
import { FlowProgress } from "../../web/app/js/flowchart-model.js";
import { allEpisodesDone, endingList, inferEndings, FIRST_EPISODE, FINAL_EPISODE } from "../../web/app/js/endings.js";
import { VM } from "../../web/app/js/vm.js";

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
// The native table's shape: three main endings, the bad ends, then the completion episode.
const table = [
  { kind: "main", scene: 544, from: [14], lines: [900] },
  { kind: "main", scene: 555, from: [300], lines: [901] },
  { kind: "main", scene: 556, from: [309], lines: [902] },
  ...[533, 534, 535, 536, 537, 538, 539, 540, 541].map((scene, k) => ({ kind: "bad", scene, from: [100 + k], lines: [800 + k] })),
  { kind: "final", scene: 557, from: [], lines: [999], label: "LBL_COMPOK" },
];

test("an ending is seen once its Ciel-sensei episode has started, and bad ends fill rows of eight", () => {
  const flow = new FlowProgress(memory());
  flow.start(534);
  flow.start(555);
  const list = endingList(table, flow);
  assert.deepEqual(list.main.map((e) => e.seen), [false, true, false]);
  assert.equal(list.bad.filter((e) => e.seen).length, 1);
  const second = list.bad.find((e) => e.scene === 534);
  assert.deepEqual([second.seen, second.column, second.row], [true, 1, 0]);
  const ninth = list.bad[8];
  assert.deepEqual([ninth.column, ninth.row], [0, 1]);
  assert.equal(list.final.offered, false);
});

test("the final episode is offered only when episodes 1-24 are complete", () => {
  const flow = new FlowProgress(memory());
  for (let s = FIRST_EPISODE; s < FINAL_EPISODE - 1; s++) flow.completed.add(s);
  assert.equal(allEpisodesDone(flow), false);
  flow.completed.add(FINAL_EPISODE - 1);
  assert.equal(allEpisodesDone(flow), true);
  assert.equal(endingList(table, flow).final.offered, true);
});

test("progress from before the episodes ran is inferred once, from the bad end's scene or the episode's text", () => {
  const storage = memory();
  const flow = new FlowProgress(storage);
  flow.completed.add(101);   // the bad end that leads to scene 534
  const read = new Set([902]);   // a line of the episode for scene 556
  assert.equal(inferEndings(flow, table, (i) => read.has(i)), true);
  assert.ok(flow.started.has(534) && flow.started.has(556));
  assert.ok(!flow.started.has(533) && !flow.started.has(544));
  const saved = JSON.parse(storage.getItem("tsuki.flow.v2"));
  assert.equal(saved.endingsInferred, true);
  assert.ok(saved.started.includes(534));
  // Afterwards only the native rule counts: reaching a bad end and declining its episode leaves it out.
  const again = new FlowProgress(storage);
  again.completed.add(100);
  assert.equal(inferEndings(again, table), false);
  assert.ok(!again.started.has(533));
});

// A VM with nothing to draw: enough to run flow commands.
function bareVM(ops, labels = {}, extra = {}) {
  const vm = new VM({ gfx: {}, audio: {}, text: {}, ...extra });
  vm.flow = new FlowProgress(memory());
  vm.script = { name: "T", ops, labels };
  vm.remember = () => {};
  return vm;
}

test("IFUR 1 goes to its label only when every episode is complete", () => {
  const vm = bareVM([], { COMP_CHECK_OK: 4 });
  vm.pc = 3;
  vm.op_IFUR("1", "COMP_CHECK_OK", "LV00000");
  assert.equal(vm.pc, 3);
  for (let s = FIRST_EPISODE; s < FINAL_EPISODE; s++) vm.flow.completed.add(s);
  vm.op_IFUR("1", "COMP_CHECK_OK", "LV00000");
  assert.equal(vm.pc, 4);
});

test("RTM_ and RTMN end the script; RTM2 goes on", () => {
  const vm = bareVM([["RTM_"], ["WTTM", "3000"], ["END_"]]);
  vm.pc = 1;
  vm.op_RTM2();
  assert.equal(vm.pc, 1);
  vm.op_RTM_();
  assert.equal(vm.pc, 3);
  vm.pc = 1;
  vm.op_RTMN();
  assert.equal(vm.pc, 3);
});

test("SELS asks the hint-corner question for F027 and stores yes as 1", async () => {
  const asked = [];
  const vm = bareVM([["SELS", "_D000", ""]], {}, { onConfirm: async (q) => { asked.push(q); return true; } });
  vm.gallery = { endings: { hint: ["", "Enter hint corner (No. 1)?", "Enter hint corner (No. 2)?"] } };
  vm.vars.F027 = 2;
  vm.choices = ["left over from a restore"];
  vm.pc = 1;
  const pending = vm.op_SELS("_D000");
  assert.equal(vm.choosing.pc, 0);   // a save made now asks again
  await pending;
  assert.deepEqual(asked, ["Enter hint corner (No. 2)?"]);
  assert.equal(vm.vars._D000, 1);
  assert.equal(vm.choosing, null);
  assert.deepEqual(vm.choices, []);
  vm.onConfirm = async () => false;
  await vm.op_SELS("_D000");
  assert.equal(vm.vars._D000, 0);
});

test("WTTM ends on a click unless its second argument is 1", async () => {
  const vm = bareVM([]);
  const clicked = vm.op_WTTM("300000", "0");
  vm.advance();
  await clicked;   // would take five minutes otherwise
  const fixed = vm.op_WTTM("40", "1");
  vm.advance();
  assert.ok(!vm.clickWait);
  const t = Date.now();
  await fixed;
  assert.ok(Date.now() - t >= 30);
});
