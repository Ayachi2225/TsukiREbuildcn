#!/usr/bin/env python3
"""build_images.py: for each image, its stored size and how large the scripts ever draw it.

On the screen, 1280 stored pixels fill the 1920 pixel width at zoom 1000, so an image needs storing only as large as
its biggest use. Writes assets/images.json: NAME -> [stored width, stored height, scale to store it at].
"""
import glob
import json
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "../../web/assets")
CAT = os.path.join(HERE, "../../web-research/analysis/catalog.sqlite")
F = 1.5


def num(s, d=None):
    if not s:
        return d
    m = re.fullmatch(r"(-?\d+)([-+])(\d+)", s)
    if m:
        return int(m[1]) - int(m[3]) if m[2] == "-" else int(m[1]) + int(m[3])
    try:
        return int(s)
    except ValueError:
        return d


def main():
    db = sqlite3.connect(CAT)
    size = {}
    for p, end in (("allpac", 14770), ("allpaccg", None), ("allui", None), ("parts", None)):
        q = f'select name,w,h,idx from e where pack="{p}"' + (f" and idx<{end}" if end else "")
        for name, w, h, idx in db.execute(q):
            k = name.split(".")[0].upper()
            if w and k not in size:
                size[k] = (w, h)
    biggest = {}
    used = set()
    # A layer is drawn at (STCH / SCH2 scale) x (its zoom, which STZ4 and its motion track change) x (its parent's zoom
    # x the parent's size class, through SBAS), as transform.js composes them. The largest of each over the layer's
    # life bounds how large its picture is ever drawn.
    tracks = {}
    anim = os.path.join(ASSETS, "animations.json")
    if os.path.exists(anim):
        tracks = json.load(open(anim)).get("tracks", {})
    track_zoom = {}

    def zoom_of_track(t):
        if t not in track_zoom:
            m = 0
            for f in tracks.get(str(t), {}).get("frames", []):
                for v in (f[7], f[8]):
                    if v is not None and v not in (-32767, -32766):
                        m = max(m, abs(v))
            track_zoom[t] = m
        return track_zoom[t]

    def size_class(name):
        m = re.match(r"^[a-z]+_([lms])_", name or "", re.I)
        return {"l": 0.5, "m": 0.25, "s": 0.125}[m[1].lower()] if m else 1

    def zmax(use):
        return max(use["vals"]) if use["vals"] else use["cur"]

    def finish(layers, lid):
        use = layers.get(lid)
        if not use:
            return
        z = use["base"] / 1000 * zmax(use) / 1000
        seen, p = {lid}, use["parent"]
        while p in layers and p not in seen:
            seen.add(p)
            z *= zmax(layers[p]) / 1000 * size_class(layers[p]["img"])
            p = layers[p]["parent"]
        biggest[use["img"]] = max(biggest.get(use["img"], 0), z * 1000)

    for f in glob.glob(os.path.join(ASSETS, "scripts", "[0-9]*.json")):
        layers = {}
        for o in json.load(open(f))["ops"]:
            op, lid = o[0], (o[1] if len(o) > 1 else None)
            if op in ("STCH", "SCH2") and len(o) > 1:
                src = layers.get(o[19] if len(o) > 19 and o[19] else lid) if op == "SCH2" else None
                img = (o[2].upper() if len(o) > 2 and o[2] else (src["img"] if src else None))
                if not img:
                    continue
                finish(layers, lid)
                used.add(img)
                base = num(o[5] if len(o) > 5 else "", None)
                # A new layer has zoom 1000 until STZ4 or a motion changes it; an expression change (SCH2) keeps the zoom
                # of the layer it copies, which is then drawn.
                layers[lid] = {"img": img, "base": abs(base) if base is not None else (src["base"] if src else 1000),
                               "cur": src["cur"] if src else 1000, "vals": [src["cur"]] if src else [],
                               "parent": src["parent"] if src else None}
            elif op == "STZ4" and lid in layers:
                use = layers[lid]
                for a, b in ((o[2] if len(o) > 2 else "", o[4] if len(o) > 4 else ""), (o[3] if len(o) > 3 else "", o[5] if len(o) > 5 else "")):
                    va = abs(num(a, use["cur"]))
                    vb = abs(num(b, va))
                    use["vals"] += [va, vb]
                use["cur"] = use["vals"][-1]
            elif op == "STMA" and lid in layers and len(o) > 2:
                m = zoom_of_track(num(o[2], 0))
                if m:
                    layers[lid]["vals"] += [layers[lid]["cur"], m]
            elif op == "SBAS" and lid in layers:
                parent = o[2] if len(o) > 2 and o[2] not in ("", "-1") else None
                layers[lid]["parent"] = parent
            elif op == "STCC" and lid is not None:
                for k in (list(layers) if lid == "-1" else [lid]):
                    finish(layers, k)
                    layers.pop(k, None)
        for k in list(layers):
            finish(layers, k)
    out = {}
    hist = {}
    for k, (w, h) in size.items():
        z = biggest.get(k, 1000) / 1000
        # drawn at this many screen pixels per stored pixel; never store more than is drawn, never upscale
        s = min(1.0, max(0.25, F * z))
        s = round(s * 20) / 20
        out[k] = [w, h, s]
        hist[s] = hist.get(s, 0) + 1
    with open(os.path.join(ASSETS, "images.json"), "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print("images", len(out), "used by scripts", len(used), "scale histogram", sorted(hist.items()))
    tot = sum(w * h for w, h, _ in out.values())
    kept = sum(w * h * s * s for w, h, s in out.values())
    print("megapixels stored %.0f -> kept %.0f" % (tot / 1e6, kept / 1e6))


main()
