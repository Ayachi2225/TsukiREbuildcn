C_text - story text, text window, text object and glyph engine
================================================================
(findings.md could not be written: the harness refuses .md files from subagents; this is the same content.)

SUMMARY
-------
218 functions: helper 123, platform 48, explicit 21, covered 11, unused 9, divergent 6, missing 0 (the missing
behaviour found lives inside functions counted as divergent: 0x391a0, 0xc0684).
Many of the assigned "text window helpers" (0x2e000-0x2ea70) are screen-effect state (FADE 40/41 RGB split, SHAK/SHAS
shakes, menu backdrop fade, staged-layer commit), and 0xa8d90-0xace40 are save buffer / resource streaming /
graphics device code; they are classified as such.
Scale used below: 640 x 448 view units = 3 px across, 2.41 px down at 1920 x 1080. "Listing" = instruction listing
in data/tsuki/gen/main.

Language: every English-only branch (0x2df20 true: text x 30 not 88, first row y 55 not 65, wrap 584 not 464,
glyph base x0.9, F1109 overriding F1105, no "  " -> U+3000) is not taken by the patched game. 0x53cf0 reads
script_text.mrg pair 2L/2L+1 by language; the patch puts its English in pair 0 and pairs 1-4 hold blank lines, so
the game runs as language 0 (Japan edition). The web's box (left 264 px, width 1392 px) is the Japanese layout,
which is right.

DIVERGENCES / MISSING BEHAVIOUR
-------------------------------
1. Window picture and text are composited as two groups; the picture group is not drawn while the window is closed.
   Native (0x391a0, listing): after b0500, b04b0(0x1d) the window picture (txtwindow / balloon) is drawn into group
   0x1d; b04b0(0x1e) then the page text into group 0x1e. At the end (L_3A6EC, taken only when F1103 = state +0x89e
   is 0) group 0x1d is composited with alpha 572b48 x panel x max(0, 2(fade - 0.5)) x 255; group 0x1e always, with
   the same alpha (x256 fixed point). Inside the groups the picture already carries config[0]/255 x panel (200/255
   for balloons) and each line panel x 2(fade - 0.5) (x dim for earlier lines), so effectively
   picture = panel^2 x 2(fade-0.5), text = (panel x 2(fade-0.5))^2. CLO4 (0x7f898) and CLO5 (0x7f918) only move the
   fade; CLO2/CLO3/FADS-close set F1103 (0x7f3dc, 0x7f86c, 0x60610).
   Web: textbox.js:270-276 draws the picture at panelAlpha x fade (x200/255) even while `closed`, the text at
   panelAlpha x 2(fade-0.5) (linear).
   Visible: CLO4(ms) - native picture and text are gone at ms/2, web picture still at 50% then and fades to ms;
   CLO5(ms) and every message fade-in (18 frames) - native picture invisible for the first half, web rises from 0;
   FADS close / CLO3 - native picture vanishes at once and comes back with the next message, web keeps the picture
   through the FADS (then dips it to 0 at the next message) or fades it over 4 frames (CLO3); fade curves are
   squared natively. Calls: CLO4 978, CLO5 596, CLO3 12,208, FADS with the close argument 85, MSG after a closed
   window 11,445, after CLO4 218.
   Confidence: gate and alphas confirmed in listing; that b04b0/b06c0 are offscreen groups composited with that
   alpha is inferred from their code and other users (0x3fdd0, 0x48760). Fix: in render(), g = panelAlpha x
   max(0, 2(fade-0.5)); panel opacity = closed ? 0 : g x panelAlpha (x200/255); text opacity = closed ? 0 : g x g.

2. Earlier lines of a page dim to 100/255, over the text speed x 1.2 frames, starting when the next line starts.
   Native (0x391a0 page loop, listing ~L_3AA3C-L_3AD70): line j's timer F(859+j) (reset by the scripts' C859 = 0)
   counts frames while the window is fully shown (F1103 = 0, fade = 1) once a later line is current; alpha =
   1 - (155/255) x t/T with T = (F(870+j)+128) x 1.2 = speed(ms) x 1.2 frames (0.7 s at 35 ms, 0.3 s at 15 ms,
   instant at 0), then stays at 100/255 = 0.39. Clicking to finish the current line's typing sets every earlier
   timer to -1 (snap to dim, 0x81b30 memset of F859..). No dimming with "Display whole text" (0xafeba8) or while a
   second balloon is up (F1111 >= 3: target 255). A line ending in @k keeps the state of the line that continues it
   (bright while the continuation is current). Config +0x62 = 1 makes earlier lines dim at once.
   Web: style.css:16-17 dims old segments to 0.6 with a 0.3 s transition; style.css:30 never dims in the F1104
   layout; @k ignored; no snap on click.
   Visible on every page with two or more lines (13,525 pages); 92 @k lines continued by a following MSG dim early
   in the web. Confidence: confirmed in listing. Fix: .seg.old opacity 0.392, transition speed x 20 ms (0 when the
   speed is 0), snap on click-to-finish, keep dimming in the F1104 layout, skip when F1111 >= 3, @k lines dim with
   their continuation.

3. Letter fade-in lasts one letter interval; "Text display" is global; the second option is not about read text.
   Native: per-letter alpha = min(front - i, 1) (0xc0684 listing L_C0880: fminnm(front_left, 1.0), front_left -= 1
   per letter); the front advances 16.667/speed letters a frame (0x3b2d0) in 0x81b30, so each letter fades over
   exactly one letter interval (35 ms at default speed) and the next starts when it is full. 0x3b330's value
   (min(speed x 0.1/35, 0.5) s worth of letters) only sets the trailing front *(0xae05e0), which 0xab710 and
   0xab8e0 receive but never read (s4 unused) - nothing draws with it. "Insta display" (config +0x61 = 1) adds
   0x400000 to every text set through 0xab4d0 / 0x2b460 (story, choices, captions), i.e. bit 0x20 in the object,
   making letters appear at full alpha - regardless of read state. Config +0x62 is read only by 0x391a0 (earlier
   lines dim at once, finding 2); the button atlas btn_base1 has the rows "Fade out" / "Insta erasure" for it.
   Web: textbox.js:217 charFadeMs = min(500, speed x 2.857) ms (100 ms at 35 ms/letter, ~3 letters fading at once);
   vm.js:663-664 picks fadeRead / fadeUnread by the line's read state; ui.js:1096-1100 shows "Fade in / Insta
   display" art for both radio groups; main.js:82-83 documents +0x61/+0x62 as unread/read fade.
   Visible on every typed letter (fade ~2.9x longer; the last letters still fading when the click mark appears).
   Confidence: per-letter formula confirmed in listing; +0x62 = "erasure" likely (code + atlas rows, label art not
   decoded). Fix: charFadeMs(speed) = speed; fadeUnread -> applies to all text; fadeRead -> "Fade out / Insta
   erasure" of earlier lines (rows 6/7 of btn_base1).

4. Typing waits until the window is fully open and no fade-in runs.
   Native (0x81b30 L_81C40/L_81C84, listing): the front only advances while (open = 0 or hidden) or (panel >= 1 and
   rate <= 0) or F1103; otherwise the frame is skipped. A message after CLO3 (panel 0, F1103 set, fade restarted
   from 0 over 18 frames by 0x6e0d0) starts typing ~18 frames later; after CLO5(ms), only once its fade ends.
   Web: textbox.js:529-547 types from the first frame while the window fades in.
   Visible at nearly every scene change: 11,445 MSG after a closed window, 218 after CLO4, plus CLO5-opened lines.
   Confidence: confirmed in listing (function owned by E2; recorded here because it sets the typing cadence).
   Fix: start the add() typing clock once panelAlpha >= 1 and rate <= 0.

5. Window open/close rate.
   Native: 0x2e170(0x80) runs on every story start (0x40cd0, 0x40db0, game reset 0x826f0) and sets *(0x572b50) =
   16.667/128 = 0.1302 a frame; 0x38d40 opens and closes the panel at that rate (7.7 frames); CLO3's 0.26041666 is
   exactly twice it. 0.06 is only the static data value before the first story start.
   Web: textbox.js:257-258 0.06 a frame (16.7 frames). Every window open/close (12,208 CLO3, scene starts).
   Confidence: confirmed in listing (only writer of 0x572b50 is 0x2e170; all three callers pass 0x80). Fix: 0.1302.

6. F1104 ("novel" pages) only hides the window picture.
   Native: F1104 (+0x8a0) is read by 0x391a0 once - `cbnz w8, L_398E0` skips the picture; text font, scale 0.76,
   box (x 88, wrap 464), rows from y 65, line dimming and click mark are the normal window's. The page's vertical
   place comes from the scripts' blank rows (e.g. 00_02 ops 78-81: WKAD C847 1 x4).
   Web: textbox.js:393-402, 579-582 and style.css:14,30 switch to Times 50 px, letter-spacing 4 px, a 202-1718 px
   box from y 226 with placePage centring, and no dimming.
   Visible on 2,160 messages / ~674 pages in 84 scripts. Confidence: confirmed in listing (all readers of +0x8a0
   checked). Fix: keep the normal text style in this mode; hide only #panel; drop placePage.

7. MSAD after a closed window does not start the 18-frame fade-in.
   Native 0x6e950 only clears F1103 (no fade/rate change, no 0xae0940 page clear); text then shows with the panel
   (0.13 a frame). Web: vm.js:644-647 calls beginMessage() for MSAD too (fade 0 -> 1 over 18 frames). 123 MSADs
   follow CLO2/CLO3/FADS-close. Confidence: confirmed in listing. Fix: for MSAD only clear `closed`.

8. @t: two parts of a line type out at the same time.
   Native: bdc2c case 't' stores the letter index at +0x18d90; 0xc0684 (second branch, listing L_C08C8) then types
   the part before and the part after it in parallel, finishing together. Text 23613 ("Shut up, Shiki!" / "Tohno-kun,
   be quiet!"), 36678, 9328. Web: textbox.js:174 drops @t; the parts type one after the other. 3 lines.
   Confidence: confirmed in listing (exact rates not derived). Fix: split at @t and run two typing fronts.

9. @x glues a message to the previous row.
   Native: bdc2c case 'x' emits code 0xc; 0x391a0's page layout (0xa88b0 -> 0xc0db0) continues the line from the
   previous end x (+2 units). Web: vm.js:635 strips @x and MSG starts a new row. 7 messages (15_01B_CIEL15B_1
   8051/8093, 05_01_CIEL05_1C 4009/4024, 10_01_CIEL10_5B 1158, 09_00_ARC09_1 390, 07_01_CIEL07_6 539).
   Confidence: likely. Fix: treat MSG "@x..." as inline.

10. F1110 overlay picture (missing).
   Native (0x391a0 tail, listing ~1362): while F1110 >= 1, after 3,500 ms (0xafec70 >= 0xdab) a full-screen DISP_PARTS
   picture, slot 121 (texture 69), fades in at 1/36 a frame; it fades out the same way when F1110 is 0. Drawn even
   with the window closed. Web: F1110 not handled. QA_20 ops 1495-1535 (one Ciel-sensei page).
   Confidence: mechanism confirmed in listing; texture name not identified. Fix: show that texture with that timing.

11. Click mark details (minor).
   Native 0x391a0: the line mark sits at end y + 3.5 units, the page mark at + 5.5 (4.8 px lower); 0x38ec0's frame
   counter 0x572b60 runs on across marks and kinds. Web main.js:107-119 / style.css:54-57: same y for both,
   animation restarts at cell 0. Already noted as left in ANIMATIONS.md (counter). Confidence: confirmed in listing.

12. SHAF (latent).
   Native SHAF with no argument (all 397 calls) runs 0x2e560(0,0,0,0): it resets the text-window movement state
   (0xafeb98/9c, 0xafec04-34) and not MSQK's *(0xae05c0). Web vm.js:521 clears textShake (MSQK). No script has SHAF
   while an MSQK runs, so nothing visible today. Fix: make op_SHAF a no-op (movement is never started).

Checked and matching: CLO2/CLO3/CLO4/CLO5 state logic (apart from 1 and 5), MSG's 18-frame fade-in and deferred page
clear, @e/@n/whole-text waits (@n waits for typing, not click or voice - same as web), VPLY voice start with the line,
colour marks (0xa7f60, 0xbdc2c, 0xc3c24), inline tags and dash runs (0xbdc2c turns 2+ dashes into one stretched
glyph), MSQK (0x39110), click mark kinds/cells/scale/fade-in, balloon table placement (text offsets are 1280 x 720
units like x/y, widths 640 units - as the web uses them), wrap width 464 / balloon widths (0x39050), notice popup
(0x3b430/0x3b4b0), RGB split presets (0x2e280/0x2e430 vs screenfx.js SPLIT).

Deliberate (not divergences): proportional host fonts instead of TsukuMin-D cells (0xab0f0, 0xbf0f8, 0xc4dd8,
0xc471c, 0xc5610), kinsoku sets (0xa7790), proportional centred ruby (0xc1fdc), CSS shadow instead of the engine's
drop shadow (0xc5fb4, offset parameters +0x18a58/+0x18a5c x 1.5 px).

UNUSED NATIVE CODE
------------------
- Screen effects never reached by the scripts: FADE types 3-5 / 10 (0x2e260, 0x2e270), shake presets for FADE 0-2/7
  and SHAS (0x2ea70), SHAK (0x2e690, 0x2e7b0, 0x2e7c0), SHAF(ms) ease-back (0x2e9d0). Scripts use FADE 40/41 only
  and SHAF without arguments.
- Text object features no text uses: per-letter wobble via @a1/@a2 (0xc0e4c), ruby style 1 (0xc1080: every object
  is made with style 2, param byte 0x18a93 = 2).
- Paths inside used functions: English layout (0x2df20); per-line read-text colour 0xdc6d / table colours (config
  +0x18, never written by the config UI); speaker name plates (buffer 0xae08e0 is never filled: drawn as text object
  14 at scale 0.5 and above page lines); F1102 fixed-scale text and F31/F32 text scaling (never set); F988 fixed
  speed 0.675; the F822 = 0 full-screen backdrop layout (only before START_SCRIPT/ARCHIVE set F822); outline face
  from config +0x14 (always 0).

LIMITS
------
- Group compositing (b04b0/b0500/b0530/b06c0) was read from their code and other callers, not from the display-list
  executor; the +302.81-unit y offset at which group 0x1e is composited (and 0x1d when F822 != 1) was not resolved.
- Native row pitch, glyph size and drop-shadow colour were not converted to pixels (deliberate proportional layout).
- Config +0x62's on-screen label not decoded from the label art; "Fade out / Insta erasure" inferred.
- F1110's texture (DISP_PARTS_JA texture 69) not named: the base RomFS needs pycryptodome, not available under -I.
- The patched game's language 0 is inferred from script_text.mrg (English in pair 0, blank pairs 1-4) and the Japan
  edition; the NACP's supported languages were not read.
- 0x81b30 (typing driver) and 0x802c0 belong to E2; only the parts setting text cadence were read.
- @g/@h (codes 0x14/0x15, 131 lines) are no-ops in the layout 0xbf0f8; other consumers were not traced.
- No browser checks were made (brief).

## Re-check of the handled functions (2026-11-08)

32 functions of this part compared with the port: 11 the same, 20 different, 1 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-18: The port pops up 'Skip', the game never does (medium, confirmed)

Functions: `0x3b430`.
- Native: No caller passes a kind that selects rect 0 (8,200 'Skip'): kind 0 means hide, and the skip toggles (0x40ed0 listing 0x41e68 eor #2, the mode panel's 6) have no 0x3b430 call. The six callers are all direct; the atlas row is unused.
- Port: main.js:340 setSkip: popup('skip') (POPUP_CELLS skip [8, 200]) when skip is toggled on (key, panel, menu); not while the fast-forward key is held (vm.fastForwardHeld, main.js:729).
- Effect: Turning fast forward on shows a 'Skip' banner at the top left that the game does not show.
- Reached: Every skip toggle in play.
- Second reading: Native holds: 0x3b4b0 draws rect kind x 8 + 0x572b74; rect 0 is (8,200) and the atlas row there reads 'Skip'. 0x3b430 clamps kinds to 1-3, kind 0 hides, its six direct callers pass 3,2,2,2,3,1 and no relocation points at it; the skip toggle at 0x41e68 has no call. Port: main.js:340 pops up only when skip is toggled on; the held fast-forward key (main.js:729 sets vm.fastForwardHeld first) shows nothing, as in the game.
- Fix (2026-11-08): main.js setSkip makes no notice for skip (no caller passes the Skip row; 0x3b430 clamps kinds 1-3 and the skip toggles make no call).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames: R at a wait starts the skip and nothing shows at the notices' place (0, 77), where the Auto notice had shown when L was pressed in the same run.
### N2-19: @e@n waits for the voice natively (medium, confirmed)

Functions: `0x6e0d0`.
- Native: The copy scan (listing 0x6e1dc-0x6e294) stops at the first @e or @n: '...@k@e@n' ends at @e, w22 = 2, the voice bit 4 is set (0x6e744, not for @n) and no click is waited for: the script waits until the line is typed and its voice has ended. The @n after it is never looked at. MSAD's scan (0x6ea58) does the same.
- Port: vm.js:926 parseMessage: noWait = /@n/.test(s) and noClick = /@e/.test(s) are both true; vm.js:989 'if (noWait) return' comes first, so the message returns once typed and the next VPLY + MSAD stops the voice (audio.js playVoice).
- Effect: Each part of these split voiced lines is cut off as soon as its text has typed, and the next part starts over it.
- Reached: 18 ZM and 2 MSAD commands, all voiced (raw scripts survey): 14_01B_02_CIEL14B_2B ops 2729-3320, 14_01B_02_CIEL14B_2C, _3, _3B, _4, 14_01B_03_CIEL14B_4_1, _4_1D, _5.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js parseMessage: the first of @e / @n in the argument decides, so $id@k@e@n waits for its voice and no click.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run: $id@k@e@n with a 3.42 s voice; the MSAD after it comes 203 ticks (3.38 s) after the line's first letter, with no press. The port, in real time: 3.43 s.
### N2-20: @g lines use the game's second typeface (medium, confirmed)

Functions: `0xbdc2c`.
- Native: Case 'g' writes code 0x14 once and the end of the text writes 0x15. Tag processor 0xdd334 case 0x14 calls 0xcb74c(manager 0xae0d50, 0), which maps face slot 0 to font 1 (table {1,0,2,...}). 0xab0f0 loads fonts from SYSMES(0), SYSMES(0)+'2', SYSMES(0)+'3' in that order, so font 1 is romfs/ja2/TT_TsukuGo-D.ttf; despite the file name it is a slanted copy of the patched TsukuMin-D (name table TT_TsukuMin-D; all 94 ASCII glyphs sheared by 0.31, CJK glyphs byte-identical).
- Port: textbox.js:178 skips @g with no effect (textbox.js:124 calls it the start of a paragraph); every line uses --story-font (style.css:15).
- Effect: The 131 lines that start with @g (for example the chase scene, text 4478-4525, 'That is, until I cross paths with her.') are set natively in italics (ASCII letters slanted 0.31 in the same font); the port draws them upright like any other line.
- Reached: 131 lines of text.json, all with @g at position 0, none with @h.
- Second reading: The code path holds (case 'g' 0xbeb64 writes 0x14 once, end of text 0xbf0bc writes 0x15, 0xdd334 case 0x14 -> 0xcb74c(m,0) = table {1,0,2,...}; 131 lines, all at position 0, no @h; port skips it at textbox.js:178). The font is wrong: 0xab0f0 loads SYSMES(0), SYSMES(0)+'2', SYSMES(0)+'3' in that order (not an inference), and the patch's ja2/TT_TsukuGo-D.ttf is not a gothic: its name table says TT_TsukuMin-D, all 94 ASCII glyphs are the patched TsukuMin's sheared by 0.31 with no other change (CJK byte-identical), so the @g face is the same font in italics. text.md:140's 'deliberate' note covers host fonts instead of cells, not this.
- Fix (2026-11-08): textbox.js parseMarkup: @g sets the rest of the text italic (the game's second face, the patched TsukuMin sheared by 0.31; the port's story font in its italic).
- Compared: Compared with a native frame (text 4478).
### N2-21: Balloon messages use the game's third typeface (medium, confirmed)

Functions: `0xbdc2c`.
- Native: 0x6e0d0 (0x6e5f4) and 0x6e950 (0x6ec24) pass flag 0x800000 when the window style is a balloon (0x39010, F1105 >= 3); 0xa7790 turns it into param_4 bit 6; 0xbdc2c writes code 0x18 first and 0x15 last (listing 0xbde4c, end of text); 0xdd334 case 0x18 calls 0xcb688(manager, 0), which maps face slot 0 to font 2 (ja3/SeuratPro-M.otf by directory order). 0xc445c lists the glyphs in +0x148e0.
- Port: textbox.js setWindow only places the balloon (class balloon has no rule in style.css), so balloon text uses --story-font (Georgia). NATIVE-PARITY.md:101 records only the story text's monospaced TsukuMin as not adopted.
- Effect: Text in the balloons (the Q&A corners) is natively in the third face, a different look from the story window; the port shows it in the story serif.
- Reached: 53 scripts set F1105; values 3-32 are set 621 times (WKST(F1105,eq,5) alone 96), against 54 for values 0-2.
- Second reading: confirmed.
- Fix (2026-11-08): style.css: #text.balloon uses the game's third face (/rom/ja3/SeuratPro-M.otf) set proportionally as the story text is; textbox.js moves the balloon's text box by (-3, -11) px so its rows sit where the game's do.
- Compared: Compared with native frames (balloon styles 3 and 5: first row within 1 px, second within 2 px).
### N2-22: Runs of U+25A0 are not one bar (medium, confirmed)

Functions: `0xbdc2c`.
- Native: A run of two or more U+25A0 (0x3c99bc) becomes code 0xd, the count, the game font's U+00BD glyph (U+00BC when outlined; 0x3c99c3 / 0x3c99c0) and code 6: one glyph stretched over the run. A single U+25A0 stays as it is.
- Port: Neither textbox.js nor style.css handles U+25A0: each is its own letter in the story font or a fallback.
- Effect: Censored words ('I would have ■■■ it right away.') are one stretched glyph in the game and a row of separate squares in the port.
- Reached: 101 runs of two or more in 88 lines of text.json, longest 8.
- Second reading: confirmed.
- Fix (2026-11-08): textbox.js: a run of two or more U+25A0 is one element (.blockrun, a solid bar BLOCK_CELL em a square), one letter of the typing.
- Compared: Compared with a native frame (text 249: three squares, one bar 141 px by 35 px; the port's bar scaled to its font).
### N2-8: Opacity of the >> while skipping runs (low, confirmed)

Functions: `0x3b5b0`.
- Native: While skipping actually runs (flag *0xae0670 set by the toggle at 0x418f4 or ZR at 0x41d8c) the state ends as 3: the >> icon at full alpha (0x41fd0-0x41fdc). 5 (0.6) is set while the toggle bit is on (0x41010) and whenever the flag is on at unread text with fast forward on Read (0x41944-0x41948, which clears the flag), so it stays while the toggle waits at unread text and while ZR is held at unread text; 4 (>>|) only in the read-scene countdown.
- Port: style.css:203-204: the toggle shows >> at 0.6 while skipping too, and ZR held (setSkip(true, true), main.js:729, 758) shows >>| at full alpha.
- Effect: The fast-forward indicator is dimmer than the game's while skipping with the toggle and shows the wrong arrow while the button is held.
- Reached: Every use of fast forward. ANIMATIONS.md:673-675 lists 'the rewind states 1-3' as left because the port's rewind is instant, which covers states 1 and 2; state 3 is named there by mistake (it is the forward icon) and the reason does not apply to it.
- Second reading: 0x41fd0-0x41fdc: state 3 when the per-frame skip flag is on and not rewinding; alpha 0.6 only for state 5 (0x3b7fc-0x3b824); rects 0x572b12: 3 and 5 are the same >> cell, 4 is >>|; 4 only at 0x41138 / 0x41370 in the countdown. style.css:203-204 and main.js:729, 758 as stated, so the difference is real. Two details are wrong: 0x41944-0x41948 sets 5 whenever the flag is on at unread text on Read, and ZR reaches it too (0x41d8c -> 0x4192c), so 0.6 is not toggle-only; and ANIMATIONS.md:673-675 does list 'the rewind states 1-3 (the port's rewind is instant)' as left. That note misnames state 3, the forward icon (ANIMATIONS.md:669 '3 forward', x 626.67 at 0x34dbe4), and :669 calls 5 'plain skipping', so it is a misreading rather than a recorded choice.
- Fix (2026-11-08): style.css: #mode-skip.on is solid; 0.6 only with .paused, which main.js frame sets while vm.skipPaused (stopped at unread text, toggle or ZR).
- Compared: Listing and tests; no native frame of the indicator was compared.
### N2-10: Notice popup speed (low, confirmed)

Functions: `0x3b4b0`.
- Native: 0x3c970 listing 0x3eb34-0x3ebe4: t += 0.04 x max(1, frames) a frame when the frame step (0xad1c0, 1 when one main-loop tick has passed, 0xad180) is 1; 0.1 only when it is above 1. State 1 grows to t > 3 (75 frames), then state 2 with t = 1 shrinks at the same rate (25 frames).
- Port: main.js:66 t += (closing ? -0.1 : 0.1) * dt: 0.1 a frame (30 and 10 frames). ANIMATIONS.md repeats 0.1.
- Effect: Quick Save, Auto Save and Auto banners spring in, hold and leave in 40 frames instead of 100.
- Reached: Every popup.
- Second reading: confirmed.
- Fix (2026-11-08): main.js popup: t moves 0.04 a frame (25 frames in, until t passes 3, 25 out).
- Compared: Listing and tests; no native frame.
### N2-80: Choice rows type at the last message's speed (low, confirmed)

Functions: `0x3b2d0`.
- Native: 0x84e50 (listing 0x85068) reads slot 1, whose flag is only ever 0 (0x77790 listing 0x80048-0x80050; static 0), so the rows' typing front uses config +0xe.
- Port: ui.js:2170 new ChoiceFx(..., ChoiceFx.perFrame(this.text.speed)): text.speed is the last message's read or unread speed (vm.js:969).
- Effect: After a read line, choice labels type at the read speed (15 ms a letter by default) instead of 35 ms and become selectable sooner.
- Reached: 170 SELD calls in 100 scripts, on any replay of read text (read and unread speeds differ by default).
- Second reading: Native holds: 0x85068 passes slot 1 to 0x3b2d0; the only writer of slot 1's flag is 0x80048-0x80050 with 0 (the three others, 0x5b020, 0x5cf14, 0x6e334, are slot 0), 0x572b68 is 0 in the image, so the rows use config +0xe (default 35; +0x10 is 15). ui.js:2170 uses text.speed, set from read / unread at vm.js:969, and ChoiceFx only reaches its selectable state once typed. Only the count is off: 170 SELD commands in 100 scripts, not 100 (100 is the number of scripts).
- Fix (2026-11-08): ui.js: choice rows always type at the unread speed (config +0xe; slot 1's read flag is only ever written 0).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native runs say otherwise. With unread 100 ms and read 250 ms a letter the rows took 250 ms a letter after read lines and after unread ones; with read at 60 ms they took 60 (3.6 frames a letter): the rows type at the read speed (config +0x10) whatever the lines were. Where slot 1's flag becomes 1 was not found in the listing (0x80050 stores 0). Corrected: ui.js types the rows at vm.readSpeed. Also from those frames: the rows' front has two steps on the choice's first frame and a letter is out once the front is past it (letters 0, 2, 9 and 13 frames after the first at 60 ms), and the labels are whole from the first frame, not faded in (uifx.js ChoiceFx).
### N2-106: A preset change while the split is on takes its new strength at once (low, confirmed)

Functions: `0x2e280`, `0x2e3e0`.
- Native: 0x2e280 writes the amplitude 0xafebf8 only when 'was off' (the store at 0x2e3b4 is behind tbz w1, #0 at 0x2e38c); while on it stays at the old preset's value until 0x2f910's next step, every sixth frame (0x2fab4 -> 0x2fbc8), which then uses the new strength.
- Port: screenfx.js:48 splitSample takes SPLIT[s.preset] on every sample, and startSplit (screenfx.js:29, vm.js:1472) changes s.preset at the command, so the amplitude changes on the same frame.
- Effect: The split's offset differs for up to 5 frames after the FADE, once in the game: by up to about 3.1 px red and green and 6.2 px blue if the change falls in the split's first 3.3 s (the wobble lap), at most 1.2 px and 2.4 px after it (at 1920 wide).
- Reached: Only 13_00_ARC13_3: FADE(40,0,11) then FADE(40,0,12) with no FADE 41 between (strength 3.1 -> 2.5). The other on-to-on changes (ARC02_1 16/1/2/3/4, ARC05_9_2B 5/5, CIEL13_4_1 14/15, ARC13_5 blank) keep the same strength and wobble.
- Second reading: Duplicates c219 (same divergence); native and port as stated, 13_00_ARC13_3 is the only on-to-on change with a different strength (presets 1-5, 14-16 and blank all give 3.1/200 in 0x2e280's table). The 'at most about 3 px' is the red and green figure at the first lap's peak; blue moves twice as far.
- Fix (2026-11-08): screenfx.js startSplit keeps the old preset for strength until the step after the change (every sixth frame).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames, every present, of a grey screen with a white box: FADE(40, -60, 13) one frame into a step of a split made with preset 8 darkens the screen on that frame (the new level) and leaves the fringe at its width (10.3 px for blue) for the five frames left of the step; the next step has it at 4.8 px (1.5 / 3.5 of the old strength). The port's frames show the same order. The split's offset at each of its first 34 steps is within 0.1 px of screenfx.js's.
### N2-107: Restore restarts the split instead of continuing it (low, confirmed)

Functions: `0x2e430`.
- Native: 0x5baf0 calls 0x2e430(F1100): with 4 it zeroes 0xafebe8, 0xafebec, 0xafebf0, 0xafebf4, the flags 0xafeb94/95, sets the angle to 30 and the amplitude to the preset's first value, so pulse, wobble (first lap again) and sweep start over; alpha 0xafec00 is not in the record: it becomes 1 only when F1120 != 0x7f, otherwise it stays at the running value (0 after a fresh boot) and rises 1/60 a frame. With 0 (split off or fading out at the record) the mode goes to 0 at once, alpha left as it was.
- Port: vm.js:1664 saves gfx.split with its times and vm.js:1749 rebaseTimes puts it back, so start, alphaAt and end continue exactly where they were (screenfx.js:43 splitSample): same phase, same alpha, a running fade-out goes on.
- Effect: After a load, rewind, Quick Jump or Return to Previous Scene inside a FADE 40 split the native pulse and swing restart from their beginning (with the large first-lap wobble for 200 frames); a level-0 split loaded in a fresh session fades in over 60 frames where the port shows it at once; a point saved in the 60 frames after a FADE 41 shows no split natively where the port finishes the fade.
- Reached: 132 messages sit inside FADE 40 ... FADE 41 spans in 15 scripts (raw scripts survey); 22 of the 28 FADE 40 calls have level 0.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js restoredSplit: a restore restarts the split (counters from zero; alpha 1 if the level is not 0, else it goes on from what it was); a split that was fading out is off.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames: a rewind 6 s into a split puts the offset back on the first lap's series from its start (1.2, 2.2, 3.4, 4.6 ... 17.3 px), the same numbers as a fresh FADE 40 and as the port's after its rewind. The two side cases (a level 0 split after a load in a fresh session, a save made in the 60 frames after FADE 41) were not run.
### N2-108: Split left on across a new story (low, confirmed)

Functions: `0x2e430`.
- Native: 0x3c550 (0x48ac0 listing 0x48c7c and 0x49034, 0x826f0 at 0x829a8) stores 0 in the mode 0xafebfc at every story start and load, and 0x826f0 zeroes the variable block, so the split never survives into another story.
- Port: main.js:377 startAt and main.js:538 toTitle call vm.clearAnimations (vm.js:374), which clears gfx.shake and textShake but not gfx.split; gfx.split is only assigned in vm.js:1472-1473 and vm.js:1749.
- Effect: Leaving the story during a split (Return to Title, or a gallery replay ending inside one) and starting New Game, a chapter or a replay keeps the RGB split on the new story until its next FADE 41 or a load.
- Reached: Any of about 169 messages inside a split (163 ZM + 6 MSAD, linear walk of the raw scripts), then Return to Title and New Game or a replay; 13_00_ARC13_3 also ends with the split still on.
- Second reading: Native holds: 0x3c550 listing 0x3c938 writes 0 to 0xafebfc, and 0x48ac0 calls it at 0x48c7c and 0x49034, 0x826f0 at 0x829a8. In the port gfx.split is only assigned at vm.js:1472-1473 and vm.js:1749 and clearAnimations (vm.js:374) leaves it. Only the count is off: a linear walk of the raw scripts between FADE 40 and FADE 41 gives 163 ZM + 6 MSAD = 169 messages, not 132; 13_00_ARC13_3 does end on (FADE 40 at op 1379 of 1448).
- Fix (2026-11-08): vm.js clearAnimations clears gfx.split at every new story.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run: Return to Title from a page inside a split (blue fringe 6.5 px on the last frame), then New Game: the new story's first 94 frames, up to its own FADE 40, show the box at exactly 288 px in all three channels.
### N2-109: SHAF stops a running SHOK (low, confirmed)

Functions: `0x2e560`.
- Native: 0xafec04 / 0xafec1c / 0xafeb9c are SHOK's state (0x2ee70 writes mode 1, the frame total and the flag; 0x2ef30 runs it). 0x2e560 sets 0xafec1c = 0 and 0xafec04 = -1, so the next 0x2ef30 zeroes the shake offsets 0xae0580/0xae0588 (listing 'if (0xafec1c == 0)'). The deferred start 0xafec58 is not cleared.
- Port: vm.js:778 op_SHAF does nothing; gfx.shake (vm.js:1457) runs to its end. The comment there and FIX-CHECKLIST T12 say no script starts this state, but SHOK does.
- Effect: A screen shake still running when the next scene's SHAF comes ends at once natively and runs on in the port for its last frames.
- Reached: Walking the raw scripts from each SHOK (WTTM and FADS times, following JUMP): 1 place with no player input (14_01B_02_CIEL14B_3B op 6748, last 100 ms, into 14_01B_02_CIEL14B_3C), 8 more when the reader clicks a line within 67-750 ms (05_00_ARC05_9_2, 05_01_CIEL05_1E, 05_01_CIEL05_1_1B, 08_00_ARC08_1_3, 08_00_ARC08_8_2, 09_01_CIEL09_6, 14_01B_01_CIEL14B_1G, 14_01B_02_CIEL14B_4).
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_SHAF ends a running SHOK; a delayed one still in its slot is kept.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames with a clock on screen: SHOK(20, 0, 300, 20) shakes a picture by up to 50 px; SHAF 90 ticks later leaves it still on its place from that frame, where the same SHOK left alone runs its 360 ticks. The port's shake ends on SHAF's frame too.
### N2-110: pageEnd is cleared after a page's wait but F799 stays 1 for the MSAD that follows (low, confirmed)

Functions: `0x38ea0`.
- Native: F799 keeps WNTY's value until the next WNTY. 0x6e950 at 0x6e97c: F799 == 1 means a normal click wait even with Display whole text; 0x81b30 (0x81ed0 / 0x81fac) uses config +0x5c (auto page, 3000 ms) when F799 == 1, otherwise +0x1c (2200 ms).
- Port: vm.js afterWait (line 1829) sets this.pageEnd = false after the ZM's click, so vm.js:977 and vm.js:1033 see false at the following MSAD: autoClick is used, and with Display whole text on the message goes on without a click.
- Effect: QA_20, the voice-only _MSAD() at op 1943: auto mode goes on after 2.2 s instead of 3 s (defaults), and with Display whole text on the game waits for a click where the port does not. The mark is the same (F1105 = 7, the balloon mark ignores F799).
- Reached: Survey of 1,492 MSAD: 1 has a previous message that waited for a click, last WNTY 1 and no WNTY of its own (QA_20 op 1943); the other 1,188 without an own WNTY follow an @n message or have WNTY 0, where the two agree. QA_20 is scene 552 of the QA menu.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js: pageEnd (F799) is no longer cleared at the page's click; only WNTY changes it, so an MSAD that follows counts as a page end.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run in auto mode (waits 2200 / 3000 ms): a line with WNTY 1 and @k waited 181 ticks, and the MSAD after it 177-180 ticks before the page turned (a plain line 135, a page's last line 180). The port's frames, letter to letter: 185, 187, 135-138, 186 against the game's 187, 182 + 7, 141, 185.
### N2-111: The page mark blinks off for its last cell (low, confirmed)

Functions: `0x38ec0`.
- Native: Kind 1's rectangle table 0x5730a0 (static, 105 x 8 bytes) has entry 104 = (4017,0,4056,39), the same as entry 103, so the sheet's last cell is never shown; kinds 0 and 2 (0x5733e8, 0x572ec8) are plain strips.
- Port: style.css:56-58: #click-mark.page uses markstep 3.5s steps(105) to -4422.6 px, whose last step is -4380.48 px, sheet x 4056-4095. That cell of pageBreak_a.webp is empty (alpha sum 0; cell 103 is 117174).
- Effect: The page-end mark disappears for 2 frames (33 ms) at the end of every 3.5 s loop; in the game it stays on screen.
- Reached: Every page-end wait longer than about 3.4 s outside balloons (15,761 WNTY(1) in the scripts).
- Second reading: confirmed.
- Fix (2026-11-08): style.css #click-mark.page: keyframes markpage show the sheet's cells 0-103 and repeat 103 as the loop's last cell (table 0x5730a0 entry 104).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames, every second present, of a page mark held for 5.8 s: it comes in over ten frames and is never off; over the end of its 210-frame loop its ink stays between 63.8 and 65.4 (thousands of levels), where an empty cell would read 0.
### N2-112: Read speed after a restore (low, confirmed)

Functions: `0x3b2b0`.
- Native: 0x3b2b0(0, 1) in 0x5baf0 (0x5cf14) runs when a type-0 record is rebuilt, only with param_2 != 0: the rewind 0x814c0. Load, Return to Previous Scene (0x5d950) and Quick Jump (0x28d50) pass 0: the record's MSG runs again and sets the flag from its read state (0x6e334). 0x5afc0 (0x5b020) writes flag 1 for type-7 records (ATSV 1) and the instant run's ATSV, but no script has an MSAD as the next text after an ATSV. So after a rewind an MSAD that is the next text types at the read speed (config +0x10).
- Port: vm.js:969 sets text.speed only in message() for MSG; vm.js restore does not write it, so after any restore an MSAD uses the last value: the last message's speed, or settings.textSpeed (main.js:796 -> :94) in a fresh session.
- Effect: After a rewind to a page's first line followed directly by an MSAD, the MSAD types at the read speed (15 ms a letter by default) natively; the port uses the speed of the last message typed (35 ms when that one was unread). After a load, Quick Jump or Return to Previous Scene the native MSAD follows the re-run MSG's read state; the port keeps the speed left over (unread speed in a fresh session), so they differ only when that MSG counts as read.
- Reached: 25 of 1,492 MSAD commands follow a message without @n: 23 wait for a click, 2 are @k@e (14_01B_03_CIEL14B_5B ops 3497 and 3751) and go on by themselves. 8 of the 25 are a page's first line (linear F823 <= 1), the only records 0x814c0 rewinds to, e.g. 01_00_ARC01_2_1 ops 897 / 904; only on the first text after the restore.
- Second reading: The flag write in 0x5baf0 is on the type-0 rebuild path, behind param_2 != 0 (0x5cce8-0x5ccf0: cbz to 0x5d300), and only the rewind passes 1 (0x817b4, 0x81878, 0x818e4); 0x5d950 (load, Return to Previous Scene) and 0x28d50 (Quick Jump) pass 0, so the script pointer stays on the MSG (record +8, 0x5bb98-0x5bbb0) and the re-run MSG sets the flag from its own read state (0x6e300-0x6e334). So the load example is wrong. The survey count holds but 2 of the 25 are @k@e (no click), and only first lines of a page can be rewound to (0x81734). text.speed is written only at main.js:94 and vm.js:969, so a load in a running session keeps the last message's speed; settings.textSpeed applies only in a fresh session (boot call main.js:796).
- Fix (2026-11-08): vm.js restore: text.speed is the read speed after a rewind (0x3b2b0(0, 1)) and follows the message's read state after a load or Quick Jump.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native runs, unread 100 ms and read 250 ms a letter. After a rewind onto a page's first line the line types again at 250 ms and the MSAD after it at 250 ms. After Quick Save, three lines on and Quick Load, the line is typed again at 250 ms (it is read by then), its MSAD at 250 ms, and the next page's line, not read yet, at 100 ms. The port's frames give the same three speeds (15, 15 and 6 frames a letter).
### N2-113: Popup scales from its vertical centre (low, confirmed)

Functions: `0x3b4b0`.
- Native: 0xb6de0 flags 0x10: anchor (0, 0) (tables 0x3c9810 / 0x3c9840: top-left), so the scale pivots on the top-left corner at (0, 77 px).
- Port: style.css:224 #popup transform-origin: 0 50%.
- Effect: While the spring's y scale is off 1 (1.4 to 0.8) the banner's top moves by up to 11 px instead of staying at y 77.
- Reached: Every popup, in its first frames.
- Second reading: confirmed.
- Fix (2026-11-08): style.css: #popup transform-origin 0 0 (0xb6de0 flags 0x10: top left).
- Compared: Listing and test; no native frame. Compared with the game 2026-11-09 (TODO item 51): Native frames of the Quick Save notice (its top is under the mode panel there): the bottom edge runs 135, 127, 123, 127, 130, 133, 136, 135, 133, 132 px on every second present, the port's 135.6, 127.2, 123.1, 127.2, 130.4, 133.7, 136.2, 135.4, 134, 133: 77 + 56 x the spring's y scale, the top staying at 77. About 98 presents on screen; the port 101 frames.
### N2-114: A blank message takes no row in the port (low, likely)

Functions: `0x6e0d0`.
- Native: MSG sets the (empty) text on the line's own text object at row F823 and the MSAD that follows re-sets it with its text (0x6e950 appends to the raw copy), so the text starts on a new row.
- Port: vm.js:980 'if (text)' skips textbox add for an empty message, and the following MSAD's inline add (textbox.js:754) joins the previous line.
- Effect: The MSAD's text runs on from the previous line instead of starting its own row.
- Reached: 2 places mid-page: 01_00_ARC01_9 ops 598 / 605 ($002448 blank, then $002449) and 10_00_ARC10_4 ops 980 / 986 ($025041 blank, then $025042); the blank lines at the top of a page (13_01_01_CIEL13_4_1) are unaffected.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js message: a blank MSG adds an empty line, so earlier lines dim and the MSAD after it goes on its row.
- Compared: Compared with a native frame (texts 2447-2449: the MSAD text is on a row of its own).
### N2-115: Two-frame hold before typing starts (low, confirmed)

Functions: `0xa7790`.
- Native: Listing end of 0xa7790: 0xc3834(obj, 2) sets +0x108c8 = 2 unless flag 0x1000 is set; while it is above 0, 0xa8240 returns 0 and 0xab710 writes that back as the front (0xae05d8), and 0xc0684 counts it down, so letters do not start for two frames after each text is set.
- Port: textbox.js:776 run.front starts at 0 and type() advances it from the next tick with no hold.
- Effect: Each line set by MSG (ZM) on a window that is already up starts about two frames (33 ms) earlier than the game's. MSAD continuations and lines on a window still fading in are unaffected.
- Reached: ZM lines on an open window (most lines); not the 1285 MSAD commands.
- Second reading: The hold is real: 0xa7e28-0xa7e6c sets +0x108c8 = 2, 0xa8240 returns 0 and 0xab7e0-0xab814 stores it as the front, 0xc0684 (0xc06b4-0xc06c4) counts down, and textbox.js:776 has no hold. But flag 0x20000 branches past it (0xa7e00 -> 0xa7e44 -> 0xa7e70) and MSAD always passes 0x20000 (0x6ec2c-0x6ec30), so MSAD text has no hold; and typing is gated until the window is up (0x81c40-0x81c84; textbox.js type() the same), so a line on a window still fading in loses nothing to the hold.
- Fix (2026-11-08): textbox.js: a new MSG line waits two frames before typing (0xc3834, counted down every frame by 0xc0684); an MSAD has none.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames of a test scene, every present, with a clock on screen: the two frames are not what shows. After a click the line before dims and the mark goes on one frame, and the new line's first letter is there on the next; at 250 ms a letter the letters come 1, 16, 31 and 46 ticks after that frame. Corrected: textbox.js shows nothing of a new line on the frame it is set and starts the front from 0 on the frame after (firstFrame); on a window still closed nothing takes the first frame's step back, so with "Insta display" the first letter is there as the window fades in. The port had come in two to three frames late.
### N2-116: Row volume 0 plays no voice, so voice waits pass (low, confirmed)

Functions: `0xaa970`.
- Native: 0x6e0d0 at 0x6e6c8 tests only the speaker's bit in config +0x24, sets snd+9 = row x switch / 100 = 0 and calls 0xaa970 -> 0x9c300 -> 0xee6b4 with volume 0, which starts the stream with no volume test; record state 1 until the handle goes idle, so 0x9c400 is busy for the voice's length (VCWT 0x77f9c, wait bit 2 at 0x80328, auto mode 0x803e4).
- Port: audio.js:674-676 playVoice: gain = characterGain(rowOf(name)), and the job returns at gain <= 0 with no node, so voicePlaying is false once it settles; vm.js:1077 op_VCWT, :992 and armAuto's voiceDone do not wait.
- Effect: With a character's slider at 0 and the row not muted, scripted VCWT waits, @e waits and auto mode do not last the silent voice's length for that character's lines.
- Reached: Slider minimum is 0 (ui.js:1474; config +0x34 + 2i through 0x2a730); 16,690 VPLY and 75 VCWT in the scripts.
- Second reading: confirmed.
- Fix (2026-11-08): audio.js playVoice: only a row switched off plays nothing; a row at volume 0 runs the stream silently, so voice waits and auto mode last its length.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run with every character's volume at 0 (the run log's mix is silent): the @e wait still lasts the voice, 213 ticks (3.55 s) for the 3.42 s voice. The port, in real time, with the volumes at 0: 3.43 s.
### N2-117: A pair of spaces types as two letters (low, confirmed)

Functions: `0xab4d0`.
- Native: Listing 0xab580-0xab5fc: each pair of ASCII spaces becomes one U+3000, so the typing front passes it in one letter interval (0xbd7ec counts code points above 0x1f).
- Port: textbox.js fillSegment keeps both spaces as two .ch letters (line 327-333), each taking its own interval.
- Effect: Each double space delays the rest of its line by one letter interval (35 ms at the default speed).
- Reached: 1,042 double spaces in 165 lines of text.json are typed letters (1,387 in 282 lines counting the 345 inside ruby annotations, which cost no typing time on either side); indented lines add up, e.g. 38 leading spaces are 19 intervals.
- Second reading: 0xab59c-0xab5ec replaces each pair with E3 80 80; the guard tbnz at 0xab564 skips it only in English mode (0x2df20), which the patched game does not take (function-map/text.md:15). 0xbd990-0xbd9a0 counts U+3000 once. textbox.js:327-333 pushes each space as a letter and parseMarkup converts nothing. The 'equivalent' in the CSV note for 0xab4d0 is about width, so not a recorded choice on timing. The count is too wide: 345 of the 1,387 pairs (117 lines) are inside ruby annotations, which the port never types (rt un-spaced, textbox.js:374-375) and the native front jumps over (0xc0818).
- Fix (2026-11-08): textbox.js fillSegment: a pair of ASCII spaces is one letter of the typing (0xab59c-0xab5ec: one U+3000), both spaces on screen.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames, " ca  R e" at 100 ms a letter (6 ticks): c, a, R and e first show 0, 6, 18-20 and 30-31 ticks after the c; the port's frames give 0, 6, 18, 31. The pair of spaces is one letter.
### N2-118: A dash or block run types as one letter (low, confirmed)

Functions: `0xbd7ec`, `0xbdc2c`.
- Native: Listing 0xbd990-0xbd9a0 counts code points above 0x1f; a run left as one glyph by 0xbdc2c counts once, so the front passes it in one interval.
- Port: textbox.js fillSegment pushes the run's element once for each dash (line 315).
- Effect: Each run delays the rest of its line by (length - 1) letter intervals, about 2 for the usual three dashes (70 ms at the default unread 35 ms a letter, 30 ms at the default read 15 ms), and the line ends that much later.
- Reached: Runs of U+2015 in the story text.
- Second reading: 0xbd990-0xbd9a0 counts code points above 0x1f; 0xbdc2c writes 0xd, count, glyph, 6 for 2+ dashes (longest 21, below 0x20) and for U+25A0, and adds one to the letter index uStack_b4 per run; 0xc0684 fades letter i at min(front - i, 1). textbox.js:315 pushes the element once per dash; U+2014 and U+25A0 go letter by letter. All survey numbers match exactly. Wrong details: 22 ms is only the TextBox constructor's value (textbox.js:417), which the boot call main.js:796 replaces; the defaults are 35 and 15 ms (0x46b08e, 0x46b090).
- Fix (2026-11-08): textbox.js fillSegment: a dash or block run is one letter of the typing (0xbd990 counts its one glyph).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames at 6 ticks a letter: in '"Ah――no."' the n comes one interval after the dash run starts, in '―――But.' the B does, and in 'A ■■■■■■■ creature.' the c comes two intervals after the bar; every letter of the three lines is within 3 ticks of the port's.
### N2-119: Runs of U+2014 are not joined (low, confirmed)

Functions: `0xbdc2c`.
- Native: Each character is compared with U+2015, U+2500 and U+2014 (0x3c99aa, 0x3c99ae, 0x3c99b2); a run of two or more becomes code 0xd, the count, one dash glyph (U+0153, or U+0152 outlined) and code 6, one glyph stretched over the run (0xdd334 case 0xd).
- Port: textbox.js:74 dashRuns and fillSegment's test at textbox.js:308 match only U+2015, so a U+2014 run is set dash by dash with a shadow on each.
- Effect: Em dash runs such as 'her——someone' and '———Foolish.' are separate dashes in the port and one solid line in the game.
- Reached: 89 runs in 79 lines of text.json, longest 5; no line mixes U+2014 with U+2015.
- Second reading: confirmed.
- Fix (2026-11-08): textbox.js: dash runs include U+2014 and U+2500 in any mix (0x3c99aa, 0x3c99ae, 0x3c99b2); a run is drawn as one line of U+2015.
- Compared: Compared with a native frame (text 3315).
### N2-120: Ruby annotation appears at once instead of across its base (low, confirmed)

Functions: `0xc1fdc`.
- Native: The ranges written here drive 0xc0684 (listing 0xc09d4-0xc0ab4): while the front is inside a base, annotation letter k is drawn at min((front - baseStart) / baseLength x annotationLength - k, 1), so the reading fills in over the base's typing time; the front then jumps over the annotation letters (0xc0818).
- Port: style.css:50 hides the rt until the first base letter is on; textbox.js:374-377 fills the rt whole, not as typed letters.
- Effect: A reading such as 'prey' over 'woman' shows complete when the first base letter appears, where the game fills it in across the base (75-175 ms for five letters at the default 15 ms read / 35 ms unread a letter).
- Reached: 121 lines of text.json contain ruby.
- Second reading: Listing 0xc09d4-0xc0ab4: inside a base range s = (front - start) / (end - start) x annotation length; letter annStart + k gets min(s - k, 1) by 0xc3c24; 0xc0818 moves the front past an annotation range. style.css:50 and textbox.js:374-377 as stated: rt is whole and visible with the first .ch.on. 121 lines confirmed (140 rubies). The CSV note for 0xc1fdc and NATIVE-PARITY.md:96 record only the proportional, centred, un-spaced shape as deliberate, not the reveal. Wrong detail: 22 ms is not a game speed; defaults are 35 unread and 15 read (0x46b08e, 0x46b090).
- Fix (2026-11-08): textbox.js: a reading's letters are typed spans that fill in across the base (rubyAlpha, 0xc0684 listing 0xc09d4-0xc0ab4).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames, "<place|w o r l d   >" at 6 ticks a letter: the reading fills in across its base, but as written, padding included: w, o, r, l, d first show 0, 5, 10-12, 16 and 21 ticks after the p, which is 6 x 5 x k / 12 for k = 0, 2, 4, 6, 8 of the reading's 12 characters; five letters spread evenly would be at 0, 6, 12, 18, 24. Corrected: textbox.js rubyLetters keeps each letter's place in the reading as written and the reading's length, and the typing uses them.
### N2-121: The next unmarked line on a page takes the previous line's colour (low, confirmed)

Functions: `0xc35b4`.
- Native: 0xa7790 runs 0xc3a94, then 0xc35b4, then 0xbd7ec, so the scan (listing 0xc3600-0xc3668, digits 1-4 only, table 0x3c99d2) still sees the old text and sets the base colour from it; 0xbdc2c changes it only if the new text has its own @c, and 0xc5fb4 draws whole-message text in +0x18970 (cbz at 0xc67c8). Only 0xbce64 / 0xbd550 (set-up), 0xbdc2c and 0xc35b4 write that colour. Story lines use slot 4 + 0xae05d0 (0x6e620); 0x53ab0(1) rotates the slot and wipes the new slot's text only at a page end. Once a later line re-lays it into a slot from 0x51 (0x5b760) it takes that slot's own colour state; that step was not followed further.
- Port: vm.js:925 colourMarks works per message, and textbox.js:292 newSegment gives an unmarked message no colour class.
- Effect: An unmarked line right after a line with @c1-@c4, with no page end between, is drawn in that colour while it is the current line (red, blue or grey in the scenes below); the port draws it in the normal colour.
- Reached: 9 places in 5 scripts: 08_01_CIEL08_5 ZM63b89; 10_00_ARC10LIVING ZM72cad, ZM72cb5, ZM72cc1, ZM72cc6, ZM72cca; 12_01_CIEL12_4 ZM95001; 12_01_CIEL12_4B ZM9532b; 14_01B_01_CIEL14B_1B ZMa8803.
- Second reading: Mechanism holds: 0xa7d04 calls 0xc35b4 before 0xa7e14 / 0xbd890 replace +0x118e0, the scan (0xc3600-0xc3668) takes the first @c1-@c4 of the old text, 0xbda9c does not reset +0x18970, whole-message text is drawn from it (0xc67c8 -> 0xc6870), and MSG uses the same object within a page; colourMarks has no carry. NATIVE-PARITY.md:205-206 only says this was not traced. The list has one too many: 10_00_ARC10_7_2B ZM7ad6a follows a page end (WNTY(1) before ZM7ad69, then CLO3; 0x6e178 -> 0x53ab0(1) rotates and 0x53b7c wipes the new slot), so nothing carries; my survey finds the other nine.
- Not reproduced (2026-11-08): native frames of texts 19508 (@c1) and 19509 show the next line in normal white, in a page with @n lines and in one with clicks (0x53ab0(1) rotates the slot at every message's end, not only at a page end, so the text 0xc35b4 scans is the other slot's). No change in the port.
### N2-122: A wrap break the port takes out types as a letter (low, confirmed)

Functions: `0xc5610`.
- Native: The patch's raw line feed (0x0a) stays in the code buffer: 0xc5610's patched path neither adds nor removes one (0xc5a18, 0xc5a24), and the letters the typing front runs over are the code points above 0x1f, counted in 0xbd7ec before the layout (listing 0xbd990-0xbd9a0, stored at +0x108a0). So a line feed costs no letter interval. The native run in checklist T3 measured it on this very line: in text 1340 the 'a' after the raw break came one interval after the 's' before it (FIX-CHECKLIST.md:544-547).
- Port: vm.js:896 lineText runs reflow.js:81-88, which writes each injector break as a space; textbox.js:326-334 makes every space a .ch letter the front passes. Text 1340 is typed as 71 letters where the game has 70.
- Effect: Each break the port takes out delays the rest of its line by one letter interval: 35 ms at the default speed, 15 ms on read text, 35 ms per removed break on a line of several rows, and the line finishes typing that much later. Replacing the break by a space is recorded (NATIVE-PARITY.md:131); its typing cost is not, and textbox.js:235 states line breaks are no letters.
- Reached: 32,401 of the 33,113 raw breaks in lines the story types (MSG / MSAD through lineText), in 22,236 of the 22,858 lines with a break (reflow.js with wrapContext run over the 549 script files; the 4 further breaks in 4 choice lines, 3 of them injector-shaped, are shown unreflowed). NATIVE-PARITY.md:138 counts 32,408 of 33,121 over the whole text.
- Second reading: True: 0xbd990-0xbd9a0 counts code points above 0x1f (x25 + 0x3018 = +0x108a0) and T3's native timing shows no interval at the raw break; reflow.js:81-88 writes a space and textbox.js:326-334 makes it a typed letter, so text 1340 is 71 letters against 70, and nothing in the audit records that cost. The counts include 4 choice lines the port does not reflow (op_SELR uses textOf, vm.js:832), and there are 549 script files.
- Fix (2026-11-08): reflow.js writes a break it removes as textbox.js SOFT: a space on screen that is no letter of the typing (the raw line feed costs none, 0xbd990).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames: in "...the night's cold\nair." at 6 ticks a letter the a of the second row comes one interval after the d (672-673 ticks against 666-667); the port's frames give 674 and 668.
### already S37: FADE 41 while skipping ends the split at once (low, likely)

Functions: `0x2e430`.
- Native: 0x5f420 case 0x29 has no skip test: mode 5, alpha falls 1/60 a frame in 0x2f910 (the instant run lets FADE 40/41 through: mask 0x30000018000).
- Port: vm.js:1473 sets gfx.split to null when this.skip is on.
- Effect: A split being skipped through vanishes at once instead of over 60 frames.
- Reached: 33 FADE 41 calls, when reached while fast-forwarding.
- Second reading: confirmed.
- Left open (2026-11-08): this entry belongs to the single S37 fast-forward change, which was not made. The game runs it at the fast-forward step (up to 17 or 33 game frames a drawn frame, 0x590e80) while the port's skip finishes it at once, so matching it needs a game-speed clock across the VM's waits, tweens and effects; the speeds also still lack a ZR-held native run.

### Unsettled

- Settled 2026-11-08: on a native page the rows are 77.5 px apart (row tops 167, 243, 321, 398, 477, 555, 632, 708, 787); `style.css` now has line-height 77.5 px (73.5 before) and #text top 146 px, so the first row stays where it was: the port's rows and the game's are within 2 px on all nine rows. Earlier note: `0x39180`: The native row height in pixels was not derived: it comes out of the patched cell layout (0xbf0f8, 0xc5610, glyph 45.6 px and spacing 24 px from 0xa7790 before the patch). A native frame of two rows of a choice, or of a page, would give it to compare with the port's 73.5 px.
