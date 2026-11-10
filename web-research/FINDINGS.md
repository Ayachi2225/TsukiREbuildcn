# Tsukihime web rebuild: how the game is built and what it would take

Measured on the Japanese base game plus the translation patch (20.76 GiB of game files). Sizes are MiB unless noted. This folder holds research tools and local analysis output. `extracted/` and `analysis/` are derived from the game, so never upload them.

## Summary

- The full game could fit in about **1.3 GiB at 1080p** or **0.9 GiB at 720p**, down from 20.76 GiB.
- The scripts are plain text with 90 commands, so a native JavaScript and WebGL engine is realistic. This replaces the WebAssembly route considered earlier.
- The blur copies you spotted are the largest single saving: 8,670 MiB that can be generated while the game runs.

## What the game is made of

| Part | Files | Size | Format |
|---|---|---|---|
| Scene images and sprites (`allpac`) | 29,485 entries | 15,969 | BC7 textures in gzip, plus JPEG |
| Gallery (`allpaccg`) | 1,520 | 1,970 | BC7 and JPEG |
| Movies (`movie/`) | 46 (1,999 s) | 1,664 | H.264 1080p, up to 23 Mbps |
| Voices (`stream/`) | about 16,475 (about 24 h) | 870 | Nintendo Opus, mono, 83 kbps |
| Music (`stream/MOON*`) | 126 | 255 | Nintendo Opus, about 99 kbps |
| Sound effects (`knife1.bfsar`) | 1,300 sounds (2 h) | 386 | DSP-ADPCM |
| UI (`allui`, `parts`) | 32 | 70 | BC7 in gzip |
| Fonts | 4 | 22 | TTF, OTF |
| Scripts (`allscr`) | 549 | 19 raw, 2 gzipped | Plain text |
| Dialogue (`script_text`) | 43,959 lines | 5, 2 gzipped | UTF-8 |

### Inside `allpac` (15,969)

| Group | Size | Web plan |
|---|---|---|
| Blur variants `_XX_YY` | 8,670 | Generate while running |
| Scene base images (2,670) | 3,002 | Re-encode |
| Sprite full-size images, `A` (2,443) | 3,079 | One image per pose, plus face patches |
| Sprite smaller sizes, `L`/`M`/`S` | 840 | Keep only the 989 images (401) with no `A` version |
| Low-res copies at 1/6 scale | 340 | Drop |
| Other | 38 | Keep |

## Where the savings come from

1. **Blur variants (8,670).** Scripts only name the base image. `_SNX4(slot,x,y)` selects the blur, and 3,220 of the 3,224 image and blur combinations scripts use have a matching file. A box blur of radius `XX` by `YY` rebuilds them at a median of 52 dB. In a 97-image sample, 96% of bytes reached 38 dB or better. Keep the other 4% or so as files.
2. **Facial expressions (2,055 of the sprite data).** Different expressions of one pose usually change only a small rectangle: 1.9% of the area at the median. Store the pose once, plus small patches. About 1 in 10 differ across most of the image, so those stay whole.
3. **Resolution.** Scene images are stored around 1440p or larger. Scaling them to 1080p or 720p saves a lot before compression.
4. **Better codecs.** BC7 is built for fast GPU loading rather than small files. AVIF needs 3-8% of the stored size.
5. **Movies.** AV1 at CRF 38 and 1080p measured 2-11% of the source bitrate on three clips.

Byte-identical duplicates barely help: only 45 MiB across the whole game.

## Estimated web size

| Part | 1080p | 720p | Basis |
|---|---|---|---|
| Scene images | 211 | 112 | Measured, AVIF quality 70, 24 samples |
| Gallery | 87 | 48 | Measured, AVIF quality 70, 24 samples |
| Sprite poses | 85 | 53 | Measured, AVIF quality 70, 24 samples |
| Expression patches | 29 | 19 | Measured, AVIF quality 70, 24 samples |
| Sprites with no full-size version | 33 | 21 | Extrapolated from sprite poses |
| Blur fallbacks | 24 | 13 | Extrapolated from scene images |
| UI | 69 | 69 | Stored size, not re-encoded |
| Voices | 330 | 247 | Calculated at 32 and 24 kbps |
| Music | 255 | 165 | Current size, or calculated at 64 kbps |
| Sound effects | 56 | 56 | Calculated at 64 kbps |
| Movies | 150 | 90 | Extrapolated from 3 clips |
| Scripts, text, fonts | 26 | 26 | Measured, fonts not subset |
| **Total** | **about 1,355** | **about 920** | |

At AVIF quality 70, median PSNR was 38-47 dB depending on image type, and the worst sampled image was about 31 dB.

## How the engine works

- It's a custom engine: the executable's internal names use the prefix `nexl`.
- `allscr.mrg` is an `mrgd00` pack of MZX0-compressed scripts with every byte inverted. See `tools/mzx.py` and `tools/dump_scripts.py`.
- Scripts are sequences of commands such as `_STCH(layer,image,x,y,...)`.

Confirmed from script data: `_SNX4` selects blur, and the arguments of `_VPLY` and `_SEPL` name voice and sound clips.

Inferred from names and arguments, not yet confirmed:

| Area | Commands |
|---|---|
| Layers and images | `STCH`, `SCH2`, `STCC`, `STCP`, `STZ4`, `STRT`, `STMA`, `STBR`, `STEC` |
| Transitions, timing | `FADS`, `FANX`, `WTTM`, `WNTY`, `SHOK`, `SQK2` |
| Audio | `MPLY`, `MFAD`, `MVOL`, `SEFD`, `SEVL` |
| Text and choices | `MSAD`, `SELR`, `SELD`, `SELA`, `GOTS` |
| Flow, variables | `WKST`, `WKAD`, `IF__`, `JUMP`, `GOTO`, `PGST` |

The engine also has 57 shaders (blend modes, dissolve, wave, haze, Gaussian blur) and 49 transition masks.

The menus, save screen, gallery and flowchart are not in the scripts and appear to be hard-coded in the executable. They would be the largest manual part of a rewrite. The translated code is in `data/tsuki/gen`, but it has few useful function names.

## Two ways to deliver it

| | Converted pack | Bring your own dump |
|---|---|---|
| Hosted | About 1.3 GiB of re-encoded game files | Only the engine, with no game data |
| Works on | Anything with a browser | Probably desktop only, because it reads a 22 GB file |
| Sharing | Private use only | Fits the original project's rules |
| Needs | Converter, storage | Dump reader in the browser, BC7 support or a software decoder |

Shrinking the files doesn't change who owns them. The art, voices and music belong to TYPE-MOON and the other rights holders, and the translation belongs to its authors. A public site serving a converted pack would be distributing the game. Both routes share the same engine, so that can be built first.

## Limits of these numbers

- Image estimates come from 24 samples per class, weighted by size, and quality was scored by PSNR. Nobody has looked at the re-encoded images yet.
- Voice, music and sound effect sizes are calculated from bitrates. Nothing was transcoded, and Nintendo Opus files need rewrapping before standard tools can read them.
- The `L`/`M`/`S` sprites and low-res copies only match a downscale of the full image at 30-37 dB. They should look close, but this needs a visual check.
- Of 610 gallery images that looked like scene images, a sample of 50 had a median of only 25 dB, so many are different pictures. The estimate keeps all of them, and real duplicates would lower it.
- Scripts were analyzed from the base game. The patch's `allscr.mrg` is about twice the size and hasn't been inspected.
- The executable was not decompiled.

## Tools

Run these with `web-research/.venv/bin/python -I`.

| File | Purpose |
|---|---|
| `tools/romio.py` | Reads game files directly from the dump, with the patch on top |
| `tools/packs.py` | Reads `.hed`, `.nam` and `.mrg` archives and BNTX headers |
| `tools/tex.py` | Decodes BNTX textures to pixels |
| `tools/mzx.py`, `tools/dump_scripts.py` | Decompress scripts to text |
| `tools/catalog.py` | Builds `analysis/catalog.sqlite`, one row per archive entry |
| `tools/blurtest2.py` | Tests rebuilding blur variants |
| `tools/derive.py`, `tools/test3.py` | Test sprite sizes, expressions, and gallery matches |
| `tools/encode_test.py` | Measures re-encoded image sizes |
| `tools/sheet.py` | Makes local contact sheets for inspection |
