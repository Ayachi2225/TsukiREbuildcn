#!/usr/bin/env python3
"""build_sounds.py <repo root>: export the interface's own sounds to web/assets/sys/<n>.ogg.

The engine plays interface sound n through 0xacef0(n), which looks the item id up with 0x710(n) in the table at
0x3341a0 of the main image (nine ids, 0x010040d4-0x010040dc) and starts it from knife1.bfsar. The nine are waves of
one wave sound file, so each is found through its own sound entry (sar.Archive.wave_at). Uses are listed in
web-dev/ANIMATIONS.md ("Interface sounds"). The server also makes a missing one on demand; this makes them ahead of time.
Generated files stay in web/assets, out of git.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "../../web-research/tools"))
import convert


def build(root):
    rom = convert.open_rom(root)
    out = os.path.join(HERE, "../../web/assets/sys")
    ids = convert.sys_ids()
    for n in range(convert.SYS_COUNT):
        path = os.path.join(out, f"{n}.ogg")
        ok = convert.make_sys(rom, str(n), path)
        print(n, hex(ids[n]), "ok" if ok else "missing")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(HERE, "../..")))
