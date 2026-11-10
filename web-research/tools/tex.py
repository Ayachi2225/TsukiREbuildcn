"""tex.py - BNTX texture -> RGBA pixels, in memory. Block-linear untile from tools/hud/ui_archive.py; BC decode by texture2ddecoder."""
import os
import sys

import numpy as np
import texture2ddecoder as t2d

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "../../tools/hud"))
sys.path.insert(0, os.path.join(HERE, "../../framework/tools/maxwell"))
import ui_archive
import bntx as B


def textures(raw):
    return B.parse_bntx(raw)


def decode(t, raw, level=0):
    """RGBA uint8 array of one mip level (level 0 by default)."""
    w, h = max(1, t.width >> level), max(1, t.height >> level)
    name = t.format_name.split("_")[0]
    start = t.mip_offsets[level]
    end = t.mip_offsets[level + 1] if level + 1 < t.levels else start + t.image_size
    bw, bh, bpb = t.block_w, t.block_h, t.bpb
    bhl = t.block_height_log2
    rows = (h + bh - 1) // bh
    # the block height shrinks with the mip
    gobs = 1 << bhl
    while gobs > 1 and rows <= (gobs // 2) * 8:
        gobs //= 2
    bhl_m = {1: 0, 2: 1, 4: 2, 8: 3, 16: 4, 32: 5}[gobs]
    data = bytes(raw[start:end]) if level + 1 < t.levels else bytes(raw[start:])
    linear = ui_archive.deswizzle(data, w, h, bhl_m, block=bw, bpb=bpb)
    linear = bytes(linear)
    if name == "BC7":
        out = t2d.decode_bc7(linear, w, h)
    elif name == "BC1":
        out = t2d.decode_bc1(linear, w, h)
    elif name == "BC3":
        out = t2d.decode_bc3(linear, w, h)
    elif name == "BC4":
        out = t2d.decode_bc4(linear, w, h)
    elif name == "BC5":
        out = t2d.decode_bc5(linear, w, h)
    elif bpb == 4:
        a = np.frombuffer(linear, np.uint8).reshape(h, w, 4)
        return a.copy()
    else:
        raise ValueError("format " + t.format_name)
    a = np.frombuffer(out, np.uint8).reshape(h, w, 4)  # BGRA
    return a[:, :, [2, 1, 0, 3]].copy()
