# VM and script parity audit — 2026-11-05

*Status note 2026-11-10: a report of its date, not kept up to date since. Much of what it lists has been fixed; what is still open is in [TODO.md](TODO.md), and the fixes are in [FIXES.md](FIXES.md).*


This is one part of the broader REA audit. It inspects the working nested web port, the extracted translation-patch scripts, and the prepared original ARM64 image/recompiler output. It changes no engine code. Native statements below are static observations, not observations of original gameplay. The parent investigation owns REA Evidence IDs and runtime captures; this report uses source/file/address anchors and does not invent Evidence IDs.

## Boundary and identity

- Working engine: `web/app/js/vm.js` under /Users/h009/Downloads/tsukire-pc-port/tsukire-pc-port.
- Original image: `data/tsuki/analysis/main.bin`, SHA-256 ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951.
- Original script data: `web-research/extracted/scripts_patch/0003.txt` through `0551.txt`, transformed into `web/assets/scripts/0.json` through `548.json`.
- All 549 script files scanned: 1,078,741 executable command instances, 94 distinct opcode names. All 94 have a JavaScript handler; that does **not** establish semantic parity.
- All 1,741 JUMP instances resolve to an installed script and, where supplied, a label. GOTO, GOTS, IF__, IFNX, IFP4, IFSC and IFUR labels also resolve. This is referential integrity, not proof that every branch is correct or playable.
- Reparsed the UTF-8 extracted patch commands against generated JSON: 548 scripts match after label/message conversion. TEST_SCRIPT (531) loses 15 Japanese literals because `build_core.py:67` decodes scripts as ASCII with replacement. Including that decoding step, all 549 generated JSON scripts match the current builder transform; there is no stale-script mismatch. No gaps or non-whitespace tails were found in the 549 extracted command streams.

## Confirmed gaps and mismatches

### VM-01 — Script-driven save checkpoints and save prompt are absent

**High confidence; static mismatch.** `vm.js:428–429` makes ATSV and WTSV empty, and `vm.js:459` makes SELA empty. The patch contains ATSV **398 times in 314 scripts**, WTSV **28 times in 28 scripts**, and SELA **26 times in 26 scripts**. Consequently these scripted operations cannot create a checkpoint, wait for that operation, or ask the native save question in this engine; manual/quick saving elsewhere does not execute these commands.

The native ATSV dispatch begins at **0x778e8**, parses flags at 0x54040 and enters the state-copy/checkpoint path through **0x78be0 / 0x78fb0** (`data/tsuki/gen/main/code_010.cpp:279`, `:1561`, `:1825`). Details of its save slot rotation and on-disk completion were not established in this sub-audit.

The native SELA route is independently resolved from original image table **0x350c7e** (index 0) to **0x7f6bc** (`code_010.cpp:1447–1457`, `:9165–9172`). It tests **0x85bf0**, which reads state word **+0x8bc / F1118** and returns true for zero (`code_011.cpp:2982–2988`), then invokes **0x92930**, which sets selection type 3 and calls the native selector (`code_012.cpp:2744–2815`). The selector loads **SYSMES 216** for type 3 (`code_011.cpp:773–800`). Direct parsing of patched `SYSMES_TEXT.DAT` confirms message 216 is **“Save Progress?”**; table payload SHA-256 `98fddc0b3f3e9516b3783fc7dcccb7191ddbb07ebd667a17fcb901688aa9e4da`.

This conditional is relevant to ordinary story entry: e.g. `02_00_ARC02_1` sets F1118=1 only inside its F026 direct-entry initialization block (ops 23–52); ordinary entry jumps over that block, then reaches SELA at op 53 and WTSV at 54. The same question cannot appear through SELA in the port.

### VM-02 — Timed text/window closes are reduced to immediate clears

**High confidence; static mismatch.** `vm.js:585–588` implements CLO2, CLO3, CLO4 and CLO5 identically as `text.clear(); text.setOpen(false);`, taking no duration. The original image's CLO2–5 dispatch table at **0x350d02** resolves to four different paths (**0x7f3dc, 0x7f86c, 0x7f898, 0x7f918**; `code_010.cpp:8958–8975`). The latter two parse their time argument and update opacity/rate state (`code_010.cpp:9293–9354`). The patch uses CLO4 **978 times in 295 scripts** and CLO5 **596 times in 203 scripts**. Typical values are 600, 1000, 2000 and 3000; 1,561 of the 1,574 CLO4/CLO5 calls pass a positive duration (972 CLO4 + 589 CLO5), and those timed closes lose that behavior. Exact visual timing still needs original runtime capture.

### VM-03 — Native page markers do nothing in the web engine

**High confidence for omission; downstream impact partly unresolved.** `vm.js:455` delegates PGST to optional `onPage`, but searching all of `web/app` and `web-dev/tests` finds no binding. All **17,207 PGST calls across 519 scripts** are therefore ineffective. Native PGST stores its parsed ID in game state at **+0x8c4** (`code_010.cpp:640–655`, `:1626–1628`) and has a separate page-search path. The port instead uses global text-ID bits (`vm.js:129–150`) and snapshots of its DOM/VM (`vm.js:830–849`). Native page identity/search is absent; whether each user-visible read/save/rewind difference is harmful remains a runtime comparison question.

### VM-04 — IFSC is a hard-coded branch, not the native condition

**High confidence for conditional mismatch; condition meaning unresolved.** `vm.js:395` always goes to its label. Original IFSC calls **0x47b00** and branches only when the returned flag is zero (`code_010.cpp:431–438`); **0x47b00** reads the byte at image-relative **0xb34af0** (`code_006.cpp:37–40`). The two affected scripts are ARCHIVE (op 36, skips F024/F025 writes) and `06_01_CIEL06_4_2` (op 7, skips F053=1). The flag's lifetime/meaning is not established, so this is an unsupported condition, not a proven wrong story branch on every playthrough.

### VM-05 — STRA has no visual implementation

**High confidence; engine source observation.** `vm.js:698–703` stores a `spin` descriptor, and snapshots preserve it via COLOUR/placement, but this method does not execute the native phase-driven animation. **569 calls in 84 scripts** are affected. Its comment anchors native **0x645f0 / 0x3c970**. The rendering audit should establish the exact missing visual families and avoid treating “state saved” as rendered behavior.

### VM-06 — Native XSTP/XRSM task behavior is absent

**High confidence for omitted behavior; exact visible consequence unresolved.** Both web handlers are empty (`vm.js:797–798`). Native XSTP at **0x7802c** writes state **+0x48** and invokes **0x3f600(1,1,0x24,0,0,0)** (`code_010.cpp:774–790`). XRSM routes through **0x77804** to **0x3f9b0(1,1)** (`code_010.cpp:216–219`), updating the native task's +0x2c field (`code_005.cpp:4416–4423`). There are two calls of each: STAFFROLL and `13_01_02_CIEL13_7B`. Do not label these “pause/resume” merely from their names; the task's exact original output remains unverified.

### VM-07 — Other silent stubs remain, with bounded claims

- **RDAS:** 530 calls in 517 scripts; empty at `vm.js:426`. Native **0x79b78** tests scene completion/skip-related state, calls **0x3b480 / 0x3b580**, and ultimately **0x92580** (`code_010.cpp:2609–2635`). Native 0x92580 updates the global started-bit array (`code_012.cpp:2489–2525`), while the web captures related progress via RDST. Thus the missing command is confirmed, but do not double-count all scene unlocks as missing: RDST provides overlapping coverage.
- **SHAF:** 397 calls in 315 scripts; empty at `vm.js:430`. Native **0x7a098** routes an empty argument list to **0x2e560(0,0,0,0)** (`code_010.cpp:2976–2995`), which resets several text-window state fields (`code_003.cpp:12370` onward). Exact user-visible differences are not established here.
- **TRPY:** two calls, values 28 and 29 (QACALL and QA_25); empty at `vm.js:432`. Trophy integration is not implemented. Exact platform trophy identities are unresolved.
- **RTM2:** one call in 00_02, empty at `vm.js:422`; the native continue flag is not represented. RTMN also omits that flag, and main.js substitutes a special rule for script name 00_01 (`main.js:203–208`). Normal new-game flow may be covered by that rule, but alternate native continuation paths need verification.

### VM-08 — Test-script text is damaged or omitted

**High confidence; limited to the retained test script in this search.** TEST_SCRIPT index 531 has 15 literal differences caused by ASCII replacement in `build_core.py:67`; seven are choice labels. Its eight literal MSG commands are dropped by `vm.js:516–521`, which constructs text exclusively from `$number` references. Story MSG/MSAD inputs in the bounded scan use supported `$number` syntax, so this does not establish story dialogue loss.

## Areas with positive static evidence

- All 94 patch opcode names have handlers. Native story commands are not disappearing because their *names* are unrecognized.
- All 549 JSON scripts agree with the current builder transform. Relative to the original decoded script text, the only changed literals are the 15 test-script encoding cases described above.
- No unresolved referenced labels or jump destinations in the 549-script corpus.
- All used WKST comparisons are `eq`; all IF__ comparison names are one of the six implemented names. Scanned STCH/SCH2/STZ4/STGS/STRT/WTTM/STMA/STCF/SOXY numeric positions use syntax the port's `num()` understands (integer, supported simple +/- expression, hex, decimal, or blank).
- IFP4/IFNX specializations are consistent with a Switch baseline. This is not a claim of PS4 parity.
- IFUR kind 1's all-episodes-complete check agrees with the static predicate at **0x926f0** (`code_012.cpp:2586–2621`) and the web's scenes 533–556 test (`endings.js:22–25`).
- END_ is an empty handler, but all 519 occurrences are final commands, so the scan found no content following it that would erroneously execute because of that no-op.

## Complete opcode inventory

“Handler present” means only that the JavaScript entry point exists. Numerical integration, native state side effects, complete branch exploration and audiovisual parity are not certified by this table. Rendering/audio findings are owned by the other audit scopes.

| Opcode | Instances | Scripts | VM line | Assessment |
|---|---:|---:|---:|---|
| ATSV | 398 | 314 | 428 | empty handler; native behavior omitted (see findings/limits) |
| CLO2 | 5 | 5 | 585 | immediate text clear/close; native distinct path |
| CLO3 | 12,208 | 510 | 586 | immediate text clear/close; native distinct path |
| CLO4 | 978 | 295 | 587 | duration ignored; native timed opacity handling omitted |
| CLO5 | 596 | 203 | 588 | duration ignored; native timed opacity handling omitted |
| END_ | 519 | 519 | 418 | empty; all 519 uses are final commands (no observed fall-through issue) |
| FADE | 61 | 19 | 779 | handler present; native semantic parity not fully verified |
| FADS | 34,029 | 521 | 750 | handler present; native semantic parity not fully verified |
| FANX | 2,741 | 318 | 751 | handler present; native semantic parity not fully verified |
| FCLN | 26 | 19 | 786 | handler present; native semantic parity not fully verified |
| FCSP | 31 | 19 | 791 | handler present; native semantic parity not fully verified |
| GOTO | 101 | 27 | 403 | handler present; native semantic parity not fully verified |
| GOTS | 170 | 101 | 414 | handler present; native semantic parity not fully verified |
| IFNX | 228 | 98 | 394 | Switch baseline specialization: always runs Switch block |
| IFP4 | 196 | 89 | 393 | Switch baseline specialization: always skips PS4 block |
| IFSC | 2 | 2 | 395 | unconditional branch replacing native flag test |
| IFUR | 1 | 1 | 397 | kind 1 completion check matches inspected native predicate |
| IF__ | 1,194 | 512 | 392 | handler present; native semantic parity not fully verified |
| JUMP | 1,741 | 520 | 404 | handler present; native semantic parity not fully verified |
| MFAD | 724 | 364 | 807 | handler present; native semantic parity not fully verified |
| MPLY | 1,171 | 452 | 805 | handler present; native semantic parity not fully verified |
| MSAD | 1,492 | 312 | 488 | $id text only; inline message support |
| MSG | 42,298 | 516 | 487 | $id text only; literal MSG payloads omitted |
| MSQK | 30 | 16 | 776 | handler present; native semantic parity not fully verified |
| MVOL | 780 | 220 | 806 | handler present; native semantic parity not fully verified |
| NOP_ | 1 | 1 | 777 | intentional no-op |
| PGST | 17,207 | 519 | 455 | optional callback has no binding; effectively omitted |
| RDAS | 530 | 517 | 426 | empty handler; native behavior omitted (see findings/limits) |
| RDED | 550 | 507 | 427 | handler present; native semantic parity not fully verified |
| RDST | 530 | 517 | 424 | handler present; native semantic parity not fully verified |
| RTM2 | 1 | 1 | 422 | empty handler; native behavior omitted (see findings/limits) |
| RTMN | 1 | 1 | 423 | ends script; native continue flag replaced by script-name-specific main.js behavior |
| RTM_ | 544 | 539 | 421 | script termination implemented |
| RTST | 527 | 517 | 425 | handler present; native semantic parity not fully verified |
| SACL | 450 | 64 | 675 | handler present; native semantic parity not fully verified |
| SBAS | 943 | 122 | 673 | handler present; native semantic parity not fully verified |
| SCH2 | 4,674 | 420 | 612 | handler present; native semantic parity not fully verified |
| SEFD | 3,516 | 412 | 803 | handler present; native semantic parity not fully verified |
| SELA | 26 | 26 | 459 | empty handler; native behavior omitted (see findings/limits) |
| SELD | 170 | 100 | 471 | handler present; native semantic parity not fully verified |
| SELR | 823 | 100 | 458 | handler present; native semantic parity not fully verified |
| SELS | 1 | 1 | 462 | native hint question implemented; execution equivalence not measured |
| SEPL | 14,543 | 480 | 801 | handler present; native semantic parity not fully verified |
| SESP | 18 | 5 | 804 | handler present; native semantic parity not fully verified |
| SEVL | 1,285 | 210 | 802 | handler present; native semantic parity not fully verified |
| SGMA | 109 | 21 | 448 | handler present; native semantic parity not fully verified |
| SHAF | 397 | 315 | 430 | empty handler; native behavior omitted (see findings/limits) |
| SHK2 | 124 | 35 | 769 | handler present; native semantic parity not fully verified |
| SHOK | 870 | 166 | 768 | handler present; native semantic parity not fully verified |
| SHS2 | 400 | 318 | 772 | handler present; native semantic parity not fully verified |
| SNX2 | 1,678 | 250 | 704 | handler present; native semantic parity not fully verified |
| SNX3 | 845 | 167 | 705 | handler present; native semantic parity not fully verified |
| SNX4 | 8,762 | 435 | 680 | handler present; native semantic parity not fully verified |
| SOXY | 208 | 69 | 679 | handler present; native semantic parity not fully verified |
| SPFC | 487 | 16 | 794 | preloads only; processed cache result not reproduced |
| SPMA | 199 | 114 | 454 | handler present; native semantic parity not fully verified |
| SPRC | 85 | 45 | 796 | empty; cache model replaced |
| SPRD | 36 | 25 | 795 | preloads only; processed cache result not reproduced |
| SQK2 | 1,235 | 236 | 770 | handler present; native semantic parity not fully verified |
| SQS2 | 532 | 332 | 771 | handler present; native semantic parity not fully verified |
| SSS2 | 398 | 315 | 773 | handler present; native semantic parity not fully verified |
| SSW2 | 200 | 49 | 774 | handler present; native semantic parity not fully verified |
| STBR | 14,946 | 460 | 648 | handler present; native semantic parity not fully verified |
| STCC | 63,260 | 519 | 636 | handler present; native semantic parity not fully verified |
| STCF | 5,179 | 475 | 736 | handler present; native semantic parity not fully verified |
| STCG | 39 | 1 | 431 | handler present; native semantic parity not fully verified |
| STCH | 54,500 | 521 | 594 | handler present; native semantic parity not fully verified |
| STCL | 9 | 6 | 726 | handler present; native semantic parity not fully verified |
| STCP | 51,568 | 510 | 647 | handler present; native semantic parity not fully verified |
| STEC | 12,906 | 437 | 651 | handler present; native semantic parity not fully verified |
| STGS | 8,114 | 485 | 720 | handler present; native semantic parity not fully verified |
| STMA | 24,333 | 485 | 433 | handler present; native semantic parity not fully verified |
| STNS | 196 | 58 | 694 | handler present; native semantic parity not fully verified |
| STPV | 733 | 174 | 661 | handler present; native semantic parity not fully verified |
| STQK | 3 | 1 | 775 | handler present; native semantic parity not fully verified |
| STRA | 569 | 84 | 700 | state saved; native per-layer drawing omitted |
| STRR | 448 | 118 | 677 | handler present; native semantic parity not fully verified |
| STRT | 21,691 | 516 | 715 | handler present; native semantic parity not fully verified |
| STTR | 111 | 39 | 685 | handler present; native semantic parity not fully verified |
| STZ4 | 32,317 | 512 | 707 | handler present; native semantic parity not fully verified |
| TOMP | 48 | 34 | 812 | handler present; native semantic parity not fully verified |
| TOMW | 48 | 34 | 817 | handler present; native semantic parity not fully verified |
| TRPY | 2 | 2 | 432 | empty handler; native behavior omitted (see findings/limits) |
| VCWT | 75 | 38 | 591 | handler present; native semantic parity not fully verified |
| VPL2 | 16 | 5 | 809 | handler present; native semantic parity not fully verified |
| VPLY | 16,690 | 483 | 808 | handler present; native semantic parity not fully verified |
| WKAD | 45,453 | 516 | 374 | handler present; native semantic parity not fully verified |
| WKOR | 21 | 19 | 378 | handler present; native semantic parity not fully verified |
| WKST | 487,164 | 534 | 373 | handler present; native semantic parity not fully verified |
| WNTY | 58,581 | 521 | 486 | handler present; native semantic parity not fully verified |
| WTSV | 28 | 28 | 429 | empty handler; native behavior omitted (see findings/limits) |
| WTTM | 15,064 | 508 | 590 | handler present; native semantic parity not fully verified |
| XRSM | 2 | 2 | 798 | empty handler; native behavior omitted (see findings/limits) |
| XSTP | 2 | 2 | 797 | empty handler; native behavior omitted (see findings/limits) |

## Remaining obligations

- Compare every selectable branch and route under original save/global state; label resolution and first-choice smoke execution do not do this.
- Observe original cutscene/save-prompt, timed CLO4/CLO5, IFSC flag, and XSTP/XRSM sequences to pin exact output and timing.
- Trace native ATSV/WTSV slots and completion, page/read/skip bookkeeping, TRPY IDs, and special F/C variable side effects beyond the specific references above.
- Reconcile script-time, text-time and audio-time behavior under menu open, hidden tab, slow asset conversion, skip toggles, restore and rewind. Static code inspection cannot certify that sequencing.
- Verify per-scene entry initialization versus the web's `F026=1` direct-entry path and the script-name-specific end handler, especially gallery replays and restores.

The audit identifies concrete omissions; it does not claim an exhaustive original-runtime equivalence proof. `vm-inventory.json` records the counts without including dialogue or proprietary script content.
