"""encode_test.py <root> <catalog> <out.json> [per class]: re-encode samples of each kind of image at web sizes; report bytes per class and quality."""
import io, json, multiprocessing as mp, os, random, re, sqlite3, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from romio import Rom
import packs, tex
ROOT, CAT, OUT = sys.argv[1:4]
PER = int(sys.argv[4]) if len(sys.argv) > 4 else 24
SCALES = {"1080p": .75, "720p": .5}
_rom = None
def init():
    global _rom
    _rom = Rom(ROOT)
def load(pack, off, size):
    blob = _rom.read(pack + ".mrg", off, size)
    if blob[:3] == b"\xff\xd8\xff":
        return Image.open(io.BytesIO(blob)).convert("RGBA")
    _, raw, _, _ = packs.unwrap(blob)
    t = tex.textures(raw)[0]
    return Image.fromarray(tex.decode(t, raw), "RGBA")
def scale(im, s):
    w, h = max(2, round(im.width * s)), max(2, round(im.height * s))
    return im.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
def psnr(a, b):
    x = np.asarray(a.convert("RGBa"), np.float32) / 255
    y = np.asarray(b.convert("RGBa"), np.float32) / 255
    m = float(np.mean((x - y) ** 2))
    return 99.0 if m < 1e-12 else 10 * np.log10(1 / m)
def enc(im, fmt, **kw):
    b = io.BytesIO()
    has_alpha = im.getextrema()[3][0] < 255
    src = im if has_alpha else im.convert("RGB")
    src.save(b, fmt, **kw)
    d = b.getvalue()
    return d, Image.open(io.BytesIO(d)).convert("RGBA")
def work(j):
    cls, pack, off, size, name, crop_from = j
    try:
        im = load(pack, off, size)
        out = dict(cls=cls, name=name, stored=size, w=im.width, h=im.height)
        if crop_from:
            # keep only the rectangle that differs from the pose's first image
            b = load(*crop_from)
            if b.size != im.size:
                out["fallback"] = "dims"
            else:
                a1 = np.asarray(b.convert("RGBa"), np.int16); a2 = np.asarray(im.convert("RGBa"), np.int16)
                d = np.abs(a1 - a2).max(2) > 8
                ys, xs = np.where(d)
                if len(xs) == 0:
                    out["identical"] = True
                    return out
                m = 8
                box = (max(xs.min() - m, 0), max(ys.min() - m, 0), min(xs.max() + m + 1, im.width), min(ys.max() + m + 1, im.height))
                frac = (box[2] - box[0]) * (box[3] - box[1]) / (im.width * im.height)
                out["bbox_frac"] = frac
                if frac < .5:
                    im = im.crop(box)
                    out["cropped"] = True
        for tier, s in SCALES.items():
            sm = scale(im, s)
            for label, fmt, kw in (("avif55", "AVIF", dict(quality=55, speed=6)), ("avif70", "AVIF", dict(quality=70, speed=6)), ("webp80", "WEBP", dict(quality=80, method=4))):
                t0 = time.time()
                d, dec = enc(sm, fmt, **kw)
                out[f"{tier}_{label}"] = dict(bytes=len(d), psnr=round(psnr(sm, dec), 2), sec=round(time.time() - t0, 2))
        return out
    except Exception as e:
        return dict(cls=cls, name=name, stored=size, err=str(e)[:120])
def main():
    db = sqlite3.connect(CAT)
    rows = db.execute('select idx,name,off,stored,w,h,fmt from e where pack="allpac" and idx<14770 order by idx').fetchall()
    first = {r[1].split(".")[0]: r for r in rows}
    rnd = random.Random(21)
    jobs = []
    scene = [r for k, r in first.items() if re.fullmatch(r"IMG\d{4}", k)]
    for r in rnd.choices(scene, weights=[x[3] for x in scene], k=PER):
        jobs.append(("scene", "allpac", r[2], r[3], r[1], None))
    cg = db.execute('select idx,name,off,stored,w,h,fmt from e where pack="allpaccg" and fmt!=""').fetchall()
    for r in rnd.choices(cg, weights=[x[3] for x in cg], k=PER):
        jobs.append(("gallery", "allpaccg", r[2], r[3], r[1], None))
    pose = {}
    for k, r in first.items():
        m = re.fullmatch(r"([A-Z0-9]{3}_A_\d\d_\d\d)_([A-Z]\d\d)", k)
        if m:
            pose.setdefault(m[1], []).append(r)
    bases = [v[0] for v in pose.values()]
    for r in rnd.choices(bases, weights=[x[3] for x in bases], k=PER):
        jobs.append(("sprite_base", "allpac", r[2], r[3], r[1], None))
    others = [(v[0], o) for v in pose.values() for o in v[1:]]
    for b, o in rnd.choices(others, weights=[x[1][3] for x in others], k=PER):
        jobs.append(("sprite_expr", "allpac", o[2], o[3], o[1], ("allpac", b[2], b[3])))
    jobs = list({(j[0], j[4]): j for j in jobs}.values())
    print(len(jobs), "jobs", flush=True)
    res = []
    with mp.Pool(4, init) as p:
        for k, r in enumerate(p.imap_unordered(work, jobs)):
            res.append(r)
            if k % 10 == 0:
                print(k, flush=True)
    json.dump(res, open(OUT, "w"))
    print("done")
if __name__ == "__main__":
    main()
