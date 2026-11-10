# UI, save, gallery and progression parity audit

*Status note 2026-11-10: a report of its date, not kept up to date since. Much of what it lists has been fixed; what is still open is in [TODO.md](TODO.md), and the fixes are in [FIXES.md](FIXES.md).*


Audited 2026-11-05. Target: the prepared working port in `/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web`.

This is a read-only implementation audit. Native observations below come from the local recompiler's instruction-preserving C++ output, plus the prepared module and its relocated tables. `_image()` successfully verified module SHA-256 `ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951` before table reads. These are static observations, not observations of the original game executing. REA runtime captures are being collected separately by the coordinating audit. No code fixes are included.

## Confirmed functional gaps and mismatches

### UI-01 — Menu volume changes the entire game's master volume (P2, high confidence)

The shipped, translated `CONF_PARTS_JA/sound_bg.webp` labels its three controls **BGM volume**, **SE volume**, and **Menu volume**. The third web control reads `audio.vol.master` and calls `setVolume("master", ...)`; that gain is above all audio groups. Turning Menu volume down therefore changes dialogue/music/effects as well, and there is no independent menu-volume setting.

Evidence: [UI binding](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:898), [audio master/group setup](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/audio.js:36), [original label art](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/assets/ui/CONF_PARTS_JA/sound_bg.webp). Native sound page: `0x2d980`, [instruction-preserving output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:11517).

### UI-02 — Read text speed and Read scenes auto skip controls do nothing (P2, high confidence)

The system page exposes `readSpeed` and `skipRead`, and the settings code saves their values. A complete literal-reference search of `web/app` found no execution consumer for either value. `setSetting()` always sets `text.speed` from `textSpeed`; it never selects the read speed. Likewise the Read scenes auto skip radio never changes VM behavior. These are inert controls, not merely different defaults. The preview text is a static string, so it also fails to demonstrate the selected typing speed.

Evidence: [settings and applications](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/main.js:35), [four sliders/static preview/radio](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:878), [original system labels](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/assets/ui/CONF_PARTS_JA/system_bg.webp).

### UI-03 — Three additional native system-setting groups are absent (P2, high confidence for absence)

The same shipped system art contains groups titled **Fast forward**, **Text display**, and **Read text display**, below Read scenes auto skip. Web `config("system")` creates only four sliders and one ON/OFF pair, with no controls corresponding to those three groups. The page also uses an 860 px section from the longer art and provides no configuration scrolling. Exact option choices/defaults and their engine semantics still require a focused native trace; the absence of the groups is established.

Evidence: [entire system-page constructor](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:878), [original art](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/assets/ui/CONF_PARTS_JA/system_bg.webp). Native config starts at `0x2aa80` and draws subpages at `0x2d570`/`0x2d980`.

### UI-04 — Character voice settings are absent (P2, high confidence)

The original sound page iterates 19 character entries, checks which entries are available, draws a row for each, and reads its individual setting at `settings + 0x34 + 2*i`. Web sound config creates only global Play all voices and Voices stop on input pairs. It has no character rows, volume sliders, mute or sample-play controls. The original voice background itself has the long list of slider tracks; the web draws only a short 400 px section of it. The extracted `conf_faceicon`, `conf_name`, `btn_mute`, and `btn_test` art remains unused. Character-specific unlock conditions and exact default volumes were not exhaustively decoded.

Evidence: native `0x2d980` [loop and setting access](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:11517), native row helper `0x2d040` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:10906), [web sound page](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:894), [original voice art](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/assets/ui/CONF_PARTS_JA/voice_bg.webp).

### UI-05 — Autosaves are absent and save capacity is reduced (P2, high confidence)

The web exposes 60 numbered-by-index manual save objects and one separate quicksave. There is no autosave writer or autosave section in the application. Native save rendering explicitly distinguishes slot indices `>= 100`, draws their `saveauto` marker, and native interaction separately handles slots above 99. The web therefore cannot reproduce native automatic recovery points. The precise count and rotation policy of native automatic slots remain unverified; do not infer them merely from the threshold.

Evidence: [60-slot limit and writer](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:635), [separate single quicksave](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/main.js:269), native `0x4f240` (notably the `0x50410` area and index threshold) [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_006.cpp:8265), native save interaction `0x50fc0` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_006.cpp:10239).

### UI-06 — Backlog cannot resume from a selected line (P2, high confidence)

The native backlog builds a list from its ring records (`0x27eb0`), handles record selection/scrolling (`0x28a90`), and restores the chosen record in `0x28d50`, calling `0x5baf0(selected, 0)`, `0x5d710(selected)` and `0x8c3a0`. Web backlog rows are plain `<p>` text with no cursor, selection, activation or corresponding restore action. The separate R/Previous message/Previous choice trail does not provide the original backlog's select-any-visible-record workflow.

Evidence: [web backlog](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:914); native [list construction](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:5276), [selection](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:6095), [restore](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:6288).

### UI-07 — Backlog has no implemented keyboard scrolling (P2, high confidence)

`backlog()` assigns `this.keyScroll = list`, but `keyScroll` is never read anywhere in the app. The screen registers only its Back button as a UI item, so Up/Down merely select that button; Page Up/Down are not handled. Mouse wheel and the browser scrollbar remain usable. The web keeps at most 800 string log entries and renders only the last 400. Native uses an 800-record ring containing several record types, so those counts are not a direct message-for-message equivalence.

Evidence: [unused assignment](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:941), [UI key dispatcher](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:173), [plain-string history/cap](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/textbox.js:249), native `0x28a90` keyboard/scroll handling [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_003.cpp:6095).

### UI-08 — CG viewer discards the authored rectangle and flag (P2, high confidence)

The exporter retains each variant's rectangle coordinates and flag. Native `0xbe84` reads the four rectangle values from its descriptor, passes the rectangle to `0x251a4`, computes placement/scale from those values, and conditionally calls an additional transform method when the descriptor flag is set. Web viewer uses only `variant.image`; it displays a whole `<img>`. It never applies the rectangle or flag. Of the current 1,977 gallery variant records, **19 have a nonzero x or y** and **6 have flag 1**. The exact orientation controlled by the flag has not been resolved, so this report does not label it a horizontal/vertical flip.

Evidence: [web full-image viewer](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/gallery.js:274), [exported fields](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web-dev/tools/build_gallery.py:80), native `0xbe84` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_001.cpp:3), counts from the prepared `gallery.json` (458 entries, 1,977 variants).

### UI-09 — CG viewer zoom, pan and reset are missing (P2, high confidence)

Native viewer update `0xc56c` modifies image scale, clamps it to computed bounds, translates the image through `0xd270`, and resets its scale/position on a separate input. Web viewer only offers previous variant, next variant and close. It has no pointer drag, wheel, zoom or reset handling; fitting the whole picture with CSS cannot reproduce examination of a large image.

Evidence: [web viewer's complete actions](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/gallery.js:283), native `0xc56c` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_001.cpp:487), native bounds/translation helper `0xd270` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_001.cpp:1417).

## Confirmed presentation/adaptation differences

### UI-10 — Title-stage progression is recomputed instead of persisted (P3, high confidence)

Native `0x90180` reads a stored title stage and evaluates one stage-dependent condition per invocation: 0 may become 1 after scene 560 starts, 1 may become 3 after scene 383, and 3 may become 5 after scene 562. Web `titleStage()` starts from 0 and executes all three conditions every call. With migrated/imported progress that already contains all flags, the web immediately selects final stage 5; the native stored sequence would need successive title invocations. Stages 2/4 are not valid intermediate steps in this function: its jump table sends both to the reset path. Ordinary sequential play may hide the difference.

Evidence: [web calculation](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/uifx.js:5), native `0x90180` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_012.cpp:3), verified relocated switch bytes at `0x3529de` = `0,9,28,18,28,23`, variant table at `0x3529e4` = `1,2,3,3,2,4`.

### UI-11 — Screen changes and notifications still use substitute presentation (P3)

Gallery section selection replaces its content synchronously (`content.textContent = ""`), rather than the separate native section open/close tweens documented in the prior native trace at `0x8400`/`0x6764`. Quick save/load and skip notifications use the web toast rather than the original animated `popup_ja`; the selected mode-panel button has no `mode_help` caption. Help bars use keyboard text and HTML glyphs in place of original controller/label art. These are confirmed implementation differences; native section timing was not retraced exhaustively in this pass.

Evidence: [gallery section replacement](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/gallery.js:192), [toast](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/main.js:26), [help text](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:189), [mode panel](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:1048), native popup `0x3b4b0` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_004.cpp:12914), native panel help `0xae590` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_014.cpp:6970), native help bar `0x4a8f0` [output](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/data/tsuki/gen/main/code_006.cpp:3197).

### UI-12 — Controls page describes controller buttons that the web does not accept (P3, high confidence)

The controls page is the original `conf_manual0_ja` picture, showing A/B/X/Y/L/R/ZL/ZR. The app only implements keyboard/mouse/pointer handlers and has no Gamepad API or controller event input. Its keyboard shortcuts also differ from the displayed controller labels. This is an interface-information mismatch even if keyboard/mouse is the intended web input scheme. There is no full touch equivalent for backlog/menu/rewind either; basic click-to-advance still works.

Evidence: [manual-only page](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:905), [actual input handlers](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/main.js:297), [displayed manual](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/assets/ui/CONF_PARTS_JA/conf_manual0_ja.webp). Search boundary: all `web/app` JS/HTML.

## Save/progression behavior that needs explicit acceptance or further comparison

- **History across saves is partial.** Save snapshots contain current-page HTML and a logged counter, but neither the backlog string history nor the rewind trail. Normal restore clears the trail and does not restore the backlog; it can retain session history from the timeline that was just abandoned. Starting directly clears history. These are observed web behaviors; the exact native persistence boundary across load/restart was not established here. [Snapshot and restore](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/vm.js:831), [start clears history](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/main.js:160).
- **Read/progression migration invents completion flags.** `FlowProgress.infer()` marks dominator scenes started/completed from a later reached scene; `inferEndings()` grants earlier-version ending entries from completed predecessor scenes or a few read text IDs. These are deliberate web migration heuristics, not recovered native rules. They can make the chart/ending list appear more complete than the exact native bitset would be after imported/partial state. Fresh-play ending admission itself correctly uses episode RDST state. [Flow inference](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/flowchart-model.js:80), [ending migration](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/endings.js:41).
- **Title/continue uses manual saves only.** `title()` decides first-run press-start versus menu from `tsuki.saves`; Continue picks the latest manual slot. A lone quicksave or substantial global progress without a manual slot does not qualify. The native first-run/continue policy needs a focused trace before calling this an exact native mismatch. [Title gate](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:205), [Continue](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:424).
- **Save metadata is approximate.** Route backgrounds are inferred by `ARC`/`CIEL` in script names and chapter cells by prefix tables. Native chooses the info picture from the saved chapter via its table at `0x3506b0` and chapter art at `0x592484`. Date/time digits are custom. A complete native chapter-number-to-script comparison remains open. [Web save metadata](/Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port/web/app/js/ui.js:624).
- **Gallery source-pack precedence is unresolved, not a confirmed bug.** Both archives may contain the same IMG name, but native resolver `0xa90c0` also tries the normal pack before gallery fallback in the inspected call route. Different archive files alone do not prove the web chose a different picture than native would. Do not count archive overlap as a parity defect without tracing the relevant runtime/resource-selection state.
- **Backlog individual voice replay, native save-slot deletion/sorting, exact quicksave history depth, hidden menu gates, and every screen's open/close timing remain unresolved.** No claim of absence in the original follows from not tracing these routines.

## Coverage

| Question | Status | Evidence boundary |
|---|---|---|
| Config controls present and actually connected | Answered for exposed controls; native defaults/remaining option meanings partial | Complete web UI/main literal references; shipped label art; native sound loop |
| Save/load/quick save and autosave structure | Partially answered | Web writers/snapshot/restore; native save draw/interaction thresholds; no exhaustive native save serializer trace |
| Backlog navigation and chosen-line restore | Answered statically | Complete web backlog/key paths; native list/select/restore functions |
| CG gallery viewing/navigation | Answered statically for rectangle/flag/zoom/pan gaps | Complete viewer implementation; native viewer constructor/update/bounds |
| Music/movie gallery and endings | Partially answered | Source read, exported tables, native ending and gallery evidence reused; runtime playback/selection comparison remains |
| Flowchart layout/progression | Partially answered | Source read; data-backed structure present, migration policy identified; not every native row/navigation branch compared |
| Title/system/menu/input presentation | Partially answered | Source read, native title-stage function, original control art and prior native UI trace |
| Pixel/timing equality with original UI | Unresolved | No original-engine paired runtime screenshots in this sub-audit |

No original-engine UI runtime was executed by this worker. Negative searches are bounded to the current prepared web app. This report does not certify that every menu, save state, route or unlock combination has been exercised.
