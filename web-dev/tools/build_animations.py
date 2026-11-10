#!/usr/bin/env python3
"""Export the Japanese engine's motion tracks to web/assets/animations.json.

Like the other asset builders, this reads the owner's prepared game locally.
The offsets below are verified against the port's Japanese main image; a
different image is rejected rather than interpreted with the wrong layout.
No game data belongs in this source file or in git.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import sys

IMAGE_SHA256 = "ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951"
COUNT = 24192
DURATIONS = 0x399F40
ENDS = 0x3B1940
FRAMES = 0x65CE18
FLAGS = 0x36AB38
HOLD = -32767
# A keyframe is 64 bytes with 28 fields, which 0x99ff0 reads one by one: 0 the time (u32), 1-7 ease, mode, x, y,
# alpha, pivot x and pivot y (s16 from +4), 8 the rotation (s32 at +0x14), 9-27 s16 from +0x18: zoom x / y, the
# panel's x, y, width and height, its frame style and edge width, blend, colour preset, red, green, blue, blur x / y,
# brightness, contrast, film grain and depth. Each exported frame starts with the eleven the port has always read
# (fields 0-5, 8-10, 22 and 23); the rest follow in EXTRA's order with trailing holds (-32767) left out, so a frame
# that sets none of them stays eleven long. animation.js reads the same order.
BASE = (0, 1, 2, 3, 4, 5, 8, 9, 10, 22, 23)
EXTRA = (27, 17, 18, 11, 12, 13, 14, 15, 16, 19, 20, 21, 24, 25, 6, 7, 26)


def field(image, p, k):
    if k == 0:
        return struct.unpack_from("<I", image, p)[0]
    if k == 8:
        return struct.unpack_from("<i", image, p + 0x14)[0]
    return struct.unpack_from("<h", image, p + (4 + 2 * (k - 1) if k <= 7 else 0x18 + 2 * (k - 9)))[0]


def loop_starts(image, generated):
    """Evaluate the original pure integer loop-point lookup, not the game.

    The existing recompiler output provides instruction text, so this asset
    builder needs no disassembler package. Only the lookup's bounded integer
    instructions and reads from this verified image are admitted.
    """
    body = None
    for path in generated.glob("code_*.cpp"):
        hit = re.search(r"void main_000999A0\(.*?\n\}", path.read_text(), re.S)
        if hit:
            body = hit[0]
            break
    if body is None:
        raise ValueError("Motion loop lookup missing: prepare data/tsuki/gen/main first")
    code, pc = {}, 0x999A0
    for line in body.splitlines():
        label = re.match(r"L_([0-9A-F]+):;", line)
        if label:
            pc = int(label[1], 16)
        elif "// " in line:
            instruction = line.split("// ", 1)[1].strip()
            mnemonic, _, operands = instruction.partition(" ")
            code[pc] = mnemonic, operands.strip()
            pc += 4

    def evaluate(track):
        regs, flags, pc = [0] * 31, {}, 0x999A0
        regs[0] = track

        def value(s):
            if s.startswith("#"):
                return int(s[1:], 0)
            if s in ("wzr", "xzr"):
                return 0
            n = regs[int(s[1:])]
            return n & 0xFFFFFFFF if s[0] == "w" else n

        def write(s, n):
            regs[int(s[1:])] = n & ((1 << (32 if s[0] == "w" else 64)) - 1)

        for _ in range(150):
            mnemonic, operands = code[pc]
            args = [p.strip() for p in operands.split(",")]
            next_pc = pc + 4
            if mnemonic in ("mov", "adr", "adrp"):
                write(args[0], value(args[1]))
            elif mnemonic == "sxth":
                n = value(args[1]) & 0xFFFF
                write(args[0], n - 0x10000 if n & 0x8000 else n)
            elif mnemonic in ("add", "sub"):
                n = value(args[2])
                if len(args) > 3:
                    n <<= int(args[3].split("#")[1], 0)
                write(args[0], value(args[1]) + (n if mnemonic == "add" else -n))
            elif mnemonic == "cmp":
                bits = 32 if args[0][0] == "w" else 64
                mask = (1 << bits) - 1
                a, b = value(args[0]) & mask, value(args[1]) & mask
                def signed(n):
                    return n - (1 << bits) if n & (1 << (bits - 1)) else n
                flags = {"eq": a == b, "ne": a != b, "hi": a > b,
                         "le": signed(a) <= signed(b), "gt": signed(a) > signed(b)}
            elif mnemonic.startswith("b."):
                if flags[mnemonic[2:]]:
                    next_pc = value(operands)
            elif mnemonic in ("b", "br"):
                next_pc = value(operands)
            elif mnemonic in ("ldrb", "ldrh"):
                dest, address = operands.split(", ", 1)
                fields = [p.strip() for p in address.strip("[]").split(",")]
                offset = value(fields[1]) if len(fields) > 1 else 0
                if len(fields) > 2:
                    offset <<= int(fields[2].split("#")[1], 0)
                address = value(fields[0]) + offset
                size = 1 if mnemonic == "ldrb" else 2
                if address < 0 or address + size > len(image):
                    raise ValueError("Motion loop lookup read outside main image")
                write(dest, int.from_bytes(image[address:address + size], "little"))
            elif mnemonic == "ret":
                return regs[0]
            else:
                raise ValueError(f"Unsupported motion lookup instruction at {pc:x}: {mnemonic}")
            pc = next_pc
        raise ValueError("Motion loop lookup exceeded instruction bound")

    return [evaluate(k) for k in range(1, COUNT + 1)]


def build(root, out=None):
    root = Path(root)
    out = Path(out) if out else root / "web/assets"
    image = (root / "data/tsuki/analysis/main.bin").read_bytes()
    digest = hashlib.sha256(image).hexdigest()
    if digest != IMAGE_SHA256:
        raise ValueError(f"Unsupported main image for motion tables: {digest}")
    loops = loop_starts(image, root / "data/tsuki/gen/main")
    tracks, start = {}, 0
    for track in range(1, COUNT + 1):
        duration = struct.unpack_from("<I", image, DURATIONS + 4 * (track - 1))[0]
        end = struct.unpack_from("<I", image, ENDS + 4 * (track - 1))[0]
        if not start <= end <= 71905:
            raise ValueError(f"Invalid motion frame range for track {track}")
        frames = []
        for index in range(start, end):
            p = FRAMES + index * 64
            extra = [field(image, p, k) for k in EXTRA]
            while extra and extra[-1] == HOLD:
                extra.pop()
            frames.append([field(image, p, k) for k in BASE] + extra)
        flags = struct.unpack_from("<2I", image, FLAGS + 8 * track)
        tracks[track] = {"duration": duration, "loop": loops[track - 1], "flags": flags, "frames": frames}
        start = end
    data = {"version": 2, "source": digest, "extra": list(EXTRA), "tracks": tracks}
    out.mkdir(parents=True, exist_ok=True)
    target = out / "animations.json"
    temp = target.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, separators=(",", ":")))
    os.replace(temp, target)
    print(f"motion tracks {COUNT}, keyframes {start}, loops {sum(bool(n) for n in loops)}")
    return data


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2])
