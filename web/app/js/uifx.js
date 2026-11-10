// uifx.js - the moving parts of the title screen and the system menu, as the original draws them (see ANIMATIONS.md,
// "Title screen and system menu"). The original counts in frames at 60 a second; so do these, with fractions.

// ---- title: which background and music --------------------------------------------------------------------------
// Native 0x90180 keeps a title stage in the global save: 0, then 1 once scene 560 (Arcueid's ending) has started,
// 3 once scene 383 has too, 5 once scene 562 (Ciel's ending) has. It moves one step per visit; this gives where it
// ends up. The stage picks a variant (table 0x3529e4) and the variant the still (title_bg1-4) and movie (titlebg1-4).
export const TITLE_VARIANT = [1, 2, 3, 3, 2, 4];
export function titleStage(started) {
  let stage = 0;
  if (started.has(560)) stage = 1;
  if (stage === 1 && started.has(383)) stage = 3;
  if (stage === 3 && started.has(562)) stage = 5;
  return stage;
}
// The title's stage is kept (global G002) and native 0x90180 moves it at most one step each time the title is entered:
// 0 -> 1 once scene 560 has started, 1 -> 3 after 383, 3 -> 5 after 562; any other stored value goes back to 0 (its
// jump table sends 2 and 4 to the reset). titleStage above is where repeated entries end up.
export function nextTitleStage(stage, started) {
  switch (stage) {
    case 0: return started.has(560) ? 1 : 0;
    case 1: return started.has(383) ? 3 : 1;
    case 3: return started.has(562) ? 5 : 3;
    case 5: return 5;
    default: return 0;
  }
}
export const titleVariant = (stage) => TITLE_VARIANT[stage] ?? 1;
// Native 0x8e200 state 0: music 2, or 72 at the last stage.
export const titleMusic = (stage) => (stage === 5 ? 72 : 2);
// The title movie loops back to 8 s (0x34dcd0: frame 240 at 30 a second), so its opening plays once.
export const TITLE_MOVIE_LOOP = 8;

// ---- small helpers -----------------------------------------------------------------------------------------------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// A timer stepped by a rate a frame, held to 0-1. Sums like 0.1 x 10 fall just short of 1 in doubles where the
// original's floats reach it, so ends are snapped.
const towards = (v, d) => { const r = v + d; return r >= 1 - 1e-9 ? 1 : r <= 1e-9 ? 0 : r; };
// Up to 1 at the middle of a life, down again by its end (0x90e80).
export const triangle = (age, life) => { const t = (2 * age) / life; return clamp01(t <= 1 ? t : 2 - t); };

// A frame clock on requestAnimationFrame: fn(frames since last call, frames since start). Returns stop().
export function frameLoop(fn) {
  let last = null, total = 0, id = 0, alive = true;
  const step = (now) => {
    if (!alive) return;
    const dt = last === null ? 0 : Math.min(30, ((now - last) * 60) / 1000);   // a slow frame catches up, to half a second
    last = now; total += dt;
    fn(dt, total);
    id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(id); };
}

// ---- title particles: dust (native 0x90d00 / 0x90e80) and shards (0x905b0 / 0x907e0) ----------------------------
// Both run while the title movie plays, on the 960 x 540 screen (doubled here), drawn before the logo, at the logo's
// alpha (t^3 while it fades in), with normal blending (mode 9), clipped to the top 680 rows of 1080. Both pools are
// fixed arrays of slots searched from a cursor, as the original keeps them; a freed slot keeps its old values.
export const PARTICLE_CLIP = 680;
// logoparticle_all cells (x0, y0, x1, y1): the shards (0x352ac4) and the one texel of each a dust mote shows (0x352adc).
export const SHARD_CELLS = [[0, 0, 33, 44], [64, 0, 96, 55], [128, 0, 157, 45]];
export const DUST_CELLS = [[15, 20, 16, 21], [78, 26, 79, 27], [141, 21, 142, 22]];
const randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1)) % (hi - lo + 1);   // 0xa8f90: inclusive
const randRange = (r, lo, hi) => lo + (hi - lo) * r();                                    // 0xa8f70

// Dust: 200 slots. Each frame up to four free slots get a mote (the search stops at the fourth, and only then moves
// the cursor on): a cell, alpha 0.25-1, life 18-60 frames, x 405-555, y 184-399. A mote does not move; its alpha
// rises to the middle of its life and falls again. It is one screen pixel of its texel's colour (the quad is
// x - 0.5 .. x + 0.5 in 960 units, scaled to the framebuffer, then 1 pixel wide).
export class LogoDust {
  constructor(rand = Math.random) {
    this.rand = rand; this.cursor = 0;
    this.slots = Array.from({ length: 200 }, () => ({ cell: -1, alpha: 0, life: 0, age: 0, x: 0, y: 0 }));
  }
  get live() { return this.slots.filter((q) => q.cell !== -1); }
  spawn() {
    const r = this.rand;
    let made = 0, i = this.cursor;
    for (let n = 0; n < 200; n++) {
      const q = this.slots[i];
      if (q.cell === -1) {
        q.cell = randInt(r, 0, 2); q.alpha = randRange(r, 0.2509804, 1); q.life = Math.trunc(r() * 42 + 18); q.age = 0;
        q.x = r() * 150 + 405; q.y = r() * -215.25 + 399.375;
        if (made > 2) { this.cursor = (i + 1) % 200; return; }
        made++;
      }
      i = (i + 1) % 200;
    }
  }
  // Native order: spawn, then draw each live mote and age it (a mote past its life is freed after its last draw).
  frame(dt, draw) {
    this.spawn();
    for (const q of this.slots) {
      if (q.cell === -1) continue;
      draw(q, triangle(q.age, q.life));
      q.age += dt;
      if (q.age > q.life) q.cell = -1;
    }
  }
}

// Shards: 120 slots, one new shard every other frame: a cell, scale 0.3-0.75, life 120-270 frames, rising at
// 0.13-0.58 a frame, drifting sideways at a speed times cos 80-100 degrees, alpha 0.5-1, a spin phase of 0-640
// degrees turning 0.5-3 degrees a frame, at x 412.5-547.5, y 303-378. The drift takes its speed through a pointer
// that walks the pool from slot 0 as the search goes, so it is the speed of whichever slot that is.
// Drawn like the menu sparkles: in over the first 60 frames, out over the last 60 at 0.7 alpha on alternate pairs of
// frames; the quad is the cell scaled by fade x cos(phase) x scale across and fade x scale down, centred, so a shard
// turns edge-on and over as it spins.
export class LogoShards {
  constructor(rand = Math.random) {
    this.rand = rand; this.cursor = 0; this.counter = 0;
    this.slots = Array.from({ length: 120 }, () => ({ cell: -1, scale: 0, life: 0, age: 0, vx: 0, vy: 0, alpha: 0, phase: 0, spin: 0, x: 0, y: 0 }));
  }
  get live() { return this.slots.filter((q) => q.cell !== -1); }
  spawn(dt) {
    const c = this.counter + dt;
    this.counter = c - 2;
    if (!(c > 1)) { this.counter = c; return; }
    const r = this.rand, rad = Math.PI / 180;
    let i = this.cursor;
    for (let n = 0; n < 120; n++) {
      const q = this.slots[i];
      if (q.cell === -1) {
        q.cell = randInt(r, 0, 2); q.scale = randRange(r, 0.3, 0.75); q.life = Math.trunc(r() * 150 + 120); q.age = 0;
        q.vy = r() * 0.45 + 0.13333334;
        q.vx = this.slots[n].vy * Math.cos((r() * 20 + 80) * rad);
        q.alpha = r() * 0.5 + 0.5; q.phase = r() * 640 * rad; q.spin = (r() * 2.5 + 0.5) * rad;
        q.x = r() * 135 + 412.5; q.y = r() * 75 + 303;
        this.cursor = i < 119 ? i + 1 : 0;
        return;
      }
      i = i < 119 ? i + 1 : 0;
    }
  }
  static look(q) {
    if (q.age < 60) return [q.age / 60, q.alpha];
    const left = q.life - q.age;
    if (left < 60) return [left / 60, (Math.floor(q.age) & 2) ? q.alpha : q.alpha * 0.7];
    return [1, q.alpha];
  }
  frame(dt, draw) {
    this.spawn(dt);
    for (const q of this.slots) {
      if (q.cell === -1) continue;
      const [fade, alpha] = LogoShards.look(q);
      draw(q, fade * Math.cos(q.phase) * q.scale, fade * q.scale, alpha);
      q.x += q.vx * dt; q.y -= q.vy * dt; q.phase += q.spin * dt;
      q.age += dt;
      if (q.age > q.life) q.cell = -1;
    }
  }
}

// Both systems on one 1920 x 1080 canvas, as the title draws them. alpha: the logo's.
export function drawTitleParticles(ctx, atlas, dustColours, dust, shards, dt, alpha) {
  ctx.clearRect(0, 0, 1920, 1080);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 1920, PARTICLE_CLIP); ctx.clip();
  dust.frame(dt, (q, tri) => {
    const [r, g, b] = dustColours[q.cell];
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * q.alpha * tri})`;
    ctx.fillRect(Math.round(q.x * 2 - 1), Math.round(q.y * 2 - 1), 1, 1);
  });
  shards.frame(dt, (q, sx, sy, a) => {
    const [x0, y0, x1, y1] = SHARD_CELLS[q.cell], w = x1 - x0, h = y1 - y0;
    if (!sx || !sy) return;
    ctx.globalAlpha = Math.max(0, Math.min(1, a * alpha));
    ctx.setTransform(sx, 0, 0, sy, q.x * 2, q.y * 2);
    ctx.drawImage(atlas, x0, y0, w, h, -w / 2, -h / 2, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// The colour of each dust texel in logoparticle_all.
export function dustColours(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  return DUST_CELLS.map(([sx, sy]) => { const d = x.getImageData(sx, sy, 1, 1).data; return [d[0], d[1], d[2]]; });
}

// ---- system menu sparkles (native 0x4c190 spawns, 0x4bd10 draws) --------------------------------------------------------
// One a frame, 100 at most: size 0.1-0.3, life 120-270 frames, alpha 0.25-0.5, anywhere on screen, rising at
// 0.13-0.5 px a frame toward a point above the top centre (480, -75 on the 960 x 540 screen). They fade in over their
// first 60 frames and out over their last 60, twinkling as they go. Drawn f x size x 80 px wide at 1080p (f the fade),
// from the top left.
// The 100 records are a ring (0xb34bc8, stride 0x24, free = -1): a new one goes in the first free record from the
// cursor (0xb34b84), which then moves past it, and they are drawn in record order. One is made each 1/60 s (0xb0190's
// frame count, kept in 0xb34b80): stepped by time here, so a browser drawing 30 frames a second (Chrome's energy
// saver) still makes 60 a second, two in a frame. 0x4bd10 draws each, then moves it (vx, -speed) and ages it; past
// its life the record is freed. Checked against the native build's frames (2026-11-08, checklist G20): normal alpha
// blending (their colour rises by k (1 - bg), not by k), and small.
export class Sparkles {
  constructor(rand = Math.random) { this.rand = rand; this.slots = new Array(100).fill(null); this.cursor = 0; this.due = 0; }
  get p() { return this.slots.filter(Boolean); }
  set p(list) { this.slots = new Array(100).fill(null); list.slice(0, 100).forEach((q, i) => { this.slots[i] = q; }); this.cursor = list.length % 100; }
  step(dt) {
    for (let i = 0; i < this.slots.length; i++) {
      const q = this.slots[i];
      if (!q) continue;
      q.age += dt; q.x += q.vx * dt; q.y -= q.speed * dt;
      if (q.age > q.life) this.slots[i] = null;
    }
    this.due = Math.min(2, this.due + dt);
    while (this.due >= 1 - 1e-6) {
      this.due -= 1;
      const at = this.free();
      if (at < 0) break;
      const r = this.rand;
      const size = r() * 0.2 + 0.1, life = Math.floor(r() * 150 + 120), alpha = 0.25 + r() * 0.25;
      const x = r() * 960, y = r() * 540, speed = r() * 0.36666667 + 0.13333334;
      this.slots[at] = { size, life, age: 0, alpha, x, y, speed, vx: (speed * (480 - x)) / (y + 75) };
      this.cursor = (at + 1) % this.slots.length;
    }
  }
  free() {
    for (let n = 0; n < this.slots.length; n++) {
      const i = (this.cursor + n) % this.slots.length;
      if (!this.slots[i]) return i;
    }
    return -1;
  }
  static fade(q) {
    if (q.age < 60) return [q.age / 60, q.alpha];
    const left = q.life - q.age;
    if (left < 60) return [left / 60, (Math.floor(q.age) & 2) ? q.alpha : q.alpha * 0.7];
    return [1, q.alpha];
  }
  // 0x4bd10: a quad from (x, y) to (x + w, y + w) on the 960 x 540 screen, w = f x size x 80 x 0.5, so f x size x 80
  // pixels at 1080p (8-24 at full; the port had them twice that), its texture coordinates 0 to 40/41 (0x3f79c190).
  static width(q) { return Sparkles.fade(q)[0] * q.size * 80 * 0.5; }
  // Those quads as the GPU gets them (two triangles each, in record order): x, y in 1080p pixels, u, v, alpha. Drawn
  // through WebGL (ui.js SparkleGL), the texture is sampled as the original's is, bilinear with no mipmaps, which keeps
  // the star's white core at these sizes; a 2D canvas's downscale tints it (218, 254, 254), and the native frames show
  // white cores (G20).
  quads(out = new Float32Array(100 * 6 * 5)) {
    let n = 0;
    const u = 40 / 41;
    for (const q of this.slots) {
      if (!q) continue;
      const [f, a] = Sparkles.fade(q);
      const w = f * q.size * 80 * 0.5;
      if (!(w > 0)) continue;
      const x0 = q.x * 2, y0 = q.y * 2, x1 = x0 + w * 2, y1 = y0 + w * 2, al = clamp01(a);
      for (const [x, y, s, t] of [[x0, y0, 0, 0], [x1, y0, u, 0], [x0, y1, 0, u], [x1, y0, u, 0], [x1, y1, u, u], [x0, y1, 0, u]]) {
        out[n++] = x; out[n++] = y; out[n++] = s; out[n++] = t; out[n++] = al;
      }
    }
    return { data: out, count: n / 5 };
  }
  draw(ctx, img, alpha = 1) {
    const src = (img.naturalWidth || img.width || 41) * (40 / 41);
    for (const q of this.slots) {
      if (!q) continue;
      const [f, a] = Sparkles.fade(q);
      const w = f * q.size * 80 * 0.5;   // 960-wide units; doubled below
      if (!(w > 0)) continue;
      ctx.globalAlpha = clamp01(a * alpha);
      ctx.drawImage(img, 0, 0, src, src, q.x * 2, q.y * 2, w * 2, w * 2);
    }
    ctx.globalAlpha = 1;
  }
}

// ---- system menu background bands (native 0x4b880) ----------------------------------------------------------------------
// menuBG01 over the scene, then four menuBG04 bands rising from the bottom and four menuBG05 bands dropping from the
// top as the menu opens (t from 0 to 1 over 60 frames, eased 1 - (1 - t)^2), each centred where the original puts it
// and as translucent as it has it. [texture, centre x, end centre y (1080p), alpha numerator, from the top?]
export const MENU_BANDS = [
  ["menuBG04_0_upscale", 960, 198, 64, false], ["menuBG04_1_upscale", 960, 160.5, 96, false],
  ["menuBG04_2_upscale", 960, 127.5, 160, false], ["menuBG04_3_upscale", 960, 82.5, 224, false],
  ["menuBG05_0_upscale", 960, 155.25, 64, true], ["menuBG05_1_upscale", 849.75, 117.75, 96, true],
  ["menuBG05_2_upscale", 960, 84.75, 128, true], ["menuBG05_3_upscale", 829.5, 39.75, 160, true],
];
export const easeOut = (t) => 1 - (1 - clamp01(t)) ** 2;
// Where band b is and how opaque, t into the opening (0-1). placed: lowering, the bands stay where they are (0x4b880).
export function bandAt(band, t, placed = false) {
  const e = easeOut(t), [, x, off, a, top] = band, p = placed ? 1 : e;
  return { x, y: top ? off * p : 1080 - off * p, alpha: (e * a) / 255 };
}

// ---- system menu cursor (native 0x4c370) ------------------------------------------------------------------------------
// The line under the cursor's row fades in over 10 frames (alpha 0xb35a08) and stretches out from its centre over 10
// (0xb35a04). The light pulses between half and full: up at 1/60 a frame, down at 1/120, starting from nothing. A new
// row (0x4cea0) restarts the stretch and the light; the line's alpha carries on.
// hidden: a screen beside the column has the focus (0x4c370: states 5-7, 10, 14, 15, and 8 / 11 while the column does
// not have the cursor, flag 0xb359e8): the line falls 0.1 a frame and the light 0.1 a frame, its rise reset to 1/60.
// Otherwise the line rises 0.1 a frame and the light rises 1/60 a frame to full, then swings between full and half at
// 1/120 a frame both ways (0x5912f0: -1/120 from the top, +1/120 from the half).
export class MenuCursor {
  constructor() { this.line = 0; this.stretch = 0; this.light = 0; this.dir = 1 / 60; }
  moved() { this.stretch = 0; this.light = 0; this.dir = 1 / 60; }
  // The menu opening from nothing (0x4cba0 at level 0: stur xzr over 0xb35a04 and 0xb35a08, then the light and its rate):
  // the line's alpha starts again too, which a new row leaves alone (N2-133).
  opened() { this.line = 0; this.stretch = 0; this.light = 0; this.dir = 1 / 60; }
  step(dt, hidden = false) {
    this.line = hidden ? Math.max(0, this.line - 0.1 * dt) : Math.min(1, this.line + 0.1 * dt);
    this.stretch = Math.min(1, this.stretch + 0.1 * dt);
    if (hidden) { this.light = Math.max(0, this.light - 0.1 * dt); this.dir = 1 / 60; return; }
    this.light += this.dir * dt;
    if (this.light > 1) { this.light = 1; this.dir = -1 / 120; }
    else if (this.light < 0.5 && this.dir < 0) { this.light = 0.5; this.dir = 1 / 120; }
  }
}
// The system menu's column (0x4c370 places buttons 0xc5-0xc9, Save, Load, Config, FlowChart, Title, at (26.67, 43.56 +
// 31.11 k) of 640 x 448: (80, 105 + 75 k) px; their table 0x591438): menu_btn_ja cells 224 x 88 from x 24 (normal), 264
// (lit) and 504 (on: the screen open beside it, and pressed), row k at y 24 + 104 k; FlowChart and Title draw their
// normal cell when on; the hit box (0, 0)-(74, 29) units from the place. menu_window is drawn at (18.67, 1) units, then
// the header (system_titlebg at (0, 0), system_scenebg at (752, 0), underline at (0, 72), the chapter's
// system_phasetitle_ja cell at (8, 0)).
export const MENU_COLUMN = { x: 80, y: 105, step: 75, cell: [224, 88], cellX: [24, 264, 504], cellY: 24, cellStep: 104,
  hit: [222, (29 * 1080) / 448], window: [56, 1080 / 448], underline: [0, 72] };

// The system menu's foreground level (0xb359f4): up at 1/18 a frame opening (0x4cba0), down at 1/30 closing (states 4, 0x12 and
// 0x15), and both ways at 1/12 for the flowchart with the background left up (states 0xe, 0x10). The save screen beside the
// column has its own level (0xf1f440): up at 0.024 a frame, down at 0.048 (0x50fc0 states 1 and 0x1b).
export const MENU_FADE = { open: 1 / 18, close: 1 / 30, flow: 1 / 12, saveIn: 0.024, saveOut: 0.048 };

// ---- the interface's 640 x 448 screen ---------------------------------------------------------------------------
// Most interface drawing sets a 640 x 448 virtual screen (0xb0650(640, 448)) and draws 1080p art at (1/3, 1080/448^-1)
// scale, so the art is 1:1 on the 1920 x 1080 stage. These turn its units into stage pixels.
export const px = (x) => x * 3;
export const py = (y) => (y * 1080) / 448;

// ---- the scroll bar (native 0x9ad04 makes it, 0x9b0c4 draws it, 0x9ae58 / 0x9ade0 / 0x9b384 move it) ----------------
// The config pages (0x2aa80), the backlog (0x27d10) and the save list (0x4f240) all use the same one, at the place
// 0x9ad04 gives it: DISP_PARTS_JA scroll_bar (the whole 16 x 888, rectangle 0xac0658) with its top left at (615.67,
// 43.56) of the 640 x 448 screen, and the unlit cell of scroll_slider ((48, 24)-(80, 312), rectangle 0xac0660) at x 613,
// its top running from 41.07 over 252.21 units as the list goes from its first position to its last. Both are drawn
// 1:1: 0xfbed4 reads nn::oe::GetOperationMode, and docked (as the PC build runs, and the 1080p stage) gives these;
// handheld would draw them at 0.868 of their height over 219.02 units. A new position is reached over 12 frames,
// quadratic out (type 3: 1 - (1 - u)^2, from where the thumb is shown); setting it at once (on opening, 0x9ade0, or
// by pressing on the strip x 613-639, y 41-409, 0x9b384) skips that.
export const SCROLLBAR = { bar: [615.6666870117188, 43.55555725097656], thumbX: 613, top: 41.06666564941406,
  track: 252.2074, frames: 12, strip: [613, 41, 639, 409], barCell: [0, 0, 16, 888], thumbCell: [48, 24, 80, 312] };
export class ScrollBarFx {
  constructor(frac = 0) { this.from = this.to = frac; this.t = SCROLLBAR.frames; }
  // frac: 0 at the list's first position, 1 at its last
  set(frac, { now = false } = {}) {
    if (now) { this.from = this.to = frac; this.t = SCROLLBAR.frames; return; }
    if (frac === this.to) return;
    this.from = this.shown();
    this.to = frac;
    this.t = 0;
  }
  step(dt) { this.t = Math.min(SCROLLBAR.frames, this.t + dt); }
  shown() {
    const u = this.t / SCROLLBAR.frames;
    const e = u >= 1 ? 1 : -(u * (u - 2));
    return this.to + (this.from - this.to) * (1 - e);
  }
  // the thumb's top on the stage
  thumbTop() { return py(SCROLLBAR.top + SCROLLBAR.track * this.shown()); }
}

// ---- the config (native 0x2b930 runs it, 0x29bf0 moves its cursor, 0x2aa80 draws it) -------------------------------
// The screen comes in and goes out at 0.024 a frame (0x2b770 / 0x2c500, the backdrop and tabs at one level, the page at
// another), a page change takes the page out and the next one in at 0.05 a frame (0x2c380); a minus or plus held
// repeats once its counter (0x46f81c, 20 at the press) has run out, then every frame. The slider's track runs 169.33
// units (508 px) from x 276.67 (830 px) on both pages; the digits are config_number_ja's 32 x 32 cells, the units digit
// at the given place and each further one 8 units (24 px) to its left (0x2d420).
// The widgets themselves (their places in each page's grid, hit boxes and cells) are the engine's tables, in
// system.json "config"; what the draw code places itself (immediates of 0x2aa80, 0x2d570, 0x2d980 and 0x29fa0, in
// stage pixels):
//   clip       the page and its widgets are cut to x 407-1809, y 165-1023 (0xb2e60 / 0xaf590(407, 165, 1402, 858))
//   innerBg    config_innerbg at (120, 0) of 640 x 448; tabBg tab_bg at (133.33, 39.82)
//   tabs       the tabs System, Sound, Controls and Reset (buttons 0x33-0x36) at (136 | 218.67 | 296 | 512, 39.82)
//   pageBg     system_bg and sound_bg at (128.67, 68.03); controls conf_manual0_ja at (133.33, 73.01)
//   systemDigits / soundDigits: the units digit of each slider's value (0x2d420): System x 450 at y 131.50, 205.75,
//              271.29, 330.61; Sound x 538.67 at y 107.44, 134.81, 163.02
//   voice      the Sound page's character rows: voice_bg's head (rectangle 0x34d640) at y 482, a band of it
//              (0x34d648) per row at 868 + 122 k and its foot (0x34d650) after the last; in a row, from its band's top:
//              the face (conf_faceicon) at (432, +12), the name (conf_name) under it at (432, +84), the value's units
//              digit at (1615, +30), and the widgets minus, slider, plus, Mute, Test at (735, +24), (362, -84),
//              (1356, +24), (1429, +12), (1681, +15) (0x29fa0: 370.01 + 50.61 k units, the slider 44.8 higher, Mute
//              4.98 and Test 3.73 higher)
export const CONFIG = { rate: 0.024, pageRate: 0.05, hold: 20, track: [830, 1338], digitStep: 24, digit: 32,
  clip: [407, 165, 1402, 858], innerBg: [360, 0], tabBg: [400, 96], tabs: [[408, 96], [656, 96], [888, 96], [1536, 96]],
  pageBg: [386, 164], controls: [400, 176], systemDigits: [1350, [317, 496, 654, 797]], soundDigits: [1616, [259, 325, 393]],
  voice: { head: 482, top: 868, step: 122, cells: { head: [0, 0, 1432, 386], row: [0, 386, 1432, 508], foot: [0, 508, 1432, 527] },
    face: [432, 12], name: [432, 84], digits: [1615, 30], widgets: [[735, 24], [362, -84], [1356, 24], [1429, 12], [1681, 15]] } };
// The Sound page's scroll range: 122 px a character row listed, less 113 (0x2a730 after 0x29fa0); the System page's
// is 485 and the Controls page's 0 (0x46f820).
export const voiceScrollMax = (rows) => Math.max(rows * 122, 113) - 113;
// A page's scroll position (0xaed368[page], whole pixels from 0 to the page's range) and the page as it is shown:
// 0x2aa80 draws it at -position + a left-over x (1 - the scroll bar's progress), the left-over taking up where the page
// was shown each time the position changes (0x2b930 / 0x29bf0 with 0x9ae58), so a new position is reached as the bar's
// thumb reaches its own, over 12 frames, quadratic out, from where the page is shown. Keys, the stick, a drag and the
// bar all move it this way; opening the screen or a page sets it at once (0x9ade0, 0x2c380).
export class ConfigScroll {
  constructor(max = 0, at = 0) { this.max = Math.max(0, max); this.from = this.target = this.clamp(at); this.t = SCROLLBAR.frames; }
  clamp(v) { return Math.max(0, Math.min(this.max, Math.trunc(v))); }
  set(v) {
    v = this.clamp(v);
    if (v === this.target) return;
    this.from = this.shown();
    this.target = v;
    this.t = 0;
  }
  jump(v) { this.from = this.target = this.clamp(v); this.t = SCROLLBAR.frames; }
  step(dt) { this.t = Math.min(SCROLLBAR.frames, this.t + dt); }
  shown() {
    const u = this.t / SCROLLBAR.frames;
    const e = u >= 1 ? 1 : -(u * (u - 2));
    return this.target + (this.from - this.target) * (1 - e);
  }
}
// Where a cursor move scrolls the page (0x29bf0's end): the widget's place y (pixels at scroll 0) is kept 260 px or
// more below the position and no more than 870 px below it; a character row's slider (widgets 99, 104, ... 189),
// whose place is its picture's top, counts from 108 px lower for the first and 98 px lower for the second. pos: the
// position now; returns the new one (whole pixels, held in 0 .. max).
export function configFollow(pos, y, { max = Infinity, voiceKnob = false } = {}) {
  const top = y - 260 + (voiceKnob ? 108 : 0);
  let next;
  if (!(pos <= top)) next = top;
  else {
    const bottom = y - 870 + (voiceKnob ? 98 : 0);
    if (bottom <= pos) return pos;
    next = bottom;
  }
  return Math.min(max, Math.max(0, Math.trunc(next)));
}
// A wheel event's distance in stage pixels (the browser's own scroll distance for it); the game has no wheel (the PC
// build turns it into buttons), so the screens that scroll take it as a scroll of that distance.
export function wheelPixels(e, scale = 1) {
  if (e.deltaMode === 1) return e.deltaY * 40;
  if (e.deltaMode === 2) return e.deltaY * 1022;
  return e.deltaY / (scale || 1);
}
// A minus / plus press steps 1, or 50 for a value whose maximum is 1000 or more (0x2b930 at 0x2bf88 / 0x2bf9c).
export const configStep = (max) => (max >= 1000 ? 50 : 1);
// The value the pointer sets on a slider (0x2b930 kind 4): (x - 276.67) / 169.33 of the maximum, cut to a whole
// number and held between 0 and the maximum. x in stage pixels.
export function sliderValue(x, max) {
  const v = Math.trunc(((x / 3 - 276.66666) / 169.33333) * max);
  return Math.min(max, Math.max(0, v));
}
// The cursor (0x29bf0). cols: each row's widget count; cur: { row, col } with row -1 the tabs' row (System, Sound,
// Controls, Default: col 0-3). Up and Down go to the nearest row that has widgets, keeping the column (the row's last
// one if it is shorter); Up from row 0 goes to the tabs, Down from the tabs to row 0 at its own column (colOf). Left and
// Right step along the row; Left from its first widget, or from the first tab, hands the cursor to the system menu's
// column in the game ("column") and does nothing from the title. tab: the tabs' row's own place (0xaed328), where Up
// from row 0 lands. Returns the new cursor, "column", or null.
export function configMove(cols, cur, dir, { inGame = true, colOf = [], tab = 0 } = {}) {
  const { row, col } = cur;
  if (row === -1) {
    if (dir === "right") return col < 3 ? { row, col: col + 1 } : null;
    if (dir === "left") return col > 0 ? { row, col: col - 1 } : inGame ? "column" : null;
    if (dir === "down") return cols.length && cols[0] > 0 ? { row: 0, col: Math.min(colOf[0] || 0, cols[0] - 1) } : null;
    return null;
  }
  if (dir === "left") return col > 0 ? { row, col: col - 1 } : inGame ? "column" : null;
  if (dir === "right") return col < cols[row] - 1 ? { row, col: col + 1 } : null;
  const d = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  if (!d) return null;
  for (let r = row + d; r >= 0 && r < cols.length; r += d) if (cols[r] > 0) return { row: r, col: Math.min(col, cols[r] - 1) };
  return dir === "up" ? { row: -1, col: tab } : null;
}
// The samples on the System page (0x2d570): the front moves the text speed's letters a frame (0x3b2d0, 768 at speed
// 0) and a trailing front follows it by 0x3b330's length; once the trailing front has 10 letters (at once at speed 0)
// the auto mode click wait counts (config +0x1c, in frames) and the sample starts again from nothing when it is over.
export function sampleTrail(speed) {
  if (!(speed > 0)) return 0;
  return (1000 / 60 / speed) * Math.min(0.5, (speed * 0.1) / 35) * 60;
}
export class SampleFx {
  constructor() { this.lo = 0; this.hi = 0; this.wait = 0; }
  // speed: ms a letter; clickMs: the auto click wait
  step(dt, speed, clickMs) {
    const lpf = speed > 0 ? 1000 / 60 / speed : 768;
    if (lpf >= 768) { this.lo = this.hi = 768; }
    else {
      if (this.lo < 768) this.lo += lpf * dt;
      this.hi = Math.max(this.hi, this.lo - sampleTrail(speed));
      if (this.hi < 10) return this;
    }
    this.wait += dt;
    if ((clickMs / 1000) * 60 < this.wait) { this.wait = 0; this.lo = this.hi = 0; }
    return this;
  }
}

// ---- the backlog (native 0x27eb0 lists the records, 0x28950 cuts them into pages, 0x28a90 runs it) ----------------
// A page viewer over the scene: a black veil at 0.75 x its alpha (0x27d10) under the page's rows, everything coming in
// and going out at 0.05 a frame (0x28f80 states 4 and 8, 0x28d50). A, or a tap left of x 543 of the 640 units (left of
// the scroll bar), asks Quick Jump for the page's first record.
export const BACKLOG = { rate: 0.05, veil: 0.75, tapX: 543 };

// The pages from the records (oldest first, as textbox.js keeps them), newest first, each its records oldest first.
// 0x27eb0 lists the records newest first and drops the oldest choice rows; the page on screen goes too: every record
// newer than the first page end (F799) after the newest one, and with no such page end there is nothing to show (a
// single record neither). 0x28950 then ends a page before each later page end, and the oldest records make the last
// page, which is left out once the 800-record log has let records go (wrapped: 0xae0470).
export function backlogPages(records, wrapped = false) {
  const list = records.slice().reverse();
  while (list.length && list.at(-1).kind === "choice") list.pop();
  if (list.length < 2) return [];
  let k = 1;
  while (k < list.length && !list[k].pageEnd) k++;
  if (k >= list.length) return [];
  const kept = list.slice(k);
  const ends = [];
  for (let i = 1; i < kept.length; i++) if (kept[i].pageEnd) ends.push(i - 1);
  ends.push(kept.length - 1);
  if (wrapped) ends.splice(Math.max(1, ends.length - 1));
  return ends.map((end, p) => kept.slice(p ? ends[p - 1] + 1 : 0, end + 1).reverse());
}

// The keys (0x28a90), with page 0 the newest and max the oldest. Up (or the wheel up) goes to an older page, Down to a
// newer one; a held key stops at the end and a fresh press wraps round. Left goes to the oldest page and Right to the
// newest, on fresh presses only. Returns the page after the key.
export function backlogStep(page, max, dir, fresh = true) {
  if (dir === "up") return page < max ? page + 1 : fresh ? 0 : page;
  if (dir === "down") return page > 0 ? page - 1 : fresh ? max : page;
  if (!fresh) return page;
  if (dir === "left") return max;
  if (dir === "right") return 0;
  return page;
}

// The scrolling log's pages (ui.js backlog): every record, oldest first, cut where the text window's pages ended (a
// record with pageEnd is its page's last; the rows of a choice end theirs), the page on screen being the last. Once
// the 800-record log has let records go, the oldest page may have lost its first rows and is left out, as above.
export function logPages(records, wrapped = false) {
  const pages = [];
  let page = [];
  for (const r of records) {
    page.push(r);
    if (r.pageEnd) { pages.push(page); page = []; }
  }
  if (page.length) pages.push(page);
  if (wrapped && pages.length > 1) pages.shift();
  return pages;
}

// ---- choices (native 0x83e50 runs them, 0x84e50 draws them) ------------------------------------------------------
// States as the original numbers them: 1 fading in (+0.04 a frame), 2 the labels typing out (all at once, each by
// the text speed; a press finishes them), 3 choosing, 4 taken (fading out at 0.028 a frame while the "taken"
// effects run over 50 frames, 0.02 a frame). The cursor: moving it starts a 10-frame cross-fade from the line left
// (t, +0.1 a frame) and restarts the pulse of the light streak, which runs between 1/3 and 1 at 1/90 a frame.
export const CHOICE = {
  fadeIn: 0.04, fadeOut: 0.028, taken: 0.02, cross: 0.1, pulse: 0.011111166, pulseLow: 0.33333,
  // Places on the 640 x 448 screen, from the row's top (y): the label at x 88; the cross-faded glow of the label at
  // (82.67, y - 3.32); the underline (altermenu_underline) at (71.67, y + 11.61), 10% to 100% of its width as t rises;
  // the light streak (altermenu_ lens line) at (-65.33, y - 30.70); the ring (altermenu_ circle) centred at
  // (86, y + 24.47); the lens flare at (5, y - 377.9). The flash covers the screen.
  labelX: 88, underline: [71.6667, 11.6148], streak: [-65.3333, -30.6963], ring: [86, 24.4741], flare: [5, -377.8963],
};
// The cursor (0x83e50 state 3 with 0x83b20's start): nothing is selected at first (-1), so a press of A does nothing
// until a direction has picked a row. Up and Down step to the next row that is not locked (SELR's third argument) and
// wrap round only on a fresh press or a wheel turn, a held repeat stopping at the end; from nothing both pick the first
// row. Left goes to the first row and Right to the last (fresh presses only; Left from nothing does nothing). A tap
// picks a row (sound 0) and a second tap on it takes it; locked rows ignore taps. Moving with keys makes no sound
// (the only cursor sound in 0x83e50's choice path, L_84694, is the tap's).
export function choiceStep(cur, dir, locked, fresh = true, wheel = false) {
  const n = locked.length;
  if (!n) return cur;
  const free = (i) => !locked[i];
  let i = cur;
  if (dir === "up" || dir === "down") {
    const fwd = dir === "down" || cur < 0;
    for (let tries = 0; tries < n; tries++) {
      i = fwd ? (i + 1 < n ? i + 1 : 0) : (i - 1 >= 0 ? i - 1 : n - 1);
      if (free(i)) break;
    }
    const wrapped = dir === "up" ? i > cur && cur >= 0 : i < cur;
    if (wrapped && !fresh && !wheel) return cur;
    return i;
  }
  if (!fresh) return cur;
  if (dir === "left") {
    if (cur < 0) return cur;
    i = 0;
    while (i < n - 1 && !free(i)) i++;
    return i;
  }
  if (dir === "right") {
    i = Math.max(cur, n - 1);
    while (i > 0 && !free(i)) i--;
    return i;
  }
  return cur;
}

export class ChoiceFx {
  // n labels; perFrame: characters a frame (0x3b2d0: 16.67 / the speed in ms a letter; 768, all, at speed 0).
  // locked: rows that cannot be chosen (SELR's third argument).
  // The rows' front has two steps on the frame the choice first shows, and a letter is out once the front is past it, as in the
  // story's text (TODO item 51, native frames at 60 ms a letter: "1" on the choice's first frame, "." two frames later, the "W"
  // nine and the "a" thirteen frames after the first).
  constructor(n, perFrame = 768, locked = []) {
    this.n = n; this.perFrame = perFrame;
    this.locked = Array.from({ length: n }, (_, i) => !!locked[i]);
    this.state = 1; this.alpha = 0; this.shown = new Array(n).fill(0); this.started = false;
    this.cur = -1; this.prev = -1; this.t = 1; this.pulse = 1; this.rate = -CHOICE.pulse;
    this.out = 0; this.done = false;
  }
  // A key or the wheel (see choiceStep). Returns true when the cursor moved.
  key(dir, fresh = true, wheel = false) { return this.move(choiceStep(this.cur, dir, this.locked, fresh, wheel)); }
  // A tap on row i: the first picks it, a second takes it. Returns "moved", "taken" or null.
  tap(i) {
    if (this.state !== 3 || this.locked[i]) return null;
    if (i !== this.cur) return this.move(i) ? "moved" : null;
    return this.take() ? "taken" : null;
  }
  static perFrame(msPerLetter) { return msPerLetter > 0 ? (1000 / 60) / msPerLetter : 768; }
  // lengths: each label's letter count. Returns true once every label is out.
  typed(lengths) { return lengths.every((len, i) => this.shown[i] >= len); }
  // The letters of row i that are out: those the front has passed.
  letters(i, len) { return Math.min(len, Math.ceil(this.shown[i] - 1e-6)); }
  finishTyping() { this.shown.fill(768); }
  step(dt, lengths) {
    this.t = towards(this.t, CHOICE.cross * dt);
    this.pulse += this.rate * dt;
    if (this.pulse > 1) { this.pulse = 1; this.rate = -CHOICE.pulse; }
    else if (this.pulse < CHOICE.pulseLow) { this.pulse = CHOICE.pulseLow; this.rate = CHOICE.pulse; }
    if (!this.started) { this.started = true; this.shown.fill(Math.min(768, 2 * this.perFrame)); }
    else for (let i = 0; i < this.n; i++) if (this.shown[i] < 768) this.shown[i] = Math.min(768, this.shown[i] + this.perFrame * dt);
    if (this.state === 1) {
      this.alpha = towards(this.alpha, CHOICE.fadeIn * dt);
      if (this.alpha === 1) this.state = 2;
    }
    if (this.state === 2 && this.typed(lengths)) this.state = 3;
    if (this.state === 4) {
      this.alpha = towards(this.alpha, -CHOICE.fadeOut * dt);
      this.out = towards(this.out, -CHOICE.taken * dt);
      if (this.out === 0) this.done = true;
    }
  }
  // Returns true when the cursor moved.
  move(i) {
    if (this.state !== 3 || i === this.cur || i < 0 || i >= this.n || this.locked[i]) return false;
    this.prev = this.cur; this.cur = i; this.t = 0; this.pulse = 1; this.rate = -CHOICE.pulse;
    return true;
  }
  // Returns true when taken (sound 4); nothing is taken while no row is selected.
  take() {
    if (this.state !== 3 || this.cur < 0) return false;
    this.state = 4; this.out = 1;
    return true;
  }
  // How a row's highlight looks: the glow's alpha (the current row fades in, the one left fades out).
  glow(i) {
    if (i === this.cur) return this.alpha * this.t * 0.5;
    if (i === this.prev) return this.alpha * (1 - this.t) * 0.5;
    return 0;
  }
  // The "taken" effects, with s = sin(out * pi / 2): the ring scaled (1 - s) * 1.4 + 0.1 and turned (1 - s) of a
  // turn, all at the screen's alpha.
  taken() {
    const s = Math.sin((this.out * Math.PI) / 2);
    return { scale: (1 - s) * 1.4 + 0.1, turn: 1 - s, alpha: this.alpha };
  }
}

// ---- yes / no dialog (native 0x4ad40 opens it, 0x49f00 runs it, 0x4ae90 draws it) ---------------------------------
// Opening plays sound 3 and t rises 0.07 a frame; the backdrop (dialog_BG) is at 0.75 t, the window at t, scaled
// (1 + 0.2 (1 - t))^2 as it opens. The question and buttons appear once t is 1. A choice plays sound 1 and holds the
// pressed button 15 frames; Back plays 2 and answers No after one. Closing, t falls 0.07 a frame and the window shrinks
// ((1 - 0.2 (1 - t))^2) after Yes or grows after No. The caller acts on the frame after the hold ran out (0xb34b54 goes
// to 0 with state 4, N2-48), while the window fades: `acting`.
export const DIALOG = { rate: 0.07, amp: 0.2, squared: true, hold: 15, backdrop: 0.75 };
// A notice (native 0x4abe0 opens it, 0x49750 runs it, 0x48540 draws it): a message in the system's window (SYSMES 183-193,
// 201-210, 213-215 or 1496, else none), no backdrop, the window at t, growing into place ((1 - 0.2 (1 - t))^2) as it
// comes in at 0.07 a frame and shrinking the same way as it goes; the text shows only at t = 1, at y 214 of 448 (the
// question's 184 + 30). Up (state 2) its frames count down (480 for most, 0x1e0; 1200 for "Saving") and it goes at 0; A,
// B or a tap (touch flags 0x2008) close it sooner, unless the caller holds it (0x4abd0(1)), as the save screen does
// while it writes; the caller then closes it itself (0x4acd0). `busy` is 0xb34b44: on from the opening, off the moment
// it starts to close (N2-176). Keys do nothing while it comes in.
export const NOTICE = { rate: 0.07, hold: 480, amp: 0.2, top: 512.3 };
export class NoticeFx {
  constructor(hold = NOTICE.hold, held = false) { this.state = 1; this.t = 0; this.frames = hold; this.held = held; }
  step(dt) {
    if (this.state === 1) { this.t = Math.min(1, this.t + NOTICE.rate * dt); if (this.t === 1) this.state = 2; }
    else if (this.state === 2) {
      if (this.frames < 100000) this.frames -= dt;
      if (!this.held && this.frames < 1) this.state = 3;
    } else if (this.state === 3) { this.t = Math.max(0, this.t - NOTICE.rate * dt); if (this.t === 0) this.state = 0; }
    return this;
  }
  // A, B or a tap: true when it closes the notice
  press() { if (this.state !== 2 || this.held) return false; this.state = 3; return true; }
  // the caller's close (0x4acd0), held or not
  close() { if (this.state === 1 || this.state === 2) this.state = 3; }
  get closed() { return this.state === 0; }
  get busy() { return this.state === 1 || this.state === 2; }
  get scale() { const s = 1 - NOTICE.amp * (1 - this.t); return s * s; }
}
// SELS and SELA (native 0x83e50 modes 2 and 3, drawn by 0x85900 / 0x85e40): in and out at 0.1 a frame, the backdrop at
// full, the window, question and buttons all at t on every frame. Nothing scales as it opens (0x83b20 leaves the state
// at 0, not the 1 that 0x85900 scales for); closing (state 4) the window and question are 1 - 0.05 (1 - t) of their
// size, except SELA's Yes, which fades at its size to the save screen (state 5: `keepSize`). No hold.
export const STORY_DIALOG = { rate: 0.1, amp: 0.05, squared: false, hold: 0, backdrop: 1 };
export class DialogFx {
  constructor(kind = "system") {
    this.k = kind === "story" ? STORY_DIALOG : DIALOG;
    this.state = 1; this.t = 0; this.answer = null; this.hold = 0; this.keepSize = false;
  }
  step(dt) {
    const k = this.k;
    if (this.state === 1) { this.t = towards(this.t, k.rate * dt); if (this.t === 1) this.state = 2; }
    else if (this.state === 3) { this.hold -= dt; if (this.hold <= 0) this.state = 4; }
    else if (this.state === 4) { this.t = towards(this.t, -k.rate * dt); if (this.t === 0) this.state = 0; }
  }
  get open() { return this.state === 2; }
  get closed() { return this.state === 0; }
  // The fade has begun: the caller of the system's window acts from here (it read 0xb34b54 = 0 the frame after state 4).
  get acting() { return this.state === 4 && this.t < 1; }
  // yes: the answer; pressed: chosen (held 15 frames) rather than backed out of (1 frame).
  answerWith(yes, pressed = true) {
    if (this.state !== 2) return false;
    this.answer = yes;
    const hold = pressed ? this.k.hold : Math.min(1, this.k.hold);
    this.state = hold > 0 ? 3 : 4; this.hold = hold;
    return true;
  }
  get scale() {
    const k = this.k, d = k.amp * (1 - this.t);
    if (!k.squared) return this.state === 4 && !this.keepSize ? 1 - d : 1;
    const s = this.state === 1 || this.state === 2 || !this.answer ? 1 + d : 1 - d;
    return s * s;
  }
}

// ---- a left press or a touch as the screens read it (native 0xad4e0; on PC a left press is a touch) -----------------
// A release sets the tap flag 0x2 when it came 4-24 frames after the press, and 0x2000 for 7-199 frames, only if the touch
// never strayed more than 6 units (|dx| + |dy|, 640 x 448 units) from where it began and made no flick (more than 6 units in
// its last two frames on either axis). The frames count from the last frame without a touch, one more than the touch
// lasted, except for the first press after 256 frames (+0xc ran out), which counts from itself. The PC build's touch reader
// reports the release in one more sample that still counts as touching (hle_hid_tsuki.cpp), measured on a native run:
// a 30 ms press after an earlier one counted as a tap. The pointer is read in whole units of the screen through the
// touch panel's 1280 x 720.
export const TAP = { min: 4, max: 24, longMin: 7, longMax: 199, slop: 6, flick: 6, idle: 256 };
const FRAME_MS = 1000 / 60;
const touchUnits = (x, y) => [Math.trunc(x / 3), Math.trunc((Math.trunc((y * 2) / 3) * 448) / 720)];
export class TouchPress {
  constructor() { this.press = null; this.idleAt = -Infinity; }
  // x, y: stage pixels; now: ms.
  down(x, y, now) {
    const [ux, uy] = touchUnits(x, y);
    const fresh = now >= this.idleAt;
    if (fresh) this.idleAt = now + TAP.idle * FRAME_MS;
    this.press = { x0: ux, y0: uy, at: now, fresh, moved: false, path: [[now, ux, uy]] };
  }
  move(x, y, now) {
    const p = this.press;
    if (!p) return;
    const [ux, uy] = touchUnits(x, y);
    if (Math.abs(ux - p.x0) + Math.abs(uy - p.y0) > TAP.slop) p.moved = true;
    p.path.push([now, ux, uy]);
    if (p.path.length > 16) p.path.shift();
  }
  // What the release sets: { tap: 4-24 frames, long: 7-199 frames }.
  up(now) {
    const p = this.press;
    this.press = null;
    if (!p) return { tap: false, long: false };
    const last = p.path.at(-1);
    const was = [...p.path].reverse().find(([t]) => t <= now - 2 * FRAME_MS) || p.path[0];
    const flicked = Math.abs(last[1] - was[1]) > TAP.flick || Math.abs(last[2] - was[2]) > TAP.flick;
    const frames = Math.ceil((now - p.at) / FRAME_MS - 1e-9) + 1 + (p.fresh ? 0 : 1);
    const clean = !p.moved && !flicked;
    return { tap: clean && frames >= TAP.min && frames <= TAP.max, long: clean && frames >= TAP.longMin && frames <= TAP.longMax };
  }
}
// A button's hit box on the stage (0xae840): hit is (x0, y0, x1, y1) of its table in units from the button's place (cut to
// whole units), and the test takes both ends, in the whole units of TouchPress. The buttons' tables: the story's
// (group 13, 0x65bbc0) and the system's (group 15, 0x590f08).
export const STORY_HIT = [-10, -10, 60, 45], SYSTEM_HIT = [0, -2, 72, 24];
export function hitBoxPixels([ax, ay], [x0, y0, x1, y1]) {
  const tx = Math.trunc(ax), ty = Math.trunc(ay), row = (u) => Math.ceil(Math.ceil((u * 720) / 448) * 1.5);
  return { left: (tx + x0) * 3, right: (tx + x1 + 1) * 3, top: row(ty + y0), bottom: row(ty + y1 + 1) };
}

// ---- click marks (native 0x38ec0, called from the text window 0x391a0) ---------------------------------------------
// Kind 0: lineBreak_a (105 cells of 39 x 39); 1: pageBreak_a (105 cells) at half alpha; 2: Ciel's page mark
// (pageBreak_ciel_a, 59 cells of 43 x 46). A frame counter picks the cell every other frame, so a loop of 105 takes
// 3.5 s. The mark fades in at 0.1 a frame once the text waits (0x391a0, 0xafec88), and is drawn at (0.36, 0.45)
// of the 640 x 448 scale: 1.08 times its size on the 1080p stage.
export const CLICK_MARK = [
  { name: "lineBreak_a", cells: 105, w: 39, h: 39, alpha: 1 },
  { name: "pageBreak_a", cells: 105, w: 39, h: 39, alpha: 0.5 },
  { name: "pageBreak_ciel_a-1920x1080", cells: 59, w: 43, h: 46, alpha: 1 },
];
export const CLICK_MARK_SCALE = [0.36 * 3, 0.45 * (1080 / 448)];
export const clickMarkCell = (frames, kind) => Math.floor(Math.max(0, frames) / 2) % CLICK_MARK[kind].cells;
export const CLICK_MARK_FADE = 0.1;

// ---- the mode panel (native 0x4e170 runs it, 0x4de10 draws it) ----------------------------------------------------
// It comes down and goes up at 0.05 a frame, from 43.14 units above the screen (104 px) to the top; it does not fade.
export const PANEL = { rate: 0.05, from: -py(43.1418) };

// ---- the skip and rewind indicator (native 0x3b5f0) ----------------------------------------------------------------
// mode_disp holds five 88 x 88 icons; the state picks one, centred at y 38.16 (92 px): 1 |<< and 2 << at x 546.67,
// 3 >>, 4 >>| and 5 >> (at 0.6 alpha, plain skipping) at 626.67 (1880 px). It fades in and out at 0.05 a frame.
export const MODE_ICONS = { 1: [0, 546.6667, 1], 2: [88, 546.6667, 1], 3: [264, 626.6667, 1], 4: [352, 626.6667, 1], 5: [264, 626.6667, 0.6] };
export const MODE_ICON_Y = 38.1628;
export const MODE_ICON_RATE = 0.05;

// ---- easing (native tweens 0x26720 / 0x268ac; classes from 0x26774, in Penner's order) -----------------------------
// Type 2 is quadratic (0x26a18 in, 0x26a30 out, 0x26a50 in-out), type 3 cubic (0x26aa8, 0x26ac4, 0x26af0).
export const EASE = {
  quad: { in: (t) => t * t, out: (t) => t * (2 - t), inout: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) },
  cubic: { in: (t) => t * t * t, out: (t) => (t - 1) ** 3 + 1, inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 + 4 * (t - 1) ** 3) },
};

// ---- a button's look (native 0xae840 updates every button, 0xaeec0 draws them) -----------------------------------------
// States: 0 normal, 1 lit (under the cursor), 2 switched on, 3 lit and on, 4 pressed. 0xae040(button, 10) holds a
// button pressed for 10 frames. When a button lights up (0 -> 1, or 2 -> 3) its lit cells are drawn again, added, at a
// level that starts at 1 and falls 0.1 a frame (the rate every button is registered with, 0xadca0); every interface
// button group has the flag (0x20) for it.
export class ButtonState {
  constructor() { this.state = 0; this.prev = 0; this.flash = 0; this.press = 0; }
  step(dt, lit, on = false) {
    let s;
    if (this.press > 0) { this.press = Math.max(0, this.press - dt); s = 4; }
    else s = lit ? (on ? 3 : 1) : (on ? 2 : 0);
    if (s !== this.state) { this.prev = this.state; this.state = s; this.flash = 1; }
    if ((s === 1 && this.prev === 0) || (s === 3 && this.prev === 2)) {
      this.flash = Math.max(0, this.flash - 0.1 * dt);
      if (this.flash === 0) this.prev = s;
    } else { this.flash = 0; this.prev = s; }
    return this;
  }
  pressFor(frames = 10) { this.press = frames; }
}

// ---- the title menu's rows and GALLERY (native 0x8e200 state 0x11 item 5, states 0x30 and 0x3f; drawn by 0x8d5d0) ------
// Rows sit at (272, top + 23.23 k) of 640 x 448: top 298.67 for five, 312.36 for four (table 0x352af4, by count).
// GALLERY (item 5, not held pressed) plays 1, raises the system menu's background (0x49630(0.02)) and goes straight to
// state 0x30: the title's black (0x1536184) rises 0.02 a frame to 1.2, then 0x90180 and state 0x3f return 7 and the
// gallery opens (0x48ac0 case 7, 0x47ae0). It writes state 0x29 first and overwrites it at once (0x8f5c4-0x8f600), so
// the GALLERY submenu of states 0x29-0x2c (extra_menu_ja, button group 11) never shows in this build.
export const TITLE_MENU = { x: 272, pitch: 23.2296, top: { 4: 312.3556, 5: 298.6667 }, rate: 0.02, to: 1.2 };
export function titleRowTop(count, k) { return (TITLE_MENU.top[count] ?? TITLE_MENU.top[5]) + TITLE_MENU.pitch * k; }

// The title logo's alpha (0x1536194, 0x8d5d0): it only moves while the title's black is under 0.5; while the system
// menu's background is up (0x4bcf0 above 0) it falls 1/60 a frame and its three pieces, the light and the dust all take
// it as it is; otherwise it rises 1/120 a frame and the pieces take it, squared and cubed, the light and the dust cubed.
export const TITLE_LOGO = { rise: 1 / 120, fall: 1 / 60, freeze: 0.5 };
export function titleLogo(level, dt, { bgUp = false, black = 0 } = {}) {
  if (black >= TITLE_LOGO.freeze) return { level, rising: false };
  if (bgUp) return { level: clamp01(level - TITLE_LOGO.fall * dt), rising: false };
  return { level: clamp01(level + TITLE_LOGO.rise * dt), rising: true };
}
// Piece k (0-2) of the logo; k 2 is also the light's and the dust's.
export const titleLogoAlpha = (logo, k) => (logo.rising ? logo.level ** (k + 1) : logo.level);
// titlemenu_lumi's glow swings between 0 and 1 at 1/120 a frame (0x1536168 / 0x153616c, set by 0x8d2f0).
export const TITLE_GLOW_RATE = 1 / 120;
// A menu row's alpha (0x8dc74-0x8dcbc): the logo's third piece (0x1536198) times clamp(2m - (row + 1) / n). m (0xae0b78)
// only ever follows 1 - black upward, so the rows wait for the logo: at about frame 42 of a fresh title it starts up, and the
// rows are full with it at about frame 162.
export const titleRowAlpha = (logoAlpha, m, row, count) => logoAlpha * clamp01(2 * m - (row + 1) / count);
// The title's music fades (0x9c9b0), in level units a frame from 100: press any button 200 frames (3.33 s), so it carries
// on into the cautions; New Game, Continue and a load from the title 66.7 frames (1.11 s).
export const TITLE_MUSIC = { pressAny: 0.5, start: 1.5 };
// The first launch's title (G010 = 1, 0x8d5d0's other branch), in stage pixels: title_bg0 (2670 x 1266) at 0.94 about
// its centre (480, 256 of 960 x 544; scale 0.47, 0.4735), press_start (472 x 88) with its top centre at (480, 411.586 of
// 960 x 540; scale 0.5, 0.5037). The prompt's alpha is 0 until the fade in has ended (states 2, 4, 5, 8: three frames
// after the black has gone), then runs 0 to 1 to 0 at 1/60 a frame.
export const FIRST_LAUNCH = { bg: { w: 2670, h: 1266, cx: 960, cy: 508.235, scale: 0.94 },
  press: { w: 472, h: 88, x: 724, y: 823.17, scaleY: 1.00737 }, rate: 1 / 60, settle: 3 };
// The prompt's pulse (0x8e200 state 9): up to 1, down to 0, and again.
export function pressPulse(p, dt) {
  let { alpha, up } = p;
  alpha += (up ? FIRST_LAUNCH.rate : -FIRST_LAUNCH.rate) * dt;
  if (alpha >= 1) { alpha = 1; up = false; } else if (alpha <= 0) { alpha = 0; up = true; }
  return { alpha, up };
}
// The white of 0x8d5d0 and 0x902f0: the rectangle at min(w, 1), then added again at half that (blend 0x1e), so the
// screen is (1 - w) c + 1.5 w, clamped. Rates: New Game and the cautions' end 0.01 a frame to 1.2 (state 0x14); while the
// second caution fades out 0.02 a frame alongside it (state 0xd), so state 0x14 starts from about 1 and holds 20 frames.
export const TITLE_WHITE = { to: 1.2, rate: 0.01, caution: 0.02 };

// ---- the system menu's background level (native 0x49630 sets the rate, 0x4b880 steps and draws it) ------------------
// menuBG01 (about a third opaque) is drawn at the level (0xb34b70), which moves by the rate a frame (0xb34b74). The
// bands have their own t (0xb34b78): raising runs it at 1/60 a frame and the bands close in, eased 1 - (1 - t)^2;
// lowering runs it down at the (negative) rate with the bands left where they are. Each band's alpha is t eased times
// its own, not the level (bandAt).
export class MenuBgFade {
  constructor(level = 0, t = level) { this.level = level; this.t = t; this.rate = 0; this.tRate = 0; }
  set(rate) {
    this.rate = rate;
    if (rate > 0) this.tRate = 1 / 60;
    else if (rate < 0) this.tRate = rate;
    return this;
  }
  step(dt) {
    this.t = clamp01(this.t + this.tRate * dt);
    this.level = clamp01(this.level + this.rate * dt);
    return this;
  }
  band(band) { return bandAt(band, this.t, this.tRate < 0); }
}

// ---- the engine's tweens (0x26720(tween, type, mode), 0x26894(from, to, seconds, delay), 0x268ac(dt)) -----------------
// Mode 0 eases in, 1 out, 2 in and out (the class's methods at +0x10, +0x18, +0x20: 0x26a18, 0x26a30, 0x26a50 for type 2).
// Time is in seconds; dt here is in 60 fps frames.
export class Tween {
  constructor(from, to, seconds, ease = EASE.quad.in) { this.from = from; this.to = to; this.d = seconds; this.ease = ease; this.t = 0; }
  step(dt) { this.t = Math.min(this.d, this.t + dt / 60); return this.value; }
  get value() { return this.from + (this.to - this.from) * this.ease(this.d > 0 ? this.t / this.d : 1); }
  get done() { return this.t >= this.d; }
}
// The gallery's column (0x6934 / 0x6bbc), the open section's header (0x5c4c) and the gallery's flowchart (0x110d4
// state 0) come in from 0 to 1 over half a second, type 2 mode 0; they leave (0x7ac4 for the title, 0x8400 / 0x7328 for
// the flowchart, 0x5ea4, 0x11bec) from 1 to 0, type 2 mode 1.
export const GALLERY_FADE = 0.5;
export const fadeIn = () => new Tween(0, 1, GALLERY_FADE, EASE.quad.in);
export const fadeOut = () => new Tween(1, 0, GALLERY_FADE, EASE.quad.out);
// The gallery opened from the title (checklist G20), timed from the native build's frames (PC build, reference save,
// two runs, every frame dumped; seconds). Its engine clock gives each frame the time since the last, at most 0.5 s
// (0xef08c), and the gallery's first frames are loading frames: the title's screen stays up ~0.35 s after its black is
// complete (frames of ~0.24 s and ~0.1 s), and the timers started in them have run on by the gallery's first frame.
// hold: the wait before the gallery shows; cascade: how far the CG grid's thumbnails (0xb318, sprite tweens) are on
// its first frame (0.47 and 0.51 measured); scrollBar: the scroll bar's own 0.5 s fade (0.245); second: the next
// frame's length (every timer +0.1 s). The column, its band, the header, the inner panel and the grid cursor start
// from 0 on the first frame (0x6934 starts their timer, 0x6bbc steps it from the next).
export const GALLERY_OPEN = { hold: 0.35, cascade: 0.49, scrollBar: 0.245, second: 0.1 };

// ---- story movies -------------------------------------------------------------------------------------------
// Story movies (TOMP n; native task 0x402a0 / 0x40480 / 0x40940 / 0x40a00). Per number: [G005 bit that says it has been
// seen, frame its picture leaves at]; these six cannot be passed before they have been seen once (0x92400), and their
// bit is set when they end, passed or not (0x40a00 -> 0x923c0). The chapter titles (8-12, 14-34) come in from their
// cover over 48 frames and leave it from frame 312 over 48, and play interface sound 7 as they start (0xacfa0; 13 at
// frame 210 instead); the others cut in and out. A pass fades the picture to the cover over 60 frames. The cover is
// white for 5 and 37 (5 turns black after 60 frames), black otherwise. The prologue (4) starts music 2 at frame 21600
// (360 s), or at once when it is passed early.
export const STORY_MOVIES = { 4: [2, 23040], 5: [0, 6420], 6: [1, 6300], 35: [3, 18961], 36: [4, 8880], 37: [5, 15240] };
// What the port asks before a try to pass a movie goes through (the game asks nothing; these are at the user's request): the prologue's first
// showing, which the game cannot pass, may be left after a question; the two opening songs cannot be passed the first time and ask from then
// on; the three end credits (ed01_arc, ed02_ciel, ed03_ciel) always ask. Null: no question, the movie's own rule decides.
export function movieQuestion(n, seen) {
  if (n === 4) return seen ? null : "Skip intro video?";
  if (n === 5 || n === 6) return seen ? "Skip opening animation?" : null;
  if (n === 35 || n === 36 || n === 37) return "Skip Outro?";
  return null;
}
// Whether the title's movie has a picture, so that the still under its name stays away. Once it has one it keeps it for as long as the movie is on
// screen: a seek back at the loop or a stall drops readyState below 2 for a moment while the video goes on showing its last frame, and Firefox takes
// 0.12 to 0.3 s over that seek, in which the still flashed up over the movie.
export function titleMovieUp(was, movie) {
  return !!movie && movie.style.display === "block" && (was || movie.readyState >= 2);
}
export function movieLook(n) {
  const titles = (n >= 8 && n <= 12) || (n >= 14 && n <= 34);
  return {
    fadeIn: titles ? 48 : 0,
    leaveAt: STORY_MOVIES[n]?.[1] ?? (n === 13 ? 540 : titles ? 312 : n >= 39 && n <= 45 ? 618 : 420),
    fadeOut: titles ? 48 : 0,
    white: n === 5 || n === 37,
    chime: titles ? 0 : n === 13 ? 210 : null,
  };
}
