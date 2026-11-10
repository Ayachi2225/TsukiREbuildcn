#!/usr/bin/env python3
"""Export the engine's colour effect presets (STEC) to web/assets/effects.json.

Like build_animations.py, this reads the owner's prepared Japanese main image and rejects any other image. No game
data belongs in this source file or in git.

The table: 83 presets of 20 floats at 0x3358b0 (read by 0x3fc0, applied by 0x9f6c0 to the pre_alter shader's
constants in the effect pass 0xa3180). -9 marks a field the preset leaves at its default.
  0-8    per channel R, G, B: gamma, output black, output white (0-255)
  9      1: grayscale; 2: a silhouette in the layer's colour (the STEC 1 colour); 3: a white silhouette
  10-14  colour layer 1: R, G, B, opacity (0-255), blend mode
  15-19  colour layer 2, the same

Also the speed-line presets of FCLN (types 4-33): 30 records of 0x90 bytes at 0x35153c (read by 0x862e0 and
0x86850), each up to four phases of 9 ints: start time (ms), centre x, y (1280x720), start radius min, max,
line count min, max, alpha (0-255), regeneration interval (ms). -1 ends the list.

And STRA's heat haze: entries 1-557 of 10 floats at 0x352bd4 (0x91520 returns n * 0x28 + 0x352bd4 for 0 < n < 558;
0x362a0 turns one into the haze shader's constants). p0 + p7 / 10 and p3 + p7 / 10: waves across the picture's
height for the x and y shift; p1, p4: their phase offsets (s); p2, p5: their amplitude factors; p6: the amplitude;
p8: the speed (p8 / 3 cycles a second); p9: the fade-in (ms) used when STRA gives a time. Entry 0 is unused (null).
"""
import hashlib
import json
import os
from pathlib import Path
import struct
import sys

IMAGE_SHA256 = "ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951"
TABLE, COUNT, FIELDS = 0x3358B0, 83, 20
LINES, LINE_TYPES = 0x35153C, 30
HAZE, HAZE_COUNT, HAZE_FIELDS = 0x352BD4, 557, 10
UNSET = -9.0


def build(root, out=None):
    root = Path(root)
    out = Path(out) if out else root / "web/assets"
    image = (root / "data/tsuki/analysis/main.bin").read_bytes()
    digest = hashlib.sha256(image).hexdigest()
    if digest != IMAGE_SHA256:
        raise ValueError(f"Unsupported main image for effect presets: {digest}")
    presets = []
    for i in range(COUNT):
        f = struct.unpack_from(f"<{FIELDS}f", image, TABLE + i * FIELDS * 4)
        val = lambda k: None if f[k] == UNSET else round(f[k], 6)
        p = {}
        for name, k in (("gamma", 0), ("black", 1), ("white", 2)):
            v = [val(k), val(k + 3), val(k + 6)]
            if any(x is not None for x in v):
                p[name] = v
        if val(9):
            p["mode"] = int(f[9])
        for name, k in (("layer1", 10), ("layer2", 15)):
            if f[k + 4] >= 1:
                p[name] = [max(0, int(f[k + j])) for j in range(4)] + [int(f[k + 4])]
        presets.append(p)
    lines = {}
    for t in range(LINE_TYPES):
        phases = []
        for k in range(4):
            r = struct.unpack_from("<9i", image, LINES + t * 0x90 + k * 0x24)
            if r[0] < 0:
                break
            phases.append(list(r))
        lines[t + 4] = phases
    haze = [None] + [[round(v, 6) for v in struct.unpack_from(f"<{HAZE_FIELDS}f", image, HAZE + n * HAZE_FIELDS * 4)]
                     for n in range(1, HAZE_COUNT + 1)]
    data = {"version": 1, "source": digest, "presets": presets, "focusLines": lines, "haze": haze}
    out.mkdir(parents=True, exist_ok=True)
    target = out / "effects.json"
    temp = target.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, separators=(",", ":")))
    os.replace(temp, target)
    print(f"effect presets {COUNT}, in use {sum(bool(p) for p in presets)}; haze entries {HAZE_COUNT}")
    return data


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2])
