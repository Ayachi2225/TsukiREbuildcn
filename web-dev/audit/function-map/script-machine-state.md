# E2_vm_state — script machine and game state

Evidence comes from the instruction listing. The helper scripts `dis.py` and `hand.py` (in SCRATCH/agents/E2_vm_state) resolve the relocated global slots, for example 0xae0900->0x146e638, 0xae0568->0xf1f740, 0xae0660->0x1916dec and 0xae0670->0x1916dee. Inside 0x77790, x28 is &F0, so `[x28,#2n]` is Fn.

## Summary

| Status | Count |
|---|---:|
| explicit | 22 |
| covered | 27 |
| divergent | 4 |
| missing | 2 |
| unused | 5 |
| platform | 20 |
| helper | 72 |

Some divergences sit inside functions marked explicit (0x77790, 0x802c0, 0x81b30), because those functions are implemented overall.

## Divergences / missing behaviour

### 1. JUMP 2000–2007 are swapped (confirmed in listing)

**Native:** JUMP is handled by case 'J' at 0x77c7c; the rest of the name is not checked. It searches the 552-entry table at 0x350d58 (loop 0x77c9c–0x77cd8), and the index found is the script index. Entries 520–527 hold 2000–2007: 2000 -> `12_01_CIEL12_3C_FLAG0`, which sets F069=1; 2001 -> `_FLAG1`, which sets F069=0; the same pattern holds for 2002–2007. All other entries match the web. The web lacks 110, 3000, 4000 and 8000, which no script JUMPs to.

**Web:** the "2000-2007" block in `build_core.py` assigns `jump[base]=FLAG1` and `jump[base+1]=FLAG0`. So `index.json` maps 2000->521 and 2001->520.

**Impact:** five scene ends written as `IF__ F069 eq 0 L; JUMP 2001; L: JUMP 2000` (`12_01_CIEL12_3B` op 2163, `12_01_CIEL12_5` op 3028, `13_01_01_CIEL13_1` op 3062, `13_01_01_CIEL13_1_1` op 1036, `13_01_01_CIEL13_1_2` op 620). Natively these keep F069; in the web each one inverts it. About 50 F069 tests then pick the other text variant, and the flowchart marks the wrong node. Flowchart replays of nodes 270/483, 275/276, 446/447 and 279/280 start the opposite FLAG script.

**Fix:** export the table at 0x350d58 directly, or swap the two assignments and rebuild `index.json` and `flowchart.json`.

### 2. CLO2–CLO5 end the frame, which commits waiting layer changes (confirmed)

**Native:** all four CLO handlers always return from the interpreter (CLO2 0x7f3dc->0x7f890->0x7fef0; CLO3 0x7f86c; CLO4 0x7f898; CLO5 0x7f918). After every return, 0x802c0 runs `if (+0x7ca == 1) 0x5d3a0(0,0)`, which applies any waiting STCH/SCH2/STCC/STNS change at once, with no transition. The FADS on the next frame then finds nothing waiting (0x7ff44) and fades between identical frames.

**Web:** commits only at the WAITS commands and at FADS.

**Impact:** 28 places stage a change, then CLO3/CLO4, then FADS. Examples: `04_01_CIEL04_1` 1126–1131 (layer 34 disappears natively but fades out over 800 ms in the web); `05_00_ARC05_3_2B` 2524–2533 (layers 11–18); `05_00_ARC05_4` 934–943.

**Fix:** add CLO2–CLO5 to `WAITS`. Other native frame ends were also scanned (JUMP, TOMP when it starts a movie, VCWT while a voice plays). No other case matters, and the 1000-command limit never triggers (the longest run without a frame end is 144 commands).

### 3. SELR's third argument (option shown but not selectable) is ignored (confirmed; disabled look not traced)

**Native:** SELR (0x78a50) stores `arg2==1` in 0x1471544[n]. The selector 0x83e50 skips flagged rows when moving the cursor (0x843cc, 0x8458c and nearby loops) and ignores touches on them. SELR also prefixes each option with system message 0x599+(n+1)%10, the engine's numbering.

**Web:** `op_SELR` drops the argument; every row is clickable.

**Impact:** 6 options can be chosen before their G003/G004/F057/F069/F081 conditions are met: `03_00_ARC03_5B` ops 3796 and 3799, `07_00_ARC07_3_1` op 589, `13_01_01_CIEL13_4` op 2435, `14_01_CIEL14_1C` ops 5246 and 5249.

**Fix:** keep the flag and disable the row.

### 4. RDED ends gallery replays (confirmed)

**Native:** RDED (0x79bdc) calls 0x92440(n). That returns 0 when the scene was started in this play (F110==n and its F201+ bit set), after recording G[300+n/16]. Then, if F024 is set, RDED takes the RTM_ path (0x7f9e8: 0x5f200, 0x146e674=2) and the replay returns to the gallery. F024 is set only by ARCHIVE ops 37–39, during gallery playback.

**Web:** gallery replays start the scene script directly, never set F024, and `op_RDED` only updates the flowchart. So play continues into the following scenes.

**Fix:** when `vm.replay` is set, end at the scene's RDED and return to the gallery.

### 5. Read-scene skip is an instant run (likely)

**Native:** RDAS->0x92580->0x424b0(1). In 0x40ed0, state 1 shows dialog 10 only when config +0x60 is set; otherwise it sets 0xaffcb8 (via 0xae06b8)=4, or 20 after a Yes. State 3 counts that down one per frame, with 0x3f110((v−1)/−30+1.5) and popup 4. Then 0x53950(1) sets 0x146e664=1. 0x802c0 then sets 0xae0568=1 and calls the interpreter in a loop within one frame: every wait flag is cleared on each pass, and FADS is skipped while the flag is set (0x77a40). The run stops when any of these clears 0xae0568: the next ATSV; SELD; RTM_, END_ or an ending RDED; XSTP; case Z, at the first unread message when config +0x1e ("Read") is set, or when F998 is non-zero. So "0xae06b8 = 4" is the countdown, not the end condition.

**Web:** a forced skip that advances one message per frame and ends at the next JUMP; it passes unread lines.

**Impact:** 530 RDAS calls; a 300-message scene takes about 5 s instead of one frame.

### 6. Mode panel buttons (likely)

**Native:** 0x4e170 maps the panel cursor positions to results, and 0x40ed0 dispatches them:

| Cursor | Result | Action |
|---|---|---|
| 0 | 3 | dialog 11 "Return to Previous Scene?" (SYSMES 233), then 0x85510 + 0x53950(−1); 0x81a50 restores the previous ATSV checkpoint (ring 0xae04a0) |
| 1 | 4 | rewind step (0x814c0) |
| 2 | 5 | auto |
| 3 | 6 | fast forward |
| 4 | 7 | dialog 10 "Jump to Next Scene?", then the instant run from finding 5 |
| 5 | 9 | quick save |
| 6 | dialog 9 | quick load |
| 7 | 10 | voice replay |

The button art (|<<, <<, >, >>, >>|, Q.SAVE, Q.LOAD, voice) matches this.

**Web:** buttons 0 and 4 are "Previous choice" and "Skip to next choice". SYSMES 233 is exported but unused.

### 7. Skip toggle semantics (likely)

**Native:** the toggle is bit 1 of 0xae0660; the per-frame flag 0xae0670 is derived from it (0x418b0). With "Read" (+0x1e, the default), an unread message clears only the per-frame flag (0x41920–0x41950, 0x420c8–0x420ec): the toggle stays on and skipping resumes at read text. With "Full", nothing stops it. At choices it is cleared only if config +0x2c is set (0x84244), and the default is 0. B clears it (0x41e9c). The read mark (0x53a60) is a per-block high-water mark of message indices (case Z, 0x78070). It lags one message.

**Web:** at any unread line, skip stops whatever the setting; `onChoice` and `onConfirm` also switch skip off.

### 8. VCWT is click-interruptible (confirmed)

**Native:** VCWT (0x77f9c) sets wait bit 2 only while a voice plays. 0x802c0 clears that bit when the voice ends, or on a click or skip. It stops the voice when "Voices stop on input" is on and F1123==0.

**Web:** `op_VCWT` waits for `voiceDone()` and a click does nothing.

**Impact:** 75 calls in 38 scripts.

### 9. XRSM restores skip/auto (confirmed, 2 places)

**Native:** 0x40b70 saves 0xae0660/0xae0650 and clears them; 0x40c60 restores them.

**Web:** `lockControls(false)` restores nothing.

### 10. Checkpoint granularity (confirmed, low impact)

**Native:** the 0x527f0 checkpoint is written by ATSV; SELD; MSG/MSAD, only on the first line of a page (F823<2; 0x6e0d0 lines 297–309). ATSV is suppressed only during the silent load run (0x146e638), not while skipping.

**Web:** `savePoint` moves at every wait, and `op_ATSV` returns while skipping because it misread that flag.

## Checked and matching

- **IF__:** F, G and _D600–700 resolve to G; other _D to F; anything else is a literal. eq/ne compare unsigned 16-bit, gt/ge/lt/le compare signed 16-bit. The label is taken when the comparison is false, as in the web.
- **WKST/WKAD/WKOR:** C->F(F823+n), F, G and _D; values are 16-bit; no variable is spelled two ways in the scripts. The web's separate C847 key is equivalent for the uses present.
- **GOTS:** needs a `_` variable and uses label index = value (0-based).
- **WTTM:** whole frames (ms·3/50, at least 1); a non-zero second argument makes it unclickable.
- **Smaller handlers:** PGST stores F1122; WNTY passes arg!=0; labels come from sorted per-script tables with no duplicates.
- **Load:** native load re-runs the script silently to the saved page (0x826f0->0x82c60). The web restores a snapshot; the mechanism differs, the intended state is the same.

## Unused native code

- Unused commands: block-IF commands IFF_/ELS_/EIF_ with their evaluator 0x59c60, IFJP, IFLA, WKBO, WKOF, WTVT, WT__, VCLR, CHJC, SEP3, SEPN, SEFI, SEAC, SHAK, SHAS, SNOW, STRC, MSTP, and the FL* commands.
- Task type 2 handlers 0x3f480/0x3f490/0x3f5e0/0x3f5f0: 0x3f600 rejects types >=2, so they cannot run.
- The silent-run branches in ATSV, JUMP, GOTS, TOMP, TOMW, END_ and CLO4/CLO5 only run during loads.

## Limits

- There was no runtime capture; the visual effects in findings 2, 3, 5 and 6 are inferred from control flow.
- The mode panel captions and the SYSMES choice numbering could not be read: `romio` needs pycryptodome, which is not available under `python3 -I` (B1 read them: "1.", "2."...).
- The SPFC/SPRD processed-picture cache was left to the render reviewer.
- Whether config +0x2c is exposed as a setting was not confirmed.

## Re-check of the handled functions (2026-11-08)

7 functions of this part compared with the port: 1 the same, 6 different, 0 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-1: ATSV moves the checkpoint only on a page's first line, and SELD never does (medium, confirmed)

Functions: `0x77790`.
- Native: The checkpoint 0x527f0 runs only when record +0x35c0 is 0, the record type is not 0xb / 0xc and F823 <= 1 (listing 0x79030-0x79044, 0x7c02c-0x7c040: sub w8,w8,#0xb; cmp w8,#2; ccmp w9,#1,#0,hs; b.gt skip). ATSV therefore records only at F823 <= 1, and SELD's row records are type 0xc (0x7f788) so its call at 0x7f850 is never reached. Saves copy that checkpoint (0xf17ff0: 0x50fc0, 0x52860, 0x52aa0) and a load runs on to the saved page's PGST (0x82c60).
- Port: vm.js:753 op_ATSV calls checkpoint() whatever F823 is; vm.js:880 op_SELD calls checkpoint() at every choice (FIX-CHECKLIST S20 records this as native).
- Effect: A save made at a choice on a page with two or more lines natively resumes on that page's first line, and the player clicks through it again; the port resumes on the choice itself. Saves made after such an ATSV likewise resume later than native.
- Reached: 83 story choices have ATSV(1) just before; 74 of those have F823 >= 2 in a linear scan of the scripts.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_ATSV moves the checkpoint (savePoint) only when F823 is at most 1 and no XSTP task holds records back (record +0x35c0: listing 0x79030-0x79044, 0x7a900-0x7a914, 0x7c02c-0x7c040), while its Return to Previous Scene point is made either way; op_SELD no longer touches it (its call at 0x7f850 is never reached); restore moves it only for a record on a page's first line (0x5d300-0x5d368), so a rewind or Quick Jump onto a later line leaves it where it was, and a load takes its record as before, so older saves keep loading unchanged; a message records it only outside XSTP .. XRSM.
- Compared: Compared with native frames: synthetic scenes run in the sandbox (New Game, Return to Title's automatic save, Continue): three lines + ATSV(1) + choice resumes on the first line and the player clicks on to the choice; one line + ATSV(1) + choice resumes at the choice; a choice with no ATSV resumes on the first line. The same scenes in an isolated browser resume on the same lines in the port.
### N2-2: RDAS is not ignored in a replay from the gallery's flowchart (medium, confirmed)

Functions: `0x77790`.
- Native: 0x79b78: bl 0x50f0 (*0xae0288 == 2, the gallery's flowchart section); tbnz w0,#0 goes to the next statement, so RDAS does nothing in a replay begun from the gallery's flowchart.
- Port: vm.js:656 op_RDAS has no replay test; replayFrom === "flowchart" is known to main.js.
- Effect: With Read scenes auto skip on, a replay begun from the gallery's flowchart asks Jump to Next Scene or skips the scene it was meant to show; natively the scene plays.
- Reached: RDAS heads 530 scenes; needs the setting on and the scene completed, which a replayable scene is.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_RDAS returns at once in a replay started from the gallery's flowchart (0x79b78: 0x50f0 tests *0xae0288 == 2); main.js sets vm.replaySource from replayFrom when a replay starts, so the Ending List's replays and normal play still ask (0x50f0 is false for them).
- Compared: Compared with native frames (reference save with Read scenes auto skip and Display confirmation on): Gallery > Flowchart > a scene plays with no question; Gallery > Ending List > an episode asks Jump to Next Scene?, and New Game asks it at the first RDAS.
### N2-3: A rewind goes back a page, not a line (medium, confirmed)

Functions: `0x814c0`.
- Native: A record is a target only when its type (+0x20) is 0, +0x35c0 is 0 and its saved F823 (+0x34a8, table 0x351214 entry 31 = 823) is below 2 (0x816e0-0x8173c, wrapped ring 0x81808-0x81838, 0x817cc-0x817d8): the first line of a page. Each step therefore lands on the current page's first line, then the previous page's. Later lines of a page are never a target.
- Port: vm.js:1714 rewindTarget takes the previous trail point, one per wait for the player; ui.js:2265 labels it Previous message.
- Effect: One rewind in the port goes back one line; in the game it goes to the start of the page, so a page cannot be stepped through line by line.
- Reached: Every rewind on a page of more than one line (43,790 lines; every page starts F823 at 1, 17,207 PGST).
- Second reading: confirmed.
- Fix (2026-11-08): vm.js rewindTarget: a rewind goes to the last message record that is a page's first line (saved F823 below 2).
- Compared: Compared with native frames (ZL taps: each tap goes to the previous page's first line).
### N2-4: A rewind does not stop at a choice (medium, confirmed)

Functions: `0x814c0`.
- Native: Choice records (types 0xc and 0xd) are skipped as targets and are not restored as the current record (mask 0x3001, 0x81660-0x8167c), so a rewind passes a choice and lands on the first line of a page before it. The choice is asked again only when the script reaches SELD again.
- Port: vm.js:1716 rewindTarget(false) returns choice points too (remember(true), vm.js:879, 865); restoring one runs its op, so the choice is asked at once.
- Effect: Rewinding across a choice brings the choice back immediately in the port; in the game the screen goes to earlier text.
- Reached: 170 SELD and 1 SELS (SELA is never on the port's trail); any rewind that reaches one.
- Second reading: Native read as claimed (type must be 0 at 0x816f0; mask 0x3001 at 0x81674-0x8167c). Port: remember(true) exists only in op_SELD (vm.js:879) and op_SELS (vm.js:865); op_SELA (vm.js:844) has none, so the 26 SELA are not on the trail, and there is 1 SELS.
- Fix (2026-11-08): vm.js rewindTarget: choice points are never rewind targets.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run: from two pages after a choice, a rewind goes to the page of the question: the line is shown whole at once (the ATSV(1) record) with its wait mark and no rows; the rows come back at the next press. The port does the same.
### N2-75: History holds 800 records of every type, not 800 waits (low, confirmed)

Functions: `0x5a910`.
- Native: The ring has 800 slots (0x5a910 wraps at 799). One record per MSG (type 0), per FADS (type 1), per sound command (2 / 3), per ATSV (6 / 7), per SELR / SELD row (0xd / 0xc); layer commands take one (type 1) only for the first change after F991 (+0x7be) was cleared, and WTTM / VPLY / MSAD take one (type 9) only when F991 is set. Rewinding stops at the first invalid record.
- Port: vm.js:30 TRAIL = 800 and vm.js:1677 count only waits for the player and choices.
- Effect: The port can rewind and Quick Jump several times further back than the game's history reaches.
- Reached: A long rewind or Quick Jump: a linear count of the scripts gives about 138,000 records for 43,919 messages, about 3.1 per message, so the ring reaches about 255 lines back against the port's 800.
- Second reading: The ring is real: 800 slots, wrap at 799, no de-duplication (end of 0x5a910), and vm.js:30 counts only waits and choices. 'Every recorded command takes one' and 'each WTTM' are wrong: layer commands record only the first change since F991 (+0x7be) was cleared, and WTTM (0x7f4bc-0x7f4f0), VPLY (0x78140) and MSAD record type 9 only when F991 is set. FADS (0x607d8) and sound commands always record. A linear count of the scripts gives about 3.1 records per message, so 800 records hold about 255 lines.
- Fix (2026-11-08): vm.js counts the records the native ring would make (ringAdd / ringLayer / ringClose, as 0x5a910 and its callers) and the trail drops points older than 800 records.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run of 380 pages, each a picture move, a FADS and a line, skipped to the first unread line and then rewound with ZL held: the game stops 199 pages back (four records a page). The port went back all 361. Corrected: the count had missed the record a message's Z command makes when layers changed since the last such point (0x77790 case Z, listing 0x78efc-0x78f48; the labels' Z commands too); vm.js message and the label step close the layer changes first. The port now stops 199 pages back.
### N2-76: Rewinding past an ATSV does not drop its Return to Previous Scene point (low, confirmed)

Functions: `0x5baf0`.
- Native: Record types 6 and 7 (ATSV) restored with the top of the ring 0xae04a0 naming them pop it and clear 0x146e66c (0x5cdf0-0x5ce80). 0x814c0 restores every record between the current one and the target, so a rewind past an ATSV removes that point. 0x28d50 pops the same way for Quick Jump.
- Port: vm.js:restore with rewind: true leaves scenePoints and nearScene alone (vm.js:1739 only resets them for a load).
- Effect: After rewinding out of a scene, Return to Previous Scene can go forward to the scene the player rewound out of, and the two-line window counts from the old point.
- Reached: 398 ATSV calls; needs a rewind or Quick Jump across one, then Return to Previous Scene.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js restore: a rewind or Quick Jump drops the Return to Previous Scene points made after the point restored, and clears the two-line window.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native runs of two scenes, each opened by an ATSV: four lines into the second, Return to Previous Scene is lit and goes to that scene's start; after a rewind out of it into the first scene the button is unlit and does nothing: the point is dropped. Found with it and corrected: the first ATSV since the story was started or loaded is never a point to return to (the game's count starts at -1: 0x5a904, 0x82400, 0x8280c; ATSV stores at count + 1; 0x81a50 wants a count of 1, or 2 near a checkpoint), so the button is unlit seven lines into the first scene, where the port lit it. vm.js previousScene now wants two points, or three.
### N2-77: Quick Jump types the line again (low, confirmed)

Functions: `0x5baf0`.
- Native: With param 2 = 0 case 0 breaks early and the script position is record +8, the message's own command, so MSG runs again: typing front 0 at the read speed, page rebuilt by 0x5b760.
- Port: vm.js:jumpTo -> restore writes the saved HTML with the line complete (vm.js:1770) and waits for the player.
- Effect: After a Quick Jump the game types the chosen line out again; the port shows it whole at once.
- Reached: Every Quick Jump to a line.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js jumpTo: the line is typed again (restore retype, read state from its block) and its voice plays.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run: X, Up twice, A, Yes: the line jumped to is typed again, at 250 ms a letter (the read speed: it is read by then, where it had first typed at 100 ms). The port's frames: 15 frames a letter.
### N2-78: SELR's blank row before the next line (low, confirmed)

Functions: `0x77790`.
- Native: 0x78a80-0x78a98: at a choice's first row, when F823 >= 1, F(847 + F823) += 1, the blank rows before the next line that 0x391a0 reads.
- Port: vm.js:832 op_SELR changes no blank-row state; addBreak comes only from WKAD C847 (vm.js:597).
- Effect: The first line after a choice that continues the same page has one blank row above it natively and none in the port.
- Reached: One story choice: 07_00_ARC07_3G SELD 37, second branch into 07_00_ARC07_3_2 (every other story branch resets F823 first; the debug jump menus aside).
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_SELR: the first row of a choice on a page with text leaves one blank row before the next line (F847 + F823 + 1).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames: under a one-row question the choice's two rows are on rows 2 and 3 of the window, and the line that follows the choice on the same page types on row 2, one blank row under the question. The port puts it on the same row (155 px under the question's).
### N2-79: Replay Voice target ignores VPL2 and clicks (low, confirmed)

Functions: `0x77790`.
- Native: VPLY and VPL2 both write *0xae0790 (the mode panel's Replay Voice, 0x4e170 case 7) and *0xae08b0 (the next MSG's record voice, cleared by FADS or that MSG); only resets and restores write *0xae0790 otherwise, so it survives clicks.
- Port: vm.js:1602 op_VPL2 sets no voice; lastVoice comes from VPLY only and vm.js:1025 clears it at each click (ui.js:2271 gates the button on it).
- Effect: After moving past a voiced line, or after a VPL2 line, native Replay Voice still plays the last voice; the port's button is off or plays an older one. One MSG record after VPL2 + MSAD (14_01_CIEL14_1C, $037545) loses its voice.
- Reached: Replay Voice on any line after a voiced one; 16 VPL2 calls.
- Second reading: VPLY and VPL2 share 0x7a3ec-0x7a414 (all three globals written; VPL2 then clears only *0xae04c8 at 0x7a4fc), *0xae0790 is otherwise written only by 0x57450 / 0x5baf0 and played at 0x4e790; vm.js:1010 / 1025 and op_VPL2 are as cited. The count is wrong: MSAD saves no record (no 0x5a910 in 0x6e950) and FADS clears *0xae08b0 (0x607e0), and 09_01_CIEL09_6B and QA_20 reach FADS before any MSG, so only 14_01_CIEL14_1C's next message takes the VPL2 voice.
- Fix (2026-11-08): vm.js keeps Replay Voice's target (lastVoice = 0xae0790: written by VPLY and VPL2, never cleared by clicks or later lines, restored from a record's voice) apart from the voice the next MSG's record keeps (recordVoice = 0xae08b0: cleared by that MSG, by a FADS and by a restore) and the message's own record voice (msgVoice); VPL2 clears the pending voice and closes the layer record as VPLY does (0x78130, 0x7a4fc); ATSV's and choices' records keep no voice. ui.js: the Replay voice button is never disabled (0x4e170 draws it like the others and only plays when there is a target).
- Compared: Compared with native frames (Voices stop on input off): a voiced line, then a line with no voice, then VCWT and a third line: Replay Voice pressed on the voiceless line makes the third line wait for the replayed voice (it appears at 44.5 s against 38.5 s without the press), so the target survived the click and the voiceless line; a VPL2 line's own target and the MSG record after VPL2 + MSAD ($037545) are from the listing and tests.
### N2-80: Choice rows type at the last message's speed (low, confirmed)

Functions: `0x77790`.
- Native: SELD (0x7f9.. on, 0x80050) stores slot 1's read flag = *0xae07b0[choice id] != 0 (set when the choice was answered, 0x83e50) and 0x84e50 types the labels with 0x3b2d0(1).
- Port: ui.js:2170 ChoiceFx.perFrame(this.text.speed), the speed of the last message.
- Effect: When a choice's own read state differs from the line before it, the labels type at the other speed (35 ms or 15 ms a letter by default).
- Reached: Any story choice first met after read text, or met again after unread text.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js: choice rows always type at the unread speed (config +0xe; slot 1's read flag is only ever written 0).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native runs say otherwise. With unread 100 ms and read 250 ms a letter the rows took 250 ms a letter after read lines and after unread ones; with read at 60 ms they took 60 (3.6 frames a letter): the rows type at the read speed (config +0x10) whatever the lines were. Where slot 1's flag becomes 1 was not found in the listing (0x80050 stores 0). Corrected: ui.js types the rows at vm.readSpeed. Also from those frames: the rows' front has two steps on the choice's first frame and a letter is out once the front is past it (letters 0, 2, 9 and 13 frames after the first at 60 ms), and the labels are whole from the first frame, not faded in (uifx.js ChoiceFx).
### N2-81: Holding fast forward does not stop the voice (low, confirmed)

Functions: `0x802c0`.
- Native: Each frame while the fast-forward key is held (pad held state +0x4c against mask +8), the voice is stopped when F1123 is 0 and config +0x2e is on (0x8081c-0x80848). A VCWT ended during skipping stops it regardless of those two (0x804b8 tests 0xae0670), as does a click wait ended by an actual press while 0xae0670 is set (0x80670-0x80680); a click wait passed by skipping alone stops nothing.
- Port: main.js:337 setSkip and vm.js:1009-1012 (waitAdvance while skipping) do not stop it; vm.js:1077 returns from VCWT at once while skipping and vm.js:1081 stops only on a click outside skipping.
- Effect: A line's voice goes on under ZR / Control until it ends; in the game it is cut as soon as the key is held.
- Reached: Any fast forward begun during a voiced line (16,690 VPLY, 75 VCWT).
- Second reading: 0x8081c-0x80848 does stop the voice each frame the fast-forward key is held, and the port never does (main.js:337, vm.js:1009-1012, 1077, 1081). The second sentence is too broad: 0x804b8 applies to a VCWT, but 0x80670-0x80680 sit on the press path (0x805b8-0x805d8); the wait fast forward itself ends (branch 0x80734) stops nothing.
- Fix (2026-11-08): vm.js voiceHeldCut, called from main.js's frame loop: each frame the fast-forward key is held the voice stops, under Voices stop on input and with F1123 clear (0x8081c-0x80848). op_VCWT under skip stops the voice whatever those two say (0x804b8); a line's own voice (ownVoice, 0xae04c0 flag 4) is stopped by the skip that ends its wait, a wait passed by skipping alone stops nothing (0x80734), and a press while skipping stops it (press(), 0x80670-0x80680); the click on an @e line's voice wait stops the voice under the setting. The @e voice wait now only waits for the line's own voice.
- Compared: Compared with native frames: a 25 s voice on an @n line, a fixed WTTM, then VCWT and a line: ZR held 0.1 s during the WTTM makes the next line appear at once (voice cut), with F1123 set or with no press the line appears only when the voice ends (~25 s later).
### N2-82: A held advance key repeats (low, confirmed)

Functions: `0x802c0`.
- Native: Advance tests the press edge: input +0x10 is new bits only (0xb37d0: held & ~previous), used by the typing finish in 0x81b30 and the wait clear here, so a held key acts once. 0xae0a18 also keeps the press that ended a wait from finishing the next line's typing until it is released.
- Port: main.js:726 calls vm.advance() on every keydown, including e.repeat (only Control tests repeat, main.js:729).
- Effect: Holding Space, Enter or Down finishes typing and advances at the keyboard's repeat rate; the game does nothing further until the key is pressed again.
- Reached: Any held advance key on a keyboard (Space, Enter, Down), and a held D-pad Down on a gamepad (index 13 repeats after 250 ms every 83 ms through padKey, main.js:786-787). A held A button does not repeat.
- Second reading: Native edge read in 0xb37d0 (+0x10 = held & ~previous) and used by 0x81b30 / 0x802c0; main.js:726-727 calls vm.advance() on every keydown including e.repeat. But the gamepad note is only true of the A button: PAD[13] is ArrowDown, a direction, and pollGamepads (main.js:786-787) re-sends it with repeat=true every 83 ms after 250 ms, reaching the same keydown branch.
- Fix (2026-11-08): main.js: Space, Enter and Down advance only on the press, not on key repeat.
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native run: A held for 6 s from a page's wait turns one page; the next page's line types out at its own pace (8 letters at 250 ms) and waits until A is pressed again. The port with a held Enter and its repeats: the same.
### N2-83: The instant run's end does not settle earlier lines' dimming (low, confirmed)

Functions: `0x802c0`.
- Native: After the loop 0x802c0 sets F859 + k to -1 and each earlier line's front to 100000 for k below F823 - 1 (at most 10 lines), so the page's earlier lines are at their dim level at once.
- Port: vm.js:697 endInstant restores sound and tweens only; textbox.js:758 gives new lines timer 0, so they dim over speed x 1.2 frames afterwards (textbox.js:dimLines).
- Effect: When a read-scene skip stops part way down a page, earlier lines fade down over a fraction of a second instead of being dim already.
- Reached: Read-scene skip (530 RDAS) stopping at an unread line that is not the first on its page.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js endInstant: the page's earlier lines go to their dim level at the end of an instant run (text.settleEarlier).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): Native frames, a read scene's instant run stopped at the fourth line of a page (the first not read), "Read text display" on Fade out: all three lines above it are at their dim level from the first frame the page shows. Corrected: the port dimmed the first two and left the third, the line last on screen when the run ended, to fade over 120 frames; vm.js endInstant passes F823 - 1 to settleEarlier, as 0x802c0 counts.
### N2-84: The rewound line is typed again (low, confirmed)

Functions: `0x814c0`.
- Native: 0x5baf0 case 0 with param 2 = 1 sets the typing front to 0 unless 0xae0928 is set (0x5cfbc-0x5cfe0), with the read speed (0x3b2b0(0, 1)), and 'Display whole text' from config +0x5b, so the line types out again once the rewind ends.
- Port: vm.js:1770 writes the saved HTML with the line complete and waits for a click; vm.js:1758 takes the whole-text flag from the snapshot.
- Effect: The rewound line appears at once in the port and is typed again at the read speed in the game.
- Reached: Every rewind.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js rewind: the line is typed over at the read speed with the two-frame hold (TextBox.retype), unless an ATSV(1) record was restored just before it.
- Compared: Compared with native frames (the rewound first line types out again).
### N2-85: Auto wait restarts after the system menu (low, confirmed)

Functions: `0x81b30`.
- Native: The count is the frame count x speed, and speed is 0 while the system menu is busy (0x41f38), so the auto countdown 0xae04b0 stops and goes on from where it was.
- Port: vm.js:1034-1037: the auto timer is real time, and if it fires while paused it re-arms for the whole wait.
- Effect: With auto mode on, opening and closing the menu makes the current line wait up to a full auto delay again instead of its remainder.
- Reached: Auto mode with the system menu opened during a wait.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js: opening the menu stops the auto countdown and closing it goes on from what was left (paused setter, armAuto(left)).
- Compared: Listing and test. Compared with the game 2026-11-09 (TODO item 51): A native run says otherwise. In auto mode a page's line had waited 148 of its 180 frames when the system menu was opened; after the menu closed the game went on 183 frames after the window was whole again (218 after the menu began to close), not 32: the wait starts again in full (the page is set again on the way back, 0x813e0, and counts as typed anew). Corrected: vm.js stops the timer under the menu and arms the whole wait again when it closes. Found with it: the countdown runs whether auto mode is on or not, so switching auto on leaves what is left of the wait (L pressed 4.5 s into a page's wait turned the page on that frame); armAuto counts from when the wait began.
### already S39: Delayed sound commands are not kept in records (low, confirmed)

Functions: `0x5baf0`.
- Native: 0x5a910 stores each channel's 068 delay slot (0x146ea98, 20 bytes a channel) at record +0x3914 and 0x5baf0 copies it back, so a countdown still running at the record goes on after a restore.
- Port: vm.js:snapshot has no field for this.delayed; vm.js:restore calls stop(), which runs cancelDelayed() (vm.js:529, 1538).
- Effect: A delayed sound effect still waiting when a point was taken is lost after a load, rewind or Quick Jump to that point.
- Reached: `068 is used in 325 of 549 scripts (200 and 100 ms most often); needs a save or rewind point inside the delay.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js snapshot keeps the 068 delay slots (delayed: what each channel's command still has to do and the time left, 0x5a910 -> record +0x3914); a message's record has them as they were at its start, so a delay that fires during the typing is still ahead of that point, and its sound state likewise (msgSound); restore puts them back and they go on counting (0x5baf0, queueDelayed / restoreDelayed). A record without the field (an older save) restores as before.
- Compared: Compared with a native run: a delayed sound effect (068 of 8,000 ms) queued just before a page's first line, saved by Return to Title and loaded from a fresh boot: the save's record holds the slot (channel 3, 480 frames, SEPL) and the game's mix goes from silent to sound about 8 s after the load (the 52 s effect fills the next windows of the run's audio log), while the same scene without 068 stays silent after the load. Not by ear: the mix statistics in the run log (2000 frames a line) and the save's bytes. A load in the same session as Return to Title, of the same script, played nothing in the first runs; the listing suggests why (the sound look-ahead 0x57a90 runs in 0x5baf0 only when the script changes, so that script's sound data may not be loaded again), not confirmed. The port plays the sound there.
### already S38: A rewind does not start the record's voice (low, confirmed)

Functions: `0x5baf0`.
- Native: 0x5bdd4 makes the record's voice pending, but case 0 with param 2 = 1 clears it (0x5d218-0x5d220, 0xae04c8 = -1) and resumes after the message (record +0x10), so no MSG runs to start it. With param 2 = 0 (Quick Jump 0x28d50, checkpoint restore 0x5d950) the message command runs again and plays it.
- Port: vm.js:1798 plays s.voice on every restore with rewind set, which covers both the rewind and Quick Jump.
- Effect: The port replays the line's voice on a rewind; the game stays silent until the next voiced line. Quick Jump is the same in both.
- Reached: Any rewind onto a voiced line (16,690 VPLY calls).
- Second reading: confirmed.
- Fix (2026-11-08): vm.js restore: a rewind plays no voice (the voice option is off for it); a Quick Jump and a load, which run the message again, still do.
- Compared: Listing and test.
### already S37: Fast forward: the listing gives the speed factors S37 left open (low, confirmed)

Functions: `0x802c0`.
- Native: S37's 'no skip factor' is not what the listing shows. 0x40ed0 sets speed 64 while skipping (0x41d4c, toggle table 0x34e054) and passes it to 0x4a5b0 (0x4208c), which stores speed / 2 + 1 = 33 in 0x590e80 and advances audio fades by 64; 0x48ac0 hands 0x590e80 to 0x3c970 (0x490d8), whose step is that count x ticks for tweens, motions and effects, and steps the FADS level 0xb34b14 itself by rate x 0x590e80 x ticks (0x49564-0x49584). So STCF (bit 5) and FADS (bit 3) waits still run, at 33 x. Bits 3 / 11 clear early only when bit 11 is set.
- Port: vm.js:357 finishAnimations, vm.js:1381-1403 tween times of 0 while skipping, vm.js:454 instant FADS, vm.js:1410 STCF returns at once, vm.js:1449 finite effects dropped.
- Effect: While fast forwarding the game shows a few frames of each fade, move or effect (a 500 ms fade about 1 frame, 1700 ms about 4); the port shows none. No change to where play goes.
- Reached: Every fast forward over STGS / FADS / STCF (5,179 STCF calls).
- Second reading: Speed 64 (0x41d4c; table 0x34e054 = 1, 1, 64, 64), 0x4a5b0 -> 33 in 0x590e80 with audio x 64, and 0x3c970's step 33 x ticks all hold; FADS's dispatch (0x77a40) tests only the instant run and the rewind flag, so ANIMATIONS.md:655 'FADS while skipping' means the instant run, and 0x802c0 does not shorten bits 3 / 5. One clause is wrong: the FADS level 0xb34b14 is not stepped by 0x3c970 but in 0x48ac0 itself.

### already S37: Fast forward: WTTM and typing run at a factor, they are not cut (low, confirmed)

Functions: `0x81b30`.
- Native: param_1 is speed x ticks (64 while skipping, 0x4206c-0x42084). The WTTM counter loses param_1 x (ticks, or 1 when fixed) a frame (0x81df4), so a fixed WTTM is not ended early but passes 64 frames a frame: 2000 ms takes 2 frames. Typing runs the 0x81c18 loop param_1 times, each pass adding 60 x letters-per-frame when 0xae0608 is above 60, so a line is complete in the first frame.
- Port: vm.js:384 sleep returns at once while skipping, for fixed waits too; vm.js:979 types the line whole while skipping.
- Effect: A frame or two per fixed WTTM while fast forwarding; the port moves on slightly sooner. No difference for typing.
- Reached: Every fast forward: 15,000 WTTM(n,1) in the scripts.
- Second reading: WTTM half holds: 0x34e054 / 0x41d4c speed 64, param_1 = speed x ticks, 0x81df4 subtracts param_1 x (ticks or 1), 2000 ms = 120 units = 2 frames. The typing figure is wrong: 0x81c18 loops param_1 times (64) and each pass adds 60 x 0.476 (s10 = 60 at 0x81b88), 1,828 letters a frame, so a line is whole in the first frame, as in the port (vm.js:979).

### already S38: A rewind plays no voice (low, confirmed)

Functions: `0x814c0`.
- Native: 0x814c0 stops a playing voice (0x81558-0x81564) and restores with param 2 = 1, which clears the pending voice (0x5d218) and resumes after the message, so nothing starts it. This answers S38 from the listing.
- Port: vm.js:1798 plays s.voice when rewind is set.
- Effect: The port speaks the rewound line; the game is silent until the next voiced line.
- Reached: Any rewind onto a voiced line.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js restore: a rewind plays no voice (the voice option is off for it); a Quick Jump and a load, which run the message again, still do.
- Compared: Listing and test.