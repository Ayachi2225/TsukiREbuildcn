// lang.js - the language layer. English is the game's own (assets/text.json, assets/system.json, assets/img, assets/ui);
// another language is a pack under assets/lang/<code> that may replace the story text, override parts of the system
// tables, and stand its own pictures in front of the English ones by the same names. Nothing in the English tree is
// changed, so a language pack can be dropped in or taken out without touching the port itself.
//
// A pack's index.json: { name, text?, system?, flow?, fonts?: [file...], images?: [IMGNAME...], ui?: ["PACK/name"...],
// movies?: [NAME...], strings?: {English: translation}, chapters?: {English chapter name: translation} }. text/system/flow
// are file names in the pack; fonts are the faces its CSS declares; images/ui/movies name the originals the pack has its
// own copy of.
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const stored = (() => { try { return localStorage.getItem("tsuki.lang"); } catch { return null; } })();
export const LANG = params.get("lang") || stored || "en";   // English is the default; ?lang=zh (or tsuki.lang) gives the Chinese pack
export const BASE = `/assets/lang/${encodeURIComponent(LANG)}`;
const IMAGES = new Set();
const UI = new Set();
const MOVIES = new Set();
let manifest = null;
let flow = null;        // the flowchart's preview texts, by SYSMES id (the pack's flow.json)
let ready = null;

// Picks the language and reads the page again. The pack is read once, when the modules load, so there is no changing it
// under a running game: the choice is kept (tsuki.lang) and the page starts over. ?lang still wins, so a page opened with
// it is moved to the choice's own address (the Chinese one carries no lang, which is this fork's default).
export function setLang(code, keep = null) {
  try { localStorage.setItem("tsuki.lang", code); } catch { /* not saved */ }
  if (typeof location === "undefined") return;
  const u = new URL(location.href);
  if (code === "zh") u.searchParams.delete("lang");
  else u.searchParams.set("lang", code);
  // an address's own parameters to stay on (the opening page's tab=play, so the reload lands back on PLAY ONLINE)
  if (keep) for (const [k, v] of Object.entries(keep)) u.searchParams.set(k, v);
  location.replace(u.href);
}

// Reads the pack's index (once). Nothing is fetched for English, and a missing pack simply leaves the English tree.
export function prepare() {
  if (ready) return ready;
  if (LANG === "en") { ready = Promise.resolve(); return ready; }
  ready = fetch(`${BASE}/index.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (!m) return;
      manifest = m;
      // the page itself, too: its language and the tab's title
      if (typeof document !== "undefined") {
        document.documentElement.lang = LANG === "zh" ? "zh-CN" : LANG;
        const title = m.strings?.["Tsukihime remake"];
        if (title) document.title = title;
      }
      for (const k of m.images || []) IMAGES.add(String(k).toUpperCase());
      for (const p of m.ui || []) UI.add(p);
      for (const v of m.movies || []) MOVIES.add(String(v));
      // the pack's own CSS (its faces, and the title's prompt, which CSS draws from a picture), and its faces, read
      // ahead of the first line that needs them
      if (typeof document !== "undefined") {
        for (const f of m.fonts || []) {
          const font = document.createElement("link");
          font.rel = "preload";
          font.as = "font";
          font.type = "font/ttf";
          font.crossOrigin = "anonymous";
          font.href = `${BASE}/fonts/${encodeURIComponent(f)}`;
          document.head.append(font);
        }
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${BASE}/lang.css`;
        document.head.append(link);
      }
      // the flowchart's preview texts (its notes are read at every part, titleId / noteId in flowchart.json)
      if (m.flow) return fetch(`${BASE}/${m.flow}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((f) => { flow = f || null; })
        .catch(() => {});
    })
    .catch(() => {});
  return ready;
}

// A game picture. The pack's copy, when it has one, stands in front of the English one under the same name.
export function imageUrl(key) {
  if (IMAGES.has(key.toUpperCase())) return `${BASE}/img/${encodeURIComponent(key.toUpperCase())}.avif`;
  return `/assets/img/${encodeURIComponent(key.toUpperCase())}.avif`;
}

// Whether the pack has its own copy of a piece of interface art.
export const hasUi = (path) => UI.has(path);

// A piece of the interface art (path: "PACK/name", no extension).
export function uiUrl(path) {
  if (UI.has(path)) return `${BASE}/ui/${path}.webp`;
  return `/assets/ui/${path}.webp`;
}

// A movie. The pack's copy, when it has one, stands in front of the game's under the same name.
export function movieUrl(name) {
  if (MOVIES.has(String(name))) return `${BASE}/movie/${encodeURIComponent(name)}.mp4`;
  return `/assets/movie/${encodeURIComponent(name)}.mp4`;
}

// The story's lines. A pack may leave them English.
export function textUrl() {
  return manifest?.text ? `${BASE}/${manifest.text}` : "/assets/text.json";
}

// The pack's changes to system.json, or null. The port merges messages and saves.sceneNames over the English tables.
export function systemOverlayUrl() {
  return manifest?.system ? `${BASE}/${manifest.system}` : null;
}

// A small interface string (the port's own English wording) in the pack's language.
export function t(text) {
  if (text == null) return text;
  return manifest?.strings?.[text] ?? text;
}

// A chapter's name. The chapters' tables stay in the game's English names; only what is shown is translated.
export function chapterName(name) {
  if (name == null) return name;
  return manifest?.chapters?.[name] ?? name;
}

// A flowchart preview's title or note (its titleId / noteId into SYSMES). The English text stands in where the pack
// has no translation of that id.
export function flowText(id, fallback) {
  const v = id == null ? undefined : flow?.[String(id)];
  return v != null && v !== "" ? v : fallback;
}
