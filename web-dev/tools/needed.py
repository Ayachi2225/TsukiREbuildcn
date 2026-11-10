#!/usr/bin/env python3
"""needed.py: everything the game can ask web/assets for, and nothing else. Standard library only.

convert_all.py makes this list and check_assets.py checks it. A picture the port makes for itself is not on it: the game's pre-blurred `<name>_XX_YY`
files (renderer.js blurs the sharp one) and the small copies it draws save pictures from (the port takes its own).
"""
import glob
import json
import os
import re

# Sounds that 31 lines of the scripts name and the game's sound archive (knife1.bfsar) does not have: they are silent in the game too.
NOT_IN_GAME = {f"MIX_SE{n:03d}" for n in [*range(7, 16), *range(17, 31), 36, 38]} | {"MIX_SE035_1", "MIX_SE035_2", "MIX_SE035_3", "MIX_SE037_1", "MIX_SE037_2"}


def needed(assets):
    images, voices, sounds = set(), set(), set()
    for f in glob.glob(os.path.join(assets, "scripts", "[0-9]*.json")):
        for o in json.load(open(f))["ops"]:
            if o[0] in ("STCH", "SCH2", "SPFC", "SPRD") and len(o) > 2 and o[2]:
                images.add(o[2].upper())
            elif o[0] in ("VPLY", "VPL2") and len(o) > 1 and o[1]:
                voices.add(o[1])
            elif o[0] == "SEPL" and len(o) > 3 and o[3]:
                sounds.add(o[3].upper())
    for entry in json.load(open(os.path.join(assets, "gallery.json")))["cg"]:      # the CG viewer's pictures
        images |= {v["image"].upper() for v in entry["variants"]}
    previews = json.load(open(os.path.join(assets, "flowchart.json")))["previewNames"]   # the flowchart's preview pictures
    images |= {str(v).upper() for v in (previews.values() if isinstance(previews, dict) else previews) if v}
    images |= {f"RULE_{n:02d}" for n in range(1, 50)}                               # the transition masks
    images &= set(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../data/image_table.json"))))
    code = open(os.path.join(assets, "..", "app", "js", "audio.js"), encoding="utf-8").read()
    sounds |= {s.upper() for s in re.findall(r'"(moon_se\d+)"', code)}              # the sound page's SE Test
    tables = json.load(open(os.path.join(assets, "audio_tables.json")))
    movies = {"TM_CI", "titlebg1", "titlebg2", "titlebg3", "titlebg4"}
    for v in tables["movies"].values():
        movies |= {v} if isinstance(v, str) else set(v.values())
    return {"images": images, "voices": voices, "sounds": sounds - NOT_IN_GAME, "music": {str(n) for n in tables["bgm"].values()}, "movies": movies}
