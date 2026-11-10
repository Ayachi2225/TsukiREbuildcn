"""blurtest.py <repo root> <catalog> <out.json> [n]: can a _XX_YY variant be rebuilt from its base image by a blur?
For a stratified random sample: decode base and variant, align by centre, search the blur strength that best fits, report PSNR.
"""
import io, json, multiprocessing as mp, os, random, re, sqlite3, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from romio import Rom
import packs, tex

ROOT, CAT, OUT = sys.argv[1:4]
N = int(sys.argv[4]) if len(sys.argv) > 4 else 150
PAT = re.compile(r"^(.*)_(\d\d)_(\d\d)\.(NXGZ|JPG|PNG)$")
_rom = None


def init():
    global _rom
    _rom = Rom(ROOT)


def load(off, size):
    blob = _rom.read("allpac.mrg", off, size)
    if blob[:3] == b"\xff\xd8\xff":
        return np.array(Image.open(io.BytesIO(blob)).convert("RGBA"))
    _, raw, _, _ = packs.unwrap(blob)
    t = tex.textures(raw)[0]
    return tex.decode(t, raw)


def premul(a):
    f = a.astype(np.float32) / 255
    f[..., :3] *= f[..., 3:4]
    return f


def psnr(a, b):
    m = float(np.mean((a - b) ** 2))
    return 99.0 if m < 1e-12 else 10 * np.log10(1 / m)


def gauss(f, sx, sy):
    o = f
    if sx > 0:
        o = ndi.gaussian_filter1d(o, sx, axis=1, mode="constant", truncate=3)
    if sy > 0:
        o = ndi.gaussian_filter1d(o, sy, axis=0, mode="constant", truncate=3)
    return o


def box(f, sx, sy, passes):
    o = f
    for _ in range(passes):
        if sx > 0:
            o = ndi.uniform_filter1d(o, sx, axis=1, mode="constant")
        if sy > 0:
            o = ndi.uniform_filter1d(o, sy, axis=0, mode="constant")
    return o


def work(j):
    name, x, y, bo, bs, vo, vs = j
    try:
        b, v = load(bo, bs), load(vo, vs)
    except Exception as e:
        return dict(name=name, err=str(e)[:100])
    hb, wb = b.shape[:2]; hv, wv = v.shape[:2]
    res = dict(name=name, x=x, y=y, base=[wb, hb], var=[wv, hv], stored=vs)
    # pad the base to the variant's size, centred
    dx, dy = (wv - wb) // 2, (hv - hb) // 2
    res["pad"] = [wv - wb, hv - hb]
    if dx < 0 or dy < 0:
        res["err"] = "variant smaller"; return res
    fb, fv = premul(b), premul(v)
    canvas = np.zeros_like(fv)
    canvas[dy:dy + hb, dx:dx + wb] = fb
    # search on a central crop to keep it fast, full image for the final number
    ch, cw = min(hv, 900), min(wv, 900)
    t, l = (hv - ch) // 2, (wv - cw) // 2
    cv = fv[t:t + ch, l:l + cw]
    cb = canvas[t:t + ch, l:l + cw]
    res["unblurred"] = psnr(cb, cv)
    best = (-1, None)
    for s in [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3, 4]:
        p = psnr(gauss(cb, s * x, s * y), cv)
        if p > best[0]:
            best = (p, ("gauss", s))
    for size in [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]:
        pass
    for passes in (1, 2, 3):
        for mul in (0.5, 1, 1.5, 2, 3, 4):
            sx, sy = int(round(x * mul)) * 2 + 1 if x else 0, int(round(y * mul)) * 2 + 1 if y else 0
            p = psnr(box(cb, sx, sy, passes), cv)
            if p > best[0]:
                best = (p, ("box%d" % passes, mul))
    res["crop_psnr"], res["model"] = best[0], best[1]
    kind, s = best[1]
    if kind == "gauss":
        full = gauss(canvas, s * x, s * y)
    else:
        sx, sy = int(round(x * s)) * 2 + 1 if x else 0, int(round(y * s)) * 2 + 1 if y else 0
        full = box(canvas, sx, sy, int(kind[3:]))
    res["full_psnr"] = psnr(full, fv)
    d = np.abs(full - fv).max(axis=2)
    res["p99_err"] = float(np.percentile(d, 99)) * 255
    return res


def main():
    db = sqlite3.connect(CAT)
    rows = db.execute('select idx,name,off,stored from e where pack="allpac" and idx<14770 order by idx').fetchall()
    by = {r[1].split(".")[0]: r for r in rows}
    groups = {}
    for idx, n, off, st in rows:
        m = PAT.match(n)
        if not m or m[1] not in by:
            continue
        groups.setdefault((m[2], m[3]), []).append((n, int(m[2]), int(m[3]), by[m[1]][2], by[m[1]][3], off, st))
    rnd = random.Random(7)
    jobs = []
    # weighted by bytes, every kind of suffix represented
    keys = sorted(groups, key=lambda k: -sum(g[6] for g in groups[k]))
    pool = [g for k in keys for g in groups[k]]
    tot = sum(g[6] for g in pool)
    for k in keys[:25]:
        jobs += rnd.sample(groups[k], min(3, len(groups[k])))
    jobs += rnd.choices(pool, weights=[g[6] for g in pool], k=max(0, N - len(jobs)))
    jobs = list({j[0]: j for j in jobs}.values())
    print(len(jobs), "samples; suffix bytes", tot >> 20, "MiB", flush=True)
    out = []
    with mp.Pool(4, init) as p:
        for k, r in enumerate(p.imap_unordered(work, jobs)):
            out.append(r)
            if k % 20 == 0:
                print(k, flush=True)
    json.dump(out, open(OUT, "w"), indent=0)
    print("done")


if __name__ == "__main__":
    main()
