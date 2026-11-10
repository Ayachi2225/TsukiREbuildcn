# B1 backlog / config / dialogs / choices: native-to-web review

## Summary
| Status | Count |
|---|---|
| explicit | 36 |
| covered | 8 |
| divergent | 34 |
| missing | 0 |
| unused | 2 |
| platform | 25 |
| helper | 62 |

Method: Ghidra decompiles checked against the instruction listing. SYSMES texts were read read-only from the dump's SYSMES_TEXT.DAT through `web-research/.venv` and `web-research/tools`. Tables were read from main.bin.

Correction to the brief: 0x40c / 0x6a0 / 0x6b4 / 0x6c4 track a touch drag, not an analog stick. They turn the drag into a flick velocity that decays x0.9 a frame (used by the config, CG list, flowchart and music list).

## Divergences / missing behaviour

**1. Choice labels are numbered ("1. ...").**
- Native: SELR does `strcpy(row, SYSMES[1433 + (row+1)%10])` then `strcat(row, text)` (listing 0x7dab8-0x7db20). SYSMES 1434... are "1.", "2.", ....
- These buffers feed the choice draw 0x84e50 and the backlog records that SELD writes (0x7f7cc). A row therefore reads "1. I need more details on vampires.".
- Web: `ui.js:choices` and `vm.js:op_SELR` show the bare text.
- Scope: 170 SELD calls, 83 choice ids, 823 SELR rows. Confirmed.
- Fix: prefix `${(k+1)%10}.`.

**2. Locked rows are selectable.**
- Native: `SELR n $text 1` sets `0xae09e0[row] = 1` (0x7db3c-0x7db54). 0x83e50 skips such rows for every key and ignores taps on them.
- Script calls: 07_00_ARC07_3_1 op 589 (G003!=1, choice 38); 03_00_ARC03_5B ops 3796 and 3799 (choice 13); 14_01_CIEL14_1C ops 5246 and 5249 (choice 82); 13_01_01_CIEL13_4 op 2435 (F069!=1, choice 75).
- Web: `op_SELR(i, id)` drops the argument, so the player can enter a locked branch.
- Confirmed. How a locked row is drawn was not traced.

**3. Nothing is selected at first.**
- 0x83b20 sets the cursor to -1. A/Enter does nothing while it is -1 (listing 0x842c8: decide is skipped when the cursor is negative).
- Choices (0x83e50): Up/Down wrap only on a fresh press; a held repeat stops at the end. Left = first row, Right = last row; the wheel moves the cursor. Hover does not move it; a tap selects and a second tap on the same row takes it.
- SELS (0x848b0/0x85690) and SELA (0x84a90/0x85c20): Up = No, Down = Yes; hover selects; B is ignored. SELS stores the index (1 = Yes) in its variable.
- Web: ChoiceFx starts at row 0, wraps on every repeat, hover moves, one click takes. Story dialogs call `select(1)`, i.e. Yes.
- Scope: 170 SELD, 26 SELA ("Save Progress?" opens the save screen at once in the web), 1 SELS. Confirmed.

**4. System dialog default and clicks.**
- 0x49710(n, default) sets the starting cursor; answer 0 = Yes, 1 = No.
- Starts on No: Quick Jump 23 (0x28c2c), Default 27 (0x2bb90), Quick Load 9 (0x4e74c), Jump to Next Scene 10 (0x41094, 0x410c4), Return to Previous Scene 11 (0x41398), dialog 25, gallery table dialogs, Overwrite 2, Cancel Saving 7, system-data 14/7/5.
- Starts on Yes: flowchart 26, End Scene Playback 12, Return to Title 8 from 0x4cea0, system data 5 (0x87be0).
- Web: `ui.dialog` always starts on Yes.
- Clicks (0x49f00, listing 0x49fa8-0x4a0bc): a tap on the button that is not selected only moves the cursor (sound 0); a tap on the selected button answers; hover alone does not move the cursor. The web answers on the first click.
- SYSMES 160 is two lines in the game; the web replaces "^" with a space. Confirmed.

**5. The backlog is a page viewer.**
- Records (0x27eb0): the ring holds 800 records of 0x3aa8 bytes. Types 0 (messages) and 0xc (the numbered choice rows) are listed. The lines of the unfinished page on screen are dropped (up to the first record whose saved F799, the WNTY page end, is 1).
- Pages: 0x28950 splits at those records and plays sound 3.
- Layout: 0x28470/0x281a0 draw up to 12 rows as the text window drew them (x 88, y from 65.06, scale F825+i/F836+i, row skip F847+i).
- Input (0x28a90): Up or wheel = older page (repeats); Down = newer; a fresh press at either end wraps. Left = oldest page, Right = newest; sound 0 on each move. A, or a tap left of x 543 -> Quick Jump to the page's first record (dialog 23, starts on No; sounds 1 and 3). Records with +0x35c0 set or type 8/0xb are refused silently. B, a right swipe or the Back button -> sound 2.
- Fades: 0x28f80 and 0x28d50 fade in and out at 0.05 a frame after a screen capture (0x2e000).
- Look: 0x27d10 draws a black veil at 0.75 over the scene. No constant-slot draw of bg_backlog (0x41), back_title_ja (0x3f) or voice_icon (0x43) exists.
- Web: every line (no choice rows, current page included) in a list on bg_backlog, line cursor, no wrap, no fades, cancel sound on refusal.
- Confirmed, except the exact page appearance, which belongs to C_text.

**6. SE Test (0x29140).** Native: a random one of 14 effects from table 0x46b138 (moon_se02009, 02010, 02011, 02023, 02035, 02037, 02052, 02058, 02062, 02091, 10047, 02097, 02103, 09005), on a free SE channel, stopping the previous test. Web: MOON_SE03001 every time. All 14 files exist in assets/se. Confirmed.

**7. Voice rows.**
- 0x29300 is called from the VPLY/VPL2 handler with no skip test (0x7a420), so the row bit and the Test sample are set even while skipping. The web returns before `heardVoice` when skipping.
- 0x29fa0, Shiki's row in game (mode flag at 0xae04e8 != 0): hidden while F23 = 0; face 19 in 00_00; face 18 and "????" in 00_01/00_02; otherwise his real face and name. The web always uses the title rule (scenes 485 and 1).
- The Test voice plays at row volume x the voice switch (+6), so it is silent when "Play all voices" is off; the web ignores the switch.

**8. Config controls (0x2b930, 0x29bf0).**
- Native: minus/plus step 1, or 50 when the widget's max >= 1000; held 20 frames, then repeats every frame. A held plus Left/Right adjusts a slider; dragging sets an integer value. L/R mapped keys change page; the stick scrolls the page. The D-pad moves on a 2D grid; Left at column 0 hands the cursor to the system menu column.
- Web: step = range/50 (5 ms, 200 ms, 2%), no repeat, fractional values from track clicks; no page keys (pad L/R send "a"/"f"); Up/Down walk all items linearly.
- Confirmed.

**9. Button tooltips.** 0xae840 -> 0xae110, drawn by 0xae590, shown when config +0x20 is on (default 1). Mode panel captions: Return to Previous Scene, Rewind when Pressing Button, Toggle Auto Mode between ON and OFF, Fast Forward when Pressing Button, Jump to Next Scene, Quick Save, Quick Load, Replay Last Voice. System menu: Save, Load, Set Environment, Display Flowchart, Return to Title. Config tabs: System Settings, Sound Settings, Display Operating Instructions, Change All Settings to "Recommended Settings". Web: captions only on the mode panel, with its own labels. The captions also show that 4 web panel actions differ from the game's (0x4e170 returns 3, 4, 6, 7).

**10. Config look.**
- Digits: 0x2cab0 binds slot 0x4d6 = config_number_ja (outlined digits, no %). The web uses Georgia text with %. ANIMATIONS.md wrongly lists this texture as unused.
- Help bar: the Controls page uses screen 1 (0x2aa80); the web uses screen 2.
- Fades: 0.024 a frame in/out (0x2b770, 0x2c500); pages cross-fade at 0.05 (0x2c380). The web switches instantly.
- Backdrop: from the title, 0x2b680 raises the system-menu background (0x49630(0.024)) and 0x2c500 lowers it again (contradicts the FIXES note "Gallery background"). In game, 0x4d8c0 case 10 does not lower it, so it stays under the config. Web: bg_backlog from the title; conf_BG (an empty texture) over the blurred scene in game. config_innerbg is only ~34% opaque, so the backdrop shows.
- Text: SYSMES 139 is "Following Messages"; the web says "Following Message".
- Samples restart after the click wait counted from 10 fully shown letters (0x2d570); the web counts from the whole text.
- Exit (0x2b5c0) stops the SE and voice Tests; the web lets them play on.

**11. Quick Load shows the quick save's picture.** 0x4e170 calls 0x89590 and 0x4b4a0(1), so 0x4ae90 draws the picture and puts the question at y 160. The web shows none. Likely; 0x4e170 is B2's.

**12. Notice window.** 0x4abe0 and 0x49750 show SYSMES notices ("Saving", "Save Complete", "Flowchart is not yet available"...). The web only toasts "Saved". The call sites belong to B2 and A.

**13. Drag scrolling with inertia.** 0x40c lets the config, CG list, flowchart and music list scroll by dragging (a left click acts as a touch on PC), with a flick that decays x0.9 a frame. The web scrolls only by wheel/scrollbar on those lists; the flowchart drags without inertia.

**14. Sticks.** Menu direction masks pair the D-pad with the stick (0x100010 up, 0x400040 down, 0x800080 left, 0x200020 right), and the config scrolls with a stick axis (+0x1e). `pollGamepads` reads buttons only. Likely.

**15. Minor.** Backlog Quick Jump plays sounds 1 and 3; the web plays only 3. Config Default plays only 3; the web plays 1 and 3. 0x2a9b0 re-levels a playing Test voice live; the web keeps the old gain.

## Unused native code
- 0x49a40: a second yes/no dialog (state 0xb34b88/8c, drawn by 0x48760). Nothing sets its state to 1.
- 0x84d10: choice layout for selector type 0. SELD always sets type 1 (0x7f6f0); SELS sets 2, SELA 3.
- Config +0x18, the read-text colour, is never set (0 in 0x46b080, no widget). F800-F821 therefore always stay 0xffff.
- Other config fields with no widget: +0 (window transparency), +0x20 (tooltips), +0x2a (key layout).

## Limits
- No runtime observation.
- Not traced: the exact look of a backlog page and of locked choice rows (C_text), the stick half of the direction masks, and the run-time key map table (*0xae0db8).
- That mode 0 = title (*0xae04e8) is inferred from 0x47bf0, not observed.
- The game's Save?/Load? dialogs were not found as constant 0x49710 calls; B2 should confirm.

## Re-check of the handled functions (2026-11-08)

44 functions of this part compared with the port: 24 the same, 20 different, 0 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-44: Quick Jump keeps the scene points it jumped over (medium, confirmed)

**Closed 2026-11-10: fixed with N2-76 (`vm.js` `restore` takes the scene points after the target off the list).**

Functions: `0x28d50`.
- Native: 0x28e68-0x28ebc: walking from the newest record *0xae0460 back to the target, each record of type 6 or 7 (ATSV: 0x78fb0 / 0x7a890) that is the scene ring's top (0xae04a0[*0xae0498] +0 == record index) pops it: *0xae0498 - 1, floor -1. Return to Previous Scene (0x81a50) then starts from the last ATSV before the target.
- Port: vm.js:1705-1711 jumpTo truncates this.trail only; restore with rewind:true leaves this.scenePoints alone (vm.js:1739 clears it only when !rewind), and previousScene (vm.js:763-770) reads the top of the untouched list.
- Effect: After a Quick Jump to before a scene start, Return to Previous Scene in the port goes to the scene start the player jumped back over, which is ahead of the current line, where the game goes to the one before the current line.
- Reached: 396 shipped ATSV calls make type 6 / 7 records (313 ATSV(), 83 ATSV(1)); any Quick Jump across one, then Return to Previous Scene.
- Second reading: confirmed.

### N2-45: Right from the column lights the System tab on a first opening (medium, confirmed)

Functions: `0x2c6e0`.
- Native: The boot init 0x2b010 sets each page's row and column (System and Sound: row 0, column 0; Controls: row -1) and 0xaed328 = 0x33 (the System tab). 0x2b770 therefore puts the cursor on widget 0x37 (0x4e on Sound, the System tab on Controls) at the end of the first fade-in, and 0x2c6e0 returns it there after the column: 0x29770(page, 0x37, 1) with sound 0.
- Port: ui.js:1769-1773 restore leaves sel -1 on a first opening (nothing lit, no caption, A presses nothing, only Down and Left move). ui.js:1890 then does go(C.cur) with C.cur { row: -1, col: 0 } (itemAt finds tabItems[0], so the fallback is not what runs), lighting the System tab with its caption.
- Effect: On the first config opening of a run the game shows the cursor on row 0's first widget from the end of the fade-in, and every key acts from there; Left to the column then Right returns to that widget. The port opens with nothing lit, ignores A, Up and Right at first, and Right from the column lights the System tab with its caption.
- Reached: The first config opening of each run (and the first visit to the Sound and Controls pages) in the port, until a key or the pointer picks a widget. The game has no such unselected state.
- Second reading: The state the first reading describes does not exist in the game: the boot init 0x2b010 (once, 0x47cd8 in 0x47bf0) writes page 0's row 0 and column 0 (0x2b190-0x2b198), the same for page 1, row -1 for page 2 (0x2b250) and 0xaed328 = 0x33 (0x2b270), so 0x2b770 lights widget 0x37 at the end of the first fade-in and 0x2c6e0 returns to it; no 0x29770(page, 0, 1) happens. The port's first-opening state (ui.js:1769-1773, FIX-CHECKLIST M20) rests on the same wrong premise, and the sandbox note's 'row 0's minus lit at opening' fits 0x2b010.
- Fix (2026-11-09): ui.js config: the kept cursor starts as the boot's init leaves it (System and Sound row 0 column 0, Controls the tabs' row, that row on the System tab), and the cursor is placed when the fade in ends (0x2b770), so nothing is lit during it. The first-opening state with nothing lit is gone.
- Compared: Native frames of Config opened from the title: nothing lit during the fade, row 0's minus and its caption at the end; the port's the same.

### N2-46: Default on Yes fades the whole config in again (medium, confirmed)

Functions: `0x2c810`.
- Native: Case 8 (0x2c930-0x2c9d0): writes the defaults, 0x2a550(0), 0x2a550(1), 0x2a9b0, 0x29770 and state 3 (0x2ca84). aed33c and aed338 stay at 1, so the screen stays up and only the values change.
- Port: ui.js:1730 answers Yes with this.env.resetSettings(); this.config(TABS[C.page], fromTitle), which restarts from level 0 and state in (ui.js:1776). From the title it also restarts the menu background from 0 (ui.js:1693).
- Effect: After confirming Default the config's panel, tabs and page vanish and fade back in over about 42 frames, and from the title the menu background does too; in the game the values just change in place. Keys wait for the fade.
- Reached: Every Default then Yes.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js config: Default on Yes restores the screen's items (the dialog's restore function), calls resetSettings, rebuilds the page where it is (build(), restore()) with the level untouched: no fade and the cursor stays on Default; the dialog fades out over it (the answer runs on the frame after the hold, N2-48).
- Compared: Native run t10b (mouse-driven: Reset tab, Yes twice): the config stays at full level, only the values change while the window fades. The port hand-stepped: both config levels stay 1, the text speed goes from 80 to 35 on the frame after the hold, Default still lit.

### N2-47: Help bar labels use measured rectangles, so later items sit too far left (medium, confirmed)

Functions: `0x4a8f0`.
- Native: 0x9a710 returns rectangle 8 + language x 27 x 8 + id x 8 of CONTHELP_TXT_UV.BIN (loaded by 0x9a420, in allui); language 0 applies (the patched game runs as language 0, function-map/text.md; language 1 rectangles run off the 512-wide picture): label 0 is (8, 8)-(56, 36), 48 x 28; label 11 is 148 wide). 0x4a8f0 crops that rectangle and advances x by its width + 8.
- Port: tools/build_system.py:208-234 cuts 27 labels from help_txt_ja by alpha (label 0 is (9, 9)-(44, 35), 35 x 26; label 11 is 80 wide); ui.js:464-468 crops and advances by those.
- Effect: Items after the first label drift left of the game's: by the bar's end 123 px on Config (screen 2), 91 on save and load, 89 on the backlog, 160 on screen 6. Labels also sit lower: 1 px by the rectangles and about 2 px in the frames for most labels, 5 px for label 26 (Scroll).
- Reached: Every screen with a help bar. Table compared with system.json for all 27 labels; the file is in the ROM, so it can be exported.
- Second reading: CONTHELP_TXT_UV.BIN re-read from the ROM (allui): language 0 label 0 (8,8)-(56,36), label 11 148 wide; 0x4a8f0 advances width + 8. Native frame nat3 03428 (flowchart, screen 0) has label ink at x 109-136, 213-257, 320-352, 427-460, matching the language 0 rects, not the port's 107-137, 200-247, 310-345, 408-445; bar-end drift recomputed 123 / 91 / 89 / 160. Only the vertical figure is off: web_i0 ink rows are Back 1049-1061 against the game's 1047-1059, Scroll 1052-1065 against 1047-1060 (label 26 is cut 22 high from 225-247, the game's 28 high from 224-252). ANIMATIONS.md:695 records only that the port measures the labels, not that the difference is intended.

### N2-48: The answer acts only after the window has closed (medium, confirmed)

Functions: `0x4ad40`.
- Native: 0x49f00 state 3 clears 0xb34b54 at the end of the hold (0x4a014) and sets state 4; callers (0x50fc0 through 0x496f0 / 0x49700, the title, the flowchart) act on the next frame while the old window fades over 15 more frames (state 4, t -0.07 a frame), and 0x4ad40 / 0x4abe0 open the next window in the other slot.
- Port: ui.js:1331-1339 runs the answer only when fx.closed (t 0), after the fade.
- Effect: After an answered system dialog the next step starts about 15 frames (0.25 s) later than in the game, and the question does not cross-fade with the Saving / Loading notice.
- Reached: Every answered system dialog: Overwrite, Load, Quick Load, Quick Jump, Default, Jump to Next Scene, Return to Previous Scene, End Scene Playback, the flowchart's rewind, Return to Title in a replay.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js dialog: the system's windows have their own layer (#sysui, over every screen) and loop (sysLoop, not the screen's animate), so the answer runs on the frame after the hold (uifx.js DialogFx.acting: state 4 with t falling, as the callers read 0xb34b54 = 0 the frame after state 3 ends), with the keys and Back button given back then, and the window fades out by itself over what follows; a screen change takes windows still up with it but not one already fading (cancelSystemWindows). The Saving and Loading notices open over the fading window and cross-fade (notices under dialogs, as tasks 110 / 120).
- Compared: Native frames (every frame): Overwrite? with a used slot (t5) and Load? (t6): buttons pressed for the hold, gone on the frame it ends, the window fading from the next frame, the notice growing in behind it. The port, hand-stepped in an isolated browser: buttons hidden at step 15 of the hold, the answer at 16 with the window at 0.93, the notice at 0.07 a frame later.

### N2-49: Story question and Save Progress? text and buttons hidden while fading (medium, confirmed)

Functions: `0x85900`, `0x85e40`.
- Native: 0x85900 draws the question (0xab710 at alpha a, 0x85b2c) and the buttons (0xadfe0(a), 0xaeec0(13), 0x85ba4-0x85bd8) on every frame with t > 0, in every state.
- Port: ui.js:1317-1320 hides the question unless fx.t === 1 and the buttons outside states 2-3, for both kinds.
- Effect: The question and its buttons pop in after the 10-frame fade and vanish before the fade out; in the game they fade with the window.
- Reached: 1 SELS in the shipped scripts (QACALL).
- Second reading: confirmed.
- Fix (2026-11-08): ui.js dialog: for kind story the question and the buttons are at opacity t on every frame (the system window keeps its show-at-t-1 rule).
- Compared: Native per-frame run t2: the window, question and both buttons rise together 0.1 a frame over 10 frames (ratios 0.1 ... 1.0 of the open picture in the same frames); the port hand-stepped gives the same 0.1 steps.

### N2-50: Story question and Save Progress? text size (medium, confirmed)

Functions: `0x85900`, `0x85e40`.
- Native: 0xab4d0 scale (0.37, 0.46044) x s of the 60-pixel base (0xa7790, language 0): glyphs 22.2 x 27.6 px at s = 1; the system question's (0.6, 0.7) gives 36 x 42.
- Port: style.css:118 .dialog-q is 40 px for both kinds; nothing changes it for kind story.
- Effect: The hint corner question reads about 1.5 times the game's size.
- Reached: 1 SELS in the shipped scripts (QACALL).
- Second reading: confirmed.
- Fix (2026-11-08): style.css .dialog.story .dialog-q: 30 px (the system question's Georgia is kept, only the size), one line at top 437.
- Compared: Native frame (Enter hint corner (No. 1)?): question ink x 786-1129, y 442-469; port 790-1128, 442-469 (40 px before: 734-1185, 446-483).

### N2-51: Buttons react to the mouse without a press (medium, confirmed)

Functions: `0xae840`.
- Native: The hit test runs only while +8 of the pointer state is set, which only 0xad4e0 writes: 1 while a touch is in progress (0xad8a4); its mouse path (0xad8e8) needs 0xae0dc8, which nothing writes. On PC that is the left button held down.
- Port: ui.js:376 moves the cursor on mouseenter (UI.add without secondTap), with sound 0 through move().
- Effect: In the port a button lights and plays the cursor sound as the mouse passes over it (title, menus, config, save lists, SELS / SELA); in the game nothing changes until the left button is down.
- Reached: Normal play with a mouse.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js UI.add: no mouseenter; a press moves the cursor to the item with sound 0 (title, menu column, config, save rows); opts.drag follows a held pointer where the game reads the hover while held (config, save rows, 0x2b930 / 0x50fc0); opts.pressChoose: a press on the selected save row chooses it (0x50fc0); the title and other items choose on a release that is a tap. The story questions answer by presses (0x85690 / 0x85c20: a press on the other button moves the cursor; any other press with one selected answers), the system dialog by taps (0x49f00: a press lights the button under it only). Hover remains on the flowchart's nodes (N2-53) and the gallery's lists and mode panel: those were not under this item.
- Compared: Native run t7 (scripted mouse on Overwrite?): a pointer that moves over a button changes nothing; a press lights it; t8: SELS / SELA with the mouse. The port driven with real mouse events in an isolated browser: the same results point by point (hover nothing, press selects, the edges of the boxes, the press off the buttons).

### N2-132: Pause menu bands fade with the menu's opacity (low, confirmed)

Functions: `0x49630`.
- Native: 0x4cba0 calls 0x49630(1/18, 1) and 0x4d7e0 calls 0x49630(-1/30, 0) each frame; the negative rate goes to the band timer 0xb34b7c. 0x4b880 draws the bands at eased t x their own alpha, without the level (0xb03e0 per band, textures 0x53-0x5a).
- Port: ui.js:987-991 system() sets the whole background's opacity to one alpha at 1/18 and -1/30; ui.js:952-953 leaves MenuBgFade at level 1 and band rate 1/60, so the band timer keeps rising while closing.
- Effect: Opening: bands show at n/18 of the game's alpha for the first 18 frames. Closing: 15 frames in, a band at t = 1 is at 0.5 of its alpha in the port and 0.75 in the game, and bands that had not settled keep moving.
- Reached: Every pause menu open and close.
- Second reading: confirmed.
- Fix (2026-11-09): see this finding in [title-menus-saves.md](title-menus-saves.md).

### N2-147: Touch ring centre colour interpolates from clear black, port from clear white (low, confirmed)

Functions: `0xe00`, `0xb895c`.
- Native: 0xe00 flag 1 path: 0xb8974(1, 1, 1, 0.5) rim, 0xb895c(0, 0, 0, 0) centre; 0xb8990 copies the per-vertex colours unchanged (0xe2ec0) and uses blend state +0x24c, which 0xb8370 leaves 0 (0xd3914 case 0: SrcAlpha, OneMinusSrcAlpha). At fraction r of the radius the source is (r, r, r, 0.5 r), so the added light is 0.5 r^2 x alpha while the backdrop is scaled by 1 - 0.5 r x alpha.
- Port: touchfx.js:44-45 gradient stops rgba(255,255,255,0) to rgba(255,255,255,0.5); canvas gradients interpolate unpremultiplied, so the source stays white and the added light is 0.5 r x alpha.
- Effect: Inside the ring the port is brighter than the game: at half radius 0.25 versus 0.125 added light. On a white backdrop the game's disc shows as a faint grey that the port does not draw. Lasts the 0.5 s of each ring.
- Reached: Every touch or left press (0xad4e0 passes flag 1 at 0xad64c).
- Second reading: confirmed.

### N2-148: Row 0's column is not kept across pages and openings (low, confirmed)

Functions: `0x29770`.
- Native: 0x29770 stores each row's column at page + 0x898 (0x46d648) in static data for the whole run; Down from the tabs' row (0x29bf0 at 0x29d..: row = 0, then the widget from row 0's stored column at LAB_00029e60) lands on that column.
- Port: ui.js:1742 build() sets C.colOf = [] on every page build and restore (ui.js:1764-1768) refills only the remembered cursor's own row; uifx.js:445 configMove then uses colOf[0] || 0.
- Effect: Leave row 0 at a column past the first by going up to the tabs, change page and come back (or close and reopen): Down from the tabs lands on the row's column in the game and on its first widget in the port.
- Reached: Any config visit with keys; rows 0 of System and Sound have 4 widgets (0x46cdb0 column counts).
- Second reading: confirmed.

### N2-149: Config page scroll eases in half the frames (low, confirmed)

Functions: `0x29930`.
- Native: The page's left-over and the thumb share one counter, widget +0x4c (duration +0x50 = 12, easing +0x54 = 3, from 0x9ad04; reset by 0x9ae58 at 0x29b2c). Each config frame 0x2aa80 advances it twice by 0xb0190's frames (1 at 60 fps): 0x9afa4 at 0x2ac4c for the page position and 0x9b0c4 at 0x2afac (advance at 0x9b264-0x9b274) for the thumb; the listing reaches both whenever the screen and page are up, and the widget's visible byte +0x28 is only ever set to 1. So the page shows e(1/12), e(3/12) ... e(11/12) then 1.0 on the 7th frame, and the thumb 2/12 ... 12/12 by the 6th. The backlog and save list read only 0x9b0c4, so they do take 12.
- Port: uifx.js:397 ConfigScroll.step and uifx.js:342 ScrollBarFx.step add 1 per 60 Hz frame against SCROLLBAR.frames = 12 (stepped once a frame, ui.js:1603 and the scroll bar's draw), so the config page and its thumb take 12 frames. FIX-CHECKLIST M12 / M20 record 12 frames from reading the code; the native run they cite checked positions, not timing.
- Effect: A scroll of a Config page by the cursor leaving the window, the stick or a drag settles in about 0.1 s in the game and 0.2 s in the port. A press or drag on the bar's strip moves the page at once in the game; the port eases it over 12 frames (ui.js:1606 seek -> ConfigScroll.set), the thumb going at once.
- Reached: Every scroll of the System page (range 485) and the Sound page (122 per listed row - 113); no script dependence.
- Second reading: Cursor, stick and drag hold: 0x2aa80 advances +0x4c twice a frame (0x2ac4c, 0x2afac) and only the config calls 0x9afa4, so 7 / 6 frames against the port's 12. The bar is wrong: a press on the strip goes through 0x9b384, which stores +0x48 = 0 (0x9b42c-0x9b430); 0x9ae58 leaves it 0 and 0x9afa4 returns 1.0 (0x9afb8), so the page moves in that frame, and FIX-CHECKLIST M20's 'and the bar' is wrong too.

### N2-150: A refused direction press does not bring the page back to the cursor (low, confirmed)

Functions: `0x29930`.
- Native: 0x29bf0 falls to 0x29e60 -> 0x29770 -> b 0x29930 (0x29ee8) also when the direction does not move the cursor: Down at the last row (0x29d74), Right at a row's end (0x29e40), Left at column 0 from the title (0x29df0). 0x29930 then scrolls to the cursor's widget if the page has been moved off it.
- Port: ui.js:1845 go() returns when configMove gives null, before configFollow at ui.js:1853, so a refused direction leaves the scroll as it is.
- Effect: After the page has been moved away from the cursor with the stick, a drag, the wheel or the bar, a direction press that cannot move the cursor snaps the page back to it in the game and does nothing in the port.
- Reached: Needs the page scrolled off the cursor first (Page Up / Page Down, the pad's stick, a drag, the bar), then a refused direction on a page with a range; no script dependence.
- Second reading: confirmed.

### N2-151: A page change does not restart the tab's caption (low, confirmed)

Functions: `0x29f00`.
- Native: 0x29f7c-0x29f84 calls 0xae110(-1, 0), clearing the shown caption (0x19150f8 / 0x19150fc) and its level (0x1915100). On the next frame 0xae840 calls 0xae110 for the button under the cursor, so the caption starts again from level 0 and rises 0.05 a frame.
- Port: ui.js:1782-1788 changePage leaves the caption alone and Caption.show (ui.js:228) returns early for the same button, so it stays at its level through the page change.
- Effect: With the cursor or pointer on a tab, changing page blanks the tab's caption and fades it in again over 20 frames in the game; in the port it stays lit.
- Reached: Every page change made from a tab (pointer click, or L / R with the cursor on a tab). Captions are always on (config +0x20 default 1, no widget).
- Second reading: confirmed.

### N2-152: The Back button stays on while the menu column has the cursor (low, confirmed)

Functions: `0x2c6e0`.
- Native: Entering state 7 turns it off: 0x29bf0 (Left from the first widget or tab, in the game) and 0x2b930 at 0x2ba5c-0x2ba6c both call 0x4a790(0). 0x2c6e0 at 0x2c7d8 calls 0x4a790(1) when the config gets the cursor back.
- Port: ui.js:1839-1843 go('column') only moves the cursor; ui.js:1924 screenFocus and ui.js:1890 Right restore it. setBack is called only at ui.js:338, 361, 1275, 1337, 1797 and 2092, so it stays on and a click on it still leaves the config.
- Effect: In the in-game config, with the cursor on the left column the game slides the Back button out (0.04 a frame) and back in on return; the port keeps it on screen and pressable.
- Reached: Any in-game config: Left from the first widget or tab, or pointing at the column.
- Second reading: confirmed.

### N2-153: Title movie keeps playing under Config and Load (low, confirmed)

Functions: `0x49630`.
- Native: 0x496a4 / 0x496b0: a positive rate calls 0x1b20(1) (pause), a negative one 0x1b20(0) (resume).
- Port: main.js:407 titleVideo only starts or removes the video; ui.js:611 and ui.js:1693 raise the background without pausing it.
- Effect: With Config or Load open from the title the background movie keeps moving behind the translucent menu background; the game holds it still.
- Reached: Config or Load from the title (0x2b734, 0x50ebc, 0x8ebc0).
- Fix (2026-11-09): main.js titleHold pauses the movie as Config or Load opens from the title and lets it go on as they close.
- Compared: Native frames: frame-to-frame difference of the sky beside the panels 0.02-0.06 of a level while Config or Load is open (the movie held), 4-7 after they close; the port's video paused and playing at the same moments.

### N2-154: A Back press counts for any click, not only a tap (low, confirmed)

Functions: `0x4a410`.
- Native: 0x4a4ec reads +0x34 bit 1, which 0xad4e0 sets only on a release after 4 to 24 frames with no flick or drag flags (0xada10-0xada48). The area is x >= 546 and y >= 394 units (0x4a504-0x4a510), about x 1638 and y 951 px.
- Port: ui.js:312-317 acts on any click on #backbtn, however long the press; style.css:9 and ui.js:328 make the area start at (1640, 952).
- Effect: Holding the button longer than 0.4 s, or a press under 4 frames, backs out in the port and does nothing in the game. The area differs by 1-2 px at its left and top edges.
- Reached: Any screen with the Back button.
- Second reading: confirmed.

### N2-155: Quick Load picture shows during the window's fade (low, confirmed)

Functions: `0x4ae90`.
- Native: 0x4ae90 draws the question and the picture only when t == 1 (fcmp s10, s8; b.ne 0x4b3f8 at 0x4b0ac-0x4b0b0 skips both), so the black frame and the save's picture appear on the frame the window is fully open and go on the first closing frame.
- Port: ui.js:1261-1269 appends .dialog-pic to the box at once; set() at ui.js:1313-1326 toggles only the question's and the buttons' visibility, so the frame and picture show at full opacity from the first frame of opening until the box is removed after closing.
- Effect: The Quick Load? question shows the opaque picture over the still-fading window for about 15 frames on opening and 15 on closing.
- Reached: Every Quick Load with a quick save: 0x4e170 calls 0x4b4a0 for dialog 9, main.js:653 passes picture: s.thumb.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js dialog: the picture's frame is hidden unless t is 1, with the question.
- Compared: Native per-frame run t27 (Quick Load? over a white picture): the picture (x 858-1061, y 487-600) comes on the same frame the window is fully open; the port's .dialog-pic lands on the same pixels and shows only then.

### N2-156: Two-line question moved up (low, likely)

Functions: `0x4ae90`.
- Native: The question is drawn with flags 0x120 / 0x130 (0x4b0e4-0x4b114); 0xa8580 sets the vertical origin bits only from flags 0x400 / 0x800, so the text block's top stays at y 184 (443.6 px) for one or two lines and a second line goes below it.
- Port: ui.js:1259 moves .dialog-q from top 440 px to 417 px when the question has a line break.
- Effect: A two-line question sits about 23 px higher than in the game.
- Reached: Dialogs 26 (the flowchart's rewind, flowchart.js:214-215) and 27 (Default, ui.js:1729); system.json messages 1497 and 160 have a ^. Dialog 25 (1443) exists only in the native movie section's unreachable state 3 (0x1873c) and the port does not ask it.
- Second reading: Native holds: y is 184 or 160 from one flag only (0x4b0b4-0x4b0d0), flags 0x120/0x130 give no vertical-origin bit in 0xa8580 (+0x108c4 goes to the NintendoWare TextWriter at 0xbf0f8; origin top), so a second line goes below; no saved native frame shows a dialog, so it stays likely. ui.js:1259 moves it to 417 px. But dialog 25 is not reached: 0x1873c is the movie section's state 3, which nothing writes (function-map row 0x1873c, checklist G10), and the port never asks it. FIX-CHECKLIST M1 describes the half-line move without calling it a deviation.
- Fix (2026-11-08): ui.js dialog: no vertical shift for a two-line question; style.css .dialog-q line-height 64 px, top 437: the first line stays where a one-line question sits and the second goes below.
- Compared: Native frame (Default question, t10b): first line ink top 452, second line 516; port 452, 518 (one-line Overwrite? ink top 452: port 453). Compared before and after.

### N2-157: Story question and Save Progress? open scaled in the port, not in the game (low, confirmed)

Functions: `0x85900`, `0x85e40`.
- Native: 0x85900 scales the window by 1 + 0.05 (1 - a) only in state 1 (0x859b4-0x859c8). SELS / SELA never set state 1: 0x83b20 writes 0 (0x83b80), 0x848b0 / 0x84a90 fade in at state 0 and go to 3; the only write of 1 (0x84114) is in the story-choice path.
- Port: uifx.js:683-687 DialogFx.scale gives 1 + 0.05 (1 - t) in states 1-2 for kind story (STORY_DIALOG, uifx.js:661); ui.js:1316.
- Effect: The hint corner window shrinks from 1.05 as it fades in; the game's stays at its size.
- Reached: 1 SELS in the shipped scripts (QACALL).
- Second reading: confirmed.
- Fix (2026-11-08): uifx.js DialogFx: kind story is scale 1 while it opens (0x83b20 never sets state 1), 1 - 0.05 (1 - t) closing (state 4), kept at 1 for SELA's Yes (state 5, opts.saveAsk). ui.js scales the question with the window.
- Compared: Native per-frame runs t2 (opening: nothing moves as it fades) and t16 (closing: the window and question shrink a little as they fade with the cursor's button still lit). Port hand-stepped: scale(1) on opening, 1 - 0.05 (1 - t) on closing, the window and question together.

### N2-158: Story question and Save Progress? window 3 px left of the game's (low, confirmed)

Functions: `0x85900`, `0x85e40`.
- Native: 0xb6d50 draws dialog_win at x 321 of 640 (0x43a08000 at 0x85a74-0x85a90).
- Port: style.css:117 .dialog-win left 548 px for both kinds (centre at 320 of 640).
- Effect: The window sits 3 stage pixels left of the game's.
- Reached: 1 SELS in the shipped scripts (QACALL).
- Second reading: confirmed.
- Fix (2026-11-08): style.css .dialog.story .dialog-win left 551 px (x 321 of 640).
- Compared: Native frame: window columns 563-1356; port 563-1357 (560-1353 before).

### N2-159: Tap duration and movement limits (low, confirmed)

Functions: `0xad4e0`.
- Native: 0xad4e0 sets the tap flag 0x2 of +0x34 only when the press lasted 4-24 ticks of the clock 0xb01b0 (0xada34-0xada48; the clock field's writer was not found, so ticks are read as frames) and 0x2000 for 7-199 (0xada4c-0xada60), both only if the touch stayed within 6 units and made no flick (+0x54, +0x78). 0x49f00, 0x4a410, 0x8e200 and the gallery lists test flag 0x2.
- Port: DOM click (ui.js:377 and the screens' handlers) has no duration or movement limit.
- Effect: A press held longer than 24 frames (0.4 s), or under 4, still answers a dialog, presses Back or picks a title item in the port; the game ignores it.
- Reached: Any mouse or touch press held outside the window on those screens.
- Second reading: confirmed.
- Fix (2026-11-08): uifx.js TouchPress (0xad4e0): a press counts in frames from the last frame without a touch, one more than it lasted, plus the release sample that still reads as touching on the PC build; the first press after 256 frames counts from itself; a tap is 4-24 of those, a long tap 7-199, both only without a move over 6 units (the start's distance) or a flick in the last two frames. ui.js tracks it on window pointer events (touchEvent) and tapped() gates the system dialog, the Back button and the title's items (the title reads the long flag 0x4000, 7-199 frames, not 0x2) and the first-launch title press.
- Compared: Native run t7 (mouse shim on Overwrite?): a 100 ms press taps, 500 ms does nothing, 30 ms counted (three samples: the frame count above), so the second tap on the same button answered; t19: on the title a 33 ms press lights the row and chooses nothing, a 150 ms press opens Load Game. The port with real mouse events gives the same outcomes; tests for the frame counts and movement limits.

### N2-160: Switched-on button still shows pressed (low, confirmed)

Functions: `0xae040`.
- Native: Panel button 0xd1 (Auto) has flag 0x2 while Auto is on (0x4e87c sets it, 0x4e838 clears it), so 0xae040 at 0x4e820 is refused when it is pressed to switch Auto off: no pressed state.
- Port: ui.js:2347 pressPanel calls pressFor(10) for every enabled button (uifx.js:740 has no test), so renderPanel (ui.js:2360) shows row 3 for 10 frames.
- Effect: Switching Auto off from the mode panel shows the pressed cell for 10 frames; in the game the button does not press.
- Reached: The mode panel's Auto button while Auto is on.
- Second reading: confirmed.

### N2-161: Dialog buttons' hit boxes (low, confirmed)

Functions: `0xae840`.
- Native: 0xae840 tests each button's table hit box: story buttons (-10,-10)-(60,45) units from the button's corner (0x65bbc0), system buttons (0,-2)-(72,24) (0x590f08).
- Port: ui.js:1289 makes each button its 216 x 56 cell, which is also the area the pointer hits.
- Effect: In SELS / SELA the rightmost 36 px of a button do not count in the game, while up to 30 px left, 24 px above and 52 px below it do; the port takes only the cell. System buttons differ by a few pixels.
- Reached: Mouse or touch on every SELS / SELA and system dialog.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js dialog: each button element is its hit box from uifx.js hitBoxPixels (STORY_HIT (-10,-10)-(60,45), SYSTEM_HIT (0,-2)-(72,24), the place cut to whole units, both ends counted), its art placed inside it.
- Compared: Native run t9 (mouse on SELS): No from x 693 to 905, Yes from 951 to 1163, y 551 to 685 all hit; y 550 is out and counts as a press elsewhere, which answers. The port hit the same points with the same results (p3).

### N2-162: First lit button flashes as the system dialog opens (low, confirmed)

Functions: `0xae840`.
- Native: The cursor's button goes to state 1 on the update after 0x4ad40 (0xae0e0), so its flash (1, -0.1 a frame) has run out by the 15th frame, when 0x4ae90 starts to draw the buttons (states 2-3).
- Port: ui.js:1321 steps ButtonState with b.on && shown, so the flash starts when the window is open.
- Effect: The default button flashes once as the window finishes opening; the game's is already steady.
- Reached: Every system dialog.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js dialog: the button states step from the first frame (their lit flash runs out unseen, as 0xae840 lights the button under the cursor from the opening), buttons show at t = 1.
- Compared: Native frames t5: the first frame with the buttons shows No lit and steady; the port's first shown frame has the flash at 0.

### N2-163: Auto on and under the cursor shows the on cell (low, confirmed)

Functions: `0xaeec0`.
- Native: 0xaeec0 draws cells[3] for id 0xd1 when Auto is on and the cursor is on it: table 0x5918c8 st3 rect (472,152), the lit art, not the on cell (472,224).
- Port: ui.js:2360 chooses row 3 (the on art) whenever d.on() is true, whatever p.sel is.
- Effect: With Auto on and the cursor on its button (the keyboard opens the panel on Auto) the port shows the on art where the game shows the lit art.
- Reached: The mode panel with Auto on.
- Second reading: confirmed.

### N2-164: A press can lose its ring when the first frame's timestamp is earlier than the press (low, likely)

Functions: `0xb8990`.
- Native: 0x1034 starts a record with time 0 and 0xe00 (every frame, 0xafa40 -> 0xad4b0 -> 0xe00) adds frames / 60 before setting up and registering the disc, so every started ring is drawn from the next frame on; a record ends only when time >= life (0xe68-0xe78).
- Port: touchfx.js:27 takes start = performance.now() in the pointerdown; touchfx.js:37 frame(now) filters with rippleAt((now - r.start) / 1000) using the rAF timestamp, and rippleAt (touchfx.js:13) returns null for t < 0, so the ring is removed before it is drawn. Run through node with a frame 0.5 ms before the press: rings 0, no fill, running false.
- Effect: A left press that lands after the display frame's timestamp but before the browser runs that frame's callbacks shows no ring at all; the press itself still works. Rare and cosmetic.
- Reached: Any left press on the picture; no script or data is involved. The code path is confirmed; how often the rAF timestamp precedes the event's performance.now() depends on the browser's frame timing and was not measured (no browser may be started here). Logging (now - r.start) on the first frame() over many clicks would confirm it; clamping t < 0 to 0 removes it.
- Second reading: confirmed.
