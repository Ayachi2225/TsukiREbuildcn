// dsp.c - Nintendo DSP-ADPCM to s16 PCM, one channel, written every `stride` samples of out.
#include <stdint.h>

void dsp_decode(const uint8_t *src, int samples, const int16_t *coef, int h1, int h2, int16_t *out, int stride) {
    int done = 0;
    while (done < samples) {
        int ps = *src++;
        int scale = 1 << (ps & 0xF);
        int ci = (ps >> 4) & 7;
        int c1 = coef[ci * 2], c2 = coef[ci * 2 + 1];
        for (int i = 0; i < 14 && done < samples; i++) {
            int nib = (i & 1) ? (*src++ & 0xF) : (*src >> 4);
            if (nib >= 8) nib -= 16;
            int s = ((scale * nib) << 11) + 1024 + c1 * h1 + c2 * h2;
            s >>= 11;
            if (s > 32767) s = 32767;
            if (s < -32768) s = -32768;
            *out = (int16_t)s;
            out += stride;
            h2 = h1;
            h1 = s;
            done++;
        }
    }
}
