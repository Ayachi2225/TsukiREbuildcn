"""sheet.py <repo root> <out.png> <pack:idx|pack:name[#k]> ...: contact sheet of entries, downscaled, for looking at."""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from romio import Rom
import packs, tex

def load(rom, pack, e):
    i, n, o, c, rw = e
    blob = rom.read(pack + ".mrg", o, c)
    if blob[:3] == b"\xff\xd8\xff":
        return Image.open(io.BytesIO(blob)).convert("RGBA"), "JPEG"
    kind, raw, _, _ = packs.unwrap(blob)
    t = tex.textures(raw)[0]
    return Image.fromarray(tex.decode(t, raw), "RGBA"), t.format_name

def main():
    root, out = sys.argv[1:3]
    rom = Rom(root)
    cache = {}
    W, H = 300, 210
    specs = sys.argv[3:]
    cols = 5
    rows = (len(specs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * W, rows * (H + 26)), (70, 70, 90))
    d = ImageDraw.Draw(sheet)
    for k, s in enumerate(specs):
        pack, q = s.split(":")
        es = cache.setdefault(pack, packs.entries(rom, pack))
        which = 0
        if "#" in q:
            q, w = q.split("#"); which = int(w)
        match = [e for e in es if e[1].split(".")[0] == q or e[1] == q]
        x, y = (k % cols) * W, (k // cols) * (H + 26)
        if len(match) <= which:
            d.text((x + 4, y + 4), f"{q}#{which} none", fill=(255, 200, 200)); continue
        im, f = load(rom, pack, match[which])
        label = f"{match[which][1]}#{which} {im.width}x{im.height} {f} {match[which][3]//1024}K"
        th = im.copy(); th.thumbnail((W - 4, H - 4))
        bg = Image.new("RGBA", th.size, (120, 120, 140, 255)); bg.alpha_composite(th)
        sheet.paste(bg.convert("RGB"), (x + 2, y + 24))
        d.text((x + 4, y + 6), label[:48], fill=(255, 255, 255))
    sheet.save(out)
main()
