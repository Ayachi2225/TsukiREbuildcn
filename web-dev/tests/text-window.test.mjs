// The text window and typing as native 0x391a0 / 0x81b30 / 0xc0684 draw them (FIX-CHECKLIST T1-T12). No browser needed:
// a small stand-in for the few DOM calls the text box makes.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };

const { TextBox, WINDOW_RATE, FAST_CLOSE_RATE, charFadeMs, letterAlpha, typedAt, dimAlpha, lineAlpha, parseMarkup, plain, NOTE } =
  await import("../../web/app/js/textbox.js");
const { VM } = await import("../../web/app/js/vm.js");

function node(tag) {
  return {
    tag, className: "", textContent: "", children: [], dataset: { dashFor: "" },
    style: { opacity: "", setProperty() {}, getPropertyValue: () => "set" },
    classList: {
      el: null,
      add(c) { const s = new Set(this.el.className.split(" ").filter(Boolean)); s.add(c); this.el.className = [...s].join(" "); },
      remove(c) { this.el.className = this.el.className.split(" ").filter((x) => x && x !== c).join(" "); },
      toggle(c, on) { if (on ?? !this.contains(c)) this.add(c); else this.remove(c); },
      contains(c) { return this.el.className.split(" ").includes(c); },
    },
    appendChild(c) { this.children.push(c); return c; },
    after() {},
    querySelectorAll(sel) {
      const want = sel.replace(/^\./, ""), out = [];
      const walk = (n) => { for (const c of n.children || []) { if ((c.className || "").split(" ").includes(want)) out.push(c); walk(c); } };
      walk(this);
      return out;
    },
  };
}
function dom() {
  const make = (tag) => { const n = node(tag); n.classList.el = n; return n; };
  const els = { text: make("div"), panel: make("div"), note: make("div") };
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    createElement: (tag) => make(tag),
    createTextNode: (t) => ({ tag: "#text", textContent: t }),
  };
  return els;
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const segs = (els) => els.text.querySelectorAll(".seg");

test("T1: the window picture and the page are composited at g = panel x max(0, 2 (fade - 0.5)) (0x391a0)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true);
    box.closed = false;
    box.render();
    assert.equal(els.panel.style.opacity, "1");
    assert.equal(els.text.style.opacity, "1");
    // CLO4 over 1000 ms (60 frames): both are gone halfway, where the old port still drew the picture at half
    box.fadeOut(1000);
    for (let i = 0; i < 15; i++) box.tick(1);       // fade 0.75: g 0.5
    near(Number(els.panel.style.opacity), 0.5);       // g x panel
    near(Number(els.text.style.opacity), 0.25);       // g x g
    for (let i = 0; i < 15; i++) box.tick(1);       // fade 0.5
    near(Number(els.panel.style.opacity), 0, 1e-6);
    near(Number(els.text.style.opacity), 0, 1e-6);
    // the panel's own opening counts twice: panel 0.5 at full fade draws the picture at 0.25, the text at 0.25
    box.fade = 1; box.rate = 0; box.panelAlpha = 0.5; box.render();
    near(Number(els.panel.style.opacity), 0.25);
    near(Number(els.text.style.opacity), 0.25);
    // balloons are drawn at 200/255 inside the group
    box.panelAlpha = 1; box.balloon = true; box.render();
    near(Number(els.panel.style.opacity), 200 / 255);
    box.balloon = false;
    // a closed window (F1103: CLO2, CLO3, FADS closing it) draws neither
    box.closeForFade();
    assert.equal(els.panel.style.opacity, "0");
    assert.equal(els.text.style.opacity, "0");
  } finally { delete globalThis.document; }
});

test("T2: earlier lines dim to 100/255 over speed x 1.2 frames while the window is fully shown; a click snaps them", () => {
  assert.equal(dimAlpha(0, 42), 1);
  near(dimAlpha(21, 42), 1 - 155 / 255 / 2);
  near(dimAlpha(-1, 42), 100 / 255);
  near(dimAlpha(5, 0), 100 / 255);            // speed 0: dim at the first frame counted
  assert.equal(dimAlpha(21, 42, 255), 1);     // a second balloon (F1111 >= 3) aims at 255
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.speed = 35;
    box.add("One.", { instant: true });
    box.add("Two.", { instant: true });
    const [one, two] = segs(els);
    assert.equal(box.lines[0].T, 42);           // the new line's 35 ms x 1.2
    box.tick(1);
    assert.equal(one.style.opacity, "1");       // the frame it starts: timer 0
    for (let i = 0; i < 21; i++) box.tick(1);
    near(Number(one.style.opacity), 1 - (155 / 255) * (21 / 42));
    for (let i = 0; i < 30; i++) box.tick(1);
    near(Number(one.style.opacity), 100 / 255);
    assert.equal(two.style.opacity, "");        // the current line is not dimmed
    // the timer waits while the window fades (only fade 1, F1103 0 counts)
    box.add("Three.", { instant: true });
    box.fade = 0.9;
    for (let i = 0; i < 10; i++) box.tick(1);
    assert.equal(box.lines[1].timer, 0);
    box.fade = 1;
    box.tick(1); box.tick(1);
    assert.equal(box.lines[1].timer, 2);
    // a click that finishes the typing takes every earlier line to its dim level at once (0x81b30's memset)
    box.finish(true);
    box.tick(1);
    near(Number(segs(els)[1].style.opacity), 100 / 255);
    // "Display whole text" keeps them bright
    box.setWhole(true); box.tick(1);
    assert.equal(segs(els)[0].style.opacity, "1");
  } finally { delete globalThis.document; }
});

test("T2: a line ending in @k keeps the state of the line that continues it", () => {
  const L = (timer, k = false, T = 42) => ({ timer, T, k, segs: [] });
  // bright while its continuation is the current line
  assert.equal(lineAlpha([L(-1, true), L(0)], 0), 1);
  // through a chain of @k lines to the current one
  assert.equal(lineAlpha([L(-1, true), L(-1, true), L(0)], 0), 1);
  // once the continuation is an earlier line itself, it follows that line's timer
  near(lineAlpha([L(-1, true), L(21), L(0)], 0), 1 - (155 / 255) / 2);
  near(lineAlpha([L(-1, true), L(-1), L(0)], 0), 100 / 255);
  // MSAD sets the line's @k (an empty MSAD with "@k@e" too); MSG starts a line with its own
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.add("First,", { instant: true, k: true });
    box.add("second.", { instant: true });
    assert.equal(box.lines[0].k, true);
    box.setKeep(true);
    assert.equal(box.lines[1].k, true);
    assert.equal(segs(els)[1].dataset.k, "1");
  } finally { delete globalThis.document; }
});

test("T2: Insta erasure (config +0x62) dims earlier lines at once; the VM takes it from the second text option", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.eraseAtOnce = true;
    box.add("One.", { instant: true });
    box.add("Two.", { instant: true });
    box.tick(1);
    near(Number(segs(els)[0].style.opacity), 100 / 255);
  } finally { delete globalThis.document; }
});

test("T3: each letter fades in over one letter interval; Insta display shows it whole; the setting is global", async () => {
  assert.equal(charFadeMs(35), 35);
  assert.equal(letterAlpha(0, 0, 10), 0);
  near(letterAlpha(0.5, 0, 10), 0.5);
  near(letterAlpha(1.5, 1, 10), 0.5);
  assert.equal(letterAlpha(1.5, 0, 10), 1);
  assert.equal(letterAlpha(0.2, 0, 10, 0, true), 1);   // Insta display
  assert.equal(letterAlpha(0, 0, 10, 0, true), 0);
  // the VM: "Text display" for read and unread text alike; the second option is the dimming's
  const text = { pageParts: [], speed: 0, beginMessage() {}, continueMessage() {}, setWhole() {}, log() {}, add: async () => {}, finish() {}, typing: false };
  const vm = new VM({ gfx: {}, audio: { voicePlaying: false, stopVoice() {} }, text });
  vm.lines = ["Read line."];
  vm.read = new Uint8Array(1); vm.read[0] = 1;
  vm.script = { name: "T", ops: [], labels: {}, wrap: new Map() };
  vm.startPendingVoice = () => {}; vm.preloadFrom = () => {};
  vm.afterWait = async () => {};
  vm.fadeUnread = false; vm.fadeRead = true;
  await vm.message("$0", false);
  assert.equal(text.charFade, false);       // read text follows "Text display" too
  assert.equal(text.eraseAtOnce, false);
  assert.equal(text.speed, vm.readSpeed);
  vm.fadeRead = false;
  await vm.message("$0", false);
  assert.equal(text.eraseAtOnce, true);
});

test("T4: typing waits until the window is fully open and no fade-in runs (0x81b30)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.speed = 35;
    box.beginMessage();                       // after a closed window: fade 0 -> 1 over 18 frames
    let done = false;
    box.add("Hello", {}).then(() => { done = true; });
    box.tick(1);                              // the first frame opens the window and gives the front its step; nothing is drawn yet,
    assert.equal(box.open, true);             // so nothing takes it back (TODO item 51: native frames, the first letter is there as the window fades in)
    near(box.run.front, (1000 / 60) / 35);
    for (let i = 0; i < 16; i++) box.tick(1);   // the panel is open after 8 frames, the fade-in still runs
    near(box.run.front, (1000 / 60) / 35);
    box.tick(1);                              // frame 18: the fade-in ends after the typing has looked (0x48ac0:
    assert.equal(box.rate, 0);                // 0x40ed0 -> 0x81b30, then 0x38d40)
    near(box.run.front, (1000 / 60) / 35);
    box.tick(1);                              // and typing goes on the next frame
    near(box.run.front, 2 * (1000 / 60) / 35);
    for (let i = 0; i < 20; i++) box.tick(1);
    assert.equal(box.typing, false);
    return new Promise((r) => setTimeout(r)).then(() => assert.equal(done, true));
  } finally { delete globalThis.document; }
});

test("T5: the window opens and closes at 16.667 / 128 a frame; CLO3 at twice that", () => {
  near(WINDOW_RATE, 0.13020833);
  near(FAST_CLOSE_RATE, 2 * WINDOW_RATE, 1e-7);
  const els = dom();
  try {
    const box = new TextBox();
    box.open = true;
    for (let i = 0; i < 7; i++) box.tick(1);
    assert.ok(box.panelAlpha < 1);
    box.tick(1);
    assert.equal(box.panelAlpha, 1);          // 7.7 frames
  } finally { delete globalThis.document; }
});

test("T6: F1104 hides only the window picture; the text keeps the window's own look", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.setIntro(true);
    assert.equal(els.panel.style.opacity, "0");
    assert.equal(els.text.style.opacity, "1");
    assert.equal(els.text.className, "");      // no typeface or box of its own
    assert.equal(typeof box.placePage, "undefined");
    box.setIntro(false);
    assert.equal(els.panel.style.opacity, "1");
    // the VM follows F1104 as the script sets it
    const vm = new VM({ gfx: {}, audio: {}, text: box });
    vm.setVar("F1104", 1);
    assert.equal(box.intro, true);
    vm.setVar("F1104", 0);
    assert.equal(box.intro, false);
  } finally { delete globalThis.document; }
});

test("T7: MSAD after a closed window clears F1103 only: no fade-in, no page clear (0x6e950)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true);
    box.add("Line one.", { instant: true });
    box.pagePending = true;
    box.closeQuick();                          // CLO3
    box.continueMessage();                     // MSAD
    assert.equal(box.closed, false);
    assert.equal(box.fade, 1);
    assert.equal(box.rate, 0);
    assert.equal(box.pageParts.length, 1);     // the page stays
    box.beginMessage();                        // MSG: the page goes and the window fades in
    assert.equal(box.pageParts.length, 0);
  } finally { delete globalThis.document; }
});

test("a page counter F823 below 1 clears the page on the next frame the panel is up (0x391a0 -> 0x53ab0)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    let f822 = 1, f823 = 1;
    box.pageCounter = () => [f822, f823];
    box.setOpen(true, true); box.closed = false;
    box.add("Whoa there.", { instant: true });
    box.tick(1);
    assert.equal(box.pageParts.length, 1);     // F823 1: the page stays
    // the click that ends the page, then the script's `WKST F823 eq 0`: gone on the next frame, window still up
    box.pagePending = true;
    f823 = 0;
    box.tick(1);
    assert.equal(box.pageParts.length, 0);
    assert.equal(els.text.textContent, "");
    assert.equal(box.pagePending, false);
    // QA_17 op 268-331: CLO3 with the page still there (F823 not yet 0), the panel down: nothing is cleared...
    box.add("Take a deep breath, boy.", { instant: true });
    f823 = 1;
    box.closeQuick();
    for (let i = 0; i < 8; i++) box.tick(1);
    assert.equal(box.panelAlpha, 0);
    f823 = 0;
    box.tick(1);
    assert.equal(box.pageParts.length, 1);
    // ... until CLO5 brings the panel back: the first frame clears it, before the fade lets any text show
    box.fadeIn(400);
    box.tick(1);
    assert.equal(box.pageParts.length, 0);
    assert.equal(els.text.style.opacity, "0");
    // a long frame that closes the panel in one step still clears the page the panel showed
    box.add("Another page.", { instant: true });
    f823 = 1;
    box.closeQuick();
    f823 = 0;
    box.tick(30);
    assert.equal(box.panelAlpha, 0);
    assert.equal(box.pageParts.length, 0);
    // outside the story's layout (F822 not 1) the counter is not looked at
    box.fadeIn(0);
    f822 = 0;
    box.add("Title text.", { instant: true });
    box.tick(1);
    assert.equal(box.pageParts.length, 1);
  } finally { delete globalThis.document; }
});

test("T8: @t types the two parts of a line side by side, done when the front reaches the mark (0xc0684)", () => {
  const parts = parseMarkup("\"Shut up!\"\n@t\"Be quiet, both!\"");
  assert.deepEqual(parts.filter((p) => p.split), [{ split: true, lf: 1 }]);   // the raw break before it counts (0xbdc2c)
  assert.deepEqual(parseMarkup("a ^@tb").filter((p) => p.split), [{ split: true, lf: 0 }]);   // ^ does not
  assert.equal(plain("Ab@tCd"), "AbCd");
  // 4 + 6 letters: the shorter first part keeps the pace, the second steps 4/6 a letter
  const n = 10, t = 4;
  near(letterAlpha(1, 0, n, t), 1);
  near(letterAlpha(1, t, n, t), 1);            // the second part starts with the first
  near(letterAlpha(2, t + 2, n, t), 2 - 2 * (4 / 6));
  assert.equal(typedAt(n, t), 4);
  assert.equal(typedAt(n, 0), 10);
  // the longer first part is spread: 6 + 4, the first steps 4/6
  near(letterAlpha(2, 3, 10, 6), 2 - 3 * (4 / 6));
  assert.equal(typedAt(10, 6), 6);
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.speed = 16.666668;                       // one letter a frame (the game's 16.666668 / speed)
    box.add("Ab@tCdEf", {});
    assert.equal(box.run.t, 2);
    box.tick(1);                                 // the frame the line is set: nothing of it yet (TODO item 51)
    box.tick(1); box.tick(1);                    // the front at 2: the mark is reached
    assert.equal(box.typing, true);
    box.tick(1);                                 // and the line counts as typed on the frame after
    assert.equal(box.typing, false);
    // 23613: the raw break puts t one past the second part's first letter, its opening quote, which comes in last
    box.add("\"Shut up, Shiki!\"\n@t\"Tohno-kun, be quiet!\"", {});
    assert.equal(box.run.n, 39);                 // 17 + 22 letters, the spaces among them
    assert.equal(box.run.t, 18);
    box.tick(1);                                 // the frame it is set
    box.tick(1); box.tick(1);
    assert.equal(box.run.chars[17].textContent, "\"");
    assert.equal(box.run.chars[17].classList.contains("on"), false);   // the quote waits for the front at 17
    assert.equal(box.run.chars[18].classList.contains("on"), true);    // "T" is already coming in
    for (let i = 0; i < 15; i++) box.tick(1);    // front 17
    assert.equal(box.run.chars[17].classList.contains("on"), false);
    box.tick(1);                                 // front 18 = t: all shown
    assert.equal(box.run.chars[17].classList.contains("on"), true);
    box.tick(1);                                 // typed on the frame after
    assert.equal(box.typing, false);
  } finally { delete globalThis.document; }
});

test("letters: spaces are typed like letters, line breaks are not; ^ breaks the row (native, measured)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.speed = 1000 / 60;                       // one letter a frame
    box.add("I walk.", {});
    assert.equal(box.run.n, 7);                  // "I walk." with its space: 7 intervals, as the game took 44 for 44
    box.add("it's\nalmost", {});
    assert.equal(box.run.n, 10);                 // the raw break is no letter: "a" one interval after "s"
    box.finish();
    box.add("Ask. ^Refuse.", { instant: true });
    const seg = segs(els).at(-1);
    const text = (n) => (n.children?.length ? n.children.map(text).join("") : n.textContent);
    assert.equal(text(seg), "Ask. \nRefuse.");  // a row break, not a "^"
    assert.equal(plain("Ask. ^Refuse."), "Ask. \nRefuse.");
  } finally { delete globalThis.document; }
});

test("T9: @x puts the line on the previous row, 2 units after its end (0xa8190)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.add("you're", { instant: true });
    box.add("not gonna ask?", { instant: true, glue: true });
    const kids = els.text.children;
    assert.equal(kids.filter((c) => c.tag === "#text").length, 0);   // no new row
    assert.ok(segs(els)[1].className.includes("glued"));
    assert.equal(box.lines.length, 2);         // a line of its own, which dims the one before
  } finally { delete globalThis.document; }
});

test("T10: F1110's note comes in at 1/36 a frame after 3,500 ms (16 a frame) and goes out the same way", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.noteOn = true;
    for (let i = 0; i < 218; i++) box.tick(1);
    assert.equal(box.noteAlpha, 0);
    box.tick(1);                                // 219 x 16 = 3,504
    near(box.noteAlpha, NOTE.rate);
    for (let i = 0; i < 40; i++) box.tick(1);
    assert.equal(box.noteAlpha, 1);
    assert.equal(els.note.style.display, "block");
    box.noteOn = false;                         // also drawn while the window is closed
    box.closed = true;
    box.tick(18);
    near(box.noteAlpha, 0.5);
    box.tick(18);
    assert.equal(box.noteAlpha, 0);
    assert.equal(box.noteWait, 0);
    assert.equal(els.note.style.display, "none");
    const vm = new VM({ gfx: {}, audio: {}, text: box });
    vm.setVar("F1110", 1);
    assert.equal(box.noteOn, true);
  } finally { delete globalThis.document; }
});

test("T12: SHAF leaves MSQK's shake alone (0x2e560 does not touch *(0xae05c0))", () => {
  const vm = new VM({ gfx: {}, audio: {}, text: {} });
  const shake = { kind: "text" };
  vm.gfx.textShake = shake;
  vm.op_SHAF();
  assert.equal(vm.gfx.textShake, shake);
});

test("T2/T6: a restored page keeps its lines, the earlier ones dim (0x813e0)", () => {
  const els = dom();
  try {
    const box = new TextBox();
    box.setOpen(true, true); box.closed = false;
    box.add("One.", { instant: true, k: false });
    box.add("Two,", { instant: true });
    box.add("three.", { instant: true, inline: true });
    const saved = box.lines.map((l) => l.segs.length);
    assert.deepEqual(saved, [1, 2]);
    // what a restore sees: the same segments with their line numbers
    const s = segs(els);
    box.lines = [];
    box.adoptPage();
    assert.deepEqual(box.lines.map((l) => l.segs.length), [1, 2]);
    assert.equal(box.lines[0].timer, -1);
    assert.equal(box.lines[1].timer, 0);
    assert.equal(s[1].dataset.line, s[2].dataset.line);
  } finally { delete globalThis.document; }
});
