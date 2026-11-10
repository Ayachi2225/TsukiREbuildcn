# Web animation implementation

The source of regular layer motion is the executable, not `allscr.mrg`.
`STMA(layer, track)` selects one of 24,192 tracks containing 71,905 keyframes.
`build_animations.py` exports those tracks from the locally prepared Japanese
image; generated `web/assets/animations.json` stays out of git with the other assets.
An unsupported image is rejected explicitly. No dump, key, or generated track
data is included in the exporter source.

## Runtime coverage

- `STMA`: all 28 keyframe fields the engine reads (`0x99ff0`): position, opacity,
  zoom, rotation, blur, the pivot, the panel's rectangle, frame style and edge
  width, blend, colour, brightness, contrast, film grain and depth, sampled as
  `0x97710` does (holds, skips, the earlier key's ease and mode; frame style and
  fields 17-27 step) and written as `0x97b80` does: only the fields the track's
  flags allow, and position, opacity, zoom, blur and blend past the start only
  when a later key gives them (given only at time 0 they are written once, as
  STMA starts the track, and stay on the layer for script tweens to move). A
  track's colour is the silhouette's for preset 1, otherwise the picture is
  multiplied by it. Motion 0 stops a track at its current pose; what it wrote
  stays. Ordinary script tweens on other properties continue.
- `SGMA`: writes the layer's position, opacity, rotation, zoom and (when its x
  is not 0) panel over the keyframe its third argument names (0 when blank).
- `SPMA`: pauses/resumes motion tracks. Menus and hidden tabs also hold the
  animation clock, independently of this script control.
- `STCF`: respects the property mask. Mask 8 waits for opacity; mask 32 waits
  for finite motion. Looping and explicitly paused tracks do not block it.
- `SQK2`/`SQS2`: per-layer random quake and stop. Target -1 applies to current
  layers; the stop with -1 clears that effect on all layers.
- `SHK2`/`SHS2`: periodic shake and stop. `SSW2`/`SSS2` provide ambient sway
  using amplitude and period ranges. These two families share the original
  engine's oscillation slot, while quake uses a separate slot.
- `SHOK`: directional screen impact, honoring both amplitudes and its period,
  repetition count and delay, at the engine's scale (see "Transitions, grain
  and screen effects"). `SQK2` supplies layer quake; `MSQK` shakes text. (`STQK`, once taken for a layer quake, is
  not a command of the Switch interpreter: 0x77790 passes it over at 0x77814; corrected 2026-11-06.)

## Layer placement

`transform.js` places every layer the way the engine's draw setup does
(`0x884f0`, using `0x892b0`/`0x89420` for world x/y, `0x89190`/`0x89220` for
zoom and `0x8c480` for rotation):

- `SBAS(child, parent)`: the child's position is in the parent's picture
  (script units from its top left), relative to the parent's pivot. It is
  scaled by the parent's zoom chain and by the parent's sprite size (L/M/S =
  1/2, 1/4, 1/8), and turned by the parent's rotation, which adds to the
  child's own. Parallax backgrounds and characters standing in a moving room
  depend on this.
- `STPV(layer, x, y, rotation)`: the pivot in A-image units, and optionally
  the layer's rotation. A layer's position is where its pivot is drawn; zoom
  and rotation turn about it. Without STPV the pivot is the picture's own, from
  the engine's image table (`0x46f830`, 14,713 records of 0x48 bytes, `*0xae0540`
  at run time: +8 a file name, +0x2c/+0x30 the size and +0x34/+0x38 the pivot
  in the 640 x 362 screen). A picture's record is found by its name in a second
  table (`*0xae0888`, 32-byte names at the same indexes, `0x55d30`), not by +8:
  a pose's expressions name the pose's shared file there (`SIE_A_46_00_N00_B`)
  and their own at +0x10. STCH copies the pivot to the layer (`0x60840`: +0x374,
  +0x414) and the draw anchors the picture there (`0x89ad0` -> `0xb0710`, the
  pivot divided by the texture size); SBAS children are placed from it too
  (`0x892b0`). It is the centre for most backgrounds, but 4,619 of the pictures
  the scripts use have another: most sprites (Ciel's busts about 37% down the
  picture) and posed sprites such as `sie_l_32_32_n00`, whose pivot is on
  Ciel's body, 13% across a canvas that also holds her blades.
  `build_system.py` keeps the off-centre ones in `system.json` `pivots`.
- `STCH`/`SCH2` arg 11 links a layer to another: it uses that layer's panel
  clip and is multiplied by its alpha (so it fades with the panel), and it is
  drawn through that layer's picture, a clipping mask (`0x32e30` draws the
  owner's picture as the mask when the clip is not empty; QA_17's darkening of
  Neco-Arc stays inside her outline). Args
  12-15 are a clip rectangle in 1920x1080 pixels, not a texture crop. The
  rectangle's origin moves the layers linked to the panel unless
  `SACL(layer, 1)` is set; it never moves the panel's own picture (`0x88cc8`
  tests the link first: Ghidra's C drops that test). Arg 16 is
  the width of a feathered edge: the engine masks the picture with nine
  pieces of a radial alpha blob (`BORDER_PARTS/alphagradation*`, `0x89ad0`),
  so it fades out over that width with rounded corners. Corrected 2026-11-06
  (FIX-CHECKLIST V5; the live draw is `0x32e30` / `0x34a70`): the width is
  rounded up to even and cut to half the clip's width and height; a side has
  the edge unless the clip's edge lies the width or more past the screen's,
  and a clip exactly as wide (tall) as the screen has none across (down); a
  turned panel has it on every side. Arg 17 is a frame style: 0 (most
  panels) draws nothing more; 1-6 draw a band of the plain width in black,
  white, red, dark brown, off-white or cream into the panel's own picture
  before the mask (`0x34a70`; corrected 2026-11-08, function map N2-210): on
  an unturned panel the outer width is a plain rectangle and the inner width
  the falling half of the alpha blob, and a turned panel takes both halves
  from the blob; 7 doubles the mask's width and draws no band (this note
  said 7 and above draw black). `STRR` (and STCH arg 19) turns the clip
  about its centre. A panel with pictures linked to it fades once at the
  edge, as one finished picture (function map N2-211).
- `SOXY(layer, _, _, x, y)`: a fixed offset; the engine reads only the last
  two arguments, and adds them to the layer's place as screen pixels
  (`0x37f50`, N2-213; a child is placed from its parent's own position).
- `STCP(layer, z)` changes the depth of a picture already on screen only at
  the next commit (a FADS, or a wait with a staged picture): it writes the
  state, and the draw order is the record's table (`0x62a40`, N2-212).
- STCH's zoom argument is a scale separate from `STZ4`'s zoom, and the two
  multiply.
- `STCH`/`SCH2` arg 18 names a source layer (0-39): the new layer starts as a
  copy of it (placement, STZ4's zoom target and flag, panel, link, parent,
  colour, motion, quakes, haze), and the layers linked to the source or SBAS
  children of it follow the new layer (`0x60840`). STCH then sets alpha 255
  and z = layer x 10 when blank, rotation 0 and the picture's own pivot; both
  reset the STTR rule and the blend. Without a source both keep the layer
  number's own values (x, y, scale, panel, SBAS parent, SOXY; SCH2 also alpha,
  z and rotation) but start SACL, quakes, SNX2/SNX3, STEC, the link and the
  motion again. A number with no layer (never used, or cleared by STCC) holds
  x 0, y 0, scale 1000 (`0x57450`, `0x62140`), so a blank x / y there puts the
  picture's pivot at the top left of the screen. Commands on a number with no
  picture still write its state (STCP, STGS, STRT, STZ4, STBR, SBAS, SOXY,
  SACL, STPV, STCL, STNS), which the next STCH or SCH2 starts from. SCH2 from
  a source keeps an STPV pivot where it was relative to the picture's own
  pivot; without a source it takes the new picture's own.
- The engine maps script y at 1080/272 pixels per unit (x at 4), from the top
  left.

The engine does this arithmetic in its own units (x/2, y·2/3), including the
rotation through a parent, and the web version keeps those units.

## Colour effects

`STEC(layer, preset, colour)` chooses one of the engine's 83 colour presets
(`0x3de0` stores it at `+0x1404`). `build_effects.py` exports the table
(`0x3358b0`, read by `0x3fc0`); `0x9f6c0` turns a preset into the
`pre_alter` shader's constants for the effect pass (`0xa3180`). The layer
shader reproduces `pre_alter` (decompiled from the port's SPIR-V of
`nexl_nxshader_pre_alter.bnsh`) per pixel:

- grayscale (Rec. 709 weights 54/183/19 out of 256), or a silhouette;
- per-channel gamma and output black/white levels;
- two colour layers with their own opacity and blend mode
  (normal, add, multiply, colour dodge, linear dodge, screen, overlay);
- brightness and contrast.

Preset 1 is a silhouette in the colour STEC gives (what the web version
already drew), 2 grayscale, 3 sepia, 4 negative, 7 red only; most of 8-76
are time-of-day and lighting grades for sprites and backgrounds. 0 clears.

`SNX2(layer, n)` is brightness (+n in 0-255 units) and `SNX3(layer, n)` is
contrast (+n percent), read by the same pass (`0x4030`, `0x4120`). They were
taken for horizontal and vertical blur before. `SNX4` is not a blur either: the Switch interpreter has no such
command (between NX1 and OXX its 'S' branch knows NX2 and NX3 only; the rest go to 0x77814), so the game's only blur
is STCH / SCH2 args 9-10, which pick the pre-blurred `_XX_YY` textures (corrected 2026-11-06). The port regenerates them as a Gaussian
of sigma 0.65 x n x the picture's size class (`blurSigma`; measured on the files, 2026-11-09).

The effect shader `pre_alter` re-encodes its input with a 1/2.2 power after a 2.2 decode, a round trip (checklist
V13). The rest of the game does the same thing around it: pictures are read through an sRGB view and baked as x^(1/2.2), and
the last pass writes x^2.2 into an sRGB screen (shader `138dd8be4ccf62ce`). The port now works in that same space: `working()`
on picture reads, `FS_DISPLAY` at the end of each frame (FIXES.md, "The flicker in that scene").

## Blend modes

`STBR(layer, n)` (`0x62490`) stores n at state `+0x7c` (0 as 255, the default). The draw (`0x89ad0`) looks n up in
`0x34dd70` (the identity for 0-39, `0x32d20`) and maps the result with `0xa2790` (table `0x3c9698`) to a position in
the shader table (`0x264668`); `0xa27c0` (table `0x3c9748`) gives the draw type. Type 7 draws the layer alone with
`default` and colour (1, 1, 1, 1) (`0xb7010`; blend type 4 = One, Zero, so the colour stays straight), then runs the
blend shader over the screen with colour (1, 1, 1, op) (`0xb03e0`, `0xb24f0`); the pass replaces (blend type 7 has
blending off). The blend states are nn::gfx BlendTargetStateInfo records made by `0xd3914` (14 types) and bound per
draw by `0xd495c` / `0x149dd8`.

**STBR n is not table entry n + 14**, as the port had it: 11, the glow pictures' mode (3,158 calls, `IMG2228` and
friends), is `ps_add`, not `add_alpha`, whose unweighted `+ s` drew `IMG2228`'s full-strength green disk as a hard
orb; 24 on the black vignette `IMG2182` (1,032 calls) is `softlight`, not a no-op `screen`; 10 on black `IMG0597`
is `sub` (a fade to black); 5 on white `IMG2345` is `dodge` (a flash), not a no-op `multi`. `add_alpha`, `burn`,
`darken`, `lighten`, `screen` and `multi` are never used by STBR.

Each shader's arithmetic was read from its translated SPIR-V (`nexl_nxshader_<name>.bnsh` ->
`data/tsuki/spirv/<hash>.spv` by `framework/tools/maxwell/containers.py`, `spirv-cross`); embedded constants come from
the BNSH constant section. With b the backdrop, s the layer's straight colour, a its texel alpha and op the opacity:

| STBR n | Shader | Result |
|---|---|---|
| 1, 11 | `ps_add` | mix(b, min(1, b + s), a*op); a channel with s = 0 keeps b |
| 4, 13 | `ps_darken` | mix(b, min(b, s), a*op) |
| 5 | `dodge` | b if a*op = 0; else min(b / max(0, 1 - s*op), b > 1/255 ? 1 : 0); no outer mix |
| 6, 20 | `ps_lighten` | mix(b, max(b, s), a*op) |
| 7, 21 | `ps_mul` | mix(b, b*s, a*op) |
| 8 | `noalpha` | s x colour, opaque: no alpha, no backdrop |
| 9, 23 | `ps_screen` | mix(b, 1 - (1-b)(1-s), a*op) |
| 10 | `sub` | max(0, b + a*op*(s - 1)): a white source changes nothing |
| 12 | `ps_burn` | mix(b, burn(b, s), a*op); a channel with s = 0 is black |
| 14 | `differnce` | mix(b, abs(b - s), a*op) |
| 15 | `differnce5` | abs(b - a*op*s) |
| 16 | `ps_dodge` | mix(b, (1-s) <= 0 ? 1 : min(1, b/(1-s)), a*op) |
| 17 | `ps_dodge5` | b if a*op = 0; else min(b / max(0, 1 - a*op*s), b > 3/255 ? 1 : 0); no outer mix |
| 18 | `exclusion` | mix(b, b + s - 2bs, a*op) |
| 19 | `hardlight` | mix(b, hard light, a*op) |
| 22 | `overlay` | mix(b, overlay, a*op) |
| 24 | `softlight` | mix(b, s < 0.5 ? b^(2-2s) : b^(0.5/s), a*op) |
| 25 | `ps_sub` | mix(b, max(0, b + s - 1), a*op) |
| 28 | `add` | min(b + s*op, 1), the texel alpha not used (used once). The shader is not in the base RomFS but in the translation patch's `romfs/shader` (the patch includes the 1.0.2 update), SPIR-V `2a7200ca9de7d6a9` |
| 26 | `hardlight_ex` | b where a*op = 0, else hard light of min(s/a, 1) (also in the patch, SPIR-V `c7257a907506ee2d`); no script uses it, so the port keeps plain hard light |

2 and 3 are not shader draws (`0xa27c0` type 0; `0x884f0` gives them fixed-function draw modes 3 and 4); the port
keeps alpha blending for them, and 0 draws normally. The port's textures are premultiplied, so s is recovered as
rgb/a: exact except for very low alpha, where 8 bits lose precision.

## Transitions, grain and screen effects

- `FADS` type 2 with a rule (1-49) brings the new screen in through the mask
  picture `RULE_nn`: the engine's `transition` shader with the constants
  `0xa48c0` gives it (softness 128, dark parts first). Other types never
  read the rule. The path: `FADS(type, ms, rule)` (`0x77790` 'F' + "ADS",
  `0x60610`) loads rule n from `mask_top.mzp` + n (`0x4b4c0`, `RULE_nn` in
  the image table), copies the last drawn frame once (`0xa4560`), draws that
  copy at full (`0xa46f0(1.0)`) while the new screen's pictures load, then
  starts the transition (`0x4b740`: level 1 falling 1 / (ms / 16.666) a
  frame). The draw task `0x47dd0` picks by type: 2 the rule (`0xa48c0`,
  slot 0x1c09), 0 and the rest a plain fade of the copy (`0xa46f0`), 1 and
  0x15-0x18, 0x31 nothing, 0x12 / 0x14 / 0x44-0x46 their own effects. So
  the "before" picture is the last frame drawn before the FADS: the port
  holds that frame (`gfx.hold`) while it waits for pictures, and changes the
  script made to live layers just before (`STCP` moving the train behind the
  white in `01_01_CIEL01_1_3` op 1846) no longer show before the wipe.
  The shader draws the copy over the new screen at alpha
  smoothstep((r - lo) / s), lo = ((255 + 2s) x - 1.5 s) / 255 with x the
  progress: the old picture stays longest where the rule is bright, so the
  new one comes in where it is dark first (`RULE_13`, bright on the left,
  wipes in from the right; confirmed against the game). The port had it the
  other way round.
- What the scripts use: `FADS` types 0 (12,240), 1 (20,842) and 2 (947), and
  `FANX 1 0 0` (2,741). No script uses 0x12 (a pixelate in and out around
  level 0.45), 0x14, 0x44-0x46 (falling pieces, a white flash, a spinning
  zoom), so the port leaves them out. Type 0 is the copy drawn at alpha =
  the level, falling linearly by elapsed frames (`0x48ac0`: level += step x
  frames; at 0 the rule slot is freed); it never reads the rule, so
  `FADS 0 200 1` (`02_00_ARC02_1D` op 46, the only one) is a 200 ms
  crossfade, not a wipe through `RULE_01`. Type 2 with rule 0 occurs only as
  `FADS 2 0 0` (instant either way). Type 1 is an instant change.
- `FANX` does nothing when it runs: `0x77790`'s 'F' names are ADE, ADS, CCL,
  CLN, CSP, LNT, LOP and LSP, and an unknown name is passed over
  (`0x77814`). Only the look-ahead `0x6f4d0` reads it (with FADS) to fetch a
  rule picture early. The port used to put the staged layers on screen at
  each FANX; now, as in the engine, they come in with the next FADS (in
  `05_01_CIEL05_2_2B` ops 1158-1184 the two pictures staged before each FANX
  come in through the `FADS 2 700 29` wipe with the rest instead of showing
  first) or at the next wait.
- Staged layer changes show at the next wait. The engine runs the script once
  a frame up to its next wait (`0x802c0` -> `0x77790`); STCH and SCH2
  (`0x60840`, any layer 0-39, sets `+0x7c8 = 0x10001`), STCC (`0x62140`) and
  STNS (`0x648a0`) set `+0x7ca`, and when it is set after the run the step
  applies the staged state at once with no transition (`0x5d3a0(0, 0)`).
  The port kept staged layers hidden until a FADS, which about 530 places
  never reach before their wait (`05_00_ARC05_9_1` ops 1586-1609: a panel
  with Shiki moving for 800 ms and a line of text over a black screen;
  `11_00_ARC11_2` op 1127: removed layers kept through a message). Now
  `WAITS` (MSG, MSAD, WTTM, VCWT, STCF, SELA, SELS, SELD, TOMW, and since 2026-11-06 CLO2-CLO5, whose
  handlers always return through 0x7fef0; WTSV is not a command) put them on screen first.
- FADS's fourth argument closes the text window for the transition
  (`0x60610` sets `+0x89e`, the flag CLO2 / CLO3 set): 1 always; 2 when ms > 1
  and no CLO4 / CLO5 fade is running (`0xae05a8` is 0); none or -1 only when
  config `+0x63` is 0, but the engine sets it to 1 (`0x2c810`) and no setting
  changes it (`0x2a730`); 0 never. With the flag set `0x391a0` stops drawing
  the text and click mark at once while the panel stays, and the next message
  fades the window in over 18 frames (`0x6e0d0`). 54 timed FADS pass 2 or 1,
  mostly expression changes mid-page in fights (`10_00_ARC10_3_2`,
  `03_01_CIEL03_2_1`, `08_01_CIEL08_4`). The port's text box now draws no
  text while closed, which also makes CLO3's text go at once as its panel
  lowers (the engine sets the same flag there).
- `SHOK(x, y, period = 300, count = 3, delay)` (`0x5f8f0` -> `0x2ee70`,
  drawn by `0x2ef30` mode 1): the offset is sin(phase) times the amplitude
  times a level falling linearly to 0 over period x count, the phase
  turning once a period (`0x152750` is `sinf`, `0x152740` `cosf`), in view
  units: x x 640/1280, y x 480/720. The story's layers are drawn by draw task
  10 (`0x3b9a0` registers `0x3bba0`, priority 20) through `0x37f50` ->
  `0x34440` in a 640 x 448 view, and `0x34440` adds the offset twice to every
  layer's position: 3 px across and 3.21 px down a unit of the amplitude at
  1920 x 1080 (`SHOK 0 7 120 5`: 7 x 3.21 = 22.5 px at most; the port's old 4 px
  a unit was 28 px). `0x32050` moves a panel's clip by the same amount, so the
  panel and its pictures move together. `0x3fdd0` also draws the buffers of
  screen tasks (`XSTP`, `0x3f600`) at the offset cut to whole units; XSTP is
  in two scripts, and the port draws no such task. `effects.js` `impactPixels`. The text window does
  not move with it (`0x391a0` ignores the offset while `0xafeb9c` is set).
- A layer's quake, shake and sway (`SQK2`, `SHK2`, `SSW2`; not `STQK`, see above): `0x63520`
  stores the amplitudes as given and `0x3c970` keeps amplitude x random or
  wave in the layer record (`+0x184`/`+0x188` x, `+0x18c`/`+0x190` y, two
  slots); `0x34440` adds a third of it to the position in view units: 1 px
  across and 0.80 px down a unit (the port drew 4 px). A panel's clip moves
  with its owner's offsets (`0x32050`), and so do the layers linked to it
  (`0x37f50` adds the clip's origin). Each record draws its own random
  numbers, so layers quaked together jitter against each other; SQK2's sixth
  argument (mode) not 0 makes layers 2 and up copy layer 1's offset (else
  layer 0's). `0x34440` picks what a layer adds: an SBAS child its root-most
  quaking ancestor's offset, a layer linked to a quaking layer the link's (none
  when the link is a panel, whose clip carries it), else its own (corrected
  2026-11-06, FIX-CHECKLIST V10: the port had given layers started together
  one shared sequence). `effects.js` `slotShift`, `clipShift`.
- A sway (`SSW2(layer, a, b, ms, ms, factor, duration, delay)`) keeps a timer, an amplitude and a period for each
  axis and shows sign x amplitude x factor x sin(2 pi timer / period). When the timer passes the period it goes back
  to 0 and `rand()` gives a new amplitude, r x (b - a) + a cut to a whole number, a new period the same way from the
  two ms x 3 / 50, and the first time the sign (`0x3d1b8`-`0x3d5fc`): a cycle lasts period + 1 frames. The ends are
  used as given, not sorted. `rand()` is the C library's and is never seeded, so the numbers are the same at every
  launch; `0x3c970` draws them layer by layer, x before y, and then makes the speed lines' batch (`0x86850`), which
  takes one number for its count and one for each line's distance. `effects.js` `advanceRandom` draws in that order
  from `random.js` `crand`. A restore leaves a running sway's cycle alone (`0x5baf0` writes the command's numbers
  only); a plain STCH on the layer ends the sway.
- `MSQK(ms = 1000, x = 5, y = 5)` (`0x77790` 'M' "SQK" -> `0x39110`; ms over
  10000 counts as 1000): each frame `0x3c970` picks a new offset at random
  within +-x x 640/1280 and +-y x 448/720 view units until ms has passed, and
  `0x391a0` adds it to the window's places: 1.5 px a unit both ways. The port
  drew 4 px a unit, a new offset every other frame, and defaulted to 300 ms.
- `STTR(layer, rule, flip)` makes the layer's alpha a wipe through rule
  picture n laid over the screen. STTR stores `flip << 12 | rule - 1` (state
  `+0x8ec`, layer record `+0x118`) and loads the rule into the one rule slot
  FADS also uses (`0x4b4c0`; the port keeps that slot too since 2026-11-08, `gfx.ruleSlot`, N2-97). Every FADS reloads
  that slot (its rule, or empties it for rule 0, `0x60610`) and the end of
  every transition frees it (`0x48ac0`), so an STTR layer left on screen draws
  with no rule picture; at alpha 255 the threshold is above any rule value, so
  it shows whole either way. In the scripts every STTR layer present at a
  FADS (62 cases) or at another STTR with a different rule (2:
  `02_00_ARC02_4B` ops 58-62) has finished its tween at 255; the nine wipes
  that do run past a rule-0 FADS (N2-97) were drawn with the picture RULE_nn by
  the port, and a native frame shows plain alpha instead (a layer at alpha 128:
  bg .50, picture .51). The draw `0x36520`
  renders the layer to a buffer and composes it with `0xa7190` (or
  `0xa6e90`): colour = the layer's alpha, shader constants threshold = the
  alpha, softness 128 (x render width / 1920), direction -1, and w = bits
  12-14, which the shader uses to flip the rule across (1), up and down (2) or
  both (3). So at alpha 0 nothing shows, at 255 everything, the rule's dark
  parts first. The scripts always follow STTR with an alpha tween
  (`03_01_CIEL03_3_2` op 639: `STTR 10 26`, `STGS 10 '' 255 600`, a black
  card sweeping in from the left; `10_01_CIEL10_6` op 2374: `STTR 22 26 1`
  and alpha to 0, mirrored). The shader that reads w is an engine-embedded
  variant of the `transition` program (SPIR-V `4ee51e76b468223e`);
  `transitionalpha.bnsh` (`b1396e98e381ff2b`, a fixed mask, which the port
  had copied) has no w. Which program the draw list binds was inferred from
  the constants, not read. The port had drawn a fixed mask over the layer's
  own picture with the third argument as a softness. Shaders were matched to
  files by the PC build's hash (the first 16 hex digits of the SHA-1 of the
  code block); `transition` is `26e38a361f783541`.
- `STNS(layer, n)` is film grain (`0x648a0`, drawn by `0x35fc0`): moving
  static (`NOISE_PARTS`, built by `build_ui.py`) is drawn in the layer's
  place, the layer's picture giving only its shape and the layer's opacity
  and blend mode applying to the static (exalpha, `d8c6f5ebc4620f7f`). The
  layer's own colours do not show. The static moves every frame and mirrors
  across every third frame (`n` <= 2) or every second frame; `n % 10 == 2`
  uses the second noise picture.
- `FADE(40, level, preset)` is an RGB split (`0x2f910`, `0x2fc50`): red, green
  and blue drawn shifted along an angle that swings between -30 and 30
  degrees, pulsing, moving on every sixth frame, faded in over a second (at
  full at once when the level is not 0); FADE 40 again while it is on keeps
  it going with the new level and preset (FIX-CHECKLIST V8); `FADE(41)` fades
  it out. The scripts use no other `FADE` kinds; others are logged. The
  shifted picture is laid over the screen with the `overlay` shader at the
  split's alpha, not drawn in its place: the picture stays where it is and
  gains contrast, the moved copy only tinting it. Red moves by +d, green by
  -d, blue by -2d (y down), each channel over an unmoved copy where the moved
  one leaves the screen, times its pass colour (255 + level) / 255 twice
  (FIX-CHECKLIST V15, checked against the native build's frames).
- `FCLN(..., type)` draws speed lines from the engine's 30 presets (centre,
  start radius, count, alpha, regeneration interval; exported by
  `build_effects.py`); `FCSP(ms)` fades them. Only the last argument is read
  (`0x92120`). Each line is drawn by `0x87150` as a 960 x 2 strip of
  `EFFECT_PARTS/FocusLine` (1920 x 128) from (u, v) by type (table
  `0x3527c0`: type 6 (0, 10), 7 (0, 40), 10 (0, 30), 18 (850, 120), the rest
  (0, 0)), in the 640 x 448 view at x scale sx and y scale 448/1080: 2 px
  wide and 960 sx view units (2880 sx px) long from its start point outwards.
  sx is 640/1920 at the start of each frame; type 7 sets 2/3, 9-10 1/2, 13
  and 19 0.4, 15-17 0.6, 28-31 0.5333, and types 8, 18, 20-23, 26, 27 and 32
  set one by the line's angle, a setting carrying over to the next lines
  (`screenfx.js` `lineScale`). The port drew the whole picture as a 2600 x 14
  px wedge. FCLN brings them in at full within a frame and FCSP(ms) fades
  them over ms (`0x86470`: level step 1 / frames), as before. Types 1-3
  (falling banknotes, `FallNote`) are not drawn; the scripts never use them.
  The lines are drawn with `default_mesh` (`0xa2790(0x2b)` = shader table
  position 54). The draw also sets `0xb0640(0x1e)` for types 6-8 and
  `0xb04e0(1)`. Blend state 1 in `0xd3914`'s table is additive (SrcAlpha, One),
  but these values do not index that table directly (the FADS fade copy and
  the text window use 9, which there is "min"): the draw objects take their
  blend state (`+0x24c`, read by `0xb8990` -> `0xd495c`) through virtual
  setters (`0xbacf8`), which were not followed. The port blends normally; for
  FocusLine's white lines the two differ only over mid-tones.
- `FADE(40)`'s offset scale: `0x2fc50` draws at the render size and scales by
  width / 960, so the port's x2 at 1920 stands.
- `SPFC`/`SPRD` have the engine prepare a processed picture in a cache slot
  and `SPRC` empties the slots; nothing is drawn. The web version loads the
  picture early.
- `STRA(layer, n, ms)` is a heat haze (corrected 2026-11-06; this note used to
  say nothing draws it). `0x645f0` stores n in the layer record (`+0x238`) with
  a phase counter (`+0x23a`, whole frames, advanced by `0x3c970` modulo 31416
  while n >= 1), a fade-in (`+0x23c`) and a fade-out (`+0x23e`/`+0x240`), and
  n in the state block at `+0x1364`, which every commit copies back into the
  record (`0x5d3a0` -> staged `+0x238` -> `0x3c970`). The draw `0x36520` calls
  `0x362a0` with the record + 0xc, so its offsets are `+0x22c..+0x234` (which
  is why the earlier search for `+0x238` missed it): entry n of the 557 x 10
  float table at `0x352bd4` (`0x91520`) becomes the constants of
  `nexl_nxshader_haze` (shader table position 15, blend `0x26`), which shifts
  the picture's texture coordinate by a sine across and a cosine down, both
  waving along v. Not drawn while the layer has STNS grain (`+0x1b0`). The
  port draws it in the layer shader (`effects.js` `hazeConstants`,
  `renderer.js`); details in FIXES.md, "Function-map fixes, section 2".

Expression/layer copies inherit independent motion and effect state. Saves and
rewind checkpoints store motion phase, tween phase, captured starts and effect
phase; older saves without those fields still load. Image conversion/loading
holds game time so a short animation does not finish before its art appears.

## Native evidence and limits

These addresses refer to the module-relative prepared image with SHA-256
`ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951`.
Evidence was read from the existing recompiler output and image using local
repository tools. The layer placement above was also decompiled with Ghidra
12.1.4 (headless, raw AArch64 image at base 0). No claim here relies on
observing the original engine execute.

| Native location | Observation |
|---|---|
| `0x399f40`, helper `0x99f90` | Per-track duration table, in milliseconds |
| `0x3b1940`, helper `0x99fc0` | Cumulative end indices into the frame table |
| `0x65ce18`, helper `0x99ff0` | 64-byte keyframe records; hold and omitted-key sentinels |
| `0x999a0` | Loop-start lookup: 2,027 tracks loop, including partial-track loops |
| `0x97710`, `0x97b80` | Property sampling and motion playback |
| `0x9a270`, `0x958f8` | Capturing starts and pausing tracks |
| `0x62f90`, `0x329f0`, `0x9598c` | Wait masks and non-blocking loop behavior |
| `0x91540`, `0x91900`, `0x91cf0`, `0x63520` | Quake, shake, sway parameters and effect slots |

The keyframe numbers and loop points come from the game. Easing is the engine's
Penner table (`0x30c80`, and its copy `0x961b0` for motion tracks), with its own
expo terms, elastic in-out period and back in-out overshoot; mode-1 keys follow
its natural cubic spline over the channel's keys (`0x972c0`, `0x97710`); see
[audit/NATIVE-PARITY.md](audit/NATIVE-PARITY.md). Quakes use the port's own random sampling: the engine's generator
for them is seeded anew at every launch. A sway draws from the game's `rand()`, which is never seeded, at the game's
moments (`random.js`; audit/FIXES.md, "The game's random numbers"). SHOK, MSQK and the per-layer quake, shake and sway
are drawn at the engine's scale (see "Transitions, grain and screen effects"). Distortion/noise, shader effects, particles and
transition masks remain separate work. Four native tracks have
non-monotonic times (three also have keys beyond their duration); the exporter
preserves their source order and the runtime caps playback at the native duration.

## Endings and Ciel-sensei

Every bad end (and Arcueid's and Ciel's two endings) finishes its scene with `RDED` and then `JUMP 3100,QA_nn`:
3100 is `QACALL`, entered at the episode's label. `QACALL` sets `F027` to the episode number, shows the
"Teach me, Ciel-sensei!" card (`img5012`-`img5014`), waits, and asks with `SELS`. Yes (1) plays `QA_nn` (jump
`1000 + nn - 1`); No (0) fades out and returns to the title. Each episode starts its own scene (`RDST 532 + nn`),
completes it (`RDED`) and returns to the title with `RTM_`. `QA_25` is the completion episode: it starts with
`IFUR 1,COMP_CHECK_OK` and returns at once unless episodes 1-24 are all complete.

| Native location | Observation |
|---|---|
| `0x92800`, `0x83b20` | `SELS`: a two-way question of the engine's own (selection type 2); the question is SYSMES `1445 + F027`, "Enter hint corner (No. n)?"; the answer goes to the named variable, Yes = 1 |
| `0x79c00`, `0x926f0` | `IFUR`: calls `0x926f0(1)`, true while any of scenes 533-556 lacks its `RDED` bit; jumps only when none does |
| `0x789c8` | `RTM_` (and `RTMN`, after setting `0x146e64d`): back to the title; nothing after it runs. `RTM2` only sets `0x146e64d` |
| `0x81b30` | `WTTM ms,flag`: with flag 0 or absent a button press ends the wait; flag 1 makes it uninterruptible. The first card waits 300000 ms for that press |
| `0x92440`, `0x92630`, `0x922c0`, `0x926b0` | `RDED` sets bit n of the global words at `*(0xae04e0) + 600` when n is the current scene; `RDST` sets bit n at `+ 0xdc`; `0x922c0`/`0x926b0` read them |
| `0x3374ec` | The ending list: 25 rows of (scene, message, -). Rows 0-2 are the endings (`QA_12`, `QA_23`, `QA_24`), then 21 bad ends, then `QA_25`. The title is SYSMES `1380 + message`, the play prompt SYSMES `1443 + message` |
| `0xdaf8`, `0xdda4`, `0xeec0`, `0xf6f8` | The list's drawing, first cursor and movement: a row is shown seen when its scene's `RDST` bit is set; `QA_25`'s button appears only when `0x926f0(1)` is false |

So an entry joins the Ending List when its episode begins, not when the bad end is reached; declining the episode
leaves it out, as in the original. The web version keeps those bits in the flowchart progress (`started`,
`completed`; `app/js/endings.js`). Progress from before the episodes could run is judged once: an entry counts as
seen when the scene whose `RDED` leads into its episode was completed, or a line of the episode was read.

`IFSC` branches unless the scene is being played from the gallery (`0x47b00` returns the byte at `0xb34af0`; `vm.js`
`op_IFSC`). `TRPY` unlocks a console trophy, which the web version has no use for, so it does nothing. Once episodes 1-24
are complete the title shows SYSMES 239 ("Congratulations on completion!") once, on its band (`ui.js`, G069).
The episode title shown under the Ending List while choosing is this version's own.

## Sound

| Native location | Observation |
|---|---|
| `knife1.bfsar` FWAV | A looped wave's loop start and end (`sar.loop_of`); 196 looped effects are played by scripts, 108 with a start after 0 |
| `knife1.bfsar` stream info | Each music stream's loop start and end in 48 kHz frames (reference 0x2210 of its StreamSoundInfo); the Music Player's table at `0x34bd68` repeats them |
| `0x9c470`, `0x6f0` | Music numbers start at 1: n plays sound `0x01000000 + n - 1` (table `0x333f90`), so stream `audio_tables.json` bgm[n - 1]. MPLY (`0x649e0`) passes the script's number unchanged and sets unlock bit n (`0x64f60`); the title plays 2 (`0x8e1c0`). The port had played bgm[n], one stream later, everywhere; 14 MPLY 069 start offsets lie past the end of bgm[n] but inside bgm[n - 1] |
| `0x19ec4` | The Music Player's 95 rows at `0x34bd68`, 56 bytes: music number, title, singer, lyrics, composer, arrangement (SYSMES; labels 245-248), length in ms, loop start, loop end, five more numbers. A row is listed once any of its numbers has played (bit n + 0xc80 of `0xae07a8`, `0x77740`); music 80 and 124 also by G005 bits 0 / 1 (set by `0x40a00` for movies 5 `op1_arc` and 6 `op2_ciel`), 82 and 126 by scene 560 / 562 having started (`0x926b0`) |
| `0x649e0` (MPLY) | Options 0x11 volume, 0x01 fade in, 0x0b the old track's fade, 0x31 (049) loop (`0x9c960`), 0x45 (069) a start offset: `0xee200` passes it as nn::atk StartInfo offset type 2, samples |
| `0x6a340` / `0x66200` (SEPL) | 0x11 volume, 0x01 fade, 0x12 (018) pan ((v x 1000 - 64000) >> 6), 0x46 (070) the character whose voice setting applies, 0x44 (068) a delay: ms x 60 / 1000 frames counted down per channel by `0x65e50`, not while skipping |
| `0x77f9c` (VCWT) | Waits while `0x9c400` reports the voice channel busy (wait bit 2); `0x802c0` ends it when the voice ends, on a click (which stops the voice under "Voices stop on input" unless F1123) or when skipping. `0x7f69c` is WTVT, which no script uses; WTSV is not a command (corrected 2026-11-06) |
| `0x6e0d0` | A message plays the voice its VPLY named at the character's row volume (+0x34 + 2i) if the row is on (+0x24) |

`build_system.py` writes `seLoops` and `musicLoops` to `system.json`; `audio.js` loops between them, starts music
at 069's sample, delays 068 commands on the game clock (one waiting command a channel; the next replaces it) and pans
018. A voice counts as playing from the moment it is asked for, so VCWT right after VPLY waits for it to load.

## Title screen and system menu

The interface pictures are numbered slots filled from tables of (slot, file, texture index) rows; the relocation
table fills their pointers. `title_parts` is slots 0x138-0x143 (0x138 holds `title_bg1`-`4` by variant),
`menu_parts` 0x1f5-0x208, `disp_parts` 0x34-0x79 (`kirakira` 0x51, `menuBG01` 0x52, `menuBG04_0`-`3` 0x53-0x56,
`menuBG05_0`-`3` 0x57-0x5a). Draw calls name a slot. The original counts in frames at 60 a second; `app/js/uifx.js`
keeps that.

| Native location | Observation |
|---|---|
| `0xb5650` | Start-up, before the title: after loading the system data it plays movie 38 (`TM_CI`, table `0x40b890`) over white; a press passes it once the movie has played 120 frames (table `0x3c98fc`, stride 0x18: picture slot, hold, minimum, ..., background; checked against the movie's time, `0x1ae0`). Then `parts` entry 1 (`caution2_1920x1080`, loaded by `0xb4a20`) fades in at 0.025 a frame over the white, stays up to 480 frames (a press passes it once it is in), and fades out at 0.025 over black. Entry 0 (`logo_fix`, slot 1100) is shown instead of the movie only on a path (`0x194df08` set: states 0xd-0xf) that was not traced |
| `0x8e200` | The title's flow. State 0 plays music 2 (72 once the title stage is 5); 1 plays the variant's movie (`0x17c0`, movie 0-3 = `titlebg1`-`4`), looping back to frame 240 (8 s, `0x34dcd0`); 2 fades in at 0.012 a frame; 9 is "press any button", pulsing at 1/60 a frame from nothing; a press (any button) starts the music's fade at 0.5 level units a frame (3.33 s, so it carries into the cautions) and fades to black at 0.02 a frame up to 1.2; 11-13 show the cautions: in over 50 frames, at least 240 and at most 720 frames, out over 50, the white rising 0.02 a frame over the second's fade (state 0xd), so state 0x14 goes on from about 1 and holds 20 frames before the story |
| `0x90180`, `0x3529e4`, `0x65bf98` | The title stage in the global save: 0, 1 once scene 560 has started, 3 after scene 383, 5 after scene 562, one step per visit. Stage to variant `1, 2, 3, 3, 2, 4`; each variant's table loads `title_bg<n>` into slot 0x138 |
| `0x8d5d0` | The title's drawing, on a 960 x 544 screen: the logo in three pieces (`0x3529fc`, rows 0-285, 285-570, 570-648) at 1080p (680, 72 + row), fading in at t, t^2, t^3 as t rises 1/120 a frame; `titlemenu_lumi` at (720, 552) with a rising and falling alpha; the menu items coming in one after another (item i at 2m - (i + 1) / n) |
| `0x90d00`, `0x90e80` | Logo dust while the movie plays: 200 fixed slots; each frame up to four free ones get a mote (the search stops at the fourth and only then moves its cursor on): one of three texels of `logoparticle_all` (`0x352adc`), alpha 0.25-1, life 18-60 frames, at x 405-555, y 184-399 (960 x 540). A mote does not move; its alpha rises to the middle of its life and falls again. It is one framebuffer pixel |
| `0x905b0`, `0x907e0` | Logo shards: 120 fixed slots, one new every other frame: one of three cells of `logoparticle_all` (`0x352ac4`: 33 x 44, 32 x 55, 29 x 45), scale 0.3-0.75, life 120-270 frames, rising 0.13-0.58 a frame, drifting by a speed times cos 80-100 degrees (the speed is read through a pointer that walks the pool from slot 0, so it may be another slot's), alpha 0.5-1, spin phase 0-640 degrees turning 0.5-3 degrees a frame, at x 412.5-547.5, y 303-378. In over 60 frames and out over the last 60 (0.7 alpha on alternate pairs of frames); drawn centred, the cell scaled by fade x cos(phase) x scale across and fade x scale down, so it turns edge-on and over |
| `0x90e80`, `0x907e0` (draw) | Both are drawn before the logo with blend 9, at the logo's alpha (t^3 while it fades in), clipped to the top 680 of 1080 rows, so the shards come up from the "TSUKIHIME" line; `titlemenu_lumi` is drawn after the logo, added (blend 0x1e), its top left at (720, 552) |
| `0x4cba0`, `0x4d710`, `0x4d7e0` | The system menu fades in at 1/18 a frame and out at 1/30; closing also fades the background (`0x49630`). A choice acts at once, its button staying pressed 10 frames. Input only once the menu is up (`0x4d8c0` state 3) |
| `0x4d8c0` states 0xe, 0x10 | To the flowchart: the foreground out at 1/12 a frame with the background left up under the chart, and back the same way, the row lit at the end. "Flowchart is not yet available" comes between the same two fades, over the background alone |
| `0x50fc0` states 1, 5, 0x1b, `0x4f240` | Save and Load: the screen's own level rises 0.024 a frame and falls 0.048, each piece drawn at it, with no input during either. Closing empties the list first, so each row's picture and text and the panel go on the first frame and only the empty windows, backdrop, help band and scroll bar fade |
| `0x4b880`, `0x49630` | Its background: `menuBG01` (itself about a third opaque), then the `menuBG04` bands rising from the bottom and the `menuBG05` bands dropping from the top as t goes 0-1 over 60 frames, eased 1 - (1 - t)^2, ending flush with the edge, at alphas 64-224 / 255 |
| `0x4c190`, `0x4bd10` | `kirakira` sparkles: one a frame, 100 at most, size 0.1-0.3 (80 x size wide on the 960 screen), life 120-270 frames, alpha 0.25-0.5, rising 0.13-0.5 a frame toward (480, -75); in over 60 frames, out over the last 60 at 0.7 alpha on alternate pairs of frames |
| `0x4c370`, `0x350508`-`0x350544` | The menu cursor, drawn after the buttons and added: `systemcursor_line`'s strip (16, 8)-(344, 32) anchored at its top centre (flags 0x11) at (66, 56.41 + 31.11 r) of the 640 x 448 menu, so its bright row lies along the label's baseline (the strip runs past the 224-px picture, an empty part); it fades in and stretches out over 10 frames when the cursor moves. `systemcursor_light` from its top left at (0, 13.27 + 31.11 r), its star where the line starts; it pulses between 0.5 and 1, up at 1/60 a frame and down at 1/120. (The port first centred the whole line picture on that y, which put it through the middle of the label, and drew the light 70 px left and 10 px up) |

The web version computes the title stage directly from the scenes started, so a player past all three scenes sees
the last background at once rather than one step per visit. The glow's rate is not traced (1/60 a frame is used),
nor the title cursor (`titlecursor`: no draw call names its slot 0x13b), so it is not drawn. The title's sounds are
played (see "Interface screens"). Animations run on the browser's frames: a hidden tab holds them, and the system
menu still closes after 0.6 s then.

## Touch ring

A left click on PC is passed to the game as a touch (`framework/games/tsukihime_common/hle_hid_tsuki.cpp`), and the
game marks every new touch:

| Native location | Observation |
|---|---|
| `0xad4e0` | Reads the touch screen each frame; a touch that has just begun calls `0x1034(x, y, 48.0, 0.5, *0xae0170, 1)` with x, y in the render target's pixels |
| `0x1034`, `0xd14` | 16 records at `+0x3400` (32 bytes: x, y, -, size 48, life 0.5 s, time, flag, in use); a 17th touch draws nothing. `0xd14` sets the colour at `+0x3600` to (1, 1, 1, 0.5) |
| `0xe00` | Each frame the time rises by frames / 60 and a record ends at 0.5 s. Each is a 32-segment triangle fan without a texture (`0xb8648`): centre colour clear (`0xb895c`), rim (1, 1, 1, 0.5) (`0xb8974`); radius 0 -> 48 by easing type 3 out (cubic, `0xe1bfc`, `0xb8904`), alpha 1 -> 0 by type 2 in (quadratic, `0xb82b8`); at the touch point (`0xb890c`), on layer 0x54 + slot |

The port draws the same ring on a canvas over everything (`touchfx.js`) for a left press or a touch on the picture,
caught before any screen's own handler. The blend state of the draw (`0xd2378(obj, 13)`) was not traced; the ring is
blended normally.

## Interface screens

A sweep of the in-game screens against their draw and update code. Conventions, all from the draw primitives:

- `0xb6d50(x, y, slot, flags, blend)` draws a picture slot (x, y in s0/s1; `0xb6de0` and `0xb7010` add a source
  rectangle). The low four bits of `flags` pick the anchor from the tables at `0x3c9810`/`0x3c9840` (0 top left,
  1 top centre, 2 top right, 3-5 the middle row, 4 the centre, 6-8 the bottom row); 0x10 applies the scale set by
  `0xb0460`, 0x20 the rotation set by `0xb0480` (a short, 65536 to a turn).
- `0xb03e0(alpha, r, g, b)` sets the colour (stored as bytes 64-67 at `0xac0d64`; the interface's constant colours
  come out blue and cyan in this order, e.g. the help bar's (1, 60, 101)). Blend 0x1e is additive.
- Most screens set a 640 x 448 virtual screen and draw 1080p art at (1/3, 0.4148) so it is 1:1 on the stage; the
  web version keeps those units (`px`, `py` in `app/js/uifx.js`).
- Buttons are one system (`0x18c0c08`, 0x88-byte entries in groups by screen, registered from 12-word tables by
  `0xadc50` / `0xadca0`: id, group, flags, hit box, x, y, alpha, cells per state, tooltip). See "Buttons" below.
- Tweens (`0x26720`, `0x26894`, `0x268ac`) and the easing objects `0xe1bfc` uses take a type from the classes built by
  `0x26774`, in Penner's order: type 2 is quadratic (`0x26a18`, `0x26a30`, `0x26a50`), 3 cubic (`0x26aa8`-`0x26af0`).
  The run-time table `0xe1bfc` reads (`*0xae0178`) is taken to hold the same classes in the same order.

`app/js/uifx.js` holds the timings (`ChoiceFx`, `DialogFx`, `ButtonState`, `EASE`, `titleSubmenu`, the click mark,
panel and indicator constants); `web-dev/tests/screens.test.mjs` tests them.

### Buttons

| Native location | Observation |
|---|---|
| `0xae840` | Every frame each button gets a state: 4 (pressed) while its counter runs, else 1 or 3 under the cursor and 0 or 2 away from it (2 and 3: switched on). When the state goes 0 -> 1 or 2 -> 3, a level at `+0x48` is set to 1 and falls by the rate at `+0x4c` (0.1, from `0xadca0`) |
| `0xaeec0` | Draws the state's cells, then, for buttons with flag 0x20, the same cells again, added, at that level: a lit button flashes as it lights up and settles over 10 frames. Flag 0x800 would add a pulse (0 -> 1 -> 0 at 0.005 a frame); no interface button has it |
| `0xae040` | `0xae040(button, 10)` holds a button pressed for 10 frames. Called on a choice by the title (except GALLERY), the system menu (`0x4cea0`), the mode panel (`0x4e170`) and the dialogs (`0x49f00`); the gallery's column and the story's question do not |

| Group | Table | Flags | Cells (normal / lit / pressed) |
|---|---|---|---|
| 10 title | `0x65cbd8` | 0x20 | `titlemenu` 296 x 72 from x 24 / 336 / 648, drawn 1:1 at (272, 298.67 + 23.23 k) of 640 x 448, hit (0, 4)-(98, 25) |
| 11 title GALLERY submenu (never shown, see below) | `0x65ccf8` | 0x20 | `extra_menu_ja` 256 x 64: (336, 40 + 72 j) / (40, 360 + 72 j) / (336, 360 + 72 j); ids 0xf1-0xf5, the last two both Back |
| 1 system menu | `0x591438` | 0x120 | `menu_btn_ja` 224 x 88 from x 24 / 264, on and pressed 504 |
| 14 mode panel | `0x5918c8` | 0x320 | `mode_panel_btn_ja` |
| 15 system dialog | `0x590f08` | 0x20 | `dialog_btn_ja` 216 x 56: Yes (224, 0) / (0, 135) / (224, 135), No (224, 67) / (0, 202) / (224, 202) |
| 13 story question | `0x65bbc0` | 0 | the same cells, no flash |
| 25 gallery column | `0x44e438` | 0x20 | `gallerymenu_btn` 256 x 96 at (80, 160 + 80 k): (8, 8 + 104 k) / (272, ...) / (536, ...) |

The port drew the title rows 322 x 56 scaled 0.92 with no pressed look, the dialog's normal cells from the grey
column, the system menu's third column 12 px off, and no flash anywhere (an earlier pass gave dialogs and the panel
the 0x800 pulse, which they do not have). Choosing a title, system menu, panel or dialog button now shows its pressed
cell for 10 frames before the screen moves on (the original moves on at once and the pressed cell shows during its
own screen transition, `0xb8070`, which the port does not have).

### The title's GALLERY and New Game

| Native location | Observation |
|---|---|
| `0x8e200` state 0x11 item 5 (`0x8f5c4`-`0x8f618`) | GALLERY plays 1, writes state 0x29, raises the system menu's background (`0x49630(0.02)`), then writes state **0x30** over the 0x29, disables group 11 and sets `0x1536158` (the cursor comes back to GALLERY, state 0xe). States 0x29-0x2c (the CG Gallery / Music Player / Flowchart / Back submenu, `extra_menu_ja`, drawn while `0x1536178` is above 0) are never entered in this build; the recompiled `code_011.cpp` `L_8F5C4` does the same |
| `0x8e200` states 0x2e-0x31, 0x3f; `0x48ac0` | The title's black (`0x1536184`) rises 0.02 a frame; past 1.2 it is set to 1, `0x90180` runs and state 0x3f returns state - 0x29: 7 for 0x30. `0x48ac0` case 7 calls `0x47ae0` (extra state 0xf: the gallery object, `0x4210` / `0x42d0`). Cases 5 and 6 (`0x45850`, `0x46660`: screens drawing from `extra_parts`, which the game data does not have) only follow the unused states 0x2e / 0x2f |
| `0xb7f00`, `0xb80b0`, `0x47bf0` | Draw tasks run in ascending priority: the title (task 0x14, priority 10, `0x8d5d0`), then the system menu's background (task 0x10, priority 83, `0x4b880`), then the gallery (task 0x18, 88). So the background covers the title, its buttons and its black. `menuBG01` is 29-36% opaque (alpha 74-92): the title shows through it, and once the black is up the gallery's look (the background over black) is already on screen |
| `0x4ca50`, `0x2b010`, `0x4ef00` | The system menu (header, column, cursor) is draw task 0x11 at priority 84, the config 90 and the save screen 100. So those screens' backdrops and help bars lie over the column, and the bar runs unbroken across the bottom of the screen |
| `0x4b880`, `0x49630` | The background's level (`0xb34b70`, menuBG01's alpha) moves by the rate (`0xb34b74`). The bands have their own t (`0xb34b78`): raising runs it at 1/60 a frame and the bands close in (1 - (1 - t)^2); lowering runs it at the rate and leaves the bands in place. Each band's alpha is its own times t eased, not times the level |
| `0x8d5d0` (`0x1536194`, `0x1536168`) | The logo's level moves only while the black is under 0.5: down 1/60 a frame while the background is up (`0x4bcf0` above 0), its three pieces, `titlemenu_lumi` and the dust all at the level; otherwise up 1/120 a frame, the pieces at L, L^2, L^3 and the light and dust at L^3. The light's glow swings at 1/120 a frame (`0x153616c`, set by `0x8d2f0`) |
| `0x48ac0` mode 4 -> 0 (substate 10), `0x8d2e0` | Back from the gallery starts the title again (state 0: three frames, its music, then the fade in from black at 0.012 a frame) with the background lowering at 0.02 a frame (`0xb34b74` = `0xb34b7c` = -0.02, `0x1b20(0)`) and the cursor on GALLERY |
| `0x8e200` state 0x14 | New Game plays 6, fades the music at 1.5 level units a frame, 1.11 s from level 100 (`0x9c9b0(1.5)`), and the screen to white (`0x1536180`) at 0.01 a frame up to 1.2. The white is drawn twice: at (w, 1, 1, 1), then added at half that (blend `0x1e`), so it is full at about w 0.67 |

New Game's white stays up until the story's first picture has been drawn: on native frames the screen is full white from the end of the fade until the story appears. The port fetches the script after the title has gone and its canvas is black until the first `FADS`, so `main.js` `holdWhite` keeps a white sheet over it until then (2026-11-10). The title's Load goes on as Continue does (`0x8ea94` -> `0x8f2b0`): with the save screen gone the title stands alone, its logo still down, the music falls at 1.5 a frame and the picture goes to black at 0.01 a frame up to 1.2 (`ui.js` `savesScreen`; N2-128).

An earlier pass read states 0x29-0x2c as a live submenu and gave the port one; the port now does what the native does:
GALLERY plays 1 and, with no pressed hold, raises the background over the title (`MenuBgFade`, `menuBackground(page,
{ fade })`) while the black rises under it and the logo fades (`titleLogo`); 60 frames later the gallery opens on the
section it was left on (the CG Gallery at first and after its Title row). Leaving the gallery for the title starts the title fresh under the lowering background, the cursor on GALLERY.

### The gallery's column
### The gallery's column

| Native location | Observation |
|---|---|
| `0x6124`, descriptors `0x44e2f8` | The column's pieces as layout objects (kind, x, y, scale, depth, slot): the window (56, 0), the inner background (365, 0), the underline (0, 72), the buttons (group 25), the cursor line (80, 192), the light (0, 96) and the open section's marker (`gallerymenu_btn`, moved to (80, 160 + 80 k) with the cell from `0x3372f8`) |
| `0x82fc` | A move puts the line at y 192 + 80 k and the light at 96 + 80 k, runs the line's x scale from 0 to 1 over 12 frames (track `0x3372d8`, type 2) and restarts the light's tween |
| `0x5728`, `0x57d0`, `0x585c` | `cGalleryCursor`: the light's alpha swings between 1 and 0.4, type 2 in-out, 1.2 s each way |
| `0x8e200` state 0x11 item 5, `0x48ac0`, `0x47a90` | The gallery's background is the system menu's (`0x4b880`, drawn through `0xae0700` while `0x49630`'s level is up): GALLERY raises it (0.02 a frame), it stays up over the title's black while the gallery is open, the gallery's return to the title lowers it (-0.02), a replay lowers it (`0x5040`, -0.04) and its return raises it again (`0x47a90`, 0.04). `conf_BG` is an empty texture (every pixel 0). It shows under `config_innerbg` and, more dimly, under the gallery's flowchart (`flow_bg`, 57% black) |
| `0x6764`, `0x6934`, `0x6bbc` | The gallery object's states. Entering (state 0) starts the open section's header (`0x5c4c(0.5, ...)`, its own 0 -> 1 over 0.5 s, type 2 mode 0) and a tween for the column, 0 -> 1 over 0.5 s, type 2 mode 0 (quadratic in: `0x26720(tween, 2, 0)`, `0x26894(0, 1, 0.5, 0)`); state 1 sets it as the alpha of the column's eight layout pieces (`+0x48`-`+0x80`, each piece's `+0xb8`) and takes no input until it ends |
| `0x8400`, `0x7328`, `0x7624`, `0x7ac4` | A choice in the column plays 1. Title (item 5, `0x4df4(.., 1)`, state 8): the column 1 -> 0 over 0.5 s, type 2 mode 1 (quadratic out), the header closing the same way (`0x5ea4(0.5)`); then the gallery ends and the title starts again. Flowchart (item 2): the section's object becomes the flowchart (`0x7f38` case 2, `0xf8fc`) and the column goes 1 -> 0 over 0.5 s, mode 1, while the flowchart comes in (`0x110d4` state 0: 0 -> 1 over 0.5 s, mode 0); when it closes (`0x11bec`: 1 -> 0, mode 1) the column comes back 0 -> 1 (state 5 -> 1). Another section: the open one closes and the new one opens (states 3, 4) |
| `0x26720`, `0x268ac`, vtable `0x46ad80` | A tween's mode picks the easing class's method: 0 `+0x10` in (`0x26a18`), 1 `+0x18` out (`0x26a30`), 2 `+0x20` in-out (`0x26a50`). Time is in seconds (`0x27620`) |

The port fades the column, header and section in over half a second eased in (`fadeIn`, `Tween` in `uifx.js`), out
the same way eased out before the title, and cross-fades the column and the gallery's flowchart: the page being left
is kept over the new one while it fades (`ui.ghost`). Left: the sections' own open and close tweens (per `cGallery*`
class, `0x8818`, `0x19518`, ...) are not traced: a section chosen later fades in on the header's half second, and the
old one goes at once; the help band does not fade; the line's easing mode (the track names type 2; out is used); the
sparkles' alpha under a lowering background (they follow the level). A replay's exit (`0x5040`, `0x826c`, `0x7ac4`, `0x7918`): the Ending List's column leaves as for the title and the flowchart gets a black cover, both over half a second, the background going down at 0.04 a frame and the music at 3.33. Sub-grids (`0x8d08`, `0xa4f4`, `0x9bdc`): the old thumbnails and scroll bar fade out over half a second under the new cascade, and each grid brings its own cursor and scroll bar in.

### Interface sounds

`0xacef0(n)` looks up n (0-8) with `0x710` in the table at `0x3341a0`: item ids `0x010040d4`-`0x010040dc`, sounds
16596-16604 of `knife1.bfsar` (`WSD_MOON_SE00001`, 02, 03, 04, 07, 10, 11, 13, 14). The nine are waves of one wave
sound file; the archive reader used to take the first wave of a file for every sound in it, and now follows the
sound's own entry (sound data, note table, wave index; `sar.Archive.wave_at`). `web-dev/tools/build_sounds.py` exports
them to `web/assets/sys/<n>.ogg` (the server also makes one on demand). Playback uses four handles in turn, each new
sound stopping the oldest, at the sound effect volume (`Audio.playSys`).

| Sound | Native callers | Where the web version plays it |
|---|---|---|
| 0 cursor | every screen's update (`0x83e50`, `0x49f00`, `0x4e170`, `0x8e200`, ...) | any cursor move: menus, dialogs, choices, mode panel, gallery, flowchart |
| 1 decide | the same | choosing a menu item, a dialog button, a mode panel button |
| 2 cancel | the same | Back on any screen, the panel closed from the keyboard, the backlog's Back |
| 3 opening | `0x4ad40` (a system dialog opens), `0x40ed0` (the mode panel called down) | dialogs, the mode panel |
| 4 a choice taken | `0x83e50` state 3 | choices |
| 6 start | `0x8e200` ("press any button", New Game) | the same |

Sounds 5, 7 and 8 have no constant caller; they are exported but not played.

### Choices

| Native location | Observation |
|---|---|
| `0x83e50` | States: 1 fading in at 0.04 a frame; 2 the labels typing out together, each at `0x3b2d0` letters a frame (16.67 / the read text's speed in ms on native runs, whatever the page's lines were; two steps on the first frame, a letter out once the front is past it; the labels themselves are whole from the first frame: TODO item 51), a press finishing them; 3 choosing; 4 taken (sound 4), fading at 0.028 a frame while a timer runs down 0.02 a frame (50 frames), then the answer. Moving the cursor plays 0, restarts a 10-frame cross-fade from the row left (+0.1 a frame) and the streak's pulse (1 down to 0.33333 and back at 0.011111166 a frame) |
| `0x84e50` | On the 640 x 448 screen: the dark vignette `altermenu_ I bg` (black, alpha 84-171) over everything at the screen's alpha; the labels at x 88 on the text window's own rows, from its next free row (`0xafec7c`) plus one when the page has text, one row (`0x39180`) apart; the label's glow (a strip of the blurred picture of the labels that `0x83e50` makes with `0xa0a90(2, 0, -2)`, a sigma of about 4.3 px, added, coloured (0.44, 1, 1), (0.75, 1, 1) once taken) at the cross-fade x 0.5; `altermenu_underline` at (71.67, y + 11.61), stretched from 10% to 100% of its width as the cross-fade rises, at half of it; the streak (`altermenu_`) at (-65.33, y - 30.70) at the pulse. Taken: the ring (`altermenu_ O`) centred at (86, y + 24.47), scaled (1 - s) x 1.4 + 0.1 and turned (1 - s) of a turn with s = sin(timer x pi/2), the flash (`altermenu_flash`) over the screen and the lens flare at (5, y - 377.9) coloured (1, 0.75, 1), all added at the screen's alpha |

The port's choices were a centred column with a CSS glow. Left: the labels' own colours (`0xa8cb0` sets a per-text
"selected" flag whose colour was not traced; they are drawn white), and a label with a line break, which the original
also advances by one row. The rows are kept on the stage if a long page would push them off.

### Yes / no dialogs

| Native location | Observation |
|---|---|
| `0x4ad40`, `0x49f00`, `0x4ae90` | The system's question: opening plays 3 and t rises 0.07 a frame. `dialog_BG` at 0.75 t; `dialog_win` centred at (320, 224) at t, scaled (1 + 0.2 (1 - t))^2. The question (y 184; 160 when the dialog shows a scene picture under it, flag `0xb34bb0`, drawn by `0x89ad0`) and the buttons only once t is 1. A button plays 1 and holds 15 frames; Back plays 2 and answers No (button 1) after one; the caller acts on the frame after the hold (0xb34b54 is 0 from then), while the window fades out by itself (`ui.dialog` keeps it on `#sysui`, over the next screen, cross-fading with a notice). Closing, t falls 0.07 a frame; the window shrinks ((1 - 0.2 (1 - t))^2) after Yes and grows after No |
| `0x49710`, table `0x3c9340` | Opens system dialog n with SYSMES table[n] (9 Quick Load? 230, 23 Quick Jump? 231, 26 = 1497). The flowchart (object vtable `0x466b78`, update `0x110d4`) asks dialog 26 in state 4 (`0x11a58`), "Rewind to the selected scene?^Any progress will be lost.", and keeps drawing under it: the flowchart shows through `dialog_BG` (0.75 x its 55% centre) and the window's sides (alpha 208-237), but nothing of it draws over the dialog |
| `0x85900`, `0x85e40`, `0x83e50` modes 2, 3 | SELS and SELA: in and out at 0.1 a frame; the window (x 321), question (0.37 x 0.46 of the font's size, about 30 px here) and buttons all at t; nothing scaled opening (the state stays 0), 1 - 0.05 (1 - t) closing, and not for SELA's Yes (state 5); `dialog_BG` at full, no hold and no Back. A press on the other button moves the cursor, any other press answers once a button has it (0x85690, 0x85c20) |

The pressed cell shows during the hold. A dialog over a screen no longer rebuilds the screen when answered No: the screen gets its cursor
back. The buttons are at their native places (see "Buttons": Yes at (330, 249.01), No at (252, 249.01); the
story's No at (241, 238.52), Yes at (327, 238.52)); a question's first line stays at y 184 (a second goes 64 px below
it, as Default's and the flowchart's rewind), and the buttons' hit boxes are the tables' (`STORY_HIT`, `SYSTEM_HIT`).

### Text window and click marks

| Native location | Observation |
|---|---|
| `0x391a0` | The text window. It draws one of 33 styles from the table at `0x34d94c` (slot, x, y in 1280 x 720): 0-2 are `txtwindow01`-`03`, 3-32 the `tw_*` balloons of `DISP_PARTS_JA` (textures 39-68, slots 91-120), drawn 1:1 at 200/255. The style and its place are script variables: the state block keeps Fn at +2n, so `+0x8a2` is F1105 (style), F1106 / F1107 pick x / y offsets from the tables at `0x34d84c` (27) and `0x34d8b8` (37), and F1111-F1113 draw a second balloon (picture only). A balloon's text starts at its position plus the offset at `0x34dad8` and wraps at the width at `0x34defc` (640 x 448 units). When F822 is 0 the window is a full-screen backdrop instead (only before START_SCRIPT / ARCHIVE set it) |
| `0x38ec0` | Click marks: kind 0 `lineBreak_a` (105 cells of 39 x 39), 1 `pageBreak_a` at half alpha, 2 `pageBreak_ciel_a` (59 cells of 43 x 46), cells from `0x5733e8`/`0x5730a0`/`0x572ec8`. A frame counter takes a cell every other frame: 3.5 s a loop. Drawn at (0.36, 0.45) of the 640 x 448 scale (1.08 x 1.085 on the stage), 2 units after the text's end |
| `0x391a0` (`0xafec88`) | The mark fades in at 0.1 a frame once the text waits |

The mark's kind: with F822 = 1 it is `+0x63e` (WNTY: 0 line, 1 page); in a balloon (style 3 or more) it is kind 2,
the Ciel mark, a cell every two frames of a 118-frame loop, 4 units after the text. The port draws the styles, both
balloons and the third mark from these tables (`system.json` "windows", `build_system.py`; the balloons' Shift-JIS
texture names collapsed to the same file before, so `build_ui.py` now suffixes clashing names with their index).
The page mark sits 2 units lower than the line mark (end y + 5.5 for F799 = 1, + 3.5 otherwise), the Ciel mark at
(+4, +4); the frame counter (`0x572b60`) runs on across waits and kinds, modulo the drawn kind's loop: the port keeps it
in `main.js` (`markFrames`, the marks' `animation-delay`), FIX-CHECKLIST T11. Left: the mark's height reference.

The window's opacity (`0x38d40` each frame): opening raises the panel 16.667 / 128 = 0.1302 a frame (every story
start runs `0x2e170(0x80)`; 0.06 is only the image's value before that), closing lowers it as fast, and CLO3
(`0x7f86c`) at 0.26 a frame; a second value fades by a rate: CLO4(ms) (`0x7f898`) to 0 over ms, CLO5(ms)
(`0x7f918`) from 0 over ms unless the window is already showing, and a message on a closed or faded window
(`0x6e0d0`) from 0 over 18 frames (MSAD, `0x6e950`, only clears F1103). The picture and the page are drawn as two
groups composited at g = panel x max(0, 2(fade - 0.5)), the picture's only while F1103 is 0: the picture shows at g x
panel, the text at g x g, each earlier line dimming to 100/255 over the speed x 1.2 frames; typing waits until the
window is open with no fade-in running (`0x81b30`), and each letter fades in over one letter interval (`0xc0684`).
FIX-CHECKLIST T1-T12 has the details. Measured on native frames on 2026-11-09 (TODO item 51): a line set by MSG shows
nothing on the frame it is set and its first letter on the next; the line counts as typed when the front is one
letter past its last letter, and the wait mark, the auto countdown or an `@e` line's next command start on the frame
after that; MSAD's text has its first two letters at once; the front is single precision, 16.666668 / speed a frame.
CLO2
(`0x7f3dc`) clears the page and hides the window at once; the others leave the page, which the next message clears
when the last one ended a page (`0xae0940`), so CLO4 after a page fades that page out. Message marks (`0x6e0d0`): `@n`
goes on at once, `@e` goes on without a click once the text is typed and its voice has ended, and with "Display
whole text" a message that does not end the page (WNTY 0) behaves as `@e`.

### Fast forward

| Native location | Observation |
|---|---|
| `0x802c0` | The per-frame script step. Each frame, unless something waits, it calls the dispatcher (`0x77790`), which runs commands until the next wait. While fast forward is on (`0xae0660` bit 1, or the per-frame flag `0xae0670`) it clears a message's click wait (bits 0, 6 and 10 of the wait flags) on the frame after the line counts as typed, so a message takes three frames (native frames, TODO item 110). A FADS still waits for its level, a WTTM for its count and an STCF for its tweens; fast forward only makes the frame worth more (33 to the layers, the window and the level, 64 to a WTTM and the mixer: `0x4a5b0`, `0x81b30`). The run without drawing (`0x146e664`, `0xae0568`) is for loads and jumps, not fast forward |

The port's fast forward returned from every message wait at once and yielded only every 2,000 commands, so it ran
hundreds of messages a frame (about 121 a second in a throttled background tab, far more in a visible one). A skipped
message now waits for the next frame (`vm.js` `waitAdvance`, `nextFrame`): 60 a second at 60 fps. Test jumps
(`?pc=`, `skipUntil`), restores and the smoke test (`skipPaced = false`) still go through at once. Left: other waits
(WTTM, voice waits) still pass at once while skipping, as the port had them; the engine's handling of those wait bits
while skipping was not traced one by one.

Since 2026-11-09 (TODO item 110) fast forward runs at the game's speed: `vm.js` `tick` steps the story's clock 33 frames a
frame, a WTTM counts 64, FADS and STCF wait, a message takes three frames and an MSAD two. See audit/FIXES.md, "TODO item 110".

### Questions before a movie is passed

The port's own, at the user's request (`uifx.js` `movieQuestion`): the game has no question here, and its six rule movies (4, 5, 6, 35, 36, 37)
cannot be passed at all before they have been seen. "Skip intro video?" on the prologue's first showing, "Skip opening animation?" on the opening songs
from their second showing, "Skip Outro?" on the end credits every time. A Yes fades the picture to its cover as a pass does.

### Mode panel and indicators

| Native location | Observation |
|---|---|
| `0x4e170`, `0x4de10` | The panel comes down and goes up at 0.05 a frame (20 frames) from 43.14 units (104 px) above, without fading; buttons at x 25.33 + 73.67 i. Cursor 0, a button 1, cancel 2; calling it down plays 3 (`0x40ed0`) |
| `0x3b5f0` | `mode_disp`'s five 88 x 88 icons, by a state set from the game loop (`0x40ed0` via `0x3b5b0`): 1 rewind to a choice and 2 one message back at x 546.67; 3 forward, 4 skip to the next choice, and 5 plain skipping (at 0.6) at 626.67, centred at y 38.16; fading at 0.05 a frame (0.25 while a rewind runs). The level rises only while the skip runs, a rewind happens or auto mode is on, and falls otherwise, so state 5's 0.6 is seen as the >> fades out at text not read, and one tap of rewind shows << for one frame at a quarter (native frames, 2026-11-09). The scale and turn set before it are overwritten before the draw (dead code) |
| `0x4a410`, `0x4a7a0` | The Back button (`back_btn`, cells (8, 16) and (8, 168), 280 x 128) at the bottom right (1640, 952) while `0x590e88` is 1 (its default), sliding in from the right edge as t rises 0.04 a frame |

Since 2026-11-09 the port has a quick bar in place of the panel, on its backdrop and with its 20-frame motion (`ui.js` `buildPanel`). Its art is made at start-up, so its first opening looks like the others (2026-11-10).

The port's skip indicator was `mode_skip_1` at the top right; it is now the native icon. The panel eases "type 2,
out" (quadratic out) and the Back button "type 3, in-out" (cubic), by the type numbering above. The rewind states are shown since 2026-11-08 (`#mode-back`: << lit for the frame of a rewind, its level moving 0.25 a frame; |<< in Return to Previous Scene's countdown, N2-9); state 3 is the forward icon, solid while skipping runs; stopped at unread text it fades out at 0.6 of its level (N2-8). Left: the auto indicator (the native draws no icon for state 0, and no draw call names
`mode_ring_*` or `mode_skip_1`; the port keeps its spinning `mode_ring_1`); the arrow streak `mode_skip_0` (slot
0x4a in `0x3b5f0`, placed from values not traced).

### Save and load, help bar

| Native location | Observation |
|---|---|
| `0x4f240` | Four slots a page at (133.67, 36.92 + 93.75 i): `save_win`'s cell (32, 32)-(992, 304), the chosen one's (31, 336)-(991, 608), from the slot's corner; the chosen cell again, added, at a flash falling 0.2 a frame; the thumbnail at (151, +23.23), 82.7 x 57.9 units; the chapter title from `savetitle` at (253.33, +50.19), the cell from the table at `0x592484` by the save's chapter number; `saveauto` at (381.67, +10.79) on auto-save slots (above 99); `save_scene_plus` (the date's separators and "SCENE") over each used slot; the information panel at (453.33, 39.41), its picture by chapter (`0x3506b0`) |
| `0x4a8f0` | The help bar: a band in (1, 60, 101) at half alpha from y 424.36 to 449; entries from x 55/3, controller glyphs (`help_key`, cells at `0x590c1c`) and label art (`help_txt_ja`, through `0x9a710`) bottom-aligned at 445 and 444, laid out from per-screen tables at `0x34fd48`. Called by save/load, config, the gallery and two other screens |

Saves: 100 manual records (`0x50790` lists slots 0-99, newest first) and automatic slots 100-138: `0x52aa0` moves
them down one and writes the latest checkpoint to slot 100 when the player returns to the title from the system menu
(`0x4cea0` case 4, `0x4cca0`, `0x4cdb0`), unless it equals slot 100 (`0x52a20`) or the scene is a gallery replay
(`0x47b10`); the checkpoint (`0xf17ff0`, valid flag `0xf17ff2`) is set by each message and by ATSV (`0x527f0`). Slot
139 is the quick save (`0x52860`), and Continue loads the slot written last (`0x8d2f0`, system data `+0x161e`). The
port keeps 100 slots and 39 automatic saves (also written when the page is closed during a story), listed first when
loading, with `saveauto`; Continue considers both.

The help bar (`0x4a8f0`): each screen's items are (kind, id) pairs at `0x34fd48`: kind 0 a `help_key` cell
(`0x590c1c`), kind 1 a `help_txt_ja` label whose rectangle comes from a data file at run time (the port measures the
27 labels, in reading order, from the picture). Screens used by the port: 0 save and load, 2 config, 3 backlog.
Left: the date and time digits and `save_scene_plus` (vertex lists built at run time, `0xae07c8`).

### Not covered by this pass

### Config

The config's widgets are static tables at `0x46cdb0` (0x9d0 a page; ids, types and maxima), applied to the settings
by `0x2a730`:

| Page | Widgets -> setting |
|---|---|
| System | 0x3a unread text speed (+0xe, 0-250 ms a letter) and 0x39 "Display whole text" (+0x5a); 0x3e read text speed (+0x10) and 0x3d (+0x5b); 0x41 auto page switching (+0x5c, 0-10000 ms); 0x44 auto click wait (+0x1c); 0x45 read scenes auto skip (+0x5e) with 0x47 "Display confirmation" (+0x60); 0x49 fast forward Full / Read (+0x1e); 0x4b text display Fade in / Insta (+0x61); 0x4d read text display (+0x62) |
| Sound | BGM (+4), SE (+8), menu (+10) volumes, each with Mute (+0x64..0x66; `0x2dd20` plays at (1 - mute) x volume); SE has Test; Play all voices (+6 = 100 or 0); Voices stop on input (+0x2e); 19 character rows: volume (+0x34 + 2i), Mute (bit i of +0x24), Test (the last line heard, kept by `0x29300`) |

A read line uses the read speed and style (`0x3b2b0` / `0x3b2d0`, `0x3b330`: letters fade over min(0.5 s, speed x
0.1 / 35 s)). The samples type at those speeds and start again after the click wait (`0x2d570`). RDAS with read
scenes auto skip on and a completed scene asks "Jump to Next Scene?" (dialog 10) when Display confirmation is on and
skips (`0x79b78`, `0x92580`, `0x424b0`, `0x40ed0` state 1). Fast forward "Read" stops holding fast forward at unread
text (`0x40ed0`). A character row appears once its voice has played (`0x29fa0`: bit 4 of global `0x34d4b4[i]`, set
by `0x29300` from a voice's first three letters, `0x2360` / `0x44d970`, and the speaker's bit, `0xae04d8`); Shiki's
face and name wait for scenes 485 and 1, and the rows in mask `0x3cf36` show "????" until a script sets bit 2. There
is no master volume.

### Notices and help captions

The system's notices (`0x4abe0` / `0x49750` / `0x48540`, `ui.notify`): "Saving", "Loading", "Flowchart is not yet available" and the like: the window only (no `dialog_BG`), growing into place ((1 - 0.2 (1 - t))^2) as t rises 0.07 a frame, the text at t = 1 at y 214 of 448; keys come back as it starts to close, and a press on it closes it after a long tap (7-199 frames).

`popup_ja` (`0x3b430` / `0x3b4b0`): kind 1 Quick Save, 2 Auto Save, 3 Auto, and Skip, popping in at (0, 32) of 640 x 448
along the spring at `0x572bbc` as t rises 0.04 a frame (0.1 only at a slower frame step, 0x3c970 at 0x3eb34-0x3ebc0), held until t passes 3, then shrinking back. `mode_help`
(`0xae590`): the generic button caption, the bar as wide as the label plus 40 units at 0.7 alpha beside the button.
The gallery's column, header and sections come in over half a second, eased in (see "The gallery's column").

### CG viewer

`0xbe84` shows a variant's rectangle (x, y, w, h in pixels of the gallery's 1.5x copy, `0x250a0`), fitted to the
screen; a picture larger than the screen zooms from the fit up to 1 (`+0x40` / `+0x44`), a smaller one stays at the
fit. `0xc56c`: left / right go round the variants, the right stick zooms 0.008 a frame, A toggles fill and fit, the
left stick or touch moves it, another button resets; `0xd270` keeps a picture that overlaps an edge from leaving a
gap. A variant's flag calls the sprite's `0x1f688`, which sets a per-depth state bit at `+0x404`; its use when drawing
was not found.

### Not covered by this pass

The flowchart and the gallery's grids were compared only for sounds, the help band, the buttons and the Back button.
Interface pictures still unused: `scroll_bar`/`scroll_slider` (`0x9b0c4`), `qload_frame_ja`, `back_win`,
`titlecursor`, `flow_line_2`, `savescenelabel`, `effect_bg`, `config_number_ja`, `bf_no_edge68x68_2`, `ALART_PARTS`
and `MOUSE_PARTS_JA`: no constant draw call names `qload_frame_ja` (0x42), `back_win` (0x40), `titlecursor` (0x13b) or
`flow_line_2` (0x202). (`extra_menu_ja` is drawn as button cells, see "Buttons".)

## Verification

`node --test web-dev/tests/transform.test.mjs` tests parents, pivots, size
classes, panel clips, links and borders.
`node --test web-dev/tests/uifx.test.mjs` tests the title stage, background and music choice, logo dust, menu
sparkles, menu bands and cursor timing.
`node --test web-dev/tests/screens.test.mjs` tests the interface units, the choice states and effects, both dialogs,
button states (flash and pressed), the easing types, the title's rows, logo and GALLERY timing, the system menu
background's level, the gallery's half-second tweens, click mark cells and the panel and
indicator places.
`node --test web-dev/tests/endings.test.mjs` tests the Ending List rules, the one-time inference, `IFUR`, `RTM_`,
`SELS` and clickable `WTTM`.
`node --test web-dev/tests/parity.test.mjs` tests the fixes from the parity audit (`web-dev/audit/FIXES.md`): waiting for a
loading voice, loop regions and start offsets, sound effect delays, the menu volume group, voice characters, the
window commands, ATSV / SELA / IFSC / XSTP / RTM2 / PGST (and WTSV doing nothing, being no command), message marks, glyph runs, the italic and special-letter
ranges, FADS's held frame, fast forward's frame pacing and the title stage.
`node --test web-dev/tests/text-window.test.mjs` tests the text window (FIX-CHECKLIST T1-T12): the picture and page
compositing, the window rate, the typing front and its gate, letter fades, `@t`, `@x`, earlier lines' dimming with
`@k` and the click snap, MSAD after a closed window, F1104, F1110's note and SHAF.
`node --test web-dev/tests/reverify.test.mjs` tests what the re-check of handled functions changed (FIX-CHECKLIST S33-S36):
the game's per-block read marks and the instant run's stops, restores' sound and tweens, decimals and STCH alpha, and
pictures seen at the commit.
`node --test web-dev/tests/animation.test.mjs` tests interpolation, sentinels,
loop points, clock pauses, snapshots, skip, waits and effect lifecycles using
synthetic fixtures. `/smoketest.html` executes all scripts with pictures and
audio stubbed; it checks execution, not visual fidelity or all choice branches.
Browser scene probes additionally compare WebGL frames at different game times.
