"""derive.py <repo root> <catalog> <out.json>: are small sprites/thumbnails just downscales? how much of a face-variant differs? do gallery images repeat scene images?"""
import io, json, multiprocessing as mp, os, random, re, sqlite3, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from romio import Rom
import packs, tex

ROOT, CAT, OUT = sys.argv[1:4]
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


def down_test(j):
    kind, big, small = j
    try:
        A = load(*big[:3]); S = load(*small[:3])
    except Exception as e:
        return dict(kind=kind, err=str(e)[:80])
    h, w = S.shape[:2]
    best = -1
    pa = Image.fromarray(A)
    # premultiply before scaling
    fa = premul(A)
    im = Image.fromarray((fa * 255 + .5).astype(np.uint8), "RGBA")
    for filt in (Image.BOX, Image.BILINEAR, Image.LANCZOS):
        r = np.asarray(im.resize((w, h), filt)).astype(np.float32) / 255
        p = psnr(r, premul(S))
        best = max(best, p)
    return dict(kind=kind, name=small[3], psnr=best, stored=small[2], big=[A.shape[1], A.shape[0]], small=[w, h])


def expr_test(j):
    base, other = j
    try:
        A = load(*base[:3]); B = load(*other[:3])
    except Exception as e:
        return dict(kind="expr", err=str(e)[:80])
    res = dict(kind="expr", name=other[3], base=base[3], stored=other[2], dims=[list(A.shape[:2]), list(B.shape[:2])])
    if A.shape != B.shape:
        res["same_dims"] = False
        return res
    res["same_dims"] = True
    d = (np.abs(premul(A) - premul(B)).max(axis=2) > 8 / 255)
    ys, xs = np.where(d)
    h, w = A.shape[:2]
    opaque = float((A[..., 3] > 0).mean())
    if len(xs) == 0:
        res.update(bbox_frac=0.0, opaque=opaque, changed=0.0)
        return res
    bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    res.update(bbox=[int(xs.min()), int(ys.min()), int(bw), int(bh)], bbox_frac=float(bw * bh / (w * h)), changed=float(d.mean()), opaque=opaque)
    return res


def sig(j):
    pack, off, size, name, idx = j
    try:
        im = Image.fromarray(load(pack, off, size))
    except Exception as e:
        return (pack, name, idx, None, None)
    w, h = im.size
    bg = Image.new("RGBA", im.size, (0, 0, 0, 255)); bg.alpha_composite(im)
    t = bg.convert("RGB").resize((32, 18), Image.BILINEAR)
    return (pack, name, idx, [w, h], np.asarray(t, np.uint8).tolist())


def main():
    db = sqlite3.connect(CAT)
    rows = db.execute('select idx,name,off,stored,w,h from e where pack="allpac" order by idx').fetchall()
    rnd = random.Random(5)
    first = {r[1].split(".")[0]: r for r in rows if r[0] < 14770}
    second = {r[1].split(".")[0]: r for r in rows if r[0] >= 14770}
    out = {}
    jobs = []
    a = [(k, v) for k, v in first.items() if re.match(r"^[A-Z0-9]{3}_A_", k)]
    for lod in "LMS":
        cand = [(first[k], first[k[:4] + lod + k[5:]]) for k, _ in a if k[:4] + lod + k[5:] in first]
        for b, s in rnd.sample(cand, min(35, len(cand))):
            jobs.append((lod, ("allpac", b[2], b[3], b[1]), ("allpac", s[2], s[3], s[1])))
    cand = [(first[k], second[k]) for k in second if k in first]
    for b, s in rnd.sample(cand, min(40, len(cand))):
        jobs.append(("thumb", ("allpac", b[2], b[3], b[1]), ("allpac", s[2], s[3], s[1])))
    with mp.Pool(4, init) as p:
        out["down"] = p.map(down_test, jobs)
        # expressions: same pose, N-number differs, base only
        pose = {}
        for k, r in first.items():
            m = re.fullmatch(r"([A-Z0-9]{3}_[AL]_\d\d_\d\d)_([A-Z]\d\d)", k)
            if m:
                pose.setdefault(m[1], []).append(r)
        multi = [v for v in pose.values() if len(v) > 1]
        print("poses", len(pose), "multi", len(multi), "entries in multi", sum(len(v) for v in multi), "bytes", sum(x[3] for v in multi for x in v) >> 20, flush=True)
        ej = []
        for v in rnd.sample(multi, min(90, len(multi))):
            b = v[0]
            for o in rnd.sample(v[1:], min(2, len(v) - 1)):
                ej.append((("allpac", b[2], b[3], b[1]), ("allpac", o[2], o[3], o[1])))
        out["expr"] = p.map(expr_test, ej)
        out["pose_stats"] = dict(poses=len(pose), multi=len(multi), entries=sum(len(v) for v in multi), bytes=sum(x[3] for v in multi for x in v))
        # signatures: gallery pack and scene base images
        cg = db.execute('select idx,name,off,stored from e where pack="allpaccg" and stored>0 and fmt!="" order by idx').fetchall()
        bases = [r for k, r in first.items() if re.fullmatch(r"IMG\d{4}", k)]
        sj = [("allpaccg", r[2], r[3], r[1], r[0]) for r in cg] + [("allpac", r[2], r[3], r[1], r[0]) for r in bases]
        print("signatures", len(sj), flush=True)
        sigs = p.map(sig, sj, chunksize=8)
    json.dump(out, open(OUT, "w"))
    np.savez_compressed(OUT.replace(".json", "_sigs.npz"), meta=np.array([(s[0], s[1], s[2], s[3][0] if s[3] else 0, s[3][1] if s[3] else 0) for s in sigs], dtype=object),
                        sig=np.array([s[4] if s[4] else np.zeros((18, 32, 3)) for s in sigs], np.uint8))
    print("done")


if __name__ == "__main__":
    main()
