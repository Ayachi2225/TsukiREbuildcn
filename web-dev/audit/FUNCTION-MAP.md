# Native function map: every function of the game's engine, and whether the web port has it

**2026-11-06.** A function-by-function check of the native engine image against the web port, after
[PARITY-AUDIT.md](PARITY-AUDIT.md), [FIXES.md](FIXES.md) and [NATIVE-PARITY.md](NATIVE-PARITY.md). Nothing in the port
was changed by this check.

- One row per native function: [function-map.csv](function-map.csv) (also [function-map.json](function-map.json)) with
  its address, size, status, feature, the web file or function that has it, a note and who cited it before.
- The detailed findings per subsystem, with addresses and listing evidence: [function-map/](function-map/).
- The work list for fixing them, marked as items get done: [FIX-CHECKLIST.md](FIX-CHECKLIST.md).
- The functions counted as handled, to be re-checked one by one (a citation is not proof): [REVERIFY.md](REVERIFY.md).

## The answer

Every one of the 5,984 functions in `main.bin` is accounted for. Most of the image is not game logic at all:

| Status | Functions | Meaning |
|---|---:|---|
| platform | 4,161 | Switch SDK calls (457), Nintendo libraries linked into the game (2,016: NintendoWare Atk audio, NintendoWare Font, nn::gfx, nn::perf) and engine plumbing (allocators, GPU objects, file I/O, threads, controllers, save storage, accounts). The browser provides all of it. |
| helper | 1,068 | Small utilities (containers, getters, constructors, string and maths helpers) that belong to whatever feature calls them. |
| explicit | 472 | The web port implements them and cites their address. |
| covered | 93 | The web port implements them without citing them. |
| **divergent** | **72** | The web port has the feature but it behaves differently in a way a player can see or hear. |
| **missing** | **0** | Game behaviour the web port does not have. |
| replaced | 20 | The game's touch rule, mode panel and page-by-page backlog, replaced on purpose by the mouse and keyboard redesign of 2026-11-09. |
| unused | 98 | Native code that cannot run with the shipped scripts and data (commands no script uses, an unreachable "extra" title menu, PS4 branches, debug paths). |

So: **every feature the game uses has a counterpart in the web port, but 72 functions (all divergent, none missing; 2026-11-10)
mean it does not yet behave exactly like the game.** The ranked list is below.

Counts updated 2026-11-07: the rendering rows whose differences checklist section 2 fixed (V1-V10, and STCH / SCH2's
source layer, blank arguments, empty layer numbers and pivot) are re-marked in the CSV, nine of them explicit (they
were re-read in the listing when fixed), then the last four the same day (STCH / SCH2's pivot cut, the panel blobs and
band, 0x37f50's open questions): no rendering row is divergent now. Again the same day for the text window (T1-T12):
0x391a0, 0x38d40, 0x2e170, 0x6e950 and 0xc0684 explicit, 0x3b330 covered (nothing draws with it), and the notes of the
rows those items touched (0x81b30, 0x6e0d0, 0x3b2d0, 0x2e560, 0x38ec0, 0xbdc2c, 0xa88b0, 0xa8190, 0x3b3d0, 0x3b2a0,
0x2d570): no text row is divergent now. On 2026-11-07 for sound (A1-A10): 19 divergent audio rows and the missing
0xacfa0 are explicit (each re-read in the listing or decompile), and the rows whose web function changed name point at
the new ones. The same day M4 and M12 made 0x9d240 and 0x9b0c4 (audio) and 0x29300 and 0x29fa0 (config) explicit: no
audio row is divergent or missing now. On 2026-11-07 for the gallery (G1-G11, G13): 63 rows explicit, each re-read in
the listing or decompile (59 of the gallery's, the seen bits 0x77610 / 0x774f0 / 0x77360 of the script machine's and
the title's music 0x8e1c0), 0x1873c unused (the movie gallery's confirmation is never entered), and notes on 0x18264,
0xf6f8, 0xaf78, 0x7624, 0x7328, 0x9578, 0x5920 and 0x19518; the gallery's divergent rows left are 0x19518 (checklist
M17) and the TOMP task's three (0x402a0, 0x40480, 0x40940, fixed by S15, kept at their audit status). Later the same
day M17 made 0x19518 explicit and the gallery's own help band (G14) 0x5920, 0x82bc, 0x82d0, 0x936c, 0xadfc, 0x19e90,
0x74f0, 0x1b1cc, 0x1d5ec and 0x4c8c; the TOMP rows are the gallery's only divergent ones left. Then checking the
sprite class's users against its draw `0x254bc` (G15-G18): 0x9578, 0xa8c4, 0x1b7d8, 0x1a058 and 0x1a1a4 (covered),
0x1fd48 and 0x24cf4 (widget library helpers) and 0x276b0 and 0x2788c (scroll-bar helpers) explicit, notes on 0xba18,
0xa968, 0x82fc, 0x1e98c, 0xaf78 and 0x254bc. For the flowchart (F1-F4): 26 divergent rows explicit (the chart
0xfffc, its nodes 0x13fd4, line pieces 0x14824 and their choosers 0x14d10 / 0x14e94 / 0x15098 / 0x15218 / 0x16078, the
path pieces 0x149b4 / 0x158b0 / 0x15a98 / 0x15c9c / 0x15e80, the moves 0x1262c / 0x1280c / 0x129f4 / 0x12b68 and their
helpers 0x12eac / 0x13854 / 0x136d0 / 0x139f4 / 0x1303c, the scrolls 0x10d5c / 0x12d1c, the input 0x11418 and the
update 0x110d4), five covered ones explicit (0x10ba4, 0x12424, 0x11eb4, 0x16660, 0x16a44), notes on 0x153b8, 0x1121c,
0x11bec, 0x16e00, 0xf8fc and 0x7f38. Then F5-F9 (the rest of the flowchart, compared with the native build on the
user's save): explicit the day bands 0x13b54 / 0x13d04 / 0x14b58 and the in-game band 0x1776c (covered before), the
help kind 0x123f4, the band's draw 0x1783c and alpha 0x60e4, the touch drag's 0x6a0 / 0x6c4 and the scroll setter
0x27bd4 (helpers before); notes on 0xfffc, 0x11418, 0x40c (the flowchart's use ported, still divergent for the lists
and config), 0x5920, 0x5b58, 0x10ba4, 0xf8fc, 0x11a58, 0x5040, 0x5baf0, 0x527f0 and 0xb37d0. Then M20 (the
config's widgets from the engine's tables, checked against the native build's frames): 0x2aa80, 0x29bf0, 0x2b930,
0x2b770, 0x2c380 and 0x2cab0 (divergent) and 0x29770 (covered) explicit, each re-read in the decompile; notes on
0x2d980, 0x29fa0, 0x2d040, 0x2d570, 0x2b680, 0x29f00, 0xae840, 0xaeec0 and 0xadca0. Then M21 (the system menu's
column, which the title's Config and Load had drawn): 0x4c370, 0x4cea0 and 0x2b5c0 (divergent) and 0x4d580 and 0x4d340
(covered) explicit, each re-read in the decompile; notes on 0x4cba0, 0x4d8c0, 0x2c810 and 0x8e200. At the audit
there were 259 explicit, 169 divergent and 22 missing (191); rows fixed by other checklist items keep their audit
status.

Counts updated 2026-11-10 by TODO item 107: 62 older rows that still said divergent or missing and no longer have an open finding. 42 of them were fixed long ago and are explicit (39) or covered (3): the jump table, XSTP / XRSM, story movies, the flowchart's marking and rewind, Return to Previous Scene, the replay's greyed buttons, the completion banner, the New Game and start-up rules and the save rows; each was confirmed in today's code or by its ticked checklist item, not re-read in the listing. 20 are a new status, `replaced`: the touch rule, the mode panel and the backlog's pages, replaced on purpose by the redesign. The 72 still divergent all have an open item in [TODO.md](TODO.md) or say which difference is left.

Counts updated 2026-11-08 by the re-check of the handled functions ([REVERIFY.md](REVERIFY.md), the 406 left after the first pass): 67 covered to divergent, 1 covered to missing, 2 covered to unused, 124 explicit to divergent, 3 explicit to unused. Each re-checked row's note in the CSV says what was compared. The differences are listed under "Found by the re-check" below: 74 medium and 135 low, none rated high. The ones that touch saves or which scene plays are N2-1, N2-37, N2-26, N2-27, N2-44.

Counts updated 2026-11-08 by the rendering fixes (the rendering and split / shake items of "Found by the re-check" below, fixed one by one against the listing and, where a scene can be built, against native frames): 32 rows went back to explicit; the rows with a fixed item that still have another open difference (`0x5f8f0`, `0x625c0`, `0x91540`, `0x2e430`, `0x89420`) stay divergent with the fix noted. The fast-forward entries labelled "already S37" were left open: the game runs skipped text at a speed step (tweens, FADS levels, effects and audio fades advance by 17 or 33 a frame, fixed WTTMs lose 64 a frame), while the port's skip is instant, so porting them means a game-speed clock across the VM's waits, tweens and effects (see S37).

Counts updated 2026-11-08 by the text fixes (the [text] items of "Found by the re-check" and the script machine's story-screen items: rewinds, typing, the read speeds; each line says how it was checked): 18 more rows back to explicit (the rows that still have another open difference, `0x9c300`, `0x5baf0`, `0x77790`, `0x802c0` and `0x81b30`, stay divergent with the fix noted), N2-121 not reproduced, and the row pitch `0x39180` settled on a native page (rows 77.5 px apart).

Counts updated 2026-11-08 by the script machine's items (N2-1, N2-2, N2-79, N2-81 and S39: where a save resumes, what a replay plays, the voices, the delay slots; each checked against a native run): `0x527f0` and `0x5baf0` went back to explicit; `0x92580` stays divergent for N2-172 and `0x77790` and `0x802c0` stay divergent for S37 (fast forward, parked).

Counts updated 2026-11-08 by the dialog items (N2-31, N2-37, N2-46, N2-48 to N2-51, N2-131, N2-155 to N2-159, N2-161, N2-162, N2-172, N2-176: the Yes / No window, SELS / SELA, the notices and the press rules; each line says how it was checked, most against native frames with scripted mouse presses): 10 rows went back to explicit (`0x4ad40`, `0x4ae90`, `0x85900`, `0x85e40`, `0xae840`, `0xad4e0`, `0x4d710`, `0x92580`, `0x6764`, `0x2c810`) and the older rows, re-read for the first time since the first audit (`0x48540`, `0x49710`, `0x49750`, `0x49f00`, `0x4abe0`, `0x4b4a0`, `0x4cca0`, `0x848b0`, `0x84a90`, `0x85690`, `0x85c20` divergent, `0x89590` missing), are explicit too; `0x52aa0` stays divergent for N2-139 and `0x47bf0` for N2-28.

Counts updated 2026-11-08 by the priority 1 items of [TODO.md](TODO.md) (N2-24, N2-25, N2-26, N2-27, N2-28, N2-74, N2-124, N2-130, N2-208, N2-209: skip and its sounds, the master volume, the gallery's replays, the movies; each line says how it was checked): 11 rows went back to explicit (`0x9cf90`, `0x66200`, `0xedd28`, `0xee110`, `0xee200`, `0xee5ec`, `0xeea34`, `0x42680`, `0x47bf0`, `0x6ef30`, `0x424b0`). `0xee6b4` stays divergent for N2-129.

Counts updated 2026-11-09 by items 19 to 23 of [TODO.md](TODO.md) (N2-30, N2-32, N2-33, N2-132, N2-133, N2-135, N2-137: the system menu's and the save screen's fades, Return to Title, the flowchart's fades, the hand-off between the column and the list; each compared with native frames): `0x4d340`, `0x4d7e0`, `0x4d8c0`, `0x4b880`, `0x4cba0` and `0x50ed0` went back to explicit. `0x49630` and `0x50fc0` stay open for N2-153 and for N2-134, N2-136 and N2-138.

Counts updated 2026-11-09 by items 27 to 33 of [TODO.md](TODO.md) (N2-23, N2-29, N2-36, N2-38 to N2-43, N2-45, N2-142, N2-145, N2-153: the title's music, rows, return from Config and Load, whites, the first-launch screen, Config's first opening; each compared with native frames, the first screen's music rate only with the code): `0x902f0`, `0x8d2f0`, `0x4bcf0`, `0x50e00`, `0x49630` and `0x1b20` went back to explicit. `0x8d5d0` stays open for N2-143 and N2-144, `0x9c9b0` for N2-128 and `0x2c6e0` for N2-152.

Counts updated 2026-11-09 by items 34, 35, 37, 38, 41 and 42 of [TODO.md](TODO.md) (N2-56, N2-57, N2-58, N2-60, N2-62, N2-63, N2-64, N2-67, N2-186: the gallery's column placement, Music rows, the open section's row, the section it reopens on, the sub-grids' crossfade, the replays' exit; each compared with native frames): `0x49b0`, `0x5040`, `0x7918`, `0x7ac4`, `0x8ba0` and `0x1b43c` went back to explicit. `0x6124`, `0x6e28`, `0x9bdc`, `0x1a1a4` and `0x1b2f0` stay open for N2-175, N2-178, N2-179, N2-185, N2-196 and N2-68.

Counts updated 2026-11-09 by priority 1 of [TODO.md](TODO.md) (items 58, 116, 64, 63, 62, 61, 66, 111, 67 and 68; N2-123, N2-125, N2-126, N2-127 and N2-171 among them; each compared with a native run, item 66 not reproduced): `0x65e50`, `0x9c300`, `0x9c400`, `0x9c650`, `0x92400` and `0x4e0c0` went back to explicit; `0x6e0d0`, `0x6e950`, `0x527f0`, `0x814c0`, `0x391a0`, `0x32e30` and `0x34a70` stay explicit with a note of what changed.

Counts updated 2026-11-09 by item 110 of [TODO.md](TODO.md) (fast forward at the game's speed, checklist S37; native runs with ZR held against the port stepped a frame at a time): the fourteen rows that were waiting on it went back to explicit (`0x802c0`, `0x81b30`, `0x77790`, `0x60610`, `0x637a0`, `0x62d20`, `0x625c0`, `0x62f90`, `0x91540`, `0x91900`, `0x91cf0`, `0x921b0`, `0x5f420`, `0x2e430`); `0x5f8f0` (SHOK) stays divergent for what the runs showed besides: the game's SHOK leaves plain colour pictures where they are (TODO item 149).

| Subsystem | Functions | explicit | covered | divergent | missing | unused | platform | helper |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Gallery, CG viewer, Music Player, movies | 355 | 90 | 13 | 47 | 0 | 2 | 9 | 194 |
| Flowchart, UI widgets, tweens, scene flags | 370 | 57 | 8 | 16 | 5 | 33 | 5 | 246 |
| Backlog, config, dialogs, choices, buttons | 167 | 51 | 4 | 28 | 0 | 2 | 25 | 57 |
| Title, start-up, system menu, saves | 217 | 39 | 6 | 24 | 4 | 19 | 41 | 84 |
| Text window and text engine | 218 | 33 | 5 | 0 | 0 | 9 | 48 | 123 |
| Rendering, effects, animation | 406 | 94 | 15 | 1 | 0 | 17 | 46 | 233 |
| Audio | 198 | 43 | 15 | 3 | 0 | 11 | 66 | 60 |
| Script machine and game state | 152 | 26 | 24 | 4 | 2 | 5 | 20 | 71 |
| SDK stubs, Nintendo libraries, engine plumbing | 3,901 | | | | | | 3,901 | |

## How it was done

- **Inventory.** `data/tsuki/analysis/main.bin` (SHA-256 `ac6b0120…7951`, 5,984 functions, 346,187 instructions in the
  recompiler's listing `data/tsuki/gen/main`): call graph, tail calls, data and string references, SDK import stubs
  (from the JUMP_SLOT relocations), RTTI vtables (RELATIVE relocations) and non-RTTI class vtables. Ghidra 12.1.4
  headless decompiled the 3,511 functions below 0x101000; where the decompile was unclear the listing decided.
- **Mapping.** Every native address cited in `web/app/js`, `web-dev/tools`, `web-dev/tests` and the audit notes was resolved to
  its function (347 were already cited). The game and engine code was split into eight address lists by subsystem
  and each function was reviewed against the web code, the scripts and the exported tables. The SDK stubs, libraries
  and plumbing were classified from their imports, strings and callers.
- **Script commands.** The interpreter's dispatch (0x77790: first-letter jump table at 0x350bd6, then comparison
  trees and nested jump tables on the next three letters) was simulated from the listing for all 94 command names
  the scripts use.
- **Running it.** The web port was checked in the browser at the affected script positions. The native PC build was
  run headless in a sandbox (temporary data root with an empty save, the patch layer, frame dumps), with and without
  scripted presses, to see the first launch. The browser profile's saves were backed up first and restored after
  (hashes checked).

## The differences, most important first

Each line names the subsystem file with the evidence. "Confirmed" means read in the instruction listing (and, where
noted, seen running); "likely" means inferred from control flow.

### Found by the re-check of the handled functions (2026-11-08)

The 406 functions left after the first pass were compared with the port. Numbered N2-1 to N2-209, most important first; N2-210 and N2-211 came afterwards from reports and are fixed. N2-212 to N2-217 came on 2026-11-09 from re-reading the 11 rendering functions that had never been re-checked ([TODO.md](TODO.md) item 11) and are fixed. "high" means story, progress or saves go wrong, "medium" visible or audible in normal play, "low" rare or subtle. Details are in each part's file under "Re-check of the handled functions". The rendering items and the split / SHOK items filed under text were fixed on 2026-11-08, and then the text items and the script machine's story-screen items (rewinds, typing, read speeds; each line says how it was checked); the others are untouched so far.

- **N2-1. ATSV moves the checkpoint only on a page's first line, and SELD never does** (medium, confirmed, re-read; `0x77790`, `0x527f0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08 (compared with a native frame).** A save made at a choice on a page with two or more lines natively resumes on that page's first line, and the player clicks through it again; the port resumes on the choice itself. Saves made after such an ATSV likewise resume later than native.
- **N2-2. RDAS is not ignored in a replay from the gallery's flowchart** (medium, confirmed, re-read; `0x77790`, `0x92580`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08 (compared with a native frame).** With Read scenes auto skip on, a replay begun from the gallery's flowchart asks Jump to Next Scene or skips the scene it was meant to show; natively the scene plays.
- **N2-3. A rewind goes back a page, not a line** (medium, confirmed, re-read; `0x814c0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08 (compared with a native frame).** One rewind in the port goes back one line; in the game it goes to the start of the page, so a page cannot be stepped through line by line.
- **N2-4. A rewind does not stop at a choice** (medium, confirmed, re-read; `0x814c0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Rewinding across a choice brings the choice back immediately in the port; in the game the screen goes to earlier text.
- **N2-5. A 1920 x 1080 clip anywhere counts as no clip** (medium, confirmed, re-read; `0x32050`, `0x36520`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** During SHOK (or a quake on the owner) a full-size panel is not cut at the moved edge; with an offset 1920 x 1080 clip the whole picture shows instead of the clipped part.
- **N2-6. Band opacity of a panel group** (medium, confirmed, re-read; `0x37ea0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** A band whose top linked layer is translucent is too faint in the port: 04_00_ARC04_9 raw op 1981 (compiled 1973; owner 31 at 255, top layer 32 at 200, style 1 width 30) shows the black band at 78% where the game shows it at 100%.
- **N2-7. Size class of pictures whose name prefix has a digit** (medium, confirmed, re-read; `0x38730`, `0x388d0`, `0x38a70`, `0x38bc0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** An SBAS child of such a parent uses k = 1 instead of the parent's 0.5 or 0.25: its coordinates, measured from the parent picture's origin, are 2 or 4 times too large (the port computes x - pivot where the game computes x * k - pivot, so the child lands well away from its place, possibly on the other side of the pivot), and it is drawn 2 or 4 times too large. Examples: 04_00_ARC04_6_1 raw op 1522 (child of Z20_L_10_00_N00), 08_01_CIEL08_1D raw op 1300 (child of Y00_M_00_00_N00). 10 calls have an L parent (2x), 3 an M parent (4x); no S parent occurs.
- **N2-8. Opacity of the >> while skipping runs** (medium, confirmed, re-read; `0x3b5f0`, `0x3b5b0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames and corrected 2026-11-09.** The skip icon is at 60% in the port during normal skipping where the game shows it solid.
- **N2-9. Rewind icons missing** (medium, confirmed, re-read; `0x3b5f0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames and corrected 2026-11-09.** No << or |<< at the top right while the player rewinds or returns to the previous scene.
- **N2-10. Notice popup speed** (medium, confirmed, re-read; `0x3c970`, `0x3b4b0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** The Auto, Skip, Auto Save and Quick Save notices come and go about 2.5 times too fast.
- **N2-11. Blurred name missing from the picture table leaves the layer empty** (medium, confirmed, re-read; `0x60840`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** The port draws a blurred picture the game does not draw: layer 33 at alpha 255 in 05_01_CIEL05_2_2B, layer 32 at alpha 133 in 14_01A_CIEL14A_1, layer 25 in 14_01B_02_CIEL14B_3B; the other two start at alpha 0.
- **N2-12. STBR's third argument is ignored** (medium, confirmed, re-read; `0x62490`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** Layers get the second argument's blend instead of the third's: for example 13,8,0 draws without alpha instead of normally, 22,19,0 uses hardlight instead of a normal draw, and 18,1,28 uses ps_add instead of add.
- **N2-13. A blurred layer's STPV pivot lacks the blurred picture's offset** (medium, confirmed, re-read; `0x639a0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** A blurred layer given an STPV pivot sits down and right of its place by the blur margin: 12 px at 04_04, 24 px at 08_08, 36 px at 20_20, more for tall one-axis blurs (IMG0067_00_44: 72 px down).
- **N2-14. Speed lines stay on after Return to Title / a new story** (medium, confirmed, re-read; `0x86470`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** After Return to Title during an FCLN..FCSP stretch, gfx.lines keeps its last FCLN and is drawn over the next story begun with New Game or a flowchart / gallery scene, until the next FCSP or FCLN or a load (a load replaces it). The game has the lines off at once.
- **N2-15. Layer effects are fixed when the picture is loaded; the port re-applies STEC, SNX2/SNX3 and motion brightness/contrast at every draw** (medium, confirmed, re-read; `0xa3180`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** (a) An effect command on a picture already on screen takes effect at once in the port and not at all in the game: QA_01 STEC(13, 1, 0x000000) turns layer 13 (img2519) into a black silhouette for the 2.4 s of WTTM(2400) where the game keeps the picture. (b) STCH or SCH2 of the picture already on the layer with other values: 14_01A_CIEL14A_2 img0542 plain in the port where the game keeps its earlier SNX2 / SNX3 +32 bake; 07_01_CIEL07_2_2 img2229 without the SNX2 255 of its first STCH; 13_01_02_CIEL13_6_2 SCH2(38, noe_l_60_03_a03, source 37) takes the source's effect 0 in the port where the game keeps its preset 71 bake. (c) Tracks' brightness and contrast keys change a picture every frame in the port and not in the game after the first bake, as in the original claim's examples.
- **N2-16. STTR wipe also multiplies the layer by its alpha** (medium, confirmed, re-read; `0xa6e90`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** During an STTR wipe on a layer with no panel, the part already revealed is see-through in proportion to the alpha instead of solid: halfway through the alpha tween it is half transparent. The two agree only at alpha 1.
- **N2-17. Hazed layers: partial alpha counted twice** (medium, confirmed, re-read; `0xb24f0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** Under STRA (heat haze) pictures with partial alpha are brighter or stronger in the port than in the game: at a = 0.5, A = 1, the game's colour term is half the port's (0.25 s against 0.5 s) for a normal layer, and a blend layer gets a weaker source natively (ps_dodge5 uses 1 - ao * s * a). Hard-edged sprites barely change (0.5% partial pixels); soft effect pictures such as IMG2230, IMG2270, IMG0606, IMG0604 (32-50% partial pixels) look noticeably different while hazed.
- **N2-18. The port pops up 'Skip', the game never does** (medium, confirmed, re-read; `0x3b430`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Turning fast forward on shows a 'Skip' banner at the top left that the game does not show.
- **N2-19. @e@n waits for the voice natively** (medium, confirmed, re-read; `0x6e0d0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Each part of these split voiced lines is cut off as soon as its text has typed, and the next part starts over it.
- **N2-20. @g lines use the game's second typeface** (medium, confirmed, re-read; `0xbdc2c`; [text](function-map/text.md)). **Fixed 2026-11-08 (compared with a native frame).** The 131 lines that start with @g (for example the chase scene, text 4478-4525, 'That is, until I cross paths with her.') are set natively in italics (ASCII letters slanted 0.31 in the same font); the port draws them upright like any other line.
- **N2-21. Balloon messages use the game's third typeface** (medium, confirmed, re-read; `0xbdc2c`; [text](function-map/text.md)). **Fixed 2026-11-08 (compared with a native frame).** Text in the balloons (the Q&A corners) is natively in the third face, a different look from the story window; the port shows it in the story serif.
- **N2-22. Runs of U+25A0 are not one bar** (medium, confirmed, re-read; `0xbdc2c`; [text](function-map/text.md)). **Fixed 2026-11-08 (compared with a native frame).** Censored words ('I would have ■■■ it right away.') are one stretched glyph in the game and a row of separate squares in the port.
- **N2-23. Title music fades use the rate as a time** (medium, confirmed, re-read; `0x9c9b0`; [sound](function-map/audio.md)). **Fixed 2026-11-09 (compared with native frames).** After pressing a button on the first title screen the music is gone in 0.5 s instead of 3.33 s, so it no longer carries into the cautions; on New Game and Continue it lasts 0.39 s too long.
- **N2-24. Fast forward and the skip toggle play one-shot sound effects; the game drops them** (medium, confirmed, re-read; `0x9cf90`; [sound](function-map/audio.md)). **Fixed 2026-11-08 (compared with a native run).** Holding fast forward or turning skip on over read text, the port plays every one-shot effect it passes (footsteps, doors, impacts in quick succession); the game passes them silently. seLast also differs afterwards, which changes the rate of later delayed volume changes.
- **N2-25. Sound system master scale 127/96 missing** (medium, confirmed, re-read; `0xedd28`, `0xee110`, `0xee200`, `0xee5ec`, `0xee6b4`, `0xeea34`; [sound](function-map/audio.md)). **Fixed 2026-11-08 (compared with a native run).** Every sound plays 2.43 dB quieter than native (see 0xee110).
- **N2-26. Replaying Glass Moon from the gallery's flowchart runs the wrong script** (medium, confirmed, re-read; `0x42680`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (compared with a native run).** Choosing the first node of the gallery's flowchart plays the opening movie instead of the text prologue.
- **N2-27. Two replays lack the variable the jump script sets, and play another scene** (medium, confirmed, re-read; `0x42680`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (from the listing and the browser; no native frame).** Selecting either 'I'll figure it out in the hall' node in the gallery's flowchart does not show that scene; the next script plays instead, until its RDED ends the replay.
- **N2-28. Opening the system menu leaves skip on, its icon over the menu** (medium, confirmed, re-read; `0x47bf0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (compared with a native run).** With skip on, opening the system menu stops skipping in the game: the >> goes and after closing the menu the text waits. The port shows the >> on top of the menu's header and resumes skipping when the menu closes.
- **N2-29. The title logo is back at full at once after the title's Config** (medium, confirmed, re-read; `0x4bcf0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** After closing Config at the title the logo, its light and the dust are there at once; in the game the logo has gone and comes back over about 2 s after the background has lowered.
- **N2-30. Save / Load screen has no fade; a column choice cuts to the next screen** (medium, confirmed, re-read; `0x4d340`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** Save and Load appear and vanish in one frame; in the game they fade in over about 42 frames and out over about 21, and a column choice, Back or a load waits for the fade-out. The list takes keys during what would be the fade-in.
- **N2-31. Return to Title does not wait for the Auto Save popup** (medium, confirmed, re-read; `0x4d710`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (compared with a native frame).** Return to Title with an automatic save written: the game shows the menu fading out (30 frames) with the popup, about 100 frames before the black starts (about 50 if hurried by a press); the port cuts the menu and starts the black at once, reaching the title about 100 frames sooner.
- **N2-32. Return to Title skips the close fade and stops the music late** (medium, confirmed, re-read; `0x4d7e0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** Return to Title: the menu vanishes in one frame instead of fading over 30; the text window stays up into the black instead of closing within about 8 frames; the music plays through the black and stops as the title appears, where the game cuts it before its black begins (from the press: about 20 frames later than the game with no automatic save written, about 50 earlier with one).
- **N2-33. Flowchart from the menu: no 12-frame fades, Back replays the opening** (medium, confirmed, re-read; `0x4d8c0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** Going to the FlowChart cuts instead of fading over 12 frames, and coming back replays the whole menu opening (18 frames, bands over 60) instead of a 12-frame fade of the foreground over a background that stayed up.
- **N2-34. Panel key cursor starts on a different button** (medium, confirmed, re-read; `0x4dd00`; [title, saves](function-map/title-menus-saves.md)). Opening the panel by keyboard or pad: the game starts on the fourth button (Fast Forward) and later openings keep the last one; the port always starts on the third (Auto), so Up then confirm toggles a different mode.
- **N2-35. Panel buttons sit 12 px lower and 4 px right** (medium, confirmed, re-read; `0x4de10`; [title, saves](function-map/title-menus-saves.md)). The eight buttons appear 12 px lower and 4 px further right on the bar than in the game: their art spans y 32-87 in the 96 px bar where the game's spans 20-75 and is centred. Hit areas move with them.
- **N2-36. The title's Load and SELA's save screen raise the menu background at 0.024 a frame** (medium, confirmed, re-read; `0x50e00`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** The title's Load shows bg_backlog at once where the game shows the menu's sky rising over about 42 frames; SELA's save screen has it at full from the first frame.
- **N2-37. Saved records do not get F1118 set, so Save Progress is asked again after a load** (medium, confirmed, re-read; `0x52aa0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (compared with a native frame).** A save made at a chapter opening's checkpoint (F1118 still 0 from the previous chapter's end), including one made through Save Progress? itself, asks Save Progress? again each time it is loaded in the port; the game does not ask.
- **N2-38. Title menu rows fade with the logo, not on their own 60-frame timer** (medium, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** On every fresh title entry the rows are fully drawn by frame 60 in the port (dimmed only by the black cover). In the game they are at 0.04 at frame 83, 0.11 at frame 100, 0.28 at frame 120 and reach full alpha with the logo at about frame 162.
- **N2-39. White cover lacks its additive second pass** (medium, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** The New Game fade to white is dimmer in the port at every step: a dark title reaches full white at w of about 0.67 (67 frames at 0.01 a frame) in the game, and at w = 1 (100 frames) in the port.
- **N2-40. First-launch background drawn too large and too low** (medium, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** On the press-any-button screen the background is 6% larger than in the game and its centre sits about 32 pixels lower.
- **N2-41. Press-any-button drawn 37 pixels too low and pulsing from the start** (medium, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** The prompt sits 37 pixels lower than in the game, and it is already pulsing during the fade in, where the game shows nothing until the fade has finished.
- **N2-42. First-launch screen has no logo fade and no particles** (medium, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** On the first-launch screen the logo is present from the first frame with no particles; in the game it fades in piece by piece from about frame 42 to about frame 162 with dust and shards rising.
- **N2-43. Cautions end in a cross-fade to white, with the additive pass** (medium, confirmed, re-read; `0x902f0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** After the second caution the game cross-fades straight to white and holds it about 20 frames. The port fades the caution out on its own, then takes 100 frames to bring up white, about 120 frames in all before the story starts.
- **N2-44. Quick Jump keeps the scene points it jumped over** (medium, confirmed, re-read; `0x28d50`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Closed 2026-11-10: fixed with N2-76 (`vm.js` `restore`).** After a Quick Jump to before a scene start, Return to Previous Scene in the port goes to the scene start the player jumped back over, which is ahead of the current line, where the game goes to the one before the current line.
- **N2-45. Right from the column lights the System tab on a first opening** (medium, confirmed, re-read; `0x2c6e0`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-09 (compared with native frames).** On the first config opening of a run the game shows the cursor on row 0's first widget from the end of the fade-in, and every key acts from there; Left to the column then Right returns to that widget. The port opens with nothing lit, ignores A, Up and Right at first, and Right from the column lights the System tab with its caption.
- **N2-46. Default on Yes fades the whole config in again** (medium, confirmed, re-read; `0x2c810`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** After confirming Default the config's panel, tabs and page vanish and fade back in over about 42 frames, and from the title the menu background does too; in the game the values just change in place. Keys wait for the fade.
- **N2-47. Help bar labels use measured rectangles, so later items sit too far left** (medium, confirmed, re-read; `0x4a8f0`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). Items after the first label drift left of the game's: by the bar's end 123 px on Config (screen 2), 91 on save and load, 89 on the backlog, 160 on screen 6. Labels also sit lower: 1 px by the rectangles and about 2 px in the frames for most labels, 5 px for label 26 (Scroll).
- **N2-48. The answer acts only after the window has closed** (medium, confirmed, re-read; `0x4ad40`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** After an answered system dialog the next step starts about 15 frames (0.25 s) later than in the game, and the question does not cross-fade with the Saving / Loading notice.
- **N2-49. Story question and Save Progress? text and buttons hidden while fading** (medium, confirmed, re-read; `0x85900`, `0x85e40`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** The question and its buttons pop in after the 10-frame fade and vanish before the fade out; in the game they fade with the window.
- **N2-50. Story question and Save Progress? text size** (medium, confirmed, re-read; `0x85900`, `0x85e40`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** The hint corner question reads about 1.5 times the game's size.
- **N2-51. Buttons react to the mouse without a press** (medium, confirmed, re-read; `0xae840`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** In the port a button lights and plays the cursor sound as the mouse passes over it (title, menus, config, save lists, SELS / SELA); in the game nothing changes until the left button is down.
- **N2-52. flow_bg stops at y 1022** (medium, confirmed, re-read; `0xf8fc`; [flowchart](function-map/flowchart-widgets-tweens.md)). The strip y 1022-1079 behind the help band is dimmed by flow_bg (alpha about 0.8) in the port and not in the game, so the band looks far darker. Native frame nat3 03428: row 1021 (0,0,0), rows 1023-1079 about (47-61, 89-101, 116-126); port frame web_i0: about (3,35,60) in those rows.
- **N2-53. Flowchart node selection follows the mouse without a press** (medium, confirmed, re-read; `0x12424`; [flowchart](function-map/flowchart-widgets-tweens.md)). With a mouse the cursor jumps to a node, the preview changes and the cursor sound plays as the pointer crosses the chart; in the game nothing changes until the left button is down. One click opens the rewind question or a gallery replay in the port; the game takes one click to select and a second to decide.
- **N2-54. A rewind from the flowchart cuts instead of closing** (medium, confirmed, re-read; `0x17cac`; [flowchart](function-map/flowchart-widgets-tweens.md)). On Yes to a rewind the chart vanishes and the chosen scene starts at once; the original fades the chart out over 0.5 s, then takes another 30 frames (0.5 s) with the menu background fading before the scene starts.
- **N2-55. Movie picture has no 0.05-a-frame fade in and no 30-frame fade out** (medium, confirmed, re-read; `0x17c0`; [gallery](function-map/gallery-cg-music-movies.md)). In the Movie gallery, a press mid-movie or the end of op1_arc / op2_ciel cuts to black where the game fades the picture over half a second, and the gallery comes back about 33 frames sooner. Story movies (TOMP) show no such cut: their cover is already opaque when the picture stops, on both sides, so only their end comes about 33 frames sooner, unseen. The fade in is hardly seen: title movies rise slightly more slowly under the title's own fade from black.
- **N2-56. Gallery does not reopen on the section it was left on** (medium, confirmed, re-read; `0x49b0`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Leave the gallery with Back from the Music Player, Movie or Ending List and open it again from the title: the game reopens that section with its row marked; the port opens the CG Gallery.
- **N2-57. Replays start at once, without the gallery's half-second exit** (medium, confirmed, re-read; `0x5040`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Yes on an ending, or Decide on a scene in the gallery's flowchart, cuts straight to the story with the music cut; the game fades the column or a black cover and the music over half a second first.
- **N2-58. Column window, inner panel and underline are placed differently** (medium, confirmed, re-read; `0x6124`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** On every gallery page the column's moon picture sits 82 px lower than in the game and is cut off at the bottom, the right-hand panel starts 5 px further left, and the underline is 1 px higher.
- **N2-59. After an Ending List replay the list does not come back on the ending played** (medium, confirmed, re-read; `0x6934`, `0x7f38`; [gallery](function-map/gallery-cg-music-movies.md)). After a replayed ending the game puts the cursor back on that entry of the Ending List; the port leaves it on the column with no entry selected.
- **N2-60. Choosing the open section reopens it** (medium, confirmed, re-read; `0x6e28`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Pressing Choose on the row of the section already open, where the cursor starts when the gallery opens, enters it at once in the game; a click on that row only plays the sound. In the port both fade it out and in, replay the grid's cascade, lose the grid position, stop a playing track and put the cursor in the section.
- **N2-61. The section and band come back half a second early after the Flowchart closes** (medium, confirmed, re-read; `0x7624`; [gallery](function-map/gallery-cg-music-movies.md)). Back from the Flowchart: the section's title, the thumbnails' cascade and the help band appear during the 0.5 s the flowchart fades out, instead of after it has gone.
- **N2-62. No fade to black before a Flowchart replay starts** (medium, confirmed, re-read; `0x7918`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Choosing a scene in the gallery's Flowchart cuts straight to the replay instead of going to black over half a second.
- **N2-63. A replay from the Ending List starts without the column's fade** (medium, confirmed, re-read; `0x7ac4`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Yes on an ending's question cuts straight to the episode instead of fading the column out over 0.5 s.
- **N2-64. The old grid is removed at once when a sub-grid opens or closes** (medium, confirmed, re-read; `0x8ba0`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Choosing an entry with several pictures, or Back from its sub-grid: the game crossfades the old thumbnails out under the new cascade; the port blanks the grid and the new one fades in from nothing.
- **N2-65. Closing the viewer from a one-picture entry does not keep the main grid's scroll** (medium, confirmed, re-read; `0x9970`; [gallery](function-map/gallery-cg-music-movies.md)). After closing the viewer on a one-picture entry in a scrolled main grid, the grid jumps: to scroll 0 (cursor row near the top), or so the cursor's row sits at the bottom (y 804) when it is below row 5.
- **N2-66. Back from an episode the list has lost its cursor** (medium, confirmed, re-read; `0xd5e8`; [gallery](function-map/gallery-cg-music-movies.md)). After an Ending List episode the game returns with the cursor on the entry just played; the port returns with the cursor on the column and no entry selected (the first entry once the list is entered again).
- **N2-67. Row look: opaque colours instead of 0.5 alpha** (medium, confirmed, re-read; `0x1a1a4`, `0x1b2f0`, `0x1b43c`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Rows other than the cursor's are noticeably brighter in the port than the game's half-transparent white; the selected row has a glow the game does not.
- **N2-68. The list scrolls at different rows** (medium, confirmed, re-read; `0x1b2f0`; [gallery](function-map/gallery-cg-music-movies.md)). Holding Down or Up, the list starts scrolling one row later in the port and the row beyond the cursor is not shown.
- **N2-69. A tap on a row that is not selected plays it at once** (medium, confirmed, re-read; `0x1b5b4`; [gallery](function-map/gallery-cg-music-movies.md)). One tap, or one left click, on a row that is not selected starts the track in the port. In the game the first press only moves the cursor there (sound 0) and a second press plays it. A mouse is affected too: on PC a left click is a touch, and the game has no hover to select the row first.
- **N2-70. Repeat off after a loop does not start the fade** (medium, confirmed, re-read; `0x1c400`; [gallery](function-map/gallery-cg-music-movies.md)). Turning Repeat off after a track has looped: in the game it fades out over 1.5 s at once and the panel clears; in the port it plays on to the end of the loop before fading.
- **N2-71. Entering the panel does not start on Play** (medium, confirmed, re-read; `0x1d5ec`; [gallery](function-map/gallery-cg-music-movies.md)). After the volume has been used once in a visit, Right from the list lands on Prev or Next instead of Play.
- **N2-72. A tap on a button not under the cursor presses it at once** (medium, confirmed, re-read; `0x1e7d4`; [gallery](function-map/gallery-cg-music-movies.md)). One tap, or one left click, on a button not under the cursor presses it in the port. In the game the first press only moves the cursor to it and a second press runs it. A mouse is affected too, since on PC the left button is a touch.
- **N2-73. Play glyph goes out while paused** (medium, confirmed, re-read; `0x1f380`; [gallery](function-map/gallery-cg-music-movies.md)). While a track is paused the game shows Play and Pause both lit; the port shows only Pause.
- **N2-74. Instant run does not stop the sound at its start, so a TOMP that ends the run leaves the old music and loops playing** (medium, confirmed, re-read; `0x6ef30`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-08 (compared with a native run).** Music and ambience loops that were playing when the run started keep playing under the movie (and after it in 00_02 and 15_01A_CIEL15A_1; the other five that can have sound end at the movie with RDED, RTM_), where the game is silent until the script's next MPLY / SEPL. TOMP 36 is followed at once by MPLY 119, so that movie has music in both and only the loops differ. At the run's other stops 0x5d7e0's 0x9c470 finds number -1 and starts the recorded track from its top, where audio.js restore (no restartMusic) keeps it going. A voice playing at the run's start is cut natively (0x9c3b0); in the port it goes on only with 'Voices stop on input' off, with F1123 set, or when the run starts during typing, because from a click wait beginInstant -> advance() ends waitAdvance, which stops it (vm.js:1024).
- **N2-75. History holds 800 records of every type, not 800 waits** (low, confirmed, re-read; `0x5a910`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run and corrected 2026-11-09 (TODO item 51).** The port can rewind and Quick Jump several times further back than the game's history reaches.
- **N2-76. Rewinding past an ATSV does not drop its Return to Previous Scene point** (low, confirmed, re-read; `0x5baf0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** After rewinding out of a scene, Return to Previous Scene can go forward to the scene the player rewound out of, and the two-line window counts from the old point.
- **N2-77. Quick Jump types the line again** (low, confirmed, re-read; `0x5baf0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** After a Quick Jump the game types the chosen line out again; the port shows it whole at once.
- **N2-78. SELR's blank row before the next line** (low, confirmed, re-read; `0x77790`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** The first line after a choice that continues the same page has one blank row above it natively and none in the port.
- **N2-79. Replay Voice target ignores VPL2 and clicks** (low, confirmed, re-read; `0x77790`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08 (compared with a native frame).** After moving past a voiced line, or after a VPL2 line, native Replay Voice still plays the last voice; the port's button is off or plays an older one. One MSG record after VPL2 + MSAD (14_01_CIEL14_1C, $037545) loses its voice.
- **N2-80. Choice rows type at the last message's speed** (low, confirmed, re-read; `0x77790`, `0x3b2d0`, `0x4ea30`, `0x4ec60`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run and corrected 2026-11-09 (TODO item 51).** When a choice's own read state differs from the line before it, the labels type at the other speed (35 ms or 15 ms a letter by default).
- **N2-81. Holding fast forward does not stop the voice** (low, confirmed, re-read; `0x802c0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08 (compared with a native frame).** A line's voice goes on under ZR / Control until it ends; in the game it is cut as soon as the key is held.
- **N2-82. A held advance key repeats** (low, confirmed, re-read; `0x802c0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Holding Space, Enter or Down finishes typing and advances at the keyboard's repeat rate; the game does nothing further until the key is pressed again.
- **N2-83. The instant run's end does not settle earlier lines' dimming** (low, confirmed, re-read; `0x802c0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run and corrected 2026-11-09 (TODO item 51).** When a read-scene skip stops part way down a page, earlier lines fade down over a fraction of a second instead of being dim already.
- **N2-84. The rewound line is typed again** (low, confirmed, re-read; `0x814c0`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08 (compared with a native frame).** The rewound line appears at once in the port and is typed again at the read speed in the game.
- **N2-85. Auto wait restarts after the system menu** (low, confirmed, re-read; `0x81b30`; [script machine](function-map/script-machine-state.md)). **Fixed 2026-11-08; compared with a native run and corrected 2026-11-09 (TODO item 51).** With auto mode on, opening and closing the menu makes the current line wait up to a full auto delay again instead of its remainder.
- **N2-86. SHOK period floored to whole frames** (low, confirmed, re-read; `0x2ee70`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** A shake whose period is not a whole number of frames oscillates faster and ends earlier: 80 ms x 10 lasts 48 frames natively and 40 in the port (wave 4.8 against 4 frames), 110 ms x 10 lasts 66 against 60.
- **N2-87. SHOK with count 0 still shakes in the port** (low, confirmed, re-read; `0x2ee70`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** One short jolt of up to about 17 px at 1080p (y 7: 22.5 px amplitude, decaying to 0 over the single 4-frame period) appears where the game has none, or a running shake restarts instead of stopping.
- **N2-88. A delayed SHOK cuts off the shake already running** (low, confirmed, re-read; `0x2ef30`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** The screen goes still for the length of the delay where the game keeps shaking, for example 500 ms in 05_01_CIEL05_2_2_1 op 653.
- **N2-89. SHOK delay counts 16 ms a tick** (low, confirmed, re-read; `0x2ef30`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** Long delays start early in the port: 1 frame at 500-800 ms, 2 at 850-1000, 3 at 1300-1500, 5 at 2200, 9 at 3900.
- **N2-90. A restore keeps a running SHOK** (low, confirmed, re-read; `0x2ef30`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** Loading, rewinding or jumping back to a wait taken while a shake ran continues that shake (up to about a second), where the game shows none.
- **N2-91. Tweens last longer than nominal because of the integer step** (low, confirmed, re-read; `0x329f0`, `0x3c970`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** Fades end later in the game than in the port and scripts waiting on them resume later: 1 frame for most lengths, 800 ms 49 / 48 frames, 3000 ms 187 / 180, 5000 ms 316 / 300, 7000 ms 456 / 420, 10000 ms 683 / 600, and the one 40000 ms fade 4096 / 2400 frames.
- **N2-92. Shake and sway follow parents and links in the port only** (low, confirmed, re-read; `0x34440`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** A shaken or swaying SBAS child takes its root-most ancestor's motion instead of its own (visible for SSW2, whose random numbers are per layer natively, and for children with other arguments). A SACL layer linked to a panel that has the same effect gets none in the port (07_00_ARC07_1_2 op 1189: seven layers stay still, up to about 16 px at 1080p, where the game moves them by their own shake); a non-SACL one would move with the panel only, where the game adds its own as well.
- **N2-93. Grain orientation steps differently** (low, confirmed, re-read; `0x35fc0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** The static changes orientation every frame and flips vertically in the port; in the game it mirrors across every 2 frames (n = 11) or 3 frames. Subtle, as the position is random each frame either way.
- **N2-94. Band style and width when the top layer did not copy them** (low, confirmed, re-read; `0x37ea0`; [rendering](function-map/rendering-effects-animation.md)). **Not reproduced 2026-11-08: native frames show the band whatever the last layer is; no change in the port.** While the group's top layer in z order is at alpha 0 or SACL and has no style of its own, the game draws no band and the port does.
- **N2-95. Parent pivot y scale** (low, confirmed, re-read; `0x388d0`, `0x89420`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** An SBAS child sits about 1 px off vertically at zoom 1 for a parent 720 stored pixels tall (90.667 against 90.5 engine units), about 2 px for 1449.
- **N2-96. >>| shown for a held fast forward** (low, confirmed, re-read; `0x3b5f0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** The port shows >>| while Control or ZR is held where the game shows >>.
- **N2-97. STTR wipes whose rule picture the next FADS frees** (low, likely, re-read; `0x4b4c0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** In these 9 wipes the port shows the RULE_nn pattern while the game has no rule picture; what it shows instead depends on texture descriptor 0x3f and needs a native frame capture (longest: 08_01_CIEL08_4_2 op 340, 1600 ms).
- **N2-98. Old frame of a transition keeps the SHOK offset** (low, confirmed, re-read; `0x4b740`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame, after a correction: see the evidence).** A FADS started while an earlier SHOK still runs fades from a picture displaced by the shake's offset at that frame; in the game the old picture sits still.
- **N2-99. STCH from a blurred source with blank blur arguments** (low, confirmed, re-read; `0x60840`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** QA_20: layer 28 (img2472, z 518, zoom 737) is IMG2472_04_04 in the game, 4,4 blurred with that entry's size and pivot; the port draws it sharp until the layer is cleared.
- **N2-100. A load restarts the speed lines, the port continues them** (low, confirmed, re-read; `0x86470`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** After loading a save made inside a speed-line scene, types with more than one phase go through their first phase again in the game (18-20, 23, 26, 27, 29, 32 for 0.15-0.4 s) while the port stays in the later phase.
- **N2-101. Speed-line batches come every whole frames, not every interval ms** (low, confirmed, re-read; `0x86850`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** The lines re-randomise about 1.7 times too often in the 20 ms types and slightly too often for 30 and 32 ms (50 ms types match), and appear 1-2 frames early: only the flicker of the speed lines.
- **N2-102. SQK2 -1 quakes a layer 0 or 1 that is only staged** (low, confirmed, re-read; `0x91540`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** In these scenes the port's layers rumble (x 0-3, y 1-9 units) where the game's stay still.
- **N2-103. Spline solve subtracts 1 instead of the previous term** (low, confirmed, re-read; `0x972c0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** Mode-1 motions with four or more points follow a slightly different path: up to about 7 script units (28 px) of x or y at mid-segment, 2.9 degrees of rotation, 9/1000 of zoom, 7/255 of alpha.
- **N2-104. Spline points chosen from raw key values** (low, confirmed, re-read; `0x972c0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** The same channels get fewer points in the port, which moves the moments of the segments around them; included in the path differences above.
- **N2-105. Mode panel slides out on the wrong curve** (low, confirmed, re-read; `0xe1bfc`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08; compared with native frames 2026-11-09.** Each time the mode panel closes, the bar leaves on the mirrored timing: at the half-way frame the game's bar is still 26 px up from its rest while the port's is already 78 px up (out of 104). Opening matches.
- **N2-106. A preset change while the split is on takes its new strength at once** (low, confirmed, re-read; `0x2e280`, `0x2e3e0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** The split's offset differs for up to 5 frames after the FADE, once in the game: by up to about 3.1 px red and green and 6.2 px blue if the change falls in the split's first 3.3 s (the wobble lap), at most 1.2 px and 2.4 px after it (at 1920 wide).
- **N2-107. Restore restarts the split instead of continuing it** (low, confirmed, re-read; `0x2e430`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** After a load, rewind, Quick Jump or Return to Previous Scene inside a FADE 40 split the native pulse and swing restart from their beginning (with the large first-lap wobble for 200 frames); a level-0 split loaded in a fresh session fades in over 60 frames where the port shows it at once; a point saved in the 60 frames after a FADE 41 shows no split natively where the port finishes the fade.
- **N2-108. Split left on across a new story** (low, confirmed, re-read; `0x2e430`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Leaving the story during a split (Return to Title, or a gallery replay ending inside one) and starting New Game, a chapter or a replay keeps the RGB split on the new story until its next FADE 41 or a load.
- **N2-109. SHAF stops a running SHOK** (low, confirmed, re-read; `0x2e560`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** A screen shake still running when the next scene's SHAF comes ends at once natively and runs on in the port for its last frames.
- **N2-110. pageEnd is cleared after a page's wait but F799 stays 1 for the MSAD that follows** (low, confirmed, re-read; `0x38ea0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** QA_20, the voice-only _MSAD() at op 1943: auto mode goes on after 2.2 s instead of 3 s (defaults), and with Display whole text on the game waits for a click where the port does not. The mark is the same (F1105 = 7, the balloon mark ignores F799).
- **N2-111. The page mark blinks off for its last cell** (low, confirmed, re-read; `0x38ec0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** The page-end mark disappears for 2 frames (33 ms) at the end of every 3.5 s loop; in the game it stays on screen.
- **N2-112. Read speed after a restore** (low, confirmed, re-read; `0x3b2b0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** After a rewind to a page's first line followed directly by an MSAD, the MSAD types at the read speed (15 ms a letter by default) natively; the port uses the speed of the last message typed (35 ms when that one was unread). After a load, Quick Jump or Return to Previous Scene the native MSAD follows the re-run MSG's read state; the port keeps the speed left over (unread speed in a fresh session), so they differ only when that MSG counts as read.
- **N2-113. Popup scales from its vertical centre** (low, confirmed, re-read; `0x3b4b0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** While the spring's y scale is off 1 (1.4 to 0.8) the banner's top moves by up to 11 px instead of staying at y 77.
- **N2-114. A blank message takes no row in the port** (low, likely, re-read; `0x6e0d0`; [text](function-map/text.md)). **Fixed 2026-11-08 (compared with a native frame).** The MSAD's text runs on from the previous line instead of starting its own row.
- **N2-115. Two-frame hold before typing starts** (low, confirmed, re-read; `0xa7790`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run and corrected 2026-11-09 (TODO item 51).** Each line set by MSG (ZM) on a window that is already up starts about two frames (33 ms) earlier than the game's. MSAD continuations and lines on a window still fading in are unaffected.
- **N2-116. Row volume 0 plays no voice, so voice waits pass** (low, confirmed, re-read; `0xaa970`, `0x9c300`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** With a character's slider at 0 and the row not muted, scripted VCWT waits, @e waits and auto mode do not last the silent voice's length for that character's lines.
- **N2-117. A pair of spaces types as two letters** (low, confirmed, re-read; `0xab4d0`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Each double space delays the rest of its line by one letter interval (35 ms at the default speed).
- **N2-118. A dash or block run types as one letter** (low, confirmed, re-read; `0xbd7ec`, `0xbdc2c`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Each run delays the rest of its line by (length - 1) letter intervals, about 2 for the usual three dashes (70 ms at the default unread 35 ms a letter, 30 ms at the default read 15 ms), and the line ends that much later.
- **N2-119. Runs of U+2014 are not joined** (low, confirmed, re-read; `0xbdc2c`; [text](function-map/text.md)). **Fixed 2026-11-08 (compared with a native frame).** Em dash runs such as 'her——someone' and '———Foolish.' are separate dashes in the port and one solid line in the game.
- **N2-120. Ruby annotation appears at once instead of across its base** (low, confirmed, re-read; `0xc1fdc`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run and corrected 2026-11-09 (TODO item 51).** A reading such as 'prey' over 'woman' shows complete when the first base letter appears, where the game fills it in across the base (75-175 ms for five letters at the default 15 ms read / 35 ms unread a letter).
- **N2-121. The next unmarked line on a page takes the previous line's colour** (low, confirmed, re-read; `0xc35b4`; [text](function-map/text.md)). **Not reproduced 2026-11-08: native frames show the line after a coloured line in the normal white (texts 19508-19510, with @n and with clicks); no change in the port.** An unmarked line right after a line with @c1-@c4, with no page end between, is drawn in that colour while it is the current line (red, blue or grey in the scenes below); the port draws it in the normal colour.
- **N2-122. A wrap break the port takes out types as a letter** (low, confirmed, re-read; `0xc5610`; [text](function-map/text.md)). **Fixed 2026-11-08; compared with a native run 2026-11-09 (TODO item 51).** Each break the port takes out delays the rest of its line by one letter interval: 35 ms at the default speed, 15 ms on read text, 35 ms per removed break on a line of several rows, and the line finishes typing that much later. Replacing the break by a space is recorded (NATIVE-PARITY.md:131); its typing cost is not, and textbox.js:235 states line breaks are no letters.
- **N2-123. Delay countdown stops while a UI page is open** (low, confirmed, re-read; `0x65e50`; [sound](function-map/audio.md)). **Fixed 2026-11-09 (compared with a native run).** A delayed sound effect, fade or volume change waiting when the player opens a menu acts behind the menu natively, and only after the menu closes in the port (delays of 20 to 8000 ms).
- **N2-124. Fast forward runs delayed sound commands at once** (low, confirmed, re-read; `0x66200`; [sound](function-map/audio.md)). **Fixed 2026-11-08 (compared with a native run).** While fast-forwarding, a delayed one-shot is heard at once in the port and not at all natively, because the delay ends within a few frames with fast forward still on. Delayed fades and volume changes differ by at most eight frames.
- **N2-125. Line with a muted speaker stops the voice still playing** (low, confirmed, re-read; `0x9c300`; [sound](function-map/audio.md)). **Fixed 2026-11-09 (compared with a native run).** A line spoken by a character whose voice is switched off cuts the previous line's voice; natively that voice plays to its end. An earlier voice can still be playing with Voices stop on input off (main.js:87 default on), in F1123's scene 09_01_CIEL09_1_1, or after a voiced @n line.
- **N2-126. Voice wait covers both handles, not the newest voice** (low, confirmed, re-read; `0x9c400`; [sound](function-map/audio.md)). **Fixed 2026-11-09 (compared with a native run).** A VCWT after a VPL2 whose predecessor is still playing waits for the longer of the two; natively it ends with the newest voice.
- **N2-127. Script end cuts the track still fading on the other handle** (low, confirmed, re-read; `0x9c650`; [sound](function-map/audio.md)). **Fixed 2026-11-09 (compared with a native run).** The end of a crossfade is cut off when a load, Quick Jump, Return to Previous Scene or Return to Title happens while the old track is still fading.
- **N2-128. Title Load and ending replay cut the music at once** (low, confirmed, re-read; `0x9c9b0`; [sound](function-map/audio.md)). **The title's Load fixed 2026-11-09 (its fade to black compared with native frames, the music with the code); the ending replay is still open.** The music stops abruptly instead of falling over about a second (Load) or half a second (replay).
- **N2-129. Voice Test shares interface sound slot 0** (low, confirmed, re-read; `0xee6b4`, `0xee9a8`; [sound](function-map/audio.md)). On the Sound page a voice sample is cut by the next interface sound that lands on slot 0 (every fourth cursor or press sound), and starting a Test or leaving the page cuts whatever interface sound that slot holds; natively the sample plays to its end.
- **N2-130. The script runs on during the read-scene skip's countdown** (low, confirmed, re-read; `0x424b0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (compared with a native run).** With Read scenes auto skip on, entering a completed scene: the port plays the one-shot sounds and the first voice that the script reaches during those frames, under the black; the game plays none of them. A voice started then keeps playing through the run (endInstant restores with stopVoice false).
- **N2-131. Engine notices drawn over the mode panel and the menus** (low, confirmed, re-read; `0x47bf0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-08 (compared with a native frame).** A notice raised with the panel down has its top 19 px over the panel's window where the game draws the window over it; a notice still up when a menu opens stays on top of the menu instead of under it.
- **N2-132. Pause menu bands fade with the menu's opacity** (low, confirmed, re-read; `0x4b880`, `0x49630`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** Opening: for the first 18 frames the bands show at n/18 of the game's alpha. Closing: 15 frames in, a band that had reached t = 1 is at 0.5 of its alpha in the port and 0.75 in the game. Seen each time the pause menu opens or closes.
- **N2-133. Cursor animation not restarted when the menu opens** (low, confirmed, re-read; `0x4cba0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** From the second opening on, the cursor line is already at full alpha and full width and the light carries on from its last level, where the game fades the line in and stretches it out over 10 frames and raises the light from nothing over 60.
- **N2-134. Load with an empty list lights the column's Save** (low, confirmed, re-read; `0x4d2d0`; [title, saves](function-map/title-menus-saves.md)). Opening Load from the system menu with no manual saves: the game shows no row lit and the cursor line fading out; the port lights Save with its caption and moves the line and light there, and Back returns to Save instead of Load.
- **N2-135. Menu accepts input during its opening and closing fades** (low, confirmed, re-read; `0x4d8c0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** A key or click within the fades moves the cursor or opens a screen, where the game ignores it until the menu is fully up, or at all once it is closing.
- **N2-136. Save rows answer to the pointer over the whole row** (low, confirmed, re-read; `0x4efe0`; [title, saves](function-map/title-menus-saves.md)). Pointing at the outer 30 px of a row, its top 22 px or the gap selects a row in the port and nothing in the game.
- **N2-137. Handing the cursor between the column and the save list** (low, confirmed, re-read; `0x50ed0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** With keys or a pad, Left does not move to the column and Right does not return to the list; the column's own button puts the cursor on the first row instead of the row last used; the Back button stays up while the column has the cursor.
- **N2-138. The 180-frame cooldown also starts after a manual save** (low, confirmed, re-read; `0x52860`; [title, saves](function-map/title-menus-saves.md)). A quick save within 3 s of a manual save is refused with sound 2 in the port and taken in the game; A on a save row within 3 s of a quick save is ignored in the game and taken in the port.
- **N2-139. An automatic save during the cooldown is not persisted** (low, confirmed, re-read; `0x52aa0`; [title, saves](function-map/title-menus-saves.md)). After Return to Title within 3 s of a quick save, the game's Continue keeps the slot number recorded before (a manual save stays the target) and the automatic save is lost on exit; the port keeps it and continues from it.
- **N2-140. Saved pictures ignore the parent's size class** (low, confirmed, re-read; `0x89190`, `0x89220`, `0x892b0`, `0x89420`; [title, saves](function-map/title-menus-saves.md)). A child of a layer showing an L or M picture is placed and scaled differently in the game's save picture than on its own screen; the port's picture shows it as on screen.
- **N2-141. Save thumbnails from the system menu capture the menu's blur** (low, confirmed, re-read; `0x89ad0`; [title, saves](function-map/title-menus-saves.md)). Every manual save made from the story's system menu stores a softened picture (a Gaussian of about 4 pixels at 1080p, about 0.6 pixel at thumbnail size); the game's thumbnails are sharp.
- **N2-142. Returning from the title's Load or Config restarts the particles and the glow** (low, confirmed, re-read; `0x8d2f0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** After closing Load or Config the port's dust and shards start again from none, taking a few seconds to build up (shards live 120-270 frames), and the light's pulse restarts from 0. In the game nothing is reset: they froze about a second after the screen opened and resume from that state as the logo fades back in over 2 s.
- **N2-143. Copyright placed 4 pixels left and 8 pixels high** (low, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). The copyright line sits 4 pixels left of and 8 pixels above its place on every title screen.
- **N2-144. Glow and particles run while the logo is at zero** (low, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). The light's pulse runs about 42 frames ahead of the game's, and up to about 40 frames' worth of extra shards are in flight as the logo first appears.
- **N2-145. A direction or confirm press does not complete the logo** (low, confirmed, re-read; `0x8d5d0`; [title, saves](function-map/title-menus-saves.md)). **Fixed 2026-11-09 (compared with native frames).** Pressing a key while the logo is still fading in snaps logo and rows to full in the game; in the port the fade continues.
- **N2-146. Dust is spawned per browser frame, not per 1/60 s** (low, confirmed, re-read; `0x90d00`; [title, saves](function-map/title-menus-saves.md)). On a 120 Hz display 8 motes per 1/60 s, the pool saturates at 200 (about 27% more dust); at 30 frames a second half as many.
- **N2-147. Touch ring centre colour interpolates from clear black, port from clear white** (low, confirmed, re-read; `0xe00`, `0xb895c`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). Inside the ring the port is brighter than the game: at half radius 0.25 versus 0.125 added light. On a white backdrop the game's disc shows as a faint grey that the port does not draw. Lasts the 0.5 s of each ring.
- **N2-148. Row 0's column is not kept across pages and openings** (low, confirmed, re-read; `0x29770`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). Leave row 0 at a column past the first by going up to the tabs, change page and come back (or close and reopen): Down from the tabs lands on the row's column in the game and on its first widget in the port.
- **N2-149. Config page scroll eases in half the frames** (low, confirmed, re-read; `0x29930`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). A scroll of a Config page by the cursor leaving the window, the stick or a drag settles in about 0.1 s in the game and 0.2 s in the port. A press or drag on the bar's strip moves the page at once in the game; the port eases it over 12 frames (ui.js:1606 seek -> ConfigScroll.set), the thumb going at once.
- **N2-150. A refused direction press does not bring the page back to the cursor** (low, confirmed, re-read; `0x29930`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). After the page has been moved away from the cursor with the stick, a drag, the wheel or the bar, a direction press that cannot move the cursor snaps the page back to it in the game and does nothing in the port.
- **N2-151. A page change does not restart the tab's caption** (low, confirmed, re-read; `0x29f00`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). With the cursor or pointer on a tab, changing page blanks the tab's caption and fades it in again over 20 frames in the game; in the port it stays lit.
- **N2-152. The Back button stays on while the menu column has the cursor** (low, confirmed, re-read; `0x2c6e0`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). In the in-game config, with the cursor on the left column the game slides the Back button out (0.04 a frame) and back in on return; the port keeps it on screen and pressable.
- **N2-153. Title movie keeps playing under Config and Load** (low, confirmed, re-read; `0x49630`, `0x1b20`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-09 (compared with native frames).** With Config or Load open from the title the background movie keeps moving behind the translucent menu background; the game holds it still.
- **N2-154. A Back press counts for any click, not only a tap** (low, confirmed, re-read; `0x4a410`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). Holding the button longer than 0.4 s, or a press under 4 frames, backs out in the port and does nothing in the game. The area differs by 1-2 px at its left and top edges.
- **N2-155. Quick Load picture shows during the window's fade** (low, confirmed, re-read; `0x4ae90`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** The Quick Load? question shows the opaque picture over the still-fading window for about 15 frames on opening and 15 on closing.
- **N2-156. Two-line question moved up** (low, likely, re-read; `0x4ae90`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** A two-line question sits about 23 px higher than in the game.
- **N2-157. Story question and Save Progress? open scaled in the port, not in the game** (low, confirmed, re-read; `0x85900`, `0x85e40`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** The hint corner window shrinks from 1.05 as it fades in; the game's stays at its size.
- **N2-158. Story question and Save Progress? window 3 px left of the game's** (low, confirmed, re-read; `0x85900`, `0x85e40`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** The window sits 3 stage pixels left of the game's.
- **N2-159. Tap duration and movement limits** (low, confirmed, re-read; `0xad4e0`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** A press held longer than 24 frames (0.4 s), or under 4, still answers a dialog, presses Back or picks a title item in the port; the game ignores it.
- **N2-160. Switched-on button still shows pressed** (low, confirmed, re-read; `0xae040`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). Switching Auto off from the mode panel shows the pressed cell for 10 frames; in the game the button does not press.
- **N2-161. Dialog buttons' hit boxes** (low, confirmed, re-read; `0xae840`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** In SELS / SELA the rightmost 36 px of a button do not count in the game, while up to 30 px left, 24 px above and 52 px below it do; the port takes only the cell. System buttons differ by a few pixels.
- **N2-162. First lit button flashes as the system dialog opens** (low, confirmed, re-read; `0xae840`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). **Fixed 2026-11-08 (compared with a native frame).** The default button flashes once as the window finishes opening; the game's is already steady.
- **N2-163. Auto on and under the cursor shows the on cell** (low, confirmed, re-read; `0xaeec0`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). With Auto on and the cursor on its button (the keyboard opens the panel on Auto) the port shows the on art where the game shows the lit art.
- **N2-164. A press can lose its ring when the first frame's timestamp is earlier than the press** (low, likely, re-read; `0xb8990`; [backlog, config](function-map/backlog-config-dialogs-choices.md)). A left press that lands after the display frame's timestamp but before the browser runs that frame's callbacks shows no ring at all; the press itself still works. Rare and cosmetic.
- **N2-165. Gallery opening: cursor shown during the fade** (low, confirmed, re-read; `0xf8fc`; [flowchart](function-map/flowchart-widgets-tweens.md)). Opening the Flowchart from the gallery menu, the cursor frame fades in with the chart instead of appearing when the fade ends.
- **N2-166. Direction pressed while the player's scroll runs** (low, confirmed, re-read; `0x10ba4`; [flowchart](function-map/flowchart-widgets-tweens.md)). Pressing a direction during a stick / PageUp / PageDown pulse's 1/6 s, or during the last 1/6 s after a drag's coast has died: the game moves the cursor and leaves the view alone, and re-selection stops; the port scrolls to the selection when it has left y 2-966 (replacing the player's tween) and keeps re-selecting, so the selection may move again. While the coast's velocity is still non-zero the two agree: the view follows the flick and re-selection continues.
- **N2-167. Back button stays on during the close** (low, confirmed, re-read; `0x11bec`; [flowchart](function-map/flowchart-widgets-tweens.md)). The port's Back button lingers through the fade and leaves about 0.5 s late.
- **N2-168. Preview panel fades as one layer, so its label and texts blend differently** (low, confirmed, re-read; `0x1697c`; [flowchart](function-map/flowchart-widgets-tweens.md)). During the panel's 0.5 s fade in and out the dark title and note lie over flow_infobase (opaque white under them) and 'This scene' over the picture: in the game the base shows through the glyphs at (1 - a) x a, so the text is paler at mid fade (about 70 levels against 15 at a = 0.5); in the port it is not. The picture itself lies over a cut-out of the base and does not differ.
- **N2-169. Preview title colour** (low, confirmed, re-read; `0x16e00`; [flowchart](function-map/flowchart-widgets-tweens.md)). The scene title in the preview panel is a slightly more violet blue: (64, 57, 135) in the port against (64, 63, 132) in the game's frame, green 6 levels lower and blue 3 higher (against the table colour (66, 65, 132) green is 8 lower).
- **N2-170. Delayed CG thumbnails run one frame behind the native fade** (low, confirmed, re-read; `0x268ac`; [flowchart](function-map/flowchart-widgets-tweens.md)). Each time a CG grid is built inside the gallery (the CG section opened again, an entry's sub-grid, back to the main grid, the viewer's return), up to 41 thumbnails with a non-zero delay fade in one frame (1/60 s) later than the original; at 60 fps a thumbnail with delay 0.02 s reads alpha 0.0007 against 0.0036 on its second frame and 0.6834 against 0.7396 on frame 26. The first grid opened from the title is calibrated to native frames (GALLERY_OPEN.cascade) and does not show this one-frame lag; there it is the no-delay first cell that is ahead (0.96 against about 0.24 on the first frame, derived).
- **N2-171. A story movie counts as seen from its start** (low, confirmed, re-read; `0x92400`; [flowchart](function-map/flowchart-widgets-tweens.md)). **Fixed 2026-11-09 (compared with a native run).** If the page is closed or reloaded during the first showing of one of the six movies, the port afterwards treats it as seen: op1_arc / op2_ciel are listed in the Movie gallery, their song rows are unlocked and the movie can be passed on its next showing. The original keeps these off until the movie has ended.
- **N2-172. RDAS does not wait out a notice popup** (low, confirmed, re-read; `0x92580`; [flowchart](function-map/flowchart-widgets-tweens.md)). **Fixed 2026-11-08 (from the listing and tests; no native frame).** With read-skip on, an Auto or Quick Save notice showing as a read scene's RDAS is reached is cut short and holds the script until it has gone in the original (about 26 frames after RDAS hurries it, up to about 25 more if it was still opening); in the port the popup runs its full length and the question or countdown starts at once.
- **N2-173. Help band returns half a second late after a gallery movie** (low, confirmed, re-read; `0x4c8c`; [gallery](function-map/gallery-cg-music-movies.md)). After a gallery movie the help band appears half a second later than in the game.
- **N2-174. A band change during the going-out half reverses the band** (low, confirmed, re-read; `0x5c4c`; [gallery](function-map/gallery-cg-music-movies.md)). Moving the cursor away and back within the band's half-second change (CG grid with scrolling rows and the column, or the Music list and panel) turns the band round at once and swaps its labels early, where the game lets it go out and come back.
- **N2-175. Cursor line and light are drawn under the row buttons** (low, confirmed, re-read; `0x6124`; [gallery](function-map/gallery-cg-music-movies.md)). The cursor's line and light pass behind the row's label instead of over it.
- **N2-176. Keys stay locked for the notice's whole fade-out** (low, confirmed, re-read; `0x6764`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-08 (from the listing and tests; no native frame).** After dismissing 'Flowchart is not yet available', keys pressed during the next 0.23 s do nothing in the port; in the game they move the column (a press the notice took closes it, the next frame's keys are live).
- **N2-177. Light is not restarted when the column finishes coming in** (low, confirmed, re-read; `0x6bbc`; [gallery](function-map/gallery-cg-music-movies.md)). Half a second after the gallery opens the light jumps back to full brightness in the game (it has dimmed to about 0.79 by then); the port carries on dimming.
- **N2-178. Right into a section plays no sound** (low, confirmed, re-read; `0x6e28`; [gallery](function-map/gallery-cg-music-movies.md)). Moving from the column into a section with Right is silent where the game plays the cursor sound.
- **N2-179. Column wraps on a held key** (low, confirmed, re-read; `0x6e28`; [gallery](function-map/gallery-cg-music-movies.md)). Holding Up or Down runs round the column in the port and stops at the end in the game.
- **N2-180. A click on a column row opens the section with the cursor in it** (low, confirmed, re-read; `0x7328`; [gallery](function-map/gallery-cg-music-movies.md)). With the pointer: a first press on another section's row only moves the column's cursor there; a press on the cursor's row then opens the section, and the cursor stays on the column, its line and light lit, the section has no cursor and the band stays kind 10 until the pointer or a key moves it. In the port one click opens the section, the line and light go, the section shows its cursor and the band changes to the section's kind.
- **N2-181. Line and light are not restarted when the cursor comes back to the column** (low, confirmed, re-read; `0x74f0`, `0x82fc`; [gallery](function-map/gallery-cg-music-movies.md)). Going back from a section to the column (Left at the edge or Back) shows the line at full width at once instead of growing over 0.2 s; the light continues its swing instead of starting at 1.
- **N2-182. Hovering a column row does not take the focus from the section** (low, confirmed, re-read; `0x74f0`; [gallery](function-map/gallery-cg-music-movies.md)). Pressing a column row while a section has the cursor moves the cursor to the column in the game, on the press and with sound 0, the section staying as it is; in the port nothing happens until the release, when the click opens that section and puts the cursor in it. A pointer that only passes over a row does nothing in the game.
- **N2-183. The section title is drawn 3 px lower** (low, confirmed, re-read; `0x8818`, `0xd5e8`, `0x17cd0`; [gallery](function-map/gallery-cg-music-movies.md)). The CG Gallery title (and the other sections', same line) sits 3 pixels lower than the game's.
- **N2-184. A rebuilt grid does not round its scroll to whole rows** (low, confirmed, re-read; `0x9970`; [gallery](function-map/gallery-cg-music-movies.md)). After returning from a sub-grid or the viewer with the grid scrolled to a half row (any upward scroll, the last rows) the grid sits up to 69.5 px off, and a row above the view shows at 178.5 instead of 248.
- **N2-185. The grid takes keys before its cascade has ended** (low, confirmed, re-read; `0x9bdc`; [gallery](function-map/gallery-cg-music-movies.md)). For up to 0.72 s after a sub-grid is built, the viewer closes or a chosen section opens (0.5 s + 0.02 s a diagonal, 0.72 s with 42 thumbnails) arrows, Enter and Back already act in the port from the first frame; in the game they do nothing yet. When the gallery itself opens, the port's column fade blocks them for 0.5 s, so there only 0.5-0.72 s differs.
- **N2-186. Cursor and scroll bar do not fade in when a grid is rebuilt** (low, confirmed, re-read; `0x9bdc`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-09 (compared with native frames).** Opening a sub-grid or coming back from the viewer, the cursor frame and scroll bar show at full at once, and the light flashes at full instead of scaled by the grid's 0.5 s fade.
- **N2-187. The cursor does not return to column 0 when the grid gets the focus back** (low, confirmed, re-read; `0xa8c4`, `0xaca0`; [gallery](function-map/gallery-cg-music-movies.md)). Back from a cell in columns 1-5 and re-entering the grid: the port keeps the old column, the game is on column 0.
- **N2-188. The cursor's light stops at once with the frame** (low, confirmed, re-read; `0xaca0`; [gallery](function-map/gallery-cg-music-movies.md)). Leaving the grid within 15 frames of a cursor placing: the light disappears at once instead of finishing its 15-frame flash.
- **N2-189. Moving the pointer onto another entry plays no sound** (low, confirmed, re-read; `0xb48c`, `0xf350`, `0x1b5b4`; [gallery](function-map/gallery-cg-music-movies.md)). Pressing a thumbnail other than the selected one, or dragging across thumbnails with the button down, plays no cursor sound in the port; the game plays it for each new cell. A pointer moving over the grid with no button does nothing in the game, where the port selects cells silently.
- **N2-190. Pointer selection scrolls the grid and reflashes on the same cell** (low, confirmed, re-read; `0xb48c`; [gallery](function-map/gallery-cg-music-movies.md)). Moving the pointer into the partly hidden bottom row or a top row moves the grid in the port; in the game a touch never scrolls it.
- **N2-191. Ending button art 2.67 px off in its normal and pressed cells** (low, confirmed, re-read; `0xe1b0`; [gallery](function-map/gallery-cg-music-movies.md)). Each seen ending button's art sits 2.67 px right of the game's when not selected and 2.67 px left when pressed, jumping as it lights up.
- **N2-192. Ending buttons have no arrival flash** (low, confirmed, re-read; `0xe1b0`; [gallery](function-map/gallery-cg-music-movies.md)). Moving the cursor onto an ending button lights it at once in the port; in the game it also flashes for 10 frames.
- **N2-193. Keys and hovers are taken during a section's fade-in** (low, confirmed, re-read; `0xe614`, `0x18264`, `0x1a628`, `0x1a704`, `0x1c7d0`; [gallery](function-map/gallery-cg-music-movies.md)). A press within half a second of choosing a section moves the cursor or activates an entry in the port; the game ignores it until the section has faded in.
- **N2-194. Ending List fades as one layer, so a button hides the card under it** (low, confirmed, re-read; `0xe6f4`; [gallery](function-map/gallery-cg-music-movies.md)). During the 0.5 s fade in and out the button art over each seen card (122 x 128 at (714 + 480k, 120)) and over seen bad-end cells (98 x 104) differs by up to 0.25 x (card - background) at a = 0.5, about 30 levels on the bright card, for a few frames around the middle of the fade.
- **N2-195. Re-entering the list goes to the first seen entry** (low, confirmed, re-read; `0xeec0`; [gallery](function-map/gallery-cg-music-movies.md)). Going to the column and back by keyboard returns to the first seen entry in the game and to the last entry in the port.
- **N2-196. Row separators sit 6.6 px higher and 1 px to the right** (low, confirmed, re-read; `0x1a1a4`; [gallery](function-map/gallery-cg-music-movies.md)). The separator lines between the rows are 6.6 px higher near the top (5.2 px by row 14) and 1 px right of the game's.
- **N2-197. Selected row not lit after the pointer comes from the panel** (low, confirmed, re-read; `0x1b5b4`; [gallery](function-map/gallery-cg-music-movies.md)). After keys moved the cursor to the panel, a press or drag onto a row gives the list the cursor in the game and the selected row goes to alpha 1. In the port the area changes but no row lights, after a press as after a hover (which the game does not have), until the focus is given again.
- **N2-198. Row hit area is larger** (low, confirmed, re-read; `0x1b5b4`; [gallery](function-map/gallery-cg-music-movies.md)). The pointer in the 15 px between two rows still selects one in the port.
- **N2-199. On-sprites are drawn at full alpha** (low, confirmed, re-read; `0x1b7d8`; [gallery](function-map/gallery-cg-music-movies.md)). The lit Play, Pause and Repeat glyphs and their glow are drawn at full strength where the game has them at 0.8. Only where the y 184 art is opaque (61% of Play's outline pixels, 54% of Pause's, 35% of Repeat's) do they hide the button's outline, and there the game lets 20% of it through.
- **N2-200. Panel art a pixel or two off** (low, confirmed, re-read; `0x1b7d8`; [gallery](function-map/gallery-cg-music-movies.md)). The panel background and knobs sit 1 px high and the two bars 1 px right and 2 px high.
- **N2-201. Position knob travel** (low, confirmed, re-read; `0x1c184`; [gallery](function-map/gallery-cg-music-movies.md)). The knob is 10 px left of the game's at the start of a track and 9 px right at its end.
- **N2-202. Clock runs past the loop end** (low, confirmed, re-read; `0x1c184`; [gallery](function-map/gallery-cg-music-movies.md)). During the 1.5 s fade at the end of those rows (no repeat) the port's clock counts on while the game's stays at the loop end.
- **N2-203. Volume knob travel** (low, confirmed, re-read; `0x1c2b0`; [gallery](function-map/gallery-cg-music-movies.md)). The knob is up to 10 px left or 9 px right of the game's (about 1.4 px right at the default 0.6).
- **N2-204. Volume knob stays lit after Back** (low, confirmed, re-read; `0x1d89c`; [gallery](function-map/gallery-cg-music-movies.md)). After Back from the volume the knob keeps its lit art while the column has the cursor.
- **N2-205. Pointing at the panel does not take the cursor** (low, confirmed, re-read; `0x1e7d4`; [gallery](function-map/gallery-cg-music-movies.md)). A press on a panel button in the game gives the panel the cursor, dims the list's rows and plays the cursor sound. In the port it moves the cursor but leaves the row lit and plays no cursor sound. Hovering lights a button in the port (two can be lit) where the game has no hover. A press on the knob lights it and gives it the cursor in the game; in the port it does neither.
- **N2-206. No flash when the volume takes the cursor** (low, confirmed, re-read; `0x1ec0c`; [gallery](function-map/gallery-cg-music-movies.md)). The bright flash on the knob for the first 10 frames is missing each time the volume is entered.
- **N2-207. Volume is set from the bar, not dragged by the knob** (low, confirmed, re-read; `0x1f0d4`; [gallery](function-map/gallery-cg-music-movies.md)). Clicking the bar changes the volume in the port and never does in the game: with the cursor on the list or the volume nothing happens, and with a panel button under the cursor that new touch runs the button (0x1ca98-0x1cab4 has no position test). A drag moves about 5% less per pixel and has no grab offset.
- **N2-208. An instant run ending drops the player's skip toggle, so it is not back after the movie** (low, confirmed, re-read; `0x6ef30`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-08 (compared with a native run).** With the skip toggle on when an instant run starts, skipping stops at the run's end (for a TOMP, at the movie's end) with the indicator still on; the game keeps skipping.
- **N2-209. Fast forward held across a story movie does not resume after it** (low, confirmed, re-read; `0x6ef30`; [gallery](function-map/gallery-cg-music-movies.md)). **Fixed 2026-11-08 (compared with a native run).** Holding ZR or Ctrl through a chapter card or other movie, fast forward stops at the movie's end until the key is released and pressed again.
- **N2-210. Panel frames were drawn from a branch the game never runs** (medium, confirmed against a native frame; `0x34a70`, `0x36520`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08.** A panel with a frame (`01_00_ARC01_2` op 287) showed a dim strip of picture, a dark strip, then the clear picture; the game shows the frame's colour faded in at the panel's edge, then one soft ramp into the picture. 220 `STCH` / `SCH2` calls have such a frame. `0x34a70` was not on the REVERIFY list, so the re-check did not read it.
- **N2-211. A panel's pictures were each faded at the edge, so the one underneath showed through** (medium, confirmed against native frames; `0x36520`, `0x37ea0`, `0xa2c30`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-08 (compared with a native frame).** A panel with pictures linked to it faded every picture separately at the panel's edge. In `02_00_ARC02_1B` (ops 1223 and 1264) the small images got a green rim wherever they cover the panel's green picture `img2142`, and the edge was too opaque. The game fades the finished group once, so the rim shows only the top picture. The green inside the panel is the game's own. About 4,400 linked `STCH` calls have an owner with an edge width.
- **N2-212. STCP changes the depth of a picture on screen only at the next commit** (medium, confirmed against native frames; `0x62a40`, `0x32450`, `0x3bba0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-09 (compared with native frames).** The port moved or hid the layer at once. In the game `STCP` writes the layer number's state, and the draw order is the record's own table, which only a commit fills, so with no FADS and no staged picture before the next wait the picture stays as it was: in `05_01_CIEL05_2_2B` (op 1301, `STCP 31 0` then FANX, which does nothing) Ciel's sprite stays up through six waits and a line of text while its track plays, where the port cut it. 17 waits in 8 scripts drew differently (a replay of all 549).
- **N2-213. SOXY's offset is in screen pixels** (medium, confirmed against native frames; `0x37f50`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-09 (compared with native frames).** The port moved the layer by 2.67 px for every 3 units across and about 0.82 px a unit down, cut to whole steps: `SOXY -180 -195` moved a picture 160 px left and 159 up where the game moves it 180 and 195, and offsets of 1 or 2 did nothing. 208 calls, most between 1 and 20 px.
- **N2-214. The menu's blurred background is blurred twice over** (medium, confirmed against native frames; `0xa0a90`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-09 (compared with native frames).** The story behind the system menu and the backlog was too sharp: a sigma of 3.7 px where the game's is 5.6.
- **N2-215. A choice's selected row has a soft glow** (medium, confirmed against native frames; `0xa0a90`, `0x83e50`, `0x84e50`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-09 (compared with native frames).** The port added a sharp cyan copy of the label over the white label, which shows nothing. The game's glow is a halo round the letters.
- **N2-216. Pictures drawn smaller than they are stored were softened** (low, confirmed against native frames; `0x9fe00`, `0x36520`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-09 (compared with native frames).** The port sampled its pictures through mipmaps, so a picture shrunk by a zoom under 0.67 was softer than in the game, which has none.
- **N2-217. The RGB split leaves the speed lines alone** (low, confirmed against native frames; `0x391a0`, `0x87a90`, `0x3bba0`; [rendering](function-map/rendering-effects-animation.md)). **Fixed 2026-11-09 (compared with native frames).** The port drew the speed lines before the split, so the split would shift and tint them. No script has both on at once.

### Story and progress

1. **Jump numbers 2000-2007 are swapped** ([script machine](function-map/script-machine-state.md) #1; re-checked
   independently). The native jump table at 0x350d58 sends 2000 to `12_01_CIEL12_3C_FLAG0` (sets F069 = 1) and 2001
   to `…_FLAG1` (sets F069 = 0), and the same for 2002-2007. `web-dev/tools/build_core.py` assigns them the other way round;
   these are the only 8 mismatches in the whole table. The five Ciel-route scene ends that read `IF__ F069 eq 0 L;
   JUMP 2001; L: JUMP 2000` keep F069 in the game and invert it in the web, so about 50 later F069 tests show the
   other text and the flowchart marks the wrong node. Confirmed.
2. **First launch and New Game run in a different order** ([title, saves](function-map/title-menus-saves.md) #1).
   The game tests whether scene 485 has started (G140 bit 5, `0x926b0(0x1e5)`). Not yet: no TM_CI, no notice; the
   prologue script 00_01 starts at once and plays `prologue.mp4` (6.4 min), which cannot be skipped the first time;
   then the plain title ("press any button"), the two cautions and START_SCRIPT. Seen in the sandboxed native run
   ([sheet](function-map/native-first-launch-sheet.jpg): the movie opens 3 s after start, no input). Once started:
   TM_CI, notice, title, and New Game goes straight to START_SCRIPT. The web always plays TM_CI and the notice,
   lets a click skip the opening, and replays the opening and the cautions on every New Game. Confirmed.
3. **Three script commands the game ignores are acted on.** The Switch interpreter has no `SNX4`, `STQK` or `WTSV`
   (the dispatch reaches 0x77814, "unknown, skip"). The web blurs layers on `SNX4` (8,762 calls; 14 differ from the
   `STCH`/`SCH2` blur, which is the game's only blur: those arguments pick pre-blurred `_XX_YY` textures), quakes
   Ciel on `STQK` (`QA_14`, 3 calls) and waits for the voice on `WTSV` (28 chapter openings). Seen in the browser:
   `08_01_CIEL08_5` op 3346 draws Noel blurred ([web](function-map/snx4-web-blurred.jpg)) where the game shows her
   sharp ([same scene without the SNX4 blur](function-map/snx4-native-sharp.jpg)); `QA_14` op 1192 starts a 200 ms
   quake on layer 29. `FANX`, `IFNX` and `TRPY` are also unknown natively, and the web already ignores them.
4. **Flowchart progress is marked differently** ([flowchart](function-map/flowchart-widgets-tweens.md) #1-#4).
   RTST sets the current scene only for the Ciel-sensei episodes or in a replay, and RDED completes a scene only when
   it is the current one; the web sets it on every RTST, so scripts that serve several nodes complete a different
   node (25 jump pairs). 0x93d10's 84 special (from, to) cases are approximated by a search, 81 differ (24 '?' boxes
   stay, 15 pre-revealed branch lines are missing). The in-game rewind keeps about 340 variables (route flags F054-F074,
   path bits) and rolls back only later rows; the web resets every variable. Confirmed.
5. **Gallery replays do not stop** ([script machine](function-map/script-machine-state.md) #4,
   [title, saves](function-map/title-menus-saves.md) #3, [flowchart](function-map/flowchart-widgets-tweens.md) #5).
   The game ends a replay at the scene's RDED and returns to the gallery, refuses Save/Load and quick save/load during
   it, and starts a flowchart replay without a question. The web plays on into later scenes and returns to the title.
6. **Choices** ([backlog, config, dialogs](function-map/backlog-config-dialogs-choices.md) #1-#3,
   [script machine](function-map/script-machine-state.md) #3). Options are numbered ("1. …") from SYSMES 1434+;
   `SELR`'s third argument greys a row out (6 rows in 4 choices can be picked too early in the web); nothing is
   selected until a direction is pressed, so an immediate Enter on "Save Progress?" does not open the save screen.
7. **Commits at text-window closes** ([script machine](function-map/script-machine-state.md) #2). CLO2-CLO5 end the
   native frame, which applies waiting layer changes at once; in 28 places the web fades them with the next FADS
   instead.

### Look

8. **`STRA` is a heat-haze effect, not a stored value** ([rendering](function-map/rendering-effects-animation.md) #1).
   0x362a0 reads the STRA fields, looks the number up in a 557-entry table at 0x352bd4 and draws the layer with the
   `haze` shader (`nexl_nxshader_haze.bnsh` is in the game's shader table). 569 calls in 84 scripts draw nothing in the
   web. This corrects ANIMATIONS.md / FIXES.md VM-05.
9. **Text window drawing** ([text](function-map/text.md) #1-#6). The window picture and the text are drawn at
   panel x max(0, 2(fade - 0.5)), and the picture is not drawn while the window is closed; earlier lines dim to 100/255
   over the typing speed x 1.2 frames; a letter fades in over one letter interval (not 100 ms); typing waits until the
   window is open; the open/close rate is 0.1302 a frame; F1104 "novel" pages only hide the window picture.
10. **Layer drawing** ([rendering](function-map/rendering-effects-animation.md) #2-#8): STZ4's 8th argument zooms
    after rotation (55 calls; resolves the open item), a layer linked to a removed owner is not drawn (~20 cases),
    z <= 0 hides a layer, panel edges feather where the web draws a band (frame style 7, 37 calls), SCH2 resets the
    blend mode, STMA's third argument closes the text window (117 calls) and its fourth steps the motion, the RGB split
    steps every 6 frames.
11. **CG gallery unlocks** ([gallery](function-map/gallery-cg-music-movies.md) #1-#7). The alias table (0x4525c8:
    105 pictures counted as seen through their source image or sprite), the route-day gates (188 entries) and
    "completing QA_25 shows every CG" are not ported: about 1,029 of 1,977 pictures can never appear in the web. The
    per-entry sub-grid, whole-gallery Left/Right, fades and rule wipes in the viewer, and flag 1 (a horizontal mirror;
    resolves UI-08) are missing.
12. **Backlog, config, dialogs** ([backlog, config, dialogs](function-map/backlog-config-dialogs-choices.md) #4-#15).
    The backlog is a page viewer over the scene (75% veil, pages as the window drew them, wrap, fades); most system
    dialogs start on No and answer on the second tap; config sliders step by 1 (50 for large ranges) with hold-repeat,
    L/R change pages, the digits are the game's art; the SE Test picks one of 14 sounds; tooltips are missing.
13. **Title, menu and saves** ([title, saves](function-map/title-menus-saves.md) #2-#11). Return to Title does not ask
    in normal play; the save list shows only used manual slots, newest first, plus one empty slot (automatic saves are
    reached only through Continue); an empty slot saves without asking; chapter cells, info pictures and scene names
    come from F023/F022 (222 of 518 scripts get another header cell in the web); Quick Load shows the quick save's
    picture; the completion banner (SYSMES 239) is missing.

### Sound

14. **Volumes are shaped, the web's are linear** ([audio](function-map/audio.md) #1-#3). Music is ca0(B(L x BGM)) with
    B(v) = 1.54 v - 0.54 v^2 (runtime easing type 12, 0xff4b8) and ca0 the 101-point table at 0x3355f0; plain sound
    effects are ca0(L x SE). At the defaults the web's effects are 5.5-12 dB too loud and its music 1-4 dB; voices,
    interface sounds and movies match. Voiced effects (070) follow the voice row, not the SE slider (8 dB too quiet in
    the web, and the SE mute silences them). Fades are linear in level before the curve. NATIVE-PARITY's "all linear"
    is wrong for music and effects.
15. **Delayed sound commands** ([audio](function-map/audio.md) #4-#8): a plain SEVL retunes a waiting SEPL (4 ambient
    loops never start in `14_01B_01_CIEL14B_1D`), a plain SEFD drops it, delayed fade-ins take their rate from 0x65780,
    fast forward does not cut fades, speaker-23 voices use row 18.
16. **Music Player and movies** ([gallery](function-map/gallery-cg-music-movies.md) #8-#14). The Music Player fades out
    and stops at a track's end (no auto-advance), has its own keys and a 0.01 volume step, labels the credits, restarts
    the title music when it closes; story movies play through skipping and six cannot be skipped the first time; the
    movie gallery asks before playing and restores the music.

### Controls

17. **Skipping and the mode panel** ([script machine](function-map/script-machine-state.md) #5-#9). A read-scene skip
    is an instant run to the next ATSV, choice or unread line (the open item "0xae06b8 = 4" is a 4-frame countdown);
    the mode panel's first and fifth buttons are "Return to Previous Scene" / "Jump to Next Scene"; the skip toggle stays
    on across unread lines and choices; a click ends VCWT; XRSM restores the skip/auto state XSTP saved.

## Missing functions (22)

| Function | What it does |
|---|---|
| 0x51e0, 0xb58c | CG alias rule and route-day entry gates |
| 0x8964, 0xd408, 0xd468 | CG per-entry sub-grid |
| 0x1873c | movie gallery confirmation (SYSMES 1443) |
| 0x178c8, 0x17af0, 0x92500, 0x92540, 0x95800 | flowchart rewind: record, restore and roll back route variables and path bits |
| 0x362a0 | `STRA` heat haze |
| 0x3f110 | the fade shown during the read-scene skip countdown |
| 0x4cb30, 0x4e0c0 | greyed Save/Load and quick save/load in replays |
| 0x50b10 | scene names per save row and the chosen slot's text |
| 0x81a50 | Return to Previous Scene |
| 0x89590 | the quick save's picture in the Quick Load dialog |
| 0x90440, 0x91350 | completion banner on the title |
| 0x9b0c4 | the game's scroll bar (config, backlog, save lists) |
| 0xacfa0 | interface sound 7 at the SE volume (movie mode) |

## Unused native code (92)

Handlers for commands no script uses (CHJC, EIF_, ELS_, IFF_, IFJP, IFLA, FCCL, FLNT, FLOP, FLSP, MSTP, SEAC, SEFI,
SEP3, SEPN, SHAK, SHAS, SNOW, STRC, VCLR, WKBO, WKOF, WTVT, WT__), the old "extra" title screens (0x424d0-0x47570,
reached only from title states that GALLERY overwrites), task type 2, the second yes/no dialog 0x49a40, choice layout
type 0, the movie-7 branch of TOMP, the music panel's state 4, title items 4 and 6 (6 is the offline manual), config
fields with no widget, and the silent-load branches of several commands. Details in the subsystem files.

## Corrections to earlier notes

Applied to those notes on 2026-11-07 (FIX-CHECKLIST N1).

- NATIVE-PARITY "All linear, value / 100" for sound: wrong for music and sound effects (#14).
- ANIMATIONS.md / FIXES.md VM-05 "no drawing code reads STRA": 0x362a0 does (#8).
- FIXES.md VM-01 "WTSV ... waits while the voice channel is busy": WTSV is not a command; 0x7f69c is WTVT, which no
  script uses (#3).
- ANIMATIONS.md "only SNX4 is a blur": SNX4 is not a command; blur comes from STCH/SCH2 texture variants (#3).
- Open items now settled: STZ4's 8th argument (#10), the CG variant flag (#11), the read-scene skip end (#17).
- FIXES.md "Gallery background": the config raises and lowers the system menu's background from the title too
  ([backlog, config, dialogs](function-map/backlog-config-dialogs-choices.md) #10).

## Corrections found while fixing (2026-11-06)

Section 1 of [FIX-CHECKLIST.md](FIX-CHECKLIST.md) is done; re-reading the listing for it changed four statements above:

- A locked choice row (SELR's third argument) is not greyed: only SELR and the selector `0x83e50` read `0xae09e0`; the
  draw `0x84e50` does not, so the row looks like the others and only selection skips it (#6, backlog #2).
- SELD 72 / 73's second lines (1168, 1120) are not "never" marked: the scripts run RTST 270 / 446 only when F069 is 1
  and RTST 483 / 447 otherwise, so `0x92a60` marks them on the F069 = 0 side (flowchart #3).
- SELS (and SELA) are asked while skipping: `0x92800` / `0x92930` return early on `0x5afb0`, which reads `0xae0900` ->
  `0x146e638`, the load's silent-run flag, not the skip toggle `0x1916dec` (flowchart #11; checklist S31 dropped).
- The chapter-title movies (8-12, 14-34) play interface sound 7 as they start (`0x40480` at `0x40930`); movie 13 plays
  it at frame 210 instead (gallery #14, audio #10). The mode panel's "Jump to Next Scene" always asks dialog 10 (state 1
  of `0xae0680` in `0x40ed0`); only RDAS's question depends on "Display confirmation" (+0x60).

Section 2's layer items (V1-V10) are done too; re-reading the listing for them changed or sharpened these:

- The haze shader is SPIR-V `33906951eb996a33` (`nexl_nxshader_haze.bnsh`); `4bbde4e2ca02d2dc` is `nexl_nxshader_wave`,
  which waves y along u. STRA works through the commit: `0x645f0` writes the record on screen and the state `+0x1364`,
  which `0x5d3a0` copies into the staged record and `0x3c970` into the live one at every commit, so a STRA with a time
  takes effect (or is cut) at the next commit; STCH / SCH2 zero the record (`0x32930`) but keep the state (#8,
  rendering #1).
- `STZ4`'s eighth argument is settled from `0xbbb28`: the x / y parts of the finished matrix's axis vectors are scaled,
  the translation (the anchor) not (#10, rendering #2).
- The three `QA_21` SCH2 calls given for "SCH2 resets the blend" copy from other layers whose blend is already 0, so
  they show no change; 17 other SCH2 calls copied a blend (rendering #6). The one "visible" z <= 0 case
  (`14_01B_03_CIEL14B_5` op 491) is covered by an opaque picture (rendering #4).
- STMA's "no CLO4 / CLO5 fade" (`0xae05a8`) is the window's fade rate, which a message's 18-frame fade-in also sets
  (`0x6e0d0` writes 1/18) (rendering #7). The menu blur closes at once (`0x2e030(0, 1)`), only its opening fades
  (rendering #9). Each layer's quake is independent, but `0x34440` / `0x32050` keep SBAS children and panels moving with
  their parent or panel (rendering #10).

Found afterwards, from a report that QA_17 cut Neco-Arc off at the right (checklist V11): this map had `0x97b80` and
`0x99ff0` as explicit because the port cites them, but its export read 11 of a keyframe's 28 fields. A track's panel
(fields 11-14, which move QA_17's panel from x 646 to 843 with her), frame style and edge width, pivot, blend, colour,
brightness, contrast, grain and depth were never applied; the flag bits (`0x36ab38`) and the rule that position,
opacity, zoom, blur and blend given only at time 0 are written once were not followed; `0x97710`'s ease and mode
searches differed on 8 tracks; SGMA (`0x9a270`) ignored its key argument and the panel. All of it is in the port now.
The same report then settled the panel question in "Limits" (checklist V12): a linked layer is drawn through its
owner's picture, a clipping mask (`0x32e30`'s linked branch draws the owner's texture as the mask; a panel drawn as
one group composites through its owner, `0xa2ba0` / `0xa2c30`), where the port clipped it to the rectangle only; and a
blurred layer takes the pre-blurred picture's pivot (`0x60840` looks up `<name>_XX_YY`).

Section 3 (sound, A1-A10) is done; re-reading the listing for it changed or sharpened these:

- The curve table's T[99] is 0.9885, not 1 ([audio](function-map/audio.md) summary); ca0 returns 1 from 0.99 on, so
  it only tops the 0.98 step.
- The BGM byte's rounding (40 plays as 39) is not a start-up accident: `0x47b40` (called by the config's `0x2a9b0`,
  `0x2b3bc` and `0x2dd88`) makes `0x48ac0` re-apply floor(floor(256 x (1 - mute) x BGM / 200) x 100 / 128) the next
  frame after every sound setting change.
- The delay slots have more rules than "SEVL retunes, SEFD drops": an SEVL with no delay retunes an SEPL left in the
  slot even after a plain SEPL zeroed its countdown (it then does nothing else); a plain SEFD empties only a slot whose
  SEPL still counts down; waiting SEVL / SEFD slots are left alone by plain commands; channel -1 is each of the 20
  slots (38 delayed SEFD); `068:0` would still wait a frame (no script has it).
- An immediate SEPL's fade-in gets the 1000 ms on a fading-out channel whenever 001 is given, so `001:0` there fades
  in over a second (12 calls pass `001:0`); the delayed path needs 001 >= 1.
- A row or "Play all voices" off zeroes a voiced effect's volume when it plays, which for a delayed SEPL is after its
  delay (the port had applied the switch when the command was read).
- The per-sound volume 96 / 127 is on every one of the 17,896 sounds of knife1.bfsar (SoundInfo +8), so music,
  effects, voices and interface sounds sit 2.4 dB under the movies' audio.
- nn::atk's pan law is traced (it was the audit's open limit): `0x12d108` places each channel through `0x12a1a8`,
  share T(i(x)) of the sqrt curve at `0x3cf91c` (sqrt(1 - i/256), not scaled to the centre), i(x) = trunc((min(x, 1) +
  1) / 2 x 256 + 0.5). SoundInfo option 1 gives the mode (byte 0) and curve (byte 1): the effect waves are 0/0, dual
  (a stereo wave's channels at q - 1 and q + 1), the streams 1/0, balance (each channel of a stereo stream a voice of
  its own on its side, `0x122378`). So a centred stereo effect plays as it is, but music, voices (mono streams) and
  the voiced `SEV_` effects (mono waves) play at 0.7071 a side, 3 dB under it; 018 96 puts an immediate effect's left
  channel at the centre (0.7071 / 0.7071) and a delayed one's at 0.866 / 0.5, which no StereoPanner reproduces. The
  game sets nn::atk to surround (`0xec618` / `0x112db0` -> `0x1134e0(2, 0)`), whose front pair gets these values,
  without the front bypass curves (`0xad5308`; SoundSystemParam +0x7e is 0).
- The config's live voice level (`0x2a9b0` -> `0x9d240`) is not about the Test voice: the Test plays on interface
  handle 4 (so the next interface sound landing there cuts it) at row x the voice switch, and records its row
  (`0x46f814`, -1 at start); every later config apply sets the voice on the story handle in use to that row's level,
  and stops the voices when that row is muted (backlog #15 had it the other way round).
- The scroll bar's two sizes (`0x9b0c4`) follow `nn::oe::GetOperationMode` (`0xfbed4` reads `+0x168`), not touch input:
  docked, as the PC build runs and the 1080p stage, draws it 1:1.

Section 4's gallery items (G1-G11, G13) are done; re-reading the listing for them changed or sharpened these:

- The movie gallery asks nothing before a movie: its confirmation (`0x1873c`, dialog 25 = SYSMES 1443) is the movie
  section's state 3 in `0x18264`'s table, and no code writes state 3 (the state writes from `0x17dd0` to `0x18b10` are
  2, 4, 5, 6 and 7); the list's A starts the player at once with sound 1 (`0x183ec` -> `0x4f28`, state 4) (gallery
  #10; `0x1873c` is now unused, checklist G10).
- What "seen" means for the CG gallery (gallery #1): 3,200 bits (`0xae07a8`) by a picture's index in the name table
  (`*0xae0888`). The first 2,700 names are their own bits; a record flagged at +0x43 stands for its name less six
  characters, so an expression record such as IMG0003_04_04 shows IMG0003; any other name has a bit only through the
  2,144 records at `0x6533c0` (`0x77360`, 718 of them naming a picture), where some poses' four sizes A / L / M / S
  share one bit and others not (AOK_A_21_00_N01 2701, AOK_L_21_00_N01 2748), hence the alias rule's four tries. A
  gallery picture past the first 2,700 names (IMG3954 and the other alias targets) has no bit of its own: it is listed
  through its alias row or after QA_25. Over the whole game the port's exact-name record gave the same 948 own-bit
  pictures, but not always at the same moment.
- The title's music in the gallery (title, saves #9): `0x8e1c0` is not called on every section change, only by the
  column's return from the flowchart (`0x7624`, unless to the Music Player) and by the Music Player's close (`0x19838`
  state 4) when `0x8400` has set its +0x80 flag for a section of the column; the gallery review's finding #9 had it
  right.
- The CG viewer's help band (gallery #6) is not shown for as long as the viewer is open: `0x604c` brings it in over
  half a second and holds it 2 s (+0x40, `0x59c0` state 2) before `0x5ea4` takes it out, sliding (1 - alpha) x 25
  units lower (`0x5b58`); `0xcd58` shows it again at every picture change.
- The CG grid draws 6.5 rows (y 109-1014, `0xaf78`); a row going down past 804 scrolls to 804 and the last row to 873.5,
  a row going up above 178.5 scrolls to 178.5 (`0xa968`) (gallery #11).
- The ending list's Up / Down (`0xf6f8`) put the endings' columns 0 / 1 / 2 over bad-end columns 2 / 5 / 7 and take
  thirds of the row back up, and reach the final episode (index 21, row 3 column 5) from columns 6-7 of row 2, Up from
  it going to column 7; Ghidra's C of `0xe7a4` drops the sound after every move (`0xacef0(0)`), which the listing has
  (gallery #13).
- Two of the gallery review's limits are settled: the CG viewer's picture-change capture is drawn by the sprite's rule
  path (`0x254bc` -> `0xb7160` -> `0xb2f00` -> `0x9fe00`, which at `0xa0188`-`0xa01f8` sets the rule program's
  constants: threshold 1 - a / 255 of the colour's alpha byte, softness 128 x width / 1920, direction +1, where STTR's
  `0xa7190` passes the alpha and -1), so the old picture leaves the rule's dark parts first (the port first had STTR's
  direction; checklist G6). And the 19 offset rectangles show their rectangle centred: `0xb6de0` draws the rectangle's
  size at the scale, anchored at its middle (`+0x280 / +0x3c4` = 0.5), and the (x + w, y + h) size `0x1f648` sets is
  only the sprite's coordinate size (checklist G7). The map had `0x254bc` as a text widget's draw: it is the sprite
  class's draw (vtable `0x46a938`).
- The gallery's own help band is a guide too (`0x6124`, kind 10): the column's Back / Choose / Move; a section with
  the cursor asks for its own kind (`+0x88`: the CG grid 0 with Scroll when its rows scroll, else 10; the Music
  Player's list 0, its panel 10; Movie and the Ending List 10), switched by going out and back in (`0x5c4c`); the
  viewer and the movie player hide it (checklist G14).
- Checking the sprite class's users against its draw (`0x254bc`): only the gallery, the flowchart and the scroll-bar
  widget draw through it (the title, menus, config, saves, backlog and text window do not); none rotates, and shader
  2 draws as 0. Found: the CG viewer's backdrop is a 0.847 grey rectangle (`0xba18`, `0x466738`), not black (G15); the
  CG grid cursor is a frame and a light, cut to y 109-1014 like the thumbnails, the light flashing 15 frames at each
  placing (G16); the widget motion programs (`0x1fd48`) ramp linearly, so the column's line grows linearly, not
  quadratic out (G16); the Music Player's buttons are 88 x 80 cells on a 96 x 88 pitch with separate on-sprites and a
  Stop / Prev / Next flash (`0x1b7d8`, `0x1e98c`) (G17); the scroll bar is DISP_PARTS_JA's (`0x276b0`), which the CG
  grid lacked and the Music list drew in CSS, and the Music list is cut to y 109-1014 (G18). The flowchart's own
  scroll bar (`0xfffc` -> `0x276b0`) is not drawn by flowchart.js either (noted under F4).
- The flowchart (checklist F1-F4), read again in the listing: its row filter compares a placeholder with the *static*
  row before (not the previous row shown) and, the static parts being one array, may read the next row's first part;
  in the game only the scenes on the play's path in days 1 on can be selected (so a rewind goes along the path), in
  the gallery only completed ones; a line piece needs its own line revealed even under a completed scene (the port drew
  it for every completed scene); the junction choosers return 2-11 by a fixed table (the review had "2..5 / -1");
  0x1303c searches up to 8 columns either way (not 5) and splits at column 4; the second cursor cell (120, 8) is the
  flash sprite, not a path look; the panel's flow_info is the label "This scene", always shown (the review could not
  find a rule for a "here" badge: there is none); the day titles stick to the top (0x11eb4); the preview's texts change
  only with the preview index and are absent for a part without a preview; the in-game flowchart fades in and out like
  the gallery's. Ghidra's C of 0x12eac / 0x13854 is unusable (tail calls into each other); the listing decided.
  Not traced then: the day bands' own geometry (0x13b54 / 0x13d04 / 0x14b58 place a band from 5 below a day's top to 3
  below the next and edges 8 apart, whose textures 0x204-0x206 were not mapped to files); the port's bands are kept.
  (Traced later the same day, next item.)
- The flowchart's rest (checklist F5-F9), against the listing and the native build with the user's save: texture ids
  501-520 are MENU_PARTS_JA's textures in order (0x204-0x206 the bands' middle / under / upper); `0x13d04` is the day
  separator, not the phase titles (0xfffc draws those, 0x203); the bands run from the chart's top to its bottom, broken
  at the separators; `0x14b58` returns bottom + 56 and the scroll's end comes from it, 56 more than F2 / F4 had (the
  game's opening on scene 309 at 14689 needs it). `0x6c4` is the touch drag's velocity (as the backlog / config review said), so 0x11418's
  "6 px a wheel unit" was the drag's 6 x velocity; the scroll stick is the first stick (the PC build's left stick, which
  its PageUp / PageDown push), its bits pulsing at 15 / 5 frames like the D-pad's; `0x27bd4`'s time is an argument (1/6
  s here), not 0.2 s. Decide acts on the part at the selection with no check; only the opening leaves it on a part that
  is no node (a virtual current scene such as 520). `0x4a790` is the touch Back button (the brief had it as the help
  bar): the flowchart's band is a guide of kind `0x123f4` (0 while it scrolls, else 10), the gallery's own switched to
  it, the game's made by `0x1776c` and drawn at the flowchart's fade. The game's Back button is drawn at alpha 0 when
  docked (`0x4a7a0`: GetOperationMode 1), so the PC build never shows it; the port always does (not changed: ui.js). A
  save's record keeps its story variables through 0x5baf0's lists (fixed list, bytes, bits), not as the F block.
- The RGB split's draw `0x2fc50` (FADE 40) was marked as matching; it did not (checklist V15, 2026-11-07, after a
  report that 00_00's green scene moved far more than in the game). The split picture goes over the screen with
  `overlay` (`0xa2790(0x16)` = table position 31), not in place of it, so the picture stays put and the moved copy only
  tints it; red moves by +d, green by -d, blue by -2d (the port moved each channel the other way); each channel gets
  the pass colour twice. The motion itself (`0x2f910`) was right, which the native build's frames confirmed step by
  step. Rows 0x2fc50, 0x2f910, 0xa5690 and 0xa4bc0 have the details; no status changed.
- The CG viewer's picture change (checklist G19, 2026-11-07, after a report that the next picture showed for a split
  second before the effect): the alpha `0x254bc` gives a rule sprite (1 - `+0x52c`) only sets `0x9fe00`'s threshold;
  the capture itself is not faded (the native build's frames: what the threshold has not reached stays at 1.000 all
  through), so the port's extra fade showed the whole new picture from the first frame. `0xca54` keeps the old
  screen unchanged for 8 frames (capture asked at step 0, its sprite over all at step 4, the new picture under it at
  step 5, the timer at step 7) before `0xcd58` runs the 30-frame wipe; the capture takes the help band, which comes in
  again under it. The port had started on the frame after the new picture loaded and left the screen uncovered while
  the rule was loading. Rows 0xca54, 0xcd58, 0xc368, 0x254bc, 0x9fe00 and 0xa4610 have the details; no status changed.
- The gallery opened from the title and the menu background's sparkles (checklist G20, 2026-11-08, after a report
  that the opening's animations and the sparkles did not match; timed from the GALLERY press on the native build's
  frames): the engine's frame clock (`0xef08c`) gives a frame the time since the last, at most 0.5 s, so the gallery's
  loading frames (~0.35 s, the title's screen still up) run on the timers made in them: the CG cascade is ~0.49 s and
  the scroll bar and help band ~0.245 s along on the gallery's first frame, while the column group (`0x6934` /
  `0x6bbc`) starts from 0, and the thumbnails take only their cascade. The sparkles (`0x4c190` / `0x4bd10`) are drawn
  half the size the port had, from 40/41 of their texture, with normal blending, and they are one static set
  (`0xb34bc8`) that every opening of the background carries on (the port started each background empty). Rows
  0xb318, 0x6934, 0x6bbc, 0xef08c, 0x4c190, 0x4bd10, 0x4b880 and 0x23348 have the details; no status changed.

## Corrections found while re-checking (2026-11-07)

[REVERIFY.md](REVERIFY.md) re-checks the functions this map counted as handled, listing everything each reads (FIX-CHECKLIST
N2; 47 of 453 on 2026-11-07, the script machine's first; 2026-11-08 below). It changed these statements:

- `0x53a60` "the web keeps per-line bits; same result except for branch variants inside a block" was wrong. The read
  marks are a byte per message block (save +0x667), raised by the *next* Z command of any kind (labels too, no skip
  test), and 769 block numbers serve in more than one script, so reading a message marks another script's message under
  the same block and index read (355 slots in 27 scripts). The instant run's stop is tested at every Z command, labels
  included, and a `ZY` label's block is never raised. Ported as S33.
- Restores were "covered" by the port's snapshots, but `0x5d7e0` restarts every recorded loop, turns the music's loop
  flag on, and (through `0x328f0`) finishes the layers' tweens; a load, Quick Jump and Return to Previous Scene also
  stop the music first, so it starts again from its top. During a read scene's instant run the sound commands only
  record, and each stop plays the recording. Ported as S34.
- `0x2d3c`'s note was right that the forms are covered, but a decimal stops at its "." (27 STCH alphas, one SSW2 factor
  that becomes 0); ported as S35. `0x774f0` is called by every commit for every layer, not at staging (S36).
- `0x5f8f0`'s "skipped while ... *0xae0900 is set (skip)": `0xae0900` is the load's silent-run flag (0x146e638), not
  skipping; SHOK, SQK2, SHK2 and SSW2 with a time are dropped only in a silent run, MSQK never (S37, open).
- `0x5baf0` gives back only a fixed list, a byte table and a bit table of variables, but every variable the scripts read
  is among them (F500 is only written), so the port's whole-set restore gives the same result.

## Corrections found while re-checking (2026-11-08)

73 rows' notes were wrong or incomplete; each correction is appended to its row in [function-map.csv](function-map.csv) ("Correction 2026-11-08"). These statements elsewhere in the audit were wrong or incomplete:

- Checklist S37 ("no skip factor", "a fixed WTTM is not cut short"): while skipping, the game does not run at real time. `0x40ed0` sets speed 64 and `0x4a5b0` stores speed / 2 + 1 = 33 in `0x590e80`, which `0x48ac0` hands to the layer update and FADS level, and audio fades advance by 64 (`0x802c0`); a fixed WTTM loses 64 frames a frame and typing runs at 60 x (`0x81b30`). The port's instant model is still different, but S37's description of the game was not right.
- S38 is settled from the listing: a rewind starts no voice (`0x5baf0` with param 2 = 1 clears the pending voice at `0x5d218`); Quick Jump and the checkpoint restore run the message command again, so theirs does play.
- S39 is fixed (2026-11-08): each channel's 068 delay slot is kept in the records (`vm.js` snapshot `delayed`; native `0x5a910` record +0x3914, restored by `0x5baf0`) and a countdown still running goes on after a load, rewind or Quick Jump.
- S20 (done): ATSV moves the checkpoint only at F823 <= 1, and SELD's call at `0x7f850` is never reached, so a save at a mid-page choice resumes in the game at that page's first line (N2-1).
- NATIVE-PARITY row 8 and the comment on `op_SEPL` ("fast forward plays them"): `0xae0670` is set by held fast forward and by the skip toggle, and `0x6a340` drops one-shot effects while it is set (N2-24). [function-map/audio.md](function-map/audio.md) calling `0xae0670` a read-scene counter is the same mistake.
- FIXES.md and M18 ("the title's Load raises nothing"): `0x50e8c` raises the menu background there (N2-36); M21 had left this open.
- T12 ("no script starts this state"): `0x2e560(0, 0, 0, 0)` also stops a running SHOK (N2-109).
- V8 ("not modelled"): the store at `0x2e3a8` also resets the split's 6-frame counter, and `splitSample`'s floor(f / 6) from the new start matches it.
- M20: the config's first opening with nothing lit does not exist in the game; the boot init `0x2b010` leaves the cursor on row 0 and the System tab (N2-45).
- The band note on `0x34a70` (2026-11-07, RE 5c) described the branch for target 0, which no caller takes (N2-210, fixed).
- ANIMATIONS.md's "colour = the layer's alpha" for an STTR wipe: the composite draws white and the layer's alpha only sets the rule threshold (`0xa6e90`, N2-16).

## Corrections found while fixing the priority 1 items (2026-11-08)

- N2-24 / NATIVE-PARITY row 8: a native run confirms that one-shot effects are dropped while fast-forwarding, and that a loop on record on the channel stops (`0x6a340`).
- N2-124: the held key's speed at `0x41d3c` follows the trigger's value (pad state +0x18, 255 x 4 / 15, capped at 64), not how long it has been held; a full press is 64, as the toggle's (`0x34e054`).
- N2-25: the 127 / 96 is applied per handle by the sound system (`+0x2c`, read by `0xee110` and the others), which cancels the archive's 96 / 127. Native mixes measure 0.98 to 1.02 of the law with neither, so the small remainder (0.4% on streams) is below what the port models.
- N2-130: state 1 is a frame of its own, so the run starts 6 frames after RDAS's frame; a sound before the first wait does play and is cut by the run's stop-all.
- N2-98, a player's report (05_01_CIEL05_4B): the first fix redrew a transition's old picture from the live layers, and the `STCP n 0` calls before a FADS hide them, so the screen dropped to black during the fade. The redraw now uses the frame last shown (renderer.js `shown`); a per-present native capture shows no black.
- Two more behaviours change with this: `0x40ed0` clears the skip flag before the frame step at text not read with fast forward on "Read" (`0x418ec`), so pressing skip or fast forward there no longer passes that line; and a skip turned off during its frame leaves the line waiting instead of showing one more (N2-28).

## Corrections found while doing priority 1 of TODO.md (2026-11-09)

- Item 58: the checkpoint is the first line's MSG record, not "the page's first wait". The two differ whenever that line goes on without a click: 49 pages with `@e`, 935 with `@n` before an `MSAD`, and every page under "Display whole text". An `MSAD` makes no record: after `@n` it copies the MSG's again (`0x6e950`, the gate `0x146e644`).
- Item 58: every MSG keeps a record the rewind can land on, also a line that never waits; the port's trail had none for such a line and a rewind passed its page over.
- Item 66: not reproduced. A delayed sound in a save plays after a load in the same run as a Return to Title, as after a fresh start (two native runs). The earlier "played nothing" came from a run whose scripted press was dropped, which this session's first attempt repeated. The look-ahead `0x57a90` not running again is not a problem in practice: an undelayed SEPL after the load plays as well.
- Item 111: the lead from `0x32e30` (a scissor on even pixels, a scale of width + 0.5) was not the cause of either difference. Style 7's early fade is the blob's own lopsidedness (`alphagradationNNN_2`), read by halves; the turned band's line is `0x34a70`'s turned branch, which hangs its pieces by a corner or a side on points meant for pieces hung by the middle.
- N2-171: A does not pass a movie. The mask `0x4008` at `0x40734` / `0x40778` is B and + (native run: A at 9 s into a seen movie does nothing, B and + pass it). The notes that say "A/+" are wrong about A.
- N2-127: confirmed with Quick Load rather than at a script's end; Return to Title cannot show it, because the title's music takes the other handle within a second.

## Corrections found while fixing items 19 to 23 (2026-11-09)

- From a player's report (not an N2 finding): the port drew the system menu's column over the config's help bar. The menu is draw task 0x11 at priority 84 (`0x4ca50`), the config 90 (`0x2b010`) and the save screen 100 (`0x4ef00`), so the column lies under both screens' backdrops and bars. Fixed in `ui.js` config and savesScreen, compared with native frames (the bar's band over the column within 2 levels, was 20); the gallery's own column already had the bar on top.
- N2-30: the first reading had every piece of the save screen fading out together. On native frames each row's picture and text and the panel go on the first frame of the close: state 5 clears the list (`0xf1f514`) before the fall, so `0x4f240` finds no used slot. The port does the same (`save-out`).
- N2-33: "Flowchart is not yet available" (cGameFlowchart state 3) is not shown over the menu. It comes after the same 12-frame fade, over the background alone, and the foreground returns as it closes.
- A choice on the column acts at once: the next screen's fade starts about two frames after the press. The port waited for the button's 10 pressed frames (0x4cea0 -> 0xae040 only sets the button's state); the pressed cell now carries over to the next page.
- The text window under the opening menu fades with the menu's level, and shows no more until the menu has gone; the blur capture is not what covers it.
- With the Auto Save popup up, the blur leaves at level 0 (`0x4b880` -> `0x2e030`), before the popup goes.
- A row of the list stays lit while the column has the cursor (`0x4f240` draws the kept row's lit cell whatever has the cursor).
- On the column Left goes to the first row and Right to the last on a fresh press, and Up and Down wrap only on a fresh press (`0x4cea0`). The port did neither.
- The panel at the right draws nothing for an empty row (`0x4f240`, `slot < 0x8b` with a used record), where the port drew the unknown picture.

## Corrections found while doing TODO items 11 and 12 (2026-11-09)

The 16 rendering fixes that had only been checked against the listing were compared with native runs (each line above says so), and the 11 rendering functions never re-read were read against the port. What turned out wrong or incomplete:

- N2-8: the 0.6 of state 5 is not a resting look. The indicator's level only rises while the skip runs, so stopped at text not read the >> fades out (at 0.6 of its level) and is gone in 20 frames.
- N2-9: the << is not held for 0.3 s. Its level moves 0.25 a frame, up on a frame that rewinds and down otherwise: one frame at a quarter for one tap.
- Checklist V9 and FIXES.md ("13 taps ... sigma about 3.9 px"): `0xa0a90` rounds 3s up (15 taps) and runs its two passes twice, a sigma of about 5.6 px (N2-214). Ghidra shows the `frintp` as a plain conversion.
- ANIMATIONS.md's "the label again, added" for a choice's glow: the label drawn again is the blurred picture `0x83e50` makes with `0xa0a90` (N2-215).
- `transform.js` took SOXY's units from the thumbnail path (`0x884f0`); the story's draw `0x37f50` adds the raw offset as pixels (N2-213).
- The note on `vm.js` WAITS ("a change staged before one shows at once") holds for staged pictures; STCP's depth on a picture already on screen is not staged and waits for a commit (N2-212).
- The unsettled speed-line blend (`0x87150`): blended, not added, on native frames of types 19, 7 and 6 over half-grey and black (TODO item 13).
- For native checks: SHOK does not move the solid colour pictures (image flag +0x41), so a test of it needs a real picture; the reference save has fast forward on "Full" (config +0x1e = 0), and with it on "Read" a test scene's lines count as unread; presents with a frame dump run faster than real time and can carry two ticks, so a moving mark (STCL over 20 s, 1.289 px a tick) is the clock.

## Corrections found while fixing the dialog items (2026-11-08)

- N2-159: the tap count runs from the last frame without a touch (one more than the press lasted), except for the first press after 256 frames, and the PC build's touch reader counts the release sample too: a 30 ms press after an earlier one counted as a tap (native run t7). The title's items read the long-tap flag 0x4000 (7-199 frames), not 0x2 (the entry said 0x2; 0x8e200 state 0x11).
- The older rows were re-read (0x48540, 0x49750, 0x4abe0): the notices draw no dialog_BG, grow into place ((1 - 0.2 (1 - t))^2) instead of settling from above, and their text sits at y 214 of 448, 72 px below the question's. All fixed in ui.js notify and compared with native frames.
- N2-172: a native run could not isolate the wait (the popup stayed at its first scale while the RDAS held); the fix is from the listing.
- Quick Load? from the mode panel keeps the panel down under the window (0x4e170 state 5) and sends it up on Yes, a difference not listed before; fixed in ui.js confirmSystem.
- Continue's Loading closes as soon as it is up (0x8e200 state 0x1c), and the black and the music's fade follow it (state 0x1e); the port held Loading through the black. Fixed in ui.js continueGame with the tests.

## Corrections found while fixing the rendering items (2026-11-08)

- Panel groups (N2-6): the band's opacity was only the visible part. A panel group (a layer and those linked to it, neighbours in depth, the owner having a clip) is composited as one when its first drawn layer is translucent; measured on native frames (`0xa6570` / `0xa2c30`): the first layer goes in at full, later ones at min(1, own alpha / first alpha, without the link's), and the buffer goes over the scene at the first alpha (owner with an edge width) or its square (no edge width). The earlier note on `0xa2ba0` ("composites through its owner; the web masks each linked layer by the owner's picture instead") was only part of it.
- N2-94 was not reproduced: with the owner's band set and the last layer of the group at alpha 0 or SACL, on layer numbers used nowhere else in the run, the native frame has the band. The re-check's reading of `0x37ea0` / `0x34a70` (no band unless the top layer copied width and style) does not hold for these scenes.
- N2-15's example (a) (QA_01 `STEC(13, 1, 0x000000)` on a live picture keeps the picture) was wrong: `0x3de0` writes the colour to the record at once (+0x1cc) and the draw multiplies the picture by it unless the record's preset is 1, so the picture goes black at once (native frame). Parts (b) and (c) hold: the bake happens only when the picture number changes.
- N2-97 is settled: after a rule-0 FADS frees the rule slot, a layer on an STTR wipe draws plain alpha (native frame: bg .50, picture .51 at alpha 128).
- A picture's table pivot is an absolute point (+0x34 / +0x38 in 640 x 362 units), so a picture whose stored size differs from the table's size (693 records, Z20_L_10_00_N00 among them) stands where the table says: the port's fraction-of-stored-size was off by up to 54 px there (`vm.js` init rescales those fractions, `system.json` `imageSizes`).
- N2-16 needed the rule to be present: an STTR whose rule picture the following FADS (rule 0) frees is N2-97's plain-alpha case; the wipe proper was checked with no FADS after it.
- Both differences noted here at first were settled on 2026-11-09 (TODO items 9 and 10). The blend-shader layers' 5 to 10 levels were measured before the display-curve fix of 2026-11-08 and no longer show on native frames. Panels whose owner sits above its child or is cut off by an unlinked layer follow a frame-wide group machine (FIXES.md, "Panel groups that are not plain runs").

## Corrections found while fixing the text items (2026-11-08)

- N2-121 (a line taking the previous line's colour) was not reproduced: on native frames the line after a coloured one is white. `0xae0940` is set at every message's end (the wait bit 0x100, 0x802c0), so `0x53ab0(1)` rotates the text slot at every MSG, not only at a page end, and the object 0xc35b4 scans holds another line's text or none.
- N2-80's two evidence entries disagreed: `0x7f..`'s entry said SELD stores the choice's read flag in slot 1; the listing (0x80048-0x80050, mov w1 wzr) stores 0, so choice rows always use the unread speed (config +0xe).
- A rewind on native frames (ZL taps on three pages): each tap lands on the previous page's first line and types it again at the read speed; with no earlier message record left it restarts from the oldest record (0x814c0 falls through to the ring's start).
- The row pitch of the text window is 77.5 px on native frames, not the 73.5 px the port had (`0x39180`); balloon text rows are at the same pitch, and the port's balloon box was set off by (-3, -11) px from the table's origin (measured on two styles).
- The Q&A corners' line breaks were not to be reflowed: the game shows the translators' rows as written (see NATIVE-PARITY.md).
- The six text rows that were divergent at the audit and fixed later, and so never had a REVERIFY box (`0x2e170`, `0x38d40`, `0x391a0`, `0x3b330`, `0x6e950`, `0xc0684`), were read against the port on 2026-11-08 with no further difference (each row's note says what was compared). The rendering rows of the same gap and the fast-forward entries (S37) are left for later, at the user's request (text items first).

## Corrections found while doing TODO item 51 (2026-11-09)

The 25 text and script fixes that had only been checked against the listing were compared with native runs of test scenes (each finding's line above and its CSV row say what was measured). 19 match the game. Six were wrong or incomplete:

- N2-115: there is no two-frame wait to see. `0xc3834(2)` is set, but it is over by the next frame's draw: a new line shows nothing on the frame it is set and its first letter on the next. The port had waited two to three frames. On a window not drawn that frame nothing hands the front back as 0, so the first frame's step stays.
- N2-120: the reading fills in across its base, but as the text has it, with the translation's spaces and padding counted: "w o r l d   " is 12 characters, the "d" at 8.
- N2-80: the choice's rows type at the read speed (config +0x10), not the unread one, in three runs with three settings. The listing reads slot 1 of the read flags and the one call that writes it stores 0 (`0x80050`), so the correction to the evidence entries made on 2026-11-08 (under "Corrections found while fixing the text items") is itself wrong on what the game does; where the flag becomes 1 was not found.
- N2-83: `0x802c0` sets the timers below F823 - 1, and F823 already counts the line whose MSG ends the run: the line last on screen is dimmed too. The port had left it to fade.
- N2-85: the auto wait does not go on from what was left after the system menu. It starts again in full once the window is back (the page is set again by `0x813e0` and counts as typed anew).
- N2-75: the record count missed the Z command's. `0x77790` case Z (listing `0x78efc`-`0x78f48`) closes layer changes with a type 9 record at every message and label, as WTTM, VPLY and MSAD do: four records for a page of one picture move, one FADS and one line, where the port counted two.

Found on the same frames, outside the 25:

- `0x81b30` / `0xab8e0`: a line counts as typed when the front is a letter past its last letter, and on the frame after. The mark, the auto countdown and an @e line's next command all came a letter interval and a frame early in the port.
- `0x6e950`: MSAD clamps the front to the old count + 1 and the text object keeps its front, so the added text's first two letters come at once.
- The front is single precision (16.666668 / speed a frame): at 250 ms a letter fifteen steps do not pass letter 1.
- `0x84e50`: the rows' front has two steps on the choice's first frame, a letter is out once the front is past it, and the labels are whole from the first frame.
- `0x81b30` / `0x802c0`: the auto countdown runs whether auto mode is on or not; switching auto on leaves what is left of it.
- `0x81a50` / `0x7c15c`: the scene points' count starts at -1 and ATSV stores at count + 1, so the first ATSV since a start or a load is never returned to.
- For native checks: the read byte of block 0x18 is at save offset 0x67f (0x667 + block), 0 in the reference save, so a test scene's lines are unread unless it is patched; the reference save has "Insta display" and "Insta erasure" on, the game's defaults are off; a MSG takes literal text.

Left open: TODO items 144 to 148.

## Found doing TODO item 120: the game's random numbers (2026-11-09)

The audit and the re-check had the engine's generator right (a TinyMT behind `0xa8f70` / `0xa8f90`) and took every random effect to use it. Two things were missed:

- The sway and the speed lines' counts and distances do not use it. They call the C library's `rand()` (`0x1527f0`, 17 calls), which nothing seeds: the same numbers at every launch. `0x3c970`'s and `0x86850`'s rows said "random" without saying which. The port now draws them from the same function in the same order (`random.js`, `effects.js` `advanceRandom`); native frames agree cycle for cycle.
- The engine's generator is seeded at launch from the console's random bytes (`0xfac30`, `0xfb804`, `0xfe234`), so quakes, the grain and the lines' angles have no sequence to copy.
- `0x3c970`'s row had the sway's ends as a range; they are used as given, r x (b - a) + a, and the port had sorted them. `0x86850`'s row noted the count's upper end as a one-in-hundreds difference; it is now the game's.
- `0x5baf0`'s effect slots: the restore writes the command's numbers and leaves the cycle, so a running sway goes on. The port restarted it from the record's moment. Native run of a rewind in mid-sway.
- `0xb5290` was labelled an asset loader; it returns a raw number of the engine's generator.

Left open: TODO items 142 and 143.

## Corrections found while doing TODO item 110 (2026-11-09)

Fast forward was measured on native runs (ZR held, every frame dumped, a step marker before each wait). These statements elsewhere in the audit were wrong or incomplete:

- Checklist S37 and the note of 2026-11-08 above it had the factors (33 and 64) right. What they did not have: the frames a wait costs besides. A FADS takes its level's steps and two frames more at any speed (3 frames for a change with no time; time + 3 frames at normal speed, because the level's frame is 16.666 ms and the first step comes a frame after the command), an STCF takes a frame even with nothing to wait for, the window commands take one each, and a message takes three frames under fast forward and an MSAD two.
- "Up to 17 a frame with ZR, 33 with the skip toggle" (`rendering-effects-animation.md`, on `0x60610`): the key held all the way is 64 like the toggle, so both step 33. Lower trigger values would give less; the PC build's key is all or nothing.
- "Starts each line's voice" under fast forward (TODO item 110's text, from `0x6e0d0` and `0x802c0`): nothing is heard. The game's sound output over 60 voiced lines of fast forward is silence, where a voiced line at normal speed just before it is heard.
- ANIMATIONS.md, "Fast forward": "FADS while skipping clears the transition at once" was wrong (that is the instant run's); corrected there.
- `0x2f910` (the split's frame) takes no step: a FADE 41 under fast forward fades for 60 frames of the display. The rows of `0x5f420` and `0x2e430` said the port's cut was the only difference; the game's own behaviour had not been stated.
- For native checks: under fast forward a present is one frame of 33; some carry two ticks (66 to the layers and the level, 128 to a WTTM) but still count as one frame for a FADS's two extra frames and a message's three. Count frames for those and ticks for timers. A FADS that brings a new picture holds the old frame two or three frames while it loads, so chains for counting should move a picture already on screen.

## Limits

- The rendering fixes of 2026-11-08 were compared with native frames where a test scene could be built (a throwaway mod layer replacing script 00_00 and the native build's frame dumps), and only then; the items the map marks "from the listing" were not (they need the skip or rewind state, a load, or long runs). The 2026-11-08 re-check of the handled functions compared the listing and decompile with the port's code and surveyed the shipped scripts and tables. It did not compare native frames, so where a function draws, a difference or a match is from reading both sides. Functions marked different had each reported difference read again, but were not traced a second time for further differences. Rows that were divergent at the audit and fixed later (`0x60840` and `0x34a70` are two) were never on the REVERIFY list.
- The function reviews are static analysis of the shipped code. Runtime checks covered the command differences in
  the browser and the native first launch; the other findings were not run side by side.
- Audio was not captured; the loudness figures are computed from the formulas (the port's gains were read back from
  the browser's GainNodes and an OfflineAudioContext render after checklist section 3, not compared with native
  output). The pan law assumes the main output mode the game sets (surround) and the docked PC build.
- Some details are marked "likely" in the subsystem files (mostly appearance of greyed rows and pages, and stick
  input). One panel question is open: how SACL layers are clipped. (The other, whether linked layers are masked by
  the owner's picture, is settled: they are, checklist V12.)
- The native PC build used for the run has title-screen hooks (`title_bg.cpp`); they only remap title videos and
  music, so the first-launch order is the game's own.
