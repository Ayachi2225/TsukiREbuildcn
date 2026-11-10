// unlocks.js - what the gallery can show: pictures seen (their seen bits) or unlocked by STCG, music played, movies
// watched. Kept in this browser. The tables come from web/assets/gallery.json (tools/build_gallery.py).
const KEY = "tsuki.unlocks.v1";

// The CG entry gates (native 0xb58c): an entry whose code (the entry's +8, gallery.json "gate") is 1-19 is listed only
// once one of its route day's scenes has started (RDST, 0x926b0); code 0, and any other, always.
export const CG_GATES = {
  1: [2], 2: [3], 3: [4], 4: [5], 5: [383], 6: [208], 7: [7], 8: [8], 9: [9], 10: [226],
  11: [10], 12: [11], 13: [12], 14: [13], 15: [275, 276], 16: [14], 17: [297], 18: [300], 19: [309],
};
// Completing QA_25 (its RDED 557) lists every picture past its gate (0x4470 at 0x4618: 0x922c0(0x22d)).
export const COMPLETION_SCENE = 557;

export class Unlocks {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(KEY) || "{}"); } catch { /* nothing yet */ }
    this.images = new Set(saved.images || []);   // pictures recorded by name (before seen bits were kept)
    this.seen = new Set(saved.seen || []);       // the seen bits (0xae07a8)
    this.music = new Set(saved.music || []);
    this.movies = new Set(saved.movies || []);
    this.known = null;
    this.seenOf = null;
    this.timer = null;
  }

  // gallery.json: "seen" maps each picture name that sets a bit the gallery reads to that bit. The names recorded
  // before stand for their bits.
  install(gallery) {
    this.known = new Set(gallery.cg.flatMap((e) => e.variants.map((v) => v.image)));
    this.seenOf = gallery.seen || null;
    if (this.seenOf) for (const n of this.images) if (this.seenOf[n] !== undefined) this.add(this.seen, this.seenOf[n]);
  }

  add(set, value) {
    if (set.has(value)) return;
    set.add(value);
    if (!this.timer) this.timer = setTimeout(() => this.save(), 1000);
  }

  // A picture shown on a layer (0x5d3a0 -> 0x774f0) or by STCG (0x7b214): its seen bit. The name table decides the
  // bit (build_gallery.py): a picture among the first 2700 names is its own bit, an expression record (+0x43) its
  // pose's, a sprite the one the bit table 0x6533c0 gives it (some poses' sizes A / L / M / S share one, others
  // not); others have none.
  // (STCG takes only the first 2700; every STCG in the scripts names one of them.)
  image(name) {
    const n = String(name || "").toUpperCase().split(".")[0];
    if (this.seenOf) { if (this.seenOf[n] !== undefined) this.add(this.seen, this.seenOf[n]); return; }
    if (this.known ? this.known.has(n) : /^IMG\d{4}$/.test(n)) this.add(this.images, n);
  }
  playedMusic(n) { if (Number.isInteger(n)) this.add(this.music, n); }
  watched(name) { if (name) this.add(this.movies, name); }

  save() {
    clearTimeout(this.timer);
    this.timer = null;
    try {
      this.storage?.setItem(KEY, JSON.stringify({ images: [...this.images], seen: [...this.seen], music: [...this.music], movies: [...this.movies] }));
    } catch { /* not saved */ }
  }
}

// Is this CG picture listed? (native 0x4470): the entry's gate first (0xb58c); then the alias rule (0x51e0: one of the
// pictures shown in its place was seen), the picture's own seen bit (0x75900 -> 0x77610), both in variant.bits; then
// QA_25 complete. A table without bits falls back to the names recorded.
export function cgUnlocked(entry, variant, { unlocks, flow }) {
  const gate = CG_GATES[entry.gate];
  if (gate && !gate.some((s) => flow?.started?.has(s))) return false;
  if (variant.bits ? variant.bits.some((b) => unlocks.seen.has(b)) : unlocks.images.has(variant.image)) return true;
  return !!flow?.completed?.has(COMPLETION_SCENE);
}

// The CG gallery's lists: `entries`, the entries with an unlocked picture (0xb830), each with its unlocked pictures
// (the sub-grid's list, 0xd468); `flat`, every unlocked picture in table order (0x4470's list, which the viewer's
// Left / Right walk, 0xc56c). An entry's thumbnail is its first unlocked picture.
export function cgLists(cg, ctx) {
  const entries = [], flat = [];
  cg.forEach((entry, index) => {
    const pictures = [];
    entry.variants.forEach((variant, vi) => {
      if (!cgUnlocked(entry, variant, ctx)) return;
      const p = { index, vi, variant, flat: flat.length, entry: entries.length };
      flat.push(p);
      pictures.push(p);
    });
    if (pictures.length) entries.push({ index, pictures });
  });
  return { entries, flat };
}

// A Music Player row is listed (native 0x19ec4) once its music number or one of the row's other numbers has been
// played; the four vocal songs also once their opening movie has played (op1_arc / op2_ciel, G005 bits 0 and 1 set by
// 0x40a00) or their scene has started (560 / 562).
export function musicUnlocked(track, { unlocks, flow }) {
  if ([track.music, ...(track.also || [])].some((n) => unlocks.music.has(n))) return true;
  if (track.movie && unlocks.movies.has(track.movie)) return true;
  return !!(track.scene && flow?.started?.has(track.scene));
}
