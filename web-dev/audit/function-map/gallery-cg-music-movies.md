# A1 gallery / CG / music / movies: native-to-web review

Scope: the 355 functions in agents/A1_gallery_cg_music_movies.addrs. That covers cGallery and its column, the CG grid, CG sub-grid and viewer, the ending list, the movie gallery and player, the music list and panel, the AvPlayer helpers, the TOMP movie task and TOMP itself. Web side: gallery.js, unlocks.js, endings.js, main.js, vm.js, tools/build_gallery.py, assets/gallery.json. Tables were read from main.bin with relocations applied, the same way web-dev/tools/native_flowchart.py does it. SYSMES text comes from the patched allui.mrg.

## Summary

explicit 32, covered 60, divergent 44, missing 6, unused 1, platform 9, helper 203 (total 355).

The largest gaps:
- What the CG gallery unlocks (findings 1-3). About 1,029 of the 1,977 gallery pictures can never appear in the web gallery. 97 of them the original shows as soon as the story has shown their source image or sprite.
- The CG gallery's two-level structure and viewer navigation (findings 4-7).
- The Music Player's controls and end-of-track behaviour (findings 8-9).

## Divergences / missing behaviour

### 1. CG alias table (0x4525c8, 0x51e0) not implemented — missing, confirmed

**Native.** The gallery constructor 0x42d0 loads 105 rows of 40 bytes from 0x4525c8 (accessor 0xb7c8, count 0xb798 = 0x69) into a map from a gallery image to up to four alternates. Examples:
- IMG3954 → SIE_A_63_00_N00
- IMG3690 → IMG1286
- IMG3757 → AOK_A_30_00_N00, BOY_A_30_00_N00

0x4470 lists a variant when the alias rule 0x51e0 holds, even if the picture itself was never displayed. 0x51e0 works like this:
- IMG alternate: it returns the seen bit of the first alternate only (0x75900 → 0x77610, returns immediately).
- Sprite name not in the image table: it tries the name with character 4 replaced by A, L, M and S (0x62110 → 0x77610), then moves to the next alternate.

Seen bits are set when a layer is committed (0x5d3a0 → 0x774f0) and by STCG (0x7b214).

**Web.** Unlocks.image records only IMG#### names that are themselves gallery variants (STCH/SCH2/STCG, vm.js:522, 775, 800). gallery.js:264 lists a variant only if that exact image was recorded.

**Impact.** Of the 105 alias images, 8 are also shown directly. 97 are reachable only through alternates, and all of those alternates occur in the scripts. They make up 97 variants across 52 entries: 34 entries are made of nothing else and never appear in the web; 18 show fewer variants than the original.

**Fix.** Export the 0x4525c8 rows in build_gallery.py. When an alternate is displayed, also record the alias target (any of A/L/M/S at index 4 for sprites; only the first alternate for IMG alternates).

### 2. CG entry gates (0xb58c) not implemented — missing, confirmed

**Native.** 0x4470 first calls 0xb58c with the entry's field +8. Codes 1-19 require the RDST bit of a route's day-start scene:

| Code | Scene | Code | Scene |
|---|---|---|---|
| 1 | 2 | 11 | 10 |
| 2 | 3 | 12 | 11 |
| 3 | 4 | 13 | 12 |
| 4 | 5 | 14 | 13 |
| 5 | 383 | 15 | 275 or 276 |
| 6 | 208 | 16 | 14 |
| 7 | 7 | 17 | 297 |
| 8 | 8 | 18 | 300 |
| 9 | 9 | 19 | 309 |
| 10 | 226 | | |

Code 0 means always shown (listing code_000.cpp:13125; the default branch returns 1). 188 of 458 entries are gated.

**Web.** No gate.

**Impact.** 9 gated entries have an image shown on an earlier day or on the other route, so they appear early (or on the wrong route) in the web:
- Entry 13 (IMG1779, shown in 01_00_ARC01_10 on day 1) is gated on scene 2 (day 2).
- Entry 79 (IMG1873/1874, shown in 05_01_CIEL05_4C) is gated on Arcueid day 11 (scene 11).
- Entry 144 (IMG2083, shown in 11_00_ARC11_2) is gated on Ciel scene 297.

**Fix.** Export field +8 and test flow.started for the gate scene.

### 3. Completing QA_25 (RDED 557) unlocks every CG — missing, confirmed

**Native.** In 0x4470, when neither the alias rule nor the picture's own seen bit holds, the code checks the RDED bit of scene 557 (at 0x4618: `mov w0,#0x22d; bl 0x922c0`). QA_25 ends with RDED 557 (op 2883).

**Web.** No such rule.

**Impact.** 932 of the 1,977 variants are never named by any script and are not aliases. In the original they appear only after completion; 58 entries consist only of such pictures. In the web they never appear.

**Fix.** In cgView, treat every variant as unlocked when flow.completed has 557, after the entry gate.

### 4. No per-entry CG sub-grid; viewer return differs — missing/divergent, confirmed

**Native.** In 0x8d08, choosing an entry checks its unlocked-variant count (0xaf08, built by 0x8964):
- 1 variant: opens the viewer (0x4dfc).
- 2 or more: replaces the main grid with cGalleryCGSub (0xd408, list 0xd468). That grid shows each unlocked variant with its own thumbnail cell in the same 6-column layout.

Back from the sub-grid rebuilds the main grid on that entry (0xb7e0, 0xae8c). When the viewer closes, 0x4b94 → 0xd228 → 0x7e24 → 0x9384 rebuild the grid on the last picture's entry: the sub-grid if it has 2 or more variants, with the cursor on that variant.

**Web.** gallery.js:278/307 opens the viewer on the first variant and cycles that entry's variants inside it. Closing returns to the unchanged grid.

**Impact.** 299 of 458 entries have several variants.

### 5. Viewer Left/Right go through all unlocked pictures — divergent, confirmed

**Native.** In 0xc56c, Left/Right (masks 0x480/0x820, plus swipes) move the flat index by ±1 modulo 0x5108, which is the count of all unlocked pictures. The viewer therefore walks the whole gallery in order and wraps. It ignores Left/Right while Up/Down is held, or when fewer than 2 pictures exist.

**Web.** gallery.js:403-404 cycles only the entry's variants. A click goes to the next variant and closes after the last.

### 6. Viewer transitions and help band missing — divergent, confirmed

**Native.**
- Opening (0xc498): fade 0→1 over 0.5 s (quad in), and the guide's help band (kind 9: 0x5920, 0x604c) fades in.
- Changing picture (0xca54/0xcd58): the screen is captured (0xa4610(1)) and a 0.5 s linear wipe runs through rule_26.nxgz (previous) or rule_27.nxgz (next). Both are loaded in 0xba18 into slots 0x1c09/0x1c0a; the direction flag +0xb picks one. (Checklist G19, 2026-11-07: the old screen stays unchanged 8 frames before the wipe, and the capture is not faded, only cut by the rule's threshold.)
- Closing (0xce60): fade 1→0 over 0.5 s (quad out), guide out.

**Web.** The viewer appears and disappears instantly, pictures swap instantly, and the viewer covers the help bar.

### 7. Variant flag 1 is a horizontal mirror (settles UI-08) — divergent, confirmed

**Native.** In 0xbe84, a non-zero variant byte +0x1c calls the picture sprite's vtable +0xc0 = 0x1f688(1), which sets state bit 8. The sprite draw 0x254bc (vtable 0x46a938) negates the X scale for bit 8 and the Y scale for bit 9 (set by 0x1f770) before calling 0xb0460.

The data agrees. The flagged variants are IMG0850-0854 (entries 28-29) and IMG1740 (entry 70). The five 085x images appear in 04_00_ARC04_10 with a negative STZ4 x zoom (for example `STZ4 17,-950,950,...`).

0xbe84 also keeps zoom and position when the next picture is in the same entry and has the same size.

**Web.** gallery.js:353-375 ignores the flag and resets the view on every picture.

**Fix.** Apply scaleX(-1) when the flag is set.

**The 19 offset rectangles.** The fields are x +0xc, y +0x10, w +0x14, h +0x18, in 1.5x pixels. They are set as the source rectangle (0x251a4) and w×h is fitted to the screen, as the web does. See Limits for the (x+w, y+h) sizing.

### 8. Music Player controls, keys and end of track — divergent, confirmed

Relevant native code: list 0x1a7fc, focus routing 0x19a14, panel 0x1c9fc/0x1e98c, volume 0x1cc68, per-frame 0x1d314, play 0x1dab8/0x1dec4.

**Keys.**
- Native list: Up/Down, wrapping 0↔94 on a fresh press. A plays. Left goes to the column, Right to the panel.
- Native panel: play, pause, stop and repeat on the top row; prev and next below. Left from play or prev returns to the list. Down from the bottom row goes to the volume slider.
- Native volume slider: Left/Right change the volume by ±0.01, clamped to 0-1 (fmin in the listing). Up returns.
- Web: no wrap. Left/Right in the list change the volume by ±0.05. The buttons are mouse-only.

**Choosing a row (0x1dab8).** In the original, choosing the playing row or a locked row stops playback and clears the panel; any other row restarts from its beginning. In the web, Enter on the playing row pauses, and a locked row does nothing.

**Play button (0x1e98c case 0).** In the original it always restarts the selected row, even while playing or paused. In the web it resumes when paused and is ignored while playing.

**End of a track without repeat (0x1d314).** The original fades out over 1.5 s (0x9c9b0(v·100·1000/60/1500)), starting at the loop end (field 8 / 48 ms). For rows 90-94 the ms field is 0, so the fade starts 1.5 s before the loop end; those rows are the four vocal songs and "Teach me, Ciel-sensei! (Staff roll)". Then playback stops and the panel resets. There is no next-track logic. The web plays the stream to its end with no fade (about 2 s past the loop end on 46 rows), then plays the next unlocked track.

**Now-playing text (0x1dec4).** The original shows the title at scale 1.2. Below it, one line per credit: "Singer:", "Lyrics:", "Composer:", "Arrangement:" (SYSMES 245-248) followed by the name, 32 px apart, with the block centred by line count. The web (gallery.js:543) shows the distinct names joined with " / " and no labels. This affects all 95 rows.

**Other differences.**
- Locked rows read SYSMES 244 "？？？"; the web shows "? ? ?".
- Volume (0.6 at 0x469c10) and repeat (0xae0370, in bss) are session-only in the original; the web stores both in localStorage.
- The original has no seeking: 0x19e98 always starts at offset 0, and panel state 4 (0x1cdd4) is never entered. The web's draggable position bar is a web addition.

### 9. Title music in the gallery; Music Player audio lifetime — divergent, confirmed (title music continuing: likely)

**Native.**
- Opening the Music Player (0x19838 state 0) cuts the current music within a frame (0x9c9b0 at 3333 per frame). Before that, 0x19518 saves the playing music and marks it heard (`bl 0x9c460; bl 0x64f60`), so the title's music 2 unlocks rows 0 and 7 on entry.
- Switching to another section calls that section's vtable +0x80 (0x8400 → 0x19e5c, flag bit 2). This applies to CG, Music, Movie and Ending, but not Flowchart or Title.
- When the Music Player closes (state 4) it stops its track. If flag bit 2 is set, it restarts the title music (0x8e1c0: track 72 at title stage 5, otherwise track 2) at the normal BGM volume (0x9c870(100)).
- Nothing in 0x4210/0x42d0 stops the title music, so it keeps playing in the CG, Movie and Ending sections.

**Web.** main.js:421 stops the title music on entering the gallery (audio.stopBGM(400)). gallery.js:show never stops the jukebox when the section changes, and its onEnd keeps stepping through the detached list's tracks.

### 10. Movie gallery: list, confirmation, playback — divergent/missing, confirmed

**Native list (0x17dd0).**
- Index 0 is movie 4 (prologue) and is always listed.
- Index 1 is movie 5 (op1_arc), listed when G005 bit 0 is set.
- Index 2 is movie 6 (op2_ciel), listed when G005 bit 1 is set.
- The G005 bits are set by 0x40a00.
- Cells are 248×144 at (384+240c, 104).

**Confirmation.** Choosing a movie first asks dialog 25 = SYSMES 1443, '"Glass Moon" (Opening) do you want to play it?' (0x1873c).

**Player (0x18b0c-0x19280).** In order:
1. Saves the playing music.
2. A cover fades in over 0.5 s (quad out): white for op1_arc, black for the others. The music fades out over the same 0.5 s.
3. Plays the movie at the movie volume (sound byte +7 / 100). A press (mask 0x4008) stops it. In the prologue, music 2 starts at 360 s.
4. The cover fades out over 0.5 s and the saved music restarts.

**Web.**
- The list order is op1_arc, op2_ciel, prologue.
- The prologue is listed only after TOMP 4 has played. That happens in 00_01, so in practice it is always listed.
- There is no confirmation, no fades, no music 2 at 360 s, and no music restore.

### 11. Section open/close transitions — divergent (minor)

- Each section fades 1→0 over 0.5 s (quad out) before the next opens: 0x90e0, 0xa4f4, 0x187ec, 0xeb80, 0x19ac4, 0x1ae50, 0x1cef8.
- CG thumbnails fade in with a diagonal cascade of (column + row) × 0.02 s (table 0x3373a0, 0xb318).
- The CG grid scrolls smoothly over 1/6 s (0xa968).
- The web removes the old section instantly, fades the new one as a whole, and jumps when scrolling (gallery.js:227-239).

### 12. "Flowchart is not yet available" — missing (minor)

Choosing Flowchart while scene 1 has not started (0x14cfc(1)) goes to menu state 7: SYSMES 1496 via 0x4abe0(0x5d8). The web always opens the flowchart.

### 13. Grid and list keys — divergent (minor)

- **CG grid (0x9cbc).** Left on column 0 returns to the gallery column, and Right does not wrap to the next row. The web moves to the previous or next row.
- **Ending list (0xe7a4/0xf470/0xf5a4/0xf6f8).** Left/Right move within a row, skipping unseen entries, and Left past the first entry returns to the column. The web uses a nearest-in-direction search and never returns to the column with Left.
- **Movie list (0x183ec).** Left on the first entry returns to the column.

### 14. Story movies (TOMP task 0x402a0/0x40480/0x40940) — divergent, confirmed

**Native.**
- The task saves and clears the skip and auto flags (0xae0660 & ~3) and restores them in 0x40a00. Story movies therefore play even while skipping; only the looping title movies 0 and 1 are dropped.
- A press (0x4008) skips a movie only if the movie is not 4/5/6/35/36/37, or its G005 bit is already set. A skip fades out over 60 frames.
- The prologue starts music 2 at frame 0x545f (360 s), or immediately on an early skip.
- Movie 13 plays menu sound 7 at frame 210.
- A cover fades in over 60 frames: white for movies 5 and 37, black otherwise.

**Web.** playMovie returns immediately during skip mode (main.js:125), and any click or key passes any movie. There is no music 2 during the prologue; music 2 only starts with the MPLY 2 in 00_02, at least 24 s later. There is no cover fade.

**Impact.** 42 story TOMP calls; 7 of them (movies 4/5/6/35/36/37) cannot be skipped on first viewing in the original.

## Unused native code

- 0x1cdd4, music panel state 4: no panel function sets state 4.
- 0x6ef30's branch for movie 7 (phaseout.mp4): no script uses TOMP 7.
- The touch paths (0xb48c, 0x1b5b4, 0xf350, 0x1e7d4, 0x1f0d4) are Switch touch input; the web maps them to the mouse.

## Limits

- The draw effect of 0x1f648(x+w, y+h) in 0xbe84 (sprite size, and anchor at the middle of that) was not traced through 0x254bc. The 19 offset rectangles may sit differently from the web's centred crop.
- The viewer's backdrop (0x466738: a 1920×1081 rectangle recoloured 0.847 grey) may or may not be visible. If it is, letterbox bars would be light grey rather than black.
- Movie volume: the original uses sound byte +7 = (1 − config +0x64) × config +0x30 (0x2a9b0; config +0x30 defaults to 40). Whether config +0x30 is the BGM slider is for the config/audio review.
- The Music Player volume goes through the known non-linear curve (0x9c8f0); the web is linear.
- Nothing was checked at runtime (no browser, as the brief requires).
- The "completion-only" set means images named by no STCH/SCH2/SPFC/SPRD/STCG argument and not in the alias table.

## Re-check of the handled functions (2026-11-08)

92 functions of this part compared with the port: 39 the same, 53 different, 0 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-55: Movie picture has no 0.05-a-frame fade in and no 30-frame fade out (medium, confirmed)

Functions: `0x17c0`.
- Native: 0x17c0 sets the movie sprite's alpha (+0x280) to 0, *0xae0200 = 0.05 and *0xae0228 = 1. 0x1ec0 adds 0.05 per drawn frame, clamped 0-1 (0x21ac-0x21d4), so the picture comes in over 20 frames. When playback stops, by its end or by 0x1a80, 0x1ec0 state 0 (0x209c-0x2124) lowers the alpha by 1/30 a frame and keeps drawing the last frame for 30 frames; states 1-3 then free it and clear *0xae0218, and only then does 0x19e0 report the movie finished. The gallery player 0x19040 turns its cover black once the alpha reaches 1, so the picture fades to black before 0x19280 lifts the cover.
- Port: app/js/main.js:143 playMovie sets v.style.display = "block" at full opacity and finish() (main.js:166-182) hides it at once; no opacity on #movie in style.css:11. gallery.js:1276-1282 goes straight from the movie's end to the cover's 0.5 s fade.
- Effect: In the Movie gallery, a press mid-movie or the end of op1_arc / op2_ciel cuts to black where the game fades the picture over half a second, and the gallery comes back about 33 frames sooner. Story movies (TOMP) show no such cut: their cover is already opaque when the picture stops, on both sides, so only their end comes about 33 frames sooner, unseen. The fade in is hardly seen: title movies rise slightly more slowly under the title's own fade from black.
- Reached: All movies pass through 0x17c0 (callers 0x18ea4, 0x402a0, 0x8e200, 0xb5650). Last-frame brightness measured with ffmpeg: op1_arc 47/255, op2_ciel 38/255, prologue 0; a press shows whatever frame is up. Opening frames match their covers (op1_arc 253 on white, prologue and op2_ciel 0 on black, TM_CI 244 on white), so the fade in is visible only on the title movies.
- Second reading: 0x17c0 sets alpha 0, *0xae0200 = 0.05, *0xae0228 = 1 (0x191c, 0x1938, 0x19a0); 0x1ec0 state 0 lowers it by 1/30 a frame (0x20ac-0x2118) and 0x19e0 stays true until states 1-3 clear *0xae0218; 0x19040 blacks the cover when 0x1c10 (alpha) reaches 1. main.js finish() hides #movie at once, no opacity on it. But story movies do not end with that cut: 0x40480 raises its own cover at leaveAt (rate 1 a frame for 4/5/6/35/36/37, s8 at 0x405ac) and on a press over 60 frames (0x4078c, 0x4079c), and only then waits for 0x19e0, so the picture's fade runs under an opaque cover; main.js step does the same (leaveAt, passing). Durations: prologue 23060 frames vs leaveAt 23040, op1_arc 6434 vs 6420, op2_ciel 6350 vs 6300, ed01 18980 vs 18961, ed02 8894 vs 8880, ed03 15296 vs 15240; phase titles (304 frames, 312) end on a black last frame.

### N2-56: Gallery does not reopen on the section it was left on (medium, confirmed)

Functions: `0x49b0`.
- Native: State 1 of 0x49b0 (0x4a8c-0x4a94) stores the open section's id (0x82e4: section +0x2c, -1 if none) in *0xae0288 (0x44df30, initially -1) when the column dies. 0x6124 reads it at the next opening: column index +0x30 = that id, 0 if negative; 0x49b0 resets it only after the constructor has read it. A section left with Back stays in +0x88, so its id is kept; the Title row moves the section to the closing slot (0x8400), giving -1.
- Port: app/js/ui.js:612 opens with env.gallery("cg", { fromTitle: true }), and gallery.js:433 takes that argument as start, so saved.section (gallery.js:582) is not consulted from the title.
- Effect: Leave the gallery with Back from the Music Player, Movie or Ending List and open it again from the title: the game reopens that section with its row marked; the port opens the CG Gallery.
- Reached: Any gallery exit by Back followed by GALLERY in the same run. The only writers of 0xae0288 are 0x49b0, 0x5040 and 0x50c8 (the last only when it holds 2, the flowchart).
- Second reading: confirmed.
- Fix (2026-11-09): gallery.js session.section is the open section kept for this run only (the native *0xae0288 is in .bss, so the old localStorage value is gone); open() writes it, the column's Title row clears it, and the title's Gallery passes no section (ui.js), so openGallery falls back to it, or to the CG Gallery.
- Compared: Native run (reference save): Back from the Music Player to the title, then Gallery, opens on the Music Player with its row marked; the port's real title path does the same, and after the Title row it opens on the CG Gallery.

### N2-57: Replays start at once, without the gallery's half-second exit (medium, confirmed)

Functions: `0x5040`.
- Native: 0x826c sends the column to state 8 (0x7ac4: column 1 to 0 over 0.5 s, quadratic out, band hidden) or, with the flowchart open, state 6 (0x7918: the black rectangle +0x80 0 to 1 over 0.5 s). 0x49630(-0.04, 0) lowers the menu background and 0x9c9b0(3.333) fades the music over 30 frames. The replay starts only when the object dies and 0x4210 returns scene + 2.
- Port: app/js/gallery.js:1358 done(true) calls env.playEpisode (main.js:607-613) and main.js:563-565 handles the flowchart; both call ui.close and startAt at once, and startAt stops the music with audio.stopAll (main.js:383).
- Effect: Yes on an ending, or Decide on a scene in the gallery's flowchart, cuts straight to the story with the music cut; the game fades the column or a black cover and the music over half a second first.
- Reached: Every replay from the Ending List (0xea4c) or the gallery's flowchart (0x11418).
- Second reading: confirmed.
- Fix (2026-11-09): gallery.js replayOut (Ending List) and flowchart.js replayOut lower the menu's background at 0.04 a frame (REPLAY_MENU_BG) and fade the music at 3.33 a frame (fadeMusicOut) before the story starts.
- Compared: With N2-62 and N2-63, on the same native and port runs. The music's rate was read from the code (0x9c9b0, the movie's fade uses the same call).

### N2-58: Column window, inner panel and underline are placed differently (medium, confirmed)

Functions: `0x6124`.
- Native: Descriptors 0x44e2f8 / 0x44e320 / 0x44e348: gallerymenu_window (texture 7181) at (56, 0), config_innerbg (7184) at (365, 0), underline (7183) at (0, 72), drawn from their top-left corners (anchor 0 set by 0x1fa4c, 0x254bc).
- Port: app/js/gallery.js:456 places the window at (56, 82) and the underline at (0, 71); gallery.js:452 places the inner panel at (360, 0). ANIMATIONS.md's gallery column table lists the native values.
- Effect: On every gallery page the column's moon picture sits 82 px lower than in the game and is cut off at the bottom, the right-hand panel starts 5 px further left, and the underline is 1 px higher.
- Reached: Always while the gallery is open (static data).
- Second reading: confirmed.
- Fix (2026-11-09): gallery.js places gallerymenu_window at (56, 0), config_innerbg at (365, 0) and underline at (0, 72).
- Compared: Native frame of the gallery against the port's: the window's lower part, its edges, the inner panel's edge and the underline all have their best offset at (0, 0), 1.0 to 3.5 levels on average.

### N2-59: After an Ending List replay the list does not come back on the ending played (medium, confirmed)

Functions: `0x6934`, `0x7f38`.
- Native: 0x6124 keeps the replay's scene (*0xae0288+4, stored by 0x5040) at +0x38. 0x6934 sets the enter bit when it is >= 0 and 0x7f38 builds the Ending List as 0xd5e8(section, 1, scene), which selects that scene's entry, and gives it the focus (vtable +0x28); the band takes the section's kind and 0x6bbc hides the column's line and light (state 4).
- Port: app/js/main.js:612 returns through gallery("ending"), and gallery.js:1434 show(section, false, false) sets focus "menu"; endingView calls select(0) unfocused (line 1366).
- Effect: After a replayed ending the game puts the cursor back on that entry of the Ending List; the port leaves it on the column with no entry selected.
- Reached: Every Yes in the Ending List (0xea4c -> 0x5040 with the scene from table 0x3374e8).
- Second reading: confirmed.

### N2-60: Choosing the open section reopens it (medium, confirmed)

Functions: `0x6e28`.
- Native: 0x6f34-0x6fe8: when +0x34 equals +0x30 the section is kept. On a button press (not a tap, 0x6f40) it gets the cursor if it can take it (vtable +0x20, +0x28), the line and light are hidden, state 4, sound 1. A tap on that row only plays sound 1. Nothing closes or is rebuilt in either case.
- Port: app/js/gallery.js:609 choose calls show(id, true), and lines 571-576 fade the open section out for 0.5 s and rebuild it through open(), with no test for the same section. cgView starts again at entry 0 and scroll 0; closeSection (line 566) stops the Music Player's track.
- Effect: Pressing Choose on the row of the section already open, where the cursor starts when the gallery opens, enters it at once in the game; a click on that row only plays the sound. In the port both fade it out and in, replay the grid's cascade, lose the grid position, stop a playing track and put the cursor in the section.
- Reached: Any Choose or click on the open section's row, the usual way into a section.
- Second reading: 0x6f34-0x6fe8 as claimed for a button press: +0x34 == +0x30, section +0x20 / +0x28, line and light hidden, state 4, sound 1. gallery.js choose -> show(id, true) (lines 609, 571-576) has no same-section test, and open() rebuilds. But the first reading's click case is wrong on the native side: at 0x6f40 cbnz w23 (*0xae02c8+0x48, the frame a touch begins; a left click on PC) skips the hand-over, so a tap on the open section's row only plays sound 1 and the cursor stays on the column.
- Fix (2026-11-09): gallery.js choose(touch): the row of the open section enters it (focusContent) on a key and only plays sound 1 on a click; nothing closes or is rebuilt.
- Compared: Native frames of A on the open CG row: the cursor appears on the frame after the press and the grid stays as it was, with no fade; the port the same (same grid element, cursor shown, line hidden).

### N2-61: The section and band come back half a second early after the Flowchart closes (medium, confirmed)

Functions: `0x7624`.
- Native: 0x7624 starts the column's 0 to 1 tween when the flowchart starts closing (its +0x60, bit 3 set at the start of 0x11bec) but creates the section only at 0x78e4, when the flowchart's +0x38 (state < 7) turns false 0.5 s later; only then the section's header tween and the grid's cascade start, and 0x5c4c(0.5, band, 10) brings the band back (0x11bec took it away with 0x82d0).
- Port: gallery.js:1434 show(section, false, false) builds the section when openGallery runs and ui.ghost (gallery.js:1438) fades the flowchart's page out over it; titleArt and the band come in with the column from the start (gallery.js:505-508, 1424-1431, 1437).
- Effect: Back from the Flowchart: the section's title, the thumbnails' cascade and the help band appear during the 0.5 s the flowchart fades out, instead of after it has gone.
- Reached: Every Back from the gallery's Flowchart.
- Second reading: confirmed.

### N2-62: No fade to black before a Flowchart replay starts (medium, confirmed)

Functions: `0x7918`.
- Native: State 6: a black 1920 x 1080 rectangle (descriptor 0x44e410, layer 6, coloured black by 0x6124) goes from 0 to 1 over 0.5 s (0x26720 type 2 mode 1, 0x26894(0, 1, 0.5)), the band goes out (0x5ea4(0.5)), then the section's +0x30 and state 9; only then does the gallery end and the scene start.
- Port: flowchart.js:213 decide -> jump -> main.js:564-565 flowchart: ui.close() and startAt run at once, with no cover.
- Effect: Choosing a scene in the gallery's Flowchart cuts straight to the replay instead of going to black over half a second.
- Reached: Every replay started from the gallery's Flowchart.
- Second reading: confirmed.
- Fix (2026-11-09): flowchart.js replayOut: a black cover (.fc-replay-cover) from 0 to 1 over half a second, quadratic out, guide.hide() with it, keys and Back refused meanwhile; then the replay starts.
- Compared: Native frames of Decide in the gallery's flowchart against the port hand-stepped: the preview's level fits within about 0.05 at every time, reaching black at about 0.45 s on both.

### N2-63: A replay from the Ending List starts without the column's fade (medium, confirmed)

Functions: `0x7ac4`.
- Native: 0xea4c -> 0x5040 -> 0x826c: the section closes (+0x30) and menu state 8 runs the column's 0.5 s fade and the band's fade out; the scene starts after it (0x48ac0 case 4 -> script 3000).
- Port: gallery.js:1358 done(true) -> main.js:607-612 playEpisode: ui.close() and startAt at once.
- Effect: Yes on an ending's question cuts straight to the episode instead of fading the column out over 0.5 s.
- Reached: Every Ending List replay.
- Second reading: confirmed.
- Fix (2026-11-09): gallery.js replayOut: from the dialog's answer the column, section and band leave as they do for the title (closeTo), and playEpisode runs only then.
- Compared: Native frames of Yes on an ending against the port hand-stepped: the fade starts as the dialog does and everything is black about 0.45 s later on both. The native menu sky falls a little faster in dumped frames (about 1.36 game ticks a present).

### N2-64: The old grid is removed at once when a sub-grid opens or closes (medium, confirmed)

Functions: `0x8ba0`.
- Native: 0x8d08 on Choose of an entry with 2+ pictures (0x8f48-0x8f80) and on Back from a sub-grid (0x8dfc-0x8e34) calls the old grid's +0x30 (0xabe8: state 3) and moves it to +0x60; 0x8ba0 keeps updating it (0x8cdc-0x8cec), and 0xa4f4 fades all its thumbnails with its cursor already hidden, 1 to 0 over 0.5 s quadratic out, while the new grid's cascade (0xb318) comes in over them.
- Port: app/js/gallery.js:662 build() clears the thumbnails (thumbs.textContent = '') before the new ones start at 0, called from pick (line 720) and back (line 764).
- Effect: Choosing an entry with several pictures, or Back from its sub-grid: the game crossfades the old thumbnails out under the new cascade; the port blanks the grid and the new one fades in from nothing.
- Reached: Every main-to-sub and sub-to-main change: 299 of the 458 table entries have two or more pictures (gallery.json; native 0xaf08 >= 2).
- Second reading: confirmed.
- Fix (2026-11-09): gallery.js retire(): when a sub-grid opens or closes the old thumbnails and scroll bar stay in their own layer and go from 1 to 0 over half a second, quadratic out, under the new grid's cascade; the viewer's return still replaces the old grid outright, as 0x9384 does.
- Compared: Native frames of A on a two-picture entry and of Back, against the port hand-stepped: the old grid's level per time matches within 0.05, and the same picture is reached with the cursor on the first cell.

### N2-65: Closing the viewer from a one-picture entry does not keep the main grid's scroll (medium, confirmed)

Functions: `0x9970`.
- Native: 0x8d08 (0xaec8 into +0x38 / +0x40) saves the scroll for every main-grid pick, also a one-picture entry, and 0x9384 -> 0xae8c -> 0x9970 restores it (0xae8c rounds the magnitude up to a whole pixel, ceil(|s| + 0.001); 0x9970 then rounds down to whole rows, cursor kept in view).
- Port: gallery.js:719 sets mainScroll.at only when a sub-grid opens; gallery.js:725 closes the viewer with build(..., mainScroll.at), so a one-picture entry uses a stale value (0 unless a sub-grid was opened before).
- Effect: After closing the viewer on a one-picture entry in a scrolled main grid, the grid jumps: to scroll 0 (cursor row near the top), or so the cursor's row sits at the bottom (y 804) when it is below row 5.
- Reached: 159 of the 458 table entries have one picture (gallery.json), and any scrolled grid.
- Second reading: The difference holds: 0x8d08 runs 0xaec8(grid, +0x40, +0x38) for every main-grid pick before testing 0xaf08 == 1; 0x9384 (main grid, label 0x9440) passes +0x38 to 0xae8c; gallery.js:647, 719, 725: mainScroll.at is written only when a sub-grid opens. 159 of 458 entries have one variant (gallery.json). One detail is wrong: 0xae8c does not truncate, it is frintp on |s| + 0.001.

### N2-66: Back from an episode the list has lost its cursor (medium, confirmed)

Functions: `0xd5e8`.
- Native: 0xea4c -> 0x5040(id) keeps id in *0xae0288+4; when the gallery is rebuilt 0x49b0 passes it to 0x6124 (+0x38 = id). 0x6934 sets the menu's focus bit when +0x38 >= 0 and 0x7f38(menu, 1) builds the list with param_3 = id: 0xd5e8 sets +0x38 / +0x3c to that entry (1000-1010 -> bad ends 0-10, 1012-1021 -> 11-20, 1011 / 1022 / 1023 -> row 0, 1024 -> final) and bit 5; 0x7f38 then calls vtable +0x28 (0xeec0), which keeps that cursor and focuses the entry's button (0xae0e0).
- Port: main.js:612 then: () => gallery("ending") -> gallery.js:1434 show(section, false, false) -> open(): focus = enter && view.size() ? "content" : "menu" (line 587), so the column has the focus; endingView starts at sel 0 (line 1342).
- Effect: After an Ending List episode the game returns with the cursor on the entry just played; the port returns with the cursor on the column and no entry selected (the first entry once the list is entered again).
- Reached: Every replay from the Ending List (25 entries, table 0x3374e8).
- Second reading: confirmed.

### N2-67: Row look: opaque colours instead of 0.5 alpha (medium, confirmed)

Functions: `0x1a1a4`, `0x1b2f0`, `0x1b43c`.
- Native: Each row's colour alpha is set to 0.5 (0x1fa20(0.5): the alpha of the four corner colours +0x2c0 / +0x300 / +0x340 / +0x380); 0x1b1cc and 0x1b2f0 keep every row at 0.5 and the selected row at 1.0.
- Port: style.css:163-165: .gl-track color #c9d0dd at full opacity, the selected row #fff with a blue glow (text-shadow); no 0.5 alpha, and the glow is the port's.
- Effect: Rows other than the cursor's are noticeably brighter in the port than the game's half-transparent white; the selected row has a glow the game does not.
- Reached: Every Music Player view.
- Second reading: confirmed.
- Fix (2026-11-09): style.css .gl-track: white at 0.55, the focused cursor's row white, no glow; the locked and playing colours are gone (0x1a1a4 lists a locked row the same way, and nothing colours the row playing).
- Compared: Native frames of the Music Player: letter peaks 148-151 against the port's 148-149 on the same rows, 255 on the cursor's row on both. 0.55 is measured: the code's 0.5 alone gave 140. A row playing with the cursor on the panel looks like any other row.

### N2-68: The list scrolls at different rows (medium, confirmed)

Functions: `0x1b2f0`.
- Native: 0x1b2f0: going down, when y > 940 the target is (sel - 13) x 59, so the cursor stays on visible row 13 with one row showing below it; going up, when y < 232 the target is (sel - 1) x 59 (0 for row 0), so the cursor stays on visible row 1 with one row showing above it. 0x27bd4 clamps to 0-4720.
- Port: gallery.js:1124-1125: scroll changes only when sel leaves the 15-row window (sel < scroll, sel >= scroll + 15), so the cursor goes to the top and bottom visible rows.
- Effect: Holding Down or Up, the list starts scrolling one row later in the port and the row beyond the cursor is not shown.
- Reached: Every move past visible row 13 or above visible row 1 of the 95-row list.
- Second reading: confirmed.

### N2-69: A tap on a row that is not selected plays it at once (medium, confirmed)

Functions: `0x1b5b4`.
- Native: 0x1a7fc calls 0x1b5b4 first: a touch landing on another row only moves the cursor and returns 1; 0x1dab8 runs when a new touch lands on the row already selected.
- Port: gallery.js:1021: click does select(k) and chooseRow(k) together; a touch screen fires mouseenter and click from one tap.
- Effect: One tap, or one left click, on a row that is not selected starts the track in the port. In the game the first press only moves the cursor there (sound 0) and a second press plays it. A mouse is affected too: on PC a left click is a touch, and the game has no hover to select the row first.
- Reached: Any press on a row other than the selected one, touch or left button.
- Second reading: 0x1a8c0-0x1a8c4 ends the frame when 0x1b5b4 moved the cursor; 0x1a8f4-0x1a988 runs 0x1dab8 only for a new touch (+0x48) on the unchanged row within the rectangle; gallery.js:1021 does select and chooseRow together. The first reading's 'a mouse is not affected' is wrong: hle_hid_tsuki.cpp:220-259 makes the left click the touch and 0xae0dc8 is never written, as N2-51.

### N2-70: Repeat off after a loop does not start the fade (medium, confirmed)

Functions: `0x1c400`.
- Native: 0x1d314: with bit 5 clear and bit 6 set, the fade starts when 0x9ca70 > +0x58; 0x9ca70 is the sound's play frames x 1000 / 60, a counter that keeps rising through loops (0x10c0b8), so once a track has looped the fade starts on the next frame.
- Port: gallery.js:341-344 restarts the source at position(), which is wrapped into the loop, and gallery.js:321 compares that wrapped position with musicFadeAt.
- Effect: Turning Repeat off after a track has looped: in the game it fades out over 1.5 s at once and the panel clears; in the port it plays on to the end of the loop before fading.
- Reached: Any track left on Repeat for one pass, then Repeat pressed.
- Second reading: confirmed.

### N2-71: Entering the panel does not start on Play (medium, confirmed)

Functions: `0x1d5ec`.
- Native: 0x1d89c sets +0x3c = -1 whenever the panel loses the cursor and 0x1d5ec makes -1 into 0, so Right from the list always lands on Play; +0x40 (the volume's return button) is used only by Up from the volume.
- Port: gallery.js:1199: Right from the list sets btn = lastBtn, and lastBtn is the button the volume was last entered from (gallery.js:1209).
- Effect: After the volume has been used once in a visit, Right from the list lands on Prev or Next instead of Play.
- Reached: Any visit that has gone Down to the volume and later comes back to the list and Right again.
- Second reading: confirmed.

### N2-72: A tap on a button not under the cursor presses it at once (medium, confirmed)

Functions: `0x1e7d4`.
- Native: 0x1c9fc returns after 0x1e7d4 moves the cursor (returned 1); the action needs a new touch while the same button is selected (0x1c9fc: iVar8 == +0x3c).
- Port: gallery.js:1076: click calls press(btn) at once.
- Effect: One tap, or one left click, on a button not under the cursor presses it in the port. In the game the first press only moves the cursor to it and a second press runs it. A mouse is affected too, since on PC the left button is a touch.
- Reached: Any press on a panel button other than the one under the cursor, touch or left button.
- Second reading: 0x1ca58-0x1ca68 returns when 0x1e7d4 moved the cursor, and 0x1ca98-0x1caa8 presses only for a new touch with +0x3c unchanged; gallery.js:1076 presses at once. The first reading's 'a mouse is not affected' is wrong: hle_hid_tsuki.cpp:220-259 makes the left click the touch.

### N2-73: Play glyph goes out while paused (medium, confirmed)

Functions: `0x1f380`.
- Native: 0x1f380 changes only +0x98; the Play on-sprite +0x90, shown by 0x1dec4, stays shown until 0x1dc40 or the track's end, so both glyphs are lit while paused.
- Port: gallery.js:1170: Play is on only for state 'playing', so pausing turns its glyph off.
- Effect: While a track is paused the game shows Play and Pause both lit; the port shows only Pause.
- Reached: Every pause.
- Second reading: confirmed.

### N2-74: Instant run does not stop the sound at its start, so a TOMP that ends the run leaves the old music and loops playing (medium, confirmed)

Functions: `0x6ef30`.
- Native: 0x802c0 at 0x8086c calls 0x5ef10(0) as the instant run starts: music at once (0x9c610, 0xac0688 = -1), voice (0x9c3b0), all 20 SE channels (0x9cf90). During the run MPLY / MFAD / SEPL only record. 0x6ef30 clears 0xae0568 with no restore and the run's exit path 0x80a4c-0x81400 has no sound call (0x5d7e0 is called only at the named stops ATSV, SEL*, RTM_ ...), so the movie and everything after it are silent until the script's next MPLY / SEPL.
- Port: vm.js:687 beginInstant only takes audio.snapshot(), nothing stops (onInstant has no handler). vm.js:1622 op_TOMP -> endInstant(false) drops the recording, and the run's MFAD / SEFD only changed the recording (vm.js:1584, 1557), so the track and loops playing when the run began go on under the movie and after it.
- Effect: Music and ambience loops that were playing when the run started keep playing under the movie (and after it in 00_02 and 15_01A_CIEL15A_1; the other five that can have sound end at the movie with RDED, RTM_), where the game is silent until the script's next MPLY / SEPL. TOMP 36 is followed at once by MPLY 119, so that movie has music in both and only the loops differ. At the run's other stops 0x5d7e0's 0x9c470 finds number -1 and starts the recorded track from its top, where audio.js restore (no restartMusic) keeps it going. A voice playing at the run's start is cut natively (0x9c3b0); in the port it goes on only with 'Voices stop on input' off, with F1123 set, or when the run starts during typing, because from a click wait beginInstant -> advance() ends waitAdvance, which stops it (vm.js:1024).
- Reached: Eight story movies have no ATSV / SELD / SELS / SELA / XSTP between their scene's RDAS and the TOMP (survey repeated, same eight: 04_00_ARC04_4_1 and 04_01_CIEL04_4_2 TOMP 5, 05_01_CIEL05_2_2_2 TOMP 6, 00_01 TOMP 4, 00_02 TOMP 39, 14_00_ARC14_1 TOMP 35, 15_01A_CIEL15A_1 TOMP 36, 15_01B_CIEL15B_1 TOMP 37). 00_01 shows no difference: no sound command and no line stand before its TOMP 4 and a new game starts silent. For the other seven a run starts at the completed scene's RDAS with Read scenes auto skip on (config +0x5e, default off), with whatever the JUMP into the scene carried over, or from the mode panel's Jump to Next Scene at any line of the scene. The same-track restart applies to every instant run that ends with the music it started on.
- Second reading: Core holds: 0x80864-0x8086c calls 0x5ef10(0) (music 0x9c610 sets 0xac0688 = -1, voice, 20 SE channels), MPLY / MFAD only record while 0xae0568 is set (0x64e24, 0x652f8), TOMP clears it with no 0x5d7e0 (0x6ef98), the exit path 0x80a4c-0x81400 has no playback call; vm.js:687-695 stops nothing and vm.js:1622 drops the recording, and playMovie (main.js:143) stops no sound. Wrong in detail: at a click wait beginInstant -> advance() ends waitAdvance, which stops the voice with the default 'Voices stop on input' (vm.js:1024, main.js:87), so the voice runs on only in the narrower cases; TOMP 36 is followed at once by MPLY 119 (played in both); 00_01 can show no difference.
- Fix (2026-11-08): vm.js beginInstant calls audio.stopPlaying (0x5ef10(0): music, voices and all 20 channels stop, the records stay). The run's stops restart the recording from its top; TOMP's stop puts nothing back and keeps the run's last volumes.
- Compared: Native run with the reference save, sound output recorded (NX_AUDIO_DUMP): the loop stops as the run starts and restarts from its top at the ATSV (correlation 0.987 at 2.6 s); with a TOMP ending the run it does not come back and the scene is silent until the script's next sound. Checked with a looping effect because the music takes the recording's 10-second window from the title; the listing covers the music. The port's calls in an isolated browser match.

### N2-153: Title movie keeps playing under Config and Load (low, confirmed)

Functions: `0x1b20`.
- Native: Config and Load opened from the title raise the menu background themselves: 0x2b680 at 0x2b734 and 0x50e00 at 0x50ebc call 0x49630(+0.024, 0) (only with *0xae04e8 == 0), which calls 0x1b20(1): the title movie freezes on its current frame while it stays drawn (0xe61ec returns the last frame), and resumes with 0x49630(-0.024, 0) at 0x2c558 (Config) and 0x519e8 (Load).
- Port: app/js/main.js:407 titleVideo has only on and off. ui.js config(tab, true) and savesScreen("load", true) do not touch #movie, so it plays on behind the menu background.
- Effect: With Config or Load open from the title, the background movie goes on moving behind the translucent menu background where the game holds it still.
- Reached: Any Config or Load opened from the title menu; the title movies are titlebg1-4 and the menu background (menuBG01) is about a third opaque.
- Second reading: The cited calls are not Config or Load: 0x8f5f4 is item 5 (GALLERY) and 0x8ebc0 / 0x8ec74 are title states 0x2a / 0x2c. The freeze is real through Config's and Load's own calls: 0x2b680 at 0x2b734 0x49630(+0.024) when *0xae04e8 == 0 and the background level is 0, 0x50e00 at 0x50ebc likewise; 0x2c500 at 0x2c558 and 0x50fc0 at 0x519e8 call it with -0.024. 0x49630 -> 0x1b20(1/0) -> player +0x90 pause; player +0xd8 (0xe61ec) still returns the last decoded frame so it stays drawn. ui.js config/savesScreen do not touch #movie (only titleVideo on/off at main.js:407). menuBG01 alpha averages 85.5/255.
- Fix (2026-11-09): main.js titleHold pauses the movie as Config or Load opens from the title and lets it go on as they close.
- Compared: Native frames: frame-to-frame difference of the sky beside the panels 0.02-0.06 of a level while Config or Load is open (the movie held), 4-7 after they close; the port's video paused and playing at the same moments.

### N2-173: Help band returns half a second late after a gallery movie (low, confirmed)

Functions: `0x4c8c`.
- Native: 0x19280's first pass sets the flag bit (index min(+0x20, 3) - 1) that 0x194e0 tests, when the cover starts its 0.5 s fade out. 0x4c8c sees it and calls 0x82bc(menu, 10), so the band's 0.5 s fade in runs alongside the cover's fade out.
- Port: app/js/gallery.js:1268 the movie overlay's hidesGuide is true until phase "done" (line 1284), and bandStep (line 1425) keeps the band hidden until overlay is null, so its fade in starts once the cover is gone.
- Effect: After a gallery movie the help band appears half a second later than in the game.
- Reached: Every movie played from the Movie section.
- Second reading: confirmed.

### N2-174: A band change during the going-out half reverses the band (low, confirmed)

Functions: `0x5c4c`.
- Native: 0x5c94-0x5ca8: with the pending bit set, 0x5c4c only stores the new kind at +0x34; the band finishes going out, then comes in with the latest kind.
- Port: app/js/gallery.js:135 tests this.shown, which is false in phase "out", so to() falls through to lines 136-138: it sets the kind, drops the pending kind and calls fadeIn from the current alpha.
- Effect: Moving the cursor away and back within the band's half-second change (CG grid with scrolling rows and the column, or the Music list and panel) turns the band round at once and swaps its labels early, where the game lets it go out and come back.
- Reached: Two focus changes between kinds 0 and 10 inside 0.5 s; kind 0 occurs on the CG grid when its rows scroll and on the Music list.
- Second reading: confirmed.

### N2-175: Cursor line and light are drawn under the row buttons (low, confirmed)

Functions: `0x6124`.
- Native: The line and the light have depth 240 (0x44e398, 0x44e3c0) and the buttons 250 (0x44e370). The layer list is ordered by depth (+0x3e0, 0x23f30), lower in front, so the line and light are drawn over the rows.
- Port: app/js/gallery.js:466 appends the line and light before the row buttons (lines 478-492), which then paint over them.
- Effect: The cursor's line and light pass behind the row's label instead of over it.
- Reached: Always while the column has the cursor.
- Second reading: confirmed.

### N2-176: Keys stay locked for the notice's whole fade-out (low, confirmed)

Functions: `0x6764`.
- Native: State 7 (0x6820-0x6834): after opening the notice the column waits for 0x4ad30 (0xb34b44) to be 0, then state 2. 0x49750 clears 0xb34b44 at the moment the notice starts to close (a press or its timer), before its fade at 0.07 a frame (0x49750 state 3), so the column takes keys again during the 14 frames of the fade (0x6e28 has no other lock).
- Port: app/js/ui.js:1056-1059 notify replaces ui.keyFn with one that swallows every key, and ui.js:1072 restores it only when fx.closed, after the fade-out.
- Effect: After dismissing 'Flowchart is not yet available', keys pressed during the next 0.23 s do nothing in the port; in the game they move the column (a press the notice took closes it, the next frame's keys are live).
- Reached: Choosing the Flowchart row before scene 1 has started (0x8400: 0x14cfc(1) at 0x84e8, state 7 at 0x86fc; gallery.js:600), i.e. on a save that has not begun the story.
- Second reading: confirmed.
- Fix (2026-11-08): ui.js notify: the keys go back to the screen the moment the notice starts to close (fx.busy, 0xb34b44), not after its fade, and the promise resolves then too: the caller goes on while the notice fades, as 0x50fc0 and the gallery column do.
- Compared: From the listing (0x6764 state 7, 0x49750 clearing 0xb34b44 when it starts to close) and a unit test. Not reached natively: the case needs a save on which scene 1 has not started, which the prologue-first start cannot give in the sandbox.

### N2-177: Light is not restarted when the column finishes coming in (low, confirmed)

Functions: `0x6bbc`.
- Native: When the 0.5 s timer ends, 0x6bbc calls 0x57d0(1.2, +0xa8): the light's alpha goes back to 1.0 and a new swing to 0.4 starts.
- Port: app/js/gallery.js:533-548 does nothing to cursorFx when colFx ends; draw (line 554) restarts it only when the row changes.
- Effect: Half a second after the gallery opens the light jumps back to full brightness in the game (it has dimmed to about 0.79 by then); the port carries on dimming.
- Reached: Every opening of the gallery, and each return of the column from the flowchart through state 1.
- Second reading: confirmed.

### N2-178: Right into a section plays no sound (low, confirmed)

Functions: `0x6e28`.
- Native: 0x71a0-0x71b0 after handing the cursor to the section: w0 = 0 and a tail call through 0x6ff0 to 0xacef0, interface sound 0.
- Port: app/js/gallery.js:1404 calls focusContent (lines 1383-1386), which plays nothing.
- Effect: Moving from the column into a section with Right is silent where the game plays the cursor sound.
- Reached: Any Right on the column with a section that has entries.
- Second reading: confirmed.

### N2-179: Column wraps on a held key (low, confirmed)

Functions: `0x6e28`.
- Native: 0x71b4-0x71f8 and 0x7280-0x7290: repeat pulses (+0xc) stop at rows 0 and 5; the wrap needs a fresh press (+0x10 with 0x100010 or 0x400040).
- Port: app/js/gallery.js:1401-1402 wraps with modulo on every keydown, repeats included.
- Effect: Holding Up or Down runs round the column in the port and stops at the end in the game.
- Reached: Holding Up or Down on the column.
- Second reading: confirmed.

### N2-180: A click on a column row opens the section with the cursor in it (low, confirmed)

Functions: `0x7328`.
- Native: 0x6e28 (0x7040, 0x70b4) passes pointer != 0 (+0x48) to 0x8400, which sets bit 1 of +0x24 (0x843c-0x8448). 0x7328 at 0x7354-0x7380 passes w1 = bit clear to 0x7f38 (0x7f38 -> vtable +0x28 only with w1), and 0x7424-0x74ac goes to state 4 (line and light hidden) only when the bit is clear, else state 2.
- Port: app/js/gallery.js:489 click -> choose(); gallery.js:609 show(id, true); gallery.js:587 focus = 'content'.
- Effect: With the pointer: a first press on another section's row only moves the column's cursor there; a press on the cursor's row then opens the section, and the cursor stays on the column, its line and light lit, the section has no cursor and the band stays kind 10 until the pointer or a key moves it. In the port one click opens the section, the line and light go, the section shows its cursor and the band changes to the section's kind.
- Reached: Every pointer opening of a section from the column. In the game that is a press on the row the column's cursor is on (a second press, or the first after keys put the cursor there); in the port any click on a row whose section is not open. Choosing with keys is the same in both (the port passes enter = true on both paths).
- Second reading: The path holds (0x7040 / 0x70b4 -> 0x8400, first bit of +0x24; 0x7354-0x7380 -> 0x8130 vtable +0x28 only with w1; 0x7424 state 2 when set; gallery.js:489 -> 609 -> 587). It leaves out that a press on a row that is not the column's cursor only moves the cursor (0x6e9c-0x6ed8, sound 0); 0x7008 runs only for a press on the cursor's row (same root as N2-51).

### N2-181: Line and light are not restarted when the cursor comes back to the column (low, confirmed)

Functions: `0x74f0`, `0x82fc`.
- Native: 0x74f0 at 0x7598 calls 0x82fc whenever the section has lost focus, also when the row is unchanged: the line's x scale is set to 0, program 0x3372d8 regrows it over 12 frames, the light's tween restarts from 1 (0x57d0).
- Port: gallery.js:554 draw restarts cursorFx only when cursorFx.row !== menuSel; toColumn (gallery.js:622) puts menuSel back on the open section's row, the row it left.
- Effect: Going back from a section to the column (Left at the edge or Back) shows the line at full width at once instead of growing over 0.2 s; the light continues its swing instead of starting at 1.
- Reached: Every return from a section to the column with keys.
- Second reading: confirmed.

### N2-182: Hovering a column row does not take the focus from the section (low, confirmed)

Functions: `0x74f0`.
- Native: 0x74f0 at 0x75ac: when the touched id (0xae0b0, set only while a touch or the left button is down) is a column row 0x17b-0x180 while the section has the cursor: +0x30 = row, sound 0, 0x82fc, section +0x50 (the grid's 0xaca0 hides its cursor), and the next frame state 2 with band kind 10.
- Port: gallery.js:488 mouseenter with focus 'content' plays sound 0 and moves the hidden menuSel without any press; gallery.js:489 click, on release, plays sound 1 and runs choose(), which opens that section with the cursor inside it.
- Effect: Pressing a column row while a section has the cursor moves the cursor to the column in the game, on the press and with sound 0, the section staying as it is; in the port nothing happens until the release, when the click opens that section and puts the cursor in it. A pointer that only passes over a row does nothing in the game.
- Reached: Any left-button press (or touch) on a column row while a section has the cursor; mouse movement alone never reaches 0x75ac.
- Second reading: Not a hover: the title and the 'pointer over' effect are wrong. 0xae0b0 returns 0x19150f0, which 0xae840 sets only while a touch is down (+8, else -2), and 0xad4e0's mouse path needs 0xae0dc8, which nothing writes, so on PC the 0x75ac branch needs the left button held (hle_hid_tsuki.cpp: left click = touch; same correction as N2-51). A pointer merely over a row changes nothing in the game. What is true is the press: 0x75ac-0x7614 takes the cursor to the column at once, and the port has no press path.

### N2-183: The section title is drawn 3 px lower (low, confirmed)

Functions: `0x8818`, `0xd5e8`, `0x17cd0`.
- Native: Header sprite 0x337330: type 0, x 64, y 0, z 200, texture 7186 (720 x 80, whole texture; no rect), anchor top-left (0x1fa4c mode 0); nothing moves it afterwards (0x8ba0 and 0x90e0 only set alpha).
- Port: gallery.js:584 sprite(P, TITLES[id], 64, 3, 720, 80): y 3 (.gl-title has no offset, style.css:145).
- Effect: The CG Gallery title (and the other sections', same line) sits 3 pixels lower than the game's.
- Reached: Always in the gallery.
- Second reading: confirmed.

### N2-184: A rebuilt grid does not round its scroll to whole rows (low, confirmed)

Functions: `0x9970`.
- Native: 0x9970 at 0x9a90-0x9b68 (cursor focused): the saved scroll, already rounded up in magnitude to a whole pixel by 0xae8c (ceil(|s| + 0.001)), is rounded down to a multiple of 139 (trunc((0.001 - s) / 139)), then moved row by row so the cursor's sprite (y 103 + 139 r) lies in 109..804: a row above the top ends at y 248, one below at 804.
- Port: gallery.js:680-684 keeps half-row scrolls and places a row above the top with cgScrollTarget(r, rows, ...): y 178.5.
- Effect: After returning from a sub-grid or the viewer with the grid scrolled to a half row (any upward scroll, the last rows) the grid sits up to 69.5 px off, and a row above the view shows at 178.5 instead of 248.
- Reached: Grids scrolled past their first rows on return from a sub-grid or the viewer.
- Second reading: 0x9970 0x9a90-0x9b68 read: n = trunc((0.001 - s) / 139), scroll -139 n, then add or remove rows so the cursor sprite (0x1c4, 103 + 139 r from 0xa968) is >= 109 and < 804, which puts the thumbnail at 248 or 804. gallery.js:680-684 keeps half rows and gives 178.5. 0xae8c is ceil, not a truncation; rounding down is 0x9970's.

### N2-185: The grid takes keys before its cascade has ended (low, confirmed)

Functions: `0x9bdc`.
- Native: 0x9bdc holds state 1 until the tween has ended and no thumbnail has its tween running (0x9c28-0x9c7c); 0x9cbc (keys, taps) runs only in state 2; the last of 42 thumbnails ends 0.72 s after the build.
- Port: gallery.js:503 ready() does not look at the section's fade or the cascade; keys and clicks act at once (gallery.js:768-772, 1399).
- Effect: For up to 0.72 s after a sub-grid is built, the viewer closes or a chosen section opens (0.5 s + 0.02 s a diagonal, 0.72 s with 42 thumbnails) arrows, Enter and Back already act in the port from the first frame; in the game they do nothing yet. When the gallery itself opens, the port's column fade blocks them for 0.5 s, so there only 0.5-0.72 s differs.
- Reached: Any key press within 0.72 s of a grid build.
- Second reading: 0x98f0 runs 0x9cbc only in state 2; 0x9bdc 0x9c28-0x9c7c holds state 1 while the tween or any thumbnail tween (+0x148) runs. gallery.js:503 ready() has no cascade test. But the 0.5-0.72 s window applies only when the gallery itself opens, where colFx blocks input for 0.5 s: after a sub-grid build, a viewer close or a chosen section (switching over) ready() is already true, so the port acts from the first frame. The wait is 0.5 s + 0.02 s a diagonal, 0.72 s with 42 thumbnails.

### N2-186: Cursor and scroll bar do not fade in when a grid is rebuilt (low, confirmed)

Functions: `0x9bdc`.
- Native: Each new grid object starts its cursor frame, light and scroll bar at 0 (0x9578 / 0xaf78) and 0x9bdc / 0xa720 bring them to 1 over 0.5 s, quadratic in, also for a sub-grid or the rebuild after the viewer.
- Port: gallery.js:660-691 build restarts the thumbnails' cascade and the light only; over.style.opacity and the bar stay at the section's level (view.fadeIn runs only with the section's fade, gallery.js:510-514).
- Effect: Opening a sub-grid or coming back from the viewer, the cursor frame and scroll bar show at full at once, and the light flashes at full instead of scaled by the grid's 0.5 s fade.
- Reached: Every sub-grid and viewer return.
- Second reading: confirmed.
- Fix (2026-11-09): gallery.js gridFx: every grid has its own 0.5 s quadratic-in fade for the cursor frame, light and scroll bar, also a sub-grid and the viewer's return; replaces the section-level fade the port had.
- Compared: Native frames: the cursor frame's glow per time against the port's, within about 0.05 (the native a frame or two ahead); the opening from the title keeps its GALLERY_OPEN start.

### N2-187: The cursor does not return to column 0 when the grid gets the focus back (low, confirmed)

Functions: `0xa8c4`, `0xaca0`.
- Native: 0xaca0 stores -1 in +0x30 (column) and 0xa8c4 makes a negative column 0 (0xa8c4-0xa8cc), so after Back from column c the cursor reappears on column 0 of its row.
- Port: gallery.js:748 focus keeps grid.sel; toColumn (gallery.js:622) does not change it.
- Effect: Back from a cell in columns 1-5 and re-entering the grid: the port keeps the old column, the game is on column 0.
- Reached: Any Back from the grid off column 0 followed by re-entry.
- Second reading: confirmed.

### N2-188: The cursor's light stops at once with the frame (low, confirmed)

Functions: `0xaca0`.
- Native: 0xaca0 clears the visible bit only on +0x60 (0xad30-0xad60); the light +0x68 keeps its program for up to 15 frames.
- Port: gallery.js:702 hides the cursor block (frame and light together).
- Effect: Leaving the grid within 15 frames of a cursor placing: the light disappears at once instead of finishing its 15-frame flash.
- Reached: A quick Left or Back right after a move.
- Second reading: confirmed.

### N2-189: Moving the pointer onto another entry plays no sound (low, confirmed)

Functions: `0xb48c`, `0xf350`, `0x1b5b4`.
- Native: 0xb570-0xb574: acef0(0), the cursor sound, each time the cell under an active touch changes (left button held on PC; 0x275a4 and 0xae0b0 report nothing without one).
- Port: gallery.js:673 mouseenter: focusContent(); select(k), no ui.sound (the column's rows do play it, gallery.js:488).
- Effect: Pressing a thumbnail other than the selected one, or dragging across thumbnails with the button down, plays no cursor sound in the port; the game plays it for each new cell. A pointer moving over the grid with no button does nothing in the game, where the port selects cells silently.
- Reached: Every press or held drag onto another thumbnail in a grid.
- Second reading: The sound is at 0xb570-0xb574 and the port has none at gallery.js:673, but 0xb48c runs only with a touch in progress (0x275a4 needs +0xc > 0, 0xae0b0 only while +8 is set; on PC the left button), so moving the pointer without a press does nothing in the game (no selection, no sound). Also a press on another cell only moves the cursor (0x9e38-0x9e4c skip the pick); the port's click picks at once.

### N2-190: Pointer selection scrolls the grid and reflashes on the same cell (low, confirmed)

Functions: `0xb48c`.
- Native: 0xb56c calls the grid's +0x28 (0xa8c4), which runs 0xa968 with previous row = row: no scroll; and nothing happens when the cell is unchanged.
- Port: gallery.js:673 select(k) uses the old selection as previous row, so cgScrollTarget scrolls over 1/6 s when the pointer enters a row past y 804 or above y 178.5 from another row, and flashCursor reruns when the pointer re-enters the selected cell.
- Effect: Moving the pointer into the partly hidden bottom row or a top row moves the grid in the port; in the game a touch never scrolls it.
- Reached: Pointer moves over rows at the edges of a grid that scrolls.
- Second reading: confirmed.

### N2-191: Ending button art 2.67 px off in its normal and pressed cells (low, confirmed)

Functions: `0xe1b0`.
- Native: Item frame tables: ending_btn cells at sx 8 / 128 / 248 (normal / lit / pressed), ending_badendbtn at 8 / 104 / 200, sy 8, each cell drawn at the button's own (x, y) at its size (0xaeec0).
- Port: gallery.js:1316 face sprite of width atlas / 3 (122.67 / 98.67) centred on the button (left -5.33), background x = -k x width (1346, 1351): the texture's x 8 lands at +2.67 for normal, x 248 / 200 at -2.67 for pressed; only the lit cell is exact.
- Effect: Each seen ending button's art sits 2.67 px right of the game's when not selected and 2.67 px left when pressed, jumping as it lights up.
- Reached: Every seen entry (art tables 0x466a40 / 0x466aa0).
- Second reading: confirmed.

### N2-192: Ending buttons have no arrival flash (low, confirmed)

Functions: `0xe1b0`.
- Native: The items' +8 flags are 0x20 (0xdaf8, 0xdda4), stored by 0xadca0 at button +0xc; 0xaeec0 (af3bc-af3c0, then af440 / af53c) draws the current state's cell again through 0xb6de0 with blend 0x1e, which is additive, when that flag is set, at a level falling 0.1 a frame from 1 (0xae840).
- Port: gallery.js endingView button() has only the face (no additive flash element or ButtonState, unlike the column rows, gallery.js:482-486).
- Effect: Moving the cursor onto an ending button lights it at once in the port; in the game it also flashes for 10 frames.
- Reached: Any cursor move on the Ending List with a seen entry.
- Second reading: True in effect; the cited draw is wrong: the cells' flags at +4 are 0x10, so `tbz w1, #5` at af540 takes 0xb6de0 (w2 = 0x1e, additive per web-dev/ANIMATIONS.md:504), not 0xb72a0. Port: endingView button() has only the face and select() only moves its background (gallery.js:1316, 1346); .gl-ending-face has no animation.

### N2-193: Keys and hovers are taken during a section's fade-in (low, confirmed)

Functions: `0xe614`, `0x18264`, `0x1a628`, `0x1a704`, `0x1c7d0`.
- Native: Only state 2 calls the key handler (0xe7a4); state 1 (0xe6f4) runs the 0.5 s fade and enables the group's buttons (vtable +0x70, 0xf314) only when it ends. Same for Movie (0x18264 / 0x18344 / 0x18a4c) and Music (0x1a628 / 0x1a704).
- Port: gallery.js:503 ready = () => colFx.done && !leaving && !switching ignores secFx: after a section change open() (line 587) gives it the focus and the fade-in runs while line 1393's keyFn and the buttons' mouseenter / click handlers accept input.
- Effect: A press within half a second of choosing a section moves the cursor or activates an entry in the port; the game ignores it until the section has faded in.
- Reached: Choosing Ending List (also Movie and Music, see those rows) from the column and pressing within 0.5 s.
- Second reading: confirmed.

### N2-194: Ending List fades as one layer, so a button hides the card under it (low, confirmed)

Functions: `0xe6f4`.
- Native: 0xe6f4 gives the level to each of the 27 objects through vtable +0xb8 (sprites 0x1fa34 -> +0x3c0; button list 0x216e4 -> each button). Each is then blended on its own at that alpha (0x254bc at 0x25938: +0x2cc x +0x3c0; buttons 0xaeec0 -> 0xb03e0), so under a button face the card shows through at (1 - a) x a.
- Port: gallery.js:514 (fade) sets opacity on the whole .gl-content: cards, labels and buttons are composited first and the result fades as one layer, so no card shows under an opaque button pixel. The close (switching.tw) goes through the same line.
- Effect: During the 0.5 s fade in and out the button art over each seen card (122 x 128 at (714 + 480k, 120)) and over seen bad-end cells (98 x 104) differs by up to 0.25 x (card - background) at a = 0.5, about 30 levels on the bright card, for a few frames around the middle of the fade.
- Reached: Every opening or closing of the Ending List with a seen entry: cards at (416 + 480k, 120), 432 x 544, lie under the buttons at (720 + 480k, 128), and bad-end cells under theirs (endings.js LAYOUT; 0xdaf8 / 0xdda4 / 0xe1b0).
- Second reading: confirmed.

### N2-195: Re-entering the list goes to the first seen entry (low, confirmed)

Functions: `0xeec0`.
- Native: Leaving the list (Left past the first, B: vtable +0x50, 0xf278) sets +0x38 / +0x3c to -1; when the column gives the focus back (0x6e28 calls section +0x28 = 0xeec0) the cursor is empty and the scan puts it on the first seen entry.
- Port: gallery.js:1342 sel is kept for the view's lifetime; toColumn (622) and focus(on) (1369: focused = on; select(sel)) return to the entry left.
- Effect: Going to the column and back by keyboard returns to the first seen entry in the game and to the last entry in the port.
- Reached: Any Ending List with two or more seen entries, using Left / B and Right.
- Second reading: confirmed.

### N2-196: Row separators sit 6.6 px higher and 1 px to the right (low, confirmed)

Functions: `0x1a1a4`.
- Native: music_bgline (tex 7187) at x 408, y 173 + 59i, z 440 (descriptor built at 1a230-1a24c, advanced by 59 a row).
- Port: gallery.js:1018-1019: the row box at absolute y 124.85 + 59.1k, the line at box y pitch / 2 + 12 and x 409 - 437: absolute (409, 166.4 + 59.1k).
- Effect: The separator lines between the rows are 6.6 px higher near the top (5.2 px by row 14) and 1 px right of the game's.
- Reached: Every Music Player view.
- Second reading: confirmed.

### N2-197: Selected row not lit after the pointer comes from the panel (low, confirmed)

Functions: `0x1b5b4`.
- Native: 0x1b6b4: the list's focus-gained (0x1b1cc -> 0x1b2f0) runs, so the selected row goes to alpha 1.
- Port: gallery.js:1020-1021: with focus already 'content', focusContent returns early and .focused, removed by the Right key (gallery.js:1199), is not added back.
- Effect: After keys moved the cursor to the panel, a press or drag onto a row gives the list the cursor in the game and the selected row goes to alpha 1. In the port the area changes but no row lights, after a press as after a hover (which the game does not have), until the focus is given again.
- Reached: Touch or the left button on a row after keys moved the cursor to the panel.
- Second reading: 0x1b6b4 calls list vtable +0x28 = 0x1b1cc, whose tail (0x1b2ec) is 0x1b2f0, so the row lights; gallery.js:1383-1384 returns early with focus 'content' and only 1199 / 1208 / 1184 touch .focused. But 'moving the pointer' needs the left button down in the game (0xae878 test on *0xae02c8+8, as N2-51).

### N2-198: Row hit area is larger (low, confirmed)

Functions: `0x1b5b4`.
- Native: 0x1a1a4: each row's button is 860 x 44 at (438, 131 + 59 i), and 0x1b5b4 also needs x <= 1334.
- Port: gallery.js:1018: each row button is 900 x 59.1 from x 437, with no gap between rows.
- Effect: The pointer in the 15 px between two rows still selects one in the port.
- Reached: Pointer use in the Music Player.
- Second reading: confirmed.

### N2-199: On-sprites are drawn at full alpha (low, confirmed)

Functions: `0x1b7d8`.
- Native: 0x1b7d8: 0x1fa20(0x3f4ccccd) on +0x90, +0x98 and +0xa0, so the y 184 glyphs of Play, Pause and Repeat are at vertex alpha 0.8.
- Port: gallery.js:1071-1072: gl-control-on has no opacity (no CSS rule either), so the glyph is at 1.
- Effect: The lit Play, Pause and Repeat glyphs and their glow are drawn at full strength where the game has them at 0.8. Only where the y 184 art is opaque (61% of Play's outline pixels, 54% of Pause's, 35% of Repeat's) do they hide the button's outline, and there the game lets 20% of it through.
- Reached: Whenever a track plays or is paused, or Repeat is on.
- Second reading: 0x1bab0-0x1bbac calls 0x1fa20(0.8) on +0x90, +0x98, +0xa0 and nothing else writes their +0x2cc (0x1fa20 and 0x21a20 in the panel touch only +0x88, +0xd0); +0xb8 fades write +0x3c0. gallery.js:1071-1072 and style.css have no opacity for gl-control-on. 'Completely' does not hold: music_controlbtn's y 184 row is not opaque over most of the outlines (Play 378 of 616 pixels, Repeat 256 of 724).

### N2-200: Panel art a pixel or two off (low, confirmed)

Functions: `0x1b7d8`.
- Native: 0x4697c8: music_btnbg at (1368, 104); 0x4698b8 / 0x469930: music_slider at (1392, 424) and (1392, 792); 0x4698e0 / 0x469958: the knobs' art top at y 400 and 768.
- Port: gallery.js:1031: music_btnbg at (1368, 103); gallery.js:1037-1038: sliders at (1393, 422) and (1393, 790); gallery.js:1047: knob art top at y 399 and 767.
- Effect: The panel background and knobs sit 1 px high and the two bars 1 px right and 2 px high.
- Reached: Every Music Player visit.
- Second reading: confirmed.

### N2-201: Position knob travel (low, confirmed)

Functions: `0x1c184`.
- Native: 0x1c184: the knob's 72 px art starts at x 1376 + 364 f.
- Port: gallery.js:1047 with MUSIC.sliderX0 / sliderX1 1401 / 1784 (gallery.js:16): an 80 x 88 element at 1358 + 383 f holding the art 8 px in, so the art starts at 1366 + 383 f.
- Effect: The knob is 10 px left of the game's at the start of a track and 9 px right at its end.
- Reached: Every playing track.
- Second reading: confirmed.

### N2-202: Clock runs past the loop end (low, confirmed)

Functions: `0x1c184`.
- Native: 0x1d314: without repeat, or once fading, +0x48 = min(elapsed, +0x54), +0x54 being the loop end in ms (0x1dec4).
- Port: gallery.js:1162 and 1165 use jukebox.position() unclamped; on the rows whose stream continues past the loop end the fade, which starts at the loop end, runs the position to loop end + 1.5 s.
- Effect: During the 1.5 s fade at the end of those rows (no repeat) the port's clock counts on while the game's stays at the loop end.
- Reached: 41 of the 95 rows: field ms non-zero and the stream runs 2.0 s or more past the loop end. The other 49 rows with ms non-zero end 0.002 to 0.038 s after the loop end (the stream's end finishes them first), and the 5 with ms 0 are faded out by the loop end.
- Second reading: 0x1d4ac-0x1d4b8 clamps to +0x54 = row +0x20 / 48 (0x1dec4), for repeat off or fading (0x1d47c-0x1d4a8), and the port does not. But 90 is too many: comparing gallery.json loopEnd with the final granule of each assets/bgm/*.ogg, 49 of the 90 streams stop within 0.04 s of the loop end, so s.onended (gallery.js:308) ends them with no overrun.

### N2-203: Volume knob travel (low, confirmed)

Functions: `0x1c2b0`.
- Native: 0x1c3b0-0x1c3e0: knob art at x 1376 + 364 v, y 768.
- Port: gallery.js:1164 and 1047: art at x 1366 + 383 v, y 767.
- Effect: The knob is up to 10 px left or 9 px right of the game's (about 1.4 px right at the default 0.6).
- Reached: Every Music Player visit.
- Second reading: confirmed.

### N2-204: Volume knob stays lit after Back (low, confirmed)

Functions: `0x1d89c`.
- Native: Back in state 3 reaches 0x1d89c, whose 0x1d73c puts the knob on the normal cell and hides the lit sprite at once.
- Port: gallery.js:1184 focus(false) leaves area 'volume', and gallery.js:1164 draws the knob hot for area 'volume' until the list next takes the focus.
- Effect: After Back from the volume the knob keeps its lit art while the column has the cursor.
- Reached: Back pressed with the cursor on the volume.
- Second reading: confirmed.

### N2-205: Pointing at the panel does not take the cursor (low, confirmed)

Functions: `0x1e7d4`.
- Native: 0x1e800-0x1e858: a touch (the left button on PC) landing or dragged on a button not under the cursor sets +0x3c, gives the panel the cursor, takes it from the list (0x1b43c dims its rows), and plays sound 0; without a press 0xae840 does not hit-test, so pointing alone changes nothing. 0x1e8e4-0x1e964: touching the volume knob does the same and enters the volume (0x1ec0c, state 3).
- Port: gallery.js:1074 mouseenter only sets b.hover (two buttons can be lit, gallery.js:1171); gallery.js:1076 click sets the area and btn but leaves .focused on the rows, and gallery.js:1055-1060 sets the volume without moving the cursor.
- Effect: A press on a panel button in the game gives the panel the cursor, dims the list's rows and plays the cursor sound. In the port it moves the cursor but leaves the row lit and plays no cursor sound. Hovering lights a button in the port (two can be lit) where the game has no hover. A press on the knob lights it and gives it the cursor in the game; in the port it does neither.
- Reached: Touch or the left button on the panel; the hover part with a mouse alone.
- Second reading: 0x1e800-0x1e858 and 0x1e8e4-0x1e964 hold, and gallery.js:1074, 1076, 1055-1060, 1171 are as cited, but the effect's 'hovering leaves the cursor on the list' is what the game does too: its hovered id exists only while a touch is down (N2-51).

### N2-206: No flash when the volume takes the cursor (low, confirmed)

Functions: `0x1ec0c`.
- Native: 0x1ec0c: the sprite +0xd0 (cell (168, 8), in front of the knob) is shown at alpha 1 and tweened to 0 over 1/6 s, quadratic in (channel 8 via 0x26720 / 0x26894).
- Port: gallery.js:1046-1049 only swaps the knob's cell; nothing draws the third cell of music_soundbtn.
- Effect: The bright flash on the knob for the first 10 frames is missing each time the volume is entered.
- Reached: Each Down from Prev or Next to the volume.
- Second reading: confirmed.

### N2-207: Volume is set from the bar, not dragged by the knob (low, confirmed)

Functions: `0x1f0d4`.
- Native: 0x1f0d4: only a touch landing on the 72 x 72 knob at its place starts a drag, and the value moves relative to the grab point at 1 / 364 per pixel.
- Port: gallery.js:1050-1060: a press anywhere on the 399 x 44 bar jumps the volume to the pointer, then follows it absolutely at 1 / 383 per pixel.
- Effect: Clicking the bar changes the volume in the port and never does in the game: with the cursor on the list or the volume nothing happens, and with a panel button under the cursor that new touch runs the button (0x1ca98-0x1cab4 has no position test). A drag moves about 5% less per pixel and has no grab offset.
- Reached: Pointer use on the volume bar.
- Second reading: 0x1f274-0x1f2bc starts a drag only for a new touch on the knob (0x25218) and stores x - 1376 and v; the drag is v0 + (x - x0) / 364. gallery.js:1050-1060 as cited. 'Does nothing' fails in one case: 0x1e7d4 returns 0 for a touch off the buttons and off the knob, so 0x1c9fc goes on to 0x1e98c on +0x3c.

### N2-208: An instant run ending drops the player's skip toggle, so it is not back after the movie (low, confirmed)

Functions: `0x6ef30`.
- Native: 0x802c0 and 0x6ef30 do not write *0xae0660 (xref: only 0x402a0 / 0x40a00 and the choice / load code do); 0x402a0 saves it to 0xaffc98 and clears bits 0-1, 0x40a00 restores it, and 0x40ed0 (0x418c0-0x418f4) sets 0xae0670 from bit 1 again the next frame, so skip goes on after the movie and after any other run end.
- Port: vm.js:700-701 endInstant sets this.skip = false and this.forceSkip = false whatever they were before the run; main.js:155 then reads modes.skip as false, and the #mode-skip indicator stays lit.
- Effect: With the skip toggle on when an instant run starts, skipping stops at the run's end (for a TOMP, at the movie's end) with the indicator still on; the game keeps skipping.
- Reached: op_RDAS has no skip test (vm.js:657) with Read scenes auto skip on, or Jump to Next Scene from the mode panel while skipping; any TOMP or other run end.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js beginInstant / endInstant: the skip flags are put back as the run found them (instantModes). main.js: the toggle is vm.skipToggle, and a story movie saves and restores it.
- Compared: Native run with the reference save: R before a synthetic chapter card, and skipping carries on by itself after it with the >> up. The port in an isolated browser: the same.

### N2-209: Fast forward held across a story movie does not resume after it (low, confirmed)

Functions: `0x6ef30`.
- Native: 0xae0670 is derived from the held button every frame (0x40ed0 at 0x41840-0x418ac and 0x41d88), blocked only while *0xae0650 is set, which 0x40a00 clears at the movie's end; ZR still down then fast-forwards on the next frame.
- Port: main.js:155 leaves held fast forward out of modes.skip and setSkip(false) clears vm.fastForwardHeld (main.js:343); the key is edge-triggered (main.js:729 !e.repeat, main.js:787 no repeat for pad button 7), so nothing starts it again.
- Effect: Holding ZR or Ctrl through a chapter card or other movie, fast forward stops at the movie's end until the key is released and pressed again.
- Reached: The 42 TOMP calls in the story scripts (the other 6 of the 48 are in TEST_SCRIPT, unreachable: no JUMP 8000 in any script), whenever the button is still down when the movie ends.
- Second reading: True as described: the held FF mask reaches 0x41d88 (0xae0670 = 1) every frame unless *0xae0650 is set (restored to its saved 0 at 0x40b20-0x40b2c), while main.js:155 / 343 drop held FF at the movie and the key is edge-triggered (main.js:729, 787, 758). The count is wrong: 6 of the 48 TOMP calls are in TEST_SCRIPT (jump id 8000), which no script jumps to and no engine code starts.
- Fix (2026-11-08): main.js fastForwardKey / syncFastForward: the key's state is kept apart from the toggle and read every frame, so it fast-forwards again on the frame after a movie, a menu or XSTP ends; letting go goes back to what the toggle says.
- Compared: Native run with the reference save: ZR held through the chapter card, and fast forward carries on after it. The port in an isolated browser: the same.

### already G6: The screen fading out as the viewer opens is the live page, so the old help band fades faster (low, likely)

Functions: `0xba18`.
- Native: 0x8d08 asks for the capture (0xa4610(0)) before 0x4dfc -> 0xba18 makes the sprite 0x466760 (texture 1, rule 0, timer 0); 0x254bc draws it at alpha 1 - +0x52c (the timer is the 0.5 s quadratic-in tween of 0xc498 / 0xcd58), over the viewer and the live bands. 0x4dfc -> 0x82d0 starts the gallery band's own 0.5 s fade-out under the capture, so the band baked into the capture leaves only as the capture goes.
- Port: app/js/gallery.js:981 box.style.opacity = tw over the live page, and gallery.js:1425-1426 guide.hide() runs at the same time under it (hidesGuide, line 951).
- Effect: For the half second a picture opens, the gallery's help band (strip and labels) fades on the band's own curve as well: at 0.25 s the game still shows it at about 0.8 of its strength (0.75 from the capture, 0.06 from the real band beneath), the port at about 0.19 (0.75 x 0.25).
- Reached: Every opening of the CG viewer.
- Second reading: confirmed.

### already G18: The list background does not scroll (low, confirmed)

Functions: `0x1b078`.
- Native: 0x1b134-0x1b19c: the background +0x50 (music_soundbg, 960 x 1736, top-left (392, 106)) takes the offset f = +0x3c while -200 < f <= 0, is left where it was for -4465 <= f <= -200, and takes f + 4265 - 326 below -4465.
- Port: gallery.js:1011: music_soundbg is a fixed child of the list box; only .gl-music-rows moves (gallery.js:1126).
- Effect: The panel's rounded top edge stays at the top of the list while the rows scroll under it; in the game it slides out with the first 200 px of scrolling.
- Reached: Any scroll of the 95-row list.
- Second reading: confirmed.

### already G18: Scroll time and curve (low, confirmed)

Functions: `0x1b2f0`.
- Native: 0x27bd4 with 0x3e2aaaab: a new tween of 1/6 s, quadratic out (type 2 mode 1), from the value shown; the rows and the thumb read it each frame (0x1b078).
- Port: style.css:149 .gl-music-rows { transition: transform .12s ease-out } and gallery.js:1027 the thumb's top .12s ease-out.
- Effect: The list settles in 0.12 s on the CSS curve instead of 0.167 s quadratic out.
- Reached: Every key move that scrolls.
- Second reading: confirmed.
