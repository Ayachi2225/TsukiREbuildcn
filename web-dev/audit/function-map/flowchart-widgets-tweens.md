# A2 flowchart / widgets / tweens - findings

ROOT = /Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port. Evidence files in this folder:
- `special_cases.txt` - every special case of 0x93d10 (from -> to, condition, 0x954b0 calls, direct bit writes), decoded
  from the instruction listing (code_012.cpp) by `sym93d10.py`, a path-forking symbolic executor of all 1512 instructions
  (memory loads of F/G/*0xae0aa0 forked; 0x954b0 modelled from its listing).
- `jump_diffs.json` (`compare.py`) - native vs web marking for every (from, to) pair produced by the 1741 JUMPs of the
  shipped scripts (1128 distinct pairs; native = 0x95790 semantics, web = vm.js op_JUMP + flowchart-model.js transition).
- `script_jumps.json` (`jumps.py`) - those pairs with script names; `ledger.json` built by `gen_ledger.py`.

## Summary

370 functions: helper 250, divergent 34, unused 30, explicit 26, covered 20, missing 5, platform 5.

The widget library (0x1f480-0x26720) is plumbing the DOM replaces (helper/platform). The tween core and the quad/cubic
easings match uifx.js exactly. The flowchart *data* export (groups, transition table 0x3598b4, choice table 0x3594d0,
exit/entry flag tables) is exact. The divergences are in the *rules* around that data: which scene counts as current,
0x93d10's special cases, the rewind, the gallery replay and several drawing/navigation rules.

## Divergences / missing behaviour

1. **The current scene comes from RTST in the web, from JUMP in the native: shared scripts complete the wrong
   flowchart node.** (high)
   - Native: RTST n (0x92770, listing code_012.cpp `sub w9,w0,#0x215; cmp w9,#0x18 ... ldrh w9,[x8,#0x30]`) sets the path
     bit and writes F110 (state +0xdc) only for n in 533-557 (Ciel-sensei episodes) or when F024 != 0 (gallery replay).
     In normal play F110 is set by the JUMP: 0x954b0 ends with `strh w1,[x8,#0xdc]` (F110 = target entry flag), and
     0x93d10 returns 1 without any call for 25 pairs so 0x95790 leaves F110 at the *source* scene. RDED n (0x92440:
     `ldrsh w10,[x9,#0xdc]; cmp w8,w10; b.ne`) completes n only when n == F110 and path(n). Shared scripts list several
     RDEDs (01_00_ARC01_4_1: `RDED 55; RDED 57`) and exactly the one equal to F110 is completed.
   - Web: `FlowProgress.read()` (flowchart-model.js) sets `current = n` on every RTST and `transition()` sets
     `current = to`, so `finish()` always completes the RTST'ed scene; vm.js restore also re-derives current from the
     last RTST.
   - Effect (native completes / web completes): 57/55 (01_00_ARC01_4_3 -> 01_00_ARC01_4_1), 68/67 and 311/67
     (-> 01_00_ARC01_2_1), 105/104, 205/204, 108/322, 127/126, 152/149, 202/98, 250/257, 258/256, and on the FLAG1
     entries 483/270, 276/275, 280/279, 447/446. Scene 371 (Ciel route) is completed by the web when it is visited as
     an excursion from 04_00_ARC04_3 (24->371->24), never natively; likewise 52 after 66->52 with F050 != 0, 329 after
     324->329 with path(272), 184 after 181->184 with F054 == 0 (native F110 = virtual 520). The flowchart shows other
     nodes as read / jumpable, RDAS (0x92580) offers its skip prompt for the wrong node, and the "you are here" badge
     follows RTST. 25 (from,to) pairs / 25 script JUMP sites.
   - Confidence: confirmed in listing. Fix: set `current` only from JUMP marking (incl. the keep-current cases of
     item 2) and from RTST when n is 533-557 or in replay.

2. **0x93d10's special cases (84 (from,to) pairs in 60 behaviour groups plus a default rule) are approximated by a search.** (high) Web `transition()` takes the direct row or
   a breadth-first search through non-scene flags. Of the 1128 (from,to) pairs the scripts produce, 81 (90 JUMP sites) differ
   under some condition (99 pair/condition cases, jump_diffs.json):
   a. Row picked by the current-path bits (F201+): 55->58 uses 57->58 if path(57); 67->66 uses 68->66 / 311->66;
      104->107, 126->129, 149->341, 169->323, 204->207, 256->259, 322->112, 329->274 (271->274 / 272->274),
      517->277/278 (446/447->517), 521->446/447 (275/276->521), 523->271/515 (270/483->523), 1196->281 (279/280->281);
      unconditional re-routing 52->312 (66->312), 69->311 (519->311), 98->203 (202->203), 184->314 (520->314). The web
      lights the direct row's line (from the node of the shared script) instead of the line from the node actually
      played (connectors 619-620, 634-635/955, 690, 722, 754, 823, 894, 973, 975, 911/982, 1119-1120, 915-916/1162,
      1167-1168/1166, 922-923, 611, 954/959, 825-827, 961-962).
   b. Line picked by the last choice's answer (*(0xae0aa0), written by the selection code 0x83e50): 101->102 (virtual
      501/502/503 for SELD 31's three answers, all of which JUMP 473), 166->342 (504/505), 221->222 (509/510/511),
      369->29 (498/499/500), 410->220 (507/508). The web's search always goes through the first virtual node, i.e. the
      line of answer 1 lights whichever answer was chosen.
   c. Virtual nodes (485, 498-530) are marked started + completed + current-path (G110/G300/F201 bits) whenever a
      special path goes through them. The web never marks virtual nodes; with its placeholder rule the 24 placeholder
      parts with line != 3 (flags -498..-530, e.g. after 101->102, 172->11, 463->300, SELD 67/72/73) keep a '?' box
      (flow_sam_non) that the native hides (0x13fd4 returns before drawing a completed/started placeholder).
   d. Extra branch reveals written directly (global connector bits): 136->137 (734), 213->215 (837), 261->262 (1164),
      269->270 (905), 274->275 (1163), 277/278->279 (1161), 312->493 (1190), 331->330 (1158 + virtual 522), 355->20
      (799), 439->327 (980), 478->331 (1157), 51->69 (959), 181->184 (962 when F054 != 0), 521->446 (1162 when
      path(275)), 523->515 (1166 when path(270)). The web shows those lines only once their own transition is played.
   e. Suppressed marking: 66->52 when F050 != 0 and 324->329 when path(272) mark nothing natively (web marks 611/960,
      976); FLAG0/FLAG1 entries (270/483->523, 275/276->521, 446/447->517) mark nothing and the next jump marks the
      right row (web marks 1167/1168, 915/916, 1119/1120 at entry - the union is mostly the same, but 1168/916/1120
      appear on the FLAG0 path where the native never draws them).
   - Default case: any from (even -1) with to == 486 inserts 485->528->486 and marks 485/528; the web reproduces the
     lines via `flowFrom` for START_SCRIPT only.
   - Confidence: confirmed in listing (symbolic execution, spot-checked against the decompile). Fix: replace the search
     by the explicit table in special_cases.txt (conditions on path bits, F050, F054 and the last answer index; virtual
     node completion; extra connector bits; keep-current results).

3. **SELD's hand-written extras (0x92a60).** (medium) Choices 72 and 73 are shown in 12_01_CIEL12_3C (after RTST 483,
   RTST 270) and 13_01_01_CIEL13_1B (after RTST 447, RTST 446). 0x92a60 marks the second connector (1168 / 1120) only
   while F234 bit 6 / F256 bit 6 is clear - those are path(270) / path(446), set by those RTSTs - so natively SELD never
   marks 1168 / 1120. native_flowchart.py's CHOICE_EXTRA comment ("which no script sets") is wrong and the web always
   marks them (connector-only cells day 12 / day 13, column 5). **Corrected 2026-11-06:** RTST 483 / 270 and 447 / 446
   sit on opposite F069 branches of those scripts, so 0x92a60 does mark 1168 / 1120 when F069 is 0; the port now applies
   the rule as written. Choices 57/67/72/73 also mark virtual nodes
   512/513/523/517 started+completed+path; the web does not (513/523/517 then draw '?' boxes, line 4/5). Confirmed in
   decompile; scripts checked.

4. **Rewinding from the in-game flowchart keeps the game state natively; the web restarts from zero.** (high)
   - Native, Yes in dialog 26 (0x11a58): for every part in rows after the chosen row, clears its path bit (0x92500)
     and connector path bit (0x92540); rolls back route flags of later rows (0x95800, by the chosen row's group g:
     F069 g<=203, F065-F068 g<=184, F064 g<=176, F063 g<=161, F062 g<=160, F061 g<=156, F060 g<=146, F073 g<=142,
     F072 g<=131, F074 g<=124, F059 g<=121, F058 g<=55, F057 g<=47, F056 g<=30, F055 g<=16, F054 g<=10); 0x178c8
     records 300 variables (byte values; list 0x34ba16: F23-F27, F31-F33, F50-F53, F75-F81, F100, F101, F199-F272,
     F298, F600-F687, F799-F821, F823-F858, F870-F880, F962, F963, F981, F982, F989, F995, F1098, F1100, F1101,
     F1105-F1113, F1120, F1121) and 42 flags (0x34bc70, kept as 0/1: F054-F074, F28, F460, F822, F929, F975, F983, F984,
     F986-F988, F991-F994, F996-F998, F1103, F1104, F1118, F1123), sets F110 = node, F026 = jump, F1103 = 1;
     0x48ac0 starts the jump target, resets the game (0x3c550) and 0x17af0 restores them.
   - Web: flowchart.js -> main.js `flowchart` -> `startAt(i)` sets `vm.vars = {}` and `flow.resetPath()`: all route
     flags are 0 after a rewind (F069 alone is tested by 54 IF__ ops; F054-F074 by 84), so later branches can go
     another way than in the original, and the current-path highlight restarts empty.
   - Confidence: confirmed in listing/decompile. Fix: on rewind keep the 0x34ba16 variables (low byte) and 0x34bc70
     flags (as 0/1), apply 0x95800 and the later-row path clearing.

5. **Gallery flowchart: the native plays a replay at once and ends it at the scene's RDED.** (high)
   0x11418: when the gallery object (*0xae0260) exists, Decide calls 0x5040 (F024 = 1, result = jump + 2) and enters
   state 3 - no dialog. 0x48ac0 case 4 then sets G008 = jump and the replay byte 0xb34af0 = 1 and starts script id 0xbb8
   (presumably the ARCHIVE launcher that dispatches on G008; not in the web's jump index). With F024 = 1 RTST sets F110
   and the first successful RDED ends the replay (handler 0x79bdc: `ldrh w8,[x28,#0x30]; cbz -> continue;
   b 0x7f9e8` -> 0x5f200, 0x146e674 = 2) back to the gallery. Web: flowchart.js `activate` asks "Rewind to the selected
   scene? Any progress will be lost." also in the gallery, then `startAt(..., {replay: true})` without `then`, so the
   story plays on through the following JUMPs until some script ends ("End of the scene", title). Confirmed
   (decompile 0x11418/0x5040/0x48ac0, listing of 0x79bdc). Ending-list replays are not affected (QA episodes end at
   RTM_ right after RDED).

6. **In-game flowchart refusal missing.** (medium) 0x1767c opens it only when scene 1 is on the current path
   (0x136bc(1) -> 0x92340) and F110 is not one of the 25 scenes of table 0x3374ec (the Ciel-sensei episodes);
   otherwise cGameFlowchart state 3 shows SYSMES 1496 (0x4abe0(0x5d8)) and returns. ui.js "FlowChart" always opens it
   (prologue, episodes - and a rewind from there is then possible). Confirmed in decompile.

7. **Connector pieces are not adapted to what is revealed.** (medium) 0x14824 draws a part's piece only when its
   connector bit is set; line 3 under a placeholder only when the part above is a started placeholder / completed
   node; junction lines 5/8/10/11 are re-chosen from the neighbours (0x14d10/0x14e94/0x15098/0x15218 return pieces
   2-5 or none, using 0x922c0/0x92300/0x16078), and the in-game path variants likewise (0x158b0..0x15e80). The web
   draws the authored piece + 13 for every admitted part, so stubs point at unrevealed branches. 234 junction parts,
   122 line-3 placeholder parts. Confidence: likely (decompile).

8. **Keyboard / gamepad navigation and scrolling differ.** (medium) In game, Up/Down move along the current path
   (0x129f4/0x12b68 accept only nodes with path(n), and stop at day-0 rows); in the gallery they follow the drawn
   connector to the node it comes from (0x12eac/0x136d0) then the nearest column (0x1303c, col, +-1..+-5); Left/Right
   fall back to the rows below/above at column -1/-2 (0x1262c/0x1280c); a selection scroll keeps the adjacent row in
   view (0x10d5c: row above at y 4 / row below at y 966, 1/6 s quad-out); after a stick/wheel scroll a visible node is
   re-selected (0x12d1c). Web: `neighbour()` nearest-row/nearest-column geometry, `reveal()` shows only the node.
   Confidence: likely (decompile).

9. **Path highlight in the gallery flowchart.** (low) 0x149b4 (path connectors) and the path rules of 0x13fd4 run only in
   game (mode bit 0 set by 0x1767c; the gallery passes 1, 0x7f38). The web highlights `vm.flow.path` / `pathSecondary`
   in every mode and toTitle() does not clear them, so the gallery flowchart shows the last session's route and its
   "here" badge. Placeholders on the current path are hidden natively in game (0x13fd4), not in the web.

10. **Small visuals.** (low) In-game open/close fades (0x110d4 state 0: 0 -> 1 in 0.5 s type 2 mode 0; 0x11bec 1 -> 0
    mode 1) missing - the web fades only from the gallery; preview cross-fade (0x16e00: old image/texts 1 -> 0 and new
    texts 0 -> 1 in 1/12 s); cursor flash (0x10ba4 starts widget program 0x34b7f0 on the second cursor sprite: alpha
    1 -> -1 over 30 frames, visible ~0.25 s).

11. **SELS while skipping.** (low) 0x92800 returns at once while skip mode is on (*(0xae0900) via 0x5afb0, the flag ATSV
    also tests): no question, F000 keeps the last choice's answer and QACALL's `GOTS _D000 SEL_NO SEL_YES` uses it.
    vm.js op_SELS always asks. Confirmed in decompile. **Corrected 2026-11-06:** `0x5afb0` reads `0xae0900` -> `0x146e638`
    (relocations), the load's silent-run flag, not skip mode; SELS is asked while skipping, as the port does.

Web-only behaviour worth knowing: `FlowProgress.infer()` marks every dominator of a started scene completed (and its
links); the native has no inference, so loaded progress can show read nodes the native would not.

## Tweens / easing (the type-12 question)

0x26774 builds 13 classes (vtables 0x46ad10..0x46afb0; method +0x10 in, +0x18 out, +0x20 in-out; args t, from, to, d):
0 linear, 1 cosine (0.5-0.5cos(pi x) for all modes), 2 quad, 3 cubic, 4 quart, 5 quint, 6 sine (in/out wrongly use
2*pi), 7 circ, 8 elastic, 9 bounce, 10 back, 11 expo (in uses 2^(10(x-2)), out returns 'to' at t<=0), 12 "quadratic
Bezier". Types 2 and 3 equal uifx.js EASE.quad / EASE.cubic term by term (listing). 0x2750c returns
(1-x)^2*from + 2x(1-x) + P + x^2*to: it ADDS the control value P (+0xc, the float in s0 when 0x26774 is called)
instead of weighting it as the run-time class 0xff4b8 does. For UI tweens this means nothing: all 36 call sites of
0x26720 pass type 2 (0xca54 passes 0) and the six 0x21a20 sites pass 2, so classes 1 and 3-12 are never created in this
build. The music-volume curve (finding 2 of the brief) uses the run-time multiplying class; keep it that way. Tween
step 0x268ac: on the frame a delay ends it advances by 2*dt - delay (tiny overshoot); the web Tween has no delay.

## Unused native code

- Easing classes 1 and 4-12 (30 in/out/in-out methods, 0x269b4-0x2756c): never instantiated (no 0x26720/0x21a20 caller
  passes those types).
- Inside used functions: 0x93d10 cases (518->279), (518->280), (905->523) and from values 0x4ac/0x389 except 1196->281
  are not produced by any script JUMP; 0x926f0 with an argument other than 1 (IFUR always passes 1).

## Limits

- 0xfffc's row filter (admitted/distinct counts, comparison with the previous kept row and the look-ahead over later
  rows) was read but not emulated against layoutChart on real progress states; the web's collapse rule is simpler, so
  row counts/positions may differ (likely, unquantified).
- The native rule for the "here" badge (web flow_info at 1668,120) was not located; SYSMES 1496's text is not in
  system.json and the ROM tools need pycryptodome (not installed).
- Widget program opcode table (0x1fd48, 28 ops) only partly decoded (ops 2, 0x13); the meaning of 0x1f688's state
  bit in drawing not traced (cited as open in gallery.js:322).
- *(0xae0aa0) taken as the last selected answer index (stored by 0x83e50; consistent with the 2/3-way choices in front
  of every such jump), not traced through every selection type.

## Re-check of the handled functions (2026-11-08)

46 functions of this part compared with the port: 36 the same, 10 different, 0 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-2: RDAS is not ignored in a replay from the gallery's flowchart (medium, confirmed)

Functions: `0x92580`.
- Native: 0x79b78-0x79b7c: bl 0x50f0 (*0xae0288 == 2, gallery section id: 0xf924 passes 2 for cFlowchartScene, 4 for the Ending List at 0xd604); when true the command is passed over (b 0x77810) without reaching 0x92580.
- Port: vm.js:656 op_RDAS has no replay test; main.js:565 starts the flowchart's replay with replay: true and replayFrom = 'flowchart', and the gallery selects only completed scenes (flowchart-model.js:405), so flow.completed.has(n) holds for the replayed scene.
- Effect: With 'Read scenes auto skip' on, a scene replayed from the gallery's flowchart asks 'Jump to Next Scene?' (with 'Display confirmation') or runs an instant run to its RDED and returns to the flowchart; the original plays the scene through. Ending List replays are unaffected.
- Reached: 530 RDAS in 517 scripts, each scene's own number, so any gallery flowchart replay of such a scene with the setting on.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js op_RDAS returns at once in a replay started from the gallery's flowchart (0x79b78: 0x50f0 tests *0xae0288 == 2); main.js sets vm.replaySource from replayFrom when a replay starts, so the Ending List's replays and normal play still ask (0x50f0 is false for them).
- Compared: Compared with native frames (reference save with Read scenes auto skip and Display confirmation on): Gallery > Flowchart > a scene plays with no question; Gallery > Ending List > an episode asks Jump to Next Scene?, and New Game asks it at the first RDAS.
### N2-52: flow_bg stops at y 1022 (medium, confirmed)

Functions: `0xf8fc`.
- Native: 0xf8fc sets the clip of the flow_bg sprite +0x48 (texture 509, 1920 x 1080, z 600) with 0x1fa60(.., 0, 0, 0x780, 0x3fe) at 0xfb98-0xfbac; 0x254bc passes it to the scissor 0xb2e60, so the backdrop is drawn only for y < 1022.
- Port: flowchart.js:77 appends flow_bg at 1920 x 1080 outside .fc-view (the only flowchart picture with no 1022 clip).
- Effect: The strip y 1022-1079 behind the help band is dimmed by flow_bg (alpha about 0.8) in the port and not in the game, so the band looks far darker. Native frame nat3 03428: row 1021 (0,0,0), rows 1023-1079 about (47-61, 89-101, 116-126); port frame web_i0: about (3,35,60) in those rows.
- Reached: Every opening of the flowchart, in the game and from the gallery.
- Second reading: confirmed.

### N2-53: Flowchart node selection follows the mouse without a press (medium, confirmed)

Functions: `0x12424`.
- Native: 0x12424 reads the hover id 0x19150f0 (0xae0b0), which 0xae840 fills only while pointer state +8 is set (0xae874-0xae878 cbz w9); 0xad4e0 writes +8 only while a touch is in progress (0xad898-0xad8a4), a left press on PC (hle_hid_tsuki.cpp next_touch_sample); the mouse struct 0xae0dc8 is never written. So the selection moves only under a press or drag. In 0x11418 a press on a node that is not selected selects it (0x12424 returns 1, bVar5 = 0) and a press on the selected node decides (second press).
- Port: flowchart.js:233 ui.add(b, ..., { onSelect }) without secondTap: ui.js:376 mouseenter -> move -> select(p, 'pointer') and sound 0 on any hover, no press; ui.js:377-383 click -> select and choose, so decide runs at once.
- Effect: With a mouse the cursor jumps to a node, the preview changes and the cursor sound plays as the pointer crosses the chart; in the game nothing changes until the left button is down. One click opens the rewind question or a gallery replay in the port; the game takes one click to select and a second to decide.
- Reached: Any mouse use of the flowchart, in the game and from the gallery, on every selectable node.
- Second reading: confirmed.

### N2-54: A rewind from the flowchart cuts instead of closing (medium, confirmed)

Functions: `0x17cac`.
- Native: 0x11a58 Yes -> state 5 (0x11bec): day titles hidden, 1 -> 0 over 0.5 s (0x26720 type 2 mode 1), +0x38 = 2 written by 0x17cac. 0x17320 then returns 2 and 0x4d8c0 state 0xf goes to state 0x15 (0x2e120(0), 0xb359d8 = 1 so 0x4c370 draws no column): each frame 0x49630(-1/30), F1110 = 0, level -= frames / 30; at 0 it clears text objects 4-9 (0xab6e0), runs 0x5f200 and returns, and only then the jump starts.
- Port: flowchart.js:215 ui.dialog(ask, () => jump(p.script, p), reopen) -> main.js:564 ui.close() (ui.js:357 removes the screen at once) -> rewindTo -> startAt. Only Back goes through flowchart.js:365 close and its fadeOut.
- Effect: On Yes to a rewind the chart vanishes and the chosen scene starts at once; the original fades the chart out over 0.5 s, then takes another 30 frames (0.5 s) with the menu background fading before the scene starts.
- Reached: Every Yes in dialog 26 of the in-game flowchart.
- Second reading: 0x11a58 Yes -> state 5; 0x11bec fades 1 -> 0 over 0.5 s and 0x17cac gives +0x38 = 2 when *0xae0330 is set; 0x17320 returns it; 0x4d8c0 case 0xf -> 0x15 runs 30 frames at -1/30 (0x49630(-1/30), F1110 = 0). flowchart.js:215 -> main.js:564 ui.close() -> rewindTo -> startAt has no fade; only Back uses close / fadeOut (flowchart.js:365). One detail is wrong: at level 0 the calls 0xab6e0(4..9) clear text objects, they do not stop layers.

### N2-165: Gallery opening: cursor shown during the fade (low, confirmed)

Functions: `0xf8fc`.
- Native: With no requested scene (third argument -1, the gallery's normal opening) 0xf8fc skips 0x10ba4 (0xfea0), so the cursor's visible bit, cleared at 0xfb1c-0xfb4c, stays clear; 0x1121c makes it visible only at the end of the 0.5 s fade.
- Port: flowchart.js:383-384: whenever part (0,0) is selectable, ui.select with how 'open' runs select, which sets the cursor display to block at once (flowchart.js:178); it then fades in with the page.
- Effect: Opening the Flowchart from the gallery menu, the cursor frame fades in with the chart instead of appearing when the fade ends.
- Reached: Every gallery opening that does not follow a replay, when scene 485 (row 0) is completed.
- Second reading: confirmed.

### N2-166: Direction pressed while the player's scroll runs (low, confirmed)

Functions: `0x10ba4`.
- Native: 0x10ba4 skips 0x10d5c when bit 5 is set (0x10ce4-0x10d08). 0x11418 sets bit 5 for a stick, flick or scroll-bar scroll (0x11614, 0x1186c) until its tween ends; a direction's move that returns true clears it afterwards (0x117d0), so that move does not scroll. Re-selection (0x12d1c) then stops, unless the drag velocity is still non-zero, when 0x11810-0x1189c set bit 5 again in the same frame and 0x12d1c runs on.
- Port: flowchart.js:183-186: how 'key' always calls scrollFor and starts a tween; the player flag (flowchart.js:170) stays set, so reselect (flowchart.js:299-304) keeps running through the new tween.
- Effect: Pressing a direction during a stick / PageUp / PageDown pulse's 1/6 s, or during the last 1/6 s after a drag's coast has died: the game moves the cursor and leaves the view alone, and re-selection stops; the port scrolls to the selection when it has left y 2-966 (replacing the player's tween) and keeps re-selecting, so the selection may move again. While the coast's velocity is still non-zero the two agree: the view follows the flick and re-selection continues.
- Reached: Any flowchart with a scroll bar, a direction within about 10 frames of a stick / PageUp / PageDown pulse or within 1/6 s after a drag's velocity reached 0.
- Second reading: The stick / PageUp / PageDown case is right: bit 5 (bitset size +0x20 = 64, 0x8778) makes 0x10ba4 skip 0x10d5c (0x10ce4-0x10d08), the move returns 1 after 0x10ba4, 0x117d0 clears the bit and 0x118a0 ends the frame without 0x12d1c; flowchart.js:183-186 and :170 keep scrolling and re-selecting. The coast part is wrong: after 0x117d0 the same frame goes on to 0x11810, and while the drag velocity 0x6c4 is not 0 it calls 0x27bd4 and sets bit 5 again (0x1186c), so 0x12d1c still runs; in the port flick.step's playerScroll (flowchart.js:297-298) replaces the key's tween on the next frame before it is stepped. Only the last 1/6 s, after the velocity has died, behaves like the stick case.

### N2-167: Back button stays on during the close (low, confirmed)

Functions: `0x11bec`.
- Native: 0x11bec calls 0x4a790(0) on the first frame of state 5 (0x11cd0-0x11cd4), so the button starts sliding out as the fade starts.
- Port: flowchart.js close (365-373) never calls ui.setBack; the button stays on for the 0.5 s fade and slides out only when ui.system opens the menu.
- Effect: The port's Back button lingers through the fade and leaves about 0.5 s late.
- Reached: Every Back out of the in-game flowchart. Shows only because the port always draws the touch button; the native draws it at alpha 0 in docked mode.
- Second reading: confirmed.

### N2-168: Preview panel fades as one layer, so its label and texts blend differently (low, confirmed)

Functions: `0x1697c`.
- Native: 0x16a44 / 0x16b68 give the level to the eight panel widgets (+0x40..+0x78) through +0xb8, each blended on its own at that alpha (0x254bc).
- Port: flowchart.js:337 (setAlpha) sets opacity on the whole .fc-preview element, so flow_infobase, the picture, 'This scene' and the texts are composited first and fade as one layer.
- Effect: During the panel's 0.5 s fade in and out the dark title and note lie over flow_infobase (opaque white under them) and 'This scene' over the picture: in the game the base shows through the glyphs at (1 - a) x a, so the text is paler at mid fade (about 70 levels against 15 at a = 0.5); in the port it is not. The picture itself lies over a cut-out of the base and does not differ.
- Reached: Every opening and closing of the flowchart with a preview (flowchart.js fx in the game; the same page fade from the gallery).
- Second reading: confirmed.

### N2-169: Preview title colour (low, confirmed)

Functions: `0x16e00`.
- Native: 0x16e00 sets the title's colour 0x4210 (0x25fec at 0x170c4); 0xa7790 converts it with 0x1007c0 (RGB565, bits replicated) to RGB (66, 65, 132); the native frame's darkest title pixel is (64, 63, 132).
- Port: style.css:193 .fc-preview-title colour #403987 = (64, 57, 135); port frame web_i0 shows exactly that.
- Effect: The scene title in the preview panel is a slightly more violet blue: (64, 57, 135) in the port against (64, 63, 132) in the game's frame, green 6 levels lower and blue 3 higher (against the table colour (66, 65, 132) green is 8 lower).
- Reached: Every preview with a title, in the game and the gallery.
- Second reading: 0x170bc-0x170c4 sets 0x4210 at widget +0x42c; 0x1007c0 bit-replicates RGB565 to (66,65,132). style.css:193 #403987. Frames: 1091 solid pixels (64,63,132) in nat3 03428, (64,57,135) in web_i0; the on-screen gap is 6 levels of green (the 8 is against the table value, which the frame does not show), red equal.

### N2-170: Delayed CG thumbnails run one frame behind the native fade (low, confirmed)

Functions: `0x268ac`.
- Native: 0x268ac 0x268b8-0x268cc: delay -= dt; when it reaches <= 0, dt' = dt - delay, so with the delay left before the frame D the frame adds 2*dt - D to elapsed instead of dt - D. Every tween with a delay is therefore one frame's dt ahead of (time - delay). Only 0xb318 (0xb460) passes a delay: table 0x3373a0 / 50 s for the first 42 thumbnails shown.
- Port: gallery.js:693 cascadeLevels uses EASE.quad.in((grid.cascade - grid.delays[k]) / 0.5), exactly time - delay; uifx.js:790 Tween has no delay.
- Effect: Each time a CG grid is built inside the gallery (the CG section opened again, an entry's sub-grid, back to the main grid, the viewer's return), up to 41 thumbnails with a non-zero delay fade in one frame (1/60 s) later than the original; at 60 fps a thumbnail with delay 0.02 s reads alpha 0.0007 against 0.0036 on its second frame and 0.6834 against 0.7396 on frame 26. The first grid opened from the title is calibrated to native frames (GALLERY_OPEN.cascade) and does not show this one-frame lag; there it is the no-delay first cell that is ahead (0.96 against about 0.24 on the first frame, derived).
- Reached: Every CG grid built inside the gallery: 0xb318 runs for the main grid and sub-grids through 0x9970 (0x9b70); table 0x3373a0 holds 0-11 for up to 42 cells, non-zero for all but the first. Not the first grid after opening the gallery from the title.
- Second reading: The quirk is right: 0x268b8-0x268cc gives 2*dt - D on the frame the delay ends (D = delay left before it), so a delayed tween runs one frame's dt ahead of time - delay; only 0xb460 passes a non-zero delay to 0x26894 / 0x21a20 (every other source traced to zero); table 0x3373a0 is 0-11 by (column + row), / 50 (0xb404 = 50.0); the alphas 0.0036 / 0.0007 and 0.7396 / 0.6834 check out; gallery.js:693 is exactly time - delay. But 'each time a CG grid opens' is too wide: the first grid opened from the title starts at head.cascade = GALLERY_OPEN.cascade 0.49 s (gallery.js:653 and 679, uifx.js:803-810, checklist G20, measured on native frames, first-frame 0.47 / 0.51 for the same cells). That number is 2 x the 0.245 s loading frame, so for delayed cells it already equals the native's 2*dt - D (thumbnail 1: 0.884 in both). By the same formula the no-delay first cell is only 0.245 s on natively (alpha 0.24) against the port's 0.49 (0.96), so 'no delay match' does not hold on that grid (derived from the listing and G20's figures, not run). A sub-grid with fewer than 42 cells has fewer delayed cells. The first step's frame alignment for grids built inside the gallery was not traced.

### N2-171: A story movie counts as seen from its start (low, confirmed)

Functions: `0x92400`.
- Native: G005 is set only at the movie task's end (0x40a00 -> 0x923c0); 0x92400 reads only that bit, so a movie that never ended stays unseen.
- Port: vm.js:1625 op_TOMP calls unlocks.watched(name) before the movie plays; unlocks.js add saves after 1 s and main.js:334 saves at once on pagehide. gallery.js:1232 lists a movie on G005 or that name, unlocks.js:97 unlocks the vocal rows on the name alone, and vm.js:1624 with main.js:189 lets the next showing be passed on it. Checklist G10 keeps the name as a fallback for the list; the record is still made at every start.
- Effect: If the page is closed or reloaded during the first showing of one of the six movies, the port afterwards treats it as seen: op1_arc / op2_ciel are listed in the Movie gallery, their song rows are unlocked and the movie can be passed on its next showing. The original keeps these off until the movie has ended.
- Reached: TOMP 4, 5, 6, 35, 36, 37 on a first showing, with the page closed or reloaded at any moment after the movie starts and before it ends; no script path is needed beyond reaching the movie. Only 5 and 6 change the Movie gallery and the song rows; all six can be passed on the next showing.
- Second reading: G005 is set only by 0x40a00 -> 0x923c0 (one bl, 0x40af8, and no script names G005), and 0x92400 reads only that bit (movie list, music rows 80 / 124 at 0x19fe8 / 0x19ffc, pass gate 0x404e0 ...). Port as cited: vm.js:1624-1625, gallery.js:1232, unlocks.js:97, main.js:189; G005 only at finish (main.js:176). Names match (5 op1_arc, 6 op2_ciel; /music rows 91 and 93). G10 and the gallery.js comment mention the name only as 'recorded as watched before' for the list; nothing records the write at the movie's start as a choice, so not deliberate. Wrong: the 1 s condition. main.js:334 calls vm.unlocks.save() on pagehide, so a close or reload at any moment after TOMP keeps the record; the 1 s timer matters only for a crash.
- Fix (2026-11-09): vm.js op_TOMP records nothing; main.js playMovie's finish, which runs when a story movie ends or is passed, sets G005's bit as before and now also makes the record the Movie list, the song rows and the pass rule read (unlocks.watched, saved at once).
- Compared: Native run (G005 cleared in the save copy; a test scene with TOMP 5 twice): the first showing runs its whole 107 s through presses of B and + at 10, 20 and 34 s, so the bit is not set while it plays; the second is passed by B nine seconds in. (The game writes its save only at saves, so a showing cut short by quitting leaves nothing behind either.) The port, same scene in an isolated browser: during the first showing no record, nothing stored even after a save of the unlocks, G005 0 and Enter does not pass; after it the record, the stored name and G005 bit 0, and the second showing is passed.

### N2-172: RDAS does not wait out a notice popup (low, confirmed)

Functions: `0x92580`.
- Native: 0x79bc4-0x79bcc, read-skip on and completed(n): 0x3b480 sets a popup that has finished opening (t >= 1) to t = 3 (closing), and while 0x3b580 says a popup is up the interpreter returns with x21, this command's start, so RDAS runs again next frame; 0x92580 runs only once the popup has gone.
- Port: vm.js:656 op_RDAS neither hurries nor waits for main.js:52 popup.
- Effect: With read-skip on, an Auto or Quick Save notice showing as a read scene's RDAS is reached is cut short and holds the script until it has gone in the original (about 26 frames after RDAS hurries it, up to about 25 more if it was still opening); in the port the popup runs its full length and the question or countdown starts at once.
- Reached: Only while an Auto or Quick Save notice is up (about 1.7 s at a steady 60 fps natively, 0.7 s in the port) when a completed scene's RDAS runs with the setting on, not in a gallery replay. Auto Save is raised only on the way to the title, so it is not up at an RDAS in practice.
- Second reading: The gate is right: 0x79b80-0x79bc0 read-skip and completed(n), 0x3b480 sets t = 3 when state 1 and t >= 1, the 0x3c970 update then goes to state 2 with t = 1 (0x3eb6c-0x3eb90), and 0x79bcc -> 0x7fef4 returns x21 (0x77820) until 0x3b580 says idle; vm.js:656 has no such wait and onSceneSkip (main.js:251) does not look at the popup. Wrong: the notice list and the length. 0x3b430 starts kinds 1-3 only (w0 < 1 clears, 0xafec8c has no other writer) and its six callers pass 1 Quick Save (0x4e950), 2 Auto Save (0x4cd30, 0x4cdf4, 0x4d274), 3 Auto (0x41d24, 0x4e68c, the bit-0 toggle of *0xae0660), so the rect at index 0 (Skip) is never shown natively and main.js:340's Skip notice has no native counterpart. Auto Save is raised only on the way to the title. Length: 0x3eb34-0x3ebc0 adds 0.04 x 0x590e80 (1) a frame when exactly one frame passed (0xad180) and 0.1 only otherwise, so a notice lasts about 102 frames (1.7 s) at a steady 60 fps, not about a second; the port's fixed 0.1 (main.js:66, ANIMATIONS.md:722) gives 42. In a gallery replay 0x50f0 passes over all of this.
- Fix (2026-11-08): vm.js op_RDAS: with read skip on and the scene completed, the popup is hurried and the command waits for it to go, re-trying every frame (main.js popup: busy() and hurry(), as 0x3b580 and 0x3b480), before the rest of RDAS. The same wait covers a load, a rewind (restoring) and the instant run's pass over the command. The scene-skip path itself is unchanged.
- Compared: From the listing (0x79bc4-0x79bcc) and a unit test of the wait. A native run (Read scenes auto skip on, a Quick Save popup raised just before the RDAS, t22) did not settle it: the popup stayed frozen at its first animation scale for the 0.9 s until the instant run went on, so the wait's timing is from the listing alone.

