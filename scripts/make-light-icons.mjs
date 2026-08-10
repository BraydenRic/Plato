/**
 * Generates the light-mode app icons from the dark ones.
 *
 * Every existing icon is two flat colours: #09090b behind, the theme's dark
 * `accentText` in front, with antialiasing only along the glyph edge. So the
 * light variant is a recolour rather than a redraw — recover the glyph's
 * coverage from how far each pixel sits between the two, then lay that coverage
 * down in the light `accentText` over white.
 *
 * Coverage rather than a threshold matters: a threshold would leave the glyph's
 * curves visibly stepped at 1024px, and these get downscaled to every icon size
 * iOS asks for, which is exactly where aliasing shows.
 *
 * Run with: node scripts/make-light-icons.mjs
 * Requires python3 with Pillow; regenerate whenever a theme's colours change.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

// [source icon, light glyph, output]
//
// The source glyph colour is *not* listed: it is read out of the image. It was
// listed once, and Crimson's icon turned out to use red-500 rather than the
// red-300 its `accentText` would suggest — which silently produced a washed-out
// glyph at 2.8:1 instead of the intended 6:1. The file is the authority on what
// is in the file.
const ICONS = [
  ["assets/icons/icon-violet.png", "#6d28d9", "assets/icons/icon-violet-light.png"],
  ["assets/icons/icon-cobalt.png", "#1d4ed8", "assets/icons/icon-cobalt-light.png"],
  ["assets/icons/icon-cyan.png", "#155e75", "assets/icons/icon-cyan-light.png"],
  ["assets/icons/icon-amber.png", "#9a3412", "assets/icons/icon-amber-light.png"],
  ["assets/icons/icon-crimson.png", "#b91c1c", "assets/icons/icon-crimson-light.png"],
  ["assets/icons/icon-magenta.png", "#be185d", "assets/icons/icon-magenta-light.png"],
  // Graphite has no alternate of its own in dark — it owns the bundled icon —
  // so its light variant comes from that file instead.
  ["assets/images/icon.png", "#18181b", "assets/icons/icon-graphite-light.png"],
];

// The same recolour, applied to the Android adaptive foregrounds. Those are the
// glyph alone on transparency, so only the fill changes.
const FOREGROUNDS = [
  ["assets/icons/icon-violet-foreground.png", "#6d28d9", "assets/icons/icon-violet-light-foreground.png"],
  ["assets/icons/icon-cobalt-foreground.png", "#1d4ed8", "assets/icons/icon-cobalt-light-foreground.png"],
  ["assets/icons/icon-cyan-foreground.png", "#155e75", "assets/icons/icon-cyan-light-foreground.png"],
  ["assets/icons/icon-amber-foreground.png", "#9a3412", "assets/icons/icon-amber-light-foreground.png"],
  ["assets/icons/icon-crimson-foreground.png", "#b91c1c", "assets/icons/icon-crimson-light-foreground.png"],
  ["assets/icons/icon-magenta-foreground.png", "#be185d", "assets/icons/icon-magenta-light-foreground.png"],
  ["assets/icons/icon-violet-foreground.png", "#18181b", "assets/icons/icon-graphite-light-foreground.png"],
];

const PY = `
import sys
from collections import Counter
from PIL import Image

def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def recolour_icon(src, light, out):
    im = Image.open(src).convert("RGB")
    # The two flat colours are simply the two most common ones; the rest is the
    # antialiased rim of the glyph.
    common = Counter(im.get_flattened_data()).most_common(2)
    bg, fg = common[0][0], common[1][0]
    new = rgb(light)
    span = lum(fg) - lum(bg)
    if abs(span) < 1:
        raise SystemExit(f"{src}: background and glyph are the same tone; cannot recover coverage")
    px = im.load()
    w, h = im.size
    res = Image.new("RGB", (w, h))
    rp = res.load()
    for y in range(h):
        for x in range(w):
            # Coverage of the glyph in this pixel, 0 at pure background.
            t = (lum(px[x, y]) - lum(bg)) / span
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            rp[x, y] = tuple(round(255 * (1 - t) + new[i] * t) for i in range(3))
    res.save(out)
    return out

def recolour_foreground(src, light, out):
    im = Image.open(src).convert("RGBA")
    new = rgb(light)
    solid = Image.new("RGBA", im.size, new + (255,))
    solid.putalpha(im.getchannel("A"))
    solid.save(out)
    return out

mode = sys.argv[1]
if mode == "icon":
    recolour_icon(*sys.argv[2:])
else:
    recolour_foreground(*sys.argv[2:])
`;

const script = "/tmp/plato-light-icons.py";
writeFileSync(script, PY);
try {
  for (const [src, light, out] of ICONS) {
    execFileSync("python3", [script, "icon", src, light, out]);
    console.log(`${out}  <- ${src}  glyph -> ${light} on #ffffff`);
  }
  for (const [src, light, out] of FOREGROUNDS) {
    execFileSync("python3", [script, "fg", src, light, out]);
    console.log(`${out}  <- ${src}  glyph -> ${light}`);
  }
} finally {
  unlinkSync(script);
}
