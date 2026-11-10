// chapters.js - the chapters' days and names, as text. The game shows them as pictures (the system menu's header,
// MENU_PARTS_JA/system_phasetitle_ja, and the flowchart's day titles, flow_phasetitle), and the translation had to fit
// each English name into the Japanese picture's cell, on two lines where it was long. The port writes them out instead,
// on one line; these lists give what each cell of the two sheets says, read off the patched pictures.

// A chapter's day (null: none shown) by its name; "Epilogue." is struck through in both sheets.
const DAY = {
  "Prologue": null, "Glass Moon": 0, "Morning of Homecoming I": 1, "Day that Wasn't": 2, "Inversion Impulse": 3, "Infernal River of Blood I": 4,
  "Infernal River of Blood II": 5, "Distant Sea of Frost": 5, "Vermillion Vestiges I": 6, "Cerulean Stigma": 6, "Eyes of Death Perception I": 7,
  "Reverse Hatching I": 7, "Eyes of Death Perception II": 8, "Reverse Hatching II": 8, "L'Arc-en-Ciel I": 9, "Death.": 9, "L'Arc-en-Ciel II": 10,
  "Scarlet Moon of Crimson I": 10, "Blacked Out Moon": 10, "Epilogue.": 11, "Scarlet Moon of Crimson II": 11, "Night of Ill-Omen": 12,
  "Vermillion Vestiges II": 12, "The Moon's Surface": 13, "Mirage": 13, "Stone of Eternity": 14, "Moon Princess": 14, "Rainbow in the Night": 15,
  "Daylight Blue": 15,
};
const STRUCK = new Set(["Epilogue."]);
// system_phasetitle_ja: three columns of cells 568 x 80 from (24, 24), 584 across and 96 down apart.
const MENU_SHEET = [
  ["Glass Moon", "Morning of Homecoming I", "Day that Wasn't", "Inversion Impulse", "Infernal River of Blood I", "Distant Sea of Frost", "Vermillion Vestiges I",
    "Cerulean Stigma", "Eyes of Death Perception I", "Reverse Hatching I"],
  ["Eyes of Death Perception II", "Reverse Hatching II", "L'Arc-en-Ciel I", "Death.", "L'Arc-en-Ciel II", "Scarlet Moon of Crimson I", "Blacked Out Moon", "Epilogue.",
    "Scarlet Moon of Crimson II", "Night of Ill-Omen"],
  ["Vermillion Vestiges II", "The Moon's Surface", "Mirage", "Stone of Eternity", "Moon Princess", "Daylight Blue", "Rainbow in the Night", "Prologue",
    "Infernal River of Blood II"],
];
// flow_phasetitle: three columns of cells 200 x 32 from (8, 8), 208 across and 40 down apart.
const FLOW_SHEET = [
  ["Prologue", "Glass Moon", "Morning of Homecoming I", "Day that Wasn't", "Inversion Impulse", "Infernal River of Blood I", "Infernal River of Blood II",
    "Distant Sea of Frost", "Vermillion Vestiges I", "Cerulean Stigma"],
  ["Eyes of Death Perception I", "Reverse Hatching I", "Eyes of Death Perception II", "Reverse Hatching II", "L'Arc-en-Ciel I", "Death.", "L'Arc-en-Ciel II",
    "Scarlet Moon of Crimson I", "Blacked Out Moon", "Epilogue."],
  ["Scarlet Moon of Crimson II", "Night of Ill-Omen", "Vermillion Vestiges II", "The Moon's Surface", "Mirage", "Stone of Eternity", "Moon Princess",
    "Rainbow in the Night", "Daylight Blue"],
];
const chapter = (name) => (name === undefined ? null : { day: DAY[name] ?? null, name, struck: STRUCK.has(name) });

// The chapter a cell of the system menu's sheet shows; cell: [x0, y0, x1, y1] (system.json saves.phaseCells). Null for
// the table's empty entries.
export function menuChapter(cell) {
  if (!cell || cell[2] - cell[0] <= 1) return null;
  return chapter(MENU_SHEET[Math.round((cell[0] - 24) / 584)]?.[Math.round((cell[1] - 24) / 96)]);
}
// The chapter a cell of the flowchart's sheet shows; rect: [x, y, w, h] (flowchart.json phaseRects).
export function flowChapter(rect) {
  if (!rect) return null;
  return chapter(FLOW_SHEET[Math.round((rect[0] - 8) / 208)]?.[Math.round((rect[1] - 8) / 40)]);
}
// A chapter by its name alone (where the tables are missing).
export const chapterNamed = (name) => (name in DAY ? chapter(name) : null);
// "12 / Night of Ill-Omen", as the flowchart writes it.
export const chapterLine = (c) => (c.day === null ? c.name : `${c.day} / ${c.name}`);
