# Native parity check, second pass

*Status note 2026-11-10: a report of its date, not kept up to date since. Much of what it lists has been fixed; what is still open is in [TODO.md](TODO.md), and the fixes are in [FIXES.md](FIXES.md).*


**2026-11-06.** A second comparison of the web port with the game's own engine, after [PARITY-AUDIT.md](PARITY-AUDIT.md)
and [FIXES.md](FIXES.md). It concentrated on what the earlier passes had marked "handler present; native semantic parity
not fully verified": the variable and flow commands, choices, voices, music and sound-effect channels, tweens, easing,
motion tracks and the config defaults, plus a structural check of the menus.

Method: the prepared image `data/tsuki/analysis/main.bin` (SHA-256 `ac6b0120…7951`) decompiled with Ghidra 12.1.4
headless (raw AArch64 at base 0), checked against the recompiler's instruction listing in `data/tsuki/gen/main`
(where Ghidra's C is unclear, the listing decides). Addresses are module-relative. Everything below is static analysis
of the shipped code, not an observation of the game running.

## Fixed in this pass

| # | What the port did | What the engine does | Change |
|---|---|---|---|
| 1 | `WKAD C847 0` (17 places) added a blank text row (`Number(v) \|\| 1`) | `C` variables are relative to the line counter: Cn is F(F823 + n) (`0x7a2b0`). The text window reads F847 + i before drawing line i and moves down that many rows (`0x391a0`), so adding 0 adds nothing | `vm.js` `op_WKAD`, `pageItems` |
| 2 | `SELD`'s second argument was ignored | Every story choice (83, ids 1-82) passes a row of `0x3594d0`; `0x92a60` marks the flowchart lines of all its branches the moment the choice appears (ids 57, 67, 72 and 73 add more by hand). The port only marked the branch taken, so branches not taken never appeared (flag 661 was never set at all) | `native_flowchart.py` exports `choiceFlags`; `vm.js` `op_SELD`; `flowchart-model.js` `reach` |
| 3 | `VPLY` started the voice at once | `VPLY` only names the next message's voice (`0xae04c8`); the `MSG` or `MSAD` that follows starts it (`0x6e0d0`, `0x6e950`). About 30 lines have a wait, transition or window fade in between, where the voice came early | `vm.js` `op_VPLY`, `startPendingVoice` |
| 4 | `MPLY` with no fade-in faded the old track over 400 ms | The old track ends within a frame (`0x9c470` gives it a fade of 416.7 a frame on a 0-100 scale); with a fade-in it fades over `011`'s time or the fade-in's (`0x9c9b0`, `0x9c6d0`) | `audio.js` `playBGM` |
| 5 | `MPLY` of the track already playing faded it to the new volume | Nothing happens, not even a volume change (`0x649e0` compares `0x9c460` first) | `audio.js` `playBGM`; `restore` sets a kept track's volume itself |
| 6 | A loop asked for again on its channel restarted | Ignored when the same sound is looping there with a volume above 0 (`0x6a340`) — scenes re-issue their ambient loops | `audio.js` `playSE` |
| 7 | A second delayed (`068`) command on a channel dropped the one waiting | It runs the waiting one at once (`0x66200` -> `0x65a60`). A command with no delay only zeroes the countdown (`0x6a340`), so the old command still runs when the next delayed one arrives; `SESP` empties the slot | `vm.js` `soundLater`, `op_SESP` |
| 8 | One-shot sound effects were silent during any skip | Only the read-scene skip leaves them out (`0x6a340` tests `0xae0670`); fast forward plays them. **Corrected 2026-11-08 (N2-24):** `0xae0670` is the skip flag, set by the toggle and the held key, so fast forward drops them too; a native run confirms it | `vm.js` `op_SEPL`, `soundAct` |
| 9 | Easing ids 32 and 36 used the in/out curves on each half; 26-29 had no correction terms | The engine's table (`0x30c80`, and its copy `0x961b0` for motion tracks) is Penner's: elastic in-out has a period of 0.45 of the whole tween, back in-out an overshoot of 1.70158 x 1.525, expo carries the 0.001 / 1.001 / 0.0005 terms. Families and order (quad, cubic, quart, quint, sine, circ, expo, elastic, back, bounce; in, out, in-out, out-in) were already right | `animation.js` `ease` |
| 10 | Motion keys in mode 1 used a time-weighted Hermite curve (57 tracks) | A natural cubic spline through the channel's keys, evenly spaced whatever their times: y0 + k(y1 - y0) - k(2m0 + m1) + 3m0 k^2 + (m1 - m0) k^3, with m[i-1] + 4m[i] + m[i+1] = (y[i+1] - y[i]) - (y[i] - y[i-1]) and m = 0 at the ends (`0x972c0`, `0x97710`) | `animation.js` `splineMoments` |
| 11 | A blank tween end kept the start; a blank start was the value in flight | `STGS` and `STRT` with no end go to 0 (`0x637a0`, `0x62b20`): three `STGS` fade a black card and a picture out that way (`10_00_ARC10_3_1` op 1881, `11_00_ARC11_1` ops 1106-1107) and stayed opaque in the port. `STZ4`'s blank end keeps its last target (`0x62d20`). A blank start is the last target (`+0x1e4`, `+0x284`, `+0x7d4`), so a tween cut short jumps to where it was going | `animation.js` `Value.to`; `vm.js` `op_STGS`, `op_STRT`, `op_STZ4` |
| 12 | A click always stopped the voice when "Voices stop on input" was on | Not while F1123 is set (`0x802c0`, state `+0x8c6`); `09_01_CIEL09_1_1` sets it so a line plays on through the change of scene after it | `vm.js` `waitAdvance` |
| 13 | Defaults: BGM 70, SE 80, menu 80, character voices 100, "Display confirmation" on, fast forward "Full" | The initial config (`0x46b080`, the same values the config's reset writes in `0x2c810`): BGM 40, SE 40, menu 10, every character 50, confirmation off (`+0x60` = 0; `0x40ed0` asks only when it is set), fast forward "Read" (`+0x1e` = 1; `0x77790` and `0x40ed0` stop skipping at unread text). Text 35 / 15 ms, auto 3000 / 2200 ms, voices on and stopped by input, letters fading in were already the game's | `audio.js` `VOLUME_DEFAULTS`; `main.js` `DEFAULTS` |

Settings already saved in a browser are the player's and are not changed: a profile that stored the old defaults keeps
them until the config's reset is used. The volumes apply to any profile that never changed a volume.

## Checked and matching

- **Variables.** F is the state block at +2n, G the global block, `_Dnnn` is Fnnn (and `_D600`-`_D700` G0-G100) for
  `SELD`, `SELA`, `SELS` and `GOTS` (`0x77790`, `0x7ad94`); 16-bit values. All `WKST` comparisons are `eq`; `IF__`'s six
  comparisons; `WKOR` on globals. `C859` is only ever set to 0 by the scripts (the engine's own bookkeeping).
- **`MSQK`** argument order: the interpreter calls `0x39110(ms, y, x)` with the script's `MSQK(ms, x, y)` reordered,
  so x is the script's second argument and y its third, as the port reads them.
- **`MFAD`**: `011` is a "wait for the fade" flag (0 = no wait), not a target volume; every script passes 0. **`MVOL`**:
  moves the level linearly from the current volume over `001` (`0x9ca00`); the level then goes through the volume
  curve below. **`SESP`**: every call names its channel (-1 = all).
- **Sound effect and music volume.** *Corrected 2026-11-07* ([FUNCTION-MAP.md](FUNCTION-MAP.md) #14,
  [audio](function-map/audio.md) #1-#3, FIX-CHECKLIST A1-A3): this line said "`017` x row x SE volume, `017` x BGM
  volume, all linear, value / 100", which is wrong for music and sound effects. With L the channel's level (`017`
  after fades, 0-100): music plays at ca0(B(L/100 x BGM/100)), B(v) = 1.54 v - 0.54 v^2 (runtime easing type 12,
  `0xff4b8`), ca0 the 101-point curve at `0x3355f0` (`0xca0`); a plain sound effect at ca0(L/100 x SE/100)
  (`0x9cd40`); a voiced effect (`070`) at L/100 x its character row/100 x the voice switch, linear, with neither the SE
  volume nor the SE mute (with a `001` fade-in it takes the plain effect's curve and the row only turns it on or off).
  Voices (row x switch), interface sounds (`0xacef0`, menu volume) and movies (BGM volume) are linear. Fades move L
  linearly, before the curve. The port does all of this since A1-A3.
- **Auto mode**: the countdown (`+0x5c` at a page end, else `+0x1c`) starts when the text has finished and runs
  alongside the voice (`0x81b30`), as in the port.
- **Menus** (button tables): system menu 5 buttons (`0x591438`: Save, Load, Config, Flowchart, Title), title 5 visible
  items of 7 slots (`0x8e200`: Continue, New Game, Load, Config, Gallery; items 4 and 6 have no art in `titlemenu` and
  are not enabled), mode panel 8 (`0x5918c8`), dialogs 2 (`0x590f08`).
- **Config mapping** (`0x2a730`): every widget's setting, including the two radio pairs (fast forward `0x48` / `0x49`,
  text display `0x4a` / `0x4b`, read text display `0x4c` / `0x4d`).

## Open or not settled

- **`STZ4`'s eighth argument** (55 calls, value 1) — settled 2026-11-06 (FIX-CHECKLIST V2): `0x37f50` leaves the zoom
  out of the picture's own scale, sets draw flag 0x40 and hands the zoom to `0xb3780`; the sprite submit (`0xbbb28`)
  multiplies the x / y parts of the finished matrix's axis vectors by it, the translation untouched: a stretch along the
  screen's axes about the anchor, after the rotation. The port now does the same (`transform.js` `stretch`,
  `renderer.js` `stretchMatrix`).
- **`SELD` ids 57, 67, 72, 73** also set G142, G332 and F265 / F266 bits and F110 (`0x92a60`); their readers were not
  traced. The flowchart lines they mark are applied.
- **Fast forward and voices**: the engine starts each message's voice even while fast-forwarding (`0x6e0d0` tests only
  the read-scene skip), each cut by the next message a frame later. The port stays silent while skipping, a
  deliberate choice (it would fetch and decode a voice file per frame).
- **Tween length** is whole frames in the engine (ms x 60 / 1000, rounded down); the port uses the exact ms, at most a
  frame longer.
- Everything listed as open in FIXES.md and ANIMATIONS.md is unchanged.

## Verification

`node --test web-dev/tests/*.test.mjs`: 104 / 104 (12 new in `web-dev/tests/native-parity.test.mjs`, one per fix above, the
easing checked against independently written Penner formulas at seven points per curve). `/smoketest.html` runs all
549 scripts (1,059,371 commands, 84 choices) with no errors. In the browser (frames driven by a timer, the pane being
hidden): `11_00_ARC11_1` op 1106 now fades layers 20 and 21 from 255 to 0 over 2 s (they stayed at 255); in
`05_01_CIEL05_4B` op 1844 the voice starts with its line at 706 ms, after the 600 ms wait, where it started at once
before; at `05_00_ARC05_6_2`'s choice both branch lines (661, 662) are marked in the flowchart. The browser profile's
storage was saved before the checks and restored after.

## From the translation patch's repository

The patch's sources (github.com/Tsukihimates/Tsukihime-Translation: its editing guidelines, font and line-break tools,
script tweaks and an executable patch) explain several things the port had to guess, and the installed patch folder
(`mods/japan/tsukihimates_patch`, which includes the 1.0.2 update) holds two shaders the audit had taken for missing.

| What the repo shows | Change in the port |
|---|---|
| `tools/add_font_effects.py` defines the private-use banks, 128 code points each from U+E000: 0 italic (a 0.3 rad slant), 1 mirrored, 2 mirrored and italic, 3 a fancy face, 4 single custom glyphs, 5 upside down. The scripts use 0 (3,052 lines), 2 (4), 3 (19), 4 (1) and 5 (2) | Bank 2 is now drawn mirrored and italic (the port had it upright); banks 0, 3, 4 and 5 already matched (`textbox.js` `letterOf`, `.ch.mirror.italic`) |
| `Editing_Guidelines.md`: ruby needed "a space after every letter, a real space as two" and spaces appended to move it left, because the engine set ruby too tight and too far right | The port's ruby is proportional and centred, so the padding is read back: 118 of the 119 distinct annotations ("p r e y  " is "prey", "T h e  s t a r s   t w i n k l e" is "The stars twinkle"); ruby written in italic letters stays italic (`unspaceRuby`) |
| The same guide: lead-ins, cut-off speech and dashes use runs of U+2015 "since the game will combine the unicode ones into a single solid line" | Host fonts left gaps (six dashes drew as six, measured on a canvas). A run is now one element whose dashes overlap by the font's own gap plus 12% of the ink, measured for the element's font, so its shadow is painted once under the whole line (closing up separate dashes still left a notch at each joint, where the next dash's shadow fell on the previous dash's end). In the story text and the backlog, about 5,000 lines (`dashRuns`, `setDashJoin`, `.dashrun`) |
| The patch's `romfs/shader` has `nexl_nxshader_add.bnsh` and `nexl_nxshader_hardlight_ex.bnsh`, whose SPIR-V the native build has | `STBR 28` (`add`) is min(b + s x op, 1), the texel alpha unused; the port had guessed an alpha-weighted mix. `STBR 26` (`hardlight_ex`) is never used |
| `Ryujinx_mods/beatrice/beatrice.hku`, an IPS for the main's build id `F4B3318D…`: ASCII and private-use characters set in single-width cells (`0xbe86c` -> `0xc4dd8`), full-width line spacing cancelled (`0xc05cc`), two line-feed changes (`0xc5a18`, `0xc5a24`), recording and screenshots on | Already in `main.bin`: all six patched spots match, so every native address in these notes is the patched engine. Its monospaced cells are not copied: the patch's FAQ calls the monospaced text a limitation of the engine it never got past, and the port keeps proportional text |

Not adopted, deliberately: the monospaced layout and the patched TsukuMin-D's half-width Latin letters (all 500/1000
wide) for story text; the leading space the guidelines put on choices (it kept "..." apart from the engine's numbering
dots) is left in the text. Known native bugs the FAQ lists (the save screen's broken preview text, a crash opening Load
with a long page) are not reproduced. The script fixes in `allscr/manual_tweaks` are already in the patched scripts the
port runs.

Seen but not added: the patched game shows its display version in the title's lower right (the native port shows
"2023.09.05.5c86a2e06"): the game reads it with `nn::oe::GetDisplayVersion` at start-up (`0xfa24c`), from the patch
NSP's control data.

The `_update_v131072` folder is used by neither port: the native one skips mods folders whose names start with `_`
(`hle_fs.cpp`), and the web tools read the base RomFS with the `tsukihimates_patch` layer only (`romio.py`).

Verification: `node --test web-dev/tests/*.test.mjs` 106 / 106 (new checks for the ruby read-back, italic ruby, bank 2 and the dash runs).
In the browser, `03_00_ARC03_5B`: "woman" carries "prey"; the "―――" after the [ber00] bars is one element drawn as a single line (checked at 4x: no seams); the mirrored line's 35 letters are mirrored and italic and the backlog reads it the right way round; the backlog's dash runs are single lines as well. The browser profile's
storage was saved before the checks and restored after, from a page without the game.

## Line breaks in the English text

The Japanese lines carry no line breaks at all: the engine wraps them. It cannot wrap at word boundaries, so the patch's
injector (Hakanaou/deepLuna, `generate_linebroken_text_map` and `RubyUtils.linebreak_text`) wraps every English line
itself, greedily, at 55 cells (`Constants.CHARS_PER_LINE`; ASCII, Latin-1 and the private-use letters one cell, any
other character two, ruby its base only). A line glued to the one before it (`MSAD`, or `@x`, unless the one before
ends in `^`) starts where that one ended; a page (`PGST`) starts at column 0; when the next glued line goes on with no
space and its first word would not fit, the last word moves down. The translators' own breaks are `%{n}` in their
script files; the Q&A corners are broken by hand throughout (deepLuna skips QA scenes). So the 33,121 breaks in the
patch's text do not follow a Japanese line count: almost all are wraps at 55 cells, which the port's proportional
Georgia in its 1390 px box no longer needs (the rows ended early, often with a word or two on a row of their own).

The port takes a break out when the injector's wrap would have put it there: its row, measured from where the line
started as the injector counted it, had no room for the next word. It becomes the space it replaced. Breaks with room
left stay: those are the translators' (verse, lists, a pause, a row of its own, the staircases, the blank rows).
Also kept: the cuts inside screams longer than any row (13), and five translator breaks that fall where the row was
full anyway, which the width cannot tell from wraps (`DELIBERATE`: the incantation in `05_01_CIEL05_4B`, the end of a
staircase in `08_00_ARC08_6B`, three rows of the lowercase verse in `13_01_01_CIEL13_5B`). Choices and the flowchart's notes are treated apart (below).

Result: 32,408 breaks go, 713 stay. Checked against the translation's 515 scene files: of the 32,210 breaks the
injector made, all are found except one (text 34714, a `%{s}` space that became a break, harmless) and the 13 scream
cuts kept on purpose; of the translators' 883, the 694 with room left on their row all stay, the five above stay, and
184 at a full row go (183 hand wraps in the Q&A corners, one inside italics in `07_00_ARC07_3_1_1`). Sixteen lines
whose text differs from the repository's, or is missing there, follow the same test.

| Text | The patch | The port | Japanese |
|---|---|---|---|
| 299 | `…our secret hideout. How I` / `came to hate Shiritori…` / `grow taller.` | one paragraph, wrapped by the box | 屋根裏が秘密の場所だったこと。… (no break) |
| 3133 | `…before you return to your` / `room, please stop by the office.` / `Akiha-sama would…` | `…your room, please stop by the office.` / `Akiha-sama would…` | `―――秋葉さまから`: the kept break is the Japanese pause |
| 1947 | `\nActually, that's not right…` (glued after a row ending at column 52) | ` Actually, that's not right…` on the same row | というのは間違いか。… |
| 35122 | `he is gonna save me` / `everyone here has already given up…` / … | unchanged (`DELIBERATE` keeps the full-row break) | たすかること。… |

Choices and the flowchart's panel (2026-11-08, at the user's request; deliberate differences from the game, like the story's):

- **Choices.** Four of the 197 choice lines have a break, because they did not fit the patch's row: three where the row
  filled, one (`01_00_ARC01_1`) hand-wrapped with its second row hung under the first by spaces. All four are the last
  row of their menu. `choiceRows` puts each back on one row (`reflow.js` `choiceText`), the widest ending at x 1637, inside
  the story's column. The choice's stored text stays the patch's, so saves are unaffected.
  The five choice lines with italic words go through the story's letter builder (`textbox.js` `fillSegment`), so those words are italic in the row and its glow.
- **Flowchart notes.** `flowchart.json` keeps them with `^` for a break, wrapped at 33 cells: all that fit the game's
  400 px box in the patch's fixed-width face (a native frame shows those rows filling it). In the port's face a row a
  little too wide left a word on a row of its own, and 27 of the 495 notes ran past the box's six rows and were cut off.
  `reflowNote` applies the story's test at 33 cells: 1,404 of the 1,473 breaks go, and the 69 with room left stay (a new
  sentence on its own row, the blank rows). No note runs past its box now.
- **Flowchart titles.** They have no breaks, and each stays on its one row. In Helvetica all of them fit the 400 px box;
  a wider fallback face is set just small enough to fit (`titleSize`).
- **Flowchart cards' font.** The titles and notes are set in Helvetica (Arial, then any sans-serif, where it is missing), at
  the user's request, in place of the game's `ja3/SeuratPro-M.otf`. The figures above for cut-off notes are from that font.
  In Helvetica no note runs past the box's six rows. The game itself draws these cards in the patch's half-width TsukuMin-D.
- **Flowchart cards on quick changes.** The game cross-fades the old and new texts over 1/12 s on every change, so with
  changes in a row (a held direction repeats every 5 frames) two or three texts lie over each other (seen on native frames
  with Down held). The port keeps the cross-fade for a lone change; a change within 12 frames of the last swaps the texts
  at once (`flowchart.js` `PREVIEW_QUICK`). The pictures are as in the game.
- **Gallery font.** The music list, the player's title, credits, time and volume, and the ending list's caption are set in
  Inter (`app/fonts/Inter-Latin-Variable.woff2`, with its licence `Inter-OFL.txt`), at the user's request, in place of the
  game's `ja/TT_TsukuMin-D.ttf`. The time and volume use tabular figures so they do not shift as they count. This subset
  lacks the long dash of one title ("Mystic Eyes ― Awakened") and the full-width ？ of locked tracks, which come from the
  system's sans-serif. The longest row still fits (798 of 900 px).
- The other text with a `^` is four system dialogs (160, 186, 1443, 1497): two sentences each, kept. Nothing else names a
  text line: only `MSG`, `MSAD` and `SELR` do.

Done at run time, not in the build: `text.json` stays the patch's text as dumped, the test needs each line's script
context (glue, `^`, pages), which the VM has per script (`reflow.js` `wrapContext`, cached on the script), and every
story line reaches the screen through `parseMessage` (`VM.lineText`), so the story box, the backlog, the save
screen's note and the intro's page measuring (`rowsOf` / `placePage`) all get the same text. A save made before this
restores its page as it was saved (the page's HTML is in the save) until the next page.

Verification: `node --test web-dev/tests/*.test.mjs` 115 / 115 (9 new in `web-dev/tests/reflow.test.mjs`, including the
counts above on the generated text). `/smoketest.html`: 549 scripts, 1,059,371 commands, 84 choices, no errors. In the
browser at 1920 x 1080: `03_00_ARC03_5B` (30 pages), `01_00_ARC01_3` (12 pages to its first choice) and the intro's
novel layout in `00_02` (12 pages; `00_00` never turns that layout on) each take as many rows as before or fewer, and
no row passes the box's right edge; the backlog's records wrap to its width; a Q&A balloon (`QA_01`) takes two rows
where it took three. Every page of every script measured in the same fonts (19,515 pages, read straight through):
none takes more rows, 10,943 take fewer (14,334 rows in all), the fullest story page is now 11 rows (12 before), the
fullest intro page 12, the fullest balloon 3. The browser profile's storage was saved before the checks and restored
after, from a page without the game.

The Q&A corners (2026-11-08, at the user's request): their breaks all stay. The translators broke these lines by hand for the balloons and the
game shows those rows as they are (compared with native frames: five pages of QA_01 in their own balloon styles, the same rows), so `VM.lineText`
reflows no script named QA*; before this, 183 of their 766 breaks were taken out as if the injector had made them, which ran rows together.
Set in the balloon's own face (`SeuratPro`, proportional, 42 px), every row of all 649 pages lies on its balloon's picture (measured against the
pictures' alpha): 1,415 rows, the tightest 72 px from the edge; one row wraps (`QA_24` op 519, no break of its own between its two messages). The native balloon wraps at
its box too; a row the game could not fit is broken mid-word there and at a word here.

## Coloured text

The engine reads a message's colour marks in its text object, not in the script interpreter: MSG (`0x6e0d0`) copies
the argument with its marks, `0x53cf0` puts each `$id`'s line in its place, and `0xab4d0` / `0xa7790` hand the text,
marks and all, to the object.

- `0xa7f60` chooses how the colours apply (`0xc3a94` stores it at `+0x18a91`). A colour mark `@c1`-`@c5` after
  visible text (spaces, U+3000 and other marks do not count), or `@r` after a colour mark, makes the colours apply
  from each mark on, letter by letter. Otherwise the whole message takes one colour.
- `0xbdc2c` reads the marks. `@c1`-`@c5` are the table at `0x3c99d2` (0 white, which is the message's own colour;
  then red, (50, 136, 255), (16, 16, 16), (170, 170, 170), blue: the port's `.color1`-`.color5` already). For a
  whole message the last of them sets the colour; letter by letter each starts a run at its letter. `@c6`-`@c9` set
  an outline from `0x34dcb0` (red, (40, 40, 40), black, white) and turn on the outlined face. `@r`, or `@c` with any
  other character after it, starts a run back in the message's own colour.
- `0xc3c24` colours each letter from the last run at or before it. `0xbda9c` puts the outline back to black before
  each new text.

The port gave a message one colour, the first `@c` digit in it, and ignored `@r` and `@c6`-`@c9`. Of the 37 messages
in the scripts with a `@c` or `@r` mark, two came out wrong:

| Message | The port drew | The engine draws |
|---|---|---|
| `12_01_CIEL12_4` command 189, `@c1$031427^@r$031428@c1` | both lines red | "Has sunk so low…" red, "Has gone right back to normal again." in the message's own colour (as at commands 182-183, where the two lines are separate messages) |
| `05_01_CIEL05_1C` command 487, `@c7@c3$011123` | white (there is no colour 7) | colour 3, (16, 16, 16), with a (40, 40, 40) outline |

Now `parseMessage` keeps the colour marks with the text and `colourMarks` (`textbox.js`) reads them as above.
Colours that start part way stay in the text as `@c0`-`@c5` runs, which `parseMarkup` carries and `TextBox.add` draws
as spans. A whole message's colour and outline go on its segment. The outline (`.edge6`-`.edge9`) is a 2 px ring in
its colour in place of the shadow; the outlined face's own width was not measured. `plain()` drops the runs, so the
backlog, the save note and the intro's measuring see plain text as before. The other 35 messages with marks come out
letter for letter as they did (compared over the scripts).

Not modelled: the engine decides between whole and letter by letter over a whole line (an MSG and the MSADs added to
it), the port over each message. Every line in the scripts that mixes messages comes out the same either way
(`05_00_ARC05_6_1` 1026-1029, `08_00_ARC08_6` 3127-3172, `10_00_ARC10_7_2B` 2028-2033, `12_01_CIEL12_4` 182-183).
`0xc35b4` (the message's base colour) also looks for the first `@c1`-`@c4` in the text the object held before the
new one is stored; whether that can carry a colour over to the next line in the same slot was not traced. The backlog
shows no colours, as before.

Verification: `node --test web-dev/tests/*.test.mjs` 120 / 120 (5 new in `web-dev/tests/colours.test.mjs`; two assertions in
`parity.test.mjs` that pinned the old reading of command 189 updated). `/smoketest.html`: 549 scripts, 1,059,371
commands, 84 choices, no errors. In the browser, command 189 draws the first line in rgb(255, 0, 0) and the second in
white; command 487 draws in rgb(16, 16, 16) with the (40, 40, 40) ring. The browser profile's storage was saved
before the checks and restored after, from a page without the game.
