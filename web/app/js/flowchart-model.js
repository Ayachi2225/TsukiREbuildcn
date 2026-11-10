// Native scene flags and authored chart rows. Global progress survives a load
// or rewind; the current path belongs to the restored play session.
//
// The engine keeps it in variables (native 0x92xxx): started scenes in G110 + n / 16 (RDST, 0x92630), completed ones
// in G300 + n / 16 (RDED, 0x92440), lines revealed for good in G400 + (f - 564) / 16 ("secondary" here), and for this
// play only the scenes on its path in F201 + n / 8 (RTST, 0x92770; "path"), the lines along it in F600 + (f - 564) / 8
// ("pathSecondary") and the current scene in F110 ("current").
const STORE = "tsuki.flow.v2";
const positive = (n) => Number.isInteger(n) && n > 0;

// The (from, to) pairs native 0x93d10 handles by hand before a JUMP marks its row (0x95790), as decoded from the
// listing (web/audit/function-map/flowchart-jump-special-cases.txt). Each entry: [pairs, rules]; the first rule whose
// condition holds applies: [condition, ret, calls, path, started, completed, lines]. A condition is a list of terms:
// ["p", n, v] the scene n is on the path (v 1) or not (0); ["F", k, op, v] variable Fk; ["c", op, v] the answer index of
// the last choice (*0xae0aa0, written by the selector 0x83e50). calls are 0x954b0(a, b): row a -> b lights its lines
// and b becomes the current scene; path / started / completed mark the virtual nodes (485, 498-530) the calls pass
// through; lines are global connector bits written directly. ret 1 means the JUMP itself marks nothing more (and the
// current scene stays as the calls left it).
const SPECIAL_JUMPS = [
  [[[24,371],[57,55],[68,67],[105,104],[105,204],[108,322],[127,126],[152,149],[202,98],[205,105],[250,257],[258,256],[270,523],[275,521],[276,521],[279,1196],[280,1196],[311,67],[371,24],[446,517],[447,517],[483,523],[518,279],[518,280],[905,523]], [[[],1,[],[],[],[],[]]]],
  [[[51,69]], [[[],1,[[51,519],[519,69]],[519],[519],[519],[959]]]],
  [[[52,312]], [[[],1,[[66,312]],[],[],[],[]]]],
  [[[55,58]], [[[["p",57,1]],1,[[57,58]],[],[],[],[]], [[["p",57,0]],0,[],[],[],[],[]]]],
  [[[66,52]], [[[["F",50,"!=",0]],1,[],[],[],[],[]], [[["F",50,"==",0]],0,[],[],[],[],[]]]],
  [[[66,53]], [[[],1,[[66,530],[530,53]],[530],[530],[530],[]]]],
  [[[67,66]], [[[["p",68,1]],1,[[68,66]],[],[],[],[]], [[["p",68,0],["p",311,1]],1,[[311,66]],[],[],[],[]], [[["p",68,0],["p",311,0]],0,[],[],[],[],[]]]],
  [[[69,311]], [[[],1,[[519,311]],[],[],[],[]]]],
  [[[98,203]], [[[],1,[[202,203]],[],[],[],[]]]],
  [[[101,102]], [[[["c","==",1]],1,[[101,502],[502,102]],[502],[502],[502],[]], [[["c","!=",1],["c","==",0]],1,[[101,501],[501,102]],[501],[501],[501],[]], [[["c","!=",1],["c","!=",0]],1,[[101,503],[503,102]],[503],[503],[503],[]]]],
  [[[104,107]], [[[["p",105,1]],1,[[105,107]],[],[],[],[]], [[["p",105,0]],0,[],[],[],[],[]]]],
  [[[126,129]], [[[["p",127,1]],1,[[127,129]],[],[],[],[]], [[["p",127,0]],0,[],[],[],[],[]]]],
  [[[136,137]], [[[],0,[],[],[],[],[734]]]],
  [[[149,341]], [[[["p",152,1]],1,[[152,341]],[],[],[],[]], [[["p",152,0]],0,[],[],[],[],[]]]],
  [[[166,342]], [[[["c","==",0]],1,[[166,504],[504,342]],[504],[504],[504],[]], [[["c","!=",0]],1,[[166,505],[505,342]],[505],[505],[505],[]]]],
  [[[169,323]], [[[["p",168,1]],1,[[168,323]],[],[],[],[]], [[["p",168,0]],0,[],[],[],[],[]]]],
  [[[172,11]], [[[],1,[[172,506],[506,11]],[506],[506],[506],[]]]],
  [[[181,184]], [[[["F",54,"==",0]],1,[[181,520]],[520],[520],[520],[]], [[["F",54,"!=",0]],1,[[181,520],[520,184]],[520],[520],[520],[962]]]],
  [[[184,314]], [[[],1,[[520,314]],[],[],[],[]]]],
  [[[204,207]], [[[["p",205,1]],1,[[205,207]],[],[],[],[]], [[["p",205,0]],0,[],[],[],[],[]]]],
  [[[213,215]], [[[],0,[],[],[],[],[837]]]],
  [[[221,222]], [[[["c","==",1]],1,[[221,510],[510,222]],[510],[510],[510],[]], [[["c","!=",1],["c","==",0]],1,[[221,509],[509,222]],[509],[509],[509],[]], [[["c","!=",1],["c","!=",0]],1,[[221,511],[511,222]],[511],[511],[511],[]]]],
  [[[234,235]], [[[],1,[[234,512],[512,235]],[512],[512],[512],[]]]],
  [[[234,236]], [[[],1,[[234,512],[512,236]],[512],[512],[512],[]]]],
  [[[251,252]], [[[],1,[[251,513],[513,252]],[513],[513],[513],[]]]],
  [[[251,253]], [[[],1,[[251,513],[513,253]],[513],[513],[513],[]]]],
  [[[251,254]], [[[],1,[[251,513],[513,254]],[513],[513],[513],[]]]],
  [[[251,325]], [[[],1,[[251,513],[513,325]],[513],[513],[513],[]]]],
  [[[251,326]], [[[],1,[[251,513],[513,326]],[513],[513],[513],[]]]],
  [[[256,259]], [[[["p",258,1]],1,[[258,259]],[],[],[],[]], [[["p",258,0]],0,[],[],[],[],[]]]],
  [[[261,262]], [[[],0,[],[],[],[],[1164]]]],
  [[[269,270]], [[[],1,[[269,514],[514,270]],[514],[514],[514],[905]]]],
  [[[269,483]], [[[],1,[[269,514],[514,483]],[514],[514],[514],[]]]],
  [[[274,275]], [[[],1,[[274,516],[516,275]],[516],[516],[516],[1163]]]],
  [[[274,276]], [[[],1,[[274,516],[516,276]],[516],[516],[516],[]]]],
  [[[277,279]], [[[],1,[[277,518],[518,279]],[518],[518],[518],[1161]]]],
  [[[277,280]], [[[],1,[[277,518],[518,280]],[518],[518],[518],[]]]],
  [[[278,279]], [[[],1,[[278,518],[518,279]],[518],[518],[518],[1161]]]],
  [[[278,280]], [[[],1,[[278,518],[518,280]],[518],[518],[518],[]]]],
  [[[312,493]], [[[],0,[],[],[],[],[1190]]]],
  [[[322,112]], [[[["p",108,1]],1,[[108,112]],[],[],[],[]], [[["p",108,0]],0,[],[],[],[],[]]]],
  [[[324,329]], [[[["p",272,1]],1,[],[],[],[],[]], [[["p",272,0]],0,[],[],[],[],[]]]],
  [[[329,274]], [[[["p",271,1]],1,[[271,274]],[],[],[],[]], [[["p",271,0],["p",272,1]],1,[[272,274]],[],[],[],[]], [[["p",271,0],["p",272,0]],0,[],[],[],[],[]]]],
  [[[331,330]], [[[],0,[],[],[522],[522],[1158]]]],
  [[[355,20]], [[[],0,[],[],[],[],[799]]]],
  [[[369,29]], [[[["c","==",1]],1,[[369,499],[499,29]],[499],[499],[499],[]], [[["c","!=",1],["c","==",0]],1,[[369,498],[498,29]],[498],[498],[498],[]], [[["c","!=",1],["c","!=",0]],1,[[369,500],[500,29]],[500],[500],[500],[]]]],
  [[[410,220]], [[[["c","==",0]],1,[[410,507],[507,220]],[507],[507],[507],[]], [[["c","!=",0]],1,[[410,508],[508,220]],[508],[508],[508],[]]]],
  [[[439,327]], [[[],0,[],[],[],[],[980]]]],
  [[[463,300]], [[[],1,[[463,525],[525,526],[526,300]],[525,526],[525,526],[525,526],[]]]],
  [[[478,330]], [[[],1,[[478,522],[522,330]],[522],[522],[522],[]]]],
  [[[478,331]], [[[],0,[],[],[],[],[1157]]]],
  [[[480,309]], [[[],1,[[480,524],[524,527],[527,309]],[524,527],[524,527],[524,527],[]]]],
  [[[486,1]], [[[],1,[[486,529],[529,1]],[529],[529],[529],[]]]],
  [[[517,277]], [[[["p",446,1]],1,[[446,517],[517,277]],[517],[517],[517],[]], [[["p",446,0]],1,[[447,517],[517,277]],[517],[517],[517],[]]]],
  [[[517,278]], [[[["p",446,1]],1,[[446,517],[517,278]],[517],[517],[517],[]], [[["p",446,0]],1,[[447,517],[517,278]],[517],[517],[517],[]]]],
  [[[521,446]], [[[["p",275,1]],1,[[275,521],[521,446]],[521],[521],[521],[1162]], [[["p",275,0]],1,[[276,521],[521,446]],[521],[521],[521],[]]]],
  [[[521,447]], [[[["p",275,1]],1,[[275,521],[521,447]],[521],[521],[521],[]], [[["p",275,0]],1,[[276,521],[521,447]],[521],[521],[521],[]]]],
  [[[523,271]], [[[["p",270,1]],1,[[270,523],[523,271]],[523],[523],[523],[]], [[["p",270,0]],1,[[483,523],[523,271]],[523],[523],[523],[]]]],
  [[[523,515]], [[[["p",270,1]],1,[[270,523],[523,515]],[515,523],[515,523],[515,523],[1166,1167]], [[["p",270,0]],1,[[483,523],[523,515]],[515,523],[515,523],[515,523],[]]]],
  [[[1196,281]], [[[["p",279,1]],1,[[279,281]],[],[],[],[]], [[["p",279,0]],1,[[280,281]],[],[],[],[]]]]
];
// Any other pair whose target is 486 (the prologue scene, 00_00) inserts the opening: 485 -> 528 -> 486.
const SPECIAL_DEFAULT = [[[],1,[[485,528],[528,486]],[485,528],[485,528],[485,528],[]]];
const SPECIAL = new Map();
for (const [pairs, rules] of SPECIAL_JUMPS) for (const [a, b] of pairs) SPECIAL.set(`${a}:${b}`, rules);

// SELD n (native 0x92a60): besides the choice's row of table 0x3594d0 (chart.choiceFlags), four choices are written
// by hand: [virtual node marked on the path, started and completed (and current in a gallery replay), lines always
// revealed, [scene, line] a further line revealed only while that scene is not on the path]. The scripts of choices 72
// and 73 run RTST 270 / 446 only when F069 is 1 (else 483 / 447), so 1168 / 1120 appear on the F069 = 0 side only.
export const SELD_EXTRA = { 57: [512, [865, 866]], 67: [513, [977, 978, 886, 887, 888]], 72: [523, [1167], [270, 1168]],
  73: [517, [1119], [446, 1120]] };

// The route flags a rewind from the in-game flowchart clears when the chosen row comes before the row (chart group)
// where the story sets them (native 0x95800): [variable, first group that keeps it].
export const ROUTE_FLAGS = [[69, 204], [65, 185], [66, 185], [67, 185], [68, 185], [64, 177], [63, 162], [62, 161],
  [61, 157], [60, 147], [73, 143], [72, 132], [74, 125], [59, 122], [58, 56], [57, 48], [56, 31], [55, 17], [54, 11]];
// What else such a rewind keeps of the story's variables (0x178c8 records them, the game is reset, 0x17af0 puts them
// back): these as they are, the chart's keep list (rewind.keep, 0x34ba16) as their low byte (sign-extended) and its
// flag list (rewind.flags, 0x34bc6e) as 0 or 1.
export const REWIND_FIXED = [0, 1, 2, 3, 4, 5, 6, 7, 8, 22, 859, 860, 861, 862, 863, 864, 865, 866, 867, 868, 869, 931, 932,
  933, 934, 935, 936, 937, 938, 939, 954, 964, 965, 966, 985, 991, 1122];
export const fvar = (n) => `F${String(n).padStart(3, "0")}`;

// Immediate dominators of the authored transition graph: for each flag, the last flag that every path from the
// start of the story to it passes through. Flags with no incoming transition hang off a virtual root, 0.
export function immediateDominators(transitions) {
  const preds = new Map(), nodes = new Set();
  for (const t of transitions) {
    nodes.add(t.from); nodes.add(t.to);
    if (!preds.has(t.to)) preds.set(t.to, new Set());
    preds.get(t.to).add(t.from);
  }
  const order = [...nodes];
  const dom = new Map([[0, new Set([0])]]);
  for (const n of order) dom.set(n, preds.has(n) ? null : new Set([0, n]));   // null: not computed yet (everything)
  for (let changed = true; changed;) {
    changed = false;
    for (const n of order) {
      if (!preds.has(n)) continue;
      let meet = null;
      for (const p of preds.get(n)) {
        const d = dom.get(p);
        if (!d) continue;
        meet = meet ? new Set([...meet].filter((x) => d.has(x))) : new Set(d);
      }
      if (!meet) continue;
      meet.add(n);
      const old = dom.get(n);
      if (!old || old.size !== meet.size || [...meet].some((x) => !old.has(x))) { dom.set(n, meet); changed = true; }
    }
  }
  const idom = new Map();
  for (const n of order) {
    const d = dom.get(n);
    if (!d) continue;
    let best = 0, size = -1;
    for (const x of d) if (x !== n && dom.get(x) && dom.get(x).size > size) { best = x; size = dom.get(x).size; }
    idom.set(n, best);
  }
  return idom;
}

export class FlowProgress {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(STORE) || "{}"); } catch { /* empty progress */ }
    this.started = new Set(saved.started || []);
    this.completed = new Set(saved.completed || []);
    this.secondary = new Set(saved.secondary || []);
    this.migrated = !!saved.migrated;
    this.endingsInferred = !!saved.endingsInferred;   // see endings.js
    this.path = new Set(); this.pathSecondary = new Set(); this.current = 0;
    this.transitions = new Map(); this.nodes = new Set();
  }
  save() {
    try { this.storage?.setItem(STORE, JSON.stringify({ started: [...this.started], completed: [...this.completed], secondary: [...this.secondary], migrated: this.migrated, endingsInferred: this.endingsInferred })); } catch { /* storage unavailable */ }
  }
  install(chart, isRead = () => false) {
    this.transitions.clear();
    for (const t of chart.transitions) this.transitions.set(`${t.from}:${t.to}`, t);
    const nodes = chart.groups.flatMap((g) => g.parts).filter((p) => p.flag > 0);
    this.nodes = new Set(nodes.map((p) => p.flag));
    if (!this.migrated) {
      for (const p of nodes) {
        const read = (p.lines || []).filter(isRead).length;
        if (read) this.started.add(p.flag);
        if (read && read === p.lines.length) this.completed.add(p.flag);
      }
      // Recover connection progress between already-read scenes, using only
      // authored transitions. This does not unlock unrelated story branches.
      for (const t of chart.transitions) if (this.completed.has(t.from) && this.started.has(t.to)) this.mark(t.from, t.to);
      this.migrated = true; this.current = 0; this.path.clear(); this.pathSecondary.clear(); this.save();
    }
    this.idom = immediateDominators(chart.transitions);
    this.infer();
  }
  // A scene reached only through others means those others were played: a save or older read history can reach
  // day 1 without this chart having seen the prologue. Every authored path to a started scene passes the scenes
  // on its dominator chain, so they count as read, with the links between them. Branches are never guessed.
  infer() {
    if (!this.idom) return;
    let changed = false;
    for (const y of [...this.started, ...this.completed]) {
      for (let c = y, p = this.idom.get(c); p !== undefined && p !== 0; c = p, p = this.idom.get(c)) {
        const t = this.transitions.get(`${p}:${c}`);
        if (t) for (const n of t.global) if (!this.secondary.has(n)) { this.secondary.add(n); changed = true; }
        if (this.nodes.has(p) && !this.completed.has(p)) { this.completed.add(p); this.started.add(p); changed = true; }
      }
    }
    if (changed) this.save();
  }
  // RDST n (0x92630): the scene has been started, for good.
  start(n) { if (n >= 0 && n < 576) { this.started.add(n); this.save(); } }
  // RTST n (0x92770): the scene is on this play's path. It becomes the current scene only for the Ciel-sensei episodes
  // (533-557) or in a gallery replay (F024); in normal play the JUMP that led here set the current scene, and a script
  // that serves several scenes completes only that one.
  read(n, replay = false) {
    if (!(n >= 0 && n < 576)) return;
    this.path.add(n);
    if ((n >= 533 && n <= 557) || replay) this.current = n;
  }
  // RDED n (0x92440): completes the scene only when it is the current one and on the path. True when it did (the
  // command then ends a gallery replay).
  finish(n) {
    if (n >= 0 && n < 576 && this.current === n && this.path.has(n)) { this.completed.add(n); this.save(); return true; }
    return false;
  }
  // 0x954b0(a, b): the authored row a -> b reveals its lines for good and along this play's path; b is current.
  mark(a, b) {
    const t = this.transitions.get(`${a}:${b}`);
    if (t) {
      for (const n of t.global) this.secondary.add(n);
      for (const n of t.current) this.pathSecondary.add(n);
    }
    this.current = b;
  }
  // A JUMP (0x95790): from is the running script's exit flag (0x92d00), to the target's entry flag (0x92d30). The
  // special cases of 0x93d10 come first; unless one says otherwise, a pair of real scenes (from 1-530, to >= 1) marks
  // its row and the target becomes current. Anything else leaves the current scene alone.
  // ctx.getVar reads the story's variables (F050, F054), ctx.lastChoice the last choice's answer index.
  jump(from, to, { getVar = () => 0, lastChoice = -1 } = {}) {
    const rules = SPECIAL.get(`${from}:${to}`) || (to === 486 ? SPECIAL_DEFAULT : null);
    let ret = 0;
    const holds = (c) => (c[0] === "p" ? this.path.has(c[1]) === !!c[2]
      : c[0] === "F" ? (c[2] === "==" ? (getVar(fvar(c[1])) || 0) === c[3] : (getVar(fvar(c[1])) || 0) !== c[3])
        : (c[1] === "==" ? lastChoice === c[2] : lastChoice !== c[2]));
    const rule = rules?.find(([cond]) => cond.every(holds));
    if (rule) {
      const [, r, calls, path, started, completed, lines] = rule;
      ret = r;
      for (const n of path) this.path.add(n);
      for (const n of started) this.started.add(n);
      for (const n of completed) this.completed.add(n);
      for (const n of lines) this.secondary.add(n);
      for (const [a, b] of calls) this.mark(a, b);
    }
    if (to >= 1 && !ret && from >= 1 && from <= 530) this.mark(from, to);
    this.save();
  }
  // SELD n (0x92a60): the choice's branches appear in the chart as soon as it is shown (flags: its row of 0x3594d0),
  // plus the hand-written extras of SELD_EXTRA.
  choice(n, flags, replay = false) {
    for (const f of flags || []) if (positive(f)) this.secondary.add(f);
    const extra = SELD_EXTRA[n];
    if (extra) {
      const [node, lines, cond] = extra;
      this.path.add(node); this.started.add(node); this.completed.add(node);
      if (replay) this.current = node;
      for (const f of lines) this.secondary.add(f);
      if (cond && !this.path.has(cond[0])) this.secondary.add(cond[1]);
    }
    this.save();
  }
  // Rewinding from the in-game flowchart (0x11a58) to a scene of chart group g: every row after it, from the last back
  // to g (stopping at a day-0 row), loses its scenes' path bits (0x92500) and its parts' path lines (0x92540).
  rewindPath(chart, g) {
    const groups = chart.groups;
    for (let i = groups.length - 1; i >= 0; i--) {
      const row = groups[i];
      if (row.index <= g || row.day < 1) break;
      for (const p of row.parts) {
        if (p.flag !== 0) this.path.delete(Math.abs(p.flag));
        if (p.secondary >= 0) this.pathSecondary.delete(p.secondary);
      }
    }
  }
  resetPath() { this.path.clear(); this.pathSecondary.clear(); this.current = 0; }
  snapshot() { return { path: [...this.path], secondary: [...this.pathSecondary], current: this.current }; }
  restore(s) {
    this.path = new Set(s?.path || []); this.pathSecondary = new Set(s?.secondary || []); this.current = s?.current || 0;
  }
}

// ---- the chart as the native builds it (0xfffc, cFlowchartScene) ------------------------------------------------------
// Progress bits as the chart reads them: completed (0x922c0), started (0x926b0), a line revealed for good (0x92300: lines
// 564-1267 only), and for this play the path (0x92340) and the lines along it (0x92380).
const FIRST_LINE = 564, LAST_LINE = 564 + 0x2bf, LAST_GROUP = 276;
function bits(progress) {
  return {
    C: (n) => n > 0 && progress.completed.has(n),
    S: (n) => n > 0 && progress.started.has(n),
    K: (s) => s >= FIRST_LINE && s <= LAST_LINE && progress.secondary.has(s),
    P: (n) => n > 0 && progress.path.has(n),
    PK: (s) => s >= FIRST_LINE && s <= LAST_LINE && progress.pathSecondary.has(s),
  };
}

// Which of the 277 authored rows are shown (0xfffc's filter). A part counts when its scene is completed or its line
// revealed; a row shows when it has more than one such part and one of them is "distinct", or exactly one that is
// distinct or alone in its row. A completed scene's part is distinct; a placeholder (negative flag) is distinct unless
// the authored row before has the same scene in that column (not completed: its negative; completed: either sign, and
// then the same part must repeat in that column through every later row of the day). The static parts lie in one
// array (0x337660), so reading the column one past a row's end gives the next row's first part, as the native does.
export function keptGroups(chart, progress) {
  const { C, K } = bits(progress);
  const groups = chart.groups, start = [], flat = [];
  for (const g of groups) { start.push(flat.length); flat.push(...g.parts); }
  const at = (i, j) => flat[start[i] + j];
  return groups.filter((g, i) => {
    let admitted = 0, distinct = 0;
    g.parts.forEach((p, j) => {
      if (!((p.flag > 0 && C(p.flag)) || K(p.secondary))) return;
      admitted++;
      if (p.flag > 0) { distinct++; return; }
      if (p.flag === 0) return;
      if (i === 0) { distinct++; return; }
      if (j > groups[i - 1].parts.length) { distinct++; return; }
      const q = at(i - 1, j);
      if (!C(-p.flag)) { if (q.flag + p.flag !== 0) distinct++; return; }
      if (Math.abs(q.flag) !== Math.abs(p.flag)) { distinct++; return; }
      if (i >= LAST_GROUP) return;
      for (let k = i + 1; k <= LAST_GROUP && k < groups.length; k++) {
        const h = groups[k];
        if (h.parts.length < j) { distinct++; return; }
        if (g.day < h.day) return;
        const r = at(k, j);
        if (!r || r.flag !== p.flag || r.secondary !== p.secondary) { distinct++; return; }
      }
    });
    return (distinct && admitted > 1) || (admitted === 1 && (distinct === 1 || g.parts.length === 1));
  });
}

// The chart (0xfffc): the kept rows 56 apart, a day starting 13 lower (8 to its separator, 5 more); per part, in order,
// its node (0x13fd4), its line piece (0x14824) and in the game its path piece (0x149b4). opts.game: the in-game
// flowchart (mode bit 0 clear, 0x1767c); the gallery's (0x7f38) draws no path and selects completed scenes.
//
// A node: a scene completed or with its line revealed, a placeholder (negative flag) with its line revealed while its
// scene is neither completed nor started (in the game also not on the path) and its piece is not 3; the thumbnail when
// completed, else flow_sam_non. Selectable: in the gallery the completed scenes, in the game the scenes on the path in
// days 1 on.
// A line piece (connectorRects 0-12; the path's 13-25, drawn in front): only for a revealed line (the path's: a line on
// the path or a part whose scene is on it); the authored junctions 5, 8, 10 and 11 are chosen again from the
// neighbours (0x14d10 / 0x14e94 / 0x15098 / 0x15218, the path's 0x158b0 / 0x15a98 / 0x15c9c / 0x15e80): up when the
// scene above is completed (on the path), left / right when that part drew its piece or is completed or revealed (on
// the path), down when this part's own scene is reached (0x16078); a placeholder's straight piece 3 only under a part
// that drew its piece and is a completed scene or a started placeholder. Piece 3 in a day's first row gets piece 0
// above it; pieces 4, 5, 9, 10 and 11 of a started placeholder get piece 1 below (0x153b8).
export function layoutChart(chart, progress, { game = false } = {}) {
  const { C, S, K, P, PK } = bits(progress);
  const L = chart.layout;
  const rows = keptGroups(chart, progress).map((g) => ({ index: g.index, day: g.day, parts: g.parts.map((p) => ({ ...p })) }));
  const last = rows.length - 1;
  const flat = [];
  rows.forEach((row, r) => { row.start = flat.length; row.parts.forEach((p, c) => { p.row = r; p.col = c; p.group = row.index; p.day = row.day; flat.push(p); }); });
  const part = (r, c) => (r >= 0 && r <= last && c >= 0 && c < rows[r].parts.length ? rows[r].parts[c] : null);
  const reached = (q) => !!q && (q.drawn || (q.flag >= 1 && C(q.flag)) || K(q.secondary));
  const pathReached = (q) => !!q && (q.pathMark || (q.flag >= 1 && P(q.flag)) || PK(q.secondary));
  const up = (c, r, path) => { const a = part(r - 1, c); return !!a && a.flag !== 0 && (path ? P : C)(Math.abs(a.flag)); };
  const self = (c, r, path) => {
    const q = part(r, c);
    if (!q || q.flag === 0) return false;
    if (path) return P(Math.abs(q.flag));
    return q.flag < 0 ? C(-q.flag) || r === last : C(q.flag) || K(q.secondary);
  };
  function choose(line, c, r, path) {
    const near = path ? pathReached : reached;
    const right = near(part(r, c + 1)), left = near(part(r, c - 1));
    if (line === 5) { if (!up(c, r, path)) return 4; const s = self(c, r, path); return right && !s ? 2 : !right && s ? 3 : 5; }
    if (line === 8) { if (!up(c, r, path)) return 7; return left && !right ? 6 : !left && right ? 2 : 8; }
    if (line === 10) { if (!up(c, r, path)) return 9; const s = self(c, r, path); return left && !s ? 6 : !left && s ? 3 : 10; }
    if (line === 11) { if (!self(c, r, path)) return 7; return left && !right ? 9 : !left && right ? 4 : 11; }
    return line;
  }
  const pieces = [];
  function emit(p, piece, path, first) {
    const base = path ? 13 : 0, k = piece < 26 ? piece : 12;
    pieces.push({ x: p.x, y: p.lineY, rect: base + k, path });
    if (k === 3 && first) pieces.push({ x: p.x, y: p.lineY - 13, rect: base, path });
    else if (k <= 11 && [4, 5, 9, 10, 11].includes(k) && p.flag < 0 && (S(-p.flag) || (path && P(-p.flag))))
      pieces.push({ x: p.x, y: p.lineY + 14, rect: base + 1, path });
  }
  function linePiece(p, first) {
    if (!K(p.secondary)) return false;
    let piece = p.line;
    if (piece === 3) {
      if (p.flag < 0) {
        const a = part(p.row - 1, p.col);
        if (!a || !a.drawn || (a.flag < 0 ? !S(-a.flag) : a.flag === 0 || !C(a.flag))) return false;
      }
    } else if ([5, 8, 10, 11].includes(piece)) piece = choose(piece, p.col, p.row, false);
    if (piece < 0) return false;
    emit(p, piece, false, first);
    return true;
  }
  function pathPiece(p, first) {
    if (!(p.pathMark || PK(p.secondary))) return false;
    let piece = p.line;
    if (piece === 3) {
      if (p.flag < 0) {
        const a = part(p.row - 1, p.col);
        if (!a || !a.pathMark || Math.abs(a.flag) < 1 || !P(Math.abs(a.flag))) return true;
      }
    } else if ([5, 8, 10, 11].includes(piece)) piece = choose(piece, p.col, p.row, true);
    if (piece >= 0) emit(p, piece, true, first);
    return true;
  }
  function node(p) {
    if (p.flag === 0) return;
    if (!(p.flag > 0 ? C(p.flag) || K(p.secondary) : !C(-p.flag) && K(p.secondary))) return;
    if (p.flag < 0 && (S(-p.flag) || (game && P(-p.flag)) || p.line === 3)) return;
    if (game && p.flag > 0 && P(p.flag)) p.pathMark = true;
    p.node = p.flag > 0 && C(p.flag) ? "thumb" : "non";
    p.reg = p.flag > 0 && (game ? P(p.flag) && p.day > 0 : C(p.flag));
  }

  const labels = [], days = [], nodes = [], bands = [];
  let y = 0, titleY = 0, lastDay = 0, lastPhase = -1, titles = 0, day = null, bandTop = 0;
  // The day bands (0x13b54 / 0x13d04 / 0x14b58, z 460 and 450, x 0): at each day change, with sep = the row end + 8, the
  // band running since bandTop (0 for the first) ends: flow_sam_bg_middle_fullhd (texture 0x204, 1440 x 1) scaled to
  // sep - bandTop + 3 high; flow_sam_bg_under_fullhd (0x205) at sep and flow_sam_bg_upper_fullhd (0x206) at sep + 8, the
  // next band starting at sep + 10.
  const band = (to) => bands.push({ name: "flow_sam_bg_middle_fullhd", y: bandTop, h: to - bandTop + 3 });
  for (const row of rows) {
    const first = row.day !== lastDay;
    if (first) {
      const sep = y + 8;
      band(sep); bandTop = sep + 10;
      bands.push({ name: "flow_sam_bg_under_fullhd", y: sep, h: 5 }, { name: "flow_sam_bg_upper_fullhd", y: sep + 8, h: 5 });
      days.push({ edge: sep + 8 });   // the separator's second edge, which pushes the titles above up
      y += 13; titleY = y; lastDay = row.day; lastPhase = -1; titles = 0;
    }
    if (!day || day.day !== row.day) { day = { day: row.day, labels: [] }; labels.push(day); }
    row.y = y; row.first = first;
    for (const p of row.parts) {
      p.x = L.firstColumnX + p.col * L.columnPitch; p.y = y + L.rowNodeY; p.lineY = y + L.rowConnectorY;
      if (p.phase >= 0 && titles < 3 && lastPhase < p.phase && K(p.secondary)) {
        day.labels.push({ phase: p.phase, x: L.phaseTitleX, y: titleY + 8 });
        lastPhase = p.phase; titles++; titleY += 32;
        if (p.phase === 0) { day.labels.push({ phase: 28, x: L.phaseTitleX, y: titleY + 8 }); titleY += 32; titles++; lastPhase = 0; }
      }
      node(p);
      if (linePiece(p, first)) p.drawn = true;
      if (game && pathPiece(p, first)) p.pathMark = true;
      if (p.reg) nodes.push(p);
      p.jumpable = !!p.reg && Number.isInteger(p.script);
    }
    y += L.rowPitch;
  }
  // The titles of day slot d stop at the d-th separator's edge (0x11eb4 reads the separators' list by day number).
  for (const d of labels) d.limit = days[d.day]?.edge ?? null;
  // The chart's bottom: past the last row or the last day's titles, + 8. The last band ends there (0x13b54) with
  // flow_sam_bg_under_fullhd at it (0x14b58, which returns bottom + 56).
  const bottom = Math.max(titleY, y) + 8;
  band(bottom);
  bands.push({ name: "flow_sam_bg_under_fullhd", y: bottom, h: 5 });
  // The scroll's end (0xfffc's tail, from 0x14b58's bottom + 56): + 4 - 1022, less 28 while that stays within 1022, less
  // 56 more when the last row shown is the last authored one; the scroll bar shows only when it is above 0 (0x276b0).
  let max = bottom + 56 + 4 - 1022;
  if (max - 28 <= 1022) max -= 28;
  if (rows.length && rows[last].index === LAST_GROUP) max -= 56;
  return { rows, nodes, labels, pieces, bands, part, flatAt: (r, c) => (r >= 0 && r <= last ? flat[rows[r].start + c] ?? null : null), bottom, scrollMax: max, height: Math.max(bottom, 1022), game, bits: { C, K, P } };
}

// ---- moving the cursor (0x11418: Left 0x1262c, Right 0x1280c, Up 0x129f4, Down 0x12b68) -------------------------------
// at: { row, col } of the selection; each returns the new one or null (nothing moves). Only selectable nodes take it.
const reg = (L, r, c) => !!L.part(r, c)?.reg;
// The nearest selectable column of a row (0x1303c): the column itself, then +1, -1, +2, -2 ... up to 8; mode 0 keeps to
// the side of column 4 the column is on (0-3 or 4 on), mode 1 looks everywhere.
export function nearestColumn(L, r, c, mode = 0) {
  const n = L.rows[r]?.parts.length ?? 0, ok = (k) => k >= 0 && k < n && reg(L, r, k);
  if (c < n && ok(c)) return c;
  for (let d = 1; d <= 8; d++) {
    for (const k of [c + d, c - d]) if ((mode === 1 || (c > 3 ? k > 3 : k < 4)) && ok(k)) return k;
  }
  return -1;
}
// Left / Right: the nearest selectable node that way in the row; at its end one or two columns over in the row below,
// then above (below first; the last row looks above only); Right goes no further than column 8 / 9.
function sideways(L, at, dir) {
  const { row: r, col: c } = at, n = L.rows[r].parts.length;
  for (let k = c + dir; k >= 0 && k < n; k += dir) if (reg(L, r, k)) return { row: r, col: k };
  if (r < 1 && r >= L.rows.length - 1) return null;
  const tries = [];
  for (const step of [1, 2]) {
    const k = c + dir * step;
    if (k < 0 || (dir > 0 && c > 8 - step)) break;
    if (r < L.rows.length - 1) tries.push([r + 1, k]);
    if (r > 0) tries.push([r - 1, k]);
  }
  for (const [rr, k] of tries) if (reg(L, rr, k)) return { row: rr, col: k };
  return null;
}
// The gallery's Up / Down follow the authored line pieces (the static `line`, revealed lines only) to the completed scene
// they come from / lead to (0x12eac / 0x13854 up, 0x136d0 / 0x139f4 down), recursively and as the native's jump tables do.
function upFrom(L, c, r) {
  const { C, K } = L.bits;
  for (;;) {
    if (r < 0) return null;
    const p = L.part(r, c);
    if (!p || !K(p.secondary)) return null;
    const a = r >= 1 ? L.part(r - 1, c) : null;
    if (a && a.flag >= 1 && C(a.flag)) return { row: r - 1, col: c };
    switch (p.line) {
      case 2: case 5: case 8: { const u = upFrom(L, c + 1, r); if (u) return u; r--; continue; }
      case 3: r--; continue;
      case 4: case 7: c++; continue;
      case 6: return upFrom(L, c, r - 1) || upLeft(L, c - 1, r);
      case 9: return upLeft(L, c - 1, r);
      case 10: { const u = upLeft(L, c - 1, r); if (u) return u; r--; continue; }
      case 11: return upFrom(L, c + 1, r) || upLeft(L, c - 1, r);
      default: return null;
    }
  }
}
function upLeft(L, c, r) {
  const { C, K } = L.bits;
  if (c < 0) return null;
  for (;;) {
    const p = L.part(r, c);
    if (!p || !K(p.secondary)) return null;
    const a = r > 0 ? L.part(r - 1, c) : null;
    if (a && a.flag >= 1 && C(a.flag)) return { row: r - 1, col: c };
    switch (p.line) {
      case 2: case 3: case 5: return upFrom(L, c, r - 1);
      case 7: case 11: if (--c < 0) return null; continue;
      case 8: return upLeft(L, c - 1, r) || upFrom(L, c, r - 1);
      default: return null;
    }
  }
}
function downFrom(L, c, r) {
  const { C, K } = L.bits;
  for (;;) {
    const p = L.part(r, c);
    if (!p) return null;
    if (p.flag >= 1 && C(p.flag)) return { row: r, col: c };
    if (!K(p.secondary)) return null;
    switch (p.line) {
      case 2: case 7: c++; continue;
      case 3: case 9: r++; continue;
      case 4: if (p.flag < 0 && C(-p.flag)) c++; else r++; continue;
      case 5: case 11: { const d = downFrom(L, c + 1, r); if (d) return d; r++; continue; }
      case 6: case 8: return downLeft(L, c - 1, r);
      case 10: if (p.flag < 0 && C(-p.flag)) { r++; continue; } return downLeft(L, c - 1, r);
      default: return null;
    }
  }
}
// (0x139f4 does not check the column against the row's length: past its end it reads the next row's parts.)
function downLeft(L, c, r) {
  const { C, K } = L.bits;
  if (c < 0) return null;
  for (;;) {
    const p = L.flatAt(r, c);
    if (!p) return null;
    if (p.flag >= 1 && C(p.flag)) return { row: p.row, col: p.col };
    if (!K(p.secondary)) return null;
    if (p.line === 11) {
      const d = downLeft(L, c - 1, r);
      if (d) return d;
      if (p.flag < 0 && C(-p.flag)) { r++; continue; }
      return downFrom(L, c, r + 1);
    }
    switch (p.line) {
      case 3: case 4: case 5: return downFrom(L, c, r + 1);
      case 7: case 8: if (c < 1) return null; c--; continue;
      default: return null;
    }
  }
}
// Up / Down. In the game: the nearest row that way with a selectable node on the path, its first one (Up stops at day 0).
// In the gallery: the line from the selection up / down, else the nearest column of the next row (mode 0); Down then
// tries every later row with mode 1.
export function moveCursor(L, at, key) {
  if (!L.rows[at?.row]) return null;
  if (key === "left") return sideways(L, at, -1);
  if (key === "right") return sideways(L, at, 1);
  const last = L.rows.length - 1, { P } = L.bits;
  const first = (r) => { const c = L.rows[r].parts.findIndex((p) => p.flag > 0 && P(p.flag) && p.reg); return c < 0 ? null : { row: r, col: c }; };
  if (key === "up") {
    if (L.game) {
      for (let r = at.row - 1; r >= 0; r--) { if (L.rows[r].day === 0) break; const f = first(r); if (f) return f; }
      return null;
    }
    for (let r = at.row; r > 0;) {
      const u = upFrom(L, at.col, r);
      if (u) return u;
      r--;
      const c = nearestColumn(L, r, at.col, 0);
      if (c >= 0) return { row: r, col: c };
    }
    return null;
  }
  if (key === "down") {
    if (L.game) {
      for (let r = at.row + 1; r <= last; r++) { const f = first(r); if (f) return f; }
      return null;
    }
    for (let r = at.row; r < last;) {
      r++;
      const d = downFrom(L, at.col, r);
      if (d) return d;
      const c = nearestColumn(L, r, at.col, 0);
      if (c >= 0) return { row: r, col: c };
    }
    for (let r = at.row; r < last;) {
      r++;
      const c = nearestColumn(L, r, at.col, 1);
      if (c >= 0) return { row: r, col: c };
    }
    return null;
  }
  return null;
}

// Where the chart scrolls to show a new selection (0x10d5c): a node above y 2 brings the row above it to y 4, one below
// y 966 the row below it to 966 (the last row's own); within 2-966 nothing moves. The scroll stays within 0 and the
// scroll bar's end; a move eases there over 1/6 s, quadratic out (0x27bd4 type 2 mode 1), the opening at once.
export const FLOW_SCROLL_TIME = 1 / 6;
export function scrollFor(L, at, scroll) {
  const p = L.part(at.row, at.col);
  if (!p) return null;
  const y = p.y - scroll, last = L.rows.length - 1;
  let to;
  if (y < 2) to = L.part(Math.max(0, at.row - 1), 0)?.y ?? p.y;
  else if (y > 966) to = L.rows[Math.min(last, at.row + 1)].parts[0].y;
  else return null;
  const value = y < 2 ? to - 4 : to - 966;
  return Math.max(0, Math.min(Math.max(0, L.scrollMax), value));
}
// ---- the player's scroll (0x11418) ---------------------------------------------------------------------------------
// The first stick (input +0x1e, -128 ... 128 up, from the left stick: fcvtzs #7 of the axis in 0xb38f4) scrolls when no
// direction moves the cursor: past 80 its bit (0x10000 up / 0x40000 down) asks for the scroll + (40 - y) x 0.022727273 x
// 504 (up) or + (-40 - y) x 0.022727273 x 504 (down), truncated, eased there over 1/6 s (0x27bd4 from where the scroll
// is, quadratic out; full tilt: 1008 pixels). null: the stick asks for nothing.
export const STICK_DEAD = 80;
export function stickTarget(scroll, y) {
  const f = Math.fround, k = f(0.022727273);
  if (y > STICK_DEAD) return Math.trunc(f(scroll + f(f(f(y - 40) * -k) * 504)));
  if (y < -STICK_DEAD) return Math.trunc(f(scroll + f(f(f(-40 - y) * k) * 504)));
  return null;
}
// The pad's directions, the sticks' included, reach the input only as pulses (0xb3a18): at the push, after 15 frames
// (+0x3ec) and then every 5 (+0x3e8), the count going down by the frames since the last poll, at most 2 (0xae0e30).
export class PadRepeat {
  constructor() { this.count = null; }
  // held: a direction is held this frame; frames: frames since the last poll. True on a pulse.
  step(held, frames = 1) {
    if (!held) { this.count = null; return false; }
    if (this.count === null) { this.count = 15; return true; }
    this.count -= Math.min(2, Math.max(0, Math.round(frames)));
    if (this.count > 0) return false;
    this.count = 5;
    return true;
  }
}
// A drag on the touch screen (0x40c, set up by 0x11418 over x 0-1360, y 0-1022 with 0x6a0): its velocity, in the touch
// screen's 1280 x 720 pixels, is the largest -dy of the drag (a move down by dy makes it -dy or less, a move up -dy or
// more); every frame it is multiplied by 0.9 first and dropped below 0.5. While it is not 0 the chart eases to the
// scroll + 6 x velocity over 1/6 s (0x11418 -> 0x6c4), also after the release: it coasts.
export class DragFlick {
  constructor() { this.v = 0; this.last = null; }
  // y: the pointer's y in touch pixels this frame (null: not pressed). Returns the scroll's new target, or null.
  step(y, scroll) {
    if (Math.abs(this.v) > 1.1920929e-7) {
      this.v = Math.fround(this.v * Math.fround(0.9));
      if (Math.abs(this.v) < 0.5) this.v = 0;
    }
    if (y === null) this.last = null;
    else {
      if (this.last !== null) {
        const dy = y - this.last;
        if (dy >= 1 && this.v > -dy) this.v = -dy;
        else if (dy < 0 && this.v < -dy) this.v = -dy;
      }
      this.last = y;
    }
    const d = Math.fround(this.v * 6);
    return Math.abs(d) > 1.1920929e-7 ? Math.trunc(d + scroll) : null;
  }
}

// After a scroll by the player (stick, wheel, scroll bar: 0x11418 -> 0x12d1c), the selection moves to a node in view:
// from its row down to the first row whose nearest node (0x1303c mode 0, else 1, the column carried along) is at
// y 4 or below, then from there up to one above y 994. null: the selection's row is still the one.
export function reselect(L, at, scroll) {
  const last = L.rows.length - 1;
  let r = at.row, c = at.col;
  const look = (rr) => { let k = nearestColumn(L, rr, c, 0); if (k < 0) k = nearestColumn(L, rr, c, 1); return k; };
  if (r < last) {
    for (;;) {
      const k = look(r);
      if (k >= 0) { c = k; if (L.part(r, k).y - scroll >= 4) break; }
      if (++r >= last) break;
    }
  }
  if (r > 0) {
    for (;;) {
      const k = look(r);
      if (k >= 0) { c = k; if (L.part(r, k).y - scroll < 994) break; }
      if (--r < 1) break;
    }
  }
  return r === at.row ? null : { row: r, col: c };
}

// A preview title stays on its one row (the 400 x 48 box, 0x16e00). The patch fitted them to the game's 33 fixed-width
// cells. All of them fit in Helvetica; a wider fallback face is set just small enough to fit.
export const titleSize = (width, box = 400, size = 24) => (width > box ? (size * box) / width : size);
