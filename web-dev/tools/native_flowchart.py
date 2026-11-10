#!/usr/bin/env python3
"""Read the original flowchart tables from the user's local game dump.

This module contains the table schema and native drawing constants, not game
text or copied table contents. ``build(root, rom=None)`` returns JSON-compatible
data for build_flowchart.py. Generated output belongs in ignored web/assets.

The addresses below were verified against the patched Japanese executable used
by this port. Refuse a different image rather than silently reading other data.
``main.bin`` is the uncompressed module image produced by the local recompiler;
its RELATIVE relocations must be applied before following the parts pointers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys


IMAGE_SHA256 = "ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951"
GROUP_TABLE = 0x466C18
GROUP_COUNT = 277
CONNECTOR_RECTS = 0x34B8F8
PHASE_RECTS = 0x34B810
TRANSITION_TABLE = 0x3598B4
TRANSITION_COUNT = 629
# SELD's second argument n (1-82): 0x92A60 marks the connector flags of the choice's branches (G400 + (f - 564) / 16,
# bit (f - 564) % 16) as soon as the choice is shown. Rows of three ints at 0x3594D0 + 12 n; -1 is none.
CHOICE_TABLE = 0x3594D0
CHOICE_COUNT = 82
# 0x92A60 also writes four choices by hand (57, 67, 72, 73: a virtual node 512 / 513 / 523 / 517 marked started, completed
# and on the path, and lines 865-866, 977-978 + 886-888, 1167, 1119). The second line of 72 and 73 (1168, 1120) is set
# only while F234 / F256 bit 6 is clear, i.e. while scene 270 / 446 is not on the path: 12_01_CIEL12_3C and
# 13_01_01_CIEL13_1B run RTST 483 / 447 when F069 is 0 and RTST 270 / 446 when it is 1, so the line appears only on the
# F069 = 0 side. All of this depends on the play, so it is applied at run time (SELD_EXTRA in
# web/app/js/flowchart-model.js), not exported here.
# The in-game flowchart's rewind (0x11a58 -> 0x178c8 / 0x17af0) keeps the variables listed at 0x34BA16 (up to 300, -1
# ends; their low byte) and the flags listed at 0x34BC6E (42, kept as 0 or 1; numbers above 1200 are skipped).
REWIND_KEEP, REWIND_KEEP_MAX = 0x34BA16, 300
REWIND_FLAGS, REWIND_FLAG_COUNT = 0x34BC6E, 42


def _jump_flags(image) -> dict[str, int]:
    """Decode native 0x92D30's jump-target -> entry read-flag switch table."""
    result = {}
    for jump in range(240, 2008):
        target = 0x92D70 + 4 * struct.unpack_from("<H", image, 0x358316 + 2 * (jump - 240))[0]
        instruction = struct.unpack_from("<I", image, target)[0]
        opcode = instruction & 0xFF80001F
        if opcode in (0x52800000, 0x12800000):  # movz / movn w0, immediate
            value = ((instruction >> 5) & 0xFFFF) << (16 * ((instruction >> 21) & 3))
            if opcode == 0x12800000:
                value = ~value & 0xFFFFFFFF
            if value >= 0x80000000:
                value -= 0x100000000
        elif target == 0x92D7C and instruction == 0xD65F03C0:
            value = 515  # switch's preloaded w0, preserved by this ret.
        else:
            raise ValueError(f"Unsupported jump read-flag switch target {target:#x}")
        if value > 0:
            result[str(jump)] = value
    return result


def _image(root: Path) -> bytearray:
    path = root / "data/tsuki/analysis/main.bin"
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != IMAGE_SHA256:
        raise ValueError(f"{path}: unsupported executable image for native flowchart tables")
    image = bytearray(raw)
    mod0 = struct.unpack_from("<I", image, 4)[0]
    if image[mod0:mod0 + 4] != b"MOD0":
        raise ValueError(f"{path}: MOD0 header missing")
    dynamic = mod0 + struct.unpack_from("<i", image, mod0 + 4)[0]
    tags = {}
    while True:
        tag, value = struct.unpack_from("<qQ", image, dynamic)
        dynamic += 16
        if tag == 0:
            break
        tags.setdefault(tag, value)
    # DT_RELA=7, DT_RELASZ=8, DT_RELAENT=9; R_AARCH64_RELATIVE=1027.
    for at in range(tags[7], tags[7] + tags[8], tags.get(9, 24)):
        target, info, addend = struct.unpack_from("<QQq", image, at)
        if info & 0xFFFFFFFF == 1027 and target + 8 <= len(image):
            struct.pack_into("<Q", image, target, addend & 0xFFFFFFFFFFFFFFFF)
    return image


def _pack_tools(root: Path):
    tools = str(root / "web-research/tools")
    if tools not in sys.path:
        sys.path.insert(0, tools)
    import packs
    from romio import Rom
    return packs, Rom


def _messages(rom, packs) -> tuple[list[list[str]], str]:
    entry = next(row for row in packs.entries(rom, "allui")
                 if row[1].upper() == "SYSMES_TEXT.DAT")
    _, data, _, _ = packs.unwrap(rom.read("allui.mrg", entry[2], entry[3]))
    count, strings = struct.unpack_from("<II", data)
    if not 0 < count <= 32 or not 1408 <= strings <= 100000:
        raise ValueError("Unsupported SYSMES_TEXT.DAT table")
    languages = []
    for language in range(count):
        table = struct.unpack_from("<Q", data, 16 + language * 8)[0]
        lines = []
        for i in range(strings):
            offset = struct.unpack_from("<Q", data, table + i * 8)[0]
            lines.append(data[offset:data.index(b"\0", offset)].decode("utf-8") if offset else "")
        languages.append(lines)
    return languages, hashlib.sha256(data).hexdigest()


def _previews(rom, packs) -> list[str]:
    entries = packs.entries(rom, "allpaccg")
    top = next(i for i, row in enumerate(entries) if row[1].upper() == "THUMCG_TOP.MZP")
    # Native 0x16E00 uses a90c0("thumcg_top.mzp") + 1 + previewIndex.
    names = [row[1].rsplit(".", 1)[0].upper() for row in entries[top + 1:top + 496]]
    if len(names) != 495:
        raise ValueError("Flowchart preview image table is incomplete")
    return names


def build(root, rom=None) -> dict:
    """Return native groups, sprite crops, localized text and preview names.

    Group order and part column order are authored game data. Negative flags
    are conditional placeholders, zero flags are connector-only cells. Do not
    turn them into ordinary scene nodes. Native 0xFFFC filters/collapses rows
    using save flags before laying out a particular player's chart, so ``y``
    below is the all-rows reference coordinate; rowPitch/columnPitch apply
    after filtering too. ``^`` in localized text is a native newline marker.
    """
    root = Path(root).resolve()
    image = _image(root)
    packs, Rom = _pack_tools(root)
    if rom is None:
        rom = Rom(str(root))
    messages, messages_hash = _messages(rom, packs)
    previews = _previews(rom, packs)
    text = messages[0]
    groups, days = [], []
    current_day, row_y, day_row = 0, 0, 0
    for i in range(GROUP_COUNT):
        index, day, count, reserved, pointer, extra = struct.unpack_from("<4i2Q", image, GROUP_TABLE + 32 * i)
        if index != i or not 0 <= day <= 15 or not 1 <= count <= 9 or reserved or extra:
            raise ValueError(f"Invalid native flowchart group {i}")
        if not days or day != current_day:
            day_row = 0
            if day != current_day:
                row_y += 13  # 0x10558: 8px separator offset + 5px inset.
            days.append({"day": day, "firstGroup": i, "y": row_y})
        current_day = day
        parts = []
        for column in range(count):
            fields = struct.unpack_from("<16i", image, pointer + column * 64)
            flag, line, secondary, jump, phase, thumb, preview, title, note = fields[:9]
            if any(fields[9:]):
                raise ValueError(f"Unexpected runtime state in native flowchart group {i}")
            part = {
                "flag": flag, "line": line, "secondary": secondary,
                "jump": jump, "phase": phase, "thumb": thumb,
                "preview": preview, "titleId": title, "noteId": note,
                "title": text[title] if title >= 0 else "",
                "note": text[note] if note >= 0 else "",
                "previewName": previews[preview] if preview >= 0 else None,
                "column": column, "x": 438 + 96 * column,
                "y": row_y + 4, "lineY": row_y - 1,
            }
            parts.append(part)
        groups.append({"index": index, "day": day, "dayRow": day_row,
                       "y": row_y, "parts": parts})
        row_y += 56
        day_row += 1
    flags = [part["flag"] for group in groups for part in group["parts"] if part["flag"] > 0]
    if len(flags) != 495 or len(set(flags)) != 495 or sum(len(g["parts"]) for g in groups) != 1286:
        raise ValueError("Native flowchart counts do not match the verified layout")
    transitions = []
    for i in range(TRANSITION_COUNT):
        row = struct.unpack_from("<12i", image, TRANSITION_TABLE + 48 * i)
        # 0x954B0 reads the fifth flag only for row454 (its counter is zero).
        length = 5 if i == 454 else 4
        transitions.append({"from": row[0], "to": row[1],
                            "global": [flag for flag in row[2:2 + length] if flag >= 564],
                            "current": [flag for flag in row[7:7 + length] if flag >= 564]})
    choices = {}
    for n in range(1, CHOICE_COUNT + 1):
        row = struct.unpack_from("<3i", image, CHOICE_TABLE + 12 * n)
        choices[str(n)] = [flag for flag in row if 564 <= flag < 564 + 0x2C0]
    keep = []
    for i in range(REWIND_KEEP_MAX):
        value = struct.unpack_from("<h", image, REWIND_KEEP + 2 * i)[0]
        if value < 0:
            break
        if value <= 1200:
            keep.append(value)
    rewind_flags = [v for v in struct.unpack_from("<%dh" % REWIND_FLAG_COUNT, image, REWIND_FLAGS) if 0 <= v <= 1200]
    return {
        "version": 2,
        "source": {"imageSha256": IMAGE_SHA256, "messagesSha256": messages_hash,
                   "groupTable": GROUP_TABLE, "groupStride": 32, "partStride": 64,
                   "transitionTable": TRANSITION_TABLE, "transitionStride": 48,
                   "constructionFunction": 0xFFFC, "nodeFunction": 0x13FD4,
                   "connectorFunction": 0x153B8, "previewFunction": 0x16E00},
        "groups": groups,
        "days": days,
        "connectorRects": [list(struct.unpack_from("<4h", image, CONNECTOR_RECTS + 8 * i)) for i in range(26)],
        "phaseRects": [list(struct.unpack_from("<4h", image, PHASE_RECTS + 8 * i)) for i in range(29)],
        "previewNames": previews,
        "transitions": transitions,
        "choiceFlags": choices,
        "rewind": {"keep": keep, "flags": rewind_flags},
        # 0x92D00 uses script index, not script JUMP number, as its input.
        "scriptExitFlags": [-1] + list(struct.unpack_from("<527i", image, 0x360EA4)),
        "jumpEntryFlags": _jump_flags(image),
        "layout": {
            "stage": [1920, 1080], "viewport": [0, 0, 1920, 1022], "scale": 1,
            "firstColumnX": 438, "columnPitch": 96, "rowPitch": 56,
            "rowNodeY": 4, "rowConnectorY": -1, "dayGap": 13,
            "nodeSize": [104, 64], "thumbAtlasColumns": 20,
            "thumbAtlasCell": [104, 64], "thumbAtlasInset": [1, 1],
            "cursorSize": [104, 64], "cursorCrops": [[8, 8, 104, 64], [120, 8, 104, 64]],
            "phaseTitleX": 208, "phaseTitleYInset": 8, "phaseTitlePitch": 32,
            "selectedScrollBounds": [2, 966],
            "previewPanel": [1352, 96, 488, 596],
            "previewImage": {"x": 1380, "y": 120, "scale": 2 / 3},
            "previewTitle": {"x": 1392, "y": 404, "scale": 1.2, "width": 400, "height": 48, "offset": [-3, -12]},
            "previewNote": {"x": 1392, "y": 452, "scale": 1.2, "width": 400, "height": 200, "offset": [-3, -12]},
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    data = build(args.root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"native flowchart: {len(data['groups'])} rows, 495 scenes, {len(data['days'])} day bands")


if __name__ == "__main__":
    main()
