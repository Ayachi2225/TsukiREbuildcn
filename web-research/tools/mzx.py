"""mzx.py - decompress the game's MZX0 script blocks, and read mrgd00 (MZP) packs."""
import struct


def mzx(buf):
    """MZX0: u32 raw size, then a stream of 16-bit-word commands (RLE, back-reference, ring buffer, literal)."""
    assert buf[:4] == b"MZX0"
    size = struct.unpack_from("<I", buf, 4)[0]
    invert = bool(size & 0x80000000)
    size &= 0x7FFFFFFF
    p = 8
    out = bytearray()
    last = b"\xff\xff"
    ring = [b"\xff\xff"] * 64
    wpos = 0
    clear = 0
    while len(out) < size and p < len(buf):
        if clear <= 0:
            clear = 0x1000
            last = b"\xff\xff"
        f = buf[p]; p += 1
        op, arg = f & 3, f >> 2
        clear -= 1 if op == 2 else arg + 1
        if op == 0:
            out += last * (arg + 1)
        elif op == 1:
            k = (buf[p] + 1) * 2; p += 1
            for _ in range(arg + 1):
                last = bytes(out[-k:-k + 2] if k > 2 else out[-2:])
                out += last
        elif op == 2:
            last = ring[arg]
            out += last
        else:
            for _ in range(arg + 1):
                w = buf[p:p + 2]; p += 2
                if invert:
                    w = bytes(c ^ 0xFF for c in w)
                last = ring[wpos] = w
                wpos = (wpos + 1) % 64
                out += last
    return bytes(out[:size])


def mrgd(buf):
    """mrgd00: u16 count at +6, then 8 bytes per entry: u16 sector, u16 byte offset, u16 sectors, u16 low bytes of size."""
    assert buf[:6] == b"mrgd00"
    n = struct.unpack_from("<H", buf, 6)[0]
    hdr = 8 + 8 * n
    out = []
    for i in range(n):
        so, bo, ss, sb = struct.unpack_from("<HHHH", buf, 8 + 8 * i)
        off = hdr + so * 0x800 + bo
        size = (ss - 1) * 0x800 + sb if ss else sb
        # the size field is only a hint: the real end is the next entry's start
        end = len(buf)
        if i + 1 < n:
            so2, bo2 = struct.unpack_from("<HH", buf, 8 + 8 * (i + 1))
            end = hdr + so2 * 0x800 + bo2
        out.append((off, end))
    return out
