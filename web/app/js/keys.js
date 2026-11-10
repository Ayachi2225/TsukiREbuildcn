// keys.js - the keyboard map: one table for every screen, shown on the config's Controls page and changeable there.
// An action has up to two keys. The story's actions are the changeable ones; the menus' keys are fixed (MENU_KEYS) and
// the mouse's are listed with them (MOUSE). The pad goes through the same actions (main.js).
export const SLOTS = 2;
export const ACTIONS = [
  { id: "advance", label: "Advance text", keys: ["Enter", "Space"] },
  { id: "fast", label: "Fast forward (while held)", keys: ["Control"] },
  { id: "skip", label: "Skip read text: on / off", keys: ["S"] },
  { id: "auto", label: "Auto mode: on / off", keys: ["A"] },
  { id: "log", label: "Log", keys: ["L", "PageUp"] },
  { id: "rewind", label: "Previous message", keys: ["R"] },
  { id: "hide", label: "Hide text", keys: ["H"] },
  { id: "voice", label: "Replay voice", keys: ["V"] },
  { id: "quickSave", label: "Quick save", keys: ["Q"] },
  { id: "quickLoad", label: "Quick load", keys: ["W"] },
  { id: "prevScene", label: "Return to previous scene", keys: ["P"] },
  { id: "nextScene", label: "Jump to next scene", keys: ["N"] },
  { id: "bar", label: "Quick bar", keys: ["ArrowUp"] },
  { id: "save", label: "Save", keys: [] },
  { id: "load", label: "Load", keys: [] },
  { id: "config", label: "Config", keys: [] },
  { id: "menu", label: "System menu", keys: ["Escape"] },
  { id: "fullscreen", label: "Full screen", keys: ["F"] },
];
// The menus' keys, the same on every screen, and the mouse (shown on the Controls page; not changeable).
export const MENU_KEYS = [
  ["Move", ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]],
  ["Choose", ["Enter", "Space"]],
  ["Back", ["Escape", "Backspace"]],
  ["Change page", ["Tab"]],
  ["Scroll", ["PageUp", "PageDown"]],
  ["First / last", ["Home", "End"]],
];
export const MOUSE = [
  ["Advance text, choose", "Left click"],
  ["System menu, back", "Right click"],
  ["Log", "Wheel up"],
  ["Advance text, scroll", "Wheel down"],
  ["Hide text", "Middle click"],
  ["Quick bar", "Top edge"],
];
// Keys the browser keeps for itself, and the ones that are never a binding on their own.
const RESERVED = new Set(["F5", "F11", "F12", "Meta", "OS", "ContextMenu", "CapsLock", "NumLock", "ScrollLock", "Dead", "Unidentified", "Process"]);
const NAMES = { Escape: "Esc", Control: "Ctrl", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", PageUp: "Page Up", PageDown: "Page Down",
  Backspace: "Backspace", Delete: "Del", Insert: "Ins", " ": "Space" };

// The name a key goes by in the map: letters in capitals, the space bar "Space", the rest as the browser names them.
export function keyName(e) {
  const k = typeof e === "string" ? e : e.key;
  if (k === " " || k === "Spacebar") return "Space";
  return k && k.length === 1 ? k.toUpperCase() : k || "";
}
// What a key is called on screen.
export const keyLabel = (name) => NAMES[name] ?? name;
export const canBind = (name) => !!name && !RESERVED.has(name);

export class KeyMap {
  constructor(storage = globalThis.localStorage, key = "tsuki.keys") {
    this.storage = storage;
    this.storageKey = key;
    this.map = {};
    this.reset(false);
    try {
      const saved = JSON.parse(storage?.getItem(key) || "null");
      if (saved && typeof saved === "object") {
        for (const a of ACTIONS) if (Array.isArray(saved[a.id])) this.map[a.id] = saved[a.id].filter((k) => typeof k === "string" && canBind(k)).slice(0, SLOTS);
      }
    } catch { /* the defaults */ }
    this.index();
  }
  index() {
    this.byKey = new Map();
    for (const a of ACTIONS) for (const k of this.map[a.id] || []) if (!this.byKey.has(k)) this.byKey.set(k, a.id);
  }
  save() {
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.map)); } catch { /* not kept */ }
  }
  reset(save = true) {
    for (const a of ACTIONS) this.map[a.id] = a.keys.slice();
    this.index();
    if (save) this.save();
  }
  keys(id) { return this.map[id] || []; }
  // The first key of an action as shown on screen ("" when it has none).
  label(id) { const k = this.keys(id)[0]; return k ? keyLabel(k) : ""; }
  // The action a key event is for, or null. A key pressed with Ctrl, Alt or the command key held is the browser's or the
  // system's, unless the key is that modifier itself.
  action(e) {
    const name = keyName(e);
    const modifier = name === "Control" || name === "Alt" || name === "Shift";
    if (typeof e !== "string" && !modifier && (e.metaKey || e.altKey || e.ctrlKey)) return null;
    return this.byKey.get(name) ?? null;
  }
  // Slot `slot` of an action takes a key (null clears it). The key leaves whichever action had it.
  set(id, slot, name) {
    if (name !== null && !canBind(name)) return false;
    if (name !== null) for (const a of ACTIONS) this.map[a.id] = this.keys(a.id).filter((k) => k !== name);
    const list = this.keys(id).slice();
    if (name === null) list.splice(slot, 1);
    else if (slot < list.length) list[slot] = name;
    else list.push(name);
    this.map[id] = list.slice(0, SLOTS);
    this.index();
    this.save();
    return true;
  }
}
