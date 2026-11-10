B2_title_menu_saves - findings (native 0x424b0-0x53a30, 0x87c10-0x91540, 0x9e1b0-0x9e3e0, 0xaf640-0xb0390, 0xb5650-0xb6d30)

SUMMARY
217 functions: explicit 32, covered 21, divergent 15, missing 6, unused 18, platform 41, helper 84 (ledger.json).
Listing = ROOT/data/tsuki/gen/main (instruction addresses below); SYSMES text read from the patch's allui.mrg.
Globals: Fn = *(0xae0290)+2n (F022 scene, F023 chapter, F024/F025 replay flags), Gn = *(0xae04e0)+2n.

DIVERGENCES / MISSING BEHAVIOUR

1. First launch and New Game (0xb5650, 0x8d2f0, 0x8d1c0, 0x8e200, 0x48ac0) - confirmed in listing
   Native rule: "scene 485 has started" = RDST 485 bit (G140 bit 5, read by 0x926b0(0x1e5)) in the global variables
   that start-up copies from the system save data (0xb5ec4: 1000 bytes into the G block); no save file = all zero.
   A static byte 0xac0de0 (initial value 1 in the image) is the per-boot first-launch flag.
   - Start-up 0xb5650 state 1 (0xb5f30): 485 started -> clear 0xac0de0, play TM_CI (press after 120 frames) and the
     notice; 485 not started and 0xac0de0 set -> state 0x10: no TM_CI, no notice.
   - Title init 0x8d2f0 (0x8d540): a pending flowchart jump (0x17ad0 >= 0) or 485 not started -> title state 0x15 ->
     0x14 -> returns 2 at once (no title drawn, no white fade). 0x48ac0 (0x4945c) then starts script 0x104 = 260 =
     00_01 when 485 has not started, else 0x6e = 110 = START_SCRIPT (table 0x350d58: index 0 = 110, 2 = 260).
   - 00_01 plays movie 4 = prologue.mp4 (TOMP 4; movie table 0x40b890 stride 0x30). The movie task 0x40480 lets
     A/+ (mask 0x4008) skip movie 4 only if G005 bit 2 is set (0x92400(2), "watched before", set via 0x923c0 from
     0x40a00); the first time it cannot be skipped (it ends by itself; the task's limit is 23040 frames = 384 s).
   - After the movie 00_01 runs STCG x39, RDED 485, RTMN -> script code 2 -> 0x48ac0 state 7 (black 0.02/frame),
     system data written (0x87ba0 -> 0x87c10), title. The title now has 485 started but 0xac0de0 still set, so
     0x8d1c0 sets G002 = 0, G010 = 1, variant 0: no title movie, music 2, title_bg0 + "press any button" (state 9).
     A press: sound 6, music fade 0.5 s, black to 1.2, the two cautions (states 0xb-0xd, slots 0x142/0x143), the
     second one's fade-out raising the white; 0xb5620 clears 0xac0de0; state 0x14 fades white 0.01/frame to 1.2 and
     starts START_SCRIPT (-> 00_00). 00_02 (text prologue) is not part of this flow (only JUMP00 for G008 == 260).
   - Later boots (485 started): TM_CI -> notice -> title with its movie (variant by G002) and menu.
   - Menu New Game (item 1): sound 6, music fade 1.5 s; with 485 started: white fade then START_SCRIPT; no cautions.
   Web: boot() (main.js:156) always TM_CI -> notice; title() (ui.js:294) shows "press any button" when there are no
   saves, then cautions -> newGame (main.js:323) = 00_01 then START_SCRIPT (main.js:330); menu New Game also shows
   the cautions and replays 00_01 (ui.js:382); story movies pass on any click.
   Impact: first launch order differs (logos/notice/press-start/cautions before instead of after the opening;
   opening skippable); every later New Game replays the 6.4-minute opening and the cautions.
   Fix: keep a first-launch flag (flow.started.has(485)); on first launch skip boot logos, start 00_01, make its
   movie unskippable unless watched, end it at the press-start page -> cautions -> white -> START_SCRIPT; menu New
   Game: white fade -> START_SCRIPT once 485 has started, no cautions.

2. Return to Title asks nothing in normal play (0x4cea0 case 4) - confirmed in listing
   0x4d088: ldrh F024; cbz -> 0x4d1c4: sound 1, automatic save (popup "Auto Save", 0x52aa0) unless it equals slot
   100 / replay / save system busy, menu closes (1/30 a frame), then the story fades to black (0.02/frame) and the
   title starts. Only F024 != 0 (gallery replay; set by 0x5040 and ARCHIVE) asks dialog 8 "Return to Title Screen?".
   Web: always asks (ui.js:565) and cuts to the title. Impact: every Return to Title. Fix: no dialog unless replay.

3. Gallery replays (0x4cea0, 0x4cb30, 0x4e0c0, 0x4cca0, 0x47a90, 0x48ac0) - confirmed (0x4cb30 cell look: likely)
   In a replay (F025 != 0): Save and Load refused with sound 2 (0x4cfe0/0x4d02c) and drawn with other cells
   (0x4cb30); mode panel Quick Save/Quick Load disabled (0x4e0c0); FlowChart asks dialog 12 "End Scene Playback?"
   when the replay came from the gallery's flowchart (0x50f0: gallery section 2) and returns to it; the replay's
   end (F024 != 0, state 3) returns to the gallery with the background raised and the title music (0x47a90).
   Web: Save/Load/quick save/flowchart allowed (only the title's Save is disabled, ui.js:598); a flowchart replay
   ends on the title with a toast "End of the scene" (main.js:330-339; only Ending List episodes return to the list).

4. Save/load list (0x50790, 0x50fc0, 0x4f240) - list builder confirmed in listing
   0x50790 collects only slots 0-99 (cmp x23, #0x64 at 0x50888) that are used, sorts by date (stable sort 0x52c20)
   and lists them newest first; in save mode with < 100 used the lowest empty slot is first. Automatic slots
   100-138 never enter the list (0x50790 is the only writer of 0xf1f514), so the saveauto mark is dead code and the
   automatic saves are reached only through Continue. Web: 100 fixed rows in slot order incl. empty ones and 39
   automatic saves first when loading (ui.js:702-800). Impact: every save/load screen.

5. Save/load prompts and messages (0x50fc0, 0x48540) - confirmed (empty-slot path 0x522a4/0x511f0)
   Empty slot: saved at once with a "Saving" message box (SYSMES 183); used slot: dialog 2 "Overwrite?" (SYSMES
   180); saving needs a valid checkpoint (0xf17ff2); loading asks dialog 0 "Load?" then "Loading" (184); empty list
   shows "Data not Found" (212). Web: "Save?" / "Overwrite this save?" (ui.js:795-796), toast "Saved".

6. Chapter title, info picture and scene name from F023/F022 (0x4c370, 0x4cba0, 0x4f240, 0x50b10) - confirmed
   Menu header cell = F023 via 0x591558; save slot title cell = F023 via 0x592484; info picture = F023-11 via
   0x3506b0 (else saveinfobg_unknown); scene name = SYSMES 395+F022 in the menu's scene band and in every save row.
   Web: phaseOf(script name) (ui.js:15) and /ARC|CIEL/ (ui.js:724); scene band shows the chapter name. Counting
   each script's first F023 (518 scripts): menu header differs for 222 (arc/ciel swapped in chapters 6, 9-11, 14,
   15; 05_01; 14_01A/B; QA_*; 00_01/00_02), save title for 220, info picture for 139 (chapters 1-5 show arc/ciel
   instead of unknown); no scene names. Fix: read s.vars.F023 / F022 with the three native tables.

7. Quick save / quick load (0x4e170, 0x89590, 0x52860, 0x40e70) - confirmed
   Quick load refused when slot 139 is empty; its dialog 9 shows the quick save's picture under the question
   (0x89590 -> 0x884f0(0, record, 0); 0x4b4a0(1)). Each save starts a 180-frame cooldown (0x40e70(0xb4)) during
   which quick save is refused (sound 2). Quick save stores the checkpoint, not the live state. Web: no picture, no
   cooldown (main.js:455-461).

8. Completion banner missing (0x90440, 0x91350) - confirmed
   On the title, once 0x926f0(1) is false (episodes 1-24 complete) and G069 == 0: G069 = 1 and SYSMES 239
   "Congratulations on completion! Please head to the ending list." on a band at y 480 (in 30 frames, cubic; held
   300; out 30). ANIMATIONS.md lists it as not traced.

9. Title music in the gallery (0x8e1c0) - likely
   0x8e1c0 (music 2/72) is called on every gallery section change except to section 1 (0x7624), when the music
   player stops (0x19838 case 4) and on replay return (0x47a90): the title music plays in the gallery. Web stops it
   (main.js:421).

10. Continue and the title cursor (0x8d2f0, 0x8e200 case 0, 0x4eeb0) - confirmed
   Continue appears only when system data +0x161e (newest record 0-138 by date, quick save excluded) is a used
   record, else the menu has 4 rows; choosing it shows "Loading", fades music 1.5 s and the screen to black
   0.01/frame. First cursor: Continue, else Load if any manual save, else New Game. Web: Continue always row 0,
   loads at once (ui.js:481); no-save players get the press-start page instead of the menu.

11. Story end and transitions (0x48ac0, 0x48420) - confirmed
   END_ fades to black 0.02/frame before the title; RTM_ also saves the system data. Web: immediate title plus a
   toast "End of the scene" (main.js:339).

UNUSED NATIVE CODE
- Old extra screens (18): 0x42760, 0x43bf0, 0x424d0, 0x440e0, 0x44b70, 0x47570, 0x455c0, 0x45850, 0x46660,
  0x45a90, 0x45c40, 0x45e80, 0x45fe0, 0x46480, 0x46770, 0x469c0, 0x425a0, 0x8d180. Only reached through title codes
  5/6 from states 0x2e/0x2f, set only by the submenu state 0x2b; GALLERY writes 0x29 and overwrites it with 0x30
  (0x8f5dc/0x8f5f8); no writer of state 0x36; 0xb2d550 = 1/10 and task slot 0xae06f8 are set only by 0x45850/0x46660.
- Title items 4 and 6 (offline manual web applet "/manual.htdocs/index.html") are never available (0x15361f0 lo and
  0x15361f8 stay 0).

LIMITS
- 0x50fc0 (1526 instructions) was read for the slot choice, prompts, write and load paths, not every state.
- When G005 bit 2 is set (movie start or end) was not traced (0x40a00 is A's).
- Quick-save refusal flags in 0x4e170 (0xae04b8 & 0x410, 0xae0668) not decoded; 0x4cb30's cells assumed greyed.
- Message-box behaviour (0x4abe0 family) belongs to B1; only its use here was recorded.
- No runtime check of the native besides the coordinator's runs (fresh profile: prologue.mp4 at boot, no logos).

## Re-check of the handled functions (2026-11-08)

53 functions of this part compared with the port: 22 the same, 31 different, 0 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-1: ATSV moves the checkpoint only on a page's first line, and SELD never does (medium, confirmed)

Functions: `0x527f0`.
- Native: ATSV's three arms (0x79020-0x7907c, 0x7a8f0-0x7a94c, 0x7c01c-0x7c078) call 0x527f0 only when the record's +0x35c0 is 0, its type is not 0xb / 0xc and F823 <= 1. SELD's row loop writes type 0xc records (0x7f788), which always fail that gate (0x7f7f0-0x7f818), so its call at 0x7f850 never runs.
- Port: vm.js:753 op_ATSV and vm.js:880 op_SELD call checkpoint() with no F823 test (only flag 8 and skipUntil pass it).
- Effect: A save or automatic save made at a mid-page choice, or after an ATSV at F823 >= 2, resumes in the game at that page's first line, so the page is read again up to the choice; in the port it resumes at the ATSV or at the choice itself.
- Reached: 74 ATSV calls at F823 >= 2 by a linear count of the scripts (mostly _ATSV(1) before choices); 170 SELD calls.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_ATSV moves the checkpoint (savePoint) only when F823 is at most 1 and no XSTP task holds records back (record +0x35c0: listing 0x79030-0x79044, 0x7a900-0x7a914, 0x7c02c-0x7c040), while its Return to Previous Scene point is made either way; op_SELD no longer touches it (its call at 0x7f850 is never reached); restore moves it only for a record on a page's first line (0x5d300-0x5d368), so a rewind or Quick Jump onto a later line leaves it where it was, and a load takes its record as before, so older saves keep loading unchanged; a message records it only outside XSTP .. XRSM.
- Compared: Compared with native frames: synthetic scenes run in the sandbox (New Game, Return to Title's automatic save, Continue): three lines + ATSV(1) + choice resumes on the first line and the player clicks on to the choice; one line + ATSV(1) + choice resumes at the choice; a choice with no ATSV resumes on the first line. The same scenes in an isolated browser resume on the same lines in the port.
### N2-26: Replaying Glass Moon from the gallery's flowchart runs the wrong script (medium, confirmed)

Functions: `0x42680`.
- Native: ARCHIVE sends G008 240-299 to JUMP(8001, ARCHIVEJUMP) = JUMP00, where `_IF__(G008,eq,260,LV00100);_JUMP(270)` goes to script 270 = 00_02, the text prologue (RDST / RDED 485).
- Port: web-dev/tools/build_flowchart.py: part.script = index.jump[part.jump], so jump 260 is script 2 = 00_01; flowchart.js:213 -> main.js:565 startAt runs 00_01, whose body is TOMP(4), the opening movie.
- Effect: Choosing the first node of the gallery's flowchart plays the opening movie instead of the text prologue.
- Reached: Node flag 485 'Glass Moon', jump 260, offered once scene 485 is completed (gallery mode: p.reg = C(flag), flowchart-model.js:405). G008 260 is the only entry whose target is not its own number among the 518 entries of JUMP00-15 (493) and JUMPQA (25).
- Second reading: Holds: JUMP00 has _IF__(G008,eq,260,LV00100);_JUMP(270), index.jump maps 260 to script 2 (00_01: TOMP(4)) and 270 to script 3 (00_02: the VPL2 text prologue, RDST / RDED 485), and build_flowchart.py:47 / main.js:565 start the node's own jump directly. G008 comes from the part's jump (0x116e4 -> 0x5040 -> 0x48d58); only the pair count is off.
- Fix (2026-11-08): main.js replayScene: a replay from the gallery's flowchart sets G008 to the part's jump and starts script 3000 (ARCHIVE), as 0x48ac0 case 4 does, so ARCHIVE and JUMP00 .. JUMPQA pick the scene.
- Compared: Native run with the reference save: the gallery's flowchart opens on Glass Moon, and A plays the text prologue ("Suddenly, I woke up.", then "As everyone sleeps..."). In an isolated browser the port reaches 00_02 the same way.

### N2-27: Two replays lack the variable the jump script sets, and play another scene (medium, confirmed)

Functions: `0x42680`.
- Native: JUMP01 does `_WKST(F050,eq,1);_JUMP(326)`, JUMP02 `_WKST(F054,eq,1);_JUMP(354)` (JUMP04 also sets F058 for 407, which that scene does not read). 01_01_CIEL01_2_3 opens `_IF__(F050,eq,0,LV00000);_JUMP(327,LBL_003)`: with F050 = 1 it goes to LV00000 and scene 69; 02_01_CIEL02_1_3 likewise with F054 and JUMP(355,LBL_004).
- Port: main.js startAt (377-396) starts the scene directly with only F026, F822, F024, F025 and F028 set. F050 / F054 are 0, so vm.js op_IF__ falls through to the JUMP and the replay runs 01_01_CIEL01_2_4 / 02_01_CIEL02_1_4 from those labels.
- Effect: Selecting either 'I'll figure it out in the hall' node in the gallery's flowchart does not show that scene; the next script plays instead, until its RDED ends the replay.
- Reached: Nodes flag 69 (jump 326) and flag 184 (jump 354), offered once completed.
- Second reading: confirmed.
- Fix (2026-11-08): main.js replayScene, as N2-26: JUMP01 and JUMP02 now set F050 and F054 before their scene.
- Compared: No native frame (the scripted cursor does not reach these two nodes). In an isolated browser, node 69 runs 01_01_CIEL01_2_3 with F050 = 1 and node 184 runs 02_01_CIEL02_1_3 with F054 = 1 and its own first line.

### N2-28: Opening the system menu leaves skip on, its icon over the menu (medium, confirmed)

Functions: `0x47bf0`.
- Native: 0x40ed0 0x42194-0x421ac opens the menu: strb 1 to *0xae0678 and `and w8, w9, #0xfffffffd` on *0xae0660, clearing the skip toggle (bit 1; auto, bit 0, stays). Closing the menu does not set it back. 0x41000-0x41010 then gives indicator state 0xafec9c = 0, so 0x3b5f0 (task 0xe, prio 82, under the background's 83) draws no icon. The open question: it is not lit while the menu is up. The backlog (0x27e40 path) keeps the toggle and the icon is drawn under its veil (prio 87).
- Port: main.js:695 and 725 call ui.system(); ui.js:334 begin only sets vm.paused and nothing calls setSkip(false). vm.skip and #mode-skip.on stay (style.css:202-203, z-index 2, index.html:21 after #ui), so the icon shows over the menu and over the backlog's veil; ui.close -> vm.resume goes on skipping.
- Effect: With skip on, opening the system menu stops skipping in the game: the >> goes and after closing the menu the text waits. The port shows the >> on top of the menu's header and resumes skipping when the menu closes.
- Reached: Any story text with the skip toggle on (F or the panel) and the menu key or a right click; no script condition.
- Second reading: confirmed.
- Fix (2026-11-08): main.js systemMenu: opening the menu calls setSkip(false) (auto stays). index.html / style.css: #mode-skip, #mode-back and #mode-auto go before #ui with no z-index, under the menus, the mode panel and the backlog's veil. vm.js waitAdvance: a skip switched off during its frame leaves that message waiting, so the text stays on the same line.
- Compared: Native run with the reference save: R, then Y during the skip, then B: the text stays on one line for 10 s after the menu closes. The port in an isolated browser: skip and the >> off, the same line and pc after the menu closes.

### N2-29: The title logo is back at full at once after the title's Config (medium, confirmed)

Functions: `0x4bcf0`.
- Native: 0x2b680 raises the background from the title (0x49630(0.024)) and 0x2c500 lowers it (-0.024); task 0x14 (0x8d5d0) keeps running in state 0x21, so the logo falls to 0 in 60 frames, stays there while the level lowers (42 frames), then rises 1/120 a frame with its pieces at L, L^2, L^3.
- Port: ui.js config (line 1693) keeps its own MenuBgFade on its own page; closing it calls titleMenu(), which starts with logo.level = 1 (ui.js:641, fresh false).
- Effect: After closing Config at the title the logo, its light and the dust are there at once; in the game the logo has gone and comes back over about 2 s after the background has lowered.
- Reached: Every return from the title's Config once it has been open for more than a moment (the title's Load raises nothing). N2-142 covers the particles and glow restarting, not the logo.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js keeps the title's page, its frame loops and its keys alive under Config and Load (begin(screen, { title: "hold" }), this.titleLive) and gives them back on the way out (titleBack), so the logo falls 1/60 a frame under the rising background and comes back over 120 frames once the background has gone, with the rows and the cursor as they were.
- Compared: Native frames (every frame, reference save: Config and Load opened from the title and closed) against the port hand-stepped in an isolated browser: logo gone within 60 frames of the opening, back over 120 frames from the end of the close, cursor still on Config / Load Game.

### N2-30: Save / Load screen has no fade; a column choice cuts to the next screen (medium, confirmed)

Functions: `0x4d340`.
- Native: 0x50e00 zeroes the screen alpha 0xf1f440; 0x50fc0 state 1 raises it 0.024 x frames (0x51088-0x510a0, about 42 frames) and takes no input until it is 1; closing (state 5 then 0x1b) lowers it 0.048 x frames (0x51980-0x519a8, about 21 frames) and only at 0 returns 2 or 3, so 0x4d340 moves to state 9 and the screen in 0x5912ec after it. 0x4f240 draws the backdrop, help bar, rows and info at that alpha.
- Port: ui.js:1087 savesScreen builds the page at full opacity with no level; 1216 backFn calls system({ back: true }) at once, 1220 screenClose = (next) => next() opens the next screen at once, and a load closes the screen at once (the config has its 0.024 fades, the save list none).
- Effect: Save and Load appear and vanish in one frame; in the game they fade in over about 42 frames and out over about 21, and a column choice, Back or a load waits for the fade-out. The list takes keys during what would be the fade-in.
- Reached: Every Save or Load from the system menu (0x4d8c0 states 5-8) and Load from the title (0x8f568).
- Second reading: confirmed.
- Fix (2026-11-09): ui.js savesScreen: a level of its own (--a in style.css, each piece taking it, as 0x4f240 draws them) rises 0.024 a frame and falls 0.048; no key or press during either (ui.menuBusy, the page's pointer events off). Back, a column choice (screenClose) and a load (as its notice closes) go on when the fall ends. Closing adds save-out: state 5 empties the list first (0x152650 over 0xf1f514, then 0x4f240's `slot < 0x8b` tests fail), so each row's picture and text and the panel go at once and only the empty row windows, the backdrop, the help band and the scroll bar fade, a detail the first reading missed. The list after a save (state 9) comes back at full on the slot just written (opts.again). The panel shows nothing for an empty row (0x4f240 draws it only for a used slot).
- Compared: Native frames (every frame, reference save and New Game: Save opened, Left, Right, Back; Save -> column -> Load; a load; Return to Title from the column) against the port hand-stepped frame by frame in an isolated browser, and a real-time pass with keys and the mouse. Same order of events at each step; the contents gone on the first frame of the close; the thumbnails, which the game loads over several frames, are there at once in the port.

### N2-31: Return to Title does not wait for the Auto Save popup (medium, confirmed)

Functions: `0x4d710`.
- Native: State 0x12 (0x4d710) holds the game in the menu while popup 2 runs, stepped 0.04 a frame by 0x3c970 at the normal frame step (75 frames up, 25 down; 0.1 only when a frame was dropped), with the menu and background falling 1/30 a frame; a press once t >= 1 hurries it (0x3b480: t = 3, then 25 frames down). The black cover only starts after state 0x15 ends.
- Port: main.js:539-540 toTitle calls autosave() (which starts the popup), then ui.close() and fadeToBlack(0.02) at once, so the popup and the black overlap and no press can hurry it.
- Effect: Return to Title with an automatic save written: the game shows the menu fading out (30 frames) with the popup, about 100 frames before the black starts (about 50 if hurried by a press); the port cuts the menu and starts the black at once, reaching the title about 100 frames sooner.
- Reached: Every Return to Title from the system menu in normal play when 0x4cea0 writes the save (the point differs from the newest automatic save).
- Second reading: Flow holds: 0x4cea0 case 4 (when 0x52a20 etc. allow the save) calls 0x3b430(2) and state 0x12; 0x4d710 steps the menu at -1/30, polls 0x3b570 and only then goes to 0x15, and a press calls 0x3b480; main.js:539-540 starts the black at once. The popup step is wrong: 0x3c970 listing 0x3eb34-0x3eba4 takes 0.04 x frames when the frame step 0xad1c0 is 1 (0.1 only when it is above 1), so 75 frames up and 25 down, 100 in all, as N2-10 says; the first reading used the 0.1 branch and conflicts with N2-10.
- Fix (2026-11-08): main.js toTitle: autosave() tells whether it wrote; when it did, ui.waitForPopup(popupBusy, popupHurry) (state 0x12): the menu falls 1/30 a frame (system()'s menuFade), the next step waits until the popup has gone (0x3b570), and A or a tap sends it on its way once it has finished coming up (the popup's hurry: t = 3, as 0x3b480). Only with no automatic save the old path applies (N2-32, a separate item, is that path).
- Compared: Native frames (every frame, reference save; run t12 press A on Title; t15 A again 0.8 s later): the menu falls over 30 frames, the popup stays up 100 frames (75 up, 25 down), hurried 75, and the black starts only after it. The port hand-stepped frame by frame in an isolated browser: menu 0 at frame 30, popup gone at 103, black from 103, title at 154.

### N2-32: Return to Title skips the close fade and stops the music late (medium, confirmed)

Functions: `0x4d7e0`.
- Native: State 0x15 fades the menu over 30 frames, then 0x5f200 cuts the music (0x9c650, state 2 at 416.67 a frame, unless 0x146e64d is set) and the sound slots before 0x48ac0's black cover rises at 0.02 a frame. 0x4cea0 case 4 clears the window-open flag (0x2e120(0)) when Title is chosen, so 0x38d40 closes the text window at 0.1302 a frame during the menu's fade.
- Port: main.js:540 ui.close() removes the menu at once. main.js:548 audio.stopAll and main.js:551 text.setOpen(false) run after the await on fadeToBlack, so the music and the text window last through the black.
- Effect: Return to Title: the menu vanishes in one frame instead of fading over 30; the text window stays up into the black instead of closing within about 8 frames; the music plays through the black and stops as the title appears, where the game cuts it before its black begins (from the press: about 20 frames later than the game with no automatic save written, about 50 earlier with one).
- Reached: Every Return to Title from the system menu.
- Second reading: Listing holds: state 0x15 (0x4d7e0) falls 1/30 a frame and then calls 0x5f200 -> 0x9c650 (state 2, 416.67) unless 0x146e64d; 0x4cea0 case 4 calls 0x2e120(0) and 0x48ac0 runs 0x38d40 every frame (0.1302 a frame). main.js:540 ui.close(), main.js:548 audio.stopAll and main.js:551 text.setOpen run as claimed. The music's '50 frames after the game cuts it' only holds aligned on the two blacks: the port's black starts at the press, the game's after state 0x15 (30 frames) or after the popup (about 100), so counted from the press the port cuts about 20 frames later with no save and about 50 earlier with one.
- Fix (2026-11-09): main.js toTitle: text.closeWindow() at the press (the window's own rate, 0x2e120(0)); a screen beside the column closes first (leave); after the popup's wait (N2-31) ui.menuGone() runs state 0x15's fall of 1/30; audio.stopAll at the end of the fall, before the black (0x5f200). ui.js system: at level 0 the blur goes at once (0x4b880 -> 0x2e030), under the popup too. endReplay (dialog 12, End Scene Playback) takes the same close.
- Compared: Native frames (popup path, from the plain menu and from Save's column) against the port stepped by hand: the menu falls in 30 frames, the blur leaves at level 0, popup and music cut at frame 103, title at 155 from the press; the same order on the native run. With no automatic save to write (a native run, Return to Title twice from one point): the menu falls in 30 frames, then the black and the title, as the port does (music cut at frame 31, title at 83).

### N2-33: Flowchart from the menu: no 12-frame fades, Back replays the opening (medium, confirmed)

Functions: `0x4d8c0`.
- Native: Case 0xe fades the menu foreground at 1/12 a frame with the background left up, then runs the flowchart (0xf). Case 0x10 on return fades the foreground back at 1/12 and relights the row (0xae0e0).
- Port: ui.js:1026 opens the flowchart at once. flowchart.js:310 backToGame calls ui.system() then ui.select(3), the full opening: foreground and background from 0 at 1/18 with the bands sliding in again from t = 0.
- Effect: Going to the FlowChart cuts instead of fading over 12 frames, and coming back replays the whole menu opening (18 frames, bands over 60) instead of a 12-frame fade of the foreground over a background that stayed up.
- Reached: Every in-game flowchart visit from the system menu.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js flowchartFromMenu -> menuFlowOut: the foreground (no row lit, the column's cursor going out) falls at 1/12 a frame with the background left up, then the flowchart opens over it (flowchart.js now draws the menu's background under the in-game chart). system({ flowBack }) brings the foreground back at 1/12, lighting the row at the end. "Flowchart is not yet available" goes through the same fades (the notice shows over the background alone), as the game's state 3 does, which the port had shown over the menu.
- Compared: Native frames (New Game, not available; the reference save, the real chart) against the port: the same order of events both ways, the row lit at the end of the return.

### N2-34: Panel key cursor starts on a different button (medium, confirmed)

Functions: `0x4dd00`.
- Native: 0x4dcc0/0x4dd00 writes 0x300000003 over 0xb35a1c and 0xb35a20, so both cursors start at 3. 0x4e170 lights 0xb35a20 + 0xcf when the panel is opened by key, and only 0x4e170 changes them, so the choice carries between openings.
- Port: ui.js:2324 sets p.sel = keyboard ? 2 : -1 on every opening.
- Effect: Opening the panel by keyboard or pad: the game starts on the fourth button (Fast Forward) and later openings keep the last one; the port always starts on the third (Auto), so Up then confirm toggles a different mode.
- Reached: Every mode panel opening by keyboard or controller.
- Second reading: confirmed.

### N2-35: Panel buttons sit 12 px lower and 4 px right (medium, confirmed)

Functions: `0x4de10`.
- Native: 0x4de10 places buttons 0xcf-0xd6 at x 25.33 + 73.67 i and y bar + 6.637 units, (76 + 221 i, 16) at 1080p; each is a 224 x 64 cell of texture 0x4eb from (8 + 232 i, 80) at offset 0 (table 0x5918c8, lists at 0x591a78), so atlas (10, 81) lands at (78 + 221 i, 17).
- Port: ui.js:2282 places each at left 82 + 221 i, top 29, 220 x 62 from (10 + 232 i, 9 + 72 row): atlas (10, 81) lands at (82 + 221 i, 29).
- Effect: The eight buttons appear 12 px lower and 4 px further right on the bar than in the game: their art spans y 32-87 in the 96 px bar where the game's spans 20-75 and is centred. Hit areas move with them.
- Reached: Every mode panel opening.
- Second reading: confirmed.

### N2-36: The title's Load and SELA's save screen raise the menu background at 0.024 a frame (medium, confirmed)

Functions: `0x50e00`.
- Native: 0x50e8c-0x50ebc: when *0xae04e8 is 0 (title) or SELA is active (0x85c10), 0x49630(0.024, 0) raises the system menu background alongside the screen's own 0.024 fade; 0x50fc0 state 1 stops it at full, state 0x1b lowers it at 0.024.
- Port: ui.js:1092 draws bg_backlog from the title and ui.js:1093 menuBackground settled at full for SELA; no rise.
- Effect: The title's Load shows bg_backlog at once where the game shows the menu's sky rising over about 42 frames; SELA's save screen has it at full from the first frame.
- Reached: Every Load from the title; 26 SELA scripts when the player answers Yes.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js savesScreen: the title's Load and SELA's save screen get a MenuBgFade of their own that rises 0.024 a frame with the screen and falls 0.024 as it closes; the title's stops at 0 when the screen has gone (0x49630(0), a cut from about 0.5), SELA's goes on falling over the story (lowerOverStory). bg_backlog is no longer drawn on the title's Load.
- Compared: Native frames of the title's Load (the menu's sky over the title, no bg_backlog) against the port's; SELA's on a native synthetic scene.

### N2-37: Saved records do not get F1118 set, so Save Progress is asked again after a load (medium, confirmed)

Functions: `0x52aa0`.
- Native: 0x52aa0 at 0x52b30-0x52b68 calls 0x53f00(record + 8, 0x45e, 1), setting F1118 in the record's flag bits (table 0x3511a4, index 39, snapshot +0x3482), which 0x5baf0 / 0x826f0 give back on load. The manual save does the same (0x50fc0 at 0x51554-0x5159c). The quick save 0x52860 does not. SELA asks only when F1118 is 0 (0x85bf0).
- Port: main.js:497 makeSave and main.js:517 autosave copy vm.savePoint's vars unchanged; F1118 appears only in vm.js:849 op_SELA.
- Effect: A save made at a chapter opening's checkpoint (F1118 still 0 from the previous chapter's end), including one made through Save Progress? itself, asks Save Progress? again each time it is loaded in the port; the game does not ask.
- Reached: 26 chapter-opening scripts: _ATSV (F823 is 0 there at all 26) then _IF__(F026,ne,0,...) then _SELA, with F1118 = 0 set just before the previous chapter's JUMP.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js markSaved: main.js makeSave (manual saves) and autosave put F1118 = 1 in the record they write; the quick save (makeSave({ quick: true }), 0x52860) copies the checkpoint unchanged. A save made before this loads unchanged: F1118 stays what it was and Save Progress? asks as it did (test).
- Compared: Native run t21c / t24c (a scene with F1118 0 before its ATSV: Save Progress? asked, Yes, saved to the empty slot, then a fresh boot with that save and Continue): no question after the load, while a scene that sets F1118 to 0 after its ATSV asks again (t24). The same scene in an isolated browser: the record holds F1118 = 1 and the load asks nothing.

### N2-38: Title menu rows fade with the logo, not on their own 60-frame timer (medium, confirmed)

Functions: `0x8d5d0`.
- Native: 0x8dc74-0x8dcbc: row alpha = [0x1536198] x clamp(2m - (row + 1) / n, 0, 1). [0x1536198] is the logo level cubed while rising (0x8d87c-0x8d894, 0x8d9f0-0x8da00). m (*0xae0b78) follows 1 - black upward (0x8d728-0x8d750) and reaches 1 after 83 frames at 0.012 a frame. The logo starts rising once black < 0.5 (about frame 42) and is full at about frame 162.
- Port: ui.js:656-658: menu rises dt / 60 from 0 and row alpha is clamp(2 x menu - (i + 1) / n), with no logo factor; ui.js:641 starts menu at 0 on a fresh entry.
- Effect: On every fresh title entry the rows are fully drawn by frame 60 in the port (dimmed only by the black cover). In the game they are at 0.04 at frame 83, 0.11 at frame 100, 0.28 at frame 120 and reach full alpha with the logo at about frame 162.
- Reached: Every title entry with the fade in (start-up, return from a story, return from the gallery).
- Second reading: confirmed.
- Fix (2026-11-09): uifx.js titleRowAlpha, ui.js titleMenu: a row's alpha is the logo's third piece times clamp(2m - (row + 1) / n), m following 1 - black upward.
- Compared: Native frames of a boot to the title against the port hand-stepped: rows at 0.04 / 0.11 / 0.28 at frames 83 / 100 / 120 and full with the logo at 162.

### N2-39: White cover lacks its additive second pass (medium, confirmed)

Functions: `0x8d5d0`.
- Native: 0x8e0ec-0x8e180: when white 0x1536180 > 0 the rectangle is drawn twice, blend 0x1b (draw type 0, normal: 0xd3914 case 0) at alpha w, then blend 0x1e (draw type 1, SrcAlpha + One: 0xd3914 case 1, selected through 0xd495c) at alpha 0.5 x w, so the screen is (1 - w) c + 1.5 w, clamped.
- Port: ui.js:583-586 and ui.js:596: one #fff layer at opacity min(1, level) through fadeBlack (ui.js:541-548).
- Effect: The New Game fade to white is dimmer in the port at every step: a dark title reaches full white at w of about 0.67 (67 frames at 0.01 a frame) in the game, and at w = 1 (100 frames) in the port.
- Reached: New Game from the title menu once scene 485 has started (state 0x14).
- Second reading: confirmed.
- Fix (2026-11-09): ui.js whiteCover: a white layer at min(w, 1) and the same again added (fx-add) at half that, used for New Game and the cautions' end.
- Compared: Native frames of New Game: (1 - w) c + 1.5 w in display values fits every frame of the fade within 1.6 levels (a single pass is 8 off), full at w about 0.67.

### N2-40: First-launch background drawn too large and too low (medium, confirmed)

Functions: `0x8d5d0`.
- Native: 0x8d79c-0x8d7d4: slot 0x140 (title_bg0, texture 2670 x 1266) with flags 0x14 (centre anchor, scale on), scale (0.47, 0.4735) on the 960 x 544 screen, at (480, 256): 2510 x 1190 pixels centred at (960, 508.2).
- Port: ui.js:504: title_bg0 at (-375, -93), 2670 x 1266: scale 1 centred at (960, 540).
- Effect: On the press-any-button screen the background is 6% larger than in the game and its centre sits about 32 pixels lower.
- Reached: First launch only (G010 = 1).
- Second reading: confirmed.
- Fix (2026-11-09): uifx.js FIRST_LAUNCH, ui.js title: title_bg0 at 0.94 about (960, 508.2).
- Compared: A native frame of the first launch's title against the port's: the best offset of the background is (0, 0), left and right thirds within 0.1 of a level.

### N2-41: Press-any-button drawn 37 pixels too low and pulsing from the start (medium, confirmed)

Functions: `0x8d5d0`.
- Native: 0x8db24-0x8db80: slot 0x141 (press_start, 472 x 88), flags 0x11 (top centre, scale on) at (480, 411.586) of 960 x 540 with scale (0.5, 0.5037): top at y 823.2, 88.65 tall. Its alpha 0x1536188 stays 0 until state 8 starts the pulse, after the 83-frame fade.
- Port: ui.js:508: top at y 860, 88 tall; the CSS blink animation (style.css:77-78) runs from page creation.
- Effect: The prompt sits 37 pixels lower than in the game, and it is already pulsing during the fade in, where the game shows nothing until the fade has finished.
- Reached: First launch only.
- Second reading: confirmed.
- Fix (2026-11-09): uifx.js FIRST_LAUNCH / pressPulse, ui.js title: the prompt's top at 823.2, 88.65 tall; alpha 0 until three frames after the black has gone, then 0 to 1 to 0 at 1/60 a frame. Found while checking this: no key ever reached the screen (ui.key stopped them all, only a click worked), and the press's fade fought the fade in; both fixed (keyFn, fadeBlack's new fade taking over).
- Compared: A native frame against the port's: ink rows 856-877 and columns 754-1164 in both, best offset (0, 0).

### N2-42: First-launch screen has no logo fade and no particles (medium, confirmed)

Functions: `0x8d5d0`.
- Native: The logo level, its t / t^2 / t^3 pieces and the dust and shards (0x8d89c-0x8d8a4) do not depend on G010; only titlemenu_lumi does (0x8da78). Their gate 0xfbfd4 is TryWaitEvent on *0xae0190 + 0x1e0, which the frame loop 0x1ec0 also uses to pause audio handles; it is not a movie test.
- Port: ui.js:503-510 appends the whole logo as one static sprite and creates no particle canvas.
- Effect: On the first-launch screen the logo is present from the first frame with no particles; in the game it fades in piece by piece from about frame 42 to about frame 162 with dust and shards rising.
- Reached: First launch only.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js titleLogoLayer, shared with the menu's title: the three pieces at the logo's level, dust and shards before them, no light on this screen.
- Compared: Native frames of the first launch's title against the port hand-stepped.

### N2-43: Cautions end in a cross-fade to white, with the additive pass (medium, confirmed)

Functions: `0x902f0`.
- Native: 0x90370-0x9041c draws white 0x1536180 over the caution at alpha w, then again added at 0.5 x w. 0x8e200 state 0xd (0x8e6b0-0x8e6d8) raises that white 0.02 a frame while the caution index 0x15361a0 is 1, so state 0x14 continues from 1.0 and passes 1.2 after 20 frames.
- Port: ui.js:746-769 fades each caution alone; ui.js:525-530 then starts a new white from 0 at 0.01 a frame to 1.2, with one layer only.
- Effect: After the second caution the game cross-fades straight to white and holds it about 20 frames. The port fades the caution out on its own, then takes 100 frames to bring up white, about 120 frames in all before the story starts.
- Reached: First launch only: press any button, then the cautions (states 0xb-0xd).
- Second reading: confirmed.
- Fix (2026-11-09): ui.js cautions: the two-pass white rises 0.02 a frame while the second caution fades out, then 0.01 a frame from about 1 to 1.2 before the story starts (20 frames).
- Compared: Native frames (a fresh profile through the opening, every frame) against the port hand-stepped: the veil over the second caution, the white full about 33 frames after the press, cross-fade over 50, white held 20, then the story; the port's white runs straight into the story's own fade from white (painted frames).

### N2-80: Choice rows type at the last message's speed (low, confirmed)

Functions: `0x4ea30`, `0x4ec60`.
- Native: 0x83e50 at 0x846e8-0x84714 sets bit (row value) of 0xae07b0[SELD n] when a row is taken; 0x4ea30 / 0x4ec60 keep the 0x118 bytes in system data +0x1624. SELD at 0x801c8-0x801dc passes bits[n] != 0 to 0x3b2b0(1, flag), and the choice draw 0x84e50 at 0x85068 types its rows at 0x3b2d0(1): config +0x10 (read, default 15) when the choice was answered before, else +0xe (unread, default 35).
- Port: ui.js:2170 ChoiceFx.perFrame(this.text.speed), the speed vm.js:969 set from the previous message's read state; no per-choice record exists.
- Effect: A choice reached for the first time after already-read text types at the read speed instead of the unread speed (15 against 35 ms a letter by default), and an answered choice reached after unread text or straight after a load types at the unread speed instead of the read speed.
- Reached: All 170 SELD calls in the scripts pass through this; the mismatch needs the message's read state and the choice's answered state to disagree.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js: choice rows always type at the unread speed (config +0xe; slot 1's read flag is only ever written 0).
- Compared: Listing and test.
### N2-95: Parent pivot y scale (low, confirmed)

Functions: `0x89420`.
- Native: 0x894e4-0x894f0 scales the parent's pivot y (640 x 362 units) by 0.5.
- Port: transform.js:93 subtracts ppy * IY: 90.667 against 90.5 engine units for a centred parent 720 stored pixels tall.
- Effect: An SBAS child sits about 1 px off vertically at zoom 1.
- Reached: SBAS children of parents with a table pivot, as for the live 0x388d0.
- Second reading: confirmed.

### N2-130: The script runs on during the read-scene skip's countdown (low, confirmed)

Functions: `0x424b0`.
- Native: 0x40ed0 at 0x4102c: states 1, 2 and 3 all leave through 0x41218 / 0x41214, before the only call of the frame step 0x802c0 at 0x420c4. After RDAS the interpreter runs to its first wait, then no command runs for 1 + 4 frames (dialog + 20 after a Yes) until 0x53950(1); the instant run then starts with a stop-all (0x802c0: 0x5ef10(0)) and drops one-shot sounds and voices.
- Port: vm.js op_RDAS (656-668) starts a detached 4 / 20 frame countdown and returns, so the script keeps going in real time until beginInstant; one-shot SEPL and the voice (vm.js:1550, 1600) play because this.recorded and this.skip are not set yet. FIX-CHECKLIST S16 records 'while the script goes on' as done, which is not what the listing does.
- Effect: With Read scenes auto skip on, entering a completed scene: the port plays the one-shot sounds and the first voice that the script reaches during those frames, under the black; the game plays none of them. A voice started then keeps playing through the run (endInstant restores with stopVoice false).
- Reached: 530 RDAS. Linear survey of what lies between the first FADS / WTTM after RDAS and the port's next real wait: 55 one-shot SEPL in 31 scripts and a VPLY with the first message in 20 scripts (also 194 MPLY that start up to 5 frames early).
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_RDAS / readSceneSkip / loop: RDAS only starts the countdown; the commands up to the frame's first wait (FADS or a wait) run and everything after it waits for the countdown (the frame of state 1, then 4 or 20 frames). beginInstant then stops what played (N2-74).
- Compared: Native run with the reference save, sound output recorded (NX_AUDIO_DUMP): with Read scenes auto skip on, a one-shot placed before the first wait sounds, everything stops about 100 ms after RDAS, the one-shot and voice after the first wait never sound. The port's calls in an isolated browser: the one-shot, stopPlaying 93 ms later, the run's restore.

### N2-131: Engine notices drawn over the mode panel and the menus (low, confirmed)

Functions: `0x47bf0`.
- Native: 0x3b4b0 (popup_ja at (0, 32) of 640 x 448, 77-133 px) runs in task 0xe, prio 82, before the menu background (83), the system menu (84) and the mode panel (85, 96 px tall at rest, window art alpha about 70-130 in the rows 77-95).
- Port: style.css:224 #popup z-index 30 on #stage, above .modepanel (z-index 5) and everything in #ui.
- Effect: A notice raised with the panel down has its top 19 px over the panel's window where the game draws the window over it; a notice still up when a menu opens stays on top of the menu instead of under it.
- Reached: Panel buttons Auto and Quick Save (0x4e170 with the panel still down); ATSV's Auto Save if a menu is opened within the notice's life.
- Second reading: confirmed.
- Fix (2026-11-08): index.html #popup before #ui (no z-index): under the system menu and mode panel (z-index 5), over the covers (#skip-black and #story-black now go before it).
- Compared: Native run t11: the Quick Save popup under the mode panel's window; the port's popup in the same place under the panel's bottom line (screenshot compared). Also: opening the system menu while the popup is up puts the menu over it.

### N2-132: Pause menu bands fade with the menu's opacity (low, confirmed)

Functions: `0x4b880`.
- Native: 0x4b880 draws each band at (2t - t^2) x its own alpha, not multiplied by the level 0xb34b70. t (0xb34b78) rises 1/60 a frame on opening and falls at the close rate -1/30 (0x49630), the bands keeping their places while it falls.
- Port: ui.js:988 system() sets bg.style.opacity = alpha (1/18 up, 1/30 down) on the whole element, bands included; ui.js:953 leaves MenuBgFade's t rising at 1/60 during the close.
- Effect: Opening: for the first 18 frames the bands show at n/18 of the game's alpha. Closing: 15 frames in, a band that had reached t = 1 is at 0.5 of its alpha in the port and 0.75 in the game. Seen each time the pause menu opens or closes.
- Reached: Every pause menu open and close; the gallery and title paths pass a MenuBgFade and are not affected.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js system: the pause menu runs on one MenuBgFade for the session (this.menuBg, shared by Save, Load, Config and the flowchart), its level and sparkles at 1/18 up and 1/30 down, the bands at (2t - t^2) of their own alpha on their own timer, held in place while lowering; the foreground has its own level (--lv, each piece taking it, so the additive cursor keeps adding to what is under the menu).
- Compared: Native frames (opening and closing) against the port stepped by hand, matched frame by frame: the same picture at each step of the close; the opening within a frame of the native run.

### N2-133: Cursor animation not restarted when the menu opens (low, confirmed)

Functions: `0x4cba0`.
- Native: When the menu opens from level 0 (0xb359f4 == 0), 0x4cba0 sets the line stretch 0xb35a04 = 0 and the line's alpha 0xb35a08 = 0 (one 8-byte store at 0x4cbd0), the light 0xb35a0c = 0 and its rate 0x5912f0 = 1/60. A row change in 0x4cea0 does the same except for the line's alpha, which it leaves.
- Port: ui.js:841 keeps one MenuCursor for the session (this.menuCursor ||= new MenuCursor()); only a row change calls cur.moved() (ui.js:884), and system() resets nothing.
- Effect: From the second opening on, the cursor line is already at full alpha and full width and the light carries on from its last level, where the game fades the line in and stretches it out over 10 frames and raises the light from nothing over 60.
- Reached: Every pause menu opening after the first in a session.
- Second reading: The reset is real (0x4cbd0-0x4cbe4, level 0 only) and the port never resets its MenuCursor (only ui.js:841 and cur.moved at :884 touch it), but stur xzr, [x21, #0xc] at 0x4cbd0 writes 8 bytes and so also zeroes the line's own alpha 0xb35a08 (xref.py misses the wide store). A row change in 0x4cea0 sets only 0xb35a04, 0xb35a0c and 0x5912f0, so calling MenuCursor.moved() on opening would not reproduce it (moved() leaves cur.line).
- Fix (2026-11-09): uifx.js MenuCursor.opened(), called by ui.js system on a fresh opening (the 8-byte store at 0x4cbd0 over the stretch and the line's alpha, then the light and its rate). The returns from a screen and from the flowchart leave it alone.
- Compared: Native frames of a second opening in one run: the line stretches out from nothing and the light rises from nothing, as on the first.

### N2-134: Load with an empty list lights the column's Save (low, confirmed)

Functions: `0x4d2d0`.
- Native: 0x4d2dc-0x4d2e0: 0xae0e0(-1) takes the cursor off the buttons whatever the list holds; row 0xb359f0 is untouched, and 0x50fc0 state 2 with no rows leaves it so (the column gets the cursor only by Left or by pointing at it).
- Port: ui.js:1222 this.select(slots.length ? columnItems : 0): with no rows item 0, the column's Save, is selected: lit, caption shown, menuRow set to 0 by its setSelected, and MenuCursor no longer hidden.
- Effect: Opening Load from the system menu with no manual saves: the game shows no row lit and the cursor line fading out; the port lights Save with its caption and moves the line and light there, and Back returns to Save instead of Load.
- Reached: Any in-game Load while slots 0-99 are empty (automatic saves are not listed, 0x50790).
- Second reading: confirmed.

### N2-135: Menu accepts input during its opening and closing fades (low, confirmed)

Functions: `0x4d8c0`.
- Native: Only state 3 runs the input function 0x4cea0; states 0-2 (18 frames opening), 4 (30 frames closing), 0xe and 0x10 read no menu input.
- Port: ui.js add and key keep every column item live from the first frame of system(); backFn only guards a second Back (ui.js:996-1000), so keys and clicks act during both fades.
- Effect: A key or click within the fades moves the cursor or opens a screen, where the game ignores it until the menu is fully up, or at all once it is closing.
- Reached: Any press in the 0.3 s of opening or 0.5 s of closing.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js: ui.menuBusy and the page's pointer events gate keys, presses and Back during the opening, the close and the 12-frame fades (ui.key, ui.back); the screen beside the column gates its own fades the same way.
- Compared: A native run with Down pressed during the opening and during the close: the cursor stayed on Save. The port with real keys in the fades: the same.

### N2-136: Save rows answer to the pointer over the whole row (low, confirmed)

Functions: `0x4efe0`.
- Native: 0x4f170-0x4f224 passes rect 0x592468 = (10, 9)-(310, 97) units to 0xadca0, the same (x0, y0, x1, y1) form as the column's (0, 0)-(74, 29); on screen x 431-1331, y 110.7-322.8 for row 0, with a gap of about 14 px between rows.
- Port: style.css:101 .slot is 960 x 226 at (401, 89 + 226 i), the whole element clickable, ui.js:376 mouseenter on it.
- Effect: Pointing at the outer 30 px of a row, its top 22 px or the gap selects a row in the port and nothing in the game.
- Reached: Every save and load list row, pointer input only.
- Second reading: confirmed.

### N2-137: Handing the cursor between the column and the save list (low, confirmed)

Functions: `0x50ed0`.
- Native: 0x50efc-0x50f70: Right on the column or the column's own button returns to the list keeping its row (0xf1f450 is written only for a pointed row) and calls 0x4a790(1); the list gives the column the cursor with Left in the story (0x52508-0x52548, not SELA) or by pointing at it, calling 0x4a790(0), so the Back button slides out while the column has the cursor.
- Port: ui.js:1219 screenFocus selects the first row (columnItems), not the kept one; ui.js:440-441 Left and Right do nothing on the list and column; the Back button stays on (ui.js:338, no setBack on the focus change).
- Effect: With keys or a pad, Left does not move to the column and Right does not return to the list; the column's own button puts the cursor on the first row instead of the row last used; the Back button stays up while the column has the cursor.
- Reached: Every in-game Save or Load screen.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js savesScreen: Left on a row gives the column the cursor on its own row (with sound 0, in the story's Save and Load, not SELA's or the title's); the list keeps its row, lit (0xf1f450, drawn by 0x4f240 whatever has the cursor), and the Back button slides out. Right, a press on a row or the column's own button gives the list the cursor back on that row, with the row's flash, sound 0 and the Back button. Up and Down now stay on their own side, wrapping only on a fresh press. On the column Left goes to the first row and Right to the last, on a fresh press (0x4cea0).
- Compared: Native frames (Save: Left, Right, and Left, Down, A to Load) against the port's states and pictures: the row kept lit, the caption and cursor on the column, the flash on return.

### N2-138: The 180-frame cooldown also starts after a manual save (low, confirmed)

Functions: `0x52860`.
- Native: 0x40e70(0xb4) is called by quick save (0x529fc, 0x4e95c), automatic saves (0x52b88 and callers 0x4cd3c, 0x4ce00, 0x4d280) and boot (0x47d28); the manual save in 0x50fc0 never calls it. Its only use there is the test at 0x52230, which ignores A on a save row during the cooldown.
- Port: ui.js:1194 calls env.savedNow() after every manual save (main.js:505, 3000 ms); the list has no cooldown test.
- Effect: A quick save within 3 s of a manual save is refused with sound 2 in the port and taken in the game; A on a save row within 3 s of a quick save is ignored in the game and taken in the port.
- Reached: Any manual save followed by a quick save within 3 s, or a quick save followed by a save or load press within 3 s.
- Second reading: confirmed.

### N2-139: An automatic save during the cooldown is not persisted (low, confirmed)

Functions: `0x52aa0`.
- Native: 0x52b6c-0x52b80: 0x4ec60(2) and 0xb6520(-1) run only when 0x40e90 says the 180-frame cooldown is over; otherwise the record exists in memory only and system data +0x161e is not recomputed.
- Port: main.js:522-523 always writes the list to localStorage, and ui.js:703 newestRecord always sees it.
- Effect: After Return to Title within 3 s of a quick save, the game's Continue keeps the slot number recorded before (a manual save stays the target) and the automatic save is lost on exit; the port keeps it and continues from it.
- Reached: Any Return to Title within 180 frames of a quick save or earlier automatic save.
- Second reading: confirmed.

### N2-140: Saved pictures ignore the parent's size class (low, confirmed)

Functions: `0x89190`, `0x89220`, `0x892b0`, `0x89420`.
- Native: 0x891cc-0x891d4 passes the parent's layer number to 0x2dfd0, which indexes the image table: records 0-39 have +0x46 = 0 (main.bin 0x46f830), so no L / M / S factor applies. The live helpers 0x38a70 / 0x38730 use the parent's picture (record +0x14).
- Port: The port's save picture is a capture of the live layers, where transform.js:92-98 applies sizeClass(p.image).
- Effect: A child of a layer showing an L or M picture is placed and scaled differently in the game's save picture than on its own screen; the port's picture shows it as on screen.
- Reached: 53 of 943 SBAS calls have a parent with an L or M picture (48 L, 5 M) by a linear survey of the scripts.
- Second reading: confirmed.

### N2-141: Save thumbnails from the system menu capture the menu's blur (low, confirmed)

Functions: `0x89ad0`.
- Native: 0x89ad0 redraws the saved layers directly; no blur pass is involved.
- Port: main.js:484-490 calls gfx.present and copies the canvas while the save screen is open with blur on (ui.js:1089, makeSave at ui.js:1186); renderer.js:1023-1037 composites the frozen Gaussian copy over the scene at k, which is 1 from frame 12 (renderer.js:31-33).
- Effect: Every manual save made from the story's system menu stores a softened picture (a Gaussian of about 4 pixels at 1080p, about 0.6 pixel at thumbnail size); the game's thumbnails are sharp.
- Reached: Every manual save from the system menu; a quick save has no menu open.
- Second reading: confirmed.

### N2-142: Returning from the title's Load or Config restarts the particles and the glow (low, confirmed)

Functions: `0x8d2f0`.
- Native: The pools (0xae0b40, 0xae0b48) and the glow 0x1536168 are reset only in 0x8d2f0. States 0x20 and 0x21 return to state 0xf without running it. Meanwhile 0x8d5d0 steps them only while the logo level is above 0: Load (0x50e00, 0x50ebc) and Config (0x2b734) raise the menu background at 0.024 a frame, so the logo falls 1/60 a frame (0x8d830) to 0 within 60 frames, the block 0x8d86c-0x8daf8 is skipped and particles and glow freeze as they are. After the screen closes and the background is down the logo rises 1/120 a frame again and they resume.
- Port: ui.js:1216 and ui.js:1796 call titleMenu() on the way back, which makes new LogoDust and LogoShards (ui.js:645) and sets the glow to 0 (ui.js:641).
- Effect: After closing Load or Config the port's dust and shards start again from none, taking a few seconds to build up (shards live 120-270 frames), and the light's pulse restarts from 0. In the game nothing is reset: they froze about a second after the screen opened and resume from that state as the logo fades back in over 2 s.
- Reached: Every return from the title's Load or Config.
- Second reading: True that 0x8d2f0 (one caller, 0x48bbc via 0x8d2e0) is the only reset and that the port rebuilds both, but 'keeps drawing and stepping them meanwhile' is wrong: Load (0x50e00, tail call at 0x50ebc) and Config (0x2b734) raise the menu background, so the logo falls 1/60 a frame (0x8d830) and at level 0 the block 0x8d86c-0x8daf8 is skipped; existing native dumps show it (scratchpad f59b763f nat/png 01379-01469 for Config, png3 01327-01357 for Load: logo gone, sky dimmed alike). Related and not reported: on return the game's logo and rows re-rise from 0 over 120 frames where ui.js:641 starts at level 1 and menu 1, and ui.js:1091 / FIX-CHECKLIST M18 'the title's Load raises nothing' is wrong (0x50ebc).
- Fix (2026-11-09): with the title kept alive (N2-29) the dust, shards and light are the same objects, stepped only while the logo's level is above 0.
- Compared: With N2-29, on the same native and port runs.

### N2-143: Copyright placed 4 pixels left and 8 pixels high (low, confirmed)

Functions: `0x8d5d0`.
- Native: 0x8e01c-0x8e03c: slot 0x13c (titlemenu__c_type-moon, 184 x 64), flags 0x10 (top left), scale (0.5, 0.5037) at (436, 507.733) of 960 x 544: top left (872, 1008).
- Port: ui.js:506 and ui.js:576: (868, 1000).
- Effect: The copyright line sits 4 pixels left of and 8 pixels above its place on every title screen.
- Reached: Every title screen.
- Second reading: confirmed.

### N2-144: Glow and particles run while the logo is at zero (low, confirmed)

Functions: `0x8d5d0`.
- Native: The glow step (0x8da80-0x8dab0) and the dust and shard calls (0x8d8a0-0x8d8a4) sit inside the block gated on logo level > 0 (0x8d864-0x8d878), so nothing advances until the logo starts, about frame 42 of the fade.
- Port: ui.js:652-653 steps the glow every frame; ui.js:666 steps the particles whenever the movie is visible, at any logo level.
- Effect: The light's pulse runs about 42 frames ahead of the game's, and up to about 40 frames' worth of extra shards are in flight as the logo first appears.
- Reached: Every title entry with the fade in.
- Second reading: confirmed.

### N2-145: A direction or confirm press does not complete the logo (low, confirmed)

Functions: `0x8d5d0`.
- Native: 0x8e200 state 0x11 writes 0x1536194 = 1.0 on a handled direction (0x900f4) and on a choice (0x8ef34, 0x8f324), so the logo, and through 0x1536198 the rows, jump to full.
- Port: ui.js:650 only ever moves the level by titleLogo; no input touches it.
- Effect: Pressing a key while the logo is still fading in snaps logo and rows to full in the game; in the port the fade continues.
- Reached: Any direction or confirm press between about frame 90 and frame 162 of a title entry.
- Second reading: confirmed.
- Fix (2026-11-09): ui.js titleMenu: a direction or a choice snaps the logo to 1 (and so the rows); keys are read only once the black has gone (state 2 reads none). Left and Right go to the first and the last row, as 0x8e200 state 0x11 does.
- Compared: Read from the listing; the port hand-stepped with the key at frame 100.

### N2-146: Dust is spawned per browser frame, not per 1/60 s (low, confirmed)

Functions: `0x90d00`.
- Native: 0x90e80 -> 0x90d00 runs once per 60 Hz draw and makes up to four motes with no frame count (only the ages use 0xb0190), about 158 of 200 slots alive.
- Port: uifx.js:93 LogoDust.frame calls spawn() once per requestAnimationFrame with no dt (ui.js titleMenu's frameLoop); Sparkles and LogoShards are paced by dt (FIX-CHECKLIST G20 did this for the sparkles).
- Effect: On a 120 Hz display 8 motes per 1/60 s, the pool saturates at 200 (about 27% more dust); at 30 frames a second half as many.
- Reached: Every title screen in a browser not drawing at 60 Hz (120 Hz displays, Chrome's 30 fps energy saver).
- Second reading: confirmed.

### already the map's notes: Save pictures are captured from the screen, not built from the checkpoint's layers (low, confirmed)

Functions: `0x884f0`.
- Native: 0x884f0 (callers 0x506e0, 0x50fc0, 0x89590) rebuilds each picture from the record's state: tween targets, the checkpoint's layers, film-grain layers left out (state +0x13b4 must be 0, test in the list loop).
- Port: main.js:484 thumbnail() draws the live GL canvas at the moment of saving into a 288 x 162 JPEG; ui.js:1139 shows it.
- Effect: A save's picture shows the screen when the save was made rather than the point it resumes at, with tweens at their current values and any film grain on it.
- Reached: Every save whose screen has moved on since its checkpoint (a page's first line or an ATSV); 196 STNS calls for the grain.
- Second reading: confirmed.
