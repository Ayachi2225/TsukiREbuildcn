# Web port parity audit

*Status note 2026-11-10: a report of its date, not kept up to date since. Much of what it lists has been fixed; what is still open is in [TODO.md](TODO.md), and the fixes are in [FIXES.md](FIXES.md).*


**2026-11-05 · Result: the core content is present, but behavior and audiovisual fidelity are incomplete.**

The audit checked the working `/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web` against the local Japanese game image, translation overlay, native instruction translations, shader programs, and sound archives. The separate `/Users/h009/Downloads/TsukiREbuild` tree is older and was not substituted for the working engine.

This report identifies confirmed omissions and incorrect behavior, then separates deliberate approximations and unresolved comparisons. It is not a certification that every route or frame matches. No engine implementation was changed.

*Later corrections (2026-11-07, see [FUNCTION-MAP.md](FUNCTION-MAP.md), "Corrections to earlier notes"):* `WTSV` (row 1) is no command of the Switch interpreter (`0x77814` passes it over), so its 28 calls rightly do nothing; `STRA` (row 5) is a heat haze whose 557-entry table is at `0x352bd4`, drawn by `0x362a0`; the CG viewer's flag 1 is a horizontal mirror (`0x1f688` -> `0x254bc`); and the only blur is the pre-blurred `_XX_YY` texture STCH / SCH2 pick (`SNX4` is no command either). Each is ported (FIX-CHECKLIST V1, S2-S4, G7).

## Most important fixes

Priority is the suggested repair order for this port, not a claim that every affected call runs on every route. Counts below are static command occurrences in the complete prepared script corpus.

| Order | Problem | Extent / player-visible result | Detailed evidence |
|---|---|---|---|
| 1 | Scripted save checkpoints and save prompts are absent | `ATSV` 398, `WTSV` 28 and `SELA` 26 calls do nothing. The native **Save Progress?** question and automatic recovery behavior are missing. Manual and quick saving do not replace these script commands. | [VM-01](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/vm-findings.md), [UI-05](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/ui-save-findings.md) |
| 2 | Waiting for a voice can finish before the voice loads | A controlled probe of the actual `Audio` class resolves `voiceDone()` before a delayed voice starts. The prologue contains immediate `VPL2` → `VCWT` sequences. There are 75 voice-wait sites. | [RA-06](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/render-audio-findings.md), [probe result](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/voice-loading-probe-result.json) |
| 3 | Several blend modes calculate the wrong pixels | Subtractive modes 12/14: 146 calls; soft-light mode 19: 486 calls; alpha-sensitive dodge mode 21: 106 calls. These differ from the actual translated game shaders. | [RA-02–04 and shader provenance](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/render-audio-findings.md) |
| 4 | Sound-effect loops repeat their intro | 108 used looping sounds have nonzero native loop starts, referenced by 1,270 `SEPL` calls. Conversion/playback discards those positions and loops from zero. | [RA-05](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/render-audio-findings.md), [sound census](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/render-audio-census.json) |
| 5 | `STRA` animations are stored but never drawn | 569 calls across 84 scripts; the renderer never consumes the stored animation descriptor. The exact effect table still needs recovery. | [VM-05](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/vm-findings.md), [RA-01](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/render-audio-findings.md) |
| 6 | Timed text/window closing becomes an immediate clear | `CLO4`/`CLO5` have 1,561 positive-duration calls whose durations are ignored; all four close-command variants currently share one implementation. | [VM-02](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/vm-findings.md) |
| 7 | Displayed config controls are incorrectly connected or inert | **Menu volume** changes master volume; **Read text speed** and **Read scenes auto skip** have no consumers. The typing preview is a static label. | [UI-01–02](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/ui-save-findings.md) |
| 8 | Backlog cannot provide the native rewind workflow | Rows are plain strings with no selected-line restore. Keyboard scrolling is unwired. The screen renders only the latest 400 strings, whereas the native ring holds 800 records of several types. | [UI-06–07](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/ui-save-findings.md) |

For a quick shader sanity check: with an opaque white source, the original subtract shader leaves the backdrop unchanged (`max(0,b+s-1)`); the port's `b-s` makes it black. This is a concrete arithmetic mismatch, independent of a screenshot's subjective appearance.

## Other missing or incorrect behavior

| Area | Finding | Evidence and limits |
|---|---|---|
| Config | The **Fast forward**, **Text display**, and **Read text display** setting groups are absent, and the page cannot scroll to them. | UI-03; groups verified against the shipped translated label art. Exact remaining options/defaults are not fully decoded. |
| Character voices | Native character-specific controls are absent. The native sound screen iterates 19 character entries; the web has only global voice on/off and stop-on-input pairs. | UI-04; native sound-page loop and setting accesses inspected. |
| Save slots | The web caps manual slots at 60 and has one separate quicksave; it has no automatic-save section/marker. Native code distinguishes slot indices at or above 100. | UI-05; exact native automatic-slot count and rotation remain unknown. |
| CG viewer | Authored image rectangles and descriptor flags are ignored; the viewer always displays the whole image. | UI-08; 19 of 1,977 variant descriptors have nonzero x/y, and six have flag 1. The flag's exact transform is unresolved. |
| CG viewer | Zoom, pan and reset controls are missing. | UI-09; native constructor/update/bounds paths compared with the web viewer's complete actions. |
| Page bookkeeping | All 17,207 `PGST` calls are ineffective because the optional callback is never bound. The native engine stores/searches page IDs. | VM-03; exact downstream read/save/rewind effects need state comparison. |
| Conditional flow | Both `IFSC` calls always branch in the web version; native code tests a byte first. | VM-04; flag meaning/lifetime unresolved, so a wrong branch on every playthrough is not asserted. |
| Special sequences | `XSTP` and `XRSM` are empty, although native code creates/changes a task. Both occur in STAFFROLL and a late Ciel script. | VM-06; exact missing output needs tracing. Their names alone do not prove pause/resume semantics. |
| Other native state | `RDAS` (530), `SHAF` (397), and `TRPY` (2) are empty; `RTM2` and the continuation flag of `RTMN` are not reproduced. | VM-07; related `RDST` progress and a special prologue end rule provide overlapping web behavior. Do not count all progress as missing. |
| Audio options | Additional authored parameters survive export but are discarded by playback, including option 69 used by 131 music calls. | RA-07; native option 69 reaches playback setup. Exact units and the other options' meanings require further tracing. |
| Text windows | A fixed `txtwindow01` replaces the native selection of 33 standard/balloon styles. The Ciel-specific third click-mark kind is absent. | RA-08; selection mapping and affected-scene count unresolved. |
| Inline text graphics | 52 `[ber00]` and eight `[zap00]` tags over six dialogue lines are replaced by em dashes. | RA-09; original glyph mapping/placement still needs recovery. |
| Image sizing | The storage-size calculation ignores motion tracks and parent scale chains. Some images are reduced before a later native zoom enlarges them. | RA-10; concrete `IMG0879` / motion 2824 example and bounded candidate census provided. |
| UI transitions | Gallery sections switch immediately; notifications use web toasts; mode-panel help captions are absent; help bars use substitute text/glyphs. | UI-11; native section open/close timings are only partially traced. |
| Input | There is no Gamepad API/controller input, while the Controls page shows controller instructions. Touch covers basic advance but not every menu/backlog/rewind action. | UI-12; complete web input-source search. |
| Title progression | Title stage is recomputed from all reached-scene flags rather than persisted and advanced one stage per title invocation. | UI-10; most observable after imported/migrated progress; ordinary sequential play may conceal it. |
| Debug script | ASCII decoding damages 15 literal fields in `TEST_SCRIPT`, and eight literal messages there do not display. | VM-08; the scan did not find corresponding story-dialogue loss. |

The detailed reports contain native addresses, exact source lines, search boundaries, and supporting byte/table measurements:

- [Script/VM findings and all 94 commands](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/vm-findings.md)
- [Rendering, animation, text, audio and media findings](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/render-audio-findings.md)
- [Menus, config, saves, backlog, gallery and progression findings](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/ui-save-findings.md)

## Fidelity differences and remaining approximations

These are separate from the confirmed functional defects above. Some are deliberate storage/browser adaptations; none should be described as exact original rendering.

- Images use AVIF quality 70, and **729** indexed images are stored below their native resolution. Sound effects are decoded and re-encoded as Opus. Music and voices instead retain their original Opus packets; movies use original MP4 bytes.
- Blur is regenerated rather than selecting the authored blurred texture variants (corrected 2026-11-09: a Gaussian fitted to those files per size class, `blurSigma`; see FIXES.md, "Blur numbers are not pixel radii").
- Cubic motion tangents and some easing families are approximations. Quakes, the grain and the speed lines' angles use replacement random sampling (the game's generator for them is seeded anew at every launch); a sway and the speed lines' counts and distances use the game's own `rand()` since 2026-11-09 (TODO item 120). Focus-line geometry is partly guessed; layer-mask softness uses an assumed conversion.
- Story text uses host Georgia/Times fonts and DOM layout. Exact font metrics, ruby positioning, shadows, wrapping and typing cadence have not been compared across all scenes or operating systems.
- Click-marker phase restarts per wait; its exact height/reference differs from the native running-frame model. Choice selected-text colors and some UI glow/easing details remain approximated.
- `SPFC`/`SPRD` are reduced to preloading; processed cache slots and their extra parameters are not reproduced. The visible consequence of every use remains unresolved.
- Audio snapshots omit playback phase, fades and one-shots. Matching playing tracks can continue across restore, while other tracks restart. Native save semantics for each state are not fully established.
- Web saves omit backlog history and the rewind trail. Restoring can retain string history from the abandoned session timeline. Native persistence boundaries need comparison before specifying the exact replacement behavior.
- Flowchart and ending migration infer some started/completed flags from later progress. Those heuristics are web policies, not recovered native rules. Gallery source-pack overlap alone was **not** accepted as proof of wrong images: the inspected native resolver also tries the ordinary pack first.
- Continue/title admission is based on manual saves; a lone quicksave does not qualify. The exact native first-run/continue policy is still open.

See the detailed reports for evidence anchors and the difference between a proven formula/stub and an unverified approximation.

## Content and integrity checks that passed

The read-only inventory reopened the **current game dump plus translation overlay**, rather than trusting the generated web files alone. REA process Evidence: `ev_3801afdeafc841279d2c51b71bcfec5e0061aa3ce7edca6c97789ffef83843bb`.

| Check | Result |
|---|---|
| Original prepared ARM64 image | SHA-256 `ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951` |
| Script names and generated command/label data | All **549** scripts match the current builder transform; **1,078,741** command instances, **94** distinct commands |
| Original decoded script literals | Only the `TEST_SCRIPT` ASCII-loss cases described above differ under the UTF-8 comparison |
| Jump and label references | No unresolved referenced destinations in the complete 549-script scan |
| Dialogue table | All **43,960** records, including the trailing empty record, match the selected patched source table |
| Selected image archive inventory | All **16,309** generated image-table entries match original pack offsets/sizes under the current selection policy |
| Direct script image names | All **7,328** are present in that image table |
| Direct `VPLY` voice names | All **16,444** distinct names exist in source RomFS streams |
| Music/movie table sources | All **128** music mappings and **41** movie mappings have source files |

An unconverted cache file was not counted as missing game content: the server converts it on demand. These checks establish source availability and exporter consistency, not correct presentation, every dynamic name, every gallery lookup, or successful decoding of every asset.

Reproducible counts: [inventory.json](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/inventory.json), [read-only inventory script](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/inventory.py), [VM inventory](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/vm-inventory.json).

## Runtime verification

**Existing regression suite:** `node --test web-dev/tests/*.test.mjs` passed **60/60** checks. These mostly test synthetic state/interpolation/UI fixtures, so their success does not invalidate the gaps found above.

**REA web smoke run:** all **549** scripts completed its traversal, **1,059,371** operations executed, **84** choices encountered, **0** step-limit loops. The report had no warning/error keys. However, it replaces image loading, disables audio/movies, always takes the first choice and does not explore every branch. The browser console also reported `not implemented: motion track 101960`; the smoke UI misses it because it only collects warn/error, not info. Evidence: `ev_3aab91b3bd015f2cbc8a57be457539ecbe84fcbdaf35c2634e4b693d6c3b00b9`.

**REA interactive web scenarios:** temporary browser profiles reached fresh title, title → config, opening story → backlog → system → save screen. No page exceptions or game-asset HTTP errors appeared in these bounded scenarios; a missing favicon and browser autoplay/performance warnings were observed. These did not test a complete save/load round trip, every control, every route, or actual audio output.

| Web scenario | REA Evidence ID | Screenshot |
|---|---|---|
| Fresh title | `ev_2ad6e9f73a2f829c97215c5301017625bf1d6ede651d1bd931cc9eb887192d6f` | [title](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/title.png) |
| Config | `ev_51cce3d5b4ef914fe1ae63277d2ea97c853cf13ff0b8e263545fc181a32bd986` | [config](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/config.png) |
| Story/backlog/system/save | `ev_27458c36db780dc2a52b502bd647ebfd1ad18b4e73e4acd79860b78ae04fcae5` | [save screen](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/save.png) |

**Native reference check:** the available ARM64 recompiled build was also launched in three bounded headless REA process scenarios. A temporary `NX_DATA_ROOT` isolated writes; the saved-state runs used a copied native save. Original saves were not modified. Native title and load-screen frames were obtained. This build contains compatibility/HUD/title hooks and uses a translated GPU pipeline, so it is a reference to original-code execution through the recompiler, not an independent retail-console oracle. No new correctness finding above depends solely on these unsynchronized screenshots.

- Native executable SHA-256: `a742c7a48f93aad8f75a86c905bc148070263d6ba0d470e1b279a0ed216cba04`.
- Native startup Evidence: `ev_c30818f1207fbfd6e49b4d38519ce66eb2da1642676047de6fd15ab0498b615b`.
- Native saved-profile title Evidence: `ev_bee57f84a353638c7863fced5e31a8a3acccb5b2dcfdbe020707d7b0a8fb37d6`; [title reference](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/native-title.png).
- Native navigation run Evidence: `ev_75eec3a804171dd48f1b3d957bbdd06b11678671fb09e3cc081f59d89c4ee2f9`; [observed load screen](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/native-load.png). The declared input sequence was intended to reach config but reached load; it is recorded by the observed outcome.
- Native runs were intentionally ended at their time limits and terminated with final exit 0. Raw terminal bytes were retained; rendered terminal replay frames were partly omitted by output budgets. The image files are framebuffer readbacks, normalized vertically from bottom-origin storage for viewing. They were not used for a numeric pixel-difference claim.

## Coverage and open obligations

| Question | Status |
|---|---|
| Are the prepared story scripts/dialogue/direct image and voice names missing? | **Answered within the stated inventory boundary:** no missing records/names found. |
| Does every used opcode have an entry point? | **Answered:** yes; full 94-command classification retained. |
| Does every handler reproduce native semantics? | **Partially answered:** concrete omissions identified; many implemented handlers still need semantic comparison. |
| Are render/audio/text effects exact? | **Partially answered:** specific shader/loop/race defects confirmed; curves, timing, raster effects and text layout remain open. |
| Are config/backlog/save/gallery controls complete? | **Partially answered:** concrete missing/miswired controls established; complete native state/serialization and UI timing remain open. |
| Are flowchart/ending unlocks exact under all states? | **Partially answered:** data-backed behavior exists; migration rules and unusual entry/restore paths are not native equivalence proofs. |
| Do all route branches complete without state/timing errors? | **Unresolved:** first-choice smoke traversal is insufficient. |
| Is there synchronized original/web frame and audio equivalence? | **Unresolved:** requires checkpoint-matched original/reference playthroughs, measured frame/audio comparisons, and save-state round trips. |

Next verification should target the actual call sites for scripted saves, cold-loaded prologue voices, blend modes, timed text closes and `STRA`; then cover both route branches, all endings/Ciel episodes, and save/load/rewind under menus, slow assets and skip mode. Track 101960 remains a source anomaly until the native out-of-range behavior is observed; it is not automatically a missing valid track.

## Retained evidence

- [Complete local REA Evidence bundle](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/rea-evidence.json)
- [Compact runtime summary](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/runtime-summary.json)
- [Audited web-source digests](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/audit/source-manifest.json)

Evidence distinguishes original artifact bytes/static native analysis, derived shader math, controlled web/probe behavior, recompiled native runtime observations, and unresolved original-game behavior. Detailed worker reports state their own narrower static boundaries; the later coordinating native runs are documented here.
