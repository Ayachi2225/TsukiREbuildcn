// endings.js - the gallery's Ending List and the "Teach Me, Ciel-Sensei!" episodes, as the original decides them.
//
// Native 0xDAF8 / 0xDDA4 draw the list from a 25-row table at 0x3374ec (scene, message, -): three main endings
// (Arcueid, Ciel's two), then the bad ends. A row counts as seen once its episode's scene has been started (RDST,
// global bits read by 0x926B0): the episode is the hint corner a bad end offers, so a bad end appears once its
// Ciel-sensei episode has begun. The last row, episode 25, is offered only when episodes 1-24 are all complete
// (0x926F0(1), the same test as IFUR 1; RDED bits 533-556). See ANIMATIONS.md, "Endings and Ciel-sensei".

export const FIRST_EPISODE = 533;   // QA_01's scene; QA_k is scene 532 + k
export const FINAL_EPISODE = 557;   // QA_25, the completion episode

// Native layout (1920 x 1080). Main endings: the card at (416 + 480k, 120), its button at (720 + 480k, 128).
// Bad ends: 8 to a row, the label at (384 + 180c, 680 + 96r), its button over the label's icon; the label's cell in
// ending_badend is (180c + 8, 96r + 8) when locked and (180c + 8, 96r + 296) when seen, 180 x 88. The final episode's
// button is at (1700, 892). Buttons are 112 (main) and 88 (bad end) square.
export const LAYOUT = {
  main: { x: 416, y: 120, dx: 480, w: 432, h: 544, button: { x: 720, y: 128, size: 112 } },
  bad: { x: 384, y: 680, dx: 180, dy: 96, columns: 8, w: 180, h: 88, button: 88, lockedY: 8, seenY: 296 },
  final: { x: 1700, y: 892, size: 112 },
};

// Has the player completed every episode up to 24? (native 0x926F0(1); IFUR 1 in QA_25)
export function allEpisodesDone(progress) {
  for (let s = FIRST_EPISODE; s < FINAL_EPISODE; s++) if (!progress.completed.has(s)) return false;
  return true;
}

// The list as the player sees it: each entry with `seen` (selectable) and where it is drawn.
export function endingList(endings, progress) {
  const main = [], bad = [];
  let final = null;
  for (const e of endings) {
    const seen = progress.started.has(e.scene);
    if (e.kind === "main") main.push({ ...e, seen, slot: main.length });
    else if (e.kind === "final") final = { ...e, seen, offered: allEpisodesDone(progress) };
    else bad.push({ ...e, seen, slot: bad.length, column: bad.length % LAYOUT.bad.columns, row: Math.floor(bad.length / LAYOUT.bad.columns) });
  }
  return { main, bad, final };
}

// Progress from before episodes could run: a bad end (or main ending) whose scene was completed led straight into
// its episode, and an episode whose text was read was started. Done once; afterwards only the native rule applies,
// so declining an episode keeps it out of the list as in the original.
export function inferEndings(progress, endings, isRead = () => false) {
  if (progress.endingsInferred) return false;
  let changed = false;
  for (const e of endings) {
    if (progress.started.has(e.scene)) continue;
    const reached = (e.from || []).some((s) => progress.completed.has(s)) || (e.lines || []).some(isRead);
    if (reached) { progress.started.add(e.scene); changed = true; }
  }
  progress.endingsInferred = true;
  progress.save();
  return changed;
}
