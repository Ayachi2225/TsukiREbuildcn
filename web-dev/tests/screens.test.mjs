import test from "node:test";
import assert from "node:assert/strict";
import { ButtonState, CHOICE, CLICK_MARK, ChoiceFx, DialogFx, EASE, GALLERY_FADE, MENU_BANDS, MODE_ICONS, MenuBgFade, PANEL, TITLE_GLOW_RATE, TITLE_MENU, Tween, clickMarkCell, fadeIn, fadeOut, px, py, titleLogo, titleLogoAlpha, titleRowAlpha, titleRowTop, FIRST_LAUNCH, pressPulse, TITLE_MUSIC, TITLE_WHITE } from "../../web/app/js/uifx.js";

const run = (fx, frames, ...args) => { for (let i = 0; i < frames; i++) fx.step(1, ...args); };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("the 640 x 448 interface screen maps onto the 1080p stage", () => {
  assert.equal(px(640), 1920);
  assert.equal(py(448), 1080);
  near(py(36.918518), 89, 0.01);   // the first save slot
});

test("choices fade in at 0.04 a frame, type their labels together, then wait for the player", () => {
  const fx = new ChoiceFx(2, ChoiceFx.perFrame(50));   // 50 ms a letter: a third of a letter a frame
  near(ChoiceFx.perFrame(50), 1 / 3);
  assert.equal(ChoiceFx.perFrame(0), 768);
  const lengths = [10, 30];
  run(fx, 24, lengths);
  assert.equal(fx.state, 1);
  near(fx.alpha, 0.96);
  run(fx, 1, lengths);
  assert.equal(fx.state, 2);   // 25 frames in, typing goes on
  assert.equal(fx.move(1), false);   // no cursor before the labels are out
  run(fx, 63, lengths);
  assert.equal(fx.state, 2);
  run(fx, 2, lengths);
  assert.equal(fx.state, 3);   // 30 letters at a third a frame, two steps on the first frame (TODO item 51): out by frame 90
  assert.ok(fx.shown[0] >= 10 && fx.shown[1] >= 30);
  // A press finishes the typing at once.
  const g = new ChoiceFx(1, 0.1);
  run(g, 25, [50]);
  g.finishTyping();
  run(g, 1, [50]);
  assert.equal(g.state, 3);
});

test("moving the cursor cross-fades the glow over 10 frames and restarts the streak's pulse", () => {
  const fx = new ChoiceFx(3, 768);
  run(fx, 30, [1, 1, 1]);
  assert.equal(fx.state, 3);
  assert.equal(fx.cur, -1);   // nothing selected at first (0x83b20)
  assert.equal(fx.glow(0), 0);
  assert.equal(fx.move(0), true);
  run(fx, 10, [1, 1, 1]);
  near(fx.glow(0), 0.5);
  assert.equal(fx.move(0), false);
  assert.equal(fx.move(2), true);
  assert.equal(fx.glow(2), 0);
  near(fx.glow(0), 0.5);   // the line left still glows, fading out
  run(fx, 5, [1, 1, 1]);
  near(fx.glow(2), 0.25);
  near(fx.glow(0), 0.25);
  run(fx, 5, [1, 1, 1]);
  near(fx.glow(2), 0.5);
  near(fx.glow(0), 0);
  // The streak: from 1 down to 1/3 at 1/90 a frame (the first step below 0.33333 is held there), then back up.
  const p = new ChoiceFx(2, 768);
  p.state = 3; p.move(1);
  run(p, 60, [1, 1]);
  near(p.pulse, 1 - 60 * CHOICE.pulse);
  run(p, 1, [1, 1]);
  near(p.pulse, CHOICE.pulseLow);
  run(p, 30, [1, 1]);
  near(p.pulse, CHOICE.pulseLow + 30 * CHOICE.pulse, 1e-6);
});

test("taking a choice fades the screen at 0.028 a frame while the ring grows and turns over 50 frames", () => {
  const fx = new ChoiceFx(2, 768);
  run(fx, 30, [1, 1]);
  assert.equal(fx.take(), false);   // nothing selected yet: A does nothing
  fx.move(0);
  assert.equal(fx.take(), true);
  assert.equal(fx.take(), false);
  assert.equal(fx.state, 4);
  let k = fx.taken();
  near(k.scale, 0.1);
  near(k.turn, 0);
  run(fx, 25, [1, 1]);
  k = fx.taken();
  near(k.alpha, 1 - 25 * CHOICE.fadeOut);
  near(k.turn, 1 - Math.sin(Math.PI / 4));
  run(fx, 24, [1, 1]);
  assert.equal(fx.done, false);
  run(fx, 1, [1, 1]);
  assert.equal(fx.done, true);
  k = fx.taken();
  near(k.scale, 1.5);
  near(k.turn, 1);
  assert.equal(k.alpha, 0);
});

test("the system dialog opens at 0.07 a frame from 1.2^2, holds a choice 15 frames and closes", () => {
  const d = new DialogFx();
  near(d.scale, 1.44);
  assert.equal(d.answerWith(true), false);   // not while opening
  run(d, 14);
  assert.equal(d.state, 1);
  run(d, 1);
  assert.equal(d.open, true);
  near(d.scale, 1);
  assert.equal(d.answerWith(true), true);
  run(d, 14);
  assert.equal(d.state, 3);
  run(d, 1);
  assert.equal(d.state, 4);
  run(d, 5);
  near(d.scale, (1 - 0.2 * 0.35) ** 2);   // Yes: it shrinks
  run(d, 10);
  assert.equal(d.closed, true);
  // Back answers No after one frame, and the window grows as it goes.
  const n = new DialogFx();
  run(n, 15);
  n.answerWith(false, false);
  run(n, 1);
  assert.equal(n.state, 4);
  run(n, 5);
  near(n.scale, (1 + 0.2 * 0.35) ** 2);
});

test("the story's question (SELS) opens at 0.1 a frame at its own size and shrinks as it closes, with no hold", () => {
  const d = new DialogFx("story");
  near(d.scale, 1);
  run(d, 10);
  assert.equal(d.open, true);
  d.answerWith(true);
  assert.equal(d.state, 4);
  run(d, 5);
  near(d.scale, 1 - 0.05 * 0.5);
  run(d, 5);
  assert.equal(d.closed, true);
});

test("click marks take a cell every other frame: 105 cells in 3.5 s, Ciel's 59", () => {
  assert.equal(clickMarkCell(0, 0), 0);
  assert.equal(clickMarkCell(1, 0), 0);
  assert.equal(clickMarkCell(2, 0), 1);
  assert.equal(clickMarkCell(209, 0), 104);
  assert.equal(clickMarkCell(210, 0), 0);   // 210 frames = 3.5 s
  assert.equal(clickMarkCell(118, 2), 0);
  assert.equal(CLICK_MARK[1].alpha, 0.5);
});

test("the mode panel and the skip indicator sit where the original puts them", () => {
  near(PANEL.from, -104, 0.01);
  near(px(MODE_ICONS[5][1]), 1880, 0.01);
  assert.equal(MODE_ICONS[5][2], 0.6);
  assert.equal(MODE_ICONS[4][0], 352);
});

test("a button flashes as it lights up (1 falling 0.1 a frame) and shows pressed for 10 frames", () => {
  const b = new ButtonState();
  b.step(1, false);
  assert.equal(b.state, 0);
  assert.equal(b.flash, 0);
  b.step(1, true);
  assert.equal(b.state, 1);
  near(b.flash, 0.9);   // the frame it lights up already counts
  for (let i = 0; i < 4; i++) b.step(1, true);
  near(b.flash, 0.5);
  for (let i = 0; i < 6; i++) b.step(1, true);
  assert.equal(b.flash, 0);
  b.step(1, false);
  assert.equal(b.flash, 0);   // going dark does not flash
  b.step(1, true, true);
  assert.equal(b.state, 3);
  assert.equal(b.flash, 0);   // 0 -> 3 is not one of the two flashing steps
  b.step(1, false, true);
  b.step(1, true, true);
  near(b.flash, 0.9);   // 2 -> 3 is
  b.pressFor(10);
  for (let i = 0; i < 10; i++) { b.step(1, true); assert.equal(b.state, 4); }
  b.step(1, true);
  assert.equal(b.state, 1);
  assert.equal(b.flash, 0);   // pressed -> lit does not flash
});

test("the engine's tweens: type 2 is quadratic and type 3 cubic", () => {
  near(EASE.quad.in(0.5), 0.25);
  near(EASE.quad.out(0.5), 0.75);
  near(EASE.quad.inout(0.25), 0.125);
  near(EASE.quad.inout(0.75), 0.875);
  near(EASE.cubic.out(0.5), 0.875);
  near(EASE.cubic.inout(0.25), 0.0625);
  for (const f of [EASE.quad.in, EASE.quad.out, EASE.quad.inout, EASE.cubic.in, EASE.cubic.out, EASE.cubic.inout]) {
    near(f(0), 0);
    near(f(1), 1);
  }
});

test("the title's rows, and GALLERY going straight to the gallery under the black", () => {
  near(py(titleRowTop(5, 0)), 720, 0.01);
  near(py(titleRowTop(5, 1)) - py(titleRowTop(5, 0)), 56, 0.01);
  near(py(titleRowTop(4, 0)), 753.1, 0.1);
  near(px(TITLE_MENU.x), 816);
  // 0.02 a frame up to 1.2: 60 frames of black before the gallery opens.
  near(TITLE_MENU.to / TITLE_MENU.rate, 60);
});

test("the title logo fades while the menu background is up and comes back cubed", () => {
  let logo = { level: 1, rising: true };
  logo = titleLogo(logo.level, 30, { bgUp: true, black: 0.2 });
  near(logo.level, 0.5);
  assert.equal(logo.rising, false);
  assert.deepEqual([0, 1, 2].map((k) => titleLogoAlpha(logo, k)), [0.5, 0.5, 0.5]);
  // Frozen once the black is half up.
  assert.equal(titleLogo(0.5, 30, { bgUp: true, black: 0.5 }).level, 0.5);
  // A fresh title: nothing until the black is under half, then 1/120 a frame.
  assert.equal(titleLogo(0, 10, { black: 0.9 }).level, 0);
  logo = titleLogo(0, 60, { black: 0.4 });
  near(logo.level, 0.5);
  near(titleLogoAlpha(logo, 2), 0.125);
  near(TITLE_GLOW_RATE, 1 / 120);
});

// ---- TODO.md items 27 to 33: the title, Config and the first launch ----------------------------------------------
test("N2-38: a title row is the logo's third piece times its own ramp, so the rows wait for the logo (0x8dc74-0x8dcbc)", () => {
  // the logo has risen frames - 42 of 120 frames (it waits for the black to fall under half), and m is 1 from frame 83
  const row = (frame, k = 0, m = 1) => titleRowAlpha(((frame - 42) / 120) ** 3, m, k, 5);
  near(row(83), 0.0399, 1e-3);
  near(row(100), 0.1129, 1e-3);
  near(row(120), 0.2746, 1e-3);
  near(row(162), 1, 1e-6);
  // the ramp alone: while m is low the last rows are later, and m does nothing without the logo
  near(titleRowAlpha(1, 0.6, 4, 5), 0.2);
  assert.equal(titleRowAlpha(0, 1, 4, 5), 0);
});

test("N2-23: the title's music rates are level units a frame: 200 frames from the first screen, 66.7 from New Game and Continue (0x9c9b0)", () => {
  near(100 / TITLE_MUSIC.pressAny / 60, 3.3333, 1e-3);
  near(100 / TITLE_MUSIC.start / 60, 1.1111, 1e-3);
});

test("N2-40, N2-41: the first launch's background is 0.94 about (960, 508) and its prompt's top is 823 (0x8d79c, 0x8db24)", () => {
  const { bg, press } = FIRST_LAUNCH;
  near(bg.w * bg.scale, 2509.8, 0.01);
  near(bg.h * bg.scale, 1190.04, 0.01);
  near(bg.cy, 256 * 1080 / 544, 0.01);
  near(press.y, 411.586 * 2, 0.01);
  near(press.h * press.scaleY, 88.65, 0.01);
});

test("N2-41: the prompt's pulse runs up to 1 and back to 0 at 1/60 a frame (0x8e200 state 9)", () => {
  let p = { alpha: 0, up: true };
  for (let i = 0; i < 30; i++) p = pressPulse(p, 1);
  near(p.alpha, 0.5);
  for (let i = 0; i < 31; i++) p = pressPulse(p, 1);
  assert.equal(p.up, false, "turns at the top");
  for (let i = 0; i < 59; i++) p = pressPulse(p, 1);
  assert.equal(p.up, true, "and at the bottom");
  near(p.alpha, 0, 1e-6);
});

test("N2-39, N2-43: the title's white reaches its end after 20 more frames when the cautions have brought it to 1", () => {
  near((TITLE_WHITE.to - 1) / TITLE_WHITE.rate, 20);
  near(TITLE_WHITE.to / TITLE_WHITE.rate, 120);
});

test("the system menu background: level and bands raised and lowered", () => {
  const f = new MenuBgFade().set(0.02);
  f.step(25);
  near(f.level, 0.5);
  near(f.t, 25 / 60);   // the bands at 1/60 a frame
  f.step(50);
  assert.deepEqual([f.level, f.t], [1, 1]);
  const bottom = MENU_BANDS[0];
  const down = new MenuBgFade(1, 1).set(-0.02).step(25);
  near(down.level, 0.5);
  near(down.t, 0.5);
  assert.equal(down.band(bottom).y, 1080 - 198);   // left in place
  near(down.band(bottom).alpha, (0.75 * 64) / 255);   // fading with t eased, not the level
  near(new MenuBgFade(0, 0.5).set(0.02).band(bottom).y, 1080 - 198 * 0.75);
});

test("the gallery's half-second fades: in eased in, out eased out", () => {
  const i = fadeIn();
  near(i.step(15), 0.25);   // 0.25 s of 0.5: (1/2)^2
  assert.equal(i.done, false);
  near(i.step(15), 1);
  assert.equal(i.done, true);
  near(i.step(10), 1);
  const o = fadeOut();
  near(o.step(15), 0.25);   // (1 - 1/2)^2 (0x26a30 from 1 to 0)
  near(o.step(30), 0);
  near(GALLERY_FADE, 0.5);
  const skipped = fadeIn();   // the flowchart shown again after a No: already in
  near(skipped.step(Infinity), 1);
  assert.equal(skipped.done, true);
  near(new Tween(0, 2, 1, EASE.quad.inout).step(15), 0.25);
});
