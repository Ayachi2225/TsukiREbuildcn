"""dump_scripts.py <repo root> <out dir> <base|patch>: allscr.mrg -> one readable .txt per script (commands, no decoding of story text)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from romio import Rom
import mzx
root, out, which = sys.argv[1:4]
r = Rom(root, overlay=which == "patch")
d = r.read("allscr.mrg")
ents = mzx.mrgd(d)
# entry 0: START table of names? entry 1: pack of per-script something
for i, (o, e) in enumerate(ents):
    b = d[o:e]
    if b[:4] == b"MZX0":
        x = mzx.mzx(b)
        if x[:1] == b"\xa0":
            x = bytes(c ^ 0xFF for c in x)
        open(os.path.join(out, f"{i:04d}.txt"), "wb").write(x)
    else:
        open(os.path.join(out, f"{i:04d}.bin"), "wb").write(b)
print(len(ents))
