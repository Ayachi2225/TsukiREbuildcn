// Coloured text: the marks @c1-@c9 and @r as the engine's text object reads them (native 0xa7f60, 0xbdc2c, 0xc3c24;
// web-dev/audit/NATIVE-PARITY.md "Coloured text"). No browser or game data needed.
import test from "node:test";
import assert from "node:assert/strict";
import { colourMarks, parseMarkup, plain, TextBox } from "../../web/app/js/textbox.js";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };

test("marks before any text colour the whole message; the last one wins, @c6-@c9 are the outline", () => {
  assert.deepEqual(colourMarks("@c1Or rather, the situation is so bad"), { text: "Or rather, the situation is so bad", color: 1, edge: 0 });
  assert.deepEqual(colourMarks("@c4'Huh...?'"), { text: "'Huh...?'", color: 4, edge: 0 });
  assert.deepEqual(colourMarks("@c5 burn"), { text: " burn", color: 5, edge: 0 });
  assert.deepEqual(colourMarks("@c2@c1Text"), { text: "Text", color: 1, edge: 0 });
  // 05_01_CIEL05_1C command 487: the outline in dark grey, then colour 3
  assert.deepEqual(colourMarks("@c7@c3             A one-meter-long caterpillar."),
    { text: "             A one-meter-long caterpillar.", color: 3, edge: 7 });
  // spaces and U+3000 are not text yet, nor are other marks
  assert.equal(colourMarks("　 @gA@c1b").color, 0);
  assert.deepEqual(colourMarks(" 　@c1Text"), { text: " 　Text", color: 1, edge: 0 });
  // @r with no colour before it changes nothing
  assert.deepEqual(colourMarks("@r your ability to treat"), { text: " your ability to treat", color: 0, edge: 0 });
});

test("a colour after text, or @r after a colour, runs from its mark: the text keeps @c0-@c5 runs", () => {
  // 12_01_CIEL12_4 command 189: red up to @r, then the message's own colour; the closing @c1 colours nothing
  const r = colourMarks("@c1Has sunk so low.\n@rHas gone right back to normal again.@c1");
  assert.deepEqual(r, { text: "@c1Has sunk so low.\n@c0Has gone right back to normal again.@c1", color: 0, edge: 0 });
  assert.deepEqual(colourMarks("My body is already starting to@c5 burn"), { text: "My body is already starting to@c5 burn", color: 0, edge: 0 });
  // a bad digit after @c goes back to the message's own colour there
  assert.equal(colourMarks("A@c1b@cxc").text, "A@c1b@c0c");
});

test("parseMarkup carries the runs; plain() and the backlog drop them", () => {
  assert.deepEqual(parseMarkup("@c1Red\n@c0White"), [{ t: "Red\n", i: false, col: 1 }, { t: "White", i: false }]);
  assert.deepEqual(parseMarkup("a@c2<b|c>[ber00]"), [{ t: "a", i: false }, { base: "b", ruby: "c", col: 2, rubyItalic: false, rubyAt: [0], rubyLen: 1 }, { glyph: "ber", n: 1, col: 2 }]);
  assert.equal(plain("@c1Red\n@c0White@c1"), "Red\nWhite");
  assert.deepEqual(parseMarkup("plain"), [{ t: "plain", i: false }]);   // no mark, no col
});

test("VM.parseMessage reads the colour marks with the text (the script's argument and its lines)", async () => {
  const { VM } = await import("../../web/app/js/vm.js");
  const vm = new VM({ gfx: {}, audio: {}, text: { pageParts: [] } });
  vm.lines = ["Has sunk so low.", "Has gone right back to normal again.", "             A one-meter-long caterpillar.", "Or rather,"];
  vm.script = { name: "T", ops: [], labels: {} };
  const both = vm.parseMessage("@c1$000000^@r$000001@c1");
  assert.equal(both.color, 0);
  assert.equal(both.text, "@c1Has sunk so low.^@c0Has gone right back to normal again.@c1");   // ^ is parseMarkup's
  assert.deepEqual(vm.parseMessage("@c7@c3$000002"), { ids: [2], text: vm.lines[2], color: 3, edge: 7, noWait: false, noClick: false, glue: false, keep: false });
  assert.deepEqual(vm.parseMessage("@c1$000003"), { ids: [3], text: "Or rather,", color: 1, edge: 0, noWait: false, noClick: false, glue: false, keep: false });
  assert.equal(vm.parseMessage("@c5$000003@n").color, 5);
});

test("TextBox.add puts a colour that starts part way in its own span, and the outline on the message", () => {
  const node = (tag) => ({
    tag, className: "", textContent: "", children: [], style: { setProperty() {}, getPropertyValue: () => "set" }, dataset: { dashFor: "" },
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    appendChild(c) { this.children.push(c); return c; }, querySelectorAll: () => [],
  });
  const els = { text: node("div"), panel: node("div") };
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    createElement: (tag) => node(tag),
    createTextNode: (t) => ({ tag: "#text", textContent: t }),
  };
  try {
    const box = new TextBox();
    box.add("@c1Red\n@c0White", { instant: true });
    const [seg] = els.text.children;
    assert.equal(seg.className, "seg");
    const [run, ...rest] = seg.children;
    assert.equal(run.className, "color1");
    assert.equal(run.children.map((c) => c.textContent).join(""), "Red\n");
    assert.equal(rest.map((c) => c.textContent).join(""), "White");
    box.add("A caterpillar.", { color: 3, edge: 7, instant: true });
    assert.equal(els.text.children.at(-1).className, "seg color3 edge7");
    assert.equal(box.pageParts.join("|"), "Red\nWhite|A caterpillar.");
  } finally {
    delete globalThis.document;
  }
});
