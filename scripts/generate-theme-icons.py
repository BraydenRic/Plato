#!/usr/bin/env python3
"""
Regenerates the per-theme home screen icons in assets/icons/.

The source marks are two-tone: assets/images/icon.png is a white Plato bust on
the near-black app background, and android-icon-foreground.png is the same bust
in zinc-200 over transparency. Both recolour cleanly by treating the existing
pixel as a coverage mask and re-mixing it toward the theme's accentText — which
keeps the antialiased edges smooth instead of the jagged ones you get from a
flood fill or a colour-key swap.

Graphite has no entry here on purpose: its accent is #fafafa, which is the icon
that already ships in the bundle, so that theme just clears the alternate.

Usage:  python3 scripts/generate-theme-icons.py     (needs Pillow)
Keep TINTS in sync with THEMES in src/constants/theme.ts.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_IOS = ROOT / "assets/images/icon.png"
SRC_ANDROID = ROOT / "assets/images/android-icon-foreground.png"
OUT = ROOT / "assets/icons"

# theme id -> accentText, the lighter shade. The saturated `accent` is tuned for
# filled buttons and goes muddy at icon scale on a near-black field; the lighter
# one holds its colour when the glyph is only a few pixels thick.
TINTS = {
    "violet": "#c4b5fd",
    "cobalt": "#93c5fd",
    "cyan": "#67e8f9",
    "amber": "#fdba74",
    "magenta": "#f9a8d4",
}

BG = (9, 9, 11)  # Palette.bg — the iOS icon is opaque and must stay so.


def rgb(hex_string):
    h = hex_string.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def tint_opaque(src, colour):
    """iOS icon: glyph coverage comes from luminance over the flat background."""
    out = Image.new("RGB", src.size)
    src_px, out_px = src.load(), out.load()
    lo, hi = sum(BG) / 3, 255.0
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, _ = src_px[x, y]
            # How far this pixel is from background toward the glyph.
            t = (((r + g + b) / 3) - lo) / (hi - lo)
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            out_px[x, y] = tuple(round(BG[i] + (colour[i] - BG[i]) * t) for i in range(3))
    return out


def tint_alpha(src, colour):
    """Android foreground: alpha already is the mask, so only RGB changes."""
    out = Image.new("RGBA", src.size)
    src_px, out_px = src.load(), out.load()
    for y in range(src.height):
        for x in range(src.width):
            out_px[x, y] = (*colour, src_px[x, y][3])
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ios = Image.open(SRC_IOS).convert("RGBA")
    android = Image.open(SRC_ANDROID).convert("RGBA")

    for name, hex_colour in TINTS.items():
        colour = rgb(hex_colour)
        tint_opaque(ios, colour).save(OUT / f"icon-{name}.png")
        tint_alpha(android, colour).save(OUT / f"icon-{name}-foreground.png")
        print(f"  {name:9s} {hex_colour}  -> icon-{name}.png, icon-{name}-foreground.png")


if __name__ == "__main__":
    main()
