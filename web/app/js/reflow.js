// reflow.js - the English patch's line breaks that only wrapped its fixed rows, taken out so the text box wraps itself.
//
// The Japanese lines have no line breaks: the engine wraps them. It has no word wrap, so the translation's injector
// (deepLuna, Hakanaou/deepLuna luna/translation_db.py generate_linebroken_text_map) wraps every English line itself,
// greedily, at 55 cells (Constants.CHARS_PER_LINE): ASCII, Latin-1 and the private-use letters are one cell, any other
// character two, ruby counts its base only (RubyUtils.noruby_len, linebreak_text). A line glued to the one before it
// (MSAD, or @x) starts where that one ended on its row, and a glued line's first word can move the last word of the
// line before it down. The translators' own breaks are %{n} in their script files, kept as they are; the Q&A corners
// are broken by hand throughout (deepLuna leaves QA scenes alone).
//
// The port sets proportional type in a wider box, so the injector's breaks cut rows short. A break is taken out when
// the injector's wrap would have put it there: its row had no room for the next word. Breaks with room left on the
// row (verse, lists, a pause, a row of its own, the staircases) are the translators' and stay. Checked against the
// translation's script files (Tsukihimates/Tsukihime-Translation script/, where the translators write %{n}): of the
// 33,121 breaks in the patch's text, 32,210 are the injector's, and this finds all of them but one (a forced space
// that became a break), leaving the 13 that cut screams too long for any row. None of the translators' 694 breaks with
// room left on the row is taken; theirs that fall where the row was full anyway go too (a hand wrap), except the five in
// DELIBERATE. The Q&A corners are not reflowed at all (VM.lineText): the game shows their hand-made rows as they are.

export const ROW = 55;

// Width in the injector's cells.
export function cells(s) {
  let n = 0;
  for (const ch of s.replace(/<([^|>]*)\|[^>]*>/g, "$1")) {
    const c = ch.codePointAt(0);
    n += c >= 0xE000 || c <= 256 ? 1 : 2;
  }
  return n;
}

// Words are split at spaces outside ruby (<base|ruby> is one word, as the injector splits them).
function spaceAt(s, from, step) {
  let ruby = false;
  for (let i = from; i >= 0 && i < s.length; i += step) {
    const c = s[i];
    if (c === (step > 0 ? "<" : ">")) ruby = true;
    else if (c === (step > 0 ? ">" : "<")) ruby = false;
    else if (c === " " && !ruby) return i;
  }
  return -1;
}
export function firstWord(s) { const i = spaceAt(s, 0, 1); return i < 0 ? s : s.slice(0, i); }
export function lastWord(s) { const i = spaceAt(s, s.length - 1, -1); return i < 0 ? s : s.slice(i + 1); }

// Translator breaks (%{n}) that sit where the row was full anyway, so the width cannot tell them from the injector's:
// the incantation's name on a row of its own (05_01_CIEL05_4B), the end of the staircase (08_00_ARC08_6B) and three
// rows of the lowercase verse (13_01_01_CIEL13_5B). Text id -> the break (from 0) to keep.
export const DELIBERATE = new Map([[12930, 0], [20685, 2], [35115, 0], [35119, 0], [35122, 1]]);

// For each break in `text`: was it the injector's? `start` is the column the line starts at, `next` the text of the
// glued line that follows it (null when the next line starts a row of its own).
export function injectorBreaks(text, start = 0, next = null, id = -1) {
  const rows = text.split("\n");
  const out = [];
  for (let k = 0; k < rows.length - 1; k++) {
    const used = (k === 0 ? start : 0) + cells(rows[k]);
    const after = rows[k + 1];
    let made;
    if (after === "") {
      // a break that ends the line: the injector adds one only when the row is exactly full and the glued line after
      // it began with a space (which it then drops)
      made = k === rows.length - 2 && next !== null && used > 0 && used % ROW === 0;
    } else {
      made = used + 1 + cells(firstWord(after)) > ROW;
      // the last word moved down: the glued line after it goes on with no space, and its first word would not fit
      if (!made && next !== null && k === rows.length - 2 && !next.startsWith(" ") && spaceAt(after, 0, 1) < 0) {
        made = used + 1 + cells(after) + cells(firstWord(next.split("\n")[0])) > ROW;
      }
      // a word longer than a row, cut where the row filled: kept, as the port could not fit it on a row either
      if (made && used >= ROW && cells(lastWord(rows[k]) + firstWord(after)) > ROW) made = false;
    }
    if (made && DELIBERATE.get(id) === k) made = false;
    out.push(made);
  }
  return out;
}

// The line with the injector's breaks taken out. Each was a space before (the injector breaks at spaces, and at the
// end of a line or the start of a glued one it drops the space the next line had). The VM passes textbox.js SOFT for
// `soft`, a space that is no letter of the typing (the game's raw line feed there costs none, N2-122).
export function reflow(text, start = 0, next = null, id = -1, soft = " ") {
  if (!text || !text.includes("\n")) return text;
  const made = injectorBreaks(text, start, next, id);
  const rows = text.split("\n");
  let out = rows[0];
  for (let k = 1; k < rows.length; k++) out += (made[k - 1] ? soft : "\n") + rows[k];
  return out;
}

// The flowchart's notes went through the same kind of wrap, at 33 cells: all that fit the game's 400 px note box in the
// patch's fixed-width face (flowchart.json keeps them with `^` for a break). In the port's type those rows no longer
// line up with the box, so one that is a little too wide leaves a word on a row of its own and pushes the note out of
// the box. The test is the story's: a break goes when its row had no room for the next word (1,404 of the 1,473), and
// the ones with room left stay (a new sentence on its own row, the blank rows).
export const NOTE_ROW = 33;
export function reflowNote(note) {
  const rows = (note || "").split("^");
  let out = rows[0];
  for (let k = 1; k < rows.length; k++) {
    const made = rows[k] !== "" && cells(rows[k - 1]) + 1 + cells(firstWord(rows[k])) > NOTE_ROW;
    out += (made ? " " : "\n") + rows[k];
  }
  return out;
}

// A choice is one row of the menu. Four of the 197 have a break, because the patch could not fit them on its row (one
// of them hanging its second row under the first with spaces), so each is put back together.
export function choiceText(text) { return (text || "").replace(/ *\n */g, " "); }

// Where each line of a script starts on its row, and the glued line after it, as the injector worked them out: lines
// in the order the script first names them; a page (PGST) starts at column 0, and so does a line not glued to the one
// before (except in the Q&A corners, where the injector took every line as glued); a line glued (MSAD, or @x) unless
// the one before it ends in ^. Text id -> {start, next}.
export function wrapContext(script, lines) {
  const cmds = [];
  const seen = new Set();
  let page = 0;
  for (const op of script.ops || []) {
    if (op[0] === "PGST") { page = Number(op[1]) || 0; continue; }
    if (op[0] !== "MSG" && op[0] !== "MSAD" && op[0] !== "SELR") continue;
    for (const arg of op.slice(1)) {
      const a = String(arg ?? "");
      for (const m of a.matchAll(/\$(\d+)/g)) {
        const id = Number(m[1]);
        if (seen.has(id)) continue;
        seen.add(id);
        const nextRef = a.indexOf("$", m.index + m[0].length);
        const caret = a.indexOf("^", m.index);
        const forcedNewline = caret !== -1 && (nextRef === -1 || caret < nextRef);
        const prev = cmds.at(-1);
        const glued = (op[0] === "MSAD" || /@x/.test(a)) && !(prev && prev.page === page && prev.forcedNewline);
        cmds.push({ id, page, glued, forcedNewline });
      }
    }
  }
  const qa = /^QA/.test(script.name || "");
  const ctx = new Map();
  let col = 0, lastPage = null;
  cmds.forEach((c, k) => {
    if (!c.glued && !qa) col = 0;
    if (c.page !== lastPage) { lastPage = c.page; col = 0; }
    const after = cmds[k + 1];
    ctx.set(c.id, { start: col, next: after?.glued ? (lines[after.id] ?? "") : null });
    const rows = (lines[c.id] ?? "").split("\n");
    col = ((rows.length > 1 ? 0 : col) + cells(rows.at(-1))) % ROW;
  });
  return ctx;
}
