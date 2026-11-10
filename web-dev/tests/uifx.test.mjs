import test from "node:test";
import assert from "node:assert/strict";
import { LogoDust, LogoShards, SHARD_CELLS, MENU_BANDS, MenuCursor, Sparkles, bandAt, titleMusic, titleStage, titleVariant, triangle } from "../../web/app/js/uifx.js";

// A repeatable stand-in for Math.random.
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test("the title moves through its stages in order, and picks its picture and music from them", () => {
  assert.equal(titleStage(new Set()), 0);
  assert.equal(titleStage(new Set([383, 562])), 0);   // nothing counts before Arcueid's ending
  assert.equal(titleStage(new Set([560])), 1);
  assert.equal(titleStage(new Set([560, 562])), 1);   // Ciel's ending needs scene 383 first
  assert.equal(titleStage(new Set([560, 383])), 3);
  assert.equal(titleStage(new Set([560, 383, 562])), 5);
  assert.deepEqual([0, 1, 3, 5].map(titleVariant), [1, 2, 3, 4]);
  assert.deepEqual([0, 1, 3, 5].map(titleMusic), [2, 2, 2, 72]);
});

test("logo dust: four a frame into 200 fixed slots, inside the original's box, still, freed after its life", () => {
  const dust = new LogoDust(seeded(7));
  const seen = [];
  dust.frame(1, (q, tri) => seen.push(tri));
  assert.equal(dust.live.length, 4);
  assert.deepEqual(seen, [0, 0, 0, 0]);   // drawn at age 0, then aged
  assert.equal(dust.cursor, 4);   // the search stopped at the fourth and moved on from there
  for (let i = 0; i < 100; i++) dust.frame(0, () => {});
  assert.equal(dust.live.length, 200);
  for (const q of dust.live) {
    assert.ok(q.x >= 405 && q.x <= 555 && q.y >= 184 && q.y <= 399.375, `${q.x},${q.y}`);
    assert.ok(q.life >= 18 && q.life < 60 && q.alpha >= 0.25 && q.alpha <= 1 && q.cell >= 0 && q.cell <= 2);
  }
  const before = dust.live[0], x = before.x;
  dust.frame(1, () => {});
  assert.equal(before.x, x);   // dust does not move
  dust.frame(61, () => {});
  assert.ok(dust.live.length <= 4);
  assert.equal(triangle(0, 40), 0);
  assert.equal(triangle(20, 40), 1);
  assert.equal(triangle(30, 40), 0.5);
});

test("logo shards: one every other frame, rising, spinning edge-on, drift speed borrowed from the walked slot", () => {
  const shards = new LogoShards(seeded(5));
  shards.frame(1, () => {});
  assert.equal(shards.live.length, 0);
  shards.frame(1, () => {});
  assert.equal(shards.live.length, 1);
  for (let i = 0; i < 600; i++) shards.frame(1, () => {});
  assert.ok(shards.live.length > 50 && shards.live.length <= 120);
  for (const q of shards.live) {
    assert.ok(q.scale >= 0.3 && q.scale <= 0.75 && q.life >= 120 && q.life < 270 && q.alpha >= 0.5 && q.alpha <= 1);
    assert.ok(q.vy >= 0.1333 && q.vy <= 0.5834 && Math.abs(q.vx) <= 0.5834 * Math.cos((80 * Math.PI) / 180) + 1e-9);
  }
  // A new shard at slot 5, found on the first step of the search, takes slot 0's speed for its drift.
  const s = new LogoShards(() => 0.5);
  s.cursor = 5; s.counter = 1;
  s.slots[0].vy = 10;
  s.spawn(1);
  const q = s.slots[5];
  assert.ok(Math.abs(q.vx - 10 * Math.cos((90 * Math.PI) / 180)) < 1e-9);
  assert.equal(q.x, 0.5 * 135 + 412.5);
  assert.equal(q.y, 0.5 * 75 + 303);
  // Drawn across by fade x cos(phase) x scale, down by fade x scale; it rises as it goes.
  q.age = 100; q.phase = 0;
  let drawn = null;
  s.frame(1, (p, sx, sy, a) => { if (p === q) drawn = [sx, sy, a]; });
  assert.deepEqual(drawn, [q.scale, q.scale, q.alpha]);
  assert.ok(q.y < 0.5 * 75 + 303);
  assert.deepEqual(SHARD_CELLS[1], [64, 0, 96, 55]);
});

test("sparkles rise toward the top centre, fade in and out over 60 frames, and twinkle as they go", () => {
  const s = new Sparkles(seeded(3));
  for (let i = 0; i < 300; i++) s.step(1);
  assert.ok(s.p.length <= 100);
  const q = { x: 100, y: 300, speed: 0.3, vx: (0.3 * (480 - 100)) / 375, age: 0, life: 200, alpha: 0.4, size: 0.2 };
  s.p = [q];
  s.step(1);
  assert.ok(q.x > 100 && q.y < 300);
  assert.deepEqual(Sparkles.fade({ ...q, age: 30 }), [0.5, 0.4]);
  assert.deepEqual(Sparkles.fade({ ...q, age: 100 }), [1, 0.4]);
  const [f1, a1] = Sparkles.fade({ ...q, age: 170 }), [, a2] = Sparkles.fade({ ...q, age: 172 });
  assert.equal(f1, 0.5);
  assert.notEqual(a1, a2);   // 0.7 of its alpha on alternate pairs of frames
});

test("G20: sparkles are f x size x 80 px at 1080p from 40/41 of their texture, kept in 100 ring records, made 60 a second at any frame rate (0x4c190, 0x4bd10)", () => {
  const q = { x: 100, y: 300, speed: 0.3, vx: 0.1, age: 100, life: 200, alpha: 0.4, size: 0.2 };
  assert.equal(Sparkles.width(q), 8, "8 units of 960, 16 px at 1080p (the port had 32)");
  const calls = [];
  const ctx = { globalAlpha: 1, drawImage: (...a) => calls.push(a) };
  const s = new Sparkles(seeded(5));
  s.p = [q];
  s.draw(ctx, { naturalWidth: 82 });
  assert.deepEqual(calls[0], [{ naturalWidth: 82 }, 0, 0, 80, 80, 200, 600, 16, 16]);
  // the same quad for the GPU: two triangles, 1080p pixels, texture 0 to 40/41, the alpha
  const { data, count } = s.quads();
  assert.equal(count, 6);
  const u = 40 / 41;
  assert.deepEqual([...data.slice(0, 10)].map((v) => +v.toFixed(5)), [200, 600, 0, 0, 0.4, 216, 600, +u.toFixed(5), 0, 0.4]);
  // ring records: a new one goes in the first free record from the cursor
  const r = new Sparkles(seeded(7));
  r.step(1); r.step(1); r.step(1);
  assert.deepEqual(r.slots.slice(0, 4).map(Boolean), [true, true, true, false]);
  r.slots[0] = null;
  r.step(1);
  assert.ok(r.slots[3] && !r.slots[0], "after the cursor first, not the freed record before it");
  // 30 frames a second (Chrome's energy saver): two a frame, as many a second as at 60
  const a = new Sparkles(seeded(9)), b = new Sparkles(seeded(9));
  for (let i = 0; i < 40; i++) a.step(1);
  for (let i = 0; i < 20; i++) b.step(2);
  assert.equal(a.p.length, 40);
  assert.equal(b.p.length, 40);
  for (let i = 0; i < 400; i++) a.step(1);
  assert.equal(a.p.length, 100, "100 at most");
});

test("menu bands start centred on the screen edge and end flush with it", () => {
  const bottom = MENU_BANDS[0], top = MENU_BANDS[4];
  assert.deepEqual(bandAt(bottom, 0), { x: 960, y: 1080, alpha: 0 });
  assert.equal(bandAt(bottom, 1).y, 1080 - 198);   // menuBG04_0 is 396 high: its bottom on the screen's
  assert.equal(bandAt(bottom, 1).alpha, 64 / 255);
  assert.equal(bandAt(top, 1).y, 155.25);
  assert.equal(bandAt(top, 0.5).y, 155.25 * 0.75);   // eased out
  assert.equal(bandAt(top, 0.5, true).y, 155.25);   // lowering: in place
  assert.equal(bandAt(top, 0.5, true).alpha, (0.75 * 64) / 255);
});

test("the menu cursor's line comes in over 10 frames; its light pulses between half and full", () => {
  const c = new MenuCursor();
  for (let i = 0; i < 5; i++) c.step(1);
  assert.ok(Math.abs(c.line - 0.5) < 1e-9 && Math.abs(c.stretch - 0.5) < 1e-9);
  for (let i = 0; i < 55; i++) c.step(1);   // 60 frames in: the light has just reached full
  assert.equal(c.line, 1);
  assert.ok(c.light > 0.99, String(c.light));
  let low = 1, high = 0;
  for (let i = 0; i < 400; i++) { c.step(1); low = Math.min(low, c.light); high = Math.max(high, c.light); }
  assert.ok(low >= 0.5 && low < 0.52 && high === 1, `${low} ${high}`);
  // a new row (0x4cea0) restarts the stretch and the light, rising again; the line's alpha carries on
  c.moved();
  assert.deepEqual([c.line, c.stretch, c.light, c.dir], [1, 0, 0, 1 / 60]);
  c.step(1);
  assert.ok(Math.abs(c.stretch - 0.1) < 1e-9 && Math.abs(c.light - 1 / 60) < 1e-9 && c.line === 1);
});
