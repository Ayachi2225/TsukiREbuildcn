"""packs.py - the .hed/.nam/.mrg archives of the game, and what is inside an entry.

.hed: 8 bytes per entry: u32 offset (0x800 sectors), u16 stored size (sectors), u16 raw size (sectors); FFFFFFFF ends it.
.nam: 32 bytes per name, ASCII, CRLF at the end. Names repeat (DUMMY.NXZ, NOFILE.EXISTS).
Entry: 'NXGX' (gzip) or 'NXCX' (zlib): u32 raw size, u32 stored size, then 4 reserved, then the stream at +0x10.
"""
import struct
import zlib

PACKS = ["allpac", "allpaccg", "allpachd", "allpacml", "allpachdml", "allui", "parts"]


def entries(rom, pack):
    hed = rom.read(pack + ".hed")
    names = []
    if pack + ".nam" in rom.names():
        nam = rom.read(pack + ".nam")
        names = [nam[i:i + 32].split(b"\r\n")[0].split(b"\0")[0].decode("ascii", "replace") for i in range(0, len(nam), 32)]
    out = []
    for i in range(len(hed) // 8):
        off, c, r = struct.unpack_from("<IHH", hed, 8 * i)
        if off == 0xFFFFFFFF:
            break
        out.append((i, names[i] if i < len(names) else f"{pack}_{i}", off * 0x800, c * 0x800, r * 0x800))
    return out


def unwrap(blob, limit=None):
    """(kind, raw bytes). kind: gz, z, or the plain magic."""
    m = blob[:4]
    if m == b"NXGX" or m == b"NXCX":
        raw, stored = struct.unpack_from("<II", blob, 4)
        d = zlib.decompressobj(31 if m == b"NXGX" else 15)
        data = blob[16:16 + stored]
        out = d.decompress(data, limit) if limit else d.decompress(data)
        return ("gz" if m == b"NXGX" else "z"), out, raw, stored
    return "plain", blob, len(blob), len(blob)


FORMATS = {  # nn::gfx / BNTX format ids, upper byte = kind
    0x0B: "RGBA8", 0x0C: "BGRA8", 0x07: "RGB565", 0x02: "R8", 0x09: "RG8",
    0x1A: "BC1", 0x1B: "BC2", 0x1C: "BC3", 0x1D: "BC4", 0x1E: "BC5", 0x1F: "BC6", 0x20: "BC7",
}


def bntx_info(raw):
    """Fields of the first texture of a BNTX: name, w, h, format, mips, image size."""
    if raw[:4] != b"BNTX":
        return None
    # NX section at +0x20
    nx = 0x20
    assert raw[nx:nx + 4] == b"NX  "
    count = struct.unpack_from("<I", raw, nx + 4)[0]
    info_off = struct.unpack_from("<Q", raw, nx + 8)[0]  # -> pointer array
    first = struct.unpack_from("<Q", raw, info_off)[0]
    assert raw[first:first + 4] == b"BRTI"
    flags, dim, tile, swiz, mips, samples = struct.unpack_from("<BBHHHI", raw, first + 0x10)
    fmt = struct.unpack_from("<I", raw, first + 0x1C)[0]
    w, h, depth, layers = struct.unpack_from("<IIII", raw, first + 0x24)
    bl = struct.unpack_from("<I", raw, first + 0x34)[0]
    img = struct.unpack_from("<I", raw, first + 0x50)[0]
    return {"count": count, "w": w, "h": h, "fmt": fmt, "fmt_name": FORMATS.get(fmt >> 8, hex(fmt)), "mips": mips,
            "layers": layers, "img": img, "tile": tile, "block_h_log2": bl, "brti": first}
