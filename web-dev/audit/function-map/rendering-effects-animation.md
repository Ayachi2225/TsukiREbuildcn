D_render_effects_anim - findings
(content of the brief's findings.md; .md files cannot be written from a subagent here)

SUMMARY
406 functions: explicit 75, covered 22, divergent 12, missing 1, unused 17, platform 46, helper 233
(per-function status, web location and notes in ledger.json).

Key structural fact: transform.js was derived from 0x884f0 / 0x89ad0, the save-thumbnail and dialog-picture renderer
(callers 0x506e0, 0x50fc0, 0x4ae90, 0x4f240; strings thumstand_top.mzp, thumbg_top.mzp). The live story draw is
draw task 10: 0x3bba0 -> 0x37f50 -> 0x36520 (-> 0x32e30, 0x34a70, 0x362a0, 0x35fc0, 0xa7190/0xa6e90), with
positions from 0x34440. Most divergences below are where the live path differs from that model.

DIVERGENCES / MISSING BEHAVIOUR

1. STRA is a heat-haze distortion; the web draws nothing (missing). 0x36520 calls 0x362a0(id, rec), which reads
   rec+0x22c..+0x234 = the STRA fields R+0x238..+0x240 (rec = R+0xc; STRA 0x645f0 writes n, phase, ramp, stop).
   0x91520(n) returns entry n of a 557 x 10-float table at 0x352bd4; 0x362a0 turns it into shader constants
   (0xb0810 -> 0x1934ff0): c3[3] = (texW, ampX = renderW/1024 * ramp * p6 * p2, freqX = (p0 + p7/10) * texH/renderH / 2,
   frac(p8/3 * (t + p1))), c3[4] the same for y (p3..p5, mostly 0). The layer is then drawn with blend 0x26, which
   0xa2790 (table 0x3c9698) maps to shader position 15, nexl_nxshader_haze: uv.x += sin(2pi(frac(phase) +
   frac(v * freq))) * ampX / texW (SPIR-V 33906951eb996a33 / 4bbde4e2ca02d2dc). It happens in the plain and the panel
   path. ANIMATIONS.md says no drawing code reads these fields; this reader uses rec-relative offsets and was missed.
   Web: vm.js op_STRA stores `spin`, nothing draws it. Scripts: 569 STRA calls in 84 scripts, 528 with an effect,
   nearly each a different entry (12_00_ARC12_2 ops 1102-2505 ...); amplitude p6 ranges 1-100 (up to ~180 px).
   Confidence: reader and table confirmed; shader file identified by its constants (likely). Fix: export the table,
   add the sine displacement (with the ramp of 0x362a0) to the layer shader.

2. STZ4's 8th argument stretches along screen axes after rotation (resolves the open item in NATIVE-PARITY.md).
   0x31f30 stores the flag at record +0xa2. 0x37f50 then leaves the zoom out of the sprite scale, calls
   0xb3780(.., zoomx/1000, zoomy/1000) (0xac0d88) and ORs draw flag 0x40; the sprite submit passes the pair to the
   draw object (0xbbae0 -> +0x568) and 0xbbb28 multiplies the x/y rows of the finished matrix, translation untouched
   (listing 0xbc328-0xbc394): a screen-axis stretch about the anchor applied after the layer's rotation. Without the
   flag the zoom is a local scale before rotation. Web: always before rotation (renderer.js drawLayer). Scripts:
   55 calls, all non-uniform (1441 x 743, 280 x 110, -1677 ...), on swirl pictures img2138 / img2139 / img0728 /
   img0729 / img2070 that STRT or a motion track turns (05_00_ARC05_1C op 1145, 14_01B_02_CIEL14B_3B ops 4054-5841,
   13_01_02_CIEL13_5_2 op 705, 14_01B_03_CIEL14B_4_1D ...). In the game the oval outline stays level while the swirl
   spins inside (a disc seen at an angle); the web turns the whole oval. Confidence: likely (matrix order read in the
   listing). Fix: for flagged layers apply diag(zx, zy) to the corner offsets after rotating them.

3. A layer linked to an absent owner is not drawn. 0x37f50 (listing 0x37ff8-0x38030): link >= 0 and the owner's record
   absent (+0xc == 0) or flagged (+0x20 != 0) -> alpha factor 0 -> skipped. Web place() treats a missing link as none
   and draws the layer unclipped at full alpha. About 20 cases in 13 scripts (static simulation at message waits):
   13_01_01_CIEL13_5B layer 3 z20_a_53_03_n00 (owner 32 removed, 24 waits), QA_16 layer 36 (22), 05_01_CIEL05_3B
   layer 14 sie_a_12_02_n00 (10), QA_20 layer 21, 09_01_CIEL09_2_1 layers 30/31 ... Confidence: confirmed.
   Fix: skip a layer whose link names a layer not on screen.

4. Layers with z <= 0 are not drawn. 0x3bba0 (listing 0x3c198-0x3c1a0) draws a layer only if its z (record +0x5bec,
   from state +0x234: STCH arg 6 or STCP) is >= 1; STCH with a blank z uses id*10 (0x60840). Web draws every layer
   (z 0 at the bottom) and uses 0 for a blank z. Scripts: 34,814 STCP calls with z <= 0 (the scripts' way to hide a
   layer), 45 STCH with z <= 0, 9 STCH with blank z. A static check found 501 message waits where such a layer would
   be visible to the web; all but one sit under an opaque full-screen picture (14_01B_03_CIEL14B_5 op 491: an overlay
   layer over black), so the effect is mostly hidden, but it still matters for transitions and backdrop-reading
   blends. Confidence: confirmed. Fix: filter z <= 0 in renderer.drawLayers (keep them as parents/links), blank STCH z
   = id*10.

5. Panel edges (live mask 0x32e30 and band 0x34a70).
   a. Side rule (listing 0x33104-0x33154): a side gets the feather unless the clip edge lies at least the border width
      beyond the screen edge (left x > -b, right x + w < 1920 + b, top/bottom likewise), except a full-width or
      full-height clip. Web clipGeometry: only sides strictly inside the screen (x > 0, x + w < 1920). 147 of 2,032
      panel setups with a border differ (edges at 0/1920/1080 or up to b beyond: 11_00_ARC11_2 op 4710,
      13_01_01_CIEL13_5B op 2492, 04_00_ARC04_6_2C op 465): the game softens those edges, the web cuts them hard.
   b. Frame style 7: 0x32e30 doubles the feather width and 0x34a70 draws no band (returns when style - 1 > 5). Web:
      normal width and a black band. 37 STCH/SCH2 pass style 7. Styles 1-6 colours match exactly.
   c. Border clamped to half the clip size; blob texture chosen by edge width (6 sizes, tables 0x34d7d4/0x34d81c);
      web: one blob. Minor.
   d. Settled 2026-11-06 (checklist V12): for a layer with a link, 0x32e30 draws the owner's picture (slot 0x189+link
      at the owner's transform, opaque, scissored to the clip) into the mask target instead of filling the rectangle,
      so the layer shows only where the owner's picture is; 0x36520 takes that path when the clip is not empty. A
      panel drawn as one run (0xa2ba0 mode 1 then 2) goes through a group target instead: the owner first (0xa4bc0:
      blend state 7, extra texture 2), the linked layers over it, then 0xa2c30's two passes (blend 13 / texture 16
      into a scratch target, then the owner's blend and opacity onto the screen). QA_17 in the original game shows the
      clipping (a capture: the darkening overlay ends at Neco-Arc's outline).
   e. Unsure: with SACL, 0x37f50 skips copying the link's clip as well as the move (listing 0x38428-0x3842c), so the
      layer's own (usually empty) clip is used; web still clips SACL layers by the owner's rectangle (190 SACL calls
      on layers whose owner has a partial clip). Whether the group composite confines them anyway is unresolved.

6. SCH2 resets the blend mode. 0x60840 ends (listing 0x62088-0x620b8) by setting state +0x7c (STBR) to F982 if
   F982 >= 1 and the picture is not a solid colour, else 255 (normal), for STCH and SCH2 alike; no script sets F982.
   Web SCH2 copies the source layer's blend. 3 calls change a blended layer's picture without a new STBR (QA_21 ops
   1275-1281: layers 28/32/33, blend 2 and screen 23). Confidence: confirmed.

7. STMA's 3rd and 4th arguments are ignored by the web (0x99620). Arg 3 closes the text window like FADS arg 4
   (sets +0x89e: 1 always; 2 when no CLO4/CLO5 fade runs, config +0x63 being always 1; blank/-1 never): 117 calls pass
   2, 103 of them in chapter 09 (09_00_ARC09_3_1 op 1459, 09_01_CIEL09_6B ops 597-605): the game hides the text for
   the motion, the web keeps it. Arg 4 is a frame step (0x958e8, 0x95938 rounds elapsed frames down to a multiple):
   3 = the motion advances every 3 frames, 2 = every 2: 16 calls (14_01B_02_CIEL14B_3B ops 1086-1341,
   14_01B_03_CIEL14B_5B ops 4073, 8865 ...). Confidence: confirmed. Fix: op_STMA(id, track, close, step) using
   fadeClosesWindow, and quantise Motion.time.

8. RGB split (FADE 40), 0x2f910 / 0x2e3e0 / 0x2e280. (a) The pulse/sweep counter steps every 6 frames (listing
   0x2faa4-0x2fab4), web every 5 (screenfx.js splitSample Math.floor(f / 5)): 20% faster. (b) A non-zero level
   starts the split at alpha 1 (listing 0x2e408-0x2e41c); web always fades in over 60 frames (6 calls). (c) FADE 40
   while the split is on keeps alpha, pulse and sweep (0x2e280 resets them only when it was off); web restarts from
   alpha 0 (8 calls: 02_00_ARC02_1 ops 497-606, 05_00_ARC05_9_2B op 3105, 13_00_ARC13_3 op 419, 13_00_ARC13_5 op
   3514, 13_01_01_CIEL13_4_1 op 491), so the effect blinks off and fades back on the web. Confidence: confirmed.

9. Menu background blur (0xa0a90, owner of the menu screens to decide). The system menu freezes the story frame
   (0x2e000), blurs it with a separable Gaussian (s = 2.25 taps 1.75 px apart: sigma about 3.9 px at 1080p) and
   cross-fades it in over 12 frames, no darkening (0x3bba0 modes 2/1/0, 0xa2680). Web: CSS blur(7px) brightness(.82)
   saturate(.9) on the canvas (style.css .menu-blur). 0xa0a90 is also the glow blur of the choice labels (0x83e50,
   s = 2).

10. Minor: per-layer quake draws an independent random offset per layer (0x3c970), so SQK2 -1 with sync 0 (471 calls)
    jitters layers against each other, while the web seeds layers started together identically (rigid); with sync 1
    (146 calls) layers >= 2 copy layer 1's (or 0's) offset. Sway redraws its period each cycle and picks a random
    sign once; the web keeps one random period and no sign. SHOK periods are fractional frames natively (ms*3/50).
    STCL also stops the layer's motion track and uses linear x for ease 16 (9 calls, none with 16).

CHECKED AND MATCHING
SHOK amplitude, phase, level and 2x view scaling (0x2ee70, 0x2ef30, 0x34440, 0x32050; the native exempts the solid
colour pictures BLACK..YELLOW, image flag +0x41, which no script shows during a SHOK);
quake/shake/sway parameters and models (0x63520, 0x91540, 0x91900, 0x91cf0, 0x3c970); film grain (0x35fc0); RGB
split channel offsets and gain (0x2fc50) - wrong, corrected 2026-11-07 (checklist V15): the split goes over the
screen with overlay, the port moved each channel the wrong way (the game: red +d, green -d, blue -2d on screen) and
the gain applies twice; speed lines are drawn above the layers and below the text (0x87a90 from
0x391a0); STPV sets both pivot and -pivot, so the pivot is drawn at the position as transform.js assumes; SBAS world
placement and zoom chains (0x38730, 0x388d0, 0x38a70, 0x38bc0); link alpha multiply and STEC colour (0x32c70);
easing helpers (bounce/elastic in-out and out-in, motion copies); STEC preset constants (0x9f6c0, amount 1.0);
blur: STCH/SCH2 args 9-10 pick `_XX_YY` variants (padding 8*ceil((L+2)/8) px a side), which equal a box blur of
radius XX/YY (web-research/tools/blurtest2.py: median 52 dB), as the web's runtime box blur does.

UNUSED NATIVE CODE
- FADE kinds other than 40/41 (0x2f870-0x2f8b0 are empty stubs; 0x5f420 other cases); SHAK 0x60080; STRC 0x630e0.
- FLNT/FLOP/FLSP/FCCL 0x91fa0, 0x92010, 0x920b0, 0x92270; falling notes 0x86120 / 0x86ff0 (FCLN types 1-3).
- FADS type 0x44 falling pieces 0x4b5e0; canned screen-shake modes 6-11 and SHAK modes in 0x2ef30.
- Overlays drawn through the empty primitive 0xaaf50 (0x301e0, 0x302c0); empty stub 0xa8fb0.
- 0x36520 branch for STBR 99 (no script); 0x34440 snap of a 1920x1080 picture at engine (120, 90) (no call hits it).

LIMITS
Static analysis only (decompile plus listing; nothing run). Not read: the haze shader's exact use of the second
(cos) term, the blend states of the mask/group targets, how the panel-group composite combines owner pictures and
SACL layers (5d, 5e), and the alpha of frame bands drawn by 0x37ea0 for layers at alpha 0. Script counts come from
static simulations at message waits (tweens and motions not evaluated). 0x9fa30/0x9fa60/0xb35c0 (a global sepia-like
filter chosen by record header +8) has no script-driven setter found.

## Re-check of the handled functions (2026-11-08)

92 functions of this part compared with the port: 54 the same, 37 different, 1 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-5: A 1920 x 1080 clip anywhere counts as no clip (medium, confirmed)

Functions: `0x32050`, `0x36520`.
- Native: 0x32050 adds the owner's quake and shake and 2 x SHOK to a clip whenever any of x, y, w, h is non-zero (listing 0x32178-0x3220c); 0x36520 then scissors at that moved rectangle (C lines 417-470, 0xb2e60) and skips the scissor only when it still covers the whole screen.
- Port: transform.js:56-58 activeClip returns null for c[2] === 1920 && c[3] === 1080 at any x, y, so renderer.js:655-665 clipAt has no clip to move or cut; the layer only gets its own offset.
- Effect: During SHOK (or a quake on the owner) a full-size panel is not cut at the moved edge; with an offset 1920 x 1080 clip the whole picture shows instead of the clipped part.
- Reached: 2432 STCH clips: 219 at (0,0,1920,1080), 5 offset (10_00_ARC10_3_2, 10_01_CIEL10_5); N2-4 counts 16 SHOK calls with a full-size clip live.
- Second reading: confirmed.
- Fix (2026-11-08): transform.js activeClip treats any clip with a width and height as a clip, full-size or offset; a whole-screen clip just has no edge width while it does not move (the moved rect comes from clipAt).
- Compared: Native frame of an offset 1920 x 1080 clip (300, 150): mean 30.8 levels against the port before, 2.6 after (plain background baseline about 2-5).
### N2-6: Band opacity of a panel group (medium, confirmed)

Functions: `0x37ea0`.
- Native: The band is drawn at colour alpha 1 (0x37f1c-0x37f2c; 0x34a70 at 0x34eb0 takes s13 = 1.0 when the target is not 0) into the group colour buffer (target -3: 0x9fe00 jump table 0x3c9426 selects surface 0xae0cc8/0xae0cd8). 0xa2c30 composites that buffer with colour *0xae0d40 | 0xffffff (0xa30c8), and *0xae0d40 is the alpha byte of the first layer drawn into the group (0xa6570 at 0xa6920-0xa6934, only while flag *0xae0d20 is set). So the band shows at the first-drawn layer's opacity.
- Port: renderer.js:690 drawFrame(at.clip, at.alpha) uses the last visible layer's alpha times its owner's (transform.js:142).
- Effect: A band whose top linked layer is translucent is too faint in the port: 04_00_ARC04_9 raw op 1981 (compiled 1973; owner 31 at 255, top layer 32 at 200, style 1 width 30) shows the black band at 78% where the game shows it at 100%.
- Reached: Static survey of scripts: 220 STCH with a style 1-6 band and width 2 or more, 537 layers linked to such a panel, 71 owner / top-layer pairs where the top layer has alpha between 1 and 254 (tweens not evaluated).
- Second reading: Mechanism holds: 0x37f1c-0x37f2c colour 1, 0x34eb4 takes s13 = 1.0 for target -3, jump table 0x3c9426 index 1 goes to 0xa0554 (0xae0cc8 / 0xae0cd8), 0xa68f8-0xa6934 captures *0xae0d40 only while *0xae0d20 is set and 0xa6cbc clears it after the first draw, 0xa30c8 composites with it; later layers are drawn relative to it (0xa6e24-0xa6e4c). The group is the run of z-adjacent layers sharing a link (0x3bd78-0x3bdd8). renderer.js:690 uses at.alpha of the last layer. Only the locator is wrong: the cited STCH 31 / 32 are raw ops 1979-1981, compiled 1971-1973 of 04_00_ARC04_9, not op 1881.
- Fix (2026-11-08): Beyond the band's alpha: panel groups (transform.js panelRuns: a linked layer and its owner when neighbours in depth, the owner having a clip) are composited as a group. renderer.js draws a group whose first drawn layer is translucent into a buffer: the first layer at full, later ones at min(1, own alpha / first alpha, not multiplied by the link's), then the buffer over the scene at the first alpha when the owner has an edge width, its square when it has none (groupOpacity, groupRelative). The band goes into that buffer at alpha 1, so it follows the group: full when the first layer is opaque.
- Compared: Native frames: opacity grid of 12 owner / child combinations without a band and 8 with bands (fits of the native frame over the layers drawn alone: bg, owner, child weights), every combination within 2.6-3.1 mean levels of the port now against 16-41 before; band at 100% on a translucent top layer as the listing said.
### N2-7: Size class of pictures whose name prefix has a digit (medium, confirmed)

Functions: `0x38730`, `0x388d0`, `0x38a70`, `0x38bc0`.
- Native: Class comes from the image table: record +0x14 indexes *0xae0540, field +0x46 gives 1, 2, 3 for 0.5, 0.25, 0.125 (0x38828-0x3887c).
- Port: transform.js:26-28 sizeClass matches /^[a-z]+_([lms])_/i, which fails on Y00_L_..., Z20_M_..., Z01_S_...: 514 table entries with class 1-3 count as 1.
- Effect: An SBAS child of such a parent uses k = 1 instead of the parent's 0.5 or 0.25: its coordinates, measured from the parent picture's origin, are 2 or 4 times too large (the port computes x - pivot where the game computes x * k - pivot, so the child lands well away from its place, possibly on the other side of the pivot), and it is drawn 2 or 4 times too large. Examples: 04_00_ARC04_6_1 raw op 1522 (child of Z20_L_10_00_N00), 08_01_CIEL08_1D raw op 1300 (child of Y00_M_00_00_N00). 10 calls have an L parent (2x), 3 an M parent (4x); no S parent occurs.
- Reached: 13 SBAS calls in 3 scripts have such a parent: QA_21 (8), 08_01_CIEL08_1D (3), 04_00_ARC04_6_1 (2). 121 script pictures have the wrong class.
- Second reading: Table field +0x46 (0x38838-0x3887c, 0x38b6c) and the regex gap hold: 514 table entries, 121 script pictures, 13 SBAS calls, all re-surveyed. But the formula is world x = parent + zoom x (x * k - pivot x 0.375), so the error is in the unscaled x * k term, not a factor on the distance from the pivot (04_00_ARC04_6_1 raw op 1522: y offset -157 engine units in the game, +169 in the port). And the 13 parents are 10 class L (0.5) and 3 class M (0.25): factor 8 is not reached.
- Fix (2026-11-08): transform.js sizeClass takes the letter with digits in the prefix (Z20_L_, Y00_M_, as the picture table's +0x46 agrees for all but IMG5028, handled by name). vm.js init also makes the pivot fraction of the 693 pictures whose table size is not the stored size (Z20_L_10_00_N00 1143 x 3138 against 1113 x 3080) reach the table's absolute pivot point: 0x89ad0 lays the picture from that point at its stored size.
- Compared: Native frame of the 04_00_ARC04_6_1 parent (Z20_L_10_00_N00) with its SBAS child: mean 19 levels against 3.2 after the fix.
### N2-8: Opacity of the >> while skipping runs (medium, confirmed)

Functions: `0x3b5f0`.
- Native: While 0xae0670 is set, 0x40ed0 at 0x41fd0-0x41fd8 sets state 3, drawn at full fade (0x3b7dc-0x3b7f4); 0.6 applies only to state 5 (0x3b7fc-0x3b824), the frames where the toggle is on but the skip is held at unread text (0x41944-0x41950).
- Port: style.css:203 #mode-skip.on { opacity: .6 } whenever the toggle is on; main.js:348.
- Effect: The skip icon is at 60% in the port during normal skipping where the game shows it solid.
- Reached: Every read-text skip (R, F, mode panel).
- Second reading: confirmed.
- Fix (2026-11-08): style.css: #mode-skip.on is solid; 0.6 only with .paused, which main.js frame sets while vm.skipPaused (stopped at unread text, toggle or ZR).
- Compared: Listing and tests; no native frame of the indicator was compared. Compared with the game 2026-11-09: Native frames, a test scene with read text: the >> is at full while the skip toggle runs (brightest pixel 223, as the port's; mean difference 2.6 levels in its box). Corrected 2026-11-09: the stopped state does not stay at 0.6. 0x3b5f0 draws state 5 at 0.6 of the indicator's level, and the level only rises while the skip runs (0x40ed0 at 0x4194c puts the speed back to 1 at text the read-only setting holds), so the >> dims and is gone in 20 frames; a native capture of the skip button pressed on such a line shows no indicator. style.css: #mode-skip.on.paused fades out at 0.6 of its level.
### N2-9: Rewind icons missing (medium, confirmed)

Functions: `0x3b5f0`.
- Native: State 2 (<< at x 546.67) while 0xae05b8 is set (0x41fc8) and state 1 (|<<) in the 0xae06c8 countdown (0x413f0), with the fade 5 times faster while rewinding (0x3b70c-0x3b714).
- Port: uifx.js:711 MODE_ICONS lists them but nothing imports it; only #mode-skip exists, at 1880 px, and rewinding shows nothing.
- Effect: No << or |<< at the top right while the player rewinds or returns to the previous scene.
- Reached: Any rewind (ZL, R key, mode panel).
- Second reading: confirmed.
- Fix (2026-11-08): index.html #mode-back (states 1 |<< and 2 << at x 546.67 of 640, 88 px cells, fading 0.25 a frame); main.js backIcon: << during a rewind (the port's rewind is instant: 0.3 s), |<< during Return to Previous Scene's countdown.
- Compared: Listing and tests; no native frame. Compared with the game 2026-11-09: Native frames. Corrected 2026-11-09: the port lit << for 0.3 s at each rewind. In the game the level moves 0.25 a frame, up on a frame that rewinds and down on the others (0x3b5f0: 0.05 x 5 while 0xae05b8 is set): one tap of ZL shows << for a single frame at a quarter (57 of 223, at x 1633-1668), and ZL held, which rewinds a page a frame, takes it to full in four frames and out in four. main.js backIcon / backIconFrame set the level each frame; one frame at 0.25 per tap in the port too. The |<< of Return to Previous Scene's countdown was not captured.
### N2-10: Notice popup speed (medium, confirmed)

Functions: `0x3c970`.
- Native: 0x3eb34-0x3ebc0: the popup's t moves 0.04 a frame at the normal frame step (0.1 only when more than one frame passed, 0xad180), so 25 frames in, shown until t passes 3 at frame 75, 25 frames out.
- Port: main.js:66 moves t by 0.1 a frame: 10 frames in, 30 to t 3, 10 out (ANIMATIONS.md line 723 records 0.1).
- Effect: The Auto, Skip, Auto Save and Quick Save notices come and go about 2.5 times too fast.
- Reached: Every toggle of Auto or Skip and every save notice.
- Second reading: confirmed.
- Fix (2026-11-08): main.js popup: t moves 0.04 a frame (25 frames in, until t passes 3, 25 out).
- Compared: Listing and tests; no native frame. Compared with the game 2026-11-09: Native frames of the Auto notice, every present: the band's width follows the spring table at t = 0.08, 0.12, 0.20, 0.24, 0.32, 0.36 ... coming in and at every 0.04 from 0.88 down to 0.04 going out (25.2 px at 0.04, 131.6 at 0.16, 319 at 0.28, 416 at 0.36, of 350 at rest), each within 1 px of main.js's POPUP_KEYS at that t; it rests at (0, 77)-(376, 133), the port's place.
### N2-11: Blurred name missing from the picture table leaves the layer empty (medium, confirmed)

Functions: `0x60840`.
- Native: 0x61e08-0x61e14 stores the 0x55d30 result for name + _XX_YY in state +4 with no fallback (the base-picture fallback at 0x721f0 is the look-ahead's only); a name not among the 14,713 entries gives -1, 0x32290 commits -1 and 0x3c970 at 0x3e588/0x3e5ec frees the layer's slots, so nothing is drawn.
- Port: vm.js:1207 and vm.js:1242 setImage(l, image) load the base picture whether or not the suffixed name exists, and renderer.js:840-841 box-blurs it.
- Effect: The port draws a blurred picture the game does not draw: layer 33 at alpha 255 in 05_01_CIEL05_2_2B, layer 32 at alpha 133 in 14_01A_CIEL14A_1, layer 25 in 14_01B_02_CIEL14B_3B; the other two start at alpha 0.
- Reached: 5 shipped commands: 05_01_CIEL05_2_2B STCH 33 (Z20_M_61_00_A00_10_00), 09_00_ARC09_3_2_1 STCH 29 (IMG5007_02_02), 14_01A_CIEL14A_1 STCH 32 (IMG1637_28_28), 14_01B_02_CIEL14B_3B SCH2 25 (SIK_A_32_00_N00_02_30, X digit from its source), QA_23 STCH 34 (IMG5007_00_27). Checked against the table at 0x5e02a4 (*0xae0888); static replay in script order.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js setPicture: a blurred picture name missing from the table (images.json has exactly the table's _XX_YY names) leaves the layer with no picture, as 0x60840 commits -1.
- Compared: Native frame of STCH(2,Z20_M_61_00_A00,...,10,0): nothing drawn (mean 2.1 levels against the plain background).
### N2-12: STBR's third argument is ignored (medium, confirmed)

Functions: `0x62490`.
- Native: 0x62490: with three or more arguments, a present third argument >= 0 replaces n (listing 0x62564-0x625a0); its low byte 0 stores 0xff, normal blend, in state +0x7c.
- Port: vm.js:1273 op_STBR(id, mode) sets l.blend from the second argument only.
- Effect: Layers get the second argument's blend instead of the third's: for example 13,8,0 draws without alpha instead of normally, 22,19,0 uses hardlight instead of a normal draw, and 18,1,28 uses ps_add instead of add.
- Reached: 37 calls have a non-blank third argument and 22 of them select a different draw: 8 go to add from ps_add (for example 18,1,28), 8 to a normal draw (13,8,0 in 01_00_ARC01_4; 22,19,0 in 13_00_ARC13_5), 6 to another shader (26,10,29 in 03_01_CIEL03_3_3B is shader 43 sub_noalpha, missing from the port's table).
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_STBR: a third argument present and not negative replaces the second; its low byte is the blend (0 = normal). renderer.js SHADER and composite gain 29 = sub_noalpha (max(0, b + op (s - 1)), SPIR-V b1e7d7ff023a0eea).
- Compared: Native frames of STBR(n,8,0) (normal, sprite alpha respected: mean 2.0) and STBR(n,1,28) (add at alpha 0.5: mean 6.2, the native about 8 levels brighter, as other blend-shader layers are; the shader arithmetic itself matches the SPIR-V).
### N2-13: A blurred layer's STPV pivot lacks the blurred picture's offset (medium, confirmed)

Functions: `0x639a0`.
- Native: 0x639a0: when the layer's picture is a blurred _XX_YY variant (table +0x43 bit 0, XX or YY not 0), the base picture is looked up and the pivot gets blurred.pivot - base.pivot added for each axis given (x listing 0x63fdc-0x64000, table +0x34 / +0x38).
- Port: transform.js:52 pivotOf returns l.pivot x k while place() measures it against the blurred entry's size (transform.js:121-122), so the picture centre moves by the blur margin; node check: IMG0342 blur 4,4 moves 12 px, blur 20,20 36 px, the amount the native correction cancels.
- Effect: A blurred layer given an STPV pivot sits down and right of its place by the blur margin: 12 px at 04_04, 24 px at 08_08, 36 px at 20_20, more for tall one-axis blurs (IMG0067_00_44: 72 px down).
- Reached: 159 of 733 STPV calls are on a blurred picture whose unblurred base is also in the table (for example 02_01_CIEL02_1_2 ops 258-1984, 05_00_ARC05_10 ops 2307-2321, 08_01_CIEL08_1 op 138). 18 more are on blurred pictures in the table whose base has no entry (for example SIE_A_12_01_N00_30_30): the native correction is skipped and they show no difference.
- Second reading: 0x63fdc-0x64000 (and the y twin) add table +0x34 / +0x38 of the blurred entry minus the base entry when +0x43 bit 0 is set and XX or YY is not 0. transform.js pivotOf has no such term; a node run of place() gives pivots -12 px at 04_04, -36 px at 20_20 and -12, -72 at IMG0067_00_44, and the table margins by blur (4, 8, 12 ... units) give the stated 12 / 24 / 36 px. All 177 blurred STPV targets are in the table: the 18 extra have no base entry, so the lookup at 0x63f.. returns -1, the native adds nothing and they match the port.
- Fix (2026-11-08): transform.js pivotOf adds the blurred entry's table pivot less the base entry's to a layer's STPV pivot (the blur margin).
- Compared: Native frame of 02_01_CIEL02_1_2's STCH 19 (img0342, blur 4,4) with its STPV and zoom: mean 1.6 levels.
### N2-14: Speed lines stay on after Return to Title / a new story (medium, confirmed)

Functions: `0x86470`.
- Native: 0x5f200 (end of script at 0x77790 0x7f5d4/0x7f9f8, and Return to Title through 0x4d7e0 at 0x4d8a0) ends with 0x86470(0, 0) at 0x5f388: level +0x5cb0 = 0, state +0x5cac = 0 (REVERIFY's 0x5f200 row lists speed lines and toTitle as matching).
- Port: web/app/js/main.js toTitle (538-564) and startAt (377-404), vm.js stop, start and clearAnimations (371-378) never assign gfx.lines; only op_FCLN, op_FCSP and restore do (vm.js:1479, 1482, 1750), and renderer.js:692/698 drawLines runs every frame inside drawLayers.
- Effect: After Return to Title during an FCLN..FCSP stretch, gfx.lines keeps its last FCLN and is drawn over the next story begun with New Game or a flowchart / gallery scene, until the next FCSP or FCLN or a load (a load replaces it). The game has the lines off at once.
- Reached: 23 of the 26 FCLN..FCSP spans contain a click-wait message (ZM or MSAD without @n/@e); the three without one are 06_01_CIEL06_3 (type 5, only an @n line), 08_00_ARC08_3_2 (type 6, WTTM only) and QA_07 at raw op 1051 (type 12, WTTM only). Survey of the 19 scripts with FCLN (raw/*.txt); the examples QA_11, QA_13, QA_24, 15_01B_CIEL15B_1 stand.
- Second reading: 0x5f200 ends with 0x86470(0,0) at 0x5f388 (state +0x5cac = 0, level 0) on script end (0x77790 at 0x7f5d4/0x7f9f8) and Return to Title (0x4d8c0 state 0x15 -> 0x4d7e0 -> 0x4d8a0); vm.js stop/start/clearAnimations and main.js toTitle/startAt never touch gfx.lines (only op_FCLN/op_FCSP/restore, vm.js:1479/1482/1750, and renderer.js:692 drawLines runs every frame). Only the survey count is wrong.
- Fix (2026-11-08): vm.js clearAnimations (story start, Return to Title) clears gfx.lines and gfx.split.
- Compared: Listing and tests; no native frame. Compared with the game 2026-11-09: Native run: a test scene with FCLN before its second line; Return to Title on that line, then New Game: the first line shows with no lines at all (mean level under the text 0.008, as before the FCLN ever ran) until the script's own FCLN. The port clears gfx.lines at the title on the same path.
### N2-15: Layer effects are fixed when the picture is loaded; the port re-applies STEC, SNX2/SNX3 and motion brightness/contrast at every draw (medium, confirmed)

Functions: `0xa3180`.
- Native: Shader 44 (pre_alter) is bound only in 0xa3180 (0xa3a7c, 0xa3e94, 0xa407c), and 0xa3180 runs only when a layer's picture is created: 0x3ecc0 -> 0xb6a20 -> 0xaaa40 -> 0xb02a0 -> 0xa3180 with the record's preset +0x244, colour +0x1cc, brightness +0x248, contrast +0x24c. 0x3ecc0 is called from 0x3c970 at the commit only when the picture number differs (0x3e4c0-0x3e5e0: A+0x14 != B+0x14; A+0x242 is cleared only then, set to 1 by 0x3ecc0; 0x3eb20 for +0x242 == 2 needs image byte +0x43 bit 1, set on no shipped image). STEC 0x3de0 only stores state +0x1404 (and the colour at A+0x1cc); SNX2 0x4030 / SNX3 0x4120 only write A+0x248 / +0x24c and state +0x1454 / +0x1458; 0x97b80 writes tracks' fields 24 and 25 there per frame (0x99268, 0x992bc) with no reload; its only reload, 0x98634, is the picture swap for blur keys. At draw 0x36520 draws the baked slot through the default shader (b3ce59875c3f39ec reads neither), the sprite state 0xac0d80 / 84 is unread by 0x9fe00, the draw-object setters 0xbbb04 / 0xbbb0c are called only by 0xa3180, and A+0x244 at draw only chooses whether to multiply the +0x1cc colour (skipped for preset 1). So once a picture is baked, its preset, brightness and contrast cannot change until another picture number is committed on that layer.
- Port: app/js/renderer.js:742-769 effectUniforms reads l.effect, l.bright, l.contrast, l.tint at every drawLayer (renderer.js:870), renderer.js:39-46 motionView puts a motion's bright, contrast, colour on the draw view (animation.js:374-375, 371), vm.js:1276-1285 op_STEC and vm.js:1372-1373 op_SNX2 / op_SNX3 write the on-screen layer through stateFor (vm.js:1119, 1126), and a re-STCH of the same picture (vm.js:1183) makes a new layer with its own effect; nothing keys the effect to the picture change.
- Effect: (a) An effect command on a picture already on screen takes effect at once in the port and not at all in the game: QA_01 STEC(13, 1, 0x000000) turns layer 13 (img2519) into a black silhouette for the 2.4 s of WTTM(2400) where the game keeps the picture. (b) STCH or SCH2 of the picture already on the layer with other values: 14_01A_CIEL14A_2 img0542 plain in the port where the game keeps its earlier SNX2 / SNX3 +32 bake; 07_01_CIEL07_2_2 img2229 without the SNX2 255 of its first STCH; 13_01_02_CIEL13_6_2 SCH2(38, noe_l_60_03_a03, source 37) takes the source's effect 0 in the port where the game keeps its preset 71 bake. (c) Tracks' brightness and contrast keys change a picture every frame in the port and not in the game after the first bake, as in the original claim's examples.
- Reached: Replay of the 549 raw scripts with IFP4 blocks skipped (the Switch build and vm.js:614 always jump over them): 12,906 STEC, 1,678 SNX2 and 845 SNX3 calls almost all follow their layer's STCH. STEC / SNX2 on a live unchanged picture with a different value: 1 site (QA_01 STEC 13 1 0x000000); 12_00_ARC12_2's SNX2(33,0) and SNX2(33,3) sit inside IFP4 blocks and never run. Same picture re-staged with a different effect: 3 sites, 07_01_CIEL07_2_2 (img2229), 14_01A_CIEL14A_2 (img0542) and 13_01_02_CIEL13_6_2 (noe_l_60_03_a03); 12_00_ARC12_2 has no re-staged picture. Tracks: bright flagged with values on 830, contrast on 501; 25 STMA keys vary, and about 30 STMA calls on live pictures differ from the bake.
- Second reading: The bake is confirmed in the listing: shader 0x2c only in 0xa3180 (0xa3a7c/0xa3e94/0xa407c), reached for layers from 0x3ecc0 and the blur-key reload 0x98634; +0x242 is cleared only at 0x3e55c when A+0x14 != B+0x14 and +0x242 == 2 needs image byte +0x43 bit 1, set on none of the 14,713 entries; 0xbbb04/0xbbb0c are called only by 0xa3180, 0xb08a0/0xb08b0's values reach the sprite block at +0x68/+0x6c which 0x9fe00 never reads, and the default shader b3ce59875c3f39ec has no brightness or contrast. (Minor: A+0x244 at draw also selects the preset-4 branch at 0x36ff4 for linked layers, not only the colour skip.) Port as described. Wrong: both '12_00_ARC12_2' site lists, and the (c) counts vary a little with what counts as a commit (replay here: 32 live differences in 15 scripts, 21 varying on live pictures and 4 new).
- Fix (2026-11-08): vm.js commit bakes the effect (preset, silhouette colour, brightness, contrast, a running track's values) onto the layer as l.baked only when the picture number changes; renderer.js effectUniforms draws the baked values, and the record's colour multiplies live while the record's preset (taken at the commit, l.recordPreset) is not 1. The evidence's reading of STEC on a live picture was wrong: its colour is written at once to the record (+0x1cc) and multiplies the picture immediately, so QA_01's STEC(13,1,0x000000) does turn the picture black.
- Compared: Native frames: STEC(2,1,0x000000) on a live opaque picture goes black at once (mean 0, port now the same); re-STCH of the same picture without its SNX2 keeps the +100 brightness (mean 3.8).
### N2-16: STTR wipe also multiplies the layer by its alpha (medium, confirmed)

Functions: `0xa6e90`.
- Native: 0x36520's unpanelled path (listing 0x37748-0x377bc) calls 0xb03e0(1, 1, 1, 1), draws the picture into the buffer (0xb6f60), then 0xa6e90 composites it with 0xbaac8(obj, -1) (opaque white). Coverage = picture alpha x (1 - smoothstep(t)), the layer alpha entering only as the threshold x. Nothing after it applies alpha (0x377c0 goes to 0xa2c20 and the common end).
- Port: renderer.js:255-268: FS_LAYER multiplies c by the rule mask, then mode 0 outputs c * alpha, so coverage = picture alpha x mask x layer alpha.
- Effect: During an STTR wipe on a layer with no panel, the part already revealed is see-through in proportion to the alpha instead of solid: halfway through the alpha tween it is half transparent. The two agree only at alpha 1.
- Reached: 65 STTR rule calls in 39 scripts, every one followed by an STGS alpha tween; 37 are on layers whose last STCH has no panel arguments, for example 03_01_CIEL03_3_2 op 639 (STTR 10 26, STGS 10 '' 255 600).
- Second reading: confirmed.
- Fix (2026-11-08): renderer.js: with no panel the rule alone gives the coverage (FS_LAYER ruleWhole) and blend-shader layers take no rule; a panel keeps the old path.
- Compared: Native frame of a layer at alpha 128 through RULE_26 (STTR after the commit, no FADS after it): mean 2.1 levels.
### N2-17: Hazed layers: partial alpha counted twice (medium, confirmed)

Functions: `0xb24f0`.
- Native: 0x36520 haze branch (no panel, row of STRA n exists, grain 0; listing 0x37054-0x370d0, 0x37608-0x37688, 0x37e14): colour (1,1,1,1), 0xb6f60(x, y, slot, flags, 0x26, 2, 1) draws the picture through the haze shader into cleared target 2. Blend number 0x26 is draw type 0 (0x3c9748[37] = 0), blend state 0 = SrcAlpha, OneMinusSrcAlpha / One, One (0xd3914; +0x320 bound in 0xbbb28, clear colour 0 from +0x590), so target 2 holds (s.rgb * a, a) with s the straight picture and a its alpha. Then 0xb24f0(0,0,0,0,2, shader of the layer's blend) with colour (A, tint): normal blend = shader 0 / type 0 again, screen = s*a*a*tint*A + d*(1 - a*A); blend shaders (type 7) get source colour s*a*tint and alpha a instead of s*tint and a.
- Port: renderer.js drawLayer draws a hazed layer in one pass through FS_LAYER (hazeUniforms, hazeShift): normal layer o = c * alpha with blendFunc(ONE, ONE_MINUS_SRC_ALPHA) = s*a*A + d*(1 - a*A) (renderer.js:268, 901-902); blend shader composite(b, unp(c), c.a, alpha) with straight s (renderer.js:269-271).
- Effect: Under STRA (heat haze) pictures with partial alpha are brighter or stronger in the port than in the game: at a = 0.5, A = 1, the game's colour term is half the port's (0.25 s against 0.5 s) for a normal layer, and a blend layer gets a weaker source natively (ps_dodge5 uses 1 - ao * s * a). Hard-edged sprites barely change (0.5% partial pixels); soft effect pictures such as IMG2230, IMG2270, IMG0606, IMG0604 (32-50% partial pixels) look noticeably different while hazed.
- Reached: 525 STRA calls with n != 0 on layers with a picture: 372 on NXGZ pictures with alpha; 206 at normal blend, 319 with a blend shader (17, 11, 23, 19, 22, ...). Example: 04_01_CIEL04_6_2 ops 589-604, STCH 26 img2270, STRA 26 49 at normal blend faded in by STGS.
- Second reading: Listing confirms the two passes: 0xb6f60(..., 0x26, 2, 1) draws through haze (shader 15, draw type 0 from 0x3c9748[37]) with blend state 0 (SrcAlpha, OneMinusSrcAlpha / One, One, 0xd3914 case 0), then 0xb24f0 composites with the layer's blend; the port does one pass (renderer.js:268, 901-902; 269-271). Survey repeated: 525 STRA with n != 0 on layers with a picture, 206 normal blend, 319 blend shader (17, 11, 23, 19, 22 ...). The effect's direction words are reversed.
- Fix (2026-11-08): renderer.js FS_LAYER hazeTwice: a hazed layer outside a panel counts its texel alpha twice in the colour (target 2 holds (s a, a) from SrcAlpha, then the composite).
- Compared: Native frame of a soft picture (IMG2270) under STRA 25: mean 4 levels; a coarse check, the haze phase differs.
### already V10: STCL does not stop the layer's motion (medium, confirmed)

Functions: `0x625c0`.
- Native: 0x625c0 calls 0x958d4(.., 0) on state +0xc34 and live record +0x14c (listing 0x62614-0x62644) before writing x and y, so no track writes the layer afterwards and a following STMA 0 leaves x and y alone.
- Port: vm.js:1399 op_STCL leaves l.motion; vm.js:793 op_STMA then bakes the old track's last values over the STCL position.
- Effect: QA_20 op 816-817: layer 30 (img2473, z 518, drawn above layer 11) ends at y 78 in the port and y -60 in the game, until STCP(30,0) at op 1117.
- Reached: QA_20 op 816-817 (track 23707 writes y). 05_00_ARC05_9_1 op 2077 is followed by STMA 3490, whose first key sets x and y, so it shows no difference. The other 7 calls have no running track.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_STCL stops the layer's track first, what it last wrote staying on the layer.
- Compared: Listing and test; no native frame.
### N2-86: SHOK period floored to whole frames (low, confirmed)

Functions: `0x2ee70`, `0x5f8f0`.
- Native: 0x2ee98-0x2ef14: period frames = ms x 3 / 50 kept as a float (0xafec20); total frames = (ms x count x 3) / 50 (0xafec1c); 0x2ef30 steps the phase 2 pi / period a tick.
- Port: effects.js:27-28 period = max(FRAME, floor(ms / FRAME) frames), duration = period x max(1, count).
- Effect: A shake whose period is not a whole number of frames oscillates faster and ends earlier: 80 ms x 10 lasts 48 frames natively and 40 in the port (wave 4.8 against 4 frames), 110 ms x 10 lasts 66 against 60.
- Reached: 296 of 869 numeric SHOK calls in the shipped scripts (80 ms 84 calls, 90 ms 100, 110 ms 25, 120 ms 39, 70 ms 16, 60 ms 8, 140 ms 11, 40 ms 3).
- Second reading: confirmed.
- Fix (2026-11-08): effects.js impact: period frames = ms x 3 / 50 as a float, total = (ms x count x 3) / 50 whole frames, phase and level stepped from those (first displayed frame = step 1).
- Compared: Per-frame vertical shift of the picture in native dumps of SHOK(0,12,80,10): period 4.8 frames, 48 frames in all, values within a pixel of the formula.
### N2-87: SHOK with count 0 still shakes in the port (low, confirmed)

Functions: `0x2ee70`.
- Native: 0x2eeac-0x2eef4: total frames = (ms x count x 3) / 50 = 0 at count 0, and 0x2ef30 (0x2f274 cbz) then zeroes the offsets, so there is no shake and any running one stops.
- Port: effects.js:28 duration = period x max(1, count): count 0 gives one period of shake.
- Effect: One short jolt of up to about 17 px at 1080p (y 7: 22.5 px amplitude, decaying to 0 over the single 4-frame period) appears where the game has none, or a running shake restarts instead of stopping.
- Reached: 1 call with an amplitude: 07_00_ARC07_1_2 op 832 SHOK(0,7,80,0). 07_01_CIEL07_1_3 op 1992 SHOK(0,0,0,0) has amplitude 0 and stops the shake in both.
- Second reading: Listing as claimed: 0x2eeac-0x2eef4 total = 0 at count 0, 0x2f274 cbz -> 0x2f360 zeroes the offsets; effects.js:28 max(1, count) gives one period, and 07_00_ARC07_1_2 SHOK(0,7,80,0) is the only call with an amplitude. The size is overstated: the port's impact wave decays linearly over that single 4-frame period (effects.js:50), so it peaks at about 17 px at 1080p (22.5 px x sin(2 pi t/T) x (1 - t/T): 16.9 px after one frame, 5.6 px at the opposite swing), not 22.
- Fix (2026-11-08): Count 0 gives zero frames: no shake and a running one is replaced by nothing.
- Compared: Native dump of SHOK(0,12,80,0): no movement.
### N2-88: A delayed SHOK cuts off the shake already running (low, confirmed)

Functions: `0x2ef30`.
- Native: 0x2ee7c-0x2ee94 stores a delayed SHOK in the pending slot 0xafecb0-0xafecc0 and leaves mode, total and offsets alone; 0x2ef30 (0x2ef68-0x2ef9c, 0x2f18c-0x2f22c) replaces the running shake only when the delay has run out.
- Port: vm.js:1457 assigns gfx.shake = makeEffect(...) at once; effects.js:47-48 returns 0 until the delay has passed, so the old shake stops when the command runs.
- Effect: The screen goes still for the length of the delay where the game keeps shaking, for example 500 ms in 05_01_CIEL05_2_2_1 op 653.
- Reached: 30 delayed SHOK calls run while the previous SHOK has time left, counting only WTTM between them (05_01_CIEL05_2_2_1 op 653, 09_01_CIEL09_6B op 2494, 14_01B_01_CIEL14B_1G op 8951 with no wait at all).
- Second reading: confirmed.
- Fix (2026-11-08): effects.js: a delayed SHOK keeps the running one until the delay is over (makeEffect prev, effectOffset).
- Compared: Native dump: SHOK(..,800) then SHOK(..): the immediate one replaces the pending one and runs (period 6 frames, 33 px peak).
### N2-89: SHOK delay counts 16 ms a tick (low, confirmed)

Functions: `0x2ef30`.
- Native: 0x2ef68-0x2ef8c: pending delay -= (ticks x 1000) / 60, integer division, so 16 ms a tick at one tick a frame; the shake starts and takes its first step in the call where it reaches 0.
- Port: effects.js:27 delay = floor(ms / FRAME) frames, 16.67 ms each.
- Effect: Long delays start early in the port: 1 frame at 500-800 ms, 2 at 850-1000, 3 at 1300-1500, 5 at 2200, 9 at 3900.
- Reached: 27 of the 261 calls with a delay (500 ms 8, 550 2, 600 2, 700 1, 800 1, 130 1, 230 1, 850 1, 1000 3, 1300 2, 1500 2, 2200 1, 3900 1, 3950 1).
- Second reading: confirmed.
- Fix (2026-11-08): The delay is ceil(ms / 16) frames (16 ms a tick, 0x2ef30).
- Compared: Listing and tests; no native frame of a long delay. Compared with the game 2026-11-09: Native frames with a clock on screen (a mark moved by STCL, 1.289 px a tick): SHOK(0, 11, 50, 3, 3900) first moves the picture at tick 244 (ceil(3900 / 16); 3900 / 16.67 would be 234), by +27, -24, 0, +17, -14, 0, +6, -4 px on the following ticks, which is effects.js's sin(2 pi n / 3) x (1 - n / 9) x 35.4 px. (SHOK does not move the solid colour pictures, as the image flag +0x41 says: the first try used WHITE and saw nothing.)
### N2-90: A restore keeps a running SHOK (low, confirmed)

Functions: `0x2ef30`.
- Native: 0x5baf0 at 0x5cb34 calls 0x2ea70(-1) when the record's shake type +0x19ae is 0, which is always (only the unused SHAK command writes it non-zero): mode -1, flags 0, and 0xafec18 / 0xafec1c cleared by the 8-byte store at 0x2eaec, so the shake ends.
- Port: vm.js:1663 snapshot stores gfx.shake, vm.js:1747 restore puts it back at the elapsed time it had.
- Effect: Loading, rewinding or jumping back to a wait taken while a shake ran continues that shake (up to about a second), where the game shows none.
- Reached: Any SHOK followed by a text wait within its life, then a rewind, Quick Jump or load to that point; SHOK is usually followed directly by text.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js restore leaves no shake (0x5baf0 -> 0x2ea70(-1)).
- Compared: Listing and test. Compared with the game 2026-11-09: Native frames: SHOK(0, 20, 300, 30) before a line, the next line read, then one tap of rewind 4.7 s into the 9 s shake: the picture is at rest from the frame the page comes back and stays there. The port, same scene and keys: shaking before, at rest after.
### N2-91: Tweens last longer than nominal because of the integer step (low, confirmed)

Functions: `0x329f0`, `0x3c970`.
- Native: 0x637a0: frames = ms x 60 / 1000 (integer). 0x32820: counter +0x8a = 0x1000, step +0x8c = (short)(int)(-4096 / frames). 0x3c970 0x3ce54-0x3ce70 steps it each tick, and 0x329f0 waits and 0x37f50 / 0x3bba0 sample (progress = 1 - counter / 4096) until it reaches 0. The truncated step makes a fade take ceil(4096 / step) frames.
- Port: animation.js:71-73 Value.at and :85 Value.end use the nominal ms; vm.js:1396 op_STGS; vm.js:1415-1421 op_STCF sleeps for that remainder.
- Effect: Fades end later in the game than in the port and scripts waiting on them resume later: 1 frame for most lengths, 800 ms 49 / 48 frames, 3000 ms 187 / 180, 5000 ms 316 / 300, 7000 ms 456 / 420, 10000 ms 683 / 600, and the one 40000 ms fade 4096 / 2400 frames.
- Reached: Every timed STGS; 959 calls differ by 2 frames or more and 272 by 6 or more (3000 ms 239 calls, 5000 ms 13, 6000 ms 10, 7000 ms 2, 8000 ms 1, 10000 ms 5, 40000 ms 1 in 09_00_ARC09_3_1 op 588). 14_00_ARC14_1 op 5125 waits on a 7000 ms fade with STCF(1,8).
- Second reading: confirmed.
- Fix (2026-11-08): animation.js Value: progress n x step / 4096 with step = trunc(4096 / (ms x 60 / 1000 whole frames)), duration ceil(4096 / step) frames (the STGS / STZ4 / STRT / STCL family, 0x32820 / 0x31f30 / 0x32630).
- Compared: Native 3000 ms fade measured in the sandbox: 156 presents at about 1.2 game ticks a present (the sandbox's rate) = 187 ticks, as the integer step predicts (180 would have been nominal).
### N2-92: Shake and sway follow parents and links in the port only (low, confirmed)

Functions: `0x34440`.
- Native: 0x63520 stores the slot's flag byte as the effect kind: quake 1 at +0x158, SHK2 2 and SSW2 3 at +0x159. 0x34440 walks the parents or the link only when the flag is 1 (0x347cc for +0x158, 0x348e8 cmp w10, #1 / b.ne 0x349c4 for +0x159), so a layer's shake or sway always adds its own stored offset / 3.
- Port: effects.js:122-138 slotShift applies the chain to both slots (renderer.js / effects.js:155-158 layerShiftPixels; checklist V10 applied it to both).
- Effect: A shaken or swaying SBAS child takes its root-most ancestor's motion instead of its own (visible for SSW2, whose random numbers are per layer natively, and for children with other arguments). A SACL layer linked to a panel that has the same effect gets none in the port (07_00_ARC07_1_2 op 1189: seven layers stay still, up to about 16 px at 1080p, where the game moves them by their own shake); a non-SACL one would move with the panel only, where the game adds its own as well.
- Reached: SHK2 / SSW2 on a layer whose parent or link has one in that slot: 40 parent cases in 22 places by a linear replay (4 with different arguments, 3 of them in 15_01B_CIEL15B_1), and 7 visible SACL panel-linked layers at 07_00_ARC07_1_2 op 1189.
- Second reading: Listing as claimed: table 0x3514f0 = 0,1,1 maps flag 1 / 2 / 3 to slot 0 / 1 / 1 (0x63550, 0x6357c), 0x91770 etc. pass 1 (SQK2), 0x91b3c 2 (SHK2), 0x91edc 3 (SSW2); 0x348e8 cmp w10,#1 / b.ne 0x349c4 keeps the own +0x188 / +0x190 for flags 2 and 3; effects.js:122-138 walks parents and links for both slots. The panel example is misdescribed: 07_00_ARC07_1_2 op 1189's seven panel-linked layers (4, 7, 8 on 5; 15, 16 on 2; 19, 20 on 3) are all SACL (ops 984-1121), so renderer.js shiftOf adds no clip shift and slotShift returns 0: the port does not move them at all, where the game adds their own offset. A linear replay finds no visible panel-linked layer at the other named ops, and 40 parent cases in 22 places (4 with different arguments) against the first reading's 68 and 5.
- Fix (2026-11-08): effects.js slotShift: shake and sway add the layer's own offset; only the quake walks parents and links.
- Compared: Listing and test; no native frame. Compared with the game 2026-11-09: Native frames, every present: an SBAS child with its own SHK2 (x 20) under a parent with SHK2 (y 20) moves 20 px across and not at all up or down while the parent moves 16 px up and down; with the child's shake stopped (SHS2) it stands still under the moving parent; a SACL layer linked to a panel moves by its own shake only, the panel's clip by the owner's. The port in the same scenes: the same ranges (child x 1111-1150, y fixed; SACL layer x 1352-1391, y fixed; clip top 485-516).
### N2-93: Grain orientation steps differently (low, confirmed)

Functions: `0x35fc0`.
- Native: 0x36014-0x36020: period 3, or 1 when n > 2. 0x36038 steps only when the counter exceeds the period, so period 1 steps every second frame. 0x3606c-0x360a0 applies the mod 4 increment twice, so the orientation +0x1b2 goes 0, 2, 0, 2: normal and mirrored across only.
- Port: screenfx.js grainSample: period = n > 2 ? 1 : 3, flip = floor(f / period) % 4, cycling all four orientations including the two vertical flips.
- Effect: The static changes orientation every frame and flips vertically in the port; in the game it mirrors across every 2 frames (n = 11) or 3 frames. Subtle, as the position is random each frame either way.
- Reached: All 196 STNS calls; n = 11 is the most common value.
- Second reading: confirmed.
- Fix (2026-11-08): screenfx.js grainSample: every second frame for n > 2, every third otherwise, normal or mirrored across only.
- Compared: Listing and test; no native frame. Compared with the game 2026-11-09: Native frames, every present, with the clock: between one frame and the next the static is either the same pattern moved or the pattern mirrored across (phase correlation 0.34-0.76 against 0.01 for the other three orientations), never upside down, and with STNS 11 it changes orientation every second tick. screenfx.js grainSample has the same rule.
### N2-94: Band style and width when the top layer did not copy them (low, confirmed)

Functions: `0x37ea0`.
- Native: 0x37ea0 copies only the clip rect and rotation (0x37efc-0x37f10). Width +0x11c and style +0x11e are copied from the link only by 0x37f50 at 0x38418-0x38440, which a SACL layer skips and a layer at alpha 0 never reaches (0x37f50 calls 0x37ea0 and returns first, listing 0x38038). 0x34a70 then reads the layer's own values and returns at once when they are 0.
- Port: transform.js:149 always takes border and frame from the owner, and renderer.js:671 picks the last visible layer, so the band is still drawn.
- Effect: While the group's top layer in z order is at alpha 0 or SACL and has no style of its own, the game draws no band and the port does.
- Reached: Static survey: 49 owner / top-layer pairs with the top layer at alpha 0 and 4 with a SACL top layer (08_01_CIEL08_4_1); alpha 0 lasts until the layer's first frame above 0, after which the copy stays on the record until a commit.
- Second reading: confirmed.
- Result (2026-11-08): No change: native frames with fresh layer numbers (and without) show the band for a group whose last layer is SACL or at alpha 0. The port keeps taking the band from the owner.
- Compared: Native frames (t6/t4 test scenes) with layers 8/9 and 10/11 used nowhere else.
### N2-95: Parent pivot y scale (low, confirmed)

Functions: `0x388d0`.
- Native: The parent's pivot y (record +0x68, 362-unit space: STPV y x 362 / 272, 0x639a0) is multiplied by 0.5 (0x389a4-0x389a8), so script y x 181 / 272.
- Port: transform.js:93 uses ppy x IY (2/3), the pivot in script units from imageSize, so script y x 2/3: 0.18% too large.
- Effect: An SBAS child sits about 1 px off vertically at zoom 1 for a parent 720 stored pixels tall (90.667 against 90.5 engine units), about 2 px for 1449.
- Reached: Every SBAS child (943 SBAS calls).
- Second reading: confirmed.
- Fix (2026-11-08): transform.js world: the parent's pivot y is script y x 181 / 272 (x 0.5 of its 362-unit value), x stays pivot x x 0.5 of script units (640-unit x 0.375).
- Compared: Compared with N2-7's native frame (child of an L parent, mean 3.2 levels).
### N2-96: >>| shown for a held fast forward (low, confirmed)

Functions: `0x3b5f0`.
- Native: State 4 is set only in the two scene-skip countdowns (0x41138-0x4113c, 0x41370-0x41374); a running skip shows state 3, >>.
- Port: main.js:729 and 758 call setSkip(true, true), so held fast forward adds .force: style.css:204 draws the >>| cell.
- Effect: The port shows >>| while Control or ZR is held where the game shows >>.
- Reached: Every held fast forward.
- Second reading: confirmed.
- Fix (2026-11-08): style.css: the >>| cell only with .countdown (the scene skips' countdown); setSkip no longer sets force.
- Compared: Listing and tests; no native frame. Compared with the game 2026-11-09: Native frames: ZR held over read text shows the same >> cell as the skip toggle, at the same level, with no bar. The port, Control held: the same cell (difference in its box 2.6 levels).
### N2-97: STTR wipes whose rule picture the next FADS frees (low, likely)

Functions: `0x4b4c0`.
- Native: 0x60610 (listing 0x60760-0x60794) calls 0x4b4c0(-1) for any FADS with rule 0, before the commit, so 0xb6b50 leaves slot 0x1c09's texture at -1. 0x36520 draws a layer with record +0x10c >= 0 and alpha < 1 through 0xb6d30(0x1c09) -> 0xa6e90(1 - alpha, -1, flip): no rule picture (size 0 from 0xdfa6c, texture descriptor 0x3f).
- Port: vm.js op_STTR keeps l.rule on the layer and renderer.js drawLayer samples RULE_nn for the whole tween; a FADS does not touch it. ANIMATIONS.md's note that every STTR layer present at a FADS has finished its tween does not hold for these sites.
- Effect: In these 9 wipes the port shows the RULE_nn pattern while the game has no rule picture; what it shows instead depends on texture descriptor 0x3f and needs a native frame capture (longest: 08_01_CIEL08_4_2 op 340, 1600 ms).
- Reached: STTR + STGS tween with a rule-0 FADS before it ends: 07_00_ARC07_1_2 op 824 (the message between is @n), 07_01_CIEL07_3 ops 2163 / 2165 / 2167, 07_01_CIEL07_8 op 2069, 08_01_CIEL08_4_2 op 340, 09_01_CIEL09_2B op 3947, 13_00_ARC13_4 op 202, QA_19 op 315.
- Second reading: The mechanism holds: 0x60794 frees slot 0x1c09 for rule 0 before the commit and 0x37748-0x377bc passes its -1 to 0xa6e90 (0xdfa6c size 0, descriptor 0x3f) while alpha < 1; ANIMATIONS.md:292-295 skips the shared slot on a premise that is false here. Two of the eleven sites are wrong: 10_00_ARC10_5C op 1415 and 14_01A_CIEL14A_2 op 3542 have STCF(layer, 8) after the STGS, and 0x329f0 waits on the alpha counter +0x8a, so those tweens have ended at 255 before the FADS.
- Fix (2026-11-08): vm.js keeps the engine's one rule slot (gfx.ruleSlot): STTR and FADS with a rule set it, a FADS with rule 0 empties it, and renderer.js takes the rule from there: no rule means plain alpha.
- Compared: Native frame of STTR(2,26) + FADS(1,0,0): plain alpha (fit bg .50, picture .51; port now the same, mean 2.5).
### N2-98: Old frame of a transition keeps the SHOK offset (low, confirmed)

Functions: `0x4b740`.
- Native: 0x4b740 saves the shake offsets, sets them to 0 (0x2f8e0, 0x2f8c0) and redraws the layers (0x3bba0) for the old picture, then restores them.
- Port: renderer.js:976-983 beginFade reuses the last frame drawn, shake included.
- Effect: A FADS started while an earlier SHOK still runs fades from a picture displaced by the shake's offset at that frame; in the game the old picture sits still.
- Reached: 7 SHOK calls with a wait before a timed FADS inside the shake (for example 04_01_CIEL04_4_2 op 1436); the 343 SHOK followed at once by FADS have no offset yet.
- Second reading: confirmed.
- Fix (2026-11-08): renderer.js beginFade redraws the old frame with no shake (and no split, V15) before the transition.
- Compared: Listing and tests; no native frame.
- Correction (2026-11-08): the first fix redrew the old picture from the live layers, which the commands before a FADS have already changed. In 05_01_CIEL05_4B the `STCP n 0` calls at ops 954-970 hide layers 16-32, so the old picture came out black and the screen dropped to black for the 100 ms of FADS 0 100 (op 971); op 112's FADS 2 300 did the same. `gfx.shake` also stays set after a SHOK ends, so this reached every FADS after a shake in the scene, and any FADS during a split. A player's report.
- Fix (2026-11-08, second): renderer.js drawLayers keeps a copy of what it draws (layers and time) while a shake or split is on, and beginFade redraws that with no shake or split.
- Compared: Compared with native frames: the real script's stretch in the sandbox, every present dumped: 121.1, 109.0, 104.8, 96.8, no black frame. The port on the same scene, brightness per frame: before 124, 0, 12, 29 ... 97; after 123, 122, 117 ... 97. The second dip (op 112) goes too. The native timing of the 0.9 s hold before the FADS matches.

### N2-99: STCH from a blurred source with blank blur arguments (low, confirmed)

Functions: `0x60840`.
- Native: 0x60988-0x60ad0, with no STCH/SCH2 test: when argument 18 is 0-39 the blur starts from the _XX_YY digits of the source layer's stored picture name (state +4, table *0xae0888), and arguments 9 and 10 replace them only if present.
- Port: vm.js:1198-1199 op_STCH sets l.blurX = num(bx) || 0 and l.blurY = num(by) || 0 after startLayer copied the source's blur, so a blank argument gives 0. op_SCH2 (vm.js:1240-1241) keeps it.
- Effect: QA_20: layer 28 (img2472, z 518, zoom 737) is IMG2472_04_04 in the game, 4,4 blurred with that entry's size and pivot; the port draws it sharp until the layer is cleared.
- Reached: One shipped command of the 201 STCH with a source: QA_20 _STCH(28,img2472,74,76,1000,255,518,,CC,,,,,,,,,,22); after _STCH(22,img2472,352,40,1000,255,518,,CC,4,4,,,,,,,,32);. A replay of all STCH/SCH2 in script order found no other case where native and port blur differ. IMG2472_04_04 is in the name table.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_STCH: blank blur arguments keep the source layer's blur (0x60988-0x60ad0).
- Compared: Listing and test. Compared with the game 2026-11-09: Native frame of QA_20's two commands on test layers (STCH with blur 4, 4; STCH from it with blank blur arguments; the same picture sharp): the copy is as soft as its source (gradient energy 35.9 and 36.3 against 111.7 sharp), and the port's is the same (36.6, 36.8).
### N2-100: A load restarts the speed lines, the port continues them (low, confirmed)

Functions: `0x86470`.
- Native: 0x5d950 (checkpoint restore) calls 0x86470(0, 0) at 0x5ed94 then 0x86470(state +0x19a9, 0) at 0x5ee48, and 0x5baf0 (0x5c290), 0x5d710 (0x5d7b0) and 0x814c0 (0x81980) call 0x86470(state +0x19a9, 0): unless state 2 of that type is already running, this clears the particles, the phase and batch timers (0x14715de, 0x1471616) and the level, so phase 0 replays.
- Port: web/app/js/vm.js:1664 and 1750: gfx.lines is saved and restored with rebaseTimes, keeping its age, so linesSample carries on at the saved phase (and a save inside FCSP's fade continues the fade, where the game's restored type 0 turns the lines off).
- Effect: After loading a save made inside a speed-line scene, types with more than one phase go through their first phase again in the game (18-20, 23, 26, 27, 29, 32 for 0.15-0.4 s) while the port stays in the later phase.
- Reached: Saves on the message waits of the FCLN spans of types 18, 19, 20, 23, 26, 27, 29, 32 (QA_13 to QA_25). Type 6 is out: its only span (08_00_ARC08_3_2 raw ops 514-530) has no message wait and lasts 400 ms (WTTM(400,1) then FCSP()), so no save point falls inside it and its 1.1 s phase is never reached. Timed FCSP: the only one (06_01_CIEL06_3 raw op 1940, FCSP(2000)) is followed by WTTM(2000,1) before the next message wait, so no save point falls inside the fade.
- Second reading: Restart confirmed: 0x5d950 (load, via 0x82330) calls 0x86470(0,0) at 0x5ed94 then 0x86470(state +0x19a9,0) at 0x5ee48, which clears particles, the timers 0x14715de / 0x1471616 and the level, so phase 0 replays; vm.js:1664/1750 keep the age through rebaseTimes, and 0x86850 and effects.json give the phase lengths. Type 6 and the timed-FCSP parenthetical are not reachable in shipped scripts.
- Fix (2026-11-08): vm.js restore: lines restart from their first phase (off if they were fading).
- Compared: Listing and test. Compared with the game 2026-11-09: Native frames: a test scene with FCLN type 27 before a line; Return to Title on it (the automatic save), then Continue: when the scene comes back the lines go through their first phase again (the dense first batches, 9,000-10,000 lit pixels with the centre further left, as after the FCLN itself; about 3,000 once settled). The port after a load: the lines' clock restarts at the load.
### N2-101: Speed-line batches come every whole frames, not every interval ms (low, confirmed)

Functions: `0x86850`.
- Native: 0x86850 (listing 0x86a6c-0x86ab0): a new batch when row +0x20 interval <= B x 1000 / 60, B a whole-frame counter (0x1471616) reset by each batch and cleared at FCLN: intervals 20, 30 and 32 ms give a batch every 2 frames (33.3 ms), 50 ms every 3, and the first batch comes 2-3 frames after FCLN.
- Port: web/app/js/screenfx.js:137-138: batch = floor(t / max(FRAME, interval)) on the continuous clock, so at 60 Hz a 20 ms interval gives a new batch on 5 of 6 frames (50 a second), 30 and 32 ms about 31-33 a second; batch 0 shows at once.
- Effect: The lines re-randomise about 1.7 times too often in the 20 ms types and slightly too often for 30 and 32 ms (50 ms types match), and appear 1-2 frames early: only the flicker of the speed lines.
- Reached: Shipped FCLN types 19-23, 29, 32 (20 ms), 15-17 (30 ms), 4, 5, 8 and 27's second phase (32 ms); all 26 calls are in the survey.
- Second reading: confirmed.
- Fix (2026-11-08): screenfx.js linesSample: a batch every ceil(interval x 60 / 1000) whole frames, none before the first interval.
- Compared: Listing and tests. Compared with the game 2026-11-09: Native frames, every present, with the clock: FCLN type 19 (20 ms) shows its first lines 2 ticks after the command and new ones at ticks 4, 6, 8, 10; over 170 presents a new batch comes exactly when 2 or more ticks have passed since the last one (155 agree; the 15 that do not are pairs where the clock's reading is a frame late).
### N2-102: SQK2 -1 quakes a layer 0 or 1 that is only staged (low, confirmed)

Functions: `0x91540`.
- Native: 0x91540 with layer -1 calls 0x63520 for layers 0 and 1 only when their live record is in use (+0xc == 1, listing 0x9178c and 0x917b0), so a picture staged by STCH in the same frame gets no quake. With mode not 0, 0x3c970 (listing 0x3d160-0x3d1b0) has layers 2 and up copy layer 1's stored offset (layer 0's when layer 1 is absent), which then stays 0: nothing moves.
- Port: vm.js:1441 layerEffect gives every layer of allLayers(), pending ones included, the effect; effects.js:108-117 storedShift copies that source's offsets.
- Effect: In these scenes the port's layers rumble (x 0-3, y 1-9 units) where the game's stay still.
- Reached: 8 of 617 SQK2 -1 calls, all sync mode: layer 1 staged at 13_01_01_CIEL13_2 op 1945, 14_01B_02_CIEL14B_3_1 ops 471 and 1597, 14_01B_03_CIEL14B_4_1D ops 603 and 4085, 14_01B_03_CIEL14B_4_2 op 3625, 14_01B_03_CIEL14B_5B op 873; layer 0 staged with no layer 1 at 14_01B_02_CIEL14B_3_1 op 109. The staged picture is the black card img0597 each time. 11 more stage layer 0 under a live layer 1, on the card only, which shows nothing.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js layerEffect: with layer -1, layers 0 and 1 count only with a live record, the others also when staged.
- Compared: Listing and test; no native frame. Compared with the game 2026-11-09: Native frames, every present: SQK2 -1 (sync mode) in the frame that stages layer 1 leaves a layer above it perfectly still for the whole quake; the same command with layer 1 on screen moves it (x 374-394, y 334-352). The port: still, then x 377-394, y 340-351.
### N2-103: Spline solve subtracts 1 instead of the previous term (low, confirmed)

Functions: `0x972c0`.
- Native: Forward pass at 0x9760c-0x97624: s4 = 1 / b, then `fmul s6, s3, s4` (0x97618, bytes 0x1e240866) is b x (1 / b) = 1, so R[i] = second difference - 1 for i >= 2; the previous R is never read. R[1] has no subtraction. Back substitution is the usual m[k] = (R[k] - m[k+1]) / b[k]. y = 0, 255, 255, 0 gives m1 = -46.68.
- Port: web/app/js/animation.js:203-209 splineMoments solves the system exactly (d[i] = (rhs - d[i-1]) / w); y = 0, 255, 255, 0 gives m1 = -51.
- Effect: Mode-1 motions with four or more points follow a slightly different path: up to about 7 script units (28 px) of x or y at mid-segment, 2.9 degrees of rotation, 9/1000 of zoom, 7/255 of alpha.
- Reached: 36 of the 52 mode-1 tracks differ by more than 0.01 unit, from 36 STMA calls in 14 scripts (QA_05 7, 05_01_CIEL05_1DASH 4, 12_00_ARC12_2 4, ...). Largest: track 21503 rotation 289 units and y 6.0, track 1905 x 7.0, track 21332 zoom 9.2.
- Second reading: confirmed.
- Fix (2026-11-08): animation.js splineMoments is the engine's solve: b[i] = 4 - 1 / b[i-1], right-hand sides R[i] = (d[i] - d[i-1]) - 1 for i >= 2 (the b x (1 / b) product is 1), the usual back substitution; fieldAt takes the moments of frame next - 1.
- Compared: Listing and test (m1 = -46.68 for 0, 255, 255, 0). Compared with the game 2026-11-09: Native frames of track 24142 (ten keys, mode 1) on a test layer, 177 presents: the path the layer takes fits the engine's solve to 0.41 px rms (worst 0.85) and the exact solve the port had to 2.79 px (worst 12.3).
### N2-104: Spline points chosen from raw key values (low, confirmed)

Functions: `0x972c0`.
- Native: 0x973fc-0x974a8: a key is merged only when it is a skip, or when its raw value equals both the previous and next frame's raw values (holds compare as the sentinel). 0x974b4-0x974c4: the last key is dropped only when its raw value equals the frame before it or is a hold. A hold otherwise makes a point of its own.
- Port: web/app/js/animation.js:176-199 splineFor resolves holds to values and drops skips first, then splineMoments merges a key equal to its resolved neighbours, so runs written with holds lose points.
- Effect: The same channels get fewer points in the port, which moves the moments of the segments around them; included in the path differences above.
- Reached: 27 of 183 field / track channels on the 52 mode-1 tracks have a different point list (track 4250 zoom: 14 points natively, 12 in the port).
- Second reading: confirmed.
- Fix (2026-11-08): animation.js splineFor picks the points from the raw key values: a skip or a key equal to both raw neighbours (holds compare as the sentinel) joins the point before it; the last key adds a point unless equal to the one before or a hold; a point's value walks back over holds and skips, or takes the base.
- Compared: Listing and test. Compared with the game 2026-11-09: With N2-103: the same native path (track 24142 has runs of keys the two point rules treat differently) fits to 0.41 px rms.
### N2-105: Mode panel slides out on the wrong curve (low, confirmed)

Functions: `0xe1bfc`.
- Native: 0x4de10 places the bar with 0xe1bfc(level 0xb35a28, -43.14, 0, 1, type 2 quad, mode 1 out) every frame; 0x4e170 raises the level by 0.05 x frames in state 2 and lowers it by 0.05 x frames in state 4 (listing 0x4e318-0x4e338, constant -0.05). Closing therefore replays the opening curve backwards: y = -43.14 tau^2 for tau = frames / 20 (slow at first, fast at the end).
- Port: style.css:138-139: .modepanel has transition: transform calc(20s/60) cubic-bezier(1/3, 2/3, 2/3, 1) in both directions; closePanel removes .on (ui.js closePanel), so the close runs ease-out forward: y = -104 px x (2 tau - tau^2) (fast at first, slow at the end).
- Effect: Each time the mode panel closes, the bar leaves on the mirrored timing: at the half-way frame the game's bar is still 26 px up from its rest while the port's is already 78 px up (out of 104). Opening matches.
- Reached: Every mode-panel close in normal play (touch auto-hide or the keyboard toggle); state 4 of 0x4e170 is the only path that closes the bar.
- Second reading: confirmed.
- Fix (2026-11-08): style.css: .modepanel closes on the reversed opening curve (ease-in, cubic-bezier(.333,0,.667,.333)); opening keeps ease-out.
- Compared: Listing and test; no native frame. Compared with the game 2026-11-09: Native frames of the mode panel closing, every present: the bar's lower edge is at 93 - 104 (n / 20)^2 px on tick n (92, 91, 89, 87, 84, 80, 72 at n = 9, 67, 62, 56, 49, 35 at n = 15, 18 at n = 17, 9), the quadratic the port's closing curve is; opening is the same curve the other way.
### already V15: Split level does not ease during a FADS (low, confirmed)

Functions: `0x2fc50`.
- Native: 0x2fdd4-0x2fe20: level = last + (1 - T) x (current - last), T being the transition level 0xb34b14 (1 falling to 0, 0x4b740 / 0x48ac0); 0xafec68 takes the current level only while T is 0 or less.
- Port: screenfx.js:60 level = s.level (applied at once by startSplit, vm.js:1472).
- Effect: During those three crossfades the game lays the split over the old and new pictures from the first frame (alpha 1 at once for a non-zero level), its level easing from the last drawn one to the new one by 1 - T; the port leaves the old picture unsplit and shows the new level only through the crossfade, so the channel shift appears later and the darkening follows the crossfade's linear mix instead of the ease.
- Reached: 3 calls: 02_00_ARC02_1 op 406 (FADE 40,-90,16 then FADS 1500), op 567 (FADE 40,-250,3 then FADS 2000), 05_00_ARC05_9_2B op 3086 (FADE 40,-90,5 then FADS 1000).
- Second reading: The listing is as claimed (0x2fdd4-0x2fe20; V15 records it as not modelled, not as a choice), but the effect is wrong about the port. FADE 40 sets gfx.split at once while the FADS's old frame is the last scene drawn (vm.js fade -> renderer.js beginFade), so the port does not jump: drawSplit draws the split into the new scene and present() crossfades the old frame over it. The game draws the split after the transition: 0x3c490 (0x2fc50) is task 11 at priority 60 (0x3bb3c-0x3bb50), the transition 0x47dd0 task 12 at priority 50 (0x47d44), so it lies over both pictures from the first frame.
- Fix (2026-11-08): renderer.js: during a transition the split is applied after it in present(), its level easing from the last drawn one by the transition's progress; beginFade redraws the old frame without the split.
- Compared: Listing and test; no native frame.
### already V10: Sway period and sign per cycle (low, confirmed)

Functions: `0x3c970`.
- Native: Each axis redraws its amplitude and its period at the end of every cycle and draws a random sign once (0x3d1b8-0x3d5fc).
- Port: effects.js:64-69 keeps one period per effect and no sign.
- Effect: Sway is more regular than in the game and never starts the other way.
- Reached: 200 SSW2 calls.
- Second reading: confirmed.
- Fix (2026-11-08): effects.js sway: per axis a new amplitude and period each cycle (cycle = period + 1 frames), a random sign drawn once.
- Compared: Listing and test; no native frame.
### already S37: FADE 41 while skipping (low, confirmed)

Functions: `0x5f420`.
- Native: Runs with no skip test (0x5f420 case 0x29): the split fades out at 1/60 a frame.
- Port: vm.js:1473 clears the split at once when this.skip is set.
- Effect: During a skip the colour split disappears at once instead of fading over a second.
- Reached: 33 FADE 41 calls, when reached while skipping.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: SHOK dropped while skipping (low, confirmed)

Functions: `0x5f8f0`.
- Native: 0x60014-0x6001c tests only *0xae0900 (the load's silent run), not skipping.
- Port: vm.js:1457 ignores SHOK when this.skip is set.
- Effect: No shake while fast-forwarding where the game shakes.
- Reached: 870 SHOK calls, when reached while skipping.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: A timed FADS is instant while fast forwarding (low, likely)

Functions: `0x60610`.
- Native: 0x60610 reads neither skip flag (0xae0660, 0xae0670) and always stages type and ms through 0x5d3a0 -> 0x2e1b0; 0x3c970 starts the transition (0x3d9b0 / 0x3e160 -> 0x4b740) and 0x48ac0 steps its level (0x49554-0x4958c: level += rate x 0x590e80 x frames elapsed), 0x590e80 being the fast-forward step ((n >> 1) + 1 for n ticks, 0x4a5b0: up to 17 a frame with ZR, 33 with the skip toggle).
- Port: vm.js:454 fade: instant = this.skip || !ms || type === 1.
- Effect: Fast forwarding: the game shows a few frames of each timed fade, the port none.
- Reached: 13,125 of 34,029 FADS calls have ms > 0, while fast forwarding.
- Second reading: 0x60610 reads neither skip flag (not in the xref of 0xae0660 / 0xae0670) and stages through 0x5d3a0 -> 0x2e1b0, and vm.js:454 is as claimed; 13,125 of 34,029 FADS have ms > 0. But the level does not run in 0x3c970: 0x3c970 only starts the transition (0x3d9b0 / 0x3e160 -> 0x4b740), and 0x48ac0 steps it at 0x49554-0x4958c (rate x 0x590e80 x frames elapsed). S37's 'no skip factor' is also off: 0x590e80 is the fast-forward step ((n >> 1) + 1 for n ticks, 0x4a5b0).
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: The timed STCL is instant while fast forwarding (low, likely)

Functions: `0x625c0`.
- Native: 0x625c0 reads no skip flag; 0x32630 sets the tween on the live record.
- Port: vm.js:1403 op_STCL: t = this.skip ? 0 : ms.
- Effect: Fast forwarding: the game shows a few frames of the move, the port none.
- Reached: One timed call (QACALL op 193, 500 ms).
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: The timed STZ4 is instant while fast forwarding (low, likely)

Functions: `0x62d20`.
- Native: 0x62d20 reads no skip flag; 0x31f30 sets the tween on the live record.
- Port: vm.js:1381 op_STZ4: t = this.skip ? 0 : ms.
- Effect: Fast forwarding: the game shows a few frames of the zoom, the port none.
- Reached: Two timed calls (10_00_ARC10_3_2 op 1888, 15_01A_CIEL15A_1 op 10252).
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: STCF does not wait while fast forwarding (low, likely)

Functions: `0x62f90`.
- Native: 0x62f90 sets wait bit 5 with no skip test; 0x802c0 clears it only when 0x329f0 reports the tweens done.
- Port: vm.js:1410 op_STCF returns at once when this.skip.
- Effect: Fast forwarding: the script runs on sooner than in the game; the tweens run at the fast-forward step there.
- Reached: All 5,179 STCF calls, while fast forwarding.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: Timed STGS is instant while fast forwarding (low, likely)

Functions: `0x637a0`.
- Native: 0x637a0 reads no skip flag; 0x32820 sets the tween on the live record.
- Port: vm.js:1396 op_STGS: time = this.skip ? 0 : ms.
- Effect: Fast forwarding: the game shows a few frames of each fade, the port none.
- Reached: 4,892 of 8,114 STGS calls have ms > 0.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: A timed quake is dropped while fast forwarding (low, likely)

Functions: `0x91540`.
- Native: 0x91540 tests only the load's silent-run flag (0x5afb0), not the skip flags, so a timed quake is stored and runs on elapsed frames.
- Port: vm.js:1449 layerEffect deletes a finite effect when this.skip.
- Effect: Fast forwarding: the game shows a short quake, the port none.
- Reached: Timed SQK2 calls while fast forwarding (665 of 1,235 give a duration).
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: Timed shake dropped while skipping (low, likely)

Functions: `0x91900`.
- Native: 0x91900 tests only the load's silent-run flag (0x5afb0, listing 0x919d8-0x919e0 and 0x91a84-0x91a88: duration >= 0 and silent returns). It reads neither skip flag (0xae0660, 0xae0670), so 0x63520 stores the shake and 0x3c970 runs it at the fast-forward step: 0x3d01c adds s11 (0x590e80) to its elapsed counter each frame.
- Port: web/app/js/vm.js:1449 layerEffect: `if (this.skip && e.duration >= 0) delete l.effects[slot]`, and vm.js:369 finishAnimations deletes finite effects when skipping starts.
- Effect: Fast-forwarding over a timed shake: by the listing the layer still shakes for a few frames in the game (duration / 17 to 33 frames, so SHK2 of 1200 ms lasts about 3 to 5 frames); the port shows no shake and clears the slot.
- Reached: 25 of 124 SHK2 calls give a duration of 0 or more; reached when the player fast-forwards over one.
- Second reading: The tests are as claimed (0x919d8-0x919e0, 0x91a84-0x91a88; vm.js:1449 and 369; 25 of 124 SHK2 give a duration), but the game does not shake for the full duration while fast forwarding: 0x3c970 adds s11 = w19 = 0x590e80, the fast-forward step (17 to 33 a frame), to the effect's elapsed counter (0x3d01c-0x3d054).
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: Timed sway dropped while skipping (low, likely)

Functions: `0x91cf0`.
- Native: 0x91cf0 tests only the silent-run flag 0x5afb0 (listing 0x91d80-0x91d88 and 0x91db4-0x91db8); it reads no skip flag, so 0x63520 stores the sway and 0x3c970 runs it on elapsed frames during fast forward.
- Port: web/app/js/vm.js:1449 layerEffect deletes the slot when this.skip and the duration is 0 or more; vm.js:369 finishAnimations does the same when skipping starts.
- Effect: Fast-forwarding over a timed sway: by the listing the layer still sways for its duration in the game; the port shows none.
- Reached: 3 of 200 SSW2 calls give a duration of 0 or more (SSW2(7,3,7,1000,5000,1,800,0) is one); the other 197 are endless and kept by both.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### already S37: Timed speed-line fade cut while skipping (low, likely)

Functions: `0x921b0`.
- Native: 0x921b0 reads no skip flag (0xae0660, 0xae0670): 0x86470(0, 120) starts the fade and 0x86850 runs it on elapsed frames during fast forward.
- Port: web/app/js/vm.js:1482 op_FCSP: `this.gfx.lines = this.skip ? null : stopLines(...)`, so the lines go at once while skipping.
- Effect: Fast-forwarding over FCSP(2000): by the listing the lines still fade over 2 seconds in the game; in the port they vanish at once.
- Reached: 1 of 31 FCSP calls passes a time: FCSP(2000) in 06_01_CIEL06_3, when the player fast-forwards over it.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### N2-210: Panel frames were drawn from a branch the game never runs (medium, confirmed; fixed 2026-11-08)

Functions: `0x34a70` (not on the REVERIFY list), `0x36520`, `0x37ea0`.
- Native: `0x34a70`'s only callers pass a target: `0x36520` at 0x372e0 passes 2 and `0x37ea0` at 0x37f38 passes -3, and with a target the colour's alpha is 1 (0x34eb4). The panel path draws the picture into target 2 (`0xb6f60`), then the frame into the same target, then the mask (`0x32e30`), so the mask fades the frame as well. On an unturned panel the outer edge width is a plain rectangle (`0xb1580`: 0x351ac and the other corners, sides at 0x35be0, 0x35cdc, 0x35dd8, 0x35ecc); only the inner width comes from the blob: the falling half of its middle column (rects +0x30, +8, +0x20, +0x18), and at a corner the `_inv` quarter (0x351ec). A turned panel uses `0xb7010` with the blob for both halves. The branch that draws the outer width from the blob on an unturned panel (`cbz w19` at 0x35180) needs target 0, which no caller passes.
- Port before the fix: `renderer.js` FS_FRAME drew that dead branch over the finished scene, with alpha rising from the outer edge to its peak at the width and falling to nothing at twice the width, after the picture had been masked, so the picture showed under the outer half.
- Effect: `01_00_ARC01_2` op 287 (`img0328`, clip 784, -231, 1092, 1581, width 84, style 1): two dark strips with dim picture outside them, where the game has plain black up to x 868 and from x 1792 and one ramp into the picture.
- Reached: 220 `STCH` / `SCH2` with a frame of style 1-6 and width 2 or more (206 black, 14 white) and 24 motion keys. 38 non-zero `STRR` calls land on layers with a frame; those panels keep the blob for both halves.
- Fix: `transform.js` clipGeometry gives `band.solid` (not turned); FS_LAYER leaves the picture out outside `bandInner`; FS_FRAME draws the outer width as the frame's colour at the mask's level and the inner width as before. Test: `tests/reverify.test.mjs`.
- Compared: a native frame of that background, rows 40-120 and 700-760, columns 740-1000 and 1680-1900: black up to the band's inner edge in both, the ramp within a few levels once the text window's veil (x 0.6, in the native frame only) is allowed for; the port's first 30 px of the ramp are up to about 13 levels brighter. No native frame of a frame over a non-black background was compared: that case follows from the draw order in the listing. During a fade of the panel (alpha under 1) the inner width blends slightly differently, because the port draws the frame over the scene rather than into the panel's buffer.

### N2-211: A panel's pictures were each faded at the edge, so the one underneath showed through (medium, confirmed; fixed 2026-11-08)

Functions: `0x36520`, `0x37ea0`, `0xa2c30`.
- Native (native frames, not the listing): a test scene with the panel's real pictures (`img2142` as owner, `ara_l_20_03_n00` linked over it, clip 827, 298, 1238, 514, width 15) on black and on white backgrounds, at owner alpha 255 and 128 and with the owner alone. Where the linked picture is opaque, the edge is that picture alone: alpha and colour are both at the owner's fade (at y 305 the fade is 0.430, the alpha 0.445, the colour 0.440), with no green. At alpha 128 both are that fade x 0.5.
- Port before the fix: `renderer.js` multiplied each layer of the group by the edge fade. At fade f an opaque picture over the owner gave picture x f + owner x f x (1 - f), with coverage 1 - (1 - f)^2: a rim of the owner's colour, and an edge too opaque.
- Effect: `02_00_ARC02_1B` ops 1223 and 1264 (motions 537 and 538, the two small images): a pale green line along the panels' edges. The green inside the panel, where the linked picture is transparent, is the same in the game.
- Reached: 4,372 `STCH` calls link a picture to an owner with a clip and an edge width (static count): 3,702 with no frame, 478 black, 26 white, 166 style 7.
- Fix: `transform.js` groupNeedsBuffer takes the edge width, so a group with one always goes through the buffer. `renderer.js` draws the group's layers with the panel's rectangle and no fade, draws the band with its outer half solid, and `fadeGroupEdge` (FS_GROUP_EDGE) multiplies the finished buffer by the mask once. Test: `tests/reverify.test.mjs`.
- Compared: native against the port in the same scenes, black and white backgrounds. Top edge at width 15, mean level difference over the edge: 20.1 before, 1.4 after (13.4 and 1.5 on white; at alpha 128, 9.8 and 0.7). Frame styles 1 and 2 at width 30: under 1.1 level on every side, also at alpha 128. A turned panel (`STRR` 1500) with no frame: 16.8 before, 1.8 after on the rim.
- Still different, not caused by this fix: a turned panel with a band (36 non-zero `STRR` calls land on `STCH` panels with a band, 28 of them with pictures linked) is 17 levels off on the rim (29 before): the port lets a faint line of picture through outside the band where the game has none (measured on a linked group; `03_00_ARC03_3` op 1517 shows it). Style 7 fades 2-3 px early on the right and bottom edges only, left and top match (`04_00_ARC04_6_2C` op 244 shows it). A linked picture drawn on its own, outside a group, was not compared.
- Both settled 2026-11-09 (TODO item 111), against native frames on black and on white (nine cases). The turned band: `0x34a70`'s turned branch hangs its pieces by a corner or a side on points half a width in from each side (anchors 0x38 / 0x30 / 0x32 / 0x36 at the corners, 0x37 / 0x31 for top and bottom, 0x35 / 0x33 for left and right; scales 2 w / h and w / h), so the top and left bands peak half a width inside and end at 1.5 w, the bottom and right ones rise over 2 w from 2.5 w inside, and each corner has a notch; `FS_FRAME` `turnedBand` draws the sixteen pieces so, and a lone turned panel is composed in a buffer (picture, band, mask). Colour difference 15.3 levels to 2.5 alone, 19.1 to 1.6 with a linked picture, 4.8 to 3.0 on `03_00_ARC03_3`'s panel. Style 7: its blobs (`alphagradationNNN_2`) reach their plateau a texel sooner in the lower and right halves, and the mask's pieces are the blob's own halves (`0x572990`); `edgeFade` reads the half of each side. Alpha difference 1.5 levels (p99 29) to 0.15 (p99 2). The scissor on even pixels and the (width + 0.5) scale were not the cause: panels at odd coordinates match within 2 levels.

### N2-212: STCP changes the depth of a picture on screen only at the next commit (medium, confirmed; fixed 2026-11-09)

Functions: `0x62a40`, `0x32450`, `0x3bba0`. Found by re-reading the rendering functions that had no re-check box (TODO item 11).
- Native: 0x62a40 stores z in the state only (+0x234) and sets no commit flag (+0x7ca); 0x5d3a0 -> 0x32450 copies the 40 values to the staged record's table (+0x5bec), 0x3c970 copies that to the live record, and 0x3bba0 sorts and tests the live table.
- Port before the fix: vm.js op_STCP wrote l.z on the layer on screen, which renderer.js draws from in the next frame.
- Effect: The port moved or hid the layer at once. In the game `STCP` writes the layer number's state, and the draw order is the record's own table, which only a commit fills, so with no FADS and no staged picture before the next wait the picture stays as it was: in `05_01_CIEL05_2_2B` (op 1301, `STCP 31 0` then FANX, which does nothing) Ciel's sprite stays up through six waits and a line of text while its track plays, where the port cut it. 17 waits in 8 scripts drew differently (a replay of all 549).
- Fix: vm.js op_STCP keeps the depth as zNext on a layer that is on screen; commit() moves it to z; copyLayer (STCH / SCH2 from a source) and snapshot take the state's depth. A staged layer or an empty number just has its state. Test: tests/reverify.test.mjs.
- Compared: Native frames: a test layer given STCP 0 stays on screen through a 2.4 s WTTM and goes at the FADS after it; the port matched neither before (gone at once) and matches both now. The real scene (the script's own commands up to that point with the text and waits taken out, then as written): at the line after op 1301 the sprite is still there natively; the port's picture differs from the native frame by 5.1 levels now and 9.7 before. A replay of all 549 scripts finds no frame end where SBAS, SOXY, SACL or STBR is in the same position (those four write the state only as well).

### N2-213: SOXY's offset is in screen pixels (medium, confirmed; fixed 2026-11-09)

Functions: `0x37f50`. Found by re-reading the rendering functions that had no re-check box (TODO item 11).
- Native: 0x77790 (0x7b118) stores arguments 4 and 5 raw in the state (+0x98c / +0x9dc); the commit copies them to record +0x11c / +0x11e; 0x37f50 (listing 0x3859c-0x385e0) adds x x 0.33333 and y x 0.41481 to the position 0x34440 returns in the 640 x 448 view, which is 1 px a unit both ways at 1920 x 1080.
- Port before the fix: transform.js place added 2 x trunc(x / 3) / 6 and 2 x trunc(y x 448 / 1080) / 6 engine units (a formula from the thumbnail path 0x884f0).
- Effect: The port moved the layer by 2.67 px for every 3 units across and about 0.82 px a unit down, cut to whole steps: `SOXY -180 -195` moved a picture 160 px left and 159 up where the game moves it 180 and 195, and offsets of 1 or 2 did nothing. 208 calls, most between 1 and 20 px.
- Fix: transform.js place adds offset / PX and offset / PY: the offset in pixels, to the layer itself (children are placed from the parent's own position). Test: tests/reverify.test.mjs.
- Compared: Native frames of a rectangle with SOXY -180, -195; 20, 20; -2, -4 and 0, 0: moved by exactly those pixels each time. The port's rectangle is on the same pixels in all four (it was 20 px right and 36 px down of the first).

### N2-214: The menu's blurred background is blurred twice over (medium, confirmed; fixed 2026-11-09)

Functions: `0xa0a90`. Found by re-reading the rendering functions that had no re-check box (TODO item 11).
- Native: 0xa0a90 runs its pass across, its pass down, then both again (listing 0xa1328, 0xa1798, 0xa1c34: four loops over the weights, the last into the buffer 0xa2680 draws), and each pass has 2 x ceil(3s) + 1 = 15 copies of the picture (frintp at 0xa0acc), not 13. Blend 1 of the table at 0xd3914 is SrcAlpha, One: the copies are added.
- Port before the fix: renderer.js menuGaussian ran one pass across and one down with 13 taps.
- Effect: The story behind the system menu and the backlog was too sharp: a sigma of 3.7 px where the game's is 5.6.
- Fix: renderer.js GAUSS has 15 weights and menuGaussian runs the two passes twice; a tap from beyond the picture's edge adds nothing, as a moved copy leaves nothing there; menuBlurAlpha cuts the level to 1/255 as 0xa2680 does. Test: tests/function-map.test.mjs (V9).
- Compared: A native frame of the menu over a white rectangle on black: the four edges fit a Gaussian step of sigma 5.3 to 5.7 px. The port's blurred buffer read back from the page: 5.60 (3.7 before). On the screenshot the port's edge still reads about 6% narrower in the darks, because the menu's sky is a DOM layer laid on after the display curve (the same limit as the text window's veil).

### N2-215: A choice's selected row has a soft glow (medium, confirmed; fixed 2026-11-09)

Functions: `0xa0a90`, `0x83e50`, `0x84e50`. Found by re-reading the rendering functions that had no re-check box (TODO item 11).
- Native: 0x83e50 (state 0) draws the labels into a picture of their own in a heavier style (0xa8b90: 0xc1074(.., 2)) and blurs it with 0xa0a90(2, 0, -2): 13 taps 1.5 px apart, across and down twice over, a sigma of about 4.3 px. 0x84e50 adds a 1920 x 64 strip of it a row at the cross-fade x 0.5 in (0.44, 1, 1), (0.75, 1, 1) once taken.
- Port before the fix: style.css .choice-glow had no blur.
- Effect: The port added a sharp cyan copy of the label over the white label, which shows nothing. The game's glow is a halo round the letters.
- Fix: style.css .choice-glow: filter blur(4.27px) and a 2.6 px stroke standing in for the heavier letters. Test: tests/reverify.test.mjs.
- Compared: A native frame of a selected row: outside the letters the halo is 0.77 of the visible label blurred by 4.27 px in green and blue and 0.33 in red (a fit over the row; no glow at all misses by 11 levels, this by 2.6). The port's row measured the same way: 0.76 and 0.32 (0.04 before).

### N2-216: Pictures drawn smaller than they are stored were softened (low, confirmed; fixed 2026-11-09)

Functions: `0x9fe00`, `0x36520`. Found by re-reading the rendering functions that had no re-check box (TODO item 11).
- Native: The game's picture textures have one level; the sprite draw samples them bilinearly.
- Port before the fix: renderer.js load made mipmaps and used LINEAR_MIPMAP_LINEAR.
- Effect: The port sampled its pictures through mipmaps, so a picture shrunk by a zoom under 0.67 was softer than in the game, which has none.
- Fix: renderer.js load: TEXTURE_MIN_FILTER LINEAR and no mipmaps. The wide pre-blur copy in `blurred`, which shrinks the picture first, still averages through mipmaps for that one copy, so the blurred pictures are unchanged (checked on IMG0020 at 30, 30: identical pixels).
- Compared: A native frame of IMG2472 at a quarter of its size: gradient energy 111.7; the port 66.8 before and 111.5 now, the mean difference from the native frame 1.48 levels before and 1.11 now (99th percentile 12 and 4).

### N2-217: The RGB split leaves the speed lines alone (low, confirmed; fixed 2026-11-09)

Functions: `0x391a0`, `0x87a90`, `0x3bba0`. Found by re-reading the rendering functions that had no re-check box (TODO item 11).
- Native: The lines are drawn by the text window's task (0x391a0 -> 0x87a90(2), priority 80), after the split's task (priority 60); the two calls from the layer loop, 0x87a90(0) and (1), draw nothing.
- Port before the fix: renderer.js drawLayers called drawLines and then drawSplit.
- Effect: The port drew the speed lines before the split, so the split would shift and tint them. No script has both on at once.
- Fix: renderer.js drawLayers draws the split, then the lines.
- Compared: A native capture of lines over black with FADE 40 full on: the lines are as bright as without it (the split's overlay would have taken them to black). Under a FADS the lines are in both pictures natively, as in the port: the old lines stay and fade while new ones come in (over four frames 5 apart the lit pixels common to all fall from 0.84 to 0.35 of a frame's worth through the fade, against 0 with no fade).

### Settled since

- `0x87150`: The blend: the draw sets 0xb0640(0x1e) for types 6-8 and 0xb04e0(1) for all lines (0xac0d60, copied to draw record +0x28 of the mesh 0xa27f0), and how that reaches a blend state (0xd3914's table) is not followed; the port blends normally (ONE, ONE_MINUS_SRC_ALPHA). FIXES.md records this as not settled. A native capture of FCLN lines over a mid-grey picture would show whether they add light. Settled 2026-11-09 on native frames: the lines are blended, not added. Over a half-grey picture they brighten it by 0.50 (type 19), 0.52 (type 7) and 0.32 (type 6) of what they add over black, measured in regions mirrored about the lines' centre; white lines blended normally give 0.50 and added light would give 1. renderer.js drawLines stays as it is.


### The 11 functions without a re-check box (re-read 2026-11-09)

They differed at the first audit and were fixed afterwards, so the re-check never listed them. Each was read again in Ghidra's output and the listing, with its callers' arguments and a survey of the scripts' argument forms:

- `0x2f910`: the mode test, the alpha's 1/60 a frame up and down, the level from F1120 - 127 with preset 16's rise, the strength and wobble by preset, the six-frame counter, the pulse counter's lap at 3333, the triangle and the wobble on the first lap only, the amplitude and the 3-degree swing reflected at +-30: all as screenfx.js splitSample. No difference.
- `0x32e30`: the edge width (rounded up to even, doubled for style 7, cut to half the clip), which sides carry it, the blob by width and its eight pieces, the linked branch drawing the owner's picture. No difference that shows: a native frame of a panel at odd coordinates with a linked picture, alone and with a layer between, is pixel for pixel the port's. Two details the port does not have, both under 2 px: on a turned panel with no band the blob pieces are scaled by (width + 0.5) / size, and the linked branch cuts the owner's picture with a scissor on even pixels that is 2 px larger to the right and down (a lead for the 2-3 px on style 7's right and bottom sides).
- `0x362a0`: the table row, the test of the grain flag, the strength (full, the fade-out's left / length, or min(phase ms, p9) / p9 with a fade-in), the two rows of constants and the fraction of the phase: all as effects.js hazeConstants. No difference.
- `0x645f0`: the layer range (-1 all, blank 0, above 39 nothing), n, the time as 16 bits x 60 / 1000, what is written to the record on screen and to the state in each of the three cases: as vm.js op_STRA. One case differs and no script has it: the engine tests the time's 16 bits, the port the whole frames, so a time of 1-16 ms counts as a time there and as none here (the 43 timed calls have 200 ms or more).
- `0x37f50`: the alpha with the link's, the orphan test, the zoom left out for STZ4's flag, the rotation through the parent, the link's clip copied and its origin added unless SACL, the view position, the pivot record. One difference: SOXY's offset (N2-213).
- `0x3bba0`: the menu background's level (0.001, a twelfth a frame, the frozen copy on the first frame and the blur from the second), the sort by depth then number, depth 0 and empty records left out, the owner joining its group, the group states, the tweens' eased offsets with x linear for ease 16 (no STCL has it). Differences: the depth table is the committed one (N2-212); the speed lines' two hooks in the loop draw nothing and the lines come after the split (N2-217).
- `0x62a40`: the layer (above 39 nothing; one script passes 330), a blank depth as 0, the state alone written. One difference: when it shows (N2-212). All 51,568 calls give a layer.
- `0x95938`: the frame count cut to a multiple of the step when the step is 2 or more: as animation.js Motion.time. No difference.
- `0x99620`: the third argument's window close (1, or 2 with no window fade running), the layer, the track written to the state and the record and run at time 0, a track of 0 or less clearing both, the step. No difference that shows: the engine also sets the slot of a number with no picture (11 calls; the next STCH there starts without a track either way).
- `0xa0a90`: the weights, the tap spacing by render width, the additive passes and their order, the copy between the two render sizes. Two differences: the passes run twice and have 15 taps (N2-214), and the other caller's blurred labels are a choice's glow (N2-215).
- `0xb3780`: stores the second zoom pair for the next sprite (its first two arguments are not read): as transform.js stretch. No difference.

### TODO item 120: random numbers (2026-11-09)

- `0x3c970` (sway, `0x3d1b8`-`0x3d5fc`): per slot and axis a timer; when the period is below the timer, the timer is zeroed and three calls of `0x1527f0` (`rand`) give the amplitude (`scvtf`, x 2^-31, x (b - a), + a, `fcvtzs`), the period the same way and, when the sign word is 0, the sign (-1 from 0.5 up). X first, then y, each with its own timer and period; layers 0 to 39; `0x86850` after the loop. Native frames (a white box moved by `SSW2(3, 7, 15, 1000, 2000, 1, -1, 0)`, a mark moved by STCL as the clock, every third present): the sequence from a state of 0 gives x 7 / 80 / -, 8 / 96, 10 / 92, 12 / 119, 9 / 86, 13 / 100 and y 13 / 106 / +, 9 / 100, 12 / 86, 11 / 87, 7 / 87, 12 / 80, and the box follows it within 0.2 to 0.5 px on average for 1,365 ticks in one run; in the other until tick 974, where x and y renew a frame apart and came in the other order. effects.js advanceRandom / swayDraw.
- `0x86850` / `0x862e0`: `rand` for the count (`0x86ab4`: % |second - first| + first, at most 400, halved for types up to 8) and for each line's distance (`0x863a4`: % |difference| + the lower end), `0xa8f90(-0x8000, 0x7fff)` for the angle. Native run: FCLN 19 for 1,000 ms, FCSP, 500 ms, SSW2: the sway's numbers are those after 29 batches (frames 2 to 58) of 1 + count numbers each. screenfx.js linesDue / linesBatch.
- `0x5baf0` (effect slots, `0x5c800`-`0x5c878`): type, delay, duration and 12 bytes of numbers per slot into the live record; no write to the cycle fields. Native run: a rewind in mid-sway; the box goes on with the cycle it had, stepped by the two long frames of the restore. vm.js restore with effects.js carrySway.
- `0xa8f70` callers `0x3ca00` / `0x3ca10` (quake, -1 to 1 x amplitude), `0x3d6b0` / `0x3d6c0` (MSQK, +-x and +-y), `0x361c8` / `0x361dc` (grain, 0 to 320 and 0 to 180, x -0.25) and `0xb5290` at `0x3d3e4` (a shake's multiplicity): the engine's generator, seeded at launch. The port's spreads are the same; nothing to copy.

