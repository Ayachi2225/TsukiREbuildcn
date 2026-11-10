E1_audio findings (native-to-web parity, all sound)
====================================================

SUMMARY
-------
198 functions: platform 66, helper 60, covered 25, divergent 20, explicit 15, unused 10, missing 2 (ledger.json).

The engine's volume law is NOT linear for music and plain sound effects, and the port is linear everywhere.
Per path (L = the channel's level 0-100, i.e. the script's 017 after fades; settings are 0-100):

  path                               native amplitude                                   port
  music (MPLY/MVOL/fades)            ca0(B(L/100 x BGM/100)), B(v)=1.54v-0.54v^2        L/100 x BGM/100
  plain SE (SEPL/SEVL/fades)         ca0(L/100 x SE/100)                                L/100 x SE/100
  voiced SE (070), no 001            L/100 x row/100 x voiceswitch/100, linear,         L/100 x row/100 x SE/100
                                     no SE volume, no SE mute                           (SE slider + SE mute apply)
  voiced SE (070) with 001 fade-in   ca0(L/100 x SE/100); row only gates on/off         as above
  voice (MSG/VPL2)                   row/100 x switch/100 linear (snd+9)                row/100 -> match
  interface sound 0xacef0            menu/100 linear                                    menu/100 -> match
  interface sound 0xacfa0            ca0(SE/100)                                        not played
  movie (0x17c0 player)              (1-BGM mute) x BGM/100 linear                      same -> match
  SE Test (config page 0x29140)      SE/100 linear, random 1 of 14 sounds               SE/100, always MOON_SE03001
  voice Test (0x2b930)               row x switch/100 linear, only if row on            row/100 (ignores voice switch)

ca0 (0xca0, code_000.cpp:903): v < 0.0014423 -> v; i = trunc(100v); i < 1 -> 0; i > 98 -> 1; else
T[i] + (100v - i)(T[i+1] - T[i]), T = 101 floats at 0x3355f0 (T10 .0218, T20 .0692, T25 .1, T30 .1327,
T40 .2115, T50 .3115, T60 .4269, T70 .55, T80 .6885, T90 .85, T99 .9885, T100 1; T99 only tops the 0.98 step).
B = runtime easing type 12 (0xff4b8, quadratic Bezier 0->1 with control 0.77, set by 0xe1d30 in 0x9b5d0
and 0x9b7f0; evaluated by 0xe1bfc(t=v, from 0, to 1, dur 1, mode 0)).
All atk sounds (music, SE, voices, interface) also carry the bfsar per-sound volume 96/127 (every one of the
17,896 sounds has 96; 0x106880 divides it by 127 into BasicSound+0x120 - likely); movies do not.

Example values at the defaults (BGM 40, SE 40, menu 10, rows 50):
  case                                   native             port               port - native
  BGM 40, 017 100                        0.3495 (-9.1 dB)   0.400 (-8.0 dB)    +1.2 dB
  BGM 40, 017 80 (458 MPLY)              0.2486 (-12.1)     0.320 (-9.9)       +2.2
  BGM 40, 017 50                         0.1242 (-18.1)     0.200 (-14.0)      +4.1
  BGM 100, 017 100 / 017 50              1.0 / 0.4692       1.0 / 0.5          0 / +0.6
  SE 40, 017 100 (8,632 SEPL)            0.2115 (-13.5)     0.400 (-8.0)       +5.5
  SE 40, 017 50                          0.0692 (-23.2)     0.200 (-14.0)      +9.2
  SE 40, 017 30                          0.0308 (-30.2)     0.120 (-18.4)      +11.8
  SE 100, 017 50                         0.3115 (-10.1)     0.500 (-6.0)       +4.1
  voice, row 50                          0.50               0.50               0
  voiced SE (070) row 50, 017 100        0.50               0.20               -8.0
  interface sound, menu 10               0.10               0.10               0
  movie, BGM 40                          0.40               0.40               0
(0x48ac0 re-applies the BGM byte through 0xad090 as floor(floor(256 BGM/200) x 100/128): 40 -> 39, music
0.3367 instead of 0.3495, -0.3 dB.)

Fade mechanics (0x9b7f0, per frame x elapsed frames): each music/SE/voice record moves its level linearly toward
its target at its rate (rate <= 0 becomes 0.2 level/frame), re-applies the formula above when the level
changes, and stops the handle when a fading-out (state 2) record reaches 0. Atk's own fades are not used
(0xedd28 only starts at 0 when given fade frames). Rates: MPLY fade-in 1666.67/001 per frame (0 -> 017, so it
ends after 017/100 x 001), old track 1666.67/(011 or 001) from its level; MFAD last-volume x 1000/60/001
(exactly 001 ms); MVOL |017 - last| x 1000/60/001; SEPL fade-in 017 x 1000/60/001 (+1000 ms if the channel is
fading out); SEFD current level x 1000/60/001; SEVL |017 - last| x 1000/60/001 (2000 = jump when no 001).
Pan 018: p = ((018 x 1000 - 64000) >> 6, toward zero) / 1000 = -1.000..+0.984.
Channel replacement: a new SEPL stops the channel's sound at once (0xedd28 Stop(0)) unless it is the same loop
still playing with volume > 0; music alternates handles 0/1 (old one fades on the other; a third MPLY during a
fade cuts the oldest), voices alternate handles 2/3 (MSG stops both first; VPL2 does not).
What stops: next MSG voice (0x6e0d0 -> 0x9c3b0), click unless F1123 (0x802c0), script end 0x5f200 (all SE
channels and slots, voice, music within a frame unless RTM2/RTMN), 0x5ef10 (from the script step 0x802c0 /
0x81a50 / 0x82330: music, SE and voice at once); read-scene skip drops
one-shot SEs; load-run (0xae0568 / 0x146e638) records but plays nothing (restored by 0x5baf0/0x5d7e0).

Not audio: 0x9ae58 / 0x9afa4 / 0x9b0c4 (and 0x9b37c, 0x9b384) are a scroll-bar widget for the config,
backlog and save lists; pow(t-1, 3) x (t-1) is a quart-out easing of the thumb (type 0xb; 7 = cubic-out,
otherwise quad-out). The port uses browser scrollbars instead (0x9b0c4 marked missing).

DIVERGENCES / MISSING BEHAVIOUR
-------------------------------
1. Volume law not applied to music and plain SEs.
   Native: 0x9b5d0 (code_012.cpp:13100) = 0xe1d30(0.77, easing, 12); 0xe1bfc(type 12) -> 0xca0 -> 0xee5ec.
   0x9b690 (code_012.cpp:13150): `tbnz w1, #0` skips 0xca0 only for type-2 channels, then 0xee110. 0x9cd40
   (code_013.cpp:715) builds the input (017 x SE/1e4); 0x9c470 / 0x9c870 / 0x9d1c0 and the mixer 0x9b7f0 use
   the same formulas for every level change. Port: audio.js:82 (group gain = slider), :208/:221 (SE gain
   017/100 x charGain), :255/:270 (music 017/100): linear. NATIVE-PARITY "Checked and matching" ("All linear,
   value / 100") is wrong for music and SE.
   Impact: at the defaults SEs are +5.5 dB (017 100) to +12 dB (017 30) louder than native, music +1 to +4 dB,
   voices equal: the mix leans toward SEs. All 14,543 SEPL, 1,285 SEVL, 1,171 MPLY, 780 MVOL. The gallery
   Music Player (0x9c8f0: ca0(B(slider)), no BGM setting) is linear in the port too (gallery.js Jukebox).
   Confidence: confirmed in listing. Fix: export the 101-float table (0x3355f0) in build_system.py; per node
   gain = curve(bez(L x BGM)) for music, curve(L x SE) for plain SE; set the bgm/se group gains to 1 and
   recompute node gains when a slider or mute changes.

2. Voiced sound effects (070) are scaled by the SE slider in the port.
   Native: 0x9caa0 (code_013.cpp:539) gives the channel type 2 when a character is set; 0x9cd40 then uses
   017 x row(config+0x34+2i) x switch(config+6)/1e6, skips the SE byte (snd+0xa) and the curve; the mixer's
   type-2 path follows row/switch changes live. With a 001 fade-in, 0x9cbf0 leaves type 1 (curve x SE volume,
   row only gates). Port: audio.js:210-221 plays them in the "se" group (SE slider and SE mute).
   Impact: 15 SEPL without 001 (05_01_CIEL05_4B 3442; 10_01_CIEL10_5_2 1266/1540/1842; 13_01_02_CIEL13_7B
   3179; 14_01A_CIEL14A_2 x6; 14_01B_01_CIEL14B_1B 868/974/1088/1496) are 8 dB quiet at the defaults and fall
   silent with SE Mute, natively they follow only the row and "Play all voices". The 4 with 001:800 match
   within 0.5 dB at the defaults. Confidence: confirmed in listing. Fix: 070 without 001 -> voice group,
   gain 017/100 x row/100.

3. Fade shape and some fade durations.
   Native fades are linear in level, so the amplitude follows the curve: a music fade-out at BGM 40 from 017
   100 is -9.1 dB at start, -18.1 dB at half time, -27.6 dB at 3/4 (port -8.0, -14.0, -20.0); SE 40: -13.5,
   -23.2, -33.2 (port -8, -14, -20). The port's linear-amplitude ramps (audio.js:160, :181) stay loud and drop
   late. Durations: MPLY fade-in (0x9c6d0) ends after 017/100 x 001 (232 of the 368 fade-in MPLYs have
   017 < 100, e.g. 80 -> 1.6 s of 2 s) and the old track (0x9c9b0) after L_old/100 x (011|001); the port uses
   the full 001 for both (audio.js:259, :270). A SEPL fade-in on a channel still fading out gets +1000 ms
   (0x6a340 `add w8, w22, #0x3e8` when 0x9cfc0 == 2; same in 0x65780); the port does not. MFAD/SEFD/MVOL/
   SEVL durations match. Confidence: confirmed in listing. Fix: setValueCurveAtTime sampled from
   curve(level(t)) with the native durations.

4. Non-delayed SEVL / SEFD on a channel whose 068-delayed SEPL is still waiting.
   Native: SEVL 0x6ae10 (code_008.cpp, L_6B204: `ldrb w8, [x8, #0x460]; cmp w8, #1; ... strb w21,
   [x8, #0x461]`) only rewrites the waiting SEPL's volume - it still plays after its delay at that volume (the
   SEVL's own 001 is ignored; the SEPL keeps its fade-in). SEFD 0x6b310 clears counter and kind when the counter is > 0 - the SEPL is gone for good. SEPL
   0x6a340 zeroes only the counter (the slot stays; a later delayed command runs it via 0x66200 -> 0x65a60).
   Port: vm.js:1006-1007 treats all three like SEPL (timer cancelled, entry kept).
   Impact: (a) 14_01B_01_CIEL14B_1D ops 660-662 and 746 (loops WOH_SE12031, WOH_SEEX03, MOON_SE10051,
   WOH_SE05133, 068:500) are retuned by the SEVLs at ops 683-685 / 770 natively but never start in the port;
   (b) about 7 SEPLs cancelled by an SEFD are replayed by the port at the next delayed command on that
   channel, much later (e.g. 05_01_CIEL05_4B op 2072 at op 2447; also 13_01_01_CIEL13_5B, 13_01_02_CIEL13_6,
   14_01B_01_CIEL14B_1C/1D/1G). Confidence: confirmed in listing; counts likely (script-order simulation
   counting WTTM and FADS durations). Fix: pass the command kind to soundLater: SEFD -> cancel and delete;
   SEVL -> set the waiting command's 017 and keep it scheduled; SEPL -> as now.

5. Speaker-23 voices (M00, M01, M02, M11, M12) at full volume.
   Native: 0x6e0d0 and VPL2 (0x77790 at 0x7a3a8..0x7a4fc) play a voice only if speakers[speaker] &
   config+0x24, at row 0x29390(speaker) = log2(0x6531f4[23] = 0x40000) = 18 (the row of speakers 0, 19, 20,
   22, 23). Port: audio.js:118 returns -1 for speaker 23, so characterGain is 1 (audio.js:127).
   Impact: 5 lines (03_00_ARC03_3, 09_01_CIEL09_6, 13_01_02_CIEL13_7C, 13_01_02_CIEL13_8, 15_01B_CIEL15B_1)
   are +6 dB at default row 50 and ignore row 18's mute. Confidence: confirmed. Fix: map speaker 23 to row 18
   for the gain; keep leaving it out of the heard flag (heardVoice) only.

6. Pan 018: immediate and delayed SEs pan differently natively, alike in the port.
   Native: 0xedd28 SetPan(p) (atk BasicSound+0x154); then, on the immediate path only, 0x9ce60 (type-1
   channels) -> 0xee158 (code_019.cpp:11600: `fadd s0, s0, s0`, clamp +-2, `b #0x10cf94`) sets 2p. The delayed
   path 0x65780 never calls 0x9ce60 (pan p). Port: StereoPanner((018-64)/64) for both (audio.js:212).
   Impact: 15 SEPL (QA_14, QA_18, QA_23, QA_25, 04_00_ARC04_4_1C 797); 4 immediate (QA_14 1080/1179 at 96,
   QA_18 404 at 32, QA_25 978 at 51), 11 delayed. Which path the port reproduces depends on atk's pan law
   (bfsar wave sounds: option 1 = 0, read as Dual/Sqrt): under Dual (stereo channels offset +-1, clamped),
   StereoPanner(w) on these stereo waves equals atk pan 2w, so the port matches the 4 immediate calls and pans
   the 11 delayed ones twice too far. Confidence: doubling confirmed in listing; equivalence unsure.
   Fix (if the law holds): use (018-64)/128 on the delayed path and for voiced SEs.
   Traced 2026-11-07 (checklist A6): the law is nn::atk's sqrt curve with dual mode for waves and balance for streams
   (0x12d108 / 0x12a1a8, see FUNCTION-MAP "Corrections found while fixing"); a StereoPanner is not it, and music,
   voices and mono waves sit at 0.7071 a side.

7. Delayed fade-in SEPLs: rate overridden.
   Native: 0x65780 (code_008.cpp:6781, L_659EC..L_65A24) after 0x9cbf0 calls 0x9d0b0 with rate
   |017 - last scripted volume on the channel (0x146e6cc)| x 1000/60/001; rate 0 becomes 0.2 level/frame.
   So the fade-in lasts 001 x 017/|017 - last| (100 at 0.2/frame = 8.3 s). Of 180 SEPL with both 001 and 068:
   129 follow an SEFD (last 0, as written), 7 repeat the channel's last volume (0.2/frame: 08_00_ARC08_8 976,
   13_00_ARC13_4 2605 / 3288, 13_01_02_CIEL13_6 1257, 13_01_02_CIEL13_6_1 532, 14_01B_02_CIEL14B_3B 5520,
   ...), 20 are stretched or shortened (x0.67 to x4), 18 depend on an earlier script. Port: always 001.
   Confidence: confirmed in listing; counts approximate. Fix: keep a last-volume per channel and reproduce.

8. Fast forward cuts music and SE fades in the port.
   Native MFAD 0x64fa0 and SEFD 0x6b310 only skip the fade for the load-run flags (0xae0568 -> 0xf1f740,
   0xae0900 -> 0x146e638); fast forward (0xae0660 bit 0, read-scene counter 0xae0670) fades in real time.
   Port: vm.js:1034 and :1044 use 0 ms whenever this.skip. Impact: any of the 724 MFAD / 3,516 SEFD reached
   while fast-forwarding (typically 2-5 s fades cut short). Confidence: confirmed in listing. Fix: 0 ms only for
   restores / skipUntil.

9. Sound page details (config reviewer's area, low impact).
   SE Test (0x29140): stops the last test, takes the first idle channel, plays a random one of 14 sounds
   (0x46b138: moon_se02009 ... moon_se09005, 0xa8f90(0, 13)) at SE/100 linear; port ui.js:1111 always plays
   MOON_SE03001 (same level). Voice Test (0x2b930): row x switch/100, so silent with "Play all voices" off; the
   port plays at the row volume. 0x2a9b0 changes the playing voice's volume live (0x9d240) and stops it when
   its row is muted; the port's setCharacter (audio.js:93) affects only the next voice. Confidence: confirmed
   (decompile).

10. Interface sound 7 (0xacfa0) never played.
   0x40480 (movie mode state machine, gallery reviewer's area) plays sound 7 through 0xacfa0 (handles 4-7, SE
   volume through 0xca0) once a kind-0xd movie passes frame 210 (`cmp w10, #0xd2; ... mov w0, #7; bl #0xacfa0`)
   and, for kind 4, sets loop and plays music 2 at 100. ANIMATIONS.md says sound 7 has no caller. Which movie
   is kind 0xd was not traced. Confidence: call confirmed in listing; scenario unsure.

11. Minor.
   (a) Atk per-sound volume 96/127 applies to every atk sound but not to movies: in the port music/SE are
   about 2.4 dB louder relative to movie audio (likely).
   (b) A delayed loop SEPL of the loop already playing restarts natively (0x65780 has no same-loop check):
   2 calls (14_01B_01_CIEL14B_1D 527-528); the port keeps the loop.
   (c) VPL2 alternates two voice handles (a third overlapping voice cuts the oldest); port unlimited.
   (d) An MVOL to the last music volume during an MPLY fade-in slows the fade-in to 0.2 level/frame (rate 0;
   33 MVOL repeat the last volume, matters only mid fade-in).
   (e) A finished play-once track (049:0, only QA_25 op 2506) keeps its number natively (MPLY of it again does
   nothing); the port forgets it.

CHECKED AND MATCHING
--------------------
- Interface sounds 0xacef0: menu/100 linear, handles 4-7 round robin (Audio.playSys).
- Voices: row/100 x switch linear; stop at next voice, on click unless F1123, at script end; busy from the
  request (0x9c400); muted row or voices off -> not played.
- Movies: (1 - BGM mute) x BGM/100 linear (snd+7 = config+0x30, copied from +4 by 0x2a730); title movies
  have no audio track.
- MPLY: same number ignored (0x9c460), n < 0 stops, 049 loop flag on both handles (0x9c960), 069 offset in
  samples (0xee200 StartInfo type 2), without fade-in the playing track is stopped at once (0x9ca50 ->
  0x9c610); MFAD 011 = no wait (all 724 pass 0).
- SE: 017 clamp 0-100, same loop with volume > 0 ignored on the immediate path, read-scene skip drops
  one-shots (it would also stop a loop on that channel, but no script puts a one-shot on a looping channel),
  070 row / voice switch gate, SEVL / MVOL without 001 jump at once.
- 068: ceil(ms x 0.06) frames, one slot per channel, a waiting command runs first (0x66200), SESP empties it,
  channel -1 = all; countdown paused with the game (port clock paused while a UI page is open).
- Loops: SE FWAV loop points (seLoops), music stream loop points (musicLoops).
- Slider and mute changes reach playing music and SE at once (0x9d1c0, mixer tracking of snd+0xa).
- The 30 MIX_SE names the scripts use but the native table (0x409008, 1291 names) lacks are also absent from
  knife1.bfsar: silent in both. SE name lookup is case-insensitive in both.

UNUSED NATIVE CODE
------------------
- Script commands no shipped script uses: SEPN 0x6b820 (pan tween, 0x9d110), SEP3 0x6bc60 (third-axis
  value/tween: 0x9ced0, 0x9d160, 0x9b6e0, 0xee1a8), SEAC 0x6c0a0 (slot kind 4 in 0x65a60). 0 uses in 549
  scripts (scan of web/assets/scripts).
- Voice pan / third-axis tweens of 0x9b7f0 (0xeeb34, 0xeeb74): nothing starts them.
- SE channel type 3 (menu volume) branch of 0x9b7f0: no code sets type 3.
- BGM ducking under voices: 0x48ac0 moves a level 256 <-> 128 (-4/frame while 0x9c400 reports a voice,
  +2/frame otherwise) and applies it through 0xad090 -> 0x9d1c0 (music at half the BGM setting while a voice
  plays) only when config+0xc != 0. +0xc is 0 in the initial config 0x46b080 and no code writes it (0x2a730 maps
  no widget to it), so it is dormant; 0xad090 only re-applies the BGM byte.
- Empty hooks and stubs: 0x9c2e0, 0x9c2f0, 0x9c420, 0xad0c0, 0xad0d0 (called with the SE index when
  config+0x1a is set), 0xad0e0, 0xad170, 0xad4a0; 0x9c430 (-1), 0x9c440 (0), 0x9c450 (10000).
- Engine bug, likely harmless: 0x9caa0 and 0x29140 pass the SE index instead of the handle to 0xee0e0; the
  channel's own loop byte is set by 0x9cf30 first, and every start (0xacef0/0xacfa0, 0x6a340) sets its handle's
  byte before starting.

LIMITS
------
- Atk's pan law for the stereo SE waves (finding 6) was not traced in the NintendoWare code (pan tables at
  0x3cef10.. exist); the bfsar option-1 values (waves 0, streams 1) were read as pan mode/curve. (Traced afterwards,
  2026-11-07: byte 0 is the mode, byte 1 the curve; see finding 6.)
- 0x1916df0 (pauses the 068 countdown in 0x65e50; set by the input code 0x40ed0): exact meaning (held fast
  forward? backlog?) not settled, so whether delayed SEs wait out fast forward natively is unverified (the
  port plays them at once while skipping).
- The 96/127 data volume: the /127 in 0x106880 reads a byte filled through a virtual call; consistent with
  NintendoWare, not traced to the SoundInfo field.
- Movie player volume (movie object vtable +0xc0) assumed linear.
- Counts for findings 4 and 7 come from a script-order simulation (WTTM and FADS durations only).
- Left to other reviewers: Music Player default volume (*(0xae0378)) vs the port's 0.6, 0x9b0c4 scroll bar
  (config/backlog/save lists), movie kind 0xd in 0x40480.
- No browser checks were run (brief).

## Re-check of the handled functions (2026-11-08)

40 functions of this part compared with the port: 26 the same, 14 different, 0 unsettled. The CSV row of each says what was compared, and [REVERIFY.md](../REVERIFY.md) has the box. Static comparison only: no native frames were compared.

### N2-23: Title music fades use the rate as a time (medium, confirmed)

Functions: `0x9c9b0`.
- Native: The argument is level units a frame. 0x8edf0 passes 0.5 for 'press any button' (state 10): 100 / 0.5 = 200 frames = 3.33 s. 0x8f330 (New Game, state 0x14) and 0x8e934 (Continue) pass 1.5: 66.7 frames = 1.11 s. The title music plays at level 100 (0x8e1e8).
- Port: ui.js:517 stopBGM(500) takes 0.5 s; ui.js:595 and ui.js:715 stopBGM(1500) take 1.5 s, because audio.js:585 turns ms into the rate that crosses the current level in that time.
- Effect: After pressing a button on the first title screen the music is gone in 0.5 s instead of 3.33 s, so it no longer carries into the cautions; on New Game and Continue it lasts 0.39 s too long.
- Reached: Every first-screen press, New Game and Continue. Checklist S28 and ANIMATIONS.md:550 record 1.5 s, which misreads the rate.
- Second reading: confirmed.
- Fix (2026-11-09): audio.js fadeBGMRate(rate) takes the native's level units a frame, and ui.js title / titleMenu / continueGame call it with TITLE_MUSIC (uifx.js): 0.5 on the first screen, 1.5 on New Game and Continue.
- Compared: Native run (reference save, logos passed, sound output recorded with NX_AUDIO_DUMP): the title's track fitted exactly up to the press, then its gain through the volume curve follows 100 - 1.5 a frame and it is gone 1.1 s later. The first screen's 0.5 goes through the same function and could only be read from the code: the recording window ends long before the 6-minute opening does.

### N2-24: Fast forward and the skip toggle play one-shot sound effects; the game drops them (medium, confirmed)

Functions: `0x9cf90`.
- Native: 0x6a340 at 0x6ac14-0x6ac38: a SEPL with loop argument != 1 while *0xae0670 != 0 starts no sound, stops the channel only if its loop index (+0x64) is >= 0, and returns before storing the last volume. Same in 0x65780 for delayed ones. 0xae0670 is set each frame by the fast-forward key (mask +0x4c, 0x41864-0x41d8c) and the skip toggle (0xae0660 bit 1, 0x418f4); no test on it stands before the call at 0x7a880.
- Port: vm.js:1542 soundsSkipped is this.skip && (this.instant || this.skipUntil || !this.skipPaced), false for user fast forward (skipPaced true, main.js setSkip), so vm.js:1549 lets the one-shot through to playSE, which plays it and writes seLast.
- Effect: Holding fast forward or turning skip on over read text, the port plays every one-shot effect it passes (footsteps, doors, impacts in quick succession); the game passes them silently. seLast also differs afterwards, which changes the rate of later delayed volume changes.
- Reached: 7,623 immediate one-shot SEPL in the scripts (a further 3,162 with 068 are under N2-124), on any fast forward or skip over read text, or any text with fast forward on Full.
- Second reading: confirmed.
- Fix (2026-11-08): vm.js soundAct: a sound played once starts nothing while vm.skip is set, whether it is immediate or delayed (0x6a340, 0x65780); audio.js dropOneShot stops a loop on record on that channel and leaves the channel's last volume and character alone. The run's record path keeps the last volume of a one-shot unless the skip flag was up.
- Compared: Native run with the reference save, sound output recorded (NX_AUDIO_DUMP): ZR held over a synthetic scene, the one-shots and the delayed one are absent, the loop starts and a one-shot on its channel stops it, the next loop plays. Without ZR all of them play. The port's calls in an isolated browser are the same sequence.

### N2-25: Sound system master scale 127/96 missing (medium, confirmed)

Functions: `0xedd28`, `0xee110`, `0xee200`, `0xee5ec`, `0xee6b4`, `0xeea34`.
- Native: This SetVolume multiplies by the sound system's master +0x2c = 127/96 (full evidence under 0xee110).
- Port: audio.js:200 has only the 96/127 master gain.
- Effect: Every sound plays 2.43 dB quieter than native (see 0xee110).
- Reached: All sound in normal play.
- Second reading: confirmed.
- Fix (2026-11-08): audio.js applyVolumes: the master gain is the archive's 96 / 127 x the sound system's 127 / 96, so 1.
- Compared: Native run with the reference save, sound output recorded (NX_AUDIO_DUMP), fitted against the decoded files: title music 0.9960 of the volume law without the 96 / 127, a voice 0.9958, a mono effect 0.9935, a stereo effect 0.98 to 0.99, an interface sound 1.00 to 1.02 (the effects are re-encoded, so their fit is looser). The port was 1.32 times too quiet before.

### N2-116: Row volume 0 plays no voice, so voice waits pass (low, confirmed)

Functions: `0x9c300`.
- Native: With the row on and its volume 0, 0x6e0d0 / VPL2 write snd+9 = 0 and 0x9c300 still starts the voice and sets the record to state 1, so 0x9c400 reports busy for the voice's length (VCWT 0x77f9c, the line's voice wait set at 0x6e744, auto mode 0x803e4).
- Port: audio.js:676 returns before loading when gain <= 0, so voicePlaying is false once the job settles and VCWT (vm.js:1077), goOn lines (vm.js:992) and auto mode do not wait.
- Effect: With a character's slider at 0 (not muted), scripted waits on that character's voice end immediately instead of lasting the silent voice's length.
- Reached: The row slider reaches 0 (ui.js:1475 clamps at Math.max(0, ...)); the scripts have 75 VCWT, and every voiced line's wait and auto mode use the same state.
- Second reading: confirmed.
- Fix (2026-11-08): audio.js playVoice: only a row switched off plays nothing; a row at volume 0 runs the stream silently, so voice waits and auto mode last its length.
- Compared: Listing and test.
### N2-123: Delay countdown stops while a UI page is open (low, confirmed)

Functions: `0x65e50`.
- Native: 0x65e50 is called from the mixer 0x9b7f0, which the app loop runs every frame (0x1fb4, or 0xb600c in 0xb5fe0) in any game state. Its only gate is *0xae05b8 = 0x1916df0, the rewind flag: the only non-zero write is 0x41814 in 0x40ed0, the same branch that clears the fast-forward flag, and 0x40ed0 runs the rewind step 0x814c0 while it is set. Menus and other pages do not set it.
- Port: vm.js:1525-1532 counts until = now + frames x 1000 / 60 on this.now(); AnimationClock.pause('menu') holds now while a page is open (vm.js:354, ui.js:350), so a waiting command stops counting until the page closes.
- Effect: A delayed sound effect, fade or volume change waiting when the player opens a menu acts behind the menu natively, and only after the menu closes in the port (delays of 20 to 8000 ms).
- Reached: 3,471 SEPL, 583 SEFD and 40 SEVL with 068 in the scripts; needs a page opened inside the delay.
- Second reading: confirmed.
- Fix (2026-11-09): vm.js: the delay slots count on their own clock (soundClock), which a menu, the backlog or a dialog does not hold; queueDelayed and delayedState read it. The port's own holds (pictures still loading, a hidden tab) stop both clocks (holdClocks).
- Compared: Native run (test scene: SEPL with 068:8000 queued before the first line, the system menu opened 2.7 s later and left open; title music and menu sounds muted in the save copy): the audio log's 29-39 s window has 6.28 s of sound at peak 6748, the same as the run with no menu (6.23 s, 6748). The port in an isolated browser with live audio: the sound starts 8.4 s after the page loads with the system menu up and the story's clock held.

### N2-124: Fast forward runs delayed sound commands at once (low, confirmed)

Functions: `0x66200`.
- Native: 0x6a340, 0x6ae10 and 0x6b310 queue through 0x66200 unless 0xae0568 or 0xae0900 is set, so fast forward does not bypass the queue, but the countdown runs at the frame's speed: 0x40ed0 -> 0x4a5b0(64) -> 0x9b7f0(64) -> 0x65e50(64), on top of the normal 0x9b7f0(ticks) at 0x1fb4. A delay of n frames ends after ceil(n / 65) frames (one frame up to about 1 s, eight for 8 s). When it runs, 0x65780 plays nothing for a one-shot while 0xae0670 is still set (stopping the channel if a loop is recorded); kinds 2 and 3 act as usual.
- Port: vm.js:1532: tick() runs the entry when left <= 0 or this.skip, and the first tick() is at queueing (vm.js:1535), so while this.skip is true (fast forward, main.js setSkip) a delayed command acts immediately; one queued before fast forward is cut short on its next poll.
- Effect: While fast-forwarding, a delayed one-shot is heard at once in the port and not at all natively, because the delay ends within a few frames with fast forward still on. Delayed fades and volume changes differ by at most eight frames.
- Reached: 3,471 SEPL, 583 SEFD and 40 SEVL with 068 in the scripts, whenever the player fast-forwards over them. audit/function-map/audio.md LIMITS left this open; S37 covers tweens and effects, not these delays.
- Second reading: The queue gate is as claimed (0x6a640-0x6a664, 0x6b104-0x6b130, 0x6b5fc-0x6b628) and 0x65780 does drop a one-shot while 0xae0670 is set, but 'waits out its frames in real time' is wrong: 0x65e50 subtracts its argument, and 0x40ed0 calls 0x4a5b0(speed) at 0x4208c, which calls 0x9b7f0(speed) -> 0x65e50(speed) when speed > 1, on top of 0x9b7f0(ticks) at 0x1fb4. At speed 64 the delay falls by 65 a frame. Holding the key also sets 0xae0670 (0x41d8c). Related: undelayed one-shots are dropped the same way at 0x6ac14-0x6ac38, which the comment at vm.js:1543 denies.
- Fix (2026-11-08): vm.js queueDelayed: skipping no longer bypasses the queue; the countdown falls 64 frames more each frame (SKIP_SPEED) and stands still through an instant run. A one-shot it reaches with the skip flag up is dropped by soundAct; kinds 2 and 3 act.
- Compared: Native run with the reference save, sound output recorded (NX_AUDIO_DUMP): the delayed one-shot in the ZR-held scene is absent and the scene's fixed 60 s wait passes in about 1.2 s, the speed the countdown uses. The same scene without ZR plays it at its delay.

### N2-125: Line with a muted speaker stops the voice still playing (low, confirmed)

Functions: `0x9c300`.
- Native: MSG 0x6e0d0 tests speakers[speaker] & config +0x24 at 0x6e6dc and branches to 0x6e74c before 0x9c3b0 at 0x6e6e4, so a line whose row is off neither starts a voice nor stops one already playing.
- Port: audio.js:667 calls stopVoice before the row is looked at (audio.js:674-676), and vm.js:1600 calls playVoice for any named voice while voices are on.
- Effect: A line spoken by a character whose voice is switched off cuts the previous line's voice; natively that voice plays to its end. An earlier voice can still be playing with Voices stop on input off (main.js:87 default on), in F1123's scene 09_01_CIEL09_1_1, or after a voiced @n line.
- Reached: Every VPLY / MSG line of a muted row that follows a voice still playing: with the setting or scene above, or right after a voiced @n line (1,079 voiced @n lines; 309 are followed by a voiced line of another speaker, QA_10 for example).
- Second reading: 0x6e6dc-0x6e6e4 read as claimed (row off branches to 0x6e74c before 0x9c3b0) and audio.js:667 stops first. The word 'only' is wrong: a voiced @n line does not wait for a click (w27 == 1 at 0x6e734 sets no voice wait), so its voice is still playing when the next line starts, with no setting involved.
- Fix (2026-11-09): audio.js playVoice returns before its stop and its handle change when the speaker's row is off (voiceOff); vm.js startPendingVoice gives such a line no voice of its own, so it has nothing to wait for or to cut. VPL2 and Replay Voice test the row the same way (0x7a49c, 0x4e7c0).
- Compared: Native run (Voices stop on input off and row 0 off in the save copy; line one with an 8.6 s voice, a click after 2.4 s, line two (@n) of the muted speaker, VCWT, a marker): the marker comes 8.4 s after line one, so the voice played out; with the row on it comes after 3.2 s (cut, then the new 0.8 s voice). The port, same scene, live audio: 8.6 s after the voice starts with the row off.

### N2-126: Voice wait covers both handles, not the newest voice (low, confirmed)

Functions: `0x9c400`.
- Native: 0x9b520(-1) picks the record of the current handle only; an older VPL2 voice still playing on the other handle is not looked at.
- Port: audio.js:703 voicePlaying is true while any voice or pending job exists, and voiceDone (audio.js:706-713) waits for all of them; vm.js:1077 and vm.js:992 use both.
- Effect: A VCWT after a VPL2 whose predecessor is still playing waits for the longer of the two; natively it ends with the newest voice.
- Reached: 16 VPL2 in 5 scripts, 12 of them in 00_02, each followed by VCWT; the earlier voice only survives when a click passed its VCWT with Voices stop on input off.
- Second reading: confirmed.
- Fix (2026-11-09): audio.js voicePlaying and voiceDone look at the handle in use only, so at the newest voice; a voice started during the wait becomes the one waited for. The stop of both handles (0x9c3b0) is unchanged.
- Compared: Native run (test scene: VPL2 of an 8.6 s voice, 300 ms, VPL2 of a 0.8 s voice, VCWT, a marker): the marker comes 0.81 s after the second voice; with the long voice alone, 8.40 s. The port, same scenes, live audio: 0.80 s and 8.32 s.

### N2-127: Script end cuts the track still fading on the other handle (low, confirmed)

Functions: `0x9c650`.
- Native: 0x5f200 calls 0x9c650 and 0x5ef10 calls 0x9c610; both act on the current handle's record only, so the previous track keeps falling on the other handle until the mixer stops it at level 0.
- Port: audio.js:718 stopAll kills bgmOld as well, and audio.js:740 does the same on a restore with restartMusic.
- Effect: The end of a crossfade is cut off when a load, Quick Jump, Return to Previous Scene or Return to Title happens while the old track is still fading.
- Reached: Only those player actions during a crossfade; no shipped script reaches END_ / RTM_ before its crossfade is over.
- Second reading: 0x9c650 / 0x9c610 act on the current handle only and audio.js:718 / 740 kill bgmOld, so the difference exists, but not at script ends: both named scripts leave by JUMP (501, 657), the RTM_ / END_ after it never run, and JUMP does not call 0x5f200. A walk of all 369 fade-in MPLY (following JUMP, GOTS, IF, 40 messages deep) reaches END_ / RTM_ only at 12_01_CIEL12_3C, after an 800 ms fade, 2 messages and 1200 ms of waits.
- Fix (2026-11-09): audio.js stopAll, stopPlaying and restore (restartMusic) stop the music handle in use only; the track fading out on the other handle falls on until it reaches 0 or the next track takes that handle (playBGM, as before).
- Compared: Native run (test scene: a silent first line, Quick Save there; MPLY 14, 4 s, MPLY 17 with 001:30000, line two; Quick Load from the mode panel about 13 s into the crossfade): after the load the audio log still has 10.00 s of sound at peak 2011 in the 49-59 s window and 6.05 s at peak 449 in the next, then silence: the old track falls to its end while the new one is cut. The port, same scene, live audio, the checkpoint loaded 13 s into the crossfade: no current track, music 14 still falling (63, then 36 eight seconds later, then gone).

### N2-128: Title Load and ending replay cut the music at once (low, confirmed)

Functions: `0x9c9b0`.
- Native: 0x8ea94 -> 0x8f2b0 passes 1.5 a frame (1.11 s from 100) when the title's Load screen returns a loaded record, and 0x5040 at 0x5088 passes 3.333 a frame (0.5 s) when an ending replay starts.
- Port: ui.js:1179 goes straight to loadSave, where restore with restartMusic kills the track (audio.js:740); main.js:607 playEpisode -> startAt -> audio.stopAll (main.js:383) stops it at once.
- Effect: The music stops abruptly instead of falling over about a second (Load) or half a second (replay).
- Reached: Each Load from the title and each Ending List replay.
- Second reading: confirmed.

### N2-129: Voice Test shares interface sound slot 0 (low, confirmed)

Functions: `0xee6b4`, `0xee9a8`.
- Native: 0x2c188-0x2c1c4 stop and start voice handle 4, table index +0x20 + +0x24 + 4; 0xacef0 plays on wave handles at table index +0x20 + 4..7 (0xedfd0, 0xee0e0). They are separate objects (wave handles run to at least 30, for SE channels 11-30). Only another Test or leaving the config (0x9b740(4), 0x2b5c0) stops the sample, and neither touches an interface sound.
- Port: audio.js:647-648 and 654-655 keep the Test voice in this.sys[0], the first slot of playSys's round robin (audio.js:596-599), and audio.js:613 stopTests stops that slot.
- Effect: On the Sound page a voice sample is cut by the next interface sound that lands on slot 0 (every fourth cursor or press sound), and starting a Test or leaving the page cuts whatever interface sound that slot holds; natively the sample plays to its end.
- Reached: Every voice Test press whose sample is still playing when interface sounds follow. Checklist M4 (FIX-CHECKLIST.md:1033-1034) and the map notes of 0x2b930 / 0x9d240 describe the shared handle as native behaviour; the handle tables show otherwise.
- Second reading: confirmed.
