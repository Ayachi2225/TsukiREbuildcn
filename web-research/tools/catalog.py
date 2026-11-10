"""catalog.py <repo root> <out.sqlite>: one row per archive entry: sizes, hashes, texture fields. Reads no pixels out."""
import hashlib
import multiprocessing as mp
import os
import sqlite3
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from romio import Rom
import packs

ROOT = sys.argv[1]
OUT = sys.argv[2]
_rom = None


def init():
    global _rom
    _rom = Rom(ROOT)


def work(job):
    pack, i, name, off, stored, rawsec = job
    blob = _rom.read(pack + ".mrg", off, stored) if stored else b""
    row = dict(pack=pack, idx=i, name=name, off=off, stored=len(blob), kind="", raw=0, h_stored="", h_raw="", w=0, h=0, fmt="",
               mips=0, layers=0, count=0, img=0, head=blob[:4].hex())
    if not blob:
        return row
    row["h_stored"] = hashlib.sha1(blob).hexdigest()[:20]
    try:
        kind, raw, rawn, st = packs.unwrap(blob)
        if kind == "plain" and blob[:3] == b"\xff\xd8\xff":
            kind = "jpg"
        row.update(kind=kind, raw=len(raw), h_raw=hashlib.sha1(raw).hexdigest()[:20])
        if kind == "jpg":
            # JPEG size from SOF
            p = 2
            while p + 9 < len(blob):
                if blob[p] != 0xFF:
                    break
                mk = blob[p + 1]
                ln = int.from_bytes(blob[p + 2:p + 4], "big")
                if 0xC0 <= mk <= 0xC3:
                    row["h"], row["w"] = int.from_bytes(blob[p + 5:p + 7], "big"), int.from_bytes(blob[p + 7:p + 9], "big")
                    row["fmt"] = "JPEG"
                    break
                p += 2 + ln
        elif raw[:4] == b"BNTX":
            b = packs.bntx_info(raw)
            row.update(w=b["w"], h=b["h"], fmt=b["fmt_name"], mips=b["mips"], layers=b["layers"], count=b["count"], img=b["img"])
    except Exception as e:
        row["fmt"] = "ERR:" + str(e)[:60]
    return row


def main():
    r = Rom(ROOT)
    jobs = []
    for p in packs.PACKS:
        for i, n, o, c, rw in packs.entries(r, p):
            jobs.append((p, i, n, o, c, rw))
    print(len(jobs), "entries", flush=True)
    db = sqlite3.connect(OUT)
    db.execute("drop table if exists e")
    db.execute("create table e(pack,idx,name,off,stored,kind,raw,h_stored,h_raw,w,h,fmt,mips,layers,count,img,head)")
    t0 = time.time()
    with mp.Pool(6, init) as pool:
        for k, row in enumerate(pool.imap_unordered(work, jobs, chunksize=32)):
            db.execute("insert into e values(:pack,:idx,:name,:off,:stored,:kind,:raw,:h_stored,:h_raw,:w,:h,:fmt,:mips,:layers,:count,:img,:head)", row)
            if k % 3000 == 0:
                db.commit()
                print(k, round(time.time() - t0), "s", flush=True)
    db.commit()
    print("done", round(time.time() - t0), "s", flush=True)


if __name__ == "__main__":
    main()
