import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { place, clipGeometry, sizeClass, wrapRotation, imageSize, SY } from "../../web/app/js/transform.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const layer = (id, extra = {}) => ({ id, image: "img0001", parent: -1, link: -1, pivot: null, clip: null, border: 0,
  clipRot: 0, absolute: false, offset: null, scale: 1000, ...extra });
const st = (x, y, extra = {}) => ({ x, y, zx: 1000, zy: 1000, rot: 0, alpha: 255, ...extra });
// 1280 x 720 stored pixels: 480 x 271.99 script units at zoom 1, centre (240, 136)
const info = () => [1280, 720];

test("a root layer's position is where its centre goes", () => {
  const a = layer(0);
  const at = place([a], new Map([[a, st(240, 136)]]), info).get(a);
  near(at.x, 960); near(at.y, 540);
  near(place([a], new Map([[a, st(0, 272)]]), info).get(a).y, 1080);
});

test("a child is placed in its parent's picture, relative to the parent's pivot, and follows its zoom", () => {
  const p = layer(1), c = layer(2, { parent: 1 });
  const states = new Map([[p, st(100, 50, { zx: 2000, zy: 2000 })], [c, st(240 + 10, 136 + 20)]]);
  const at = place([p, c], states, info).get(c);
  // 10 and 20 units from the parent's centre, doubled; the parent's pivot y counts as 181 / 272 of its script value (N2-95),
  // so a 720-pixel parent's centre is 90.5 engine units, not 136 x 2/3 = 90.667
  near(at.x, (100 + 20) * 4);
  near(at.y, (50 * 2 / 3 + 2 * (156 * 2 / 3 - 90.5)) * (SY / (2 / 3)), 1e-3);
  near(at.zx, 2);
});

test("a parent's rotation turns its children about its pivot and adds to theirs", () => {
  const p = layer(1, { pivot: [0, 0] }), c = layer(2, { parent: 1 });
  const states = new Map([[p, st(240, 136, { rot: 9000 })], [c, st(10, 0, { rot: 500 })]]);
  const at = place([p, c], states, info).get(c);
  // (10, 0) from the pivot, turned a quarter, in engine units: x 5 becomes y 5 (y unit = 3/2 script)
  near(at.x, 960, 1e-3);
  near(at.y, 136 * SY + 5 * 1.5 * SY, 1e-3);
  assert.equal(at.rot, 9500);
});

test("a sprite's smaller sizes scale its children's coordinates and size", () => {
  assert.equal(sizeClass("aru_l_03_00_n00"), 0.5);
  assert.equal(sizeClass("ARU_M_03_00_N00"), 0.25);
  assert.equal(sizeClass("img0001"), 1);
  const p = layer(1, { image: "aru_l_01", pivot: [0, 0] }), c = layer(2, { parent: 1 });
  const at = place([p, c], new Map([[p, st(0, 0)], [c, st(100, 0)]]), info).get(c);
  near(at.x, 50 * 4); near(at.zx, 0.5);
});

test("a panel clip moves the layers linked to it by its origin (unless SACL is set), not its own picture; a link shares clip and alpha", () => {
  const panel = layer(1, { clip: [800, 0, 1120, 1080], border: 30 });
  const linked = layer(2, { link: 1 }), fixed = layer(3, { link: 1, absolute: true });
  const states = new Map([[panel, st(0, 0, { alpha: 128 })], [linked, st(0, 0, { alpha: 255 })], [fixed, st(0, 0)]]);
  const out = place([panel, linked, fixed], states, info);
  near(out.get(panel).x, 0);      // 0x88cc8: a layer with no link is never moved by a clip
  near(out.get(linked).x, 800);
  near(out.get(fixed).x, 0);
  near(out.get(linked).alpha, 128 / 255);
  assert.equal(out.get(linked).clip.group, panel);
  const g = clipGeometry(out.get(linked).clip);
  // the picture fades over 30 px on the left and on the right, whose edge is on the screen's (0x32e30: a side is cut
  // hard only when the clip goes the width or more past the screen); the clip is as tall as the screen: none down
  assert.deepEqual(g.inner, [830, 0, 1060, 1080]);
  assert.deepEqual(g.sides, [1, 0, 1, 0]);
  assert.equal(g.colour, null);              // style 0: no frame, only the feathered edge
  assert.equal(g.band, null);
});

test("frame styles have the engine's colours, and a turned panel feathers every side", () => {
  const g = clipGeometry({ rect: [100, 100, 400, 300], border: 20, rot: 1500, frame: 2 });
  assert.deepEqual(g.sides, [1, 1, 1, 1]);
  assert.deepEqual(g.inner, [120, 120, 360, 260]);
  assert.deepEqual(g.colour, [1, 1, 1]);
  assert.deepEqual(g.band.inner, [120, 120, 360, 260]);
  // styles past 6 draw no band (0x34a70)
  assert.equal(clipGeometry({ rect: [100, 100, 400, 300], border: 20, rot: 0, frame: 9 }).band, null);
});

test("an empty clip is no clip; a whole-screen one counts as a clip but cuts nothing while it does not move (N2-5)", () => {
  const a = layer(1, { clip: [0, 0, 1920, 1080] }), b = layer(2, { clip: [0, 0, 0, 0] }), c = layer(3, { clip: [300, 150, 1920, 1080] });
  const out = place([a, b, c], new Map([[a, st(0, 0)], [b, st(0, 0)], [c, st(0, 0)]]), info);
  assert.deepEqual(out.get(a).clip.rect, [0, 0, 1920, 1080]);
  assert.equal(out.get(b).clip, null);
  assert.deepEqual(out.get(c).clip.rect, [300, 150, 1920, 1080]);   // an offset full-size clip cuts the picture
  const g = clipGeometry({ rect: [0, 0, 1920, 1080], border: 20, rot: 0, frame: 1 });
  assert.deepEqual(g.sides, [0, 0, 0, 0]);                          // no edge width on an unmoved whole-screen clip
  assert.deepEqual(clipGeometry({ rect: [40, 0, 1920, 1080], border: 20, rot: 0, frame: 0 }).sides, [1, 0, 0, 0]);
});

test("a layer with a pivot is drawn with its pivot at its position", () => {
  const a = layer(1), b = layer(2, { pivot: [0, 0] }), c = layer(3, { pivot: [null, 0] });
  const out = place([a, b, c], new Map([[a, st(0, 0)], [b, st(0, 0)], [c, st(0, 0)]]), info);
  assert.deepEqual(out.get(a).pivot, [0, 0]);
  near(out.get(b).pivot[0], -960); near(out.get(b).pivot[1], -540, 1e-3);
  near(out.get(c).pivot[0], 0); near(out.get(c).pivot[1], -540, 1e-3);
});

test("panel rotation wraps like the original", () => {
  assert.equal(wrapRotation(1560), 1560);
  assert.equal(wrapRotation(27000), -9000);
  assert.equal(wrapRotation(-27000), 9000);
  assert.equal(wrapRotation(-99999), -32768);
});

test("a picture is anchored at its own pivot from the image table, not its centre (0x60840, 0x89ad0 -> 0xb0710)", () => {
  // 1280 x 720 stored: 480 x 272 script units; pivot at a quarter of the width, half the height
  const pivoted = () => [1280, 720, 1, 0.25, 0.5];
  const a = layer(0), c = layer(1, { parent: 0 });
  const out = place([a, c], new Map([[a, st(240, 136)], [c, st(120, 136)]]), pivoted);
  // the pivot is drawn at the position: offset from the centre by -120 units (-480 px)
  near(out.get(a).x, 960); near(out.get(a).pivot[0], -480); near(out.get(a).pivot[1], 0);
  // a child at the pivot's own coordinates sits on the parent's position (0x892b0 uses the parent's pivot)
  near(out.get(c).x, 960);
  // STPV still wins
  const b = layer(2, { pivot: [240, 136] });
  near(place([b], new Map([[b, st(240, 136)]]), pivoted).get(b).pivot[0], 0);
});

test("V14: a picture's pivot is that of the record the engine finds by its name (the name table, *0xae0888), not by the file it names", () => {
  const sysUrl = new URL("../../web/assets/system.json", import.meta.url), imgUrl = new URL("../../web/assets/images.json", import.meta.url);
  if (!existsSync(sysUrl) || !existsSync(imgUrl)) return;
  const sys = JSON.parse(readFileSync(sysUrl, "utf8")), images = JSON.parse(readFileSync(imgUrl, "utf8"));
  const infoOf = (name) => {
    const n = name.toUpperCase(), i = images[n];
    return i && [i[0], i[1], i[2], ...(sys.pivots[n] || [0.5, 0.5]), ...(sys.pivotCuts[n] || [0, 0])];
  };
  // record 13306 names the pose's shared file SIE_A_46_00_N00_B at +8 and SIE_A_46_00_N06 at +0x10, which is its name
  // in the name table: 0x55d30 returns that index and 0x60840 reads the record's pivot (531.667, 369.039 of 1077.333 x
  // 997.511)
  assert.deepEqual(sys.pivots.SIE_A_46_00_N06, [0.4935, 0.36996]);
  assert.deepEqual(sys.pivots.SIE_A_46_00_N00, [0.4935, 0.36996]);
  assert.equal(sys.pivots.SIE_A_46_00_N00_B, undefined);
  assert.deepEqual(sys.pivots.ARI_L_00_03_N02, [0.53361, 0.48955]);
  // 14_01B_01_CIEL14B_1D op 829: Ciel's bust ends where the picture does; track 16613 leaves her at y 60, zoom 500,
  // which keeps that edge below the screen (drawn about the centre it was at 982 px)
  const l = layer(38, { image: "sie_a_46_00_n06", cut: true });
  const at = place([l], new Map([[l, st(240, 60, { zx: 500, zy: 500 })]]), infoOf).get(l);
  const bottom = at.y - at.pivot[1] * at.zy + imageSize(infoOf(l.image))[1] * SY * at.zy / 2;
  assert.ok(bottom > 1080, `bottom ${bottom}`);
});
