"""sar.py - sounds of a NintendoWare sound archive (FSAR), by name: FSAR -> sound -> FWSD -> wave archive -> FWAV -> PCM.

The layout is the documented NW4F one: three sections (STRG, INFO, FILE); INFO holds tables of 8-byte references
(u16 type, u16 pad, s32 offset from the table). DSP-ADPCM is decoded by a small compiled loop (dsp.c), per channel.
"""
import ctypes
import os
import struct
import subprocess
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
_lib = None
_lib_guard = threading.Lock()


def lib():
    global _lib
    with _lib_guard:
        if _lib is None:
            so = os.path.join(HERE, "dsp.dylib")
            src = os.path.join(HERE, "dsp.c")
            if not os.path.exists(so) or os.path.getmtime(so) < os.path.getmtime(src):
                subprocess.check_call(["clang", "-O2", "-shared", "-o", so, src])
            _lib = ctypes.CDLL(so)
    return _lib


def u16(b, o):
    return struct.unpack_from("<H", b, o)[0]


def u32(b, o):
    return struct.unpack_from("<I", b, o)[0]


def s32(b, o):
    return struct.unpack_from("<i", b, o)[0]


def table(b, at):
    """A reference table at `at`: u32 count, then (type, offset) pairs. Returns [(type, absolute offset)]."""
    n = u32(b, at)
    return [(u16(b, at + 4 + 8 * i), at + s32(b, at + 8 + 8 * i)) for i in range(n)]


class Archive:
    def __init__(self, data):
        self.b = b = data
        assert b[:4] == b"FSAR"
        secs = {u16(b, 0x14 + 12 * i): (u32(b, 0x18 + 12 * i), u32(b, 0x1C + 12 * i)) for i in range(u16(b, 0x10))}
        self.strg = secs[0x2000][0]
        self.info = secs[0x2001][0]
        self.file = secs[0x2002][0]
        self._strings()
        self._info()

    def _strings(self):
        b = self.b
        base = self.strg + 8
        # first reference of the block: the string table
        typ, off = u16(b, base), u32(b, base + 4)
        at = base + off
        n = u32(b, at)
        self.strings = []
        for i in range(n):
            o, ln = u32(b, at + 4 + 12 * i + 4), u32(b, at + 4 + 12 * i + 8)
            self.strings.append(b[at + o:at + o + ln - 1].decode("ascii", "replace"))

    def _info(self):
        b = self.b
        base = self.info + 8
        refs = {u16(b, base + 8 * i): base + u32(b, base + 4 + 8 * i) for i in range(8)}
        self.sounds = table(b, refs[0x2100])
        self.wars = table(b, refs[0x2103])
        self.files = table(b, refs[0x2106])
        self.by_name = {}
        for i, (_, at) in enumerate(self.sounds):
            file_id = u32(b, at)
            flags = u32(b, at + 0x14)
            name = None
            p = at + 0x18
            if flags & 1:
                sid = u32(b, p)
                if sid < len(self.strings):
                    name = self.strings[sid]
            if name:
                self.by_name[name.upper()] = (i, file_id, at)

    def file_range(self, file_id):
        b = self.b
        typ, at = self.files[file_id]
        rt, ro = u16(b, at), s32(b, at + 4)
        if rt != 0x220C:
            return None
        loc = at + ro
        off, size = s32(b, loc + 4), u32(b, loc + 8)
        if off < 0 or size == 0xFFFFFFFF:
            return None
        start = self.file + 8 + off
        return start, size

    def find(self, name):
        n = name.upper()
        for k in (n, "WSD_" + n):
            if k in self.by_name:
                return self.by_name[k]
        return None

    def fwav_of(self, name):
        """The FWAV bytes of a wave sound."""
        hit = self.find(name)
        if not hit:
            return None
        idx, file_id, sinfo = hit
        return self._fwav(file_id, sinfo)

    def fwav_at(self, index):
        """The FWAV bytes of the wave sound with this index in the sound table (the low 24 bits of its item id)."""
        if not 0 <= index < len(self.sounds):
            return None
        _, sinfo = self.sounds[index]
        return self._fwav(u32(self.b, sinfo), sinfo)

    def _fwav(self, file_id, sinfo):
        b = self.b
        rng = self.file_range(file_id)
        if not rng:
            return None
        start, _ = rng
        if b[start:start + 4] != b"FWSD":
            return None
        # which sound of the wave sound set: the sound's detail block (offset from the sound info)
        rt, ro = u16(b, sinfo + 0x0C), s32(b, sinfo + 0x10)
        wsd_index = u32(b, sinfo + ro) & 0xFFFF if rt == 0x2201 or rt == 0x2202 else 0
        info = start + u32(b, start + 0x18)
        assert b[info:info + 4] == b"INFO"
        base = info + 8
        # INFO of FWSD: reference to the wave id table, reference to the sound data table
        wtab = base + s32(b, base + 4)
        n = u32(b, wtab)
        # The sound's own entry names its wave: sound data -> note info table -> first note -> wave id index.
        # A file can hold several sounds (the interface sounds share one); a single-sound file gives 0.
        k = 0
        stab = base + s32(b, base + 12)
        if wsd_index < u32(b, stab):
            sd = stab + s32(b, stab + 8 + 8 * wsd_index)
            notes = sd + s32(b, sd + 0x14)
            if u32(b, notes) > 0:
                k = u32(b, notes + s32(b, notes + 8))
        if k >= n:
            k = 0
        war_item, wave_i = u32(b, wtab + 4 + 8 * k), u32(b, wtab + 8 + 8 * k)
        war_i = war_item & 0xFFFFFF
        wt, wat = self.wars[war_i]
        war_file = u32(b, wat)
        wr = self.file_range(war_file)
        if not wr:
            return None
        ws, _ = wr
        assert b[ws:ws + 4] == b"FWAR", b[ws:ws + 4]
        wi = ws + u32(b, ws + 0x18)
        wf = ws + u32(b, ws + 0x24)
        cnt = u32(b, wi + 8)
        ent = wi + 12 + 12 * wave_i
        off, size = u32(b, ent + 4), u32(b, ent + 8)
        return b[wf + 8 + off:wf + 8 + off + size]

    def wave(self, name):
        """(interleaved s16 PCM bytes, channels, rate), or None."""
        w = self.fwav_of(name)
        if not w:
            return None
        return decode_fwav(w)

    def wave_at(self, index):
        """The same, for the sound with this index in the sound table."""
        w = self.fwav_at(index)
        return decode_fwav(w) if w else None

    def loop_of(self, name):
        w = self.fwav_of(name)
        if not w:
            return None
        info = u32(w, 0x18)
        return dict(loop=w[info + 9] != 0, rate=u32(w, info + 0xC), start=u32(w, info + 0x10), end=u32(w, info + 0x14))


def decode_fwav(w):
    assert w[:4] == b"FWAV"
    info = u32(w, 0x18)
    data = u32(w, 0x24)
    enc, loop = w[info + 8], w[info + 9]
    rate = u32(w, info + 0xC)
    samples = u32(w, info + 0x14)
    ct = info + 0x1C
    n = u32(w, ct)
    pcm = (ctypes.c_int16 * (samples * n))()
    src = (ctypes.c_ubyte * len(w)).from_buffer_copy(w)
    for c in range(n):
        ci = ct + s32(w, ct + 8 + 8 * c)
        sample_off = data + 8 + s32(w, ci + 4)
        if enc == 2:
            ad = ci + s32(w, ci + 0xC)
            coefs = (ctypes.c_int16 * 16)(*struct.unpack_from("<16h", w, ad))
            h1, h2 = struct.unpack_from("<hh", w, ad + 0x22)
            lib().dsp_decode(ctypes.byref(src, sample_off), samples, coefs, h1, h2, ctypes.byref(pcm, c * 2), n)
        elif enc == 1:
            s = struct.unpack_from("<%dh" % samples, w, sample_off)
            for i, v in enumerate(s):
                pcm[i * n + c] = v
        else:
            raise ValueError(f"encoding {enc}")
    return bytes(pcm), n, rate
