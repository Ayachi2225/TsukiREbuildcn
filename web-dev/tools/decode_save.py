"""Decode the original game's save file (savedata000) into the web port's flowchart progress.

    web-research/.venv/bin/python web-dev/tools/decode_save.py <savedata000> [--record N] [--root <port root>]

Prints JSON: "flow" is what the web keeps in localStorage "tsuki.flow.v2" (started / completed / secondary, global),
"play" what one play keeps (path, path lines, current scene: FlowProgress.restore), from the record the native
Continue loads (the newest, system data +0x161e) unless --record is given. The save is only read.

The layout, from the native image (data/tsuki/analysis/main.bin):
- the file is 0x3e7000 bytes (0xa8e30); the system data is its first 0x1740 bytes (0xb5e9c), whose global variables
  G0-G499 start at +0x6c (0xb5ec4 copies 1000 bytes into the G block) and whose +0x161e is the newest record (0x8d2f0);
- record n (0-139) is at 0x1800 + n x 0x7200 (0xb6734 / 0xb67d0), 0x7140 bytes used (0x4ea7c): +0 is 0x3f2 when the
  record is used (0x825a0), +8 the state snapshot of 0x3aa8 bytes (0x527f0);
- a snapshot gives back these story variables (0x5baf0): a fixed list from +0x3402 (F110, the current scene, at +0x48),
  the variables of table 0x351214 as bytes from +0x3489 (the path's words F201-F272 and its lines' F600-F687 among
  them) and those of table 0x3511a4 as bits from +0x3482;
- the bits (0x926b0 / 0x922c0 / 0x92300 / 0x92340 / 0x92380): scene n started G110 + n/16, completed G300 + n/16,
  line s (564-1267) revealed G400 + (s - 564)/16, bit n % 16; on the path F201 + n/8, its line F600 + (s - 564)/8,
  bit n % 8.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

IMAGE_SHA256 = "ac6b01203d0e82e33c38ca9ef2fa0d55f1e55d851919196f9073cdafc41b7951"
SAVE_SIZE = 0x3E7000
G_BLOCK, NEWEST = 0x6C, 0x161E
RECORDS, RECORD_STRIDE, RECORD_SIZE, RECORD_USED = 0x1800, 0x7200, 0x7140, 0x3F2
SNAPSHOT = 8
FIXED, FIXED_TABLE = 0x3402, 0x5BF70   # see fixed_list()
BYTES, BYTE_TABLE, BYTE_COUNT = 0x3489, 0x351214, 300
BITS, BIT_TABLE, BIT_COUNT = 0x3482, 0x3511A4, 42
SCENES, FIRST_LINE, LINES = 576, 564, 0x2C0
# 0x5baf0's fixed list (0x5bf78-0x5c0ac): snapshot +0x3402 + 2k -> F[k-th entry]
FIXED_VARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 22, 991, 985, 954, 966, 965, 964, 931, 932, 933, 934, 935, 936, 937, 938, 939,
              859, 860, 861, 862, 863, 864, 865, 866, 867, 868, 869, 110, 1122]


def i16(b, o):
    return struct.unpack_from("<h", b, o)[0]


def image_tables(root):
    image = (Path(root) / "data/tsuki/analysis/main.bin").read_bytes()
    if hashlib.sha256(image).hexdigest() != IMAGE_SHA256:
        raise SystemExit("main.bin is not the image these offsets were read from")
    byte_vars = []
    for k in range(BYTE_COUNT):
        v = i16(image, BYTE_TABLE + 2 * k)
        if v < 0:
            break
        byte_vars.append(v)
    bit_vars = [i16(image, BIT_TABLE + 2 * k) for k in range(BIT_COUNT)]
    return byte_vars, bit_vars


def record_vars(save, n, byte_vars, bit_vars):
    """The story variables a load of record n gives back (0x5baf0), as {index: value}."""
    base = RECORDS + n * RECORD_STRIDE
    rec = save[base:base + RECORD_SIZE]
    if struct.unpack_from("<H", rec, 0)[0] != RECORD_USED:
        raise SystemExit(f"record {n} is not used")
    snap = rec[SNAPSHOT:]
    f = {}
    for k, v in enumerate(FIXED_VARS):
        f[v] = i16(snap, FIXED + 2 * k)
    for k, v in enumerate(byte_vars):
        if v <= 1200:
            f[v] = snap[BYTES + k]
    for k, v in enumerate(bit_vars):
        if 0 <= v <= 1200:
            f[v] = 1 if snap[BITS + (k >> 3)] & (1 << (k & 7)) else 0
    return f


def decode(save, byte_vars, bit_vars, record=None):
    if len(save) != SAVE_SIZE:
        raise SystemExit(f"not a save of this build ({len(save)} bytes, expected {SAVE_SIZE})")
    g = lambda n: i16(save, G_BLOCK + 2 * n) & 0xFFFF
    gbit = (lambda base, n: bool(g(base + (n >> 4)) & (1 << (n & 15))))
    started = [n for n in range(1, SCENES) if gbit(110, n)]
    completed = [n for n in range(1, SCENES) if gbit(300, n)]
    secondary = [s for s in range(FIRST_LINE, FIRST_LINE + LINES) if gbit(400, s - FIRST_LINE)]
    newest = i16(save, NEWEST)
    n = newest if record is None else record
    f = record_vars(save, n, byte_vars, bit_vars)
    fbit = (lambda base, k: bool(f.get(base + (k >> 3), 0) & (1 << (k & 7))))
    path = [k for k in range(1, SCENES) if fbit(201, k)]
    path_lines = [s for s in range(FIRST_LINE, FIRST_LINE + LINES) if fbit(600, s - FIRST_LINE)]
    return {
        "flow": {"started": started, "completed": completed, "secondary": secondary, "migrated": True},
        "play": {"record": n, "newest": newest, "path": path, "secondary": path_lines, "current": f.get(110, 0)},
    }


def main(argv):
    args = list(argv)
    record, root = None, Path(__file__).resolve().parents[2]
    if "--record" in args:
        i = args.index("--record"); record = int(args[i + 1]); del args[i:i + 2]
    if "--root" in args:
        i = args.index("--root"); root = Path(args[i + 1]); del args[i:i + 2]
    if not args:
        raise SystemExit(__doc__)
    save = Path(args[0]).read_bytes()
    print(json.dumps(decode(save, *image_tables(root), record=record)))


if __name__ == "__main__":
    main(sys.argv[1:])
