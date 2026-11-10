// smoketest.js - runs every script at full speed without pictures or sound, to find errors. Open /smoketest.html.
import { FlowProgress } from "./flowchart-model.js";
import { Unlocks } from "./unlocks.js";

export async function run(vm, gfx, log) {
  gfx.load = () => Promise.resolve({ tex: null, w: 2, h: 2, nw: 2, nh: 2 });
  // Running every script must not count as the player having read them: progress stays in memory (the read marks too:
  // like the game, text passed while skipping is marked read).
  vm.saveGlobals = () => {};
  vm.saveRead = () => {};
  vm.saveReadSoon = () => {};
  vm.readBlocks = new Uint8Array(vm.readBlocks.length);
  vm.flow = new FlowProgress(null);
  vm.unlocks = new Unlocks(null);
  if (vm.gallery) vm.unlocks.install(vm.gallery);
  if (vm.flowChart) vm.flow.install(vm.flowChart);
  vm.skip = true;
  vm.skipPaced = false;
  vm.onChoice = async (list) => { vm.__choices = (vm.__choices || 0) + 1; return 0; };
  vm.audio.ctx = null;
  const problems = {};
  const note = (k, v) => { (problems[k] = problems[k] || new Set()).add(v); };
  const ow = console.warn; console.warn = (...a) => { note("warn", a.join(" ").slice(0, 80)); };
  const oe = console.error; console.error = (...a) => { note("error", a.map(String).join(" ").slice(0, 120)); };
  const names = vm.index.names;
  const stats = { scripts: 0, ops: 0, loops: 0 };
  const seen = new Set();
  for (let i = 0; i < names.length; i++) {
    stats.scripts++;
    vm.layers.clear(); vm.pending.clear(); vm.removed.clear();
    vm.vars = { F026: 1 };
    await vm.enter(i);
    let steps = 0;
    const start = vm.script;
    while (vm.script === start && vm.pc < vm.script.ops.length && steps < 200000) {
      const op = vm.script.ops[vm.pc++];
      steps++;
      const fn = vm[`op_${op[0]}`];
      if (!fn) { note("unknown op", op[0]); continue; }
      try {
        const r = fn.apply(vm, op.slice(1));
        if (r && r.then) await r;
      } catch (e) { note("error", `${names[i]} ${op[0]} ${e.message}`.slice(0, 120)); }
    }
    stats.ops += steps;
    if (steps >= 200000) { stats.loops++; note("endless", names[i]); }
    if (i % 50 === 0) log(`${i} / ${names.length}`);
  }
  console.warn = ow; console.error = oe;
  const out = { stats, choices: vm.__choices };
  for (const [k, v] of Object.entries(problems)) out[k] = [...v].slice(0, 40);
  return out;
}
