// Checks for TODO item 51 (2026-11-09): 25 text and script fixes compared with native runs of the PC build. What the game turned
// out to do otherwise is pinned here with the numbers measured on its frames (web-dev/audit/FIXES.md, "TODO item 51").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };

const textbox = await import("../../web/app/js/textbox.js");
const { ChoiceFx } = await import("../../web/app/js/uifx.js");
const source = (name) => readFileSync(new URL(`../../web/app/${name}`, import.meta.url), "utf8");

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
// A text box on a window that is up, typing at `speed` ms a letter with "Insta display" (the reference save's setting).
function shownBox(speed) {
  const box = new textbox.TextBox();
  box.setOpen(true, true); box.closed = false; box.speed = speed; box.charFade = false;
  return box;
}
const on = (box, i) => box.run.chars[i].classList.contains("on");
// The frame (1 = the frame the line is set) each letter first shows on, and the frame the line counts as typed.
function typeOut(box, limit = 2000) {
  const first = [];
  let typed = null;
  const chars = box.run.chars;
  for (let f = 1; f <= limit && typed === null; f++) {
    box.tick(1);
    chars.forEach((c, i) => { if (first[i] === undefined && c.classList.contains("on")) first[i] = f; });
    if (!box.typing) typed = f;
  }
  return { first, typed };
}

test("Item 51, N2-115: a line set by MSG on a window that is up shows its first letter one frame later, and the letters keep the game's pace", () => {
  textDom();
  try {
    // native frames at 250 ms a letter (15 frames): the line before dims on frame D; letters on D + 1, D + 16, D + 31, D + 46 by the game's
    // single-precision steps; the mark, or an @e line's next command, 77 frames after D for four letters
    const box = shownBox(250);
    box.add("EFGH", {});
    const { first, typed } = typeOut(box);
    assert.deepEqual(first, [2, 17, 31, 47]);                  // frame 1 is D: 1, 16, 30 (float32: thirty steps of 1/15 are just past 2), 46 frames after it
    assert.equal(typed, 78);                                   // the front reaches 5 on frame 77 (76 steps), typed on the frame after
  } finally { delete globalThis.document; }
});

test("Item 51: the front is kept as the game keeps it (16.666668 / speed added in single precision each frame)", () => {
  let f = 0;
  for (let i = 0; i < 15; i++) f = textbox.advanceFront(f, 1, 250);
  assert.equal(f, Math.fround(f));
  assert.ok(f <= 1, "fifteen steps at 250 ms do not pass letter 1");
  assert.ok(textbox.advanceFront(f, 1, 250) > 1);
  assert.equal(textbox.advanceFront(0, 1, 0), 768);            // speed 0: the whole text
  assert.ok(Math.abs(textbox.advanceFront(0, 0.5, 100) - 1 / 12) < 1e-9);   // a part of a frame goes in as it is
  assert.equal(textbox.typingEnd(4), 5);
  assert.equal(textbox.typingEnd(10, 4), 4);                   // an @t line ends at its mark
});

test("Item 51: a line's typing ends a letter past its last letter and counts on the frame after (the mark, the auto wait, the next command)", () => {
  textDom();
  try {
    const box = shownBox(16.666668);                           // a letter a frame
    let done = false;
    box.add("Abcd", {}).then(() => { done = true; });
    box.tick(1);                                               // set: nothing shown
    for (let i = 0; i < 4; i++) box.tick(1);                   // the front at 4: every letter out
    assert.ok([0, 1, 2, 3].every((i) => on(box, i)));
    assert.equal(box.typing, true, "not typed yet: the front has a letter to go");
    box.tick(1);                                               // the front at 5 = n + 1
    assert.equal(box.typing, true);
    box.tick(1);                                               // the frame after
    assert.equal(box.typing, false);
    return new Promise((r) => setTimeout(r)).then(() => assert.equal(done, true));
  } finally { delete globalThis.document; }
});

test("Item 51: MSAD's text joins the line with the front a letter past the old end: its first two letters at once, the next a letter later", () => {
  textDom();
  try {
    const box = shownBox(250);
    box.add("EFGH", { k: true });
    box.finish();
    box.add("IJKL", { inline: true });
    const { first, typed } = typeOut(box);
    // native frames: I and J on the frame of the click, K 15 and L 30 frames on, read to a frame; the mark 61 frames after the click.
    // (The game's front stands at 5 here, the port's at 1: single-precision steps round differently at the two sizes, a frame at most.)
    assert.deepEqual(first.slice(0, 2), [1, 1]);
    assert.ok(Math.abs(first[2] - 16) <= 1 && Math.abs(first[3] - 31) <= 1, String(first));
    assert.ok(Math.abs(typed - 62) <= 1, String(typed));
    // a blank MSG's row has no letters before the MSAD: it types from the start
    box.clear();
    box.add("", {});
    box.add("Xy", { inline: true });
    assert.equal(box.run.front, 0);
  } finally { delete globalThis.document; }
});

test("Item 51: on a window still closed the first frame's step stays, so the first letter is there as the window fades in", () => {
  textDom();
  try {
    const box = new textbox.TextBox();
    box.speed = 250; box.charFade = false;
    box.beginMessage();
    box.add("ABCD", {});
    box.tick(1);                                               // D: the window opens, the front takes its step, nothing is drawn (fade 1/18)
    assert.ok(box.run.front > 0);
    box.tick(1);
    assert.equal(on(box, 0), true);                            // "Insta display": the letter is whole under the window's fade
    const f0 = box.run.front;
    for (let i = 0; i < 16; i++) box.tick(1);                  // the fade-in: the front waits
    assert.equal(box.run.front, f0);
    box.tick(1);                                               // frame D + 18: typing goes on
    assert.ok(box.run.front > f0);
    // native frames: the second letter 32 frames after D (the step of D, then fifteen more from D + 18)
    let n = 19;
    while (!on(box, 1)) { box.tick(1); n++; }
    assert.equal(n, 33);
  } finally { delete globalThis.document; }
});

test("Item 51: a press while a line types shows it whole at once; it counts as typed on the next frame", () => {
  textDom();
  try {
    const box = shownBox(250);
    let done = false;
    box.add("Abcdefgh", {}).then(() => { done = true; });
    box.tick(1); box.tick(1); box.tick(1);
    box.lines.unshift({ segs: [], timer: 5, T: 300, k: false });   // an earlier line still fading
    box.rush(true);
    assert.ok(box.run.chars.every((c) => c.classList.contains("on")));
    assert.equal(box.lines[0].timer, -1);                      // and the earlier lines go dim at once (0x81b30)
    assert.equal(box.typing, true);
    box.tick(1);
    assert.equal(box.typing, true);
    box.tick(1);
    assert.equal(box.typing, false);
    return new Promise((r) => setTimeout(r)).then(() => assert.equal(done, true));
  } finally { delete globalThis.document; }
});

test("Item 51, N2-120: a reading's letters come in by where they sit in the reading as written, padding included", () => {
  assert.deepEqual(textbox.rubyLetters("w o r l d   "), { text: "world", at: [0, 2, 4, 6, 8], len: 12 });
  assert.deepEqual(textbox.rubyLetters("T h e  s t a r s"), { text: "The stars", at: [0, 2, 4, 5, 7, 9, 11, 13, 15], len: 16 });
  assert.deepEqual(textbox.rubyLetters("prey"), { text: "prey", at: [0, 1, 2, 3], len: 4 });
  assert.equal(textbox.unspaceRuby("p r e y  "), "prey");
  // native frames at 100 ms a letter (6 frames): over "place" the "l" came 15 and the "d" 20 ticks after the "p": 6 x 5 x 6 / 12 and 6 x 5 x 8 / 12
  const from = 6, to = 11, L = 12;
  assert.ok(textbox.rubyAlpha(from + 2.5, from, to, L, 6) <= 1e-9 && textbox.rubyAlpha(from + 2.6, from, to, L, 6) > 0);
  assert.ok(textbox.rubyAlpha(from + 3.3, from, to, L, 8) <= 0 && textbox.rubyAlpha(from + 3.4, from, to, L, 8) > 0);
  textDom();
  try {
    const box = shownBox(16.666668);
    box.add("<place|w o r l d   >", {});
    const g = box.run.ruby[0];
    assert.deepEqual([g.at, g.len], [[0, 2, 4, 6, 8], 12]);
    box.tick(1); box.tick(1); box.tick(1);                     // the front at 2 of the base's 5: 2 / 5 x 12 = 4.8 of the reading
    assert.deepEqual(g.letters.map((c) => c.classList.contains("on")), [true, true, true, false, false]);
    assert.ok(Math.abs(Number(g.letters[2].style.opacity) - 0.8) < 1e-6);
    // typed over after a rewind: the positions come back from the page
    box.finish();
    box.retype();
    assert.deepEqual([box.run.ruby[0].at, box.run.ruby[0].len], [[0, 2, 4, 6, 8], 12]);
  } finally { delete globalThis.document; }
});

test("Item 51, N2-80: a choice's rows type at the read speed, two steps on the first frame, a letter out once the front is past it", () => {
  assert.match(source("js/ui.js"), /new ChoiceFx\(labels\.length, ChoiceFx\.perFrame\(this\.vm\.readSpeed\)/);
  // native frames at 60 ms a letter: "1" on the choice's first frame, "." two frames later, "W" (the fourth letter) nine, "a" thirteen
  const fx = new ChoiceFx(1, ChoiceFx.perFrame(60));
  const first = [];
  for (let f = 0; f < 20; f++) { fx.step(1, [28]); const n = fx.letters(0, 28); for (let k = 0; k < n; k++) first[k] ??= f; }
  assert.deepEqual([first[0], first[1], first[3], first[4]], [0, 2, 9, 13]);
  // the labels are whole from the first frame: only a taken choice fades them
  assert.match(source("js/ui.js"), /r\.row\.style\.opacity = String\(fx\.state === 4 \? fx\.alpha : 1\)/);
});

test("Item 51, N2-83: the instant run's end dims every line above the one it stops at, the line that was last on screen too", () => {
  textDom();
  try {
    const box = new textbox.TextBox();
    box.lines = [{ segs: [], timer: 3, T: 0 }, { segs: [], timer: 0, T: 0 }, { segs: [], timer: 0, T: 0 }];
    box.settleEarlier(3);                                      // F823 is 4 as the fourth line's MSG ends the run: lines 1-3
    assert.deepEqual(box.lines.map((l) => l.timer), [-1, -1, -1]);
    box.lines = [{ segs: [], timer: 3, T: 0 }, { segs: [], timer: 0, T: 0 }];
    box.settleEarlier(1);                                      // stopped on a line already on screen: the lines above it
    assert.deepEqual(box.lines.map((l) => l.timer), [-1, 0]);
  } finally { delete globalThis.document; }
  assert.match(source("js/vm.js"), /settleEarlier\?\.\(\(this\.getVar\("F823"\) \|\| 0\) - 1\)/);
});
