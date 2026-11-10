# Fix checklist: making the web port behave like the game

From [FUNCTION-MAP.md](FUNCTION-MAP.md) (2026-11-06). Each item links the subsystem file and finding number with the
native evidence; "web" says where the port does it today.

**How to mark an item:** change `[ ]` to `[x]` and add `— done YYYY-MM-DD: <what changed>; <how it was checked>` on the
same line (test name, browser check, or "no runtime check"). If an item turns out to be wrong or not worth doing,
mark it `[-]` with the reason. Update the progress line below after each item.

**Progress: 127 / 130 done, 2 dropped `[-]`, 1 open (N2, the re-check; 2026-11-10)** (section 1: 38 / 39 + 1 `[-]`, section 2: 27 / 28 + 1 `[-]`, section 3: 11 / 11, section 4: 50 / 50, section 5: 1 / 2)

Evidence files: [script machine](function-map/script-machine-state.md) (SM), [title, saves](function-map/title-menus-saves.md)
(TS), [flowchart](function-map/flowchart-widgets-tweens.md) (FC), [gallery](function-map/gallery-cg-music-movies.md) (GA),
[backlog, config, dialogs](function-map/backlog-config-dialogs-choices.md) (BC), [text](function-map/text.md) (TX),
[rendering](function-map/rendering-effects-animation.md) (RE), [audio](function-map/audio.md) (AU), and FUNCTION-MAP.md
(FM).

## 1. Story and progress (do these first)

- [x] **S1. Jump numbers 2000-2007 are swapped.** Native table 0x350d58 sends 2000 to `12_01_CIEL12_3C_FLAG0`
  (F069 = 1), 2001 to `…_FLAG1` (F069 = 0), likewise 2002-2007. Web: `web-dev/tools/build_core.py` lines 87-91 assign the
  reverse; rebuild `assets/scripts/index.json` and `assets/flowchart.json`. (SM 1, FM 1) — done 2026-11-06:
  build_core.py now exports the native table itself (`native_jumps`, 552 x u16 at 0x350d58, image hash checked); rebuilt
  index.json (only 2000-2007 changed, plus 110/3000/4000/8000 added and the made-up 296-299 / 791-844 gone; no script
  jumps to those) and flowchart.json (the 8 FLAG parts' scripts); test "S1" in function-map.test.mjs; not visible at
  one script position, so no browser check.
- [x] **S2. `SNX4` is not a native command.** Make `op_SNX4` do nothing; blur comes only from STCH/SCH2 args 9-10.
  Check `08_01_CIEL08_5` op 3346 (Noel sharp). (FM 3) — done 2026-11-06: `op_SNX4` is a no-op (re-checked in the
  listing: between NX1 and OXX the 'S' branch of 0x77790 compares only NX2 and NX3, else 0x77814); test "S2-S4" and the
  updated SNX2/SNX3 test; browser: `08_01_CIEL08_5` at op 3346 now draws Noel (layer 15) sharp, blurX/Y 0.
- [x] **S3. `STQK` is not a native command.** Make `op_STQK` do nothing (`QA_14` ops 1192, 1690, 1691). (FM 3) — done
  2026-11-06: `op_STQK` is a no-op (no "TQK" key in 0x77790); test "S2-S4"; browser: `QA_14` past op 1192, layer 29
  has no quake.
- [x] **S4. `WTSV` is not a native command.** Make `op_WTSV` do nothing and drop it from `WAITS`. (FM 3) — done
  2026-11-06: `op_WTSV` is a no-op and not in `WAITS` (0x77814 counts the command and runs on in the same frame, no
  commit); test "S2-S4", the VM-04 test in parity.test.mjs now expects no wait; no browser check (nothing drawn).
- [x] **S5. `SELR`'s third argument greys a row out.** Keep the flag; the row cannot be chosen or moved to (6 rows in
  4 choices). (SM 3, BC 2) — done 2026-11-06: SELR keeps rows in script order as {value, text, locked} and SELD stores
  the taken row's value (0xae09d8); locked rows are skipped by every key and ignore taps (`choiceStep`, `ChoiceFx.tap`).
  Correction: the row is not greyed — only SELR (writer) and 0x83e50 read 0xae09e0, the draw 0x84e50 does not, so it
  looks like the others. Tests "S5/S6", "S5/S7"; browser: `07_00_ARC07_3_1` op 593 with G003 = 0, Down from row 1
  goes to row 3 and a click on row 2 does nothing.
- [x] **S6. Choice rows are numbered** "1. …" from SYSMES 1433 + (row+1) % 10, also in the backlog's choice records.
  (BC 1) — done 2026-11-06: build_system.py exports SYSMES 1433-1442; `vm.choiceRows()` puts them before each row's
  text (listing 0x7dab8: strcpy then strcat; the texts start with a space). The backlog has no choice records yet: they
  come with M2. Test "S5/S6"; browser: "1. I need more details on vampires." etc.
- [x] **S7. Choices, SELS and SELA start with nothing selected;** Enter does nothing until a direction is pressed;
  wrap only on a fresh press; hover does not move; tap selects, second tap takes. (BC 3) — done 2026-11-06: ChoiceFx
  starts at -1 (no glow, underline or streak), Up/Down from nothing pick the first free row, Left/Right first/last on a
  fresh press, the wheel moves and wraps, key moves are silent (the listing's only cursor sound is the tap's,
  L_84694); story yes/no (`storyDialogKey`): neither selected, Up = No, Down = Yes, Left/Right as 0x83e50 modes 2-3,
  B ignored; held gamepad directions now send `repeat`. Tests "S5/S7", "S7" and the updated ChoiceFx tests; browser:
  the choice above and the SELS dialog (Enter and Escape do nothing at first, Right held stays on Yes, a fresh Right
  wraps to No).
- [x] **S8. CLO2-CLO5 end the frame,** committing waiting layer changes (add them to `WAITS`; 28 places). (SM 2) — done
  2026-11-06: CLO2-CLO5 are in `WAITS` (re-checked: every CLO path returns through 0x7fef0, and 0x802c0 calls
  0x5d3a0(0, 0) after the interpreter returns when +0x7ca is set); test "S8"; browser: `04_01_CIEL04_1` at op 1128
  layer 34 is already off screen and the FADS at 1131 has nothing left to fade.
- [x] **S9. RDED ends a gallery replay** at the scene's end and returns to the gallery (F024). (SM 4, TS 3, FC 5) — done
  2026-11-06: in a replay `op_RDED` ends the script when 0x92440 completes the scene (as RTM_, 0x7f9e8); replays start
  as ARCHIVE starts them (F024 = F025 = F028 = 1, F026 = the jump number); the gallery flowchart plays a node at once
  (0x11418 -> 0x5040, no dialog) and comes back to the gallery's flowchart. Test "S9"; browser: node 54 from the
  gallery flowchart played `01_00_ARC01_4`, its `RDED 54` ended it and the gallery flowchart came back.
- [x] **S10. Flowchart current scene comes from the JUMP;** RTST sets it only for episodes 533-557 or in a replay;
  RDED completes only the current scene (25 jump pairs). (FC 1) — done 2026-11-06: `FlowProgress.read/finish/jump/mark`
  follow 0x92770 / 0x92440 / 0x95790 / 0x954b0 (a JUMP marks only real scenes 1-530 -> >= 1; F110 otherwise
  untouched); the `flowFrom` work-around is gone. Test "S10"; browser: `01_00_ARC01_4_3` -> `01_00_ARC01_4_1`, the
  shared `RDED 55; RDED 57` completed 57 only, and the next JUMP made 58 current through row 57 -> 58.
- [x] **S11. 0x93d10's 84 special (from, to) cases** for flowchart lines, exactly (`function-map/flowchart-jump-special-cases.txt`).
  (FC 2) — done 2026-11-06: the table (60 groups, 84 pairs, the default 485 -> 528 -> 486 rule) was converted mechanically
  into `SPECIAL_JUMPS` in flowchart-model.js (conditions on path bits, F050, F054 and the last answer index, virtual
  node marks, direct line bits, keep-current results), replacing the breadth-first search; spot-checked against the
  0x93d10 decompile (51 -> 69, 101 -> 102, 136 -> 137). `vm.lastChoice` holds 0xae0aa0 (SELD row, SELS answer).
  Test "S11"; browser via S10 (55 -> 58).
- [x] **S12. SELD's hand-written extras (0x92a60):** connectors 1168/1120 never marked; virtual nodes 512/513/523/517.
  Fix the CHOICE_EXTRA comment in `native_flowchart.py`. (FC 3) — done 2026-11-06: the extras moved to run time
  (`SELD_EXTRA`, `FlowProgress.choice`): virtual nodes 512/513/523/517 started + completed + on the path (current in a
  replay), 1168 / 1120 only while 270 / 446 is off the path. Correction: "never marked" is wrong too — the scripts run
  RTST 270 / 446 only when F069 is 1 (else 483 / 447), so the line appears on the F069 = 0 side; both comments fixed,
  `choiceFlags` now holds only table 0x3594d0. Test "S12"; browser: `12_01_CIEL12_3C` choice 72 with F069 = 0 marked
  523 and line 1168.
- [x] **S13. Flowchart rewind keeps about 340 variables** (route flags F054-F074, path bits) and rolls back only later
  rows (0x178c8, 0x17af0, 0x92500, 0x92540, 0x95800). (FC 4) — done 2026-11-06: main.js `rewindTo` clears the path
  bits / path lines of later rows (from the last back, stopping at day-0 rows), applies 0x95800 (19 flags: F054-F069
  and F072-F074, not F070/F071) and starts the scene with what 0x178c8 keeps: fixed fields, the 274-entry keep list of
  0x34ba16 (low byte, sign-extended) and the 42 flags of 0x34bc6e as 0/1, now exported as `rewind` in flowchart.json;
  F1103 = 1, F026 = the jump, current = the node. Test "S13"; browser: from `12_01_CIEL12_5` back to scene 51 cleared
  F054/F057/F059/F062/F063/F069, kept F070, F075, F100, F822, dropped F500, and 270 left the path.
- [x] **S14. First launch and New Game order:** scene 485 not started → no TM_CI/notice, 00_01 at once with the
  opening unskippable, then title variant 0, cautions, START_SCRIPT; once started → TM_CI, notice, title, and New Game
  goes straight to START_SCRIPT. (TS 1, FM 2) — done 2026-11-06: main.js keeps the per-boot flag 0xac0de0
  (`firstLaunch`); `boot()` shows TM_CI and the notice only when 485 has started, else 00_01 starts at once; 00_01's end
  goes to the title, which on the first launch is variant 0 "press any button" (G002 = 0, G010 = 1, music 2; press:
  sound 6, music fade 0.5 s, black, cautions, white at 0.01 to 1.2, START_SCRIPT); later the menu, whose New Game goes
  to START_SCRIPT without the opening or cautions (00_01 only while 485 has not started). Browser, with an emptied
  profile: the opening started at once and ignored clicks, then press-start, the two cautions, white and `00_00`;
  reloaded: TM_CI, notice, menu, New Game straight into `00_00`.
- [x] **S15. Story movies play while skipping;** movies 4/5/6/35/36/37 cannot be skipped until seen (G005); prologue
  starts music 2 at 360 s; cover fades; movie 13 plays menu sound 7 at frame 210. (GA 14) — done 2026-11-06:
  `playMovie(name, {story, number, seen})` puts skip/auto aside and restores them silently; `STORY_MOVIES` /
  `movieLook` (uifx.js, from 0x40480's listing): the six wait for their G005 bit, which the movie's end sets; covers
  (white for 5 and 37), 48-frame fades for the chapter titles, a 60-frame fade on a pass; the prologue starts music 2 at
  frame 21600 or on an early pass; sound 7 (now `playSys(n, "se")`, 0xacfa0) at the start of the chapter titles 8-12 /
  14-34 — which the evidence did not list — and at frame 210 of 13; TOMP also closes the window (F1103). Test
  "S14/S15"; browser: the prologue (above) set G005 bit 2 and started music 2 past 360 s; `03_00_ARC03_1`'s chapter title
  played through a forced skip, sound 7 at 0.01 s, skip back on after.
- [x] **S16. Read-scene skip is an instant run** to the next ATSV, SELD, RTM_/END_/ending RDED, XSTP or unread line,
  after a 4-frame countdown (20 after a Yes). (SM 5) — done 2026-11-06: `op_RDAS` (not while an instant run is going
  or loading; skipping does not block it, 0x5afb0 reads the load-run flag) asks dialog 10 only with "Display
  confirmation", then counts 4 / 20 frames while the script goes on and calls `vm.beginInstant()`: skip on, no
  per-frame pacing, one-shot SEs dropped; `endInstant()` at ATSV, SELD, SELS, SELA (0x92800 / 0x92930 clear it too),
  RTM_/RTMN/END_ (and a replay's RDED via RTM_), XSTP, TOMP (0x6ef30), and a message unread with "Read" or with F998
  set. The old "skip until the next JUMP" is gone. Test "S16"; browser: `01_00_ARC01_1_2` with scene 49 completed and
  fast forward on "Full" ran its 73 messages and stopped at `01_00_ARC01_2`'s ATSV.
- [x] **S17. Skip toggle semantics:** stays on at unread lines (pauses, resumes at read text) with "Read"; not cleared at
  choices unless config +0x2c; B clears it. (SM 7) — done 2026-11-06: `vm.pauseSkip/resumeSkip` (`skipOn` for the
  indicator, panel and B / Backspace): on "Read" the toggle and held fast forward wait at unread text and go on at the
  next read line, on "Full" they pass it; choices, SELS and SELA no longer clear skip or auto (+0x2c is 0 and no
  setting changes it); VPLY keeps the pending voice while skipping so a line skipping stops at still speaks; the
  "Stopped at unread text" toast is gone. Test "S17"; browser: in `01_00_ARC01_1` skipping waited at the unread line
  (indicator on), went on through read lines after a click and waited again at the next unread one.
- [x] **S18. A click ends `VCWT`'s wait** (75 calls); stop the voice per "Voices stop on input" and F1123. (SM 8) — done
  2026-11-06: `op_VCWT` waits only while a voice plays and races the voice's end with a click (or skip); a click stops the
  voice when "Voices stop on input" is on and F1123 is 0. Test "S18"; no browser check (the automated pane has no user
  gesture, so Web Audio never starts a voice there).
- [x] **S19. `XRSM` restores the skip/auto state `XSTP` saved.** (SM 9) — done 2026-11-06: main.js `lockControls` keeps
  the skip toggle and auto at XSTP (0x40b70) and puts them back at XRSM (0x40c60), silently. No unit test (main.js has
  no node harness); browser: `13_01_02_CIEL13_7B` with G70 = 0 and auto on: XSTP at op 2341 turned auto off and locked,
  XRSM at op 2427 turned it back on (indicator shown).
- [x] **S20. Checkpoints** at ATSV, SELD and the first line of a page only; ATSV also while skipping. (SM 10) — done
  2026-11-06: `savePoint` is set by ATSV (also while skipping; flag 8 and test jumps excepted), by SELD (the choice's
  own command, so a save there asks again), and by the first wait of a page whose line had F823 < 2 (0x6e0d0); a
  restore makes the restored point the checkpoint. Test "S20" and the updated VM-01 tests; browser: in
  `01_00_ARC01_1` the checkpoint moved 119 -> 155 -> 226, the first lines of three pages, and stayed through their
  other lines.
- [x] **S21. Mode panel:** button 0 = "Return to Previous Scene" (dialog 11, restore previous checkpoint, 0x81a50),
  button 4 = "Jump to Next Scene" (dialog 10 + instant run). (SM 6) — done 2026-11-06: ATSV (without flag 4) pushes its
  checkpoint on `vm.scenePoints` (ring 0xae04a0, 299) and sets `nearScene` = 2, one less a message (0x146e66c);
  `vm.previousScene()` follows 0x81a50 (at a choice or within two lines: the point before, else the last). The panel's
  first button asks dialog 11 and its fifth dialog 10 (both always, starting on No: 0x40ed0 calls 0x49710(n, 1)), waits
  20 frames, then restores / starts the instant run; "Previous choice" and "Skip to next choice" are gone (RDAS's dialog 10
  now starts on No too). Test "S21"; browser: in `01_00_ARC01_1` "Return to Previous Scene？" opened on No and Yes went
  back to the ATSV at op 12; "Jump to Next Scene?" ran from op 112 to the ATSV at op 2636.
- [x] **S22. Save list:** used manual slots 0-99 only, newest first, plus the lowest empty slot when saving; automatic
  saves are not listed (Continue only). (TS 4) — done 2026-11-06: `ui.savesScreen` lists used slots 0-99 by date
  (newest first, stable) with the lowest empty slot first when saving; automatic saves are no longer listed (the
  `saveauto` mark went with them). Asset test "S22-S30"; browser: an empty profile showed one empty row, after saving
  [empty slot 1, used slot 0].
- [x] **S23. Save prompts:** empty slot saves at once with "Saving"; used slot asks "Overwrite?"; Load asks then shows
  "Loading"; empty list "Data not Found". (TS 5) — done 2026-11-06: empty slot -> saved at once with the "Saving" notice
  (SYSMES 183); used -> dialog 2 "Overwrite?" (SYSMES 180, starting on No); Load -> dialog 0 then "Loading" (184); no
  saves -> "Data not Found" (212) in the list. Saves hold the checkpoint (0xf17ff8; refused with sound 2 before there is
  one). `ui.notify` is a plain notice in the dialog window (its look is M8). Browser: saving into the empty slot asked
  nothing, showed "Saving" and stored op 151 (the page's first line); "Overwrite?" opened on No.
- [x] **S24. Return to Title does not ask in normal play** (F024 == 0): sound 1, automatic save with "Auto Save" popup,
  fades. Only replays ask dialog 8. (TS 2) — done 2026-11-06: `ui.returnToTitle` -> `toTitle(..., {fromStory, fade})`:
  the automatic save, the menu closes, the story fades to black at 0.02 a frame (`fadeToBlack`), then the title; in a
  replay dialog 8 (SYSMES 229, on Yes) first. Browser: no question, automatic saves 10 -> 11, black at 0.25 a quarter
  of the way, then the title.
- [x] **S25. Gallery replays:** Save/Load refused (sound 2, grey cells), quick save/load disabled, FlowChart asks
  "End Scene Playback?" (dialog 12). (TS 3) — done 2026-11-06: in a replay the menu's Save/Load are drawn at 0.3 and
  refuse with sound 2, the panel's quick save/load are off (and refuse with sound 2), and a replay begun from the
  gallery's flowchart answers FlowChart with "End Scene Playback?" (SYSMES 234, on Yes), whose Yes goes back to it.
  Browser: Save played sound 2 and stayed on the menu; from a real gallery-flowchart replay of scene 49 the question
  came up and Yes returned to the gallery's flowchart. (The "other cells" are approximated by the 0.3 alpha.)
- [x] **S26. Chapter cell, info picture and scene name from F023/F022** through tables 0x591558, 0x592484, 0x3506b0 and
  SYSMES 395 + F022 (222 of 518 scripts differ). (TS 6) — done 2026-11-06: build_system.py exports `saves`
  (phaseCells, saveTitleCells, infoPictures with slots 548-550 resolved to saveinfobg_arc / _ciel / _unknown through the
  slot records at 0x592348, sceneNames for F022 1-516) and `dialogs` (0x3c9340); the header draws its cell at (8, 0) and
  the scene name in its band, each save row its cell and scene name, the panel its picture. Asset test "S22-S30";
  browser: `04_00_ARC04_9` (F023 9, F022 103) showed "4 / Infernal River of Blood I" and "Blue Flame" in the header
  and the row.
- [x] **S27. Quick save/load:** 180-frame cooldown; Quick Load refused when slot 139 is empty; its dialog shows the
  quick save's picture; quick save stores the checkpoint. (TS 7, BC 11) — done 2026-11-06: every save starts a 180-frame
  (3 s) cooldown in which quick save is refused with sound 2; quick save stores the checkpoint; quick load is refused
  without a quick save and asks dialog 9 on No with the quick save's picture (question at y 160, picture framed from
  y 200, buttons at 261.5 of 448, after 0x4ae90). Browser: the second quick save within 3 s played sound 2; the dialog
  showed the picture (screenshot checked). This also covers M14.
- [x] **S28. Continue and the title cursor:** Continue only when the newest record (slots 0-138, not the quick save)
  exists; "Loading", music fade 1.5 s, black at 0.01/frame; first cursor Continue, else Load, else New Game. (TS 10) —
  done 2026-11-06: `ui.newestRecord()` (manual + automatic, not the quick save) decides the Continue row (4 rows
  without it); the first cursor is Continue, else Load with a manual save, else New Game (GALLERY when coming back);
  Continue shows "Loading", fades the music over 1.5 s and black at 0.01 a frame, then loads. Browser: 5 rows with the
  cursor on Continue, which loaded the newest record (op 151) after 2.3 s.
- [x] **S29. Story end:** END_ fades to black at 0.02/frame before the title; RTM_ saves system data first; no
  "End of the scene" toast. (TS 11) — done 2026-11-06: a script's end (RTM_, RTMN, END_) fades the story to black at
  0.02 a frame before the title, with no toast (system data is saved as it changes here). Browser: the end of `00_01`
  reached black in about 50 frames, then the title menu; no toast.
- [x] **S30. Completion banner** SYSMES 239 on the title once episodes 1-24 are complete (G069). (TS 8) — done
  2026-11-06: `ui.completionBanner` (0x90440 / 0x91350): once `allEpisodesDone` and G069 is 0, G069 = 1 and the band
  (770-1880 x 960-1035, edged blue over black) comes in over 30 frames rising 120 px (cubic out), stays 300, goes over 30.
  Browser: with scenes 533-556 completed it showed once and set G069; the next title did not.
- [-] **S31. SELS is not asked while skipping.** (FC 11) — not done 2026-11-06: the premise is wrong. 0x92800 returns
  early on 0x5afb0, which reads the slot 0xae0900 = 0x146e638 (resolved from the RELATIVE relocations), the load's
  silent-run flag, not the skip toggle (0x1916dec); so SELS is asked while skipping, as the port already did. The same
  holds for SELA (0x7f6bc -> 0x85bf0 tests only F1118, 0x92930 the same flag): the port passed SELA while skipping and
  now asks it (vm.js `op_SELA`; VM-01 test updated).
- [x] **S32. The in-game flowchart is refused** during the prologue and the Ciel-sensei episodes (SYSMES 1496); the
  gallery's Flowchart likewise before scene 1. (FC 6, GA 12) — done 2026-11-06: the menu's FlowChart opens only when
  scene 1 is on the path and the current scene is not 533-557 (0x1767c), else the notice "Flowchart is not yet
  available"; the gallery's Flowchart shows it while scene 1 has not started (0x14cfc(1)). Browser: from a play begun at
  `04_00_ARC04_9` (scene 1 not on its path) the menu showed the notice.

Items S33-S39 were added 2026-11-07 by the re-check of functions counted as handled (N2, [REVERIFY.md](REVERIFY.md)).

- [x] **S33. Read state is the game's per-block mark.** (0x53a60, 0x77790 case Z at 0x78070, 0x6e0d0) Every Z command
  (a message's `ZMbbbii` name, and the labels' `ZZ` / `ZY`) first raises the byte of the Z command before it to its
  index (system data +0x667, 4020 bytes, one per block; no test of skipping or the silent run, so text passed by fast
  forward is read too; a `ZY` has index 0 and never raises one), then makes its own block / index current; a message
  is read when its block's byte is set and not below its index. 769 block numbers serve in more than one script (355
  message slots in 27 scripts name different lines), so reading one script's message makes another's read. During a
  read scene's instant run every Z command, labels included, ends the run while F998 is set or when it is unread with
  fast forward on "Read" (597 of 615 label-only blocks are 0 in the 100% reference save, so such a run stops at the
  first `ZY` label it meets). MSAD has no Z command and keeps the message's flag (0xae08c8). The port had a bit per line,
  set at display and not while skipping, and tested the instant run only at messages. — done 2026-11-07:
  `build_core.py` keeps each message's block / index (`zm`) and the label Z commands before each op (`zl`, rebuilt:
  only the scripts gained them, every other asset byte-identical) and writes `scripts/zlines.json` (line -> block /
  index) for carrying old per-line bits over once; `vm.js` `zStep` / `zRead` / `readBlocks` (localStorage
  `tsuki.readBlocks`), the label Z commands run before their op from the label a jump named, MSAD keeps `msgRead`,
  snapshots keep the current Z command; the per-line bits stay only for the one-time inferences of older progress.
  Tests "S33" (six, `tests/reverify.test.mjs`); browser: the user's 86 read lines became 21 blocks, block 0x47 rose
  1, 2 as lines 2, 3 came, a rewind left line 3 unmarked, and line 2 came back at the read speed; smoke test 549
  scripts, no errors; the profile's storage was restored afterwards (hashes checked).
- [x] **S34. Restores put the recorded sound back as 0x5d7e0 does.** (0x5d7e0, 0x82330 / 0x826f0, 0x5d950, 0x5d710,
  0x28d50, 0x814c0, 0x81a50, 0x649e0) Every restore plays the recorded music with its loop flag on at level 100, then
  its volume (the number already playing goes on, 0x9c470), starts every recorded loop again from its top (0x9caa0 ->
  0xedd28 stops what the handle played) and stops the other channels, then clears the layer records' tween offsets
  (0x328f0: fades and moves under way are at their ends). A load and Return to Previous Scene stop all sound first
  (0x5ef10) and the backlog's Quick Jump the music (0x9c610), so their track starts again from the top; a rewind keeps
  it. During a read scene's instant run the sound commands only record (MPLY / MVOL / MFAD / SEPL / SEVL / SEFD test
  0xae0568; no 068 delay is queued) and each place the run stops plays the recording the same way (TOMP's stop,
  0x6ef30, does not). The port kept a playing loop, kept 049, resumed tweens, and played sound live through the run. —
  done 2026-11-07: `audio.js` `restore(s, { restartMusic, stopVoice })` and `playSE(..., { restart })`; `vm.js`
  restore finishes tweens and passes `restartMusic` (load, Quick Jump, Return to Previous Scene), `beginInstant` /
  `endInstant` with `recordMusic` / `recordSE` and `finishTweens`. Tests "S34" (three).
- [x] **S35. Numbers stop at "."; STCH / SCH2 alpha within 0-255.** (0x2d3c -> tokenizer 0x3160 returns at '.', 0x60840)
  STCH's 27 decimal alphas (173.4 is 173, 0.01 is 0) and SSW2's factor 0.5 (it reads 0, so `SSW2(33,1,6,500,600,0.5,...)`
  sways nothing) were read with their fractions; four STCH alphas of 256 are 255. — done 2026-11-07: `vm.js` `num`
  keeps a decimal's whole part, `clampAlpha` for STCH / SCH2. Test "S35".
- [x] **S36. A picture counts as seen at the commit.** (0x5d3a0 -> 0x774f0 for all 40 layer numbers) The port marked it
  when STCH / SCH2 staged it, so a picture staged and replaced before the screen changed (`11_00_ARC11_1` op 114,
  img1644) counted. — done 2026-11-07: `vm.js` `commit` marks every layer's picture. Test "S36".
- [x] **S37. Fast forward and timed things.** Found re-checking 0x2d3c / 0x81b30 / 0x802c0, not yet confirmed running:
  no tween, motion, transition or effect handler reads the skip flags (0xae0660 / 0xae0670): STGS / STRT / STZ4 / STCL,
  STMA, FADS (only the instant run), SQK2 / SHK2 / SSW2 / SHOK (only a load's silent run drops one with a time), MSQK
  (none), FADE 40 / 41 and FCSP; the layers advance by real elapsed frames (0x3c970 gets 0x4a5b0's count, no skip
  factor); STCF's wait (0x802c0 bit 5) clears only when the tweens are done; a fixed WTTM (second argument 1) is not cut
  short by skipping (0x81b30 ends one early only on an advance when not fixed). The port makes tweens, motions, FADS and
  every WTTM instant while skipping and drops effects (`finishAnimations`, `this.skip ? 0`). Settle with a native run
  (ZR held over a stretch with fixed WTTMs, STGS fades and STCF) before changing the port's skip model.
  — done 2026-11-09 (TODO item 110): settled on native runs with ZR held. The game's frames go on, each worth 33 to the layers, the
  window and FADS's level and 64 to a WTTM; nothing is cut or dropped. `vm.js` `tick`, `sleep`, `fade`, `speeding`; tests in
  `item110.test.mjs`. FIXES.md, "TODO item 110".
- [x] **S38. Does a rewind replay the line's voice?** — settled 2026-11-08 from the listing, ticked 2026-11-10: a rewind starts no voice (`0x5baf0` with param 2 = 1 clears the pending voice at `0x5d218`), as `vm.js` `restore` does (`voice = !rewind`); Quick Jump and a load do play it. See FUNCTION-MAP.md, corrections of 2026-11-08. The port's rewind and Quick Jump play the restored line's voice
  (`vm.restore`, rewind); 0x814c0 stops a voice that is playing and 0x5baf0 only puts the record's voice back as the
  pending one (0xae04c8, cleared again on the page-rebuild path). Check in the listing (and a native run) which plays.
- [x] **S39. Delayed sound commands in records.** — done 2026-11-08, ticked 2026-11-10: each channel's 068 delay slot is kept in the records (`vm.js` snapshot `delayed`). 0x5baf0 restores each channel's 068 delay slot (0x146ea98, 20 bytes a
  channel) from the record; the port's snapshots drop the commands still waiting (`vm.delayed`), so a save or rewind
  made inside a delay loses them.

## 2. Look

- [x] **V1. `STRA` heat haze:** 0x362a0, table 0x352bd4 (557 x 10 floats), `haze` shader (569 calls). (RE 1) — done
  2026-11-06: build_effects.py exports the table (effects.json `haze`); vm.js keeps STRA per layer number as 0x645f0
  does: the record on screen (+0x238..+0x240) and the state +0x1364 that every commit copies into it (0x5d3a0 ->
  staged +0x238 -> 0x3c970), so `STRA n` with no time shows at once, with a time n waits for the next commit (and fades
  in over p9), `STRA 0 ms` fades out until a commit cuts it; STCH/SCH2 clear the record (0x32930) but keep the state,
  SCH2 from another layer copies it, STCC clears it, STNS now also ends the frame with a commit (+0x7ca); the layer
  shader shifts the texture coordinate as nexl_nxshader_haze does with 0x362a0's constants (render width 1920 / 1024,
  texture = stored size), not with STNS grain, and outside a panel without STTR's rule. Correction: the shader is SPIR-V
  33906951eb996a33; 4bbde4e2ca02d2dc is nexl_nxshader_wave (it uses u for the y wave). Tests "V1" (3); browser:
  `12_00_ARC12_2` at op 1167, layers 5 / 9 (entries 286 / 287) waver: 28,049 pixels change in 0.7 s, none with the
  table removed.
- [x] **V2. `STZ4`'s 8th argument** zooms along the screen axes after rotation (55 calls). (RE 2) — done 2026-11-06:
  confirmed in the listing (0xbbb28: the three axis vectors of the finished matrix get their x / y parts multiplied by
  the pair at +0x568 / +0x56c, the fourth, which receives the position, does not: a screen-axis stretch about the
  anchor after the rotation); `op_STZ4` keeps the flag on the layer (`stretch`; blank keeps it, as state +0x874 does;
  STCH and SCH2 clear it, 0x60840), transform.js `place` leaves the zoom out of the picture's scale and hands it over
  as `stretch`, renderer.js `stretchMatrix` applies it about the anchor (correction, see V6: STCH and SCH2 with a
  source layer copy the source's flag; only without one do they clear it). Test "V2"; browser: `05_00_ARC05_1C` at op
  1234, layer 34 (img2138 at 1441 x 743, turned 82.47 degrees) now spans 3815 x 1947 px, level, where the port drew
  2180 x 3560 (the oval turned upright); 1.1 M pixels differ.
- [x] **V3. A layer linked to an absent owner is not drawn** (~20 cases). (RE 3) — done 2026-11-06: re-read in the
  listing (0x37ff8-0x38030: link >= 0 and the owner's record empty, +0xc == 0, or +0x20 set -> alpha factor 0, and
  0x37f50 draws nothing); transform.js `place` gives such a layer alpha 0 when its link names no layer on screen. The
  +0x20 case (a flag on a record that is there) has no counterpart in the port and was left. Test "V3"; browser:
  `13_01_01_CIEL13_5B`, layer 3 (z20_a_53_03_n00, linked to 32, which op 5902 clears) is no longer drawn; at the
  message before op 6108 the old placement would differ by 19,020 pixels (earlier waits there are covered by black).
  Settled 2026-11-07: the owner's +0x20 is filled each frame by 0x3c970 (unrolled at 0x3dbf4): 1 once a lower layer
  has a staged per-layer transition type (+0x1c, 1-0x22, mask 0x3e7fbefff); that type is only ever written as 0
  (0x3c550, 0x328f0, 0x3c970) or restored from a save of it (0x5baf0), and FANX, the one command that could start one,
  is not dispatched, so +0x20 is always 0 and the check never fires; the port, which has none, matches. SACL (RE 5d):
  0x37f50 copies the link's clip into the record only without SACL, but the draw task groups layers by link alone
  (0x3bba0) and composites the group through its owner, so a SACL layer stays in the panel as the port draws it (tried
  without: `08_01_CIEL08_4_1` op 177 spills Arcueid past her letterbox strip).
- [x] **V4. Layers with z <= 0 are not drawn;** a blank STCH z is id x 10. (RE 4) — done 2026-11-06: re-read in the
  listing (0x3bba0 at 0x3c198: `ldr w8, [z]; cmp w8, #1; b.lt` skips the layer; 0x60840 in STCH mode stores id x 10
  for a blank z, SCH2 keeps the source's, STCC resets it to 0 in 0x62140); renderer.js draws a layer only with z >= 1
  (`drawn`), still placing hidden layers as parents and links; `op_STCH` takes id x 10 for a blank z. Test "V4";
  browser: `14_01B_03_CIEL14B_5` at op 491, layer 20 (STCP 0 at op 481) is no longer drawn; drawing it at the bottom
  changes no pixel there (with the clock held), so the evidence's one visible case is covered by an opaque picture in
  the port too: the change shows only in transitions and in blends that read the backdrop.
- [x] **V5. Panel edges:** feathering at/past the screen edge (147 panels); frame style 7 = doubled feather, no band
  (37 calls). (RE 5) — done 2026-11-06: re-read 0x32e30 (mask) and 0x34a70 (band): both cut the width to half the
  clip's width and height, feather every side of a turned panel, and otherwise a side unless the clip's edge is the
  width or more past the screen's (x > -b, x + w < 1920 + b, likewise down), none across / down for a clip exactly as
  wide / tall as the screen; the mask's width is STCH arg 16 rounded up to even and doubled for style 7, the band only
  for styles 1-6 and widths of 2 or more. transform.js `clipGeometry` now returns the mask edges and a separate `band`
  (renderer.js `drawFrame` draws that). The six blob sizes by width (5c) were done 2026-11-07: half-sizes 10, 32, 40,
  64, 128, 256 (0x34d81c) pick alphagradation020..512 (slots 0x34d7d4 in pack order plain, _inv, _2) for the mask, the
  _2 one for style 7; and the band is drawn as 0x34a70 does (UV rects 0x572990): twice the width in from the edge,
  rising across the plain blob to its peak at the width and falling back, plain quarters at the outer corners and _inv
  ones inside, where the port drew a plateau between the outer and inner rectangles (renderer.js bandBlob, FS_FRAME;
  browser: `08_01_CIEL08_4_1` op 184, the black band darkest 60 px in, at y 268 and 812). 5d: see V3; 5e (the group
  composite) as V12 left it. Test "V5" and the two updated panel tests in transform.test.mjs; browser:
  `04_00_ARC04_6_2C` at op 484, layer 36 (style 7, clip 10, 514, 1904 x 568) fades over 60 px on all four sides with
  no black band; its bottom row (y 1079) reads 31 against 255 inside, where the old rule cut it hard.
- [x] **V6. `SCH2` resets the blend mode** (QA_21, 3 calls). (RE 6) — done 2026-11-06: re-read 0x60840's end
  (0x62088-0x620b8: every STCH / SCH2 path stores 0xff, normal, in STBR's state +0x7c unless F982 >= 1 and the picture
  is not a solid colour; no script sets F982); `op_SCH2` no longer copies the source's blend. Correction: the three
  QA_21 calls (ops 1275-1281) name other layers as their source (24, 11, 12), whose blend is already 0 in the port, so
  they did not change; a static scan finds 17 other SCH2 calls that copied a blend. Test "V6"; browser:
  `05_01_CIEL05_4` at the message before op 891, layer 12 (img2230, SCH2 from layer 4 with blend 22) draws normally;
  the copied overlay would change 619,866 pixels (clock held). Zoom (checked 2026-11-06): 0x60840 (listing
  0x60bd8-0x60d84) sets the zoom target (state +0x7d4 / +0x824) to 1000 and STZ4's eighth-argument flag (+0x874) to 0,
  then with a source layer (argument 18, 0-39) copies the source's target and flag; it leaves the live zoom alone, and
  the commit (0x5d3a0) puts every layer's zoom at its target with a zero-length tween (`0x31f30(.., 0)`), so a zoom
  tween still running on any layer ends at the commit. 4,673 of 4,674 SCH2 calls name a source and keep its zoom, as
  the port already did; the one without (`10_01_CIEL10_4_2C` op 438) makes layer 18 from nothing and is zoomed by an
  STZ4 in the same frame; only 2 STZ4 calls tween, and no commit cuts either visibly. So nothing on screen changes,
  but `op_SCH2` now follows the listing (source's target and flag with no tween, else 1000 and no flag; this corrects
  V2, which had cleared the flag on every SCH2) and `commit()` ends running zoom tweens. Test "V6 (zoom)"; browser:
  `01_00_ARC01_3_1` op 434 (SCH2 3 from 39) keeps 39's flag and zoom, `10_01_CIEL10_4_2C` op 438 gives 1000, then
  1033. STCH's source layer (fixed 2026-11-07): 0x60840's copy branch (listing 0x60bf0-0x60fb8, 0x61190-0x61aa0) runs
  for STCH as for SCH2 when argument 18 names a layer 0-39. It copies the source's x / y, alpha, z, rotation, scale,
  pivot, SACL, SBAS parent, link, SOXY, panel clip / edge / frame / turn, STEC's colour, SNX2 / SNX3, motion, quake /
  shake / sway, haze state (+0x1364) and STZ4's zoom target and flag, then moves every layer linked to the source, and
  every SBAS child of it, to the new layer. STCH's own defaults come after: alpha 255 and z = layer x 10 when blank,
  rotation 0, the picture's own pivot; a blank x, y, scale or panel argument keeps the copied value. Both reset STTR's
  rule (0x61adc) and the blend; neither touches STNS's grain (+0x13b4), which stays with the layer number. `op_STCH`
  ignored argument 18 (and dropped the grain); it now copies (vm.js `copyLayer`, `relinkLayers`), and `op_SCH2`
  follows the same branch: the relink, no rule, the layer number's grain, and without a source SACL, quakes, SNX2 /
  SNX3, STEC, the link and the motion start again (0x60fbc on). A headless replay of the 549 scripts, each call put
  back to the old form in turn and the layers drawn at every wait compared (a layer counts when its drawn quad crosses
  the screen; cover by opaque pictures above is not modelled), finds 50 of the 201 STCH calls change what is drawn: 20
  in the new layer (14 position or size, 3 the panel, 3 colour) and 33 through layers linked or parented to the source
  (3 calls both); and 39 of the 4,535 SCH2 calls reached (37 relinks, 1 STTR rule, 1 grain); the one SCH2 without a
  source changes nothing. Test "V6 (STCH source)" and the expression-change test in effects.test.mjs (a SCH2 without a
  source now starts STEC / SNX2 again); `/smoketest.html` clean. Browser: `10_01_CIEL10_5` ops 2091 / 2093 (STCH 10
  from 8, 11 from 9, the focus pull back): Ciel's sprite stays mirrored at 0.8 and the backdrop at 1.5, as on layers 8
  / 9, where the port drew them unmirrored at 1; the old zoom changes 1,499,660 pixels (clock held). Blank arguments
  without a source (fixed the same day): 0x60840 writes x, y, the scale and the panel only when given (listing
  0x61e30-0x61f54), so STCH and SCH2 without a source keep the layer number's own values for them, and its SBAS parent
  and SOXY too (the branch without a source starts only SACL, quakes, SNX2 / SNX3, STEC, the link and the motion
  again); a number with no layer, never used or cleared by STCC, holds x 0, y 0, scale 1000 (0x57450 sets every layer
  so at the start, 0x62140 at STCC), and so does an empty source. vm.js `startLayer` / `slotLayer` follow that,
  counting STCC at once rather than at the commit; the port had started such layers at 240, 136 with nothing kept. 485
  calls now start differently (475 STCH and 2 SCH2 in x / y; 4 STCH keep a parent, 3 a panel, 1 an SOXY offset); the
  replay draws 7 of them elsewhere, all solid black pictures, so no pixel changes: img5007 (3840 x 2160, covering its
  panel either way) in 4, and the img0597 card under the scene in `05_00_ARC05_3_1` op 70 and two like it (set-ups
  that run only when a scene is entered directly, F026). Tests: "V6 (STCH source)" (a number holding a layer, one
  cleared by STCC) and SGMA's test in motion-fields.test.mjs (its blank y is 0); 165/165; `/smoketest.html` clean.
  Browser: `05_00_ARC05_3_1` at op 80, layer 1 (img0597) at 0, 0; drawing it at 240, 136 changes 0 of 2,073,600 pixels
  (clock held), also with the layers above it hidden. Pivot and empty numbers (fixed the same day): SCH2 from a source
  moves the source's pivot by the new picture's table pivot less the source picture's (listing 0x60cd0-0x60d00), and
  without a source takes the new picture's own (0x62024), where the port kept an STPV pivot as it was (vm.js
  `movedPivot`); and a layer number keeps its state with no picture on it: STCP, STGS, STRT, STZ4, STBR (0x62a40,
  0x637a0, 0x62b20, 0x62d20, 0x62490), SBAS, SOXY and SACL (the interpreter, 0x7afec on), STPV, STCL and STNS write it
  with no picture check, STCC resets it, and the next STCH / SCH2 starts from it (vm.js `stateFor`, kept in saves);
  STCP's blank z is 0 (4 calls), where the port kept the old z. The replay changes in 4 scripts: `08_01_CIEL08_3B` op
  4200 (SCH2 33 from 32: Ciel's STPV'd sprite on a pose 29 px narrower moves 15 px across), two pivots of 1-4 px
  (`13_01_02_CIEL13_5_1` op 1680, `QA_19` op 850) and `10_00_ARC10_8_2` op 1238 (the card takes depth 2 from the
  cleared layer 0; black on black). Tests "V6 (empty number)" and "V6 (pivot)"; 167/167; `/smoketest.html` clean.
  Browser: `08_01_CIEL08_3B` at op 4211, layer 33's pivot is 216.6, 166 (was 222, 166); the old pivot changes 561,996
  pixels (clock held). The pivot's whole units (fixed the same day): without a source 0x60840 gives the table's pivot
  cut to whole 640 x 362 units (0x62024, fcvtzs; build_system.py exports what each picture loses, system.json
  `pivotCuts`, 11,749 of 12,172), and the draw (0x34440) adds the pivot plus the record's -pivot (+0x48, the state's
  +0x16d6, which STPV and the copy store cut) to the position: an STPV pivot moves its picture by the fraction, and
  STCH from a source keeps the picture where the copy put it (transform.js `cut`, `base`). The "x 0.4" shift once
  noted is this term in the thumbnail draw (0x89ad0), which the port's frame captures carry. The replay: 515 scripts
  move by under 3 px at most waits (9 layers 3.2-3.4 px). Tests "open items" (2). function-map.csv updated for these
  and V1-V10 (28 rows; FUNCTION-MAP.md counts).
- [x] **V7. `STMA`'s 3rd argument closes the text window** (117 calls); the 4th steps the motion every 2-3 frames
  (16 calls). (RE 7) — done 2026-11-06: re-read 0x99620: the third argument sets +0x89e (F1103) for 1, and for 2 when
  the window's fade rate 0xae05a8 (-> 0x1373cfc) is 0, before the layer is checked; that rate is CLO4 / CLO5's and
  also a message's own 18-frame fade-in (0x6e0d0 writes 1/18), as the port's `text.rate` already is; the fourth goes
  to the motion's +2 (negative -> 0) and 0x95938 rounds its frame count down to a multiple when it is 2 or more
  (0x97b80 samples at frames x 50 / 3 ms). `op_STMA(id, track, close, step)` uses `motionClosesWindow` and
  `closeWindowForFade`; animation.js `Motion` has `step` (kept in saves, copied by SCH2). Test "V7"; browser:
  `09_00_ARC09_3_1` op 1459 hides the text for Hisui's turn (text opacity 0 during the WTTM); in
  `14_01B_02_CIEL14B_3B` layer 27's track 18871 (step 3) moves on in 50 ms jumps.
- [x] **V8. RGB split (FADE 40):** steps every 6 frames; a non-zero level starts at full opacity; calling it again while
  on does not restart it. (RE 8) — done 2026-11-06: re-read 0x2f910 (`cmp w9, #5; b.lt`: a step every sixth frame),
  0x5f420 (FADE 40 passes "was off", state +0x898 == 0, to 0x2e3e0 -> 0x2e280, which resets the counters only then)
  and 0x2e3e0 (alpha 1 when the level is not 0); screenfx.js `startSplit(level, preset, now, prev)` keeps the counters
  and alpha while on, continues the alpha after a FADE 41, `splitSample` steps every 6 frames. Also fixed: past its
  first lap the port's pulse counter was 100 ahead (the engine goes on from c + 100 - 3333, `sub w8, w9, #0xca1`). Not
  modelled: 0x2e280 does not reset the 6-frame counter, so the first step after a restart can come 1-6 frames in.
  Test "V8" and the updated split test in screenfx.test.mjs; browser: `02_00_ARC02_1` op 524 (FADE 40 -220 2 while
  on) keeps the counters and alpha 1, where the port blinked off and faded back over a second.
- [x] **V9. Menu background blur:** Gaussian ~3.9 px over 12 frames, not CSS blur(7px) + darkening. (RE 9) — done
  2026-11-06: re-read 0x2e000 (freeze; value 0.001, rate -1/12, s 2.25, mode 2), 0x3bba0 (value + 1/12 a frame; mode
  2 draws the frozen copy, 1 runs 0xa0a90, then 0xa2680 draws the blur at the value; at 1 the story layers stop),
  0xa0a90 (2 x int(3s) + 1 = 13 taps 1.75 px apart at 1920, weights exp(-i^2 / 2s^2) / sqrt(2 pi s^2), not
  normalised, across then down) and 0x2e030 (the menu's close passes (0, 1): off at once). renderer.js
  `setMenuBlur` / `menuGaussian` / `present` draw it (real-time frames, as the game clock stands still under menus);
  main.js passes the stage's `menu-blur` state each frame; style.css drops `blur(7px) brightness(.82) saturate(.9)`.
  Test "V9"; browser: `05_00_ARC05_1C` at op 1234, the system menu: the canvas's horizontal contrast falls 3.43 ->
  1.67 (frame 9) -> 1.34 (frame 12 on), its mean brightness 149.5 -> 148.4 (the old filter took 18 % off); closing
  restores 3.43 at once.
- [x] **V10. Per-layer quake** draws an independent random offset per layer. (RE 10) — done 2026-11-06: re-read
  0x91540 (SQK2: layer, x, y, interval, duration, delay, mode, ramp), 0x3c970 (each record draws its own random
  numbers at its ticks; with mode not 0, layers 2 and up copy layer 1's stored offset, else layer 0's, else 0), 0x34440
  (an SBAS child adds its root-most quaking ancestor's offset, a layer linked to a quaking layer the link's, or none
  when the link is a panel) and 0x32050 (a panel's clip and its linked layers, via 0x37f50, move by the owner's
  offsets). vm.js gives each layer's quake its own seed; effects.js `slotShift` / `clipShift` / `layerShiftPixels`
  apply those rules to both slots; renderer.js uses them for layers and clips. Not done (minor, RE 10's other notes):
  sway's per-cycle period and sign, SHOK's fractional periods, STCL stopping the motion. Test "V10"; browser:
  `05_00_ARC05_9` at op 1309 (`SQK2 -1 6 12`, mode 0), layers 25-30 now shake apart (25: 4.4, 9.8; 26: -0.6, -6.5;
  ...), where they moved as one.
- [x] **V11. Motion tracks write 28 keyframe fields; the port read 11.** Added 2026-11-06 after a report that QA_17 cut
  Neco-Arc off at the right (the first pass had marked `0x97b80` / `0x99ff0` done without checking which fields they
  read). — done 2026-11-06: `build_animations.py` exports all 28 fields (the first eleven unchanged, the rest in `EXTRA`
  order without trailing holds; 6.13 -> 6.59 MB) and `animation.js` ports `0x97710` (holds, skips; the ease of the last
  earlier key that has the field, the mode of the last earlier key; frame style and fields 17-27 step) and `0x97b80`'s
  rules: the flag bits per field, and position, opacity, zoom, blur and blend written past the start only when a later
  key gives them, otherwise once at STMA (`0x99620` runs the track at time 0) and kept on the layer. New fields: the
  panel's x / y / width / height (246 motions in 107 scripts move or resize one; QA_17's moves 646 -> 843 with
  Neco-Arc), frame style and edge width, pivot, blend (8 is normal unless opaque), colour (a track's preset 1 colours a
  layer that is not a silhouette, about 14 motions; flag bit 33), brightness, contrast, grain, depth (432 motions
  differ from the script's, e.g. `04_00_ARC04_9_2`'s fire, now over the room) and the panel turning with the rotation
  (bit 34). SGMA writes the key its third argument names (6 calls) and the panel; STEC resets the new multiply colour;
  renderer.js draws through per-frame views of the layers. The port of `0x97710` also changes values the old sampler
  had wrong (tracks 2290, 2453, 2719, 2906, 4353, 4638, 6787, 7801), and 33 timed STGS fades on layers whose track set
  the opacity only at the start now run. Tests: `motion-fields.test.mjs` (11) and two motion tests changed to the native
  rule, 162/162; a sweep of 428,294 samples of the 24,019 used tracks finds no unfinished value; `/smoketest.html` clean
  (549 scripts, 1,059,371 commands, 84 choices). Browser: QA_17 op 331 (Neco-Arc whole, as in the original game),
  `04_00_ARC04_4_1` op 913 (layer 4 fades 191 -> 47 in 3 s), `05_01_CIEL05_4` op 1083 (layer 20 navy at depth 1782; not
  compared with the original), `04_00_ARC04_9_2` op 877 (the fire covers the room).
- [x] **V12. A linked layer is drawn through its owner's picture** (a clipping mask), not only inside the panel's
  rectangle. Added 2026-11-06 after a report that QA_17's shadow sat wrong: layer 26 (Neco-Arc's own picture as a
  dark orange silhouette, alpha 114, linked to her layer 25) spilled past her outline. — done 2026-11-06: `0x32e30`'s
  linked branch draws the owner's texture (slot `0x189` + link), opaque, at the owner's position, zoom and rotation,
  scissored to the clip, into the mask the linked layer is drawn through; `0x36520` takes that path only when the clip
  is not empty, and SACL layers keep their own clip (`0x37f50`); a panel drawn as one group (`0xa2ba0` modes 1 / 2,
  `0xa4bc0`, `0xa2c30`) composites through its owner with the owner's blend and opacity. renderer.js `maskOwner` and
  `drawOwnerMask` render the owner's picture into a mask target and multiply the linked layer by it (full-screen
  clips included). Also: a blurred layer is placed by the pre-blurred picture's table entry `<name>_XX_YY` (STCH
  appends the suffix before the lookup, `0x60840`), transform.js `blurName`. Tests: `motion-fields.test.mjs` ("drawn
  through its owner's picture", "placed by the pre-blurred picture"), 164/164. Browser: QA_17 op 331, the head now one
  shade with a light rim on her left (about 20 px), nothing past her outline, as in the user's capture of the original
  (rows sampled: web head b95f3a with rim ffac69, original c8713c with rim ffbb74); `09_01_CIEL09_2_1` op 1232
  (Noel's purple light stays on her) and `05_00_ARC05_9` op 119 (full-screen mask, nothing cut).
- [-] **V13. QA_17's Neco-Arc looked about 15 levels darker in green and blue than in a capture of the original** (web
  rim ffac69 and head b95f3a, capture ffbb74 and c8713c). — not done 2026-11-07: no difference in the arithmetic. The
  capture is a frame of a YouTube recording (compressed, colour-converted), not a game frame. The web's effect pass
  was checked line by line against the original's `pre_alter` shader (SPIR-V `7e70751d45de6bdc`, translated with
  spirv-cross): silhouette colour, grey weights 54/183/19, per-channel gamma and levels, the two colour layers (their
  strength a byte, n/255, as `0x9f6c0` packs it), brightness v + 255(b - 1) clamped, contrast (200c + 55)/255 or
  127.5/(127.5 - (100c - 100)), output as is; all match, so preset 13 and the overlay's SNX2 -157 come out the same.
  One unknown remains: `pre_alter` (and its twin `388795e57e97d494`) re-encodes its input with a 1/2.2 power, while
  `2a10534047fee3d2` decodes with 2.2. Settled 2026-11-07 with a frame from the native build (a copy of the user's save,
  `01_00_ARC01_2` at op 832, layer 13 `img2228` with preset 58, gamma 1, so only the pass itself acts, and blend 11):
  with the web's text window picture laid over its layers, the frame matches the native one within a few levels, and
  where layer 13 shows (54,000 points sampled) the mean difference is 1.5 levels, about -2 in the darks, not the +7 an
  sRGB decode would give. The pass's round trip is exact to within 8-bit rounding; the port's skipping it stands.
- [x] **V14. A picture's pivot is the record the engine finds by the picture's name.** Added 2026-11-07 after a report
  that Ciel's bust in `14_01B_01_CIEL14B_1D` (op 829, `sie_a_46_00_n06`) hung above the bottom of the screen. — done
  2026-11-07: STCH looks a picture up with 0x55d30, which hashes the upper-cased name and returns its index in the name
  table at *0xae0888 (32-byte names, indexed by 0x55ac0); 0x60840 reads the image table (*0xae0540) at that index.
  build_system.py keyed the pivots by the record's +8 file name, which for the 3,768 expression records is the pose's
  shared file (`SIE_A_46_00_N00_B`); their own name is at +0x10 and in the name table. So 3,725 pictures the scripts
  use (most character expressions) were drawn about their centre: Ciel's pivot is 37% down her picture, not 50%, so at
  y 60, zoom 500 her cut-off edge sat at 982 px. `build_system.py` `image_records` now reads the names from the name
  table; `system.json` pivots 7,068 -> 9,609, pivotCuts 11,749 -> 14,290 (the 1,226 entries dropped are `_B` file names
  no script uses; nothing else in the file changed). Test "V14" in transform.test.mjs; 195/195. Checked against a
  native frame (a copy of the user's save, `01_00_ARC01_2` op 826, Arihiko's `ari_l_00_03_n02` at zoom 942, turned
  -14.7°): over the 287,653 pixels where the two placements differ, the native frame correlates 0.992 with the new
  pivot and 0.33 with the centre. Browser: the scene's bust now runs off the bottom; storage restored, 8 keys verified.
- [x] **V15. The RGB split (FADE 40) goes over the screen with overlay; the port drew it in place of the screen.**
  Added 2026-11-07 after a report that the green, speckled background behind "I'm... sorry." / "The next thing I know,
  I'm in tears." (`00_00`, FADE 40 at op 4777 to FADE 41 at op 4827; layer 21 is `IMG2304`, blurred) moved around far
  more than in the game. — done 2026-11-07: the motion was right. 0x2f910 (re-read in the listing: alpha +1/60 a
  frame, a step every sixth frame, the pulse with the 200/100 wobble on its first lap, amplitude 3.1 x (pulse x 80 +
  20) / 100 in 960 units, angle 30 to -30 and back by 3) is what `splitSample` does; 0x3c970 calls it once a tick, and
  the port samples it from the clock, so a 120 Hz display does not speed it up (browser: draws every 8.3 ms change the
  shift only every 100 ms and leave the split's state alone). The draw was wrong. 0x2fc50 draws each channel of the
  screen alone (0xa5690: unmoved into a cleared buffer, moved over it with `noalpha`, then into the split picture,
  green and blue added), red moved by +d, green by -d, blue by -2d, the channel's colour (255 + level) applied in two of
  those draws, and lays the result over the screen with `overlay` (0xa2790(0x16) = table position 31, through 0xa4bc0's
  type-7 screen copy) at the split's alpha. The port drew mix(screen, moved channels, alpha): at full alpha the
  channels themselves slid, about 16 px (red, green) and 32 px (blue) at the first lap's peak, where the game keeps
  the picture in place and only darkens, saturates and tints it. It also moved each channel the opposite way (red read
  at uv + d) and applied the gain once. `renderer.js` `FS_SPLIT` now draws as the game does; `screenfx.js`
  `splitPixel` is the same in JavaScript. Checked against the native build (reference save, New Game, ZR fast-forward,
  then every frame dumped from the split's start at present 6572): fitted to the unsplit frame just before, overlay
  explains the frames (mean error 2.6 levels; the unsplit frame 14.6, replace no closer); red +d, green -d, blue -2d,
  y down; and a free fit of amplitude and angle follows the rule at step (frames since FADE 40) / 6 (15.5 px at -12°
  at step 14, the first lap ending at step 34). Test "V15" in function-map.test.mjs (the native numbers at steps 0,
  14, 20 and 34; overlay, directions, edge, gain twice; the shader's lines); 228/228. Browser: `00_00` ops 4785-4791,
  the port's scene buffer under the text window's veil against native frames 6660 / 6700 / 6740: mean error 2-5
  levels a channel (the old draw 12-21, no closer than no split at all); storage restored, 8 keys verified. Not
  modelled: while a FADS transition runs, the split's level eases from the one it last drew with (0xafec68) to the
  new one by the transition's level (0x4b860); three calls set a level just before a timed FADS (`02_00_ARC02_1` ops
  403 and 564, `05_00_ARC05_9_2B` op 3083), where the port takes the new level at once.
- [x] **T1. Text window compositing:** picture and text at panel x max(0, 2(fade - 0.5)); picture not drawn while
  closed (F1103). (TX 1) — done 2026-11-07: re-read 0x391a0 with the group calls (b04b0 picks the target group, b06c0
  queues a group's composite at alpha / 255, b0500 / b0530 push and pop): the picture goes into group 0x1d at config +0
  / 255 (255) x panel, 200/255 x panel for both balloons, the lines into 0x1e at panel x 2 (fade - 0.5) each, and both
  groups are composited at g = 0x572b48 x panel x max(0, 2 (fade - 0.5)), 0x1d only while F1103 is 0 (L_3A6EC); 0x572b48
  is 1 in the story (only 0x2e140, from a save screen's slide, writes it). textbox.js `render` draws the picture at g x
  panel and the text at g x g, neither while F1103; the test page's `#panel2` likewise. Tests "T1" and the window tests
  in parity.test.mjs (the picture now goes with the text at a FADS close), 183/183 with T2-T12; `/smoketest.html` clean
  (549 scripts, 1,059,371 commands, 84 choices). Browser (frames stepped one by one): `01_00_ARC01_2` op 1151, a message
  after the scene change: the picture stays at 0 for the first 8 of the 18 fade-in frames, the text rises as g x g
  (0.012, 0.049, 0.111 ...); at the CLO3 at op 1155 both go at once (F1103) while the panel closes at 0.26 a frame.
- [x] **T2. Earlier lines dim to 100/255** over speed x 1.2 frames, snapping dim on a click that finishes typing. (TX 2)
  — done 2026-11-07: textbox.js keeps the page's lines (`lines`: segments, timer, T, @k) and `dimLines` runs 0x391a0's
  page loop each frame: alpha 1 - (155/255) t / T with T the current line's speed x 1.2 frames (F(870 + j) = speed -
  128 for the line before the current one), the timer counting only at fade 1 with F1103 0 and -1 (100/255) once past
  T; a click that finishes the typing sets the earlier timers to -1 (0x81b30's memset of F859 ...; vm.js
  `finish(clicked && !skip)`, a skip does not); a line whose text ends in @k (the copy stops at @e / @n: all 229 are
  "@k@e") takes the state of the line that continues it, bright while that is current (`lineAlpha`); no dimming with
  "Display whole text" (0xafeba8, which 0x6e0d0 sets only at a page's first line, F823 < 2: vm.js `wholePage`, also
  for its no-click rule); target 255 with a second balloon (F1111 >= 3); at once with config +0x62 = 1 (T3). A
  restored page keeps its lines (segments carry data-line / data-k), its earlier lines dim (0x813e0 sets their timers
  to -1). The `.seg.old` rule (0.6 over 0.3 s) and the novel layout's exception are gone. Tests "T2" (3) and "T2/T6";
  browser: `01_00_ARC01_1` op 159: the first line went 1 -> 0.4066 over 42 frames (35 ms x 1.2) and held 0.392 from
  frame 43 (screenshot checked); a click while op 164 typed took the second line from 0.928 to 0.392 at once;
  `07_01_CIEL07_6` op 539: the line ending in @k (MSAD at op 518) stays at 1 while its continuation is current.
- [x] **T3. Letter fade-in lasts one letter interval;** "Text display" is global; the second option is about earlier
  lines. (TX 3) — done 2026-11-07: re-read 0xab710 (+0x61 = 1 adds 0x400000 for every text, read or not) and 0x2a730
  (widgets 0x4a / 0x4b set +0x61, 0x4c / 0x4d set +0x62). textbox.js now types by frames: the front moves 16.667 /
  speed letters a frame (0x3b2d0; 768 at speed 0) and letter i is drawn at min(front - i, 1), or whole once passed with
  "Insta display" (`letterAlpha`, `TextBox.type`; the CSS transition and `--ch-fade` are gone), `charFadeMs(speed)` is
  the letter interval; 0x3b330's longer value only sets a trailing front nothing draws with. The VM takes "Text
  display" (setting `fadeUnread`) for read and unread text alike and "Read text display" (`fadeRead`) for the dimming
  (`eraseAtOnce` = "Insta erasure"); the config page shows btn_base1's "Fade out / Insta erasure" rows for it (the
  atlas's two rows no other option uses; the widget art itself was not traced) and both samples type in the "Text
  display" style (0x2d570 draws them through 0xab710). The settings keep their names. Tests "T3" and the updated RA-09
  test; browser: `01_00_ARC01_1` op 154: the letters stood at 0.476, 0.952, 1 while the next was at 0.429 (35 ms
  each); the config page shows "Fade out / Insta erasure" under "Read text display" (screenshot checked). The art,
  settled 2026-11-07: the config widget records 0x4c / 0x4d (0x46b820 / 0x46b850, 0x30 bytes each) point at button
  image sets 15 / 16 of the table at 0x46eb20 (0x50 bytes: five state cells), whose cells 44-46 / 47-49 of the sprite
  cell table 0x46f110 are btn_base1 (slot 1225) rows 6 / 7, "Fade out" / "Insta erasure" (0x4a / 0x4b: sets 13 / 14,
  rows 4 / 5), as drawn. And the letters, settled the same day on the native build (a copy of the save with both
  speeds set to 250 ms, frames every 5 or 15 presents): spaces are typed letters, line breaks are not:
  "I walk to school a little slower than usual." took ~650 frames, 44 intervals of 15 with its 8 spaces (36 would be
  540), and in "...the grounds, it's\nalmost seven o'clock." the "a" after the patch's raw break came one interval
  after the "s" before it (11-12 presents, as between the letters around them). The port had typed only the letters
  that are not spaces, so every line went about a sixth too fast; spaces are now typed `.ch` letters (textbox.js
  addChars) and `^` (in a text line only 9328, which the port had shown as a "^" on one row) is a row break that
  counts nothing, as 0xbdc2c makes it, where the VM had turned it into a counted line break. Test "letters"; browser:
  `01_00_ARC01_2` op 1151's line is now 74 letters (was 60), `05_00_ARC05_3_1` op 448 shows 9328 on two rows.
- [x] **T4. Typing waits until the window is fully open** and no fade-in runs. (TX 4) — done 2026-11-07: `TextBox.type`
  (each window frame, after the panel and fade) moves the front only while the window is not open (opening it,
  0x2e120(1)), hidden, fully open with no fade-in (panel >= 1, rate <= 0) or closed (F1103), as 0x81b30 L_81C40 /
  L_81C84; otherwise the frame passes. add() no longer opens the window or types on a timer of its own; speed 0 shows
  the line whole on the first frame it may type; skipping still shows it at once. Test "T4"; browser: `01_00_ARC01_2`
  op 1151: the front stayed at 0 through the fade-in after the scene change, then went 0.476 a frame. Frame order,
  settled 2026-11-07: the game's frame 0x48ac0 calls 0x40ed0 (the script step 0x802c0, then the typing driver 0x81b30,
  listing 0x420c4 -> 0x42084) before the layer commit 0x3c970 and the window's 0x38d40 (0x490d0-0x490e4), and draws
  (0x391a0) after; so typing sees the panel and fade as the last frame left them and goes on the frame after a fade-in
  ends. `TextBox.tick` now types first (it had run after the window, a frame early). Test "T4"; browser: same place,
  fade 1 on step 18 with the front at 0, 0.476 on step 19.
- [x] **T5. Window open/close rate 0.1302 a frame** in the story. (TX 5) — done 2026-11-07: the listing's three
  callers of 0x2e170 (0x40d70, 0x40e4c, the reset 0x82980) pass 0x80 and nothing else writes 0x572b50 (its 0.06 is
  the value before the first story start): textbox.js `WINDOW_RATE` = 16.667 / 128 a frame (7.7 frames) and
  `FAST_CLOSE_RATE` 0.26041666 for CLO3. Test "T5" and the updated window test; browser: the panel went 0 -> 1 in 8
  frames of 0.1302 at `01_00_ARC01_2` ops 1151 and 1166.
- [x] **T6. F1104 "novel" pages only hide the window picture.** (TX 6) — done 2026-11-07: of the readers of +0x8a0
  only 0x39540 (in 0x391a0, `cbnz` past the picture) reads the variable block; 0x5c2f4, 0x80bf8, 0x60da4 and 0x611a0
  read per-layer arrays of another block. `setIntro` now only hides the picture; the novel face (Times 50 px,
  letter-spaced, the 202-1718 px box from y 226), `placePage` / `rowsOf` / vm.js `pageItems` / `#measure` and the
  no-dimming rule are gone, the VM follows F1104 as the script sets it (`applyWindow`, as for F1105-F1113) and saves
  no longer carry `intro` / `top`. Test "T6"; browser: `00_02` op 174 (F1104 1): the page at the window's own place
  (left 265 px, top 148 px, Georgia 42 px) under the script's four blank rows, no window picture, the first line
  dimmed (screenshot checked).
- [x] **T7. MSAD after a closed window does not start the 18-frame fade-in** (123 places). (TX 7) — done 2026-11-07:
  vm.js `message` calls `continueMessage` for MSAD (0x6e950 only clears F1103: no fade-in, no page clear) and keeps
  MSG's speed (it does not call 0x3b2b0); an MSAD with no text still sets the line's @k. Test "T7"; browser:
  `01_00_ARC01_2` op 1166 (MSAD after the CLO3 at op 1155): the fade stayed 1, op 1151's line stayed on the page,
  picture and text came back with the panel (0.017, 0.068, 0.153 ...) and typing went on once it was open (frame 8),
  where the port had faded both in from 0 over 18 frames. `QA_20` op 1936 (an empty MSAD after a page end, with a
  second voice) now keeps the page up.
- [x] **T8. `@t` types two parts of a line at the same time** (3 lines). (TX 8) — done 2026-11-07: listing
  0xc0840-0xc09d0: with n letters, t before the mark and L the longer part, the first part's letter i is drawn at
  min(front - i (n - t) / L, 1) and the second's k (index t + k) at min(front - k t / L, 1), and the line is done when
  the front reaches t (it is then set to n), so the shorter part keeps the pace and the longer one is spread over the
  same time. parseMarkup keeps the mark, add() records its letter index, `letterAlpha` / `typedAt` follow the rule (the
  port counts letters without spaces). Test "T8"; browser: `09_01_CIEL09_6` op 2192: "Shut up, Shiki!" (15) and
  "Tohno-kun, be quiet!" (20) type together (12/15 and 16/20 whole at front 12.4, screenshot checked) and the line ends
  as the front passes 15. Letter counting, settled 2026-11-07 (with T3's native measurement): the parser's index t
  (0xbdc2c +0x18d90) counts every character it passes on, spaces and the patch's raw line breaks included, but not ^
  (code 10 with no count); the letters drawn count spaces but not line breaks. So in 23613 and 36678, where the
  translation's %{n} (a raw break; the Japanese had ^) comes before @t, t is one past the second part's first letter:
  23613 has n 39 and t 18, the opening quote of "Tohno-kun, be quiet!" (letter 17) gets the first part's rate and
  comes in last, and the line is done at front 18; 9328's ^ leaves t at 29 of 39. parseMarkup keeps the breaks before
  the mark (`lf`), add() sets t = letters before it + lf, `letterAlpha` takes letters below t at the first part's
  rate. Tests "T8"; browser: `09_01_CIEL09_6` op 2192, n 39, t 18, the quote last (front 17.1), done at 18.
- [x] **T9. `@x` glues a message to the previous row** (7 places, likely). (TX 9) — done 2026-11-07: confirmed in the
  listing: 0xbdc2c turns @x into code 0xc, 0x391a0 asks 0xa88b0 whether a line has it and starts that line on the
  previous row 2 units after its end (0xa8190), or at the left of the next row when that is past the wrap width. vm.js
  `parseMessage` returns `glue`; add() starts a line of its own (it dims the one before) with no new row and a 6 px
  margin (`.seg.glued`), wrapping from the left. Test "T9"; browser: `07_01_CIEL07_6` op 539: "you're not gonna ask
  where Roa's coffin was?" starts at x 806, 6 px after "Anyway, Shiki――" (800), and wraps to 265 (screenshot checked).
- [x] **T10. F1110 overlay picture** (one QA_20 page). (TX 10) — done 2026-11-07: listing 0x3a580-0x3a65c: while
  F1110 >= 1 the wait 0xafec70 counts whole milliseconds, 16 a frame (fcvtzs of 1000 / 60), and from 3,500 on the alpha
  0xafec74 rises 1/36 a frame up to 1 (an fmin the decompile drops); with F1110 0 it falls at that rate and the wait
  starts again; it is drawn after the window's groups, also while the window is closed. The picture is DISP_PARTS_JA
  texture 69 (slot 121), `tw___________` (1920 x 1080: "※ Correct spelling: bide", for "bribe your time"). textbox.js
  `tickNote` / `render` and a `#note` element over the window (hidden under menus and the backlog), the VM following
  F1110 (`applyWindow`). Test "T10"; browser: `QA_20` op 1506: the wait reached 3,504 at frame 219 and the caption
  came in over 36 frames over the balloon (screenshot checked).
- [x] **T11. Click mark details** (page mark 4.8 px lower). (TX 11) — done 2026-11-07: main.js `onWait` puts the page
  mark 2 units (4.82 px) below the line mark (0x391a0: end y + 5.5 for F799 = 1, + 3.5 otherwise) and the balloon mark
  2 units right and half a unit lower than the line mark (+4, +4: style.css margin 1.2 px, was 6 px), and keeps one
  cell counter for all marks through `animation-delay` (0x572b60: the frames while a mark is drawn, modulo the drawn
  kind's cells x 2). ANIMATIONS.md updated. No unit test (main.js has no node harness); browser: `01_00_ARC01_1` op
  164 (page end): the page mark at 389.8 px for a text end at 429 (a line mark: 385), its loop started 2.55 s in, where
  the earlier marks had left off.
- [x] **T12. SHAF should not clear MSQK** (latent). (TX 12) — done 2026-11-07: 0x2e560(0, 0, 0, 0) resets only the
  window movement state (0xafeb98 / 0xafeb9c, 0xafec04-0xafec34, 0x57298c); MSQK's 0x39110 keeps its shake in the
  block at *(0xae05c0), which it does not touch: `op_SHAF` does nothing. Test "T12"; no browser check (no script runs
  SHAF during an MSQK).
- [x] **T13. An ended page goes once F823 is 0, not at the next message.** Added 2026-11-07 after a report that QA_17's
  balloon (op 331, "It's sad, but this is who Ciel really is.") opened with the previous page's text for a moment.
  — done 2026-11-07: 0x391a0, each frame the panel 0xae0558 is above 0 and F822 is 1, clears the page (0x53ab0) when
  F823 - 1 is below 0, and every script sets F823 to 0 right after the click that ends a page (`WKST F823 eq 0`, op 242
  here) and adds 1 before the next (op 327). The port cleared an ended page only when the next message began
  (0xae0940), so at QA_17 op 268-331 (CLO3, the scene change, F1105 11, CLO5 400) the old page was still in the
  window when CLO5 faded the balloon in, and it showed from half the fade until MSG. textbox.js `clearEndedPage` (called
  by `tick`, with [F822, F823] from main.js) now does what 0x391a0 does; a long frame that takes the panel down in one
  step still counts the panel as up. No message is shown with F823 below 1 in any script (43,790 checked). Test in
  text-window.test.mjs (184/184). Browser: QA_17 from op 241, the page gone on the first frame after the click, no
  frame with it visible, the balloon showing only its own text.

## 3. Sound

- [x] **A1. Volume law:** music ca0(B(L x BGM)) with B(v) = 1.54 v - 0.54 v^2; plain SEs ca0(L x SE); ca0 = table at
  0x3355f0. Voices, interface sounds and movies stay linear. (AU 1) — done 2026-11-07: re-read 0xca0, 0x9b5d0 / 0xff4b8
  (Bezier through 0.77), 0x9b690, 0x9cd40 and the mixer 0x9b7f0 in the listing. build_system.py exports the table
  (system.json `volumeCurve`); audio.js keeps a level per music and SE record (`Level`) and puts `curveOf` /
  `bezier` gains on each sound's own node, the bgm / se groups staying at 1; BGM is the byte 0x48ac0 re-applies after
  every sound setting change (`0x47b40` from 0x2a9b0 / 0x2b3bc / 0x2dd88): floor(floor(256 x (1 - mute) x BGM / 200)
  x 100 / 128), 40 plays as 39; SE is (1 - mute) x SE; a setting change reschedules every playing sound. The Music
  Player's gain is ca0(B(volume)) (0x9c8f0, gallery.js), interface sound 7 ca0(SE / 100) (0xacfa0), SE Test SE / 100.
  Correction: T[99] is 0.9885, not 1 (it only tops the 0.98 step). Test "A1" (the audit's 0.3367 / 0.2115 / 0.0692 /
  0.0308); browser: `14_01B_01_CIEL14B_1D` from op 655, the GainNodes read music 0.3367 and effects 0.0692 / 0.0462 at
  levels 50 / 40, and BGM 50 / SE 100 set live gave 0.4692 / 0.2115.
- [x] **A2. Voiced SEs (070)** follow the character's voice row and switch, not the SE slider or mute, no curve. (AU 2)
  — done 2026-11-07: an SEPL with 070 and a fade-in under 2 ms is a type-2 record (0x9caa0): 017 x floor(switch x row
  / 100) / 1e4, linear, no SE volume or Mute, following its row, the row's mute and "Play all voices" while it plays
  (`audio.setVoiceSwitch`, called from main.js's settings); with a fade-in it stays type 1 (SE volume and curve,
  0x9cbf0). A row or the switch off when it plays gives volume 0 for good and last volume 0 (0x6a340 / 0x65780; the
  VM had zeroed it when the command was read, before a 068 delay). Test "A2"; browser (QA_14, the VM's own SEPL of
  SEV_B00_10_01_0063_0 with 070:10, as `10_01_CIEL10_5_2` op 1266): kind "voiced", level 0.5, unchanged by SE 10 + SE
  Mute, 0.8 with its row at 80, 0 with the row muted or "Play all voices" off.
- [x] **A3. Fades** linear in level before the curve; MPLY fade-in ends after 017/100 x 001; +1000 ms on a channel still
  fading out. (AU 3) — done 2026-11-07: levels move at the native rates a frame (0 or less: 0.2) and each sound's gain
  is scheduled frame by frame through the law (`schedule`): MPLY fade-in 1666.67 / 001 (done at 017/100 x 001), the
  old track 1666.67 / (011 or 001) from its level, without a fade-in 416.67 (gone within a frame) and only from state
  1, a third track cuts the one still fading; MFAD the last MPLY / MVOL volume x 1000/60/001 (`fadeBGM`); MVOL
  |017 - last| / max(001, 1); SEPL fade-in 017 x 1000/60/001, 1000 ms longer on a channel fading out (whenever 001 is
  given, so also `001:0`); SEFD the level x 1000/60/001 (0x9d020); SEVL |017 - last| / 001 (none: 2000, a jump from
  1666.67, 0x9d0b0); a fading-out record stops at 0. Test "A3" and the MPLY test in native-parity.test.mjs; browser: a
  2000 ms SEFD sampled every 0.4 s read gain.value = seGain(level) at levels 39.9 / 29.7 / 19.6 / 9.5 (0.0460 /
  0.0304 / 0.0113 / 0.0055, where the old linear ramp gave 0.0552 / 0.0412 / 0.0271 / 0.0131), then the channel
  stopped at 2.0 s.
- [x] **A4. Delayed SEPL:** a plain SEVL retunes it (4 loops in `14_01B_01_CIEL14B_1D`), a plain SEFD drops it. (AU 4)
  — done 2026-11-07: decompiled 0x6a340, 0x6ae10, 0x6b310, 0x65a60 and 0x66200. vm.js `soundLater` keeps each slot's
  kind and options: a plain SEPL zeroes the countdown (the command stays for the next delayed one), a plain SEVL on a
  slot holding an SEPL (counting or not) only sets that SEPL's 017, a plain SEFD empties a slot whose SEPL still
  counts down, waiting SEVL / SEFD slots are left alone; channel -1 is each of the 20 (38 delayed and 1,266 plain
  SEFD); the delay is ceil(0.06 x ms) frames, at least 1; a slot runs with 0x65a60's rules (`{ delayed: true }`:
  SEFD at the last volume's rate, at once under 1; SEVL only with a 017, 001 under 2 as 1). Test "A4" and the 068
  tests; browser: `14_01B_01_CIEL14B_1D` from op 655, MOON_SE10051 (op 662, 068:500) plays on channel 4 at the SEVL's
  40 (op 683, gain 0.0462), and `SEFD -1` faded all three playing channels and emptied them.
- [x] **A5. Speaker-23 voices** use row 18's volume and mute (5 lines). (AU 5) — done 2026-11-07: `audio.rowOf` (0x29390,
  log2 of 0x40000, speakers past 23 as 0) gives the voice's volume and mute; `characterOf` (the heard flag, 0x29300)
  still leaves speaker 23 out. Tests "A5" and UI-04; browser: `03_00_ARC03_3` op 1605, M01_03_00_0000_0 is speaker 23,
  row 18, never "heard"; it plays at 0.5 (row 18 at 50), 0.3 at 30, not at all with row 18 muted.
- [x] **A6. Pan 018:** doubled only for immediate plain SEs. (AU 6) — done 2026-11-07: p = ((018 x 1000 - 64000) >> 6, toward
  0) / 1000 is nn::atk's pan q for the delayed path and type-2 voiced effects; immediate type-1 effects get q = 2p
  (0x9ce60, clamped to +-2). Then traced nn::atk's own pan law (it was the audit's open limit, and a StereoPanner is
  not it): MultiVoice 0x12d108 gives each channel side shares through 0x12a1a8, T(i(x)) of the sqrt curve 0x3cf91c =
  sqrt(1 - i/256), i(x) = trunc((min(x, 1) + 1) / 2 x 256 + 0.5) (0 below -1), not scaled to the centre. Mode and curve
  come from SoundInfo option 1 (0x10ebfc -> commands 4 / 5 -> voice +0x1f4 / +0x1f8): the effect waves are dual / sqrt
  (a stereo wave's channels at q - 1 and q + 1), the streams balance / sqrt (each channel of a stereo stream is a voice
  on its own side, 0x122378 / 0x12d6e4). The game puts nn::atk in surround (0xec618 -> 0x1134e0(2, 0)), whose front
  pair gets exactly these shares, without the front bypass tables (SoundSystemParam +0x7e is 0). audio.js `panMatrix`
  builds the matrix (a splitter, a gain per channel and side, a merger) for every sound: centred stereo effects as they
  are, music 0.7071 a side, voices and the mono SEV_ effects 0.7071 to both sides (3 dB under the effects, which the
  port had at full), and 018 96 immediate puts the left channel at 0.7071 / 0.7071 (delayed: 0.866 / 0.5). The Music
  Player gets the stream share too. Test "A6" (and the parity test's 018 96); browser: an OfflineAudioContext render
  through `node()` gave exactly those shares for each case, and the scene's real nodes (QA_14) had music [[0.7071, 0],
  [0, 0.7071]] and the (mono) voice [[0.7071, 0.7071]]. Assumes the output mode the game sets and the docked build.
- [x] **A7. Delayed fade-in SEPLs** take their rate from 0x65780 (~27 of 180). (AU 7) — done 2026-11-07: audio.js keeps each
  channel's last scripted volume (0x146e6cc as `seLast`: SEPL's 017 or 100, 0 for a silenced voiced one, SEVL's 017,
  SEFD 0, -1 after a script end 0x5f200 / `stopAll`, kept by SESP and in snapshots); a delayed SEPL with a 017 rises at
  |017 - last| x 1000/60/max(fade, 1) a frame (0 -> 0.2: 100 takes 8.3 s; from 1666.67 at once). Test "A7"; browser:
  `08_00_ARC08_8` from op 705, op 714 (SEPL 5, 017:100) leaves the last volume at 100, so op 976 (001:1000, 068:700)
  rises at rate 0, 8.33 s; started at op 972 instead (a test jump drops 714's one-shot, as a read skip does natively,
  0x6a340 returning before it stores the volume) it ran from last 0 in 1 s.
- [x] **A8. Fast forward does not cut** MFAD/SEFD fades. (AU 8) — done 2026-11-07: MFAD and SEFD cut their fade only when
  `vm.soundsSkipped` (skipping in the instant run, a test jump or the smoke test, the same test that drops one-shot
  SEPLs); fast forward fades in real time. Test "A8"; browser (QA_14, the VM's own commands): with skip on, an SEFD of
  2000 ms left the loop fading (state 2, 2.0 s to go); in the instant run the same SEFD stopped it at once.
- [x] **A9. Interface sound 7** (0xacfa0) in movie mode. (AU 10) — done 2026-11-06 with S15: `playSys(7, "se")` at the start
  of the chapter-title movies 8-12 / 14-34 and at frame 210 of 13 (listing 0x40930 / 0x408a8); its loudness follows the
  SE slider linearly until A1 brings the curve.
- [x] **A10. Minor audio items.** (AU 11) — done 2026-11-07: (a) the master gain is 96 / 127, the per-sound volume of all
  17,896 sounds in knife1.bfsar (counted in the archive; system.json `soundVolume`), movies keep (1 - mute) x BGM;
  (b) the delayed path has no same-loop check, so a delayed SEPL of the loop playing restarts it; (c) voices take two
  handles in turn (0x9b570): a message's voice stops both, VPL2 takes the other, a third cuts the older; (d) MVOL to
  the last volume moves at 0.2 a frame (from the level model); (e) a play-once track that ended keeps its number, so
  MPLY of it does nothing until MFAD. Test "A10"; browser: master gain 0.756.
- [x] **A11. A fade on music still loading threw.** Added 2026-11-07, found while doing G10: a music record kept its
  number in `rec.n` until its stream was decoded and then its node there, so `schedule` read `.g` of a number when
  MFAD, MVOL or an interface fade came before the stream started. — done 2026-11-07: the number is `rec.music`, `rec.n`
  only the node, and `schedule` waits for it (the level moves all the same and the sound starts on it). Test "A11".

## 4. Gallery, flowchart screens, menus and controls

- [x] **G1. CG alias table** 0x4525c8 (105 pictures seen through their source). (GA 1) — done 2026-11-07:
  build_gallery.py models the seen bits (0x77610 / 0x774f0 / 0x77360: the first 2,700 names are their own bits, a
  +0x43 record stands for its pose's, a sprite has one only through 0x6533c0) and the alias rule 0x51e0 (alternates in
  turn; an IMG one decides alone; a sprite tried with A / L / M / S at character 4), and exports each picture's bits
  (gallery.json `cg[].variants[].bits`) and the 2,533 names that set them (`seen`, 1,068 bits). unlocks.js keeps the
  bits (`Unlocks.image`; the names recorded before become their bits) and `cgUnlocked` reads them: 97 pictures are
  reachable only through an alias, as the review counted. Test "G1"; browser: the user's 77 names became 77 bits.
- [x] **G2. CG entry gates** 0xb58c (188 entries wait for a route day). (GA 2) — done 2026-11-07: the entry's +8 is
  exported as `gate` (188 of 458 gated) and unlocks.js `CG_GATES` is 0xb58c's switch (code 15: scene 275 or 276).
  Test "G2"; browser: the user's progress lists 49 entries, IMG0834 and IMG1727 (code 3) waiting for scene 4.
- [x] **G3. Completing QA_25 (RDED 557) unlocks every CG.** (GA 3) — done 2026-11-07: `cgUnlocked` lists every picture
  past its gate once scene 557 is complete (0x4470 at 0x4618); 926 pictures have no other way in. Test "G3".
- [x] **G4. CG per-entry sub-grid** and the viewer's return to it. (GA 4) — done 2026-11-07: gallery.js `cgView` builds
  the main grid (each entry by its first unlocked picture) or an entry's sub-grid (its unlocked pictures, each its own
  cell) when it has two or more (0x8d08, 0xd408 / 0xd468); Back in a sub-grid builds the main grid on that entry at the
  scroll it had; the viewer closes onto `viewerReturn`'s grid (0x9384: the same entry's grid, else the last picture's
  sub-grid or main grid), rebuilt as it starts to fade. Test "G4"; browser: a two-picture entry opened its sub-grid;
  closing on IMG1696 rebuilt the main grid on its entry.
- [x] **G5. Viewer Left/Right go through all unlocked pictures,** wrapping. (GA 5) — done 2026-11-07: the viewer walks
  `cgLists`' flat list (every unlocked picture in table order) with `viewerStep`, round and round, not while Up / Down
  is held nor with one picture, sound 0; a click goes on as a swipe does. Test "G5"; browser: IMG1694 -> IMG1692 ->
  IMG1696 across entries.
- [x] **G6. Viewer fades, rule_26/27 wipes and help band.** (GA 6) — done 2026-11-07: the viewer comes in 0 -> 1 and
  goes 1 -> 0 over 0.5 s (quadratic in / out, its opacity: the screen captured at open fades over it, 0xc498 / 0xce60);
  a picture change captures the screen and wipes it away through RULE_26 (previous) or RULE_27 (next) over 30 frames,
  linear, once the new picture is in (gallery.js `Wipe`; traced later the same day: the sprite's rule path, 0x9fe00
  at 0xa0188-0xa01f8, gives threshold 1 - a / 255, softness 128 and direction +1, so the capture shows at a / 255 x
  smoothstep((r - lo) x 255 / 128) and leaves the rule's dark parts first, `wipeAlpha`; the first version had STTR's
  direction, test "G6 (wipe)", browser: rule_26 brings the previous picture in from the left, rule_27 the next from
  the right); the kind 9 help band (ui.helpBar screen 9) comes in
  over 0.5 s, holds 2 s and goes, sliding 25 units, and comes back at each change (`GuideFx`: 0x604c / 0x59c0 / 0x5b58;
  sharper than GA 6, which had it stay); keys only between these (state 2). Test "G6"; browser: opacity 0.04 / 0.31 /
  0.91 at 0.10 / 0.28 / 0.47 s, the wipe up about 0.5 s with the band returning, the close 0.64 / 0.19 / 0 at 0.1 /
  0.28 / 0.47 s. (The picture change was corrected under G19: no fade of the capture's own, an 8-frame hold, the band
  under the capture.)
- [x] **G7. Variant flag 1 is a horizontal mirror;** zoom kept for a same-size picture of the same entry. (GA 7) — done
  2026-11-07: a flagged picture is mirrored about its middle in the viewer and its thumbnail in the grids (0xaf78
  mirrors those too); the zoom and place stay for the next picture of the same entry with the same table w / h
  (`viewerKeeps`, 0xbe84). Test "G7"; browser: IMG1740 and its sub-grid cell mirrored, the fill kept from IMG1740 to
  IMG1738 and reset at IMG0900. Traced later the same day, the 19 offset rectangles (the review's limit): 0xb6de0 draws
  the rectangle (x, y, w, h) at w x h times the scale, anchored at its middle; the (x + w, y + h) size of 0x1f648 is the
  sprite's coordinate size only, so each shows centred as the port's crop does, and all 19 lie inside their pictures
  (no change; not run natively).
- [x] **G8. Music Player:** keys, 0.01 volume step, row choice rules, Play restarts, fade and stop at the end (no
  auto-advance), labelled credits, "？？？", session-only volume/repeat, no seek bar. (GA 8) — done 2026-11-07: the
  list's Up / Down wrap 0 <-> 94 only on a fresh press, Left gives the column the cursor, Right the panel (0x1a7fc,
  0x19a14); the panel's play / pause / stop / repeat over prev / next move as 0x1c9fc (Left from play or prev to the
  list, Down from the bottom row to the volume, Up back); the volume steps 0.01 in single precision with no sound and
  shows %3d (0x1cc68); Enter on the playing (or paused) row or on one not heard stops and clears, another plays from 0
  (0x1dab8); Play plays the list's row from 0 whatever plays (0x1e98c); without repeat a track fades out over 1.5 s
  from field 8 / 48 ms (1.5 s earlier when field 6 is 0), linear in level, then stops with nothing next (0x1d314); the
  credits are labelled with SYSMES 245-248 (gallery.json `musicText`) under the title, the block from 244 - 32 x
  (lines / 2) (0x1dec4); rows not heard read SYSMES 244; volume (0.6) and repeat live for the page only (gallery.js
  `session`); the position shows only. Test "G8"; browser: the wrap and a held key, 60 -> 57 -> 58, Play from 0:03
  to 0:00, the end of "Sunlit: re" (90 ramps over 1.48 s to 0, the panel cleared, nothing next).
- [x] **G9. Title music keeps playing in the gallery;** the Music Player stops its track and restarts the title music on
  close. (GA 9, TS 9) — done 2026-11-07: main.js `gallery()` no longer stops the title's music; `openGallery` starts
  it where the game does (no restart when it plays; after a replay, 0x47a90, or the flowchart, 0x7624, unless coming
  back to the Music Player); the Music Player cuts it on opening (0x19838 state 0), and its close, after the section's
  fade-out, stops its track and, for a section chosen in the column, starts the title's music again (0x8400 -> +0x80,
  0x8e1c0); leaving for the title or the flowchart does not. Correction to TS 9: 0x8e1c0 is not called on every
  section change. Test "G9"; browser: music 2 played on in the CG Gallery, stopped in the Music Player, back after.
- [x] **G10. Movie gallery:** order prologue, op1_arc, op2_ciel; SYSMES 1443 confirmation; cover fades; music 2 at
  360 s; music restored. (GA 10) — done 2026-11-07 except the confirmation: the list is the prologue (always), op1_arc
  and op2_ciel (G005 bit 0 / 1, or recorded as watched before), with the art rows of 0x469350 (gallery.json
  `movieList`); A plays at once with sound 1. Correction: there is no confirmation in this build: dialog 25 (SYSMES
  1443) is the movie section's state 3, which no code enters (0x1873c now unused). The player keeps the music number,
  fades the music at 3.33 a frame as a cover comes in over 0.5 s (quadratic out; white for op1_arc, black otherwise),
  plays the movie (a press stops it; the prologue starts music 2 at 360 s, main.js `playMovie` opts.music), then the
  black cover goes out over 0.5 s and the kept music starts again. Test "G10"; browser: the prologue (this progress'
  only movie), cover in and out, music 2 back.
- [x] **G11. Gallery section transitions,** thumbnail cascade, smooth grid scroll. (GA 11) — done 2026-11-07: a chosen
  section waits for the open one to go 1 -> 0 over 0.5 s (quadratic out; 0x7328 waits for it) and then comes in
  (quadratic in); each grid build fades its thumbnails in over 0.5 s, quadratic in, the 42 from the first row shown
  (column + row) / 50 s late (0xb318); the grid scrolls over 1/6 s, quadratic out, to 0xa968's places (804, the last
  row 873.5, going down; 178.5 going up) and shows 6.5 rows (y 109-1014). Test "G11"; browser: the content 0.70 / 0.25
  / 0.03 at 0.08 / 0.25 / 0.41 s, column 5 trailing column 0 by 0.1 s, the scroll 0 -> 139 in about 170 ms.
- [x] **G12. "Flowchart is not yet available"** before scene 1. (GA 12) — done 2026-11-06 with S32 (gallery.js `choose`).
- [x] **G13. Grid and list keys** (CG grid, ending list, movie list). (GA 13) — done 2026-11-07: CG grid (0x9cbc,
  `cgGridKey`): Left on column 0 gives the column the cursor, Right stops at column 5 and the last cell, Up at row 0,
  Down only onto a cell; ending list (0xe7a4 / 0xf470 / 0xf5a4 / 0xf6f8, `endingKey`): Left / Right to the next seen
  entry of the row, Left past the first to the column, Up / Down by 0xf6f8's columns (the final episode at row 3 column
  5); movie list (0x183ec): Left from the first to the column; each section plays its own sounds (0 a move, 1 a
  choice, 2 back). Test "G13"; browser: Right stopping at column 5, the movie list's Left, the ending list's Down to the
  nearer Ep. 4 and Up back.
- [x] **G14. The gallery's own help band.** Added 2026-11-07 (the port drew a text bar of its own). — done 2026-11-07:
  the gallery's guide (0x6124: kind 10, sliding 25 units) drawn as the game's help bar (ui.helpBar, 0x4a8f0's
  screens): it comes in with the column on kind 10 (0x6934); a section with the cursor asks for its kind (+0x88: the CG
  grid 0, with Scroll, when its rows scroll, 0xadfc; the Music Player's list 0, its panel and volume 10, 0x1b1cc /
  0x1d5ec; Movie and the Ending List 10), the column 10 again (0x74f0); another kind goes out over 0.5 s and comes back
  in with it (0x5c4c, `GuideFx.to`); the viewer hides it until it starts to close (0x4dfc -> 0x82d0, 0x9384 ->
  0x82bc), a gallery movie until its cover is gone (0x4f28, 0x4c8c). Test "G14"; browser: B Back / A Choose / Move
  at open, out and back in with the right stick's Scroll on entering the 49-entry grid, gone under the viewer.
- [x] **G15. The CG viewer's backdrop is light grey.** Added 2026-11-07 (found checking the gallery's pictures against
  the sprite class's draw 0x254bc). — done 2026-11-07: 0xba18 puts a rectangle sprite (type 1, 0x466738: 0, 0,
  1920 x 1081, z 700) in grey 0.847 (216) behind the picture (z 690); the port's viewer was black. `.gl-viewer` is
  rgb(216, 216, 216), which the wipe's capture takes too. Test "G15"; browser: a picture narrower than the screen shows
  grey at both sides.
- [x] **G16. The CG grid cursor and the column's line.** Added 2026-11-07. — done 2026-11-07: the grid cursor is two
  cg_cursor sprites (0x9578: the frame, cell (8, 8) 248 x 144, z 250, and its light in front, cell (264, 8), z 210), both
  cut to y 109 - 1014 like the thumbnails (the port's one 260 x 160 cell was not cut at the top and had no light); each
  placing (0xa968: a move, the grid opening, the focus coming back) sets the light's alpha to 1 and runs program
  0x337380 (op 19: alpha to -1 over 30 frames); the program interpreter 0x1fd48 ramps every property in a straight
  line and the draw skips alpha 0 or less, so the light shows for 15 frames (`cgCursorLight`). The column's line
  (0x82fc, program 0x3372d8, op 12) grows the same way, linearly over 12 frames (it was quadratic out). Test "G16";
  browser: hand-stepped frames gave 1, 0.933 ... 0.067, 0.
- [x] **G17. The Music Player's buttons.** Added 2026-11-07. — done 2026-11-07: 88 x 80 cells of music_controlbtn at
  the button list's places (0x469ac0: (1432 + 80 k, 576), Prev / Next at (1512, 656) / (1592, 656)), button k's art at
  x 8 + 96 k, rows y 8 (normal) and 96 (selected); the port's cells were measured by eye (up to 1.5 px off, the selected
  row 2 px and the on row 6 px high). Play / Pause / Repeat when on get a sprite of the y 184 row over them (+0x90 /
  +0x98 / +0xa0, z 570) instead of swapping the cell; a press of Stop, Prev or Next flashes the selected row over the
  button (+0x88, z 560; 0x1e98c, tables 0x34d340 / 0x34d370): alpha 1 to 0 over 1/6 s, quadratic in (0x21a20 channel
  8); the other buttons hide it. Test "G17"; browser: the flash 1, 0.99, 0.96 ... 0.19, 0 at (1592, 576); Repeat's
  on-glyph over its button.
- [x] **G18. The lists' scroll bar; the Music list's cut; no thumbnail outline.** Added 2026-11-07. — done 2026-11-07:
  the scroll-bar widget (0x276b0 / 0x2788c) is DISP_PARTS_JA scroll_bar whole at (1847, 105) and scroll_slider's unlit
  cell ((48, 24), 32 x 288) at x 1839, y 99 + 610 x value / max, hidden when nothing scrolls; the CG grid had none
  (max `cgScrollMax`, value its scroll) and the Music list a CSS bar (max 4720: 80 rows of 59). The Music list's
  background (0x1a058: music_soundbg at (392, 106)) and rows are cut to y 109 - 1014 (the port: 394, 104 - 1016). The
  port's 1 px outline round the thumbnails is gone (0xaf78 draws them plain). Test "G18"; browser: bar and thumb at
  (1847, 105) / (1839, 99) in both, list box 392, 109, 960 x 905. Not ported: the list background's own scroll and wrap
  (0x1b078, with the smooth scroll 0x1b2f0).
- [x] **G19. The CG viewer's picture change keeps the old screen, then wipes it at full strength.** Added 2026-11-07
  (the user's report: going to the next picture, the next picture showed for a split second before the effect). — done
  2026-11-07: three differences from the native change (0xc56c -> 0xca54 / 0xcd58, read in the listing and checked
  against the native build's frames with the reference save, rule_27): (1) `wipeAlpha` faded the capture by 1 - p as
  well as moving the threshold, so the whole new picture showed through from the first frame before the wipe's shape
  did; the alpha byte only moves the threshold (native frames: what the threshold has not reached stays at 1.000 all
  through; the pure model fits every frame at rmse < 0.01, the faded one up to 0.27); (2) the native keeps the old
  screen unchanged for 8 frames (step 0 asks for the capture, three waits, step 4 puts the capture sprite over all at
  full, step 5 sets the new picture under it, step 7 starts the 0.5 s timer) and steps the timer from the 9th frame,
  taking the capture away on the 38th; the port started on the frame after the new picture loaded (now
  `CHANGE_HOLD` = 8 then `CHANGE_FRAMES` = 30, counted in frames; it also waits there for the picture and the rule to
  load, which the original does at once); (3) while rule_26 / rule_27 was still loading the port put no cover up, so
  the new picture showed uncovered until the rule came (a real flash); the capture now covers at the key whatever is
  loading. Also: the capture takes the help band as shown (0xa4610 captures the whole screen) and stays over the live
  band, which comes in again under it on the wipe's first frame (0x604c; in the native frames the band appears only
  where the capture has gone); the port had moved the band on top. Test "G19" ("G6 (wipe)" updated); browser,
  hand-stepped frames: the cover at alpha 255 everywhere on frames 0-11 with the new picture loaded under it, the first
  change on frame 12, the rule's bright parts still at 140 / 255 on frame 30, the cover gone on frame 38; Playwright
  pixel diff of frames 5 / 8 / 11 against the screen before the key: mean 0.47 (resampling only, 1 px at the picture's
  edges); real-time screencasts (not yet loaded, loaded, a click) show no frame of the new picture first. Not ported:
  the PC build draws its capture 16 px to the left from the first frame after the key (the capture sprite takes the
  render target's size, +0x1390, centred on the 1920 screen), a quirk of that build.
- [x] **G20. The gallery's opening from the title, and the menu background's sparkles.** Added 2026-11-08 (the
  user's report: opening the gallery from the title, some draw animations did not match; the sparkles did not match;
  measure from the GALLERY press). — done 2026-11-08: the native build's frames (reference save, every frame dumped,
  two runs; the same clock from the press) against the port's (Playwright, hand-stepped). The title's fade matched.
  The gallery did not: (1) the native keeps the title's covered screen ~0.35 s longer (its loading frames, ~0.24 s and
  ~0.1 s; `GALLERY_OPEN.hold`, `ui.after`); (2) its engine clock gives each frame the time since the last, at most
  0.5 s (0xef08c), so timers started in the loading frames have run on by the gallery's first frame: the CG grid's
  cascade (0xb318, sprite tweens, still 0.5 s quadratic in and 0.02 s a diagonal) is 0.47-0.51 s on, the scroll bar's
  own 0.5 s fade and the help band 0.245 s, the column, its header, the inner panel and the grid cursor (0x6934 starts
  their timer, 0x6bbc steps it from the next frame) 0; the second frame is ~0.1 s long for every timer; (3) the
  thumbnails take no fade but the cascade (the port also faded them with the column; a CG section opened again inside
  the gallery cascades from 0 with nothing else on them, as the port does). Port: `GALLERY_OPEN` (uifx.js), the
  gallery opened with `{ fromTitle: true }`, its built state the first frame and its first tick 0.1 s (gallery.js
  `animate`), `view.fadeIn` for the CG grid. Sparkles (0x4c190 / 0x4bd10): drawn f x size x 80 px at 1080p (the port
  drew twice that), from 40/41 of the texture, in 100 ring records; one static set for the session (0xb34bc8, never
  cleared), so the gallery's background goes on with the title's GALLERY's (the port started each background with an
  empty set: the gallery opened on a bare sky); normal alpha blending (measured: their red rises more than their blue,
  which additive blending cannot do with this texture); drawn through WebGL, bilinear with no mipmaps as the GPU does,
  which keeps the star's white core (a 2D canvas tinted it to 218, 254, 254; the native frames show white cores, red /
  blue 1.09 at the peaks); made 60 a second whatever the frame rate (Chrome's 30 fps energy saver made half). Tests
  "G20" (x3); 259 node tests pass; browser (pane, hand-stepped, the user's storage backed up and restored by checksum):
  gallery built on frame 84 after the press, first frame column 0 / thumbnail 1 0.884 / scroll bar and band 0.24 /
  content 1, second frame column 0.04 and band 0.476; Playwright per frame against the native: column, scroll bar and
  band within a few hundredths on every frame to the 27th, cascade between the two native runs. Not ported: the
  native's later loading frames (its second frame's extra length is), the PC build's frame pacing under its dumps.
- [x] **F1. Flowchart junction pieces adapt** to revealed neighbours (0x14824). (FC 7) — done 2026-11-07: the chart is
  built as 0xfffc builds it (flowchart-model.js `keptGroups` / `layoutChart`): its row filter (a placeholder compared
  with the static row before, the static parts read as one array), rows 56 apart and days 13 lower, then per part in
  order its node (0x13fd4), its line piece (0x14824) and, in the game, its path piece (0x149b4). A piece needs its own
  line revealed (also under a completed scene); junctions 5 / 8 / 10 / 11 are chosen again from the scene above, the
  neighbours (drew a piece, completed or revealed) and the part's own scene (0x14d10 / 0x14e94 / 0x15098 / 0x15218 /
  0x16078: a fixed table of pieces 2-11); a placeholder's piece 3 only under a part that drew its piece and is a
  completed scene or started placeholder; the drop (piece 1) under pieces 4 / 5 / 9 / 10 / 11 only for a started
  placeholder (0x153b8). Test "F1"; browser: the user's progress, rows and pieces as the rules give them (no line above
  scene 51, whose line 608 is not revealed; the prologue's hidden placeholder 528 keeps its empty row).
- [x] **F2. Flowchart navigation** along the path / drawn lines; scrolling keeps a row of context. (FC 8) — done
  2026-11-07: selectable are the completed scenes in the gallery and, in the game, the scenes on the play's path in days
  1 on (0x13fd4). Left / Right (0x1262c / 0x1280c): along the row, then one or two columns over in the row below, then
  above; Up / Down (0x129f4 / 0x12b68): in the game the nearest row's first path scene (Up stops at day 0), in the
  gallery along the authored line (0x12eac / 0x13854 / 0x136d0 / 0x139f4, read from the listing) else the next row's
  nearest column (0x1303c: +-1 ... +-8, mode 0 split at column 4); a key's move scrolls so the row above lands at 4 or
  the row below at 966 over 1/6 s, quadratic out (0x10d5c); a pointer selects without scrolling (0x12424); after the
  player scrolls, a node in view takes the selection (0x12d1c). The first selection: F110 in the game, in the gallery
  the scene of a replay just played, else row 0 (0xf8fc, 0x7f38). Test "F2"; browser: Down along column 0, the scroll to
  72 when a node passed 966, a scroll to 3000 re-selecting a scene at y 24. Not ported: the stick's scroll speed and
  6 px a wheel unit (the browser's wheel scroll is kept); A on a selection that is not a node starts nothing (both
  done later the same day: F6, F7; 0x6c4 is the touch drag's velocity, not a wheel).
- [x] **F3. No path highlight in the gallery flowchart.** (FC 9) — done 2026-11-07: path pieces (connectorRects 13-25,
  in front of the normal ones) are drawn in the game only, by their own choosers (0x149b4, 0x158b0 / 0x15a98 /
  0x15c9c / 0x15e80); in the game a placeholder on the path is hidden (0x13fd4). The cursor has no path look: its second
  cell (120, 8) is the flash sprite (0xf8fc). Test "F3"; browser: 10 path pieces in the game, none in the gallery.
- [x] **F4. Flowchart small visuals:** in-game fades, preview cross-fade, cursor flash. (FC 10) — done 2026-11-07: the
  game's flowchart fades in (0 to 1 over 0.5 s, quadratic in) and out (titles at once, the rest 1 to 0, quadratic out),
  input waiting for it (0x110d4 / 0x1121c / 0x11bec); the preview changes only with its index: old picture and texts 1
  to 0 and new texts 0 to 1 over 1/12 s, quadratic in, the new picture at once in front (0x16e00); the flash (program
  0x34b7f0, linear: 15 frames, gallery.js `cgCursorLight`) restarts with each such change (0x10ba4); the lists' scroll
  bar (0xfffc -> 0x276b0, range bottom + 4 - 1022 less 28 / 56, gallery.js `scrollBar`); the day titles stay at y 8
  while their day scrolls, pushed up by the next separator (0x11eb4, `stickyShift`); flow_info is the label "This
  scene", always shown in front of the picture at (1672, 120) (0x16660; the port showed it on the current scene only).
  Test "F4"; browser: 0 / 0.25 / 1 at frames 0 / 15 / 31 in the game, the flash 1, 0.933 ..., "4 / Infernal River of
  Blood I" held at the top, the thumb at 338.9 for a scroll of 3000, Back 0.25 at frame 15 with the titles gone.
  Not traced: the day bands' geometry (0x13b54 / 0x13d04 / 0x14b58; textures 0x204-0x206 not mapped), kept as before
  (traced and ported later the same day: F5).
- [x] **F5. The day bands and the chart's end.** Added 2026-11-07 (left over from F4). — done 2026-11-07: texture ids 501-520 are
  MENU_PARTS_JA's textures in order (0x201 flow_line_merge, 0x202 flow_line_2, 0x203 flow_phasetitle, 0x204
  flow_sam_bg_middle_fullhd 1440 x 1, 0x205 flow_sam_bg_under_fullhd and 0x206 flow_sam_bg_upper_fullhd 1440 x 5, 0x207
  flow_sam_non, 0x208 flow_thumb_all_nx; 509-512 flow_bg, flow_cur, flow_info, flow_infobase). 0xfffc, at each day
  change with sep = the row end + 8: 0x13b54 ends the band running since the last one (the first from 0) with 0x204 at
  x 0, scaled to sep - start + 3 high, z 460, and returns sep + 10 as the next start; 0x13d04 puts 0x205 at sep and 0x206
  at sep + 8 (z 450, in front); at the end 0x13b54 to the bottom (rows or titles + 8) and 0x14b58 0x205 at it. So the
  bands run from the top of the chart to its bottom, broken only at the separators (the port had a band per day's rows
  with the edge pieces 5 px outside them). Found on the way: 0x14b58 returns bottom + 56, and 0xfffc's scroll end is
  that + 4 - 1022 (less 28, less 56), 56 more than F2 / F4 had. flowchart-model.js `layoutChart` (`bands`, scroll end),
  flowchart.js draws them. Test "F5"; native: with the user's save the native separator rows (232-244 at x 100; 846 /
  856 on the game's chart at its end) and the web's match, and the game's opening scroll on scene 309 is 14689 in both
  (the old end, 14641, could not reach it).
- [x] **F6. The player's scroll: stick, PageUp / PageDown, wheel, drag.** Added 2026-11-07. — done 2026-11-07: read
  0x11418 and the input poll 0xb38f4 / 0xb3a18. The first stick (input +0x1c / +0x1e, -128 ... 128: the axis x 128; the
  PC build feeds it from the left stick and binds PageUp / PageDown to it pushed all the way, SUP / SDOWN) scrolls when
  no direction moves the cursor: past 80 it asks for the scroll + (|y| - 40) / 44 x 504 (full tilt 1008), eased there
  over 1/6 s, quadratic out, from where the scroll is (0x27bd4); directions reach the input as pulses only, at the push,
  after 15 frames and every 5 (+0x3ec / +0x3e8), so a tap is one 1008-pixel step. The second stick goes with the D-pad
  (0x100010 ...: not ported, M10). 0x6c4 is not a wheel: it is the touch drag's velocity (0x40c over x 0-1360, y 0-1022:
  the largest -dy in 720-line touch pixels, x 0.9 a frame, 0 below 0.5), and the chart eases to the scroll + 6 x it,
  coasting after the release. After any of these the selection goes to a node in view each frame until the scroll is
  done (0x12d1c). Port: the view no longer scrolls by itself; flowchart-model.js `stickTarget`, `PadRepeat`,
  `DragFlick`; flowchart.js reads the pads' left stick and PageUp / PageDown held (they were the port's day jumps), the
  pointer drag as the touch drag, and the wheel (the game has none; the PC build makes it buttons) as an eased scroll of
  its own distance. Test "F6"; browser: a PageDown tap 200 -> 1208, the wheel by its delta over about 1/6 s, a drag
  coasting and stopping, the selection following.
- [x] **F7. Decide on a selection that is no node.** Added 2026-11-07. — done 2026-11-07: Decide (or a tap on the selected
  node) acts on the part at +0x38 / +0x3c with no check of what it is (0x11418): the gallery replays its jump and flag
  (0x5040), the game opens the rewind question (state 4, 0x11a58 -> 0x178c8). The selection rests on such a part only
  from the opening (0xf8fc: the requested scene's part, else row 0, column 0; a part's node sprite +0x28 is kept only for
  selectable nodes, so no cursor shows there, 0x10ba4): in the game when the current scene is a virtual one whose part
  is a placeholder, e.g. 520 after 181 -> 184 with F054 = 0, so Decide offers to rewind to scene 485 (row 0); in the
  gallery only when row 0 is not a completed scene. The port's Enter there chose the first selectable node instead (ui's
  selection stayed 0). flowchart.js `decide` for nodes and for the selection's part (a part with no scene starts nothing).
  Test "F7"; browser: current 520 opened on Glass Moon with no cursor, Enter asked to rewind.
- [x] **F8. The flowchart's help band.** Added 2026-11-07. — done 2026-11-07: 0x4a790 is not the help bar but the touch
  Back button's on / off (0x4a7a0 draws back_btn; the port's `ui.setBack`). The band is a gallery guide whose kind is
  the flowchart's vfunc +0x88 (0x123f4): 0 (Back, Choose, Move, Scroll) while its scroll bar is on, else 10. From the
  gallery the flowchart is section 2 (0x7f38) and the gallery's guide takes its kind (0x7624 -> 0x5c4c: the column's 10
  goes out over half a second, sliding 25 units, and 0 comes in); in the game 0x1776c makes a guide of that kind
  (0x5920, no slide) drawn at the flowchart's fade (0x1783c -> 0x60e4). The port's `fc-help` text bar is gone; flowchart.js
  draws `ui.helpBar` with `HELP` / `helpKind`, carrying on the gallery's guide (gallery.js passes its kind and alpha).
  Test "F8"; browser: 10 out and 0 in from the gallery; in the game at the fade; the native captures show kind 0 in both.
- [x] **F9. The flowchart against the native build with the user's save.** Added 2026-11-07. — done 2026-11-07:
  tools/decode_save.py reads the save as the game does (system data first, G0 at +0x6c, newest record +0x161e; record n
  at 0x1800 + n x 0x7200, a 0x3aa8 snapshot at +8 whose F variables 0x5baf0 gives back: the fixed list from +0x3402,
  F110 at +0x48; table 0x351214's as bytes from +0x3489, the path F201+ / F600+ among them; table 0x3511a4's as bits) and
  prints tsuki.flow.v2 and the record's path: 553 completed, 630 lines, record 85 on scene 309 with 273 scenes on its
  path. The native build (sandbox copy of the save; title -> Gallery -> Flowchart and 17 Downs; Continue -> menu ->
  FlowChart, Down x 2, Up x 3) and the web with that progress agree: the same 18 scenes for the Downs and scroll 171,
  the game opening on 309 (row 276, column 5) at 14689, the Downs doing nothing on the last row and the Ups going to One
  Last Parting Dream, Retroflow, Mystic Eyes; frames differ by 2-4 / 765 on average over the chart (offset 0), titles
  and separators on the same rows, scroll bar thumbs at the same rows. Fixed from it: F5's scroll end. Not the
  flowchart's, left open: the touch Back button shows in the port though the docked game hides it (0x4a7a0 draws it at
  alpha 0 when GetOperationMode is 1, so the PC build never shows it); the help bar's band is lighter and textured
  natively (ui.helpBar's flat colour, all screens); the backdrop right of the bands is a few levels lighter in the port;
  the PC build's keyboard glyphs are its own. Test "F9" (runs the tool on the save when both are there). The save is
  100% complete (all 495 chart scenes, all 630 lines: 277 rows, 495 selectable in the gallery), so it checks drawing
  and navigation, not the partial-progress rules (hidden rows, re-chosen junctions, placeholders), which rest on the
  listing and tests F1-F3 and F7.
- [x] **M1. System dialogs** start on No where the game does, answer on the second tap; SYSMES 160 on two lines. (BC 4)
  — done 2026-11-07: listed every 0x49710 call and its second argument: No for Overwrite (2), Cancel Saving (7), Quick
  Load (9), Jump to Next Scene (10), Return to Previous Scene (11), Quick Jump (23, 0x28c2c), Default (27, 0x2bb90) and the
  ending list's episodes (0xea4c, the entry's dialog with 1); Yes for Load (0, the shared call at 0x51af4 with w1 0),
  Return to Title from the column (8, 0x4d0a0), End Scene Playback (12) and the flowchart's rewind (26). The port already
  had the scene buttons, Quick Load and Overwrite; Default, the backlog's Quick Jump and the ending list now start on
  No. 0x49f00 state 2 from the listing (0x49fa8-0x4a13c; the decompile loses the fall-through after 0xae0e0): pointing
  moves nothing, a tap on the button not selected moves the cursor there with sound 0 (0x49fe8), a tap on the selected
  one answers like A (0x4a108), the keys toggle and B is No; taps count only while the window is open (state 2). ui.js
  `add(..., { secondTap, ready })` for the system's buttons (the story's SELS / SELA keep hover, BC 3). Default asks
  dialog 27 with its "^" as a line break (`.dialog-q` keeps it, the question moving up half a line). Browser: Quick Jump
  opened on No, a hover left it, the first click on Yes moved the cursor with the window still open and the second
  answered; Default showed "Change All Settings to Default." / "Are you sure?" on No.
- [x] **M2. Backlog as a page viewer** over the scene (75% veil, pages as drawn, wrap, fades, choice rows). (BC 5) — done
  2026-11-07: traced 0x27eb0 / 0x28950 / 0x28470 / 0x281a0 / 0x28a90 / 0x28d50 / 0x28f80 / 0x27d10 with their listings.
  Records: only MSG saves one (0x6e0d0 -> 0x5a910 type 0; MSAD copies the line into the newest record, 0x6e950 at
  0x6eda4), a choice saves a type 0xc record a row with F799 set on the last (0x7f74c) after SELR's type 0xd (0x78a7c),
  and a load empties the ring (0x82330). F799 is WNTY's flag (0x78c94 -> 0x38ea0). Pages (uifx.js `backlogPages`):
  newest first, the oldest choice rows dropped, everything newer than the first page end after the newest record (the
  page on screen) left out, a page ended before each later page end, the oldest page dropped once the ring has let
  records go; rows drawn as the window drew them, up to 12, after F847 + row blank rows (0x28470). That needed the VM's
  C variables to be what 0x7a2b0 makes them, Cn = F(F823 + n) (`lineVar`; the port had kept "C847" as a name, so
  F847-F858 were never written). Keys (`backlogStep`, 0x28a90 listing 0x28c50-0x28d4c): Up / wheel up an older page,
  Down a newer, held keys stopping at the ends and fresh presses wrapping, Left the oldest, Right the newest, sound 0;
  A or a tap left of x 543 (640 units: the pointer is set to (320, 224) by 0xad440) asks Quick Jump for the page's
  first record (sound 1 after the window's 3), the record SELR saved for a choice's rows (vm.js `jumpTarget(seq,
  choice)`), silently refused when no longer kept; B plays 2. Look: the scene held under black at 0.75 x alpha, the page
  in the text window's place and face (`.logpage` shares #text's rules, textbox.js `renderLogPage`), help bar 3 and the
  scroll bar for the pages (value max - page, the newest at the bottom; `scrollBar` takes a position source), all at
  the alpha, which moves 0.05 a frame in and out (also before the jump). The port's own list, line cursor, bg_backlog
  and per-line voice icons are gone (the game has no voice replay there; FIXES "Backlog voice icon"). Tests "M2" (four);
  browser (`01_00_ARC01_2`, `01_00_ARC01_4`): the newest finished page with its blank row, the bar at 707 / 99 px for
  the newest / oldest, held and fresh keys as above, Quick Jump back to "Teachers are running..." with the log cut
  there, the choice's numbered rows on the page with the two lines before them, Escape fading out (0.25 at 10 frames).
- [x] **M3. SE Test** plays a random one of 14 effects. (BC 6) — done 2026-11-07: 0x29140 stops the previous Test, finds a
  free effect channel (0-19) and plays `0x46b138[0xa8f90(0, 13)]` (both ends in: 14 names, read through the image's
  relocations: moon_se02009 ... moon_se09005); audio.js `SE_TEST` / `playSeTest`, the sound page's Test uses it (all 14
  files are in assets/se). Test "M3" (the picks at 0, 0.9999, 0.5 and the stop of the one before).
- [x] **M4. Voice rows:** set while skipping; Shiki's in-game rule; Test at row x voice switch. (BC 7) — done 2026-11-07:
  VPLY / VPL2 mark the row heard and keep its Test sample also while skipping (0x7a420 -> 0x29300 has no skip test).
  `voiceRows(fromTitle)`: from the title Shiki's row keeps the scene 485 / 1 rule; in the game (0x29fa0 with *0xae04e8
  set) F023 = 0 hides it, script 1 (00_00) shows face 19, scripts 2-3 (00_01 / 00_02) face 18 and "????", any other his
  own face and name. The voice Test (0x2b930, audio.js `testVoice`): with a sample the row becomes the test row
  (0x46f814, -1 at start); if the row is on, interface handle 4 stops and plays the sample at floor(row x switch / 100)
  / 100 (silent with "Play all voices" off), so the next interface sound landing on handle 4 cuts it; then the config
  applies. Every apply (0x2a9b0: each change, the reset, leaving) re-levels the story voice on the handle in use to
  the test row's level (0x9d240) and stops the voices when that row is muted (0x9c3b0); correction to BC 15, which had
  it re-level the Test voice. Tests "M4" (two); browser (`08_00_ARC08_8`): the sound page in game shows Shiki with his
  own face (F023 18); Test on row 0 played at 0.5 on handle 4, a story voice playing went from 0.5 to 0.2 when row 0
  was set to 20, and stopped when row 0 was muted.
- [x] **M5. Config controls:** steps 1 / 50, hold-repeat, L/R pages, 2D grid. (BC 8) — done 2026-11-07: dumped the
  pages' grids (0x46cdb0, 0x9d0 a page: row count, columns per row, widget ids at +0x280, kinds at +0x78, places at
  +0x488, cursor rows +8 / columns +0x898; System 12 rows, Sound 26, Controls none) and read 0x2b930 / 0x29bf0 /
  0x29f00. Each row's minus, slider, plus, on / off or Mute, and Test are widgets of their own (uifx.js `configMove`):
  Up / Down keep the column (clamped to the row, rows without widgets passed over), Up from row 0 goes to the tabs' row
  (System, Sound, Controls, Default), Left / Right along the row, Left from the first widget or tab gives the menu's
  column the cursor in the game only (on the column Right gives it back). Minus / plus step 1, or 50 when the maximum
  is 1000 or more (`configStep`), silently; held (A or the pointer, 0x46f81c = 20 at the press) they step every frame
  once 20 frames have passed; A held with Left / Right steps a slider; the pointer sets a slider to the whole value
  (x - 276.67) / 169.33 of the maximum from the press and while dragged (`sliderValue`); pointing selects (sound 0);
  on / off and the choices play sound 1, the tabs and L / R (keys a / f, the pad's L / R, as the PC build binds them)
  change page with sound 1, wrapping round (0x29f00). Tests "M5" (two); browser: Down to minus, 35 -> 34 and, held 36
  frames, 18; A held + Right twice on the slider 18 -> 20; Down x4 keeping column 1, then column 0 on the one-widget
  row; f / a / a turning System -> Sound -> System -> Controls.
- [x] **M6. Button tooltips** (config +0x20). (BC 9) — done 2026-11-07: the captions are the buttons' table messages
  (+0x28 of each 0x30-byte entry, created by 0xadc50 -> 0xadca0): the menu's column (0x591438: Save 161, Load 162, Set
  Environment 163, Display Flowchart 168, Return to Title 166), the config's tabs (0x46b370: System Settings 140, Sound
  Settings 1, Display Operating Instructions 158, Change All Settings to "Recommended Settings" 159) and the mode panel
  (0x5918c8: 169, 171, 173, 172, 170, 174, 175, 176, so the port's own labels are gone). 0xae840 shows the caption of
  the button pointed at or selected, its level rising 0.05 a frame from 0 at each new one; 0xae590 draws the text
  small over DISP_PARTS_JA/mode_help from 20 units left of it to 46 past its width, the band at 0.7 of the level;
  0xae240 places it by kind, and these three groups' flags (0x120 / 0x320, tables 0x34dc60 / 0x34dc90) make it kind 2
  everywhere: right of and below the button's three-quarter point, + (6, 6) units (0x34d2e0), moved left to end by x
  624. Config +0x20 has no widget and starts at 1, so they are always on. ui.js `Caption` / `captionAt` / `CAPTIONS`
  (SYSMES now exported for them, build_system.py). Not ported: 0x4e170's other button actions the captions name
  ("Rewind when Pressing Button", "Fast Forward when Pressing Button" act while held in the game; the port's buttons
  rewind one line and toggle skipping). Browser: "Save" / "Load" fading in on the column (0.35 at 7 frames), the
  panel's third button "Toggle Auto Mode between ON and OFF", the config's "System Settings", "Display Flowchart" under
  and right of its button (screenshot).
- [x] **M7. Config look:** digit art, Controls help bar, fades, backdrop, "Following Messages", sample restart, exit
  stops tests. (BC 10) — done 2026-11-07: digits are config_number_ja's 32 x 32 cells (texture 0x4d6, 0x2cab0) drawn by
  0x2d420 from the units digit's left edge leftwards 8 units (24 px) a digit: System at x 450 units (1350 px), y 317 /
  496 / 654 / 797 for config +0xe / +0x10 / +0x5c / +0x1c; Sound at x 538.67 (1616 px), y 259 / 325 / 393 and 898 + 122
  k for the characters (0x2d570, 0x2d980; the backgrounds carry "ms" and "%"). Help bar screen 1 on Controls, 2
  elsewhere (0x2aa80). The screen and the page come in at 0.024 a frame (0x2b770) and go out at 0.024 (0x2c500), a page
  change takes the page out and in at 0.05 (0x2c380) with the tabs turned over at once (0x29f00). Backdrop: in the game
  the system menu's background stays up under the config (0x4d8c0 case 10; also under Save and Load, cases 5 / 6,
  where the port drew conf_BG, an empty texture), and returning to the menu no longer fades it in again (case 0xc);
  from the title see M18. The samples are SYSMES 138 / 139 ("Following Messages"); they restart once the auto click
  wait (+0x1c, in frames) has passed from the moment the trailing front (0x3b330's length behind) holds ten letters
  (0x2d570; uifx.js `SampleFx`). Exit (0x2b5c0) stops the SE Test and interface handle 4, the voice Test (audio.js
  `stopTests`), then plays 2. Found on the way: the Sound page's sliders were 34 px right of their tracks (the native
  table puts minus at 736, the knob's track at 830-1338 on both pages, as both backgrounds draw it), the Controls
  picture is at (400, 176) (73.0 units), the minus / plus art's lit and pressed rows (conf_stxt01 y 46 / 92) were never
  used. Tests "M7"; browser: the screen 0.196 at 8 frames, digits 35 / 15 / 3000 / 2200 drawn beside "ms", the turn
  0.58 at 7 frames, Escape 0.55 at 19 frames with stopTests called and the menu back at full level. Not checked against
  a native frame: the Mute and Test buttons' places (the table gives 1430 / 1682 where the port draws 1418 / 1690, but
  their art's anchor was not traced).
- [x] **M8. Notice windows** ("Saving", "Save Complete", …) instead of toasts. (BC 12) — done 2026-11-07: 0x4abe0(n,
  frames) / 0x49750: SYSMES n (0x9a8c0(1): 183-193, 201-210, 213-215 or 1496, else no text) in the system's window, in and
  out at 0.07 a frame; up, its frames count down (0x1e0 = 480 for most, 0x4b0 for "Saving") and A, B or a tap close it
  sooner unless the caller holds it (0x4abd0(1)) and closes it itself (0x4acd0). The port already used the window for
  "Saving", "Loading" and "Flowchart is not yet available", but held each 40 frames with every key blocked: uifx.js
  `NoticeFx`, ui.js `notify(text, { hold, held })` (its promise has close()). The save flow is 0x50fc0's: "Saving" held
  at least 30 frames until the write ends (cases 7 / 0xf / 8), closed with sound 1, the list back 40 frames later (case
  9); "Loading" held while the record is read (case 0x12) or, from Continue, while the screen goes black; "Flowchart is
  not yet available" 480 frames or a press; a failed write is SYSMES 186 ("Saving Failed. / Data may be Corrupted.", on
  two lines) instead of the "Could not save" toast. There is no "Save Complete" in this flow (BC 12 named it as an
  example). The remaining toasts are the port's own failures (a script error, the browser's storage), which the game has
  no counterpart for. Test "M8" (NoticeFx: no press while it comes in, a press, its frames, held until closed); browser: "Saving" 0.14
  / 0.86 / 1 / 0.30 at 70 / 240 / 390 / 700 ms, sound 1 at its close, the list back with the new slot; a notice ignored
  Enter while opening and closed on Enter once up.
- [x] **M9. Drag scrolling with inertia** (x0.9 a frame). (BC 13) — done 2026-11-07: the four users of the touch drag
  0x40c (velocity: the largest -dy of a frame in 720-line touch pixels, x 0.9 a frame, 0 below 0.5; the flowchart's
  `DragFlick`, F6) and how each spends it: the config adds it to its scroll every frame over (407, 165, 1402 x 858),
  only from a press that is on no widget (0x2b930: 0x6a0, 0x40c(nothing pointed), 0x6c4); the CG grid (0x9cbc, over
  (392, 109, 1440 x 905)) and the Music list (0x1a7fc, (408, 109, 926 x 905), through the eased setter 0x27bd4) move by it
  once it is 3 or more, from anywhere including the thumbnails; the flowchart's was done in F6. ui.js `touchDrag` (a
  move past 6 px makes a drag, which is then no click), used by `configScroll` and gallery.js. Browser: a drag of 360 px
  up on the Sound page scrolled it to 220 and it coasted 238, 254, 269 ... 322; the CG grid moved 171 px.
- [x] **M10. Stick input** paired with the D-pad; config scroll axis. (BC 14) — done 2026-11-07: the input poll
  (0xb38f4 / 0xb3a18) keeps the first stick's axes at +0x1c / +0x1e and its directions in 0xf0000, the second stick's at
  +0x20 / +0x22 and 0xf00000, each set past 80 of 128; the menus' masks (0x100010 ...) pair the D-pad with the second
  stick, and the PC build feeds the first from the pad's left stick (SUP / SDOWN = Page Up / Page Down) and the second
  from the right one. main.js `pollGamepads`: in the menus (a screen, the panel or a choice) the right stick past 80 /
  128 (after the dead zone 7849 / 32767) presses the arrows, and directions pulse as 0xb3a18 repeats them: at the push,
  after 15 frames, then every 5 (it was 400 / 100 ms). The config scrolls by -y / 3 a frame while the first stick (left
  stick, or Page Up / Page Down held) is pushed, and its directions wait meanwhile (0x2b930 with +0x1e not 0). The
  backlog no longer reads Page Up / Page Down (its masks have no first stick). Browser: Page Down held scrolled the
  Sound page and stopped on release; a stubbed right stick moved the config's cursor down at once, then at about 250
  and every 83 ms. Not changed: the keyboard's own repeat (the browser's) for the arrow keys.
- [x] **M11. Minor menu sounds.** (BC 15) — done 2026-11-07: the backlog's Quick Jump plays 1 after the window's 3
  (0x28c4c, with M2); Default plays only the window's 3 (0x2bb88 calls 0x49710 and nothing else; the port played 1
  too). The third part of BC 15 (re-levelling the Test voice) was corrected by M4: 0x2a9b0 re-levels the story voice.
  No runtime check of the sounds (the browser checks run muted).
- [x] **M12. The game's scroll bar** (0x9b0c4). (AU, missing) — done 2026-11-07: decompiled 0x9ad04 / 0x9ae58 / 0x9afa4 /
  0x9b0c4 / 0x9b384 and read the rectangles 0xac0658 / 0xac0660. One bar for the config pages, the backlog and the save
  list, at 0x9ad04's place: DISP_PARTS_JA scroll_bar (16 x 888) top left at (615.67, 43.56) of the 640 x 448 screen,
  the unlit cell (48, 24)-(80, 312) of scroll_slider at x 613, its top running from 41.07 over 252.21 units (99 to 707
  px); a new position eases there over 12 frames, quadratic out (type 3); a press on the strip x 613-639, y 41-409 puts
  the list there at once. The two sizes follow nn::oe::GetOperationMode (0xfbed4 reads +0x168, set from it), not touch:
  docked, as the PC build runs (NX_HANDHELD unset), is 1:1. Shown on config pages that scroll (0x2aa80 fades it out on
  others), always on the backlog (0x27d10), on the save list only past 4 slots (0x4f240: range slots - 4 >= 1).
  uifx.js `SCROLLBAR` / `ScrollBarFx`, ui.js `scrollBar` (it follows the list's position each frame), the browser
  scrollbars hidden. Test "M12"; browser at 1920 x 1080: the sound page's bar at (1847, 105) 16 x 888 and thumb at
  (1839, 99); scrolled to the end the thumb went 99 -> 202 -> 292 -> ... -> 707 px over 12 frames (screenshot
  checked); the backlog opens with it at 707 (the newest line); a one-slot load list hides it.
- [x] **M13. Read-scene skip countdown visual** (0x3f110). (SM, missing) — done 2026-11-07: 0x3f110 stores a level and
  turns the cover on; 0x3ef20 (drawn by 0x3c510 after the scene, before the popups 0x3b4b0 and the skip indicator
  0x3b5f0) draws black at min(level, 1) and lowers the level 0.04 a frame. The countdowns (0x40ed0 states 3 and 6: RDAS
  / Jump to Next Scene, 4 or 20 frames, and Return to Previous Scene, 20) set it each frame to 1.5 + v / -30 with v the
  frames left, and show the indicator's ">>|" (0x3b5b0(4)); so the screen goes black, the run happens under it, stays
  black about 12 frames and comes back over 25. main.js `countdownFrame` / `drawSkipBlack` (#skip-black over the picture
  and the text window, under the interface) for all three; vm.js `op_RDAS` reports its frames through `onCountdown`.
  Test "M13"; browser (Jump to Next Scene from `01_00_ARC01_2` op 95 to the choice at 3456): 0.93 at the start, 1 through
  the countdown and the run, 0.50 / 0.28 / 0 as it lifted, ">>|" shown during it and the indicator back to its own state
  after.
- [x] **M14. Quick Load dialog picture** (if not done with S27). (TS 7) — done 2026-11-06 with S27 (`dialog(..., {picture})`).
- [x] **M15. Ending list keys** skip unseen entries; Left past the first returns to the column. (GA 13) — done
  2026-11-07 with G13 (gallery.js `endingKey`).
- [x] **M16. Movie list Left returns to the column.** (GA 13) — done 2026-11-07 with G13 (gallery.js `movieListKey`).
- [x] **M17. Music Player title music unlock** (rows 0 and 7 on entry). (GA 9) — done 2026-11-07: opening the Music
  Player marks the music playing heard (0x19518: 0x9c460 -> 0x64f60, the bit MPLY sets; `audio.bgmState.n`) before it
  cuts it. Test "M17"; browser: with music 2 playing, rows 0 ("Moon Princess: re") and 7 ("Moonlight: re") listed.
- [x] **M18. Config backdrop from the title** (system menu background raised and lowered). (BC 10) — done 2026-11-07:
  from the title (mode 0) 0x2b680 raises the system menu's background at 0.024 a frame when it is down (0x49630(0.024),
  with the screen's own fade), 0x2b770 stops it there and 0x2c500 lowers it at 0.024 as the config leaves; the port drew
  bg_backlog. The title's Load does not do this (its open, 0x8f568: 0x506e0 / 0x4ea20(0), raises nothing; 0x50fc0 only
  stops or lowers a background already up), so the FIXES note "Gallery background" stays right for Load and is wrong
  for Config. Browser: the background 0.42 at about 18 frames with the config, 1 when open, falling with it on Escape
  and gone on the title.
- [x] **M19. The menu column's cursor row.** Added 2026-11-07 after a report that Config opened from the title drew the
  cursor line near the top of the screen instead of under Save. — done 2026-11-07: re-read 0x4c370 (draw), 0x4cea0
  (column input), 0x4cba0 / 0x4d8c0 (opening, states) and 0x4d580 (Config's state): the row 0xb359f0 is in .bss (0, Save,
  at start-up) and only 0x4cea0 writes it (pointing at or tapping a column button, Up / Down / the end keys); opening the
  menu or a screen leaves it, and the line and light are drawn at it (tables 0x350508-0x350544), nothing past row 4.
  The port kept the row per column and placed the line and light only when a column button was selected, so a screen
  opened without one (Config from the title) left both at top 0: the light near Save, the line 104 px higher. ui.js
  `column()` now keeps `ui.menuRow` and one `MenuCursor` for the run and places both from the first frame; the pause
  menu's keys start from that row. A new row restarts the stretch and the light (rising at 1/60), not the line's alpha
  (`MenuCursor.moved`). Tests: uifx.test.mjs cursor test (169/169). Browser: Config from the title, line at 136 px and
  light at 32 px (Save's row); pointing at Load moved both to row 1 and reopening kept it. Left open: 0x4c370 fades the
  line and light out (0.1 a frame) while one of the open screen's own controls has the focus (states 8 / 11 without the
  column flag 0xb359e8, which 0x4d340 / 0x4d580 set when nothing of the screen is pointed at or selected); the port
  always draws them, because it selects the screen's first control on opening where the game selects nothing.
  (Done with M21: the line and light fade while the screen has the focus.)
- [x] **M20. The config's widgets from the engine's tables.** Added 2026-11-07 after a report comparing the System and
  Sound pages with the game ("Display confirmation" far right, the chosen choice shifted, names beside the faces, cyan
  knobs). — done 2026-11-07: the port had laid both pages out by hand and cut the cells from the pictures by eye, but
  0x2aa80 draws every widget through the button system from tables: definitions at 0x46b370 (id, group, flags, hit box,
  image set), image sets at 0x46eb20 (five states of cells: slot, offset, rectangle) and each page's grid at 0x46cdb0
  (kinds, ids, places at +0x488 in 640 x 448 units). build_system.py exports them (system.json `config`) and ui.js
  `confButton` builds each widget from its definition. For a player: the knob's normal cell is conf_sbtn's white dot
  (its lower row) and the lit one the cyan ring (the port had them the other way round); the choices' normal, lit and
  on cells are 256 px apart from x -10 (the port's 0 / 240 / 500 put the chosen one 12 px right, the lit one 16 px);
  "Display confirmation" at x 871 (was 1100); "Display whole text" on its slider's row (was 65 px lower); Mute 20 px
  and Test 40 px further left; the tabs at (408 | 656 | 888, 96) and Reset at (1536, 96) with their own cells, tab_bg at
  (400, 96); the character rows placed as 0x29fa0 places them (12 px higher), each name under its face at (432, 952 +
  122 k) (0x2d040; it was beside it at x 576) and voice_bg drawn as its head, a band a row and its foot (0x34d640 -
  0x34d650) where the port cropped one picture; every widget flashes as it lights up (0xae840, 0.1 a frame) and none
  shows a pressed cell (the config's one 0xae040, the tab of a page change, is refused for a tab that is on; the port
  showed - / + pressed while held); the press areas are the definitions' hit boxes (the knob is dragged by its own,
  not by the whole track); the page is cut to x 407-1809, y 165-1023. Scrolling: the page eases to a new position with
  the scroll bar's thumb (12 frames, quadratic out from where it is shown: 0x2aa80 draws it at -position + a left-over x
  (1 - the bar's progress)) for keys, the stick, a drag, the wheel and the bar, where the port jumped; keys keep the
  widget 260 to 870 px down the page (0x29bf0; a character row's slider counts from 108 / 98 px lower), where the port
  scrolled to the nearest edge, also when the pointer only passed over a widget; the Sound page's range is 122 px a
  row less 113 (0x2a730), the System page's 485. Each page keeps its scroll position and its cursor's row and column
  between pages and openings, and the tabs' row its one tab (0xaed368, 0x46cdb8 / +0x898, 0xaed328; 0x2b770, 0x2c380);
  the first opening selects nothing (no caption) until Down or the pointer picks a widget. `wheelPixels` moved to
  uifx.js (flowchart.js re-exports it). Tests "M20" (3). Browser (Playwright, its own profile; frames of the native build
  with the reference save, title -> Config): the two pages' strips interleaved line up at every widget (System at
  scroll 0; Sound at the native frame's scroll 630, where a shift search found 0 px across and the same 0 px down for
  the faces, the sliders and Mute / Test), and Down through the Sound page scrolls to 0, then 22, 144, 266 at the first
  three character rows, as 0x29bf0 gives. The column's cursor line and light fading while a config widget has the
  focus (M19's note) was done with M21.
- [x] **M21. The system menu's column: only in the game, and as the game builds it.** Added 2026-11-07 after a report:
  Config from the title, then Config in the left column, then Back twice left the screen empty. — done 2026-11-07: the
  title runs the config (0x2b460 / 0x2c810, called from 0x8e200 at 0x8f58c / 0x8eac0) and Load (0x506e0) itself, so
  there is no column and no header there (the native build's frames of the reference save show only the title's sky);
  the port drew the system menu's column and header on both, and its buttons opened the in-game screens: Config
  reopened as in the game, its Back went to the in-game menu, and that menu's Back closed everything. ui.js config /
  savesScreen draw `header` and `column` only in the game. In the game the column now follows 0x4c370 / 0x4cea0 /
  0x4d580 / 0x4d340: menu_btn_ja's cells from the column's table (0x591438: 224 x 88 from x 24 / 264 / 504, row y 24
  + 104 k; the port cut 240 x 76 from 0 / 240 / 480, losing the cells' lower 12 px) at (80, 105 + 75 k) with their hit
  boxes, menu_window at (56, 2.41), the header's underline at (0, 72) (missing); the menu opens with no button lit and
  no caption (0x4cba0; the port lit Save) and lights the row again coming back from a screen (case 0xc); with a screen
  open, the cursor's line and light fade out (0.1 a frame) while the screen has the focus and come back on the column
  (M19's open note), and the light swings at 1/120 after its first rise (the port rose again at 1/60); choosing the
  open screen's own button gives that screen the cursor back (Config: 0x2c810(2), the page's row and column; Save /
  Load: their list), any other choice closes the screen first (the config's fade and sound 2, 0x2b5c0) and then opens
  the next. Also found: the config's page layer covered its tabs and Reset, so clicking them did nothing; it now lets
  the pointer through. Tests "M21" (3); browser (Playwright, own profile): the report's steps now end on the title
  menu, the title's Config and Load have no column, the Sound tab can be clicked, and in the game: menu opened with no
  row lit, Down x2 lit Config with its caption, the config hid the line and light until Left, the column's Config gave
  the page its cursor back and Load faded the config out before opening. Left open: the title's Load draws bg_backlog
  where the game shows the title's own scene.

## 5. Notes

- [x] **N1. Correct the earlier notes** listed under "Corrections to earlier notes" in FUNCTION-MAP.md (NATIVE-PARITY
  sound, ANIMATIONS/FIXES STRA, FIXES WTSV, ANIMATIONS SNX4, the settled open items, FIXES "Gallery background"). — done
  2026-11-07: NATIVE-PARITY's "all linear, value / 100" now gives the curves (music ca0(B(L x BGM)), plain effects
  ca0(L x SE), voiced effects on the row and switch) and MVOL's linear level before the curve; FIXES' UI-08 row and
  "Still open" list give flag 1 as the mirror (G7) and the read-scene skip's end (S16, `0xae06b8` = 4 is the
  countdown); FIXES "Gallery background" says Config raises and lowers the background from the title (M18) and Load
  does not; PARITY-AUDIT gets a pointer to the corrections (WTSV, STRA's table, flag 1, SNX4). STRA (FIXES VM-05,
  ANIMATIONS), WTSV (FIXES VM-01, ANIMATIONS' VCWT row), SNX4 (ANIMATIONS) and STZ4's 8th argument (NATIVE-PARITY) had
  been corrected while fixing; two stale WTSV mentions (audio.js's voice-wait comment, ANIMATIONS' test list) now say it
  is no command. No runtime check (notes only).
- [ ] **N2. Re-check every function the map counted as handled** (453 "explicit" and "covered" rows: 259 + 194), not only
  cited: list everything each one reads and confirm the port uses all of it the same way. The work list, one box per
  function, is [REVERIFY.md](REVERIFY.md) (5 already re-checked for V11-V13). Added 2026-11-07: QA_17 showed a cited
  function (`0x97b80`) whose inputs the port read only in part. Partly done 2026-11-07, about 50 at the user's request
  (the rest set aside for now): 47 of 453 re-checked, the script machine's 42 of 49 and the five V11-V13 had
  checked; the differences became S33-S36 (done) and S37-S39 (open), and the boxes of 0x77790, 0x6f4d0, 0x5baf0,
  0x802c0, 0x5a910, 0x81b30, 0x814c0 note what was compared so far.
