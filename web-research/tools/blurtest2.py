"""blurtest2.py <repo root> <catalog> <out.json> [n]: as blurtest, but finds the variant's real offset, and fits a box blur and a Gaussian."""
import io, json, multiprocessing as mp, os, random, re, sqlite3, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from romio import Rom
import packs, tex

ROOT, CAT, OUT = sys.argv[1:4]
N = int(sys.argv[4]) if len(sys.argv) > 4 else 120
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


def boxf(f, x, y, passes=1):
    o = f
    for _ in range(passes):
        if x > 0:
            o = ndi.uniform_filter1d(o, 2 * x + 1, axis=1, mode="constant")
        if y > 0:
            o = ndi.uniform_filter1d(o, 2 * y + 1, axis=0, mode="constant")
    return o


def gauss(f, sx, sy):
    o = f
    if sx > 0:
        o = ndi.gaussian_filter1d(o, sx, axis=1, mode="constant", truncate=3)
    if sy > 0:
        o = ndi.gaussian_filter1d(o, sy, axis=0, mode="constant", truncate=3)
    return o


def best_offset(blur_small, var_small):
    """Offset of a (blurred) base inside the variant, by FFT cross-correlation on a centre crop of luminance plus alpha."""
    a = blur_small.sum(axis=2)
    v = var_small.sum(axis=2)
    A = np.fft.rfft2(a - a.mean(), s=v.shape)
    V = np.fft.rfft2(v - v.mean())
    c = np.fft.irfft2(V * np.conj(A), s=v.shape)
    i = np.unravel_index(np.argmax(c), c.shape)
    return i[1] if i[1] < v.shape[1] / 2 else i[1] - v.shape[1], i[0] if i[0] < v.shape[0] / 2 else i[0] - v.shape[0]


def work(j):
    name, x, y, bo, bs, vo, vs = j
    try:
        b, v = load(bo, bs), load(vo, vs)
    except Exception as e:
        return dict(name=name, err=str(e)[:100])
    hb, wb = b.shape[:2]
    hv, wv = v.shape[:2]
    res = dict(name=name, x=x, y=y, base=[wb, hb], var=[wv, hv], stored=vs)
    fb, fv = premul(b), premul(v)
    if wv < wb or hv < hb:
        res["err"] = "smaller"
        return res
    # canvas at variant size holding the base at (0,0), blurred, to find the offset
    canvas = np.zeros_like(fv)
    canvas[:hb, :wb] = fb
    bl = boxf(canvas, x, y)
    dx, dy = best_offset(bl, fv)
    res["offset"] = [int(dx), int(dy)]
    placed = np.zeros_like(fv)
    x0, y0 = max(dx, 0), max(dy, 0)
    sx, sy = max(-dx, 0), max(-dy, 0)
    hh, ww = min(hv - y0, hb - sy), min(wv - x0, wb - sx)
    placed[y0:y0 + hh, x0:x0 + ww] = fb[sy:sy + hh, sx:sx + ww]
    res["unblurred"] = psnr(placed, fv)
    out = {}
    out["box"] = psnr(boxf(placed, x, y), fv)
    out["box2"] = psnr(boxf(placed, max(1, x // 2) if x else 0, max(1, y // 2) if y else 0, 2), fv)
    best = -1
    for s in (0.3, 0.4, 0.5, 0.577, 0.65, 0.7, 0.8, 1.0):
        p = psnr(gauss(placed, s * x, s * y), fv)
        if p > best:
            best, res["gauss_scale"] = p, s
    out["gauss"] = best
    res["fits"] = out
    res["best"] = max(out, key=out.get)
    res["best_psnr"] = max(out.values())
    return res


def main():
    db = sqlite3.connect(CAT)
    rows = db.execute('select idx,name,off,stored from e where pack="allpac" and idx<14770 order by idx').fetchall()
    by = {r[1].split(".")[0]: r for r in rows}
    pool = []
    for idx, n, off, st in rows:
        m = PAT.match(n)
        if m and m[1] in by:
            pool.append((n, int(m[2]), int(m[3]), by[m[1]][2], by[m[1]][3], off, st))
    rnd = random.Random(11)
    jobs = list({j[0]: j for j in rnd.choices(pool, weights=[p[6] for p in pool], k=N)}.values())
    print(len(jobs), "samples", flush=True)
    out = []
    with mp.Pool(4, init) as p:
        for k, r in enumerate(p.imap_unordered(work, jobs)):
            out.append(r)
    json.dump(out, open(OUT, "w"), indent=0)
    print("done")


if __name__ == "__main__":
    main()
