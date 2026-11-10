"""test3.py <root> <catalog> <derive_sigs.npz> <out.json>: aligned checks of smaller sprite sizes, gallery duplicates and near-twin scenes."""
import io, json, multiprocessing as mp, os, random, re, sqlite3, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from romio import Rom
import packs, tex
ROOT, CAT, SIGS, OUT = sys.argv[1:5]
_rom = None
def init():
    global _rom
    _rom = Rom(ROOT)
def load(pack, off, size):
    blob = _rom.read(pack + ".mrg", off, size)
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
def offset(a, b):
    """shift of a inside b, both HxWx4 float, by cross-correlation over a shared canvas"""
    h = max(a.shape[0], b.shape[0]); w = max(a.shape[1], b.shape[1])
    x = a.sum(2); y = b.sum(2)
    A = np.fft.rfft2(x - x.mean(), s=(h, w)); B = np.fft.rfft2(y - y.mean(), s=(h, w))
    c = np.fft.irfft2(B * np.conj(A), s=(h, w))
    i = np.unravel_index(np.argmax(c), c.shape)
    dy = i[0] if i[0] < h / 2 else i[0] - h
    dx = i[1] if i[1] < w / 2 else i[1] - w
    return int(dx), int(dy)
def compare(a, b, dx, dy):
    x0, y0 = max(dx, 0), max(dy, 0); sx, sy = max(-dx, 0), max(-dy, 0)
    hh, ww = min(b.shape[0] - y0, a.shape[0] - sy), min(b.shape[1] - x0, a.shape[1] - sx)
    if hh <= 0 or ww <= 0:
        return 0.0, 0.0
    return psnr(a[sy:sy + hh, sx:sx + ww], b[y0:y0 + hh, x0:x0 + ww]), hh * ww / (b.shape[0] * b.shape[1])
def lod(j):
    kind, big, small = j
    A = load(*big[:3]); S = load(*small[:3])
    fa = premul(A); fs = premul(S)
    im = Image.fromarray((fa * 255 + .5).astype(np.uint8), "RGBA")
    # scale from the name's level, not from the file's width: padding differs
    scale = {"L": 2, "M": 4, "S": 8, "thumb": 6}[kind]
    best = (-1, None)
    for filt in (Image.BOX, Image.BILINEAR, Image.LANCZOS):
        w, h = round(A.shape[1] / scale), round(A.shape[0] / scale)
        r = np.asarray(im.resize((w, h), filt), np.float32) / 255
        dx, dy = offset(r, fs)
        p, cov = compare(r, fs, dx, dy)
        if p > best[0]:
            best = (p, (dx, dy, round(cov, 3)))
    return dict(kind=kind, name=small[3], psnr=best[0], off=best[1], stored=small[2], big=A.shape[:2], small=S.shape[:2])
def pair(j):
    kind, a, b = j
    A = load(*a[:3]); B = load(*b[:3])
    r = dict(kind=kind, a=a[3], b=b[3], stored_a=a[2], stored_b=b[2], da=A.shape[:2], db=B.shape[:2])
    fa, fb = premul(A), premul(B)
    if A.shape != B.shape:
        dx, dy = offset(fa, fb)
        r["psnr"], r["cov"] = compare(fa, fb, dx, dy)
        r["off"] = [dx, dy]
        return r
    r["psnr"] = psnr(fa, fb)
    d = np.abs(fa - fb).max(2) > 8 / 255
    r["changed"] = float(d.mean())
    ys, xs = np.where(d)
    if len(xs):
        r["bbox_frac"] = float((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1) / d.size)
    else:
        r["bbox_frac"] = 0.0
    return r
def main():
    db = sqlite3.connect(CAT)
    rows = db.execute('select idx,name,off,stored from e where pack="allpac" order by idx').fetchall()
    first = {r[1].split(".")[0]: r for r in rows if r[0] < 14770}
    second = {r[1].split(".")[0]: r for r in rows if r[0] >= 14770}
    rnd = random.Random(9)
    jobs = []
    # bases only: no blur suffix
    a = [k for k in first if re.fullmatch(r"[A-Z0-9]{3}_A_\d\d_\d\d_[A-Z]\d\d", k)]
    for l in "LMS":
        c = [k for k in a if k[:4] + l + k[5:] in first]
        for k in rnd.sample(c, min(30, len(c))):
            s = first[k[:4] + l + k[5:]]; b = first[k]
            jobs.append((l, ("allpac", b[2], b[3], b[1]), ("allpac", s[2], s[3], s[1])))
    c = [k for k in second if k in first and re.fullmatch(r"IMG\d{4}", k)]
    for k in rnd.sample(c, min(30, len(c))):
        jobs.append(("thumb", ("allpac", first[k][2], first[k][3], k), ("allpac", second[k][2], second[k][3], k)))
    z = np.load(SIGS, allow_pickle=True); meta = z["meta"]; sig = z["sig"].astype(np.float32)
    n = sig.reshape(len(sig), -1); n = n - n.mean(1, keepdims=True); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-6
    cg = [i for i, m in enumerate(meta) if m[0] == "allpaccg"]; sc = [i for i, m in enumerate(meta) if m[0] == "allpac"]
    C = n[cg] @ n[sc].T; best = C.max(1); bi = C.argmax(1)
    cgrows = {r[1]: r for r in db.execute('select idx,name,off,stored from e where pack="allpaccg"').fetchall()}
    byidx = {r[0]: r for r in rows}
    def rowof(pack, m):
        idx = int(m[2])
        if pack == "allpac":
            return byidx[idx]
        return db.execute('select idx,name,off,stored from e where pack="allpaccg" and idx=?', (idx,)).fetchone()
    match = []
    for k, i in enumerate(cg):
        j = sc[bi[k]]
        if best[k] >= .9:
            match.append((float(best[k]), i, j))
    rnd.shuffle(match)
    pj = []
    for s, i, j in match[:50]:
        ra, rb = rowof("allpac", meta[j]), rowof("allpaccg", meta[i])
        pj.append(("cg", ("allpac", ra[2], ra[3], ra[1]), ("allpaccg", rb[2], rb[3], rb[1])))
    CC = n[sc] @ n[sc].T; np.fill_diagonal(CC, 0); mm = CC.max(1); mi = CC.argmax(1)
    tw = [i for i in range(len(sc)) if mm[i] >= .985]
    rnd.shuffle(tw)
    for i in tw[:40]:
        ra, rb = rowof("allpac", meta[sc[i]]), rowof("allpac", meta[sc[mi[i]]])
        pj.append(("twin", ("allpac", ra[2], ra[3], ra[1]), ("allpac", rb[2], rb[3], rb[1])))
    with mp.Pool(4, init) as p:
        res = dict(lod=p.map(lod, jobs), pairs=p.map(pair, pj))
    # byte accounting for gallery matches
    tot = 0
    res["cg_match_counts"] = {str(t): int((best >= t).sum()) for t in (.9, .95, .98, .99)}
    w = np.array([rowof("allpaccg", meta[i])[3] for i in cg])
    res["cg_match_bytes"] = {str(t): int(w[best >= t].sum()) for t in (.9, .95, .98, .99)}
    res["cg_total_bytes"] = int(w.sum())
    res["cg_names_no_match"] = [meta[cg[k]][1] for k in np.argsort(best)[:30]]
    json.dump(res, open(OUT, "w"), default=str)
    print("done")
if __name__ == "__main__":
    main()
