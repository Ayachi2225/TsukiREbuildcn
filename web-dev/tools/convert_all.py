#!/usr/bin/env python3
"""convert_all.py <repo root> [--jobs N] [img] [voice] [bgm] [se] [movie] [font]: makes everything the game can ask for (needed.py) from the dump, so that
web/ runs by itself. Safe to stop and run again: what exists is skipped."""
import multiprocessing as mp
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "../../web-research/tools"))
import convert
import needed

ASSETS = os.path.join(HERE, "../../web/assets")
FONT = "ja3/SeuratPro-M.otf"
_rom = None


def init(root):
    global _rom
    os.nice(10)
    _rom = convert.open_rom(root)


def work(job):
    kind, name, out = job
    try:
        return (job, convert.make(_rom, kind, name, out), None)
    except Exception as e:
        return (job, False, repr(e)[:160])


def main():
    root = sys.argv[1]
    args = sys.argv[2:]
    jobs_n = 3
    if "--jobs" in args:
        i = args.index("--jobs")
        jobs_n = int(args[i + 1])
        del args[i:i + 2]
    kinds = set(args) or {"img", "voice", "bgm", "se", "movie", "font"}
    want = needed.needed(ASSETS)
    jobs = []
    for kind, key, folder, ext in (("movie", "movies", "movie", ".mp4"), ("bgm", "music", "bgm", ".ogg"), ("se", "sounds", "se", ".ogg"),
                                   ("voice", "voices", "voice", ".ogg"), ("img", "images", "img", ".avif")):
        if kind in kinds:
            jobs += [(kind, n, os.path.join(ASSETS, folder, n + ext)) for n in sorted(want[key])]
    if "font" in kinds:
        jobs.append(("font", FONT, os.path.join(ASSETS, "fonts", os.path.basename(FONT))))
    jobs = [j for j in jobs if not os.path.exists(j[2])]
    print(len(jobs), "to make", flush=True)
    t0 = time.time()
    fails = 0
    with mp.Pool(jobs_n, init, (root,)) as p:
        for k, (job, ok, err) in enumerate(p.imap_unordered(work, jobs, chunksize=1)):
            if not ok:
                fails += 1
                print("failed", job[0], job[1], err, flush=True)
            if k % 200 == 0:
                print(k, "of", len(jobs), round(time.time() - t0), "s", flush=True)
    print("done", len(jobs), "failed", fails, round(time.time() - t0), "s", flush=True)


if __name__ == "__main__":
    main()
