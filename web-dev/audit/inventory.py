"""Read-only parity inventory of the prepared web copy and its local game inputs.

Prints counts, identities, and bounded discrepancy examples; never emits keys or
dialogue. Run with web-research/.venv/bin/python -I web/audit/inventory.py.
"""
from collections import Counter
from hashlib import sha256
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "web/assets"
sys.path.insert(0, str(ROOT / "web-research/tools"))
from romio import Rom
import mzx
import packs


def digest(data):
    return sha256(data).hexdigest()


def parse_script(raw):
    text = raw.decode("ascii", "replace")
    ops, labels, pos = [], {}, 0
    for m in re.finditer(r"_([A-Za-z0-9_]+)\(([^()]*)\);", text):
        if m.start() != pos:
            raise ValueError(f"unparsed script gap at byte {pos}")
        pos = m.end()
        op, args = m[1], m[2]
        if op.startswith(("ZZ", "ZY")):
            if args:
                labels[args] = len(ops)
        elif op.startswith("ZM"):
            ops.append(["MSG", args])
        else:
            ops.append([op] + (args.split(",") if args else []))
    if pos != len(text):
        raise ValueError(f"unparsed script tail at byte {pos}")
    return {"ops": ops, "labels": labels}


def main():
    rom = Rom(str(ROOT))
    result = {"boundary": "Japanese prepared image and current translation overlay; no original runtime execution"}
    result["native_image_sha256"] = digest((ROOT / "data/tsuki/analysis/main.bin").read_bytes())
    source = rom.read("allscr.mrg")
    entries = mzx.mrgd(source)
    name_bytes = source[entries[0][0]:entries[0][1]]
    names = [name_bytes[i:i+32].split(b"\r\n")[0].split(b"\0")[0].decode() for i in range(0, len(name_bytes), 32)]
    names = [n for n in names if n]
    raw_scripts = []
    for lo, hi in entries[3:]:
        raw = mzx.mzx(source[lo:hi])
        raw_scripts.append(bytes(x ^ 255 for x in raw) if raw[:1] == b"\xa0" else raw)
    if len(raw_scripts) == len(names) + 1 and not raw_scripts[-1]:
        raw_scripts.pop()
    index = json.loads((ASSETS / "scripts/index.json").read_text())
    discrepancies, scripts, counts, non_ascii = [], [], Counter(), []
    for i, (name, raw) in enumerate(zip(names, raw_scripts)):
        parsed = parse_script(raw)
        actual = json.loads((ASSETS / f"scripts/{i}.json").read_text())
        if actual != {"name": name, **parsed}:
            discrepancies.append({"index": i, "name": name})
        if any(x > 127 for x in raw):
            non_ascii.append({"index": i, "name": name, "bytes": sum(x > 127 for x in raw)})
        scripts.append(actual)
        counts.update(o[0] for o in actual["ops"])
    result["scripts"] = {"source_origin": rom.origin("allscr.mrg"), "source_sha256": digest(source), "source_names": len(names), "source_scripts": len(raw_scripts), "web_scripts": len(index["names"]), "name_table_equal": names == index["names"], "prepared_content_mismatches": discrepancies, "ops": sum(counts.values()), "opcode_counts": dict(sorted(counts.items())), "non_ascii_source_scripts": non_ascii, "parse_transform": "matches current ASCII builder; does not validate semantics or non-ASCII fidelity"}
    source_text = rom.read("script_text.mrg")
    text_entries = mzx.mrgd(source_text)
    lo, hi = text_entries[1]
    expected_text = source_text[lo:hi].decode("utf-8", "replace").split("\r\n")
    actual_text = json.loads((ASSETS / "text.json").read_text())
    result["dialogue"] = {"source_origin": rom.origin("script_text.mrg"), "source_sha256": digest(source_text), "source_lines": len(expected_text), "web_lines": len(actual_text), "all_lines_equal": expected_text == actual_text}
    image_table = json.loads((ASSETS / "image_table.json").read_text())
    sizes = json.loads((ASSETS / "images.json").read_text())
    expected_images, pack_counts = {}, {}
    for pack, cap in [("allpac", 14770), ("allpaccg", None), ("allui", None), ("parts", None)]:
        es = packs.entries(rom, pack)
        pack_counts[pack] = {"all_entries": len(es), "selected_nonempty_entries": 0}
        for i, name, offset, stored, _ in es:
            if (cap is not None and i >= cap) or not stored:
                continue
            pack_counts[pack]["selected_nonempty_entries"] += 1
            expected_images.setdefault(name.split(".")[0].upper(), {"p": pack, "o": offset, "s": stored})
    ops = [o for script in scripts for o in script["ops"]]
    image_refs = {o[2].upper() for o in ops if o[0] in ("STCH", "SCH2") and len(o) > 2 and o[2]}
    absent_images = sorted(image_refs - set(image_table))
    stream_names = {n.lower() for n in rom.names() if n.startswith("stream/")}
    voice_refs = {o[1] for o in ops if o[0] == "VPLY" and len(o) > 1 and o[1]}
    absent_voices = sorted(n for n in voice_refs if f"stream/{n}.opus".lower() not in stream_names)
    audio = json.loads((ASSETS / "audio_tables.json").read_text())
    absent_bgm = {k: v for k, v in audio["bgm"].items() if f"stream/{v}.opus".lower() not in stream_names}
    absent_movies = {k: v for k, v in audio["movies"].items() if f"movie/{v}.mp4" not in rom.names()}
    result["image_inventory"] = {"packs": pack_counts, "generated_entries": len(image_table), "all_selected_source_entries_equal": expected_images == image_table, "direct_script_image_names": len(image_refs), "direct_names_absent_from_table": absent_images, "size_records": len(sizes), "stored_below_native_resolution": sum(v[2] < 1 for v in sizes.values()), "on_disk_images": len(list((ASSETS / "img").glob("*.avif"))), "note": "Unconverted files remain available on demand; omitted pack copies do not by themselves establish missing content."}
    result["media_inventory"] = {"direct_voice_names": len(voice_refs), "voice_names_absent_from_rom": absent_voices, "bgm_table_entries": len(audio["bgm"]), "bgm_source_missing": absent_bgm, "movie_table_entries": len(audio["movies"]), "movie_source_missing": absent_movies, "converted_voice_files": len(list((ASSETS / "voice").glob("*.ogg"))), "converted_bgm_files": len(list((ASSETS / "bgm").glob("*.ogg"))), "converted_se_files": len(list((ASSETS / "se").glob("*.ogg")))}
    result["source_manifest_sha256"] = digest(json.dumps({str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in sorted((ROOT / "web/app").rglob("*")) if p.is_file() and p.suffix in (".js", ".css", ".html")}, sort_keys=True).encode())
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
