// The English patch's line breaks: the ones its injector (deepLuna) put in to wrap 55-cell rows are taken out, the
// translators' own stay (web/app/js/reflow.js, web-dev/audit/NATIVE-PARITY.md "Line breaks"). The last tests read the
// generated text and scripts when they are there.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ROW, NOTE_ROW, cells, firstWord, lastWord, injectorBreaks, reflow, reflowNote, choiceText, wrapContext, DELIBERATE } from "../../web/app/js/reflow.js";
import { titleSize } from "../../web/app/js/flowchart-model.js";

globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };

// Words separated by spaces, exactly n cells.
const fill = (n) => {
  const words = [];
  let len = -1;
  while (len + 5 <= n) { words.push("word"); len += 5; }
  words[words.length - 1] += "x".repeat(n - len);
  return words.join(" ");
};

test("cells count as the injector's: ASCII, Latin-1 and private-use letters one, other characters two, ruby its base", () => {
  assert.equal(ROW, 55);
  assert.equal(cells("How I"), 5);
  assert.equal(cells("naïve"), 5);
  assert.equal(cells(""), 3);                // italic letters
  assert.equal(cells("―――"), 6);
  assert.equal(cells("Shiki…"), 7);
  assert.equal(cells("<Shiri|w o r d   ><tori|c h a i n   >."), 10);
  assert.equal(firstWord("<Holy Maiden|C i e l o>! more"), "<Holy Maiden|C i e l o>!");
  assert.equal(lastWord("say <a b|c d>"), "<a b|c d>");
});

test("a break where the row had no room for the next word is the injector's: it goes, and the space comes back", () => {
  const row = "About how the attic had been our secret hideout. How I";   // 54 cells: "came" would make 59
  assert.equal(cells(row), 54);
  assert.deepEqual(injectorBreaks(`${row}\ncame to hate it.`), [true]);
  assert.equal(reflow(`${row}\ncame to hate it.`), `${row} came to hate it.`);
  // a row of exactly 55 with a one-letter word after it
  const full = fill(55);
  assert.equal(reflow(`${full}\na b`), `${full} a b`);
});

test("a break with room left on the row is the translators' and stays (verse, lists, a row of its own)", () => {
  for (const t of ['"Hmm. Hmmmm.\nHey, Tohno."', "One.\nI rejuvenate my blood by inhaling fresh oxygen.",
    "Her desire to kill Senpai.\nHer anger toward me.", ".........\n\nOh... right.", '"I knew it..."\n',
    "A student, oblivious to danger.\n                 And the red shadow of the setting sun."]) {
    assert.equal(reflow(t), t);
  }
  // mixed: the wraps go, the deliberate break before the last sentence stays
  const t = "I was a little nervous about this since I'm not used to\nJapan yet, but I think I could get used to being called\n'Sensei' by naive little boys like you.\nIt's kind of dirty, and a little bit exciting.\"";
  assert.equal(reflow(t), "I was a little nervous about this since I'm not used to Japan yet, but I think I could get used to being called 'Sensei' by naive little boys like you.\nIt's kind of dirty, and a little bit exciting.\"");
});

test("a glued line starts where the one before it ended: its first break is measured from there", () => {
  const t = " so all\nyou have to do is go back and pick the other.";
  assert.equal(reflow(t, 0), t);                                   // from column 0 the next word had room
  assert.equal(reflow(t, 48), " so all you have to do is go back and pick the other.");
  // a glued line whose first word did not fit after the line before it begins with the injector's break
  assert.equal(reflow("\nActually, that's not right.", 52), " Actually, that's not right.");
  assert.equal(reflow("\nOne more step to go.", 10), "\nOne more step to go.");
});

test("the injector's breaks at a line's end: a full row before a glued line, or a last word moved down for its first word", () => {
  const full = fill(55);
  // the glued line after it began with a space, which the injector dropped: the break becomes that space
  assert.equal(reflow(`${full}\n`, 0, "The next time I see you"), `${full} `);
  assert.equal(reflow(`${full}\n`, 0, null), `${full}\n`);       // no glued line follows: the translators'
  assert.equal(reflow('"Short line."\n', 0, "Next."), '"Short line."\n');
  // the last word goes down when the glued line after it goes on with no space and its first word would not fit:
  // 45 + 1 + "but――" 7 + "Next" 4 = 57 cells
  const t = "I like the puppyish aspect of it well enough,\nbut――";
  assert.equal(cells("I like the puppyish aspect of it well enough,"), 45);
  assert.equal(reflow(t, 0, "Next"), "I like the puppyish aspect of it well enough, but――");
  assert.equal(reflow(t, 0, " next"), t);                          // a space before it: the row could end at "but――"
  assert.equal(reflow(t, 0, "OK"), t);                             // 55 cells: it fitted
  assert.equal(reflow(t, 0, null), t);
});

test("a word longer than a row keeps the injector's cuts; ids whose deliberate breaks fall on a full row keep them", () => {
  const scream = "a".repeat(55);
  assert.equal(reflow(`"so pleaaaa\n${scream}\n${scream}"`, 45), `"so pleaaaa\n${scream}\n${scream}"`);
  const verse = "we are like the crumbs left at the bottom of the bag\nthe last few that have slipped into the creases";
  assert.equal(reflow(verse), verse.replace("\n", " "));            // the width alone cannot tell
  assert.equal(reflow(verse, 0, null, 35115), verse);               // the translators' %{n} (DELIBERATE)
  assert.deepEqual([...DELIBERATE.keys()], [12930, 20685, 35115, 35119, 35122]);
});

test("wrapContext follows the injector: pages and unglued lines start at 0, MSAD and @x go on, ^ ends the glue", () => {
  const lines = ["Good evening.", "\nWere you surprised?", fill(30), "and more", "next page", "x".repeat(20), "after caret", "glued @x"];
  const script = { name: "T", ops: [
    ["PGST", "1"], ["MSG", "$000000@n"], ["MSAD", "$000001"],
    ["MSG", "$000002"], ["MSAD", "$000003"],
    ["PGST", "2"], ["MSAD", "$000004"],
    ["MSG", "$000005^@n"], ["MSAD", "$000006"], ["MSG", "@x$000007"],
  ] };
  const c = wrapContext(script, lines);
  assert.deepEqual(c.get(0), { start: 0, next: "\nWere you surprised?" });
  assert.deepEqual(c.get(1), { start: 13, next: null });
  assert.deepEqual(c.get(2), { start: 0, next: "and more" });
  assert.equal(c.get(3).start, 30);
  assert.equal(c.get(4).start, 0);                                   // a new page
  assert.equal(c.get(6).start, 0);                                   // after ^, not glued
  assert.equal(c.get(7).start, 11);                                  // @x glues an MSG
  // the Q&A corners: the injector took every line as glued
  const qa = wrapContext({ name: "QA_01", ops: [["PGST", "1"], ["MSG", "$000005"], ["MSG", "$000003"]] }, lines);
  assert.equal(qa.get(3).start, 20);
});

test("the story box and the backlog get the reflowed text (VM.parseMessage)", async () => {
  const { VM } = await import("../../web/app/js/vm.js");
  const text = { pageParts: [], typing: false, intro: false, addBreak() {} };
  const vm = new VM({ gfx: {}, audio: {}, text });
  const row = "About how the attic had been our secret hideout. How I";
  vm.lines = [`${row}\ncame to hate it.`, "Good evening.", `\nAnd you?`, "' Should just\n   the opportunity."];
  vm.script = { name: "T", ops: [["MSG", "$000000"], ["MSG", "$000001@n"], ["MSAD", "$000002"], ["SELR", "0", "$000003"]], labels: {} };
  const { SOFT, plain } = await import("../../web/app/js/textbox.js");
  assert.equal(vm.parseMessage("$000000").text, `${row}${SOFT}came to hate it.`);   // the injector's break: a space that is no letter (N2-122)
  assert.equal(plain(vm.parseMessage("$000000").text), `${row} came to hate it.`);
  assert.equal(vm.parseMessage("$000002").text, "\nAnd you?");     // "Good evening." left room: deliberate
  assert.equal(vm.textOf("$000003"), "' Should just\n   the opportunity.");   // a choice's text as the patch has it
});

test("a flowchart note loses the breaks its 33-cell rows forced; a new sentence on its own row and a blank row stay", () => {
  assert.equal(NOTE_ROW, 33);
  assert.equal(
    reflowNote("I've been spared from any further^questioning, but I don't want her^fretting over my health. I'll do^as I'm told and go see the^doctor."),
    "I've been spared from any further questioning, but I don't want her fretting over my health. I'll do as I'm told and go see the doctor.");
  assert.equal(
    reflowNote("Suddenly, I wake up.^Lured by the distant clamor, I^head into the dark, dark forest."),
    "Suddenly, I wake up.\nLured by the distant clamor, I head into the dark, dark forest.");
  assert.equal(reflowNote("Ciel's apartment.^Flowers for the heart.^Water for the flowers."), "Ciel's apartment.\nFlowers for the heart.\nWater for the flowers.");
  assert.equal(reflowNote("I wasn't thinking of doing^anything else...^^Until I crossed paths with her."), "I wasn't thinking of doing anything else...\n\nUntil I crossed paths with her.");
  assert.equal(reflowNote(""), "");
  assert.equal(reflowNote("A note with no break."), "A note with no break.");
});

test("a choice is one row: the patch's break goes, and a hanging second row's indent with it", async () => {
  assert.equal(choiceText(" Should just carefully admire her since I have\n   the opportunity."), " Should just carefully admire her since I have the opportunity.");
  assert.equal(choiceText(" Nothing; saying the wrong thing would only make things\nworse."), " Nothing; saying the wrong thing would only make things worse.");
  assert.equal(choiceText(" Return to the mansion."), " Return to the mansion.");
  const { VM } = await import("../../web/app/js/vm.js");
  const vm = new VM({ gfx: {}, audio: {}, text: { pageParts: [], typing: false, intro: false, addBreak() {} } });
  vm.system = { messages: { 1434: "1.", 1435: "2." } };
  vm.choices = [{ value: 0, text: " Stay.", locked: false }, { value: 1, text: " Should just\n   the opportunity.", locked: false }];
  assert.deepEqual(vm.choiceRows().map((r) => r.label), ["1. Stay.", "2. Should just the opportunity."]);
  assert.equal(vm.choiceRows()[1].text, " Should just\n   the opportunity.");   // a save keeps the patch's text
});

test("a choice row draws the patch's italic letters as italics, in the row and in its glow, not as missing glyphs", async () => {
  class El {
    constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.text = ""; this.className = ""; this.classes = new Set(); this.classList = { add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c), toggle() {} }; }
    append(...c) { this.children.push(...c); }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener() {}
    set textContent(t) { this.text = t; this.children = []; }
    get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
  }
  const box = new El("div");
  const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame, add: globalThis.addEventListener, remove: globalThis.removeEventListener };
  globalThis.document = { createElement: (t) => new El(t), getElementById: (id) => (id === "choices" ? box : null) };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.addEventListener = globalThis.removeEventListener = () => {};
  try {
    const { UI } = await import("../../web/app/js/ui.js");
    UI.prototype.choices.call({ text: { rows: () => ({ pitch: 74, next: 148, used: 0 }), speed: 30 }, vm: { textSpeed: 30 }, sound() {} }, [{ label: "5. She \ue064\ue06f\ue065\ue073 have it.", locked: false }]);
    const row = box.children.find((c) => c.className === "choice");
    const glow = row.children.find((c) => c.className === "choice-glow");
    assert.equal(row.textContent.replace(glow.textContent, ""), "5. She does have it.");
    assert.equal(glow.textContent, "5. She does have it.");
    for (const el of [row, glow]) assert.deepEqual(el.children.filter((c) => c.tag === "i").map((c) => c.textContent), ["does"]);
    assert.ok(glow.children.flatMap((c) => (c.tag === "i" ? c.children : [c])).every((c) => c.classes.has("on")));   // the glow's letters are all shown
  } finally {
    globalThis.document = saved.document; globalThis.requestAnimationFrame = saved.raf; globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.remove;
  }
});

test("a flowchart title stays on its row: only one wider than the 400 px box is set smaller, just enough to fit", () => {
  assert.equal(titleSize(380), 24);
  assert.equal(titleSize(400), 24);
  assert.ok(Math.abs(titleSize(445) * (445 / 24) - 400) < 1e-9);
});

test("the flowchart's cards are in Helvetica and the gallery's text in Inter, from the port's own copy of the font", () => {
  const css = readFileSync(new URL("../../web/app/style.css", import.meta.url), "utf8");
  assert.match(css, /--flow-font: Helvetica,/);
  assert.match(css, /--gallery-font: Inter,/);
  // the flowchart's and gallery's rules keep the host fonts (the balloon text alone uses the game's third face, N2-21)
  for (const m of css.matchAll(/^\.(fc|gl)-[^{]*\{[^}]*\}/gm)) assert.doesNotMatch(m[0], /SeuratPro|TsukuMin|Tsuki Flow|Tsuki Mincho/);
  assert.doesNotMatch(css.match(/^\.fc-page[^\n]*/m)[0], /Seurat/);
  const file = /font-family: "Inter"; src: url\("([^"]+)"\)/.exec(css)?.[1];
  assert.ok(file && existsSync(new URL(`../../web/app/${file}`, import.meta.url)), file);
});

const flowUrl = new URL("../../web/assets/flowchart.json", import.meta.url);
test("the flowchart's notes: 1,404 of their 1,473 breaks go, and nothing else in them changes", () => {
  if (!existsSync(flowUrl)) return;   // generated files stay local
  const notes = new Map();
  for (const g of JSON.parse(readFileSync(flowUrl, "utf8")).groups) for (const p of g.parts || []) if (p.note) notes.set(`${p.noteId}/${p.titleId}`, p.note);
  let all = 0, kept = 0;
  for (const n of notes.values()) {
    const out = reflowNote(n);
    all += n.split("^").length - 1;
    kept += out.split("\n").length - 1;
    assert.equal(out.replace(/\s/g, ""), n.replace(/[\^\s]/g, ""), n);
  }
  assert.deepEqual([notes.size, all, all - kept, kept], [495, 1473, 1404, 69]);
});

const textUrl = new URL("../../web/assets/text.json", import.meta.url);
const indexUrl = new URL("../../web/assets/scripts/index.json", import.meta.url);

test("the four choices with a break are the last row of their menus and come out on one row", () => {
  if (!existsSync(textUrl)) return;   // generated files stay local
  const lines = JSON.parse(readFileSync(textUrl, "utf8"));
  for (const id of [42725, 42571, 42743, 42765]) {
    assert.ok(lines[id].includes("\n"), `text ${id}`);
    assert.ok(!choiceText(lines[id]).includes("\n"), `text ${id}`);
    assert.ok(!choiceText(lines[id]).includes("  "), `text ${id}`);
  }
});

test("the patch's text: 32,408 of its 33,121 breaks go, 713 stay; known lines before and after", () => {
  if (!existsSync(textUrl) || !existsSync(indexUrl)) return;   // generated files stay local
  const lines = JSON.parse(readFileSync(textUrl, "utf8"));
  const names = JSON.parse(readFileSync(indexUrl, "utf8")).names;
  const ctx = new Map();
  names.forEach((_, i) => {
    const s = JSON.parse(readFileSync(new URL(`../../web/assets/scripts/${i}.json`, import.meta.url), "utf8"));
    for (const [id, c] of wrapContext(s, lines)) if (!ctx.has(id)) ctx.set(id, c);
  });
  const out = (id) => { const c = ctx.get(id) ?? { start: 0, next: null }; return reflow(lines[id], c.start, c.next, id); };
  let all = 0, gone = 0;
  for (let id = 0; id < lines.length; id++) {
    if (!lines[id].includes("\n")) continue;
    const c = ctx.get(id) ?? { start: 0, next: null };
    for (const made of injectorBreaks(lines[id], c.start, c.next, id)) { all++; if (made) gone++; }
    // nothing but the breaks changes: a break becomes one space
    assert.equal(out(id).replace(/\s/g, ""), lines[id].replace(/\s/g, ""), `text ${id}`);
  }
  assert.deepEqual([all, gone, all - gone], [33121, 32408, 713]);
  assert.equal(out(299), "About how the attic had been our secret hideout. How I came to hate <Shiri|w o r d   ><tori|c h a i n   >. And how I'm still expected to grow taller.");
  // the translators' break where the Japanese pauses (―――秋葉さまから)
  assert.equal(out(3133), "I know you are tired, but before you return to your room, please stop by the office.\nAkiha-sama would like to have a word with you.\"");
  assert.equal(out(4353), lines[4353]);                            // "Hmm. Hmmmm.\nHey, Tohno."
  assert.match(out(1947), /^ Actually, that's not right\. In your case, it would be more apt/);   // glued at column 52
  assert.equal(out(12122).at(-1), " ");                             // full row before a glued line
  assert.equal(out(35122), lines[35122]);                           // the verse keeps every row
  assert.equal(out(20685).split("\n").length, 4);                   // the staircase, then the paragraph wraps
  assert.equal(out(40866), "One.\nI rejuvenate my blood by inhaling fresh oxygen. I relax my stiffened arteries and knit my shredded muscle tissue back together.");
});
