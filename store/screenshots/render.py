#!/usr/bin/env python3
"""
Builds the App Store screenshots from the raw ones, with the words in
captions.json:

- iPhone: each raw screenshot in raw-1.2.0/, framed under its caption, at
  1290 x 2796 into 1.2.0/ for App Store Connect's iPhone Large Display, and
  at 1179 x 2556 into 1.2.0-medium/ for iPhone Medium Display. Medium is the
  one Apple requires; it scales screenshots down for smaller iPhones but never
  across, and each slot takes only its own sizes. The two are the same shape,
  so the medium set is the large one resized, nothing cropped.
- Apple Watch: each screenshot in watch/originals-42mm/, drawn in a watch
  under its caption, at 416 x 496, into watch/. A 42 mm Series 10 or 11 takes
  374 x 446, which App Store Connect refuses; 416 x 496 is the same shape.
- The product page header and the search results image, shown on iOS 27
  and later, into header-and-search/. The header, 3840 x 1646, is just the
  words, filling the safe area of Apple's header template (a band through the
  middle, which is about what an iPhone shows) with gym gear round them. The
  search results image is 3840 x 2560, the search card's own 3:2 shape: the
  words between two phones, the watch in front of the right one, all well in
  from the edges. Not in use: 1.2.0's, at 5244 x 2950 (Apple's 16:9
  "universal" size), showed whole in App Store Connect's preview but zoomed
  in on the live store, and was removed. This 3:2 one is the card's shape
  but hasn't been seen live; see "Search results image" in
  docs/plans-for-later.md before uploading it.)

    python3 store/screenshots/render.py           # everything
    python3 store/screenshots/render.py 01 07     # just these iPhone ones
    python3 store/screenshots/render.py watch     # just the watch set
    python3 store/screenshots/render.py header    # just the header and search images
    python3 store/screenshots/render.py --plain   # the first 1.2.0 look

Each screenshot sits on one of the app's accents (the "accent" in
captions.json), with the words named by "highlight" in amber, the colour the
app marks a personal best with. Gym gear straddles the join between each
screenshot and the next, half in each, so the set reads as one piece as you
swipe it in the App Store. The cardio screenshot also shows the run on the
watch beside the phone. --plain renders the earlier look instead: a black page,
white caption, the bare watch screens.

Each screenshot's own status bar (the time it was taken, the carrier, the
battery left) is painted out and a clean one drawn in its place: 9:41, full
signal, Wi-Fi and battery, as Apple shows its own. On the lock screen, where
the bar sits on a photo, the old one is blended into the sky around it and
the time left off, as a lock screen's status bar has none. The watch's clock
is set to 9:41 the same way.

A "\n" in a headline breaks the line there, for a phrase that mustn't split.
Needs Pillow and a headless Chrome: CHROME=/path/to/chrome, or Playwright's
chrome-headless-shell, which is looked for in ~/.cache/ms-playwright. Pillow
takes the alpha channel out afterwards, since Apple refuses screenshots that
have one.
"""

import glob
import html
import itertools
import json
import math
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw-1.2.0")
OUT = os.path.join(HERE, "1.2.0")
MEDIUM_OUT = os.path.join(HERE, "1.2.0-medium")
WATCH_RAW = os.path.join(HERE, "watch", "originals-42mm")
WATCH_OUT = os.path.join(HERE, "watch")
CREATIVE_OUT = os.path.join(HERE, "header-and-search")
# The site's copy of Inter: the closest match to the app's San Francisco
# that can be served to Chrome here, set heavy and tight as the app's titles.
FONT = os.path.join(HERE, "..", "..", "site", "fonts", "inter.woff2")
WIDTH, HEIGHT = 1290, 2796
MEDIUM_SIZE = (1179, 2556)
WATCH_SIZE = (416, 496)
# Each image's "Art Safe Area", the part every crop keeps, from the layer of
# that name in Apple's templates: creative_assets-product_page_header_template-
# static.psd and creative_assets-universal_asset_template-static.psd.
HEADER_SIZE = (3840, 1646)
HEADER_SAFE = (1097, 493, 2743, 1154)
# The search card is 3:2, and Apple takes 1920 x 1280 to 3840 x 2560 for it.
# An iPhone's card is about 365 pt wide, so the image shows at about a tenth.
SEARCH_SIZE = (3840, 2560)

# Tailwind's 800 of each of the app's accents (theme.ts uses the 500s): deep
# enough that white text clears 7:1 on every one. Graphite is zinc.
ACCENT = {
    "violet": "#5b21b6", "cobalt": "#1e40af", "cyan": "#155e75", "amber": "#9a3412",
    "crimson": "#991b1b", "magenta": "#9d174d", "graphite": "#27272a",
}
# theme.ts's personal-best amber, for the highlighted words.
HIGHLIGHT = "#fbbf24"
# The gear's see-through whites: the shapes, their raised parts, a plate's weight.
GEAR = "rgba(255,255,255,.15)"
GEAR_LIFT = "rgba(255,255,255,.07)"
GEAR_TEXT = "rgba(255,255,255,.12)"

# Where an iPhone with a Dynamic Island draws its status bar, in a 1179 x 2556
# screenshot: the band it sits in, and on the lock screen the patches to blend
# away: the carrier, then the icons, leaving the swipe-down line under them.
RAW_SIZE = (1179, 2556)
STATUS_BAND = (0, 40, 1179, 150)
LOCK_PATCHES = [(90, 50, 340, 130), (830, 50, 1095, 120)]

# The watch's clock in a 374 x 446 original: right edge at x 347, its digits
# between y 31 and 58. The band is painted out row by row in the colour just
# left of it, since the Start list's background isn't black.
WATCH_RAW_SIZE = (374, 446)
WATCH_CLOCK = (262, 18, 374, 67)

# The clean status bar, in the screenshot's own pixels: an SVG with the same
# viewBox laid over the image scales with it.
STATUS_BAR = """<svg class="status" viewBox="0 0 1179 2556" aria-hidden="true">
{time}
<g fill="#fff">
  <rect x="845" y="93" width="11" height="14" rx="3"/>
  <rect x="861" y="85" width="11" height="22" rx="3"/>
  <rect x="877" y="77" width="11" height="30" rx="3"/>
  <rect x="893" y="69" width="11" height="38" rx="3"/>
  <path d="M948 107 L936 93 A17 17 0 0 1 960 93 Z"/>
  <path d="M928 84 A28 28 0 0 1 968 84 L963 89 A21 21 0 0 0 933 89 Z"/>
  <path d="M920 75 A40 40 0 0 1 976 75 L971 80 A33 33 0 0 0 925 80 Z"/>
  <rect x="1003" y="74" width="60" height="26" rx="6"/>
  <rect x="1073" y="81" width="5" height="12" rx="2.5" opacity="0.4"/>
</g>
<rect x="998" y="69" width="70" height="36" rx="11" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="3"/>
</svg>"""
STATUS_TIME = '<text x="214" y="107" text-anchor="middle" font-family="Inter" font-weight="600" font-size="56" fill="#fff">9:41</text>'

# --- Gym gear ----------------------------------------------------------------
#
# Flat shapes in see-through white, each drawn about (0, 0) and centred on a
# join between two screenshots, so half lands in each. The phone covers the
# middle of every screenshot, which leaves 176 px either side of a join to
# show them in. Each shape is one masked fill, so holes are real holes and
# nothing turns brighter where its parts overlap; raised parts (a rim, a hub,
# a plate's lip) are a second, fainter layer on top.

_mask_ids = itertools.count()


def masked(box: tuple, show: str, cut: str = "", fill: str = "") -> str:
    """A fill over box, seen where `show` paints and `cut` doesn't."""
    x, y, w, h = box
    mask_id = f"gear{next(_mask_ids)}"
    return (f'<defs><mask id="{mask_id}" maskUnits="userSpaceOnUse" x="{x}" y="{y}" width="{w}" height="{h}">'
            f'<g fill="#fff">{show}</g><g fill="#000">{cut}</g></mask></defs>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill or GEAR}" mask="url(#{mask_id})"/>')


def plate(pounds: str, r: float = 170) -> str:
    """An iron Olympic plate face on: three grip slots, a raised rim and hub."""
    slots = "".join(
        f'<rect x="{-r * 0.23:.1f}" y="{-r * 0.1:.1f}" width="{r * 0.46:.1f}" height="{r * 0.2:.1f}" rx="{r * 0.1:.1f}" '
        f'transform="translate({math.cos(math.radians(a)) * r * 0.6:.1f} {math.sin(math.radians(a)) * r * 0.6:.1f}) rotate({a + 90})"/>'
        for a in (-90, 30, 150))
    hole = f'<circle r="{r * 0.17:.1f}"/>'
    box = (-r, -r, 2 * r, 2 * r)
    return (masked(box, f'<circle r="{r}"/>', slots + hole)
            + masked(box, f'<circle r="{r}"/>', f'<circle r="{r * 0.86:.1f}"/>', GEAR_LIFT)
            + masked(box, f'<circle r="{r * 0.33:.1f}"/>', hole, GEAR_LIFT)
            + f'<text y="{r * 0.6:.1f}" text-anchor="middle" dominant-baseline="middle" font-family="Inter" '
              f'font-weight="800" font-size="{r * 0.2:.1f}" letter-spacing="{r * 0.01:.1f}" fill="{GEAR_TEXT}">{pounds} LB</text>')


def dumbbell() -> str:
    """A hex dumbbell side on: faceted heads, collars, a knurled handle. 340
    wide, a head in each margin."""
    heads = '<rect x="-170" y="-105" width="92" height="210" rx="18"/><rect x="78" y="-105" width="92" height="210" rx="18"/>'
    collars = '<rect x="-80" y="-58" width="20" height="116" rx="5"/><rect x="60" y="-58" width="20" height="116" rx="5"/>'
    handle = '<rect x="-62" y="-19" width="124" height="38" rx="8"/>'
    facets = "".join(f'<rect x="{x}" y="{y}" width="92" height="8"/>' for x in (-170, 78) for y in (-56, 48))
    knurl = "".join(f'<rect x="{x}" y="-15" width="5" height="30" transform="skewX(-25)"/>' for x in range(-46, 54, 13))
    box = (-180, -115, 360, 230)
    return masked(box, heads + collars + handle, facets + knurl) + masked(box, collars, "", GEAR_LIFT)


def kettlebell() -> str:
    """Front on: a thick handle whose horns run into the bell, a window
    through it, and a flat base."""
    handle = '<path d="M-104 10 C -120 -96, -112 -214, 0 -214 C 112 -214, 120 -96, 104 10 Z"/>'
    window = '<path d="M-56 -40 C -66 -110, -58 -166, 0 -166 C 58 -166, 66 -110, 56 -40 Z"/>'
    bell = '<path d="M-68 150 A 130 130 0 1 1 68 150 Z"/>'
    # The window is cut through the handle, then the bell painted back over its foot.
    mask_id = f"gear{next(_mask_ids)}"
    return (f'<defs><mask id="{mask_id}" maskUnits="userSpaceOnUse" x="-140" y="-224" width="280" height="384">'
            f'<g fill="#fff">{handle}</g><g fill="#000">{window}</g><g fill="#fff">{bell}</g></mask></defs>'
            f'<rect x="-140" y="-224" width="280" height="384" fill="{GEAR}" mask="url(#{mask_id})"/>')


def barbell_end() -> str:
    """Side on: the bar comes in from the left, behind the phone; two 45s, a
    25 and a 10 with lipped edges sit just left of the join, and the collar
    and the grooved bare sleeve cross it."""
    plates, lips = [], []
    x = -150
    for w, h in [(46, 460), (46, 460), (38, 340), (30, 240)]:
        lip = round(h * 0.09)
        plates.append(f'<rect x="{x}" y="{-h / 2}" width="{w}" height="{h}" rx="10"/>')
        lips.append(f'<rect x="{x}" y="{-h / 2}" width="{w}" height="{lip}" rx="10"/>'
                    f'<rect x="{x}" y="{h / 2 - lip}" width="{w}" height="{lip}" rx="10"/>')
        x += w + 6
    collar = f'<rect x="{x}" y="-44" width="34" height="88" rx="8"/><rect x="{x + 8}" y="-74" width="14" height="34" rx="6"/>'
    sleeve = f'<rect x="{x + 34}" y="-24" width="190" height="48" rx="10"/>'
    grooves = "".join(f'<rect x="{x + 70 + i * 34}" y="-24" width="5" height="48"/>' for i in range(4))
    bar = '<rect x="-1500" y="-14" width="1400" height="28" rx="6"/>'
    box = (-1510, -240, 1510 + x + 240, 480)
    return masked(box, bar + "".join(plates) + collar + sleeve, grooves) + masked(box, "".join(lips), "", GEAR_LIFT)


def track_lanes() -> str:
    return "".join(
        f'<path d="M-420 {160 + i * 64} C -120 {160 + i * 64}, 120 {-60 + i * 64}, 420 {-260 + i * 64}" '
        f'fill="none" stroke="{GEAR}" stroke-width="10" stroke-linecap="round"/>' for i in range(5))


# (join, y, drawing): join n is the edge between screenshot n and n + 1; 0 and
# 10 are the outer edges. High and low by turns, with the track lanes leading
# into the cardio screenshot.
PHONE_GEAR = [
    (0, 2380, lambda: plate("45")), (1, 1300, dumbbell), (2, 2250, track_lanes),
    (3, 1450, lambda: plate("45")), (4, 2250, barbell_end), (5, 1350, kettlebell),
    (6, 2320, dumbbell), (7, 1350, lambda: plate("25")), (8, 2280, kettlebell),
    (9, 1450, barbell_end), (10, 2300, lambda: plate("45")),
]
WATCH_GEAR = [(0, 430, lambda: plate("45")), (1, 250, dumbbell), (2, 420, lambda: plate("45")), (3, 250, kettlebell)]


def gear_svg(index: int, size: tuple, gear: list, scale: float = 1.0) -> str:
    """This screenshot's slice of the gear: what sits on its two edges."""
    width, height = size
    groups = "".join(
        f'<g transform="translate({join * width} {y}) scale({scale})" fill="{GEAR}">{draw()}</g>'
        for join, y, draw in gear if join in (index, index + 1))
    return (f'<svg class="gear" viewBox="{index * width} 0 {width} {height}" aria-hidden="true">{groups}</svg>')


# --- Pages -------------------------------------------------------------------

PLAIN_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Inter"; src: url("{font}") format("woff2"); font-weight: 400 800; }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; background: #0b0b0d; }}
body {{ position: relative; font-family: "Inter", sans-serif; color: #fafafa; -webkit-font-smoothing: antialiased; }}
/* The caption fills the space above the phone, centred in it, so the phone
   sits in the same place on every screenshot however long the words are. */
.caption {{
  position: absolute; top: 0; left: 0; right: 0; height: 680px; box-sizing: border-box;
  padding: 110px 100px 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center;
}}
h1 {{ margin: 0; font-size: 118px; font-weight: 800; line-height: 1.02; letter-spacing: -0.04em; text-wrap: balance; }}
p {{ margin: 34px 0 0; max-width: 980px; font-size: 46px; font-weight: 500; line-height: 1.35; color: #a1a1aa; text-wrap: balance; }}
/* A slim frame rather than a drawing of an iPhone: the app's own black needs
   an edge against the page, and the screenshot is the subject. */
.phone {{
  position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%);
  padding: 16px; background: #1c1c21; border-radius: 150px;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.09);
}}
.phone img {{ display: block; height: 1964px; width: auto; border-radius: 134px; }}
.status {{ position: absolute; top: 16px; left: 16px; width: calc(100% - 32px); height: calc(100% - 32px); }}
</style></head><body>
<div class="caption"><h1>{headline}</h1><p>{subline}</p></div>
<div class="phone"><img src="{raw}" alt="">{status}</div>
</body></html>
"""

# The watch, drawn around a screenshot, in units of the original's pixels.
WATCH_CSS = """
.watch {{ position: absolute; padding: {pad}px; border-radius: {case_r}px; background: #1c1c21;
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.10), 0 {shadow}px {shadow2}px -{shadow3}px rgba(0,0,0,.6); }}
.watch .crown {{ position: absolute; right: -{crown_out}px; top: {crown_top}px; width: {crown_w}px; height: {crown_h}px;
                 border-radius: 4px; background: #2a2a30; }}
.watch .button {{ position: absolute; right: -{button_out}px; top: {button_top}px; width: {button_w}px; height: {button_h}px;
                  border-radius: 3px; background: #232328; }}
.watch .screen {{ position: relative; width: {sw}px; height: {sh}px; border-radius: {screen_r}px; overflow: hidden; background: #000; }}
.watch .screen img {{ display: block; width: 100%; height: 100%; }}
.watch .time {{ position: absolute; right: {time_r}px; top: {time_t}px; font-size: {time_s}px; font-weight: 600;
                letter-spacing: -0.01em; color: #fff; }}
"""


def watch_css(scale: float) -> str:
    w, h = WATCH_RAW_SIZE
    return WATCH_CSS.format(**{k: f"{v * scale:.1f}" for k, v in dict(
        pad=11, case_r=100, shadow=29, shadow2=58, shadow3=20, crown_out=10, crown_top=112, crown_w=12, crown_h=56,
        button_out=6, button_top=210, button_w=7, button_h=85, sw=w, sh=h, screen_r=89,
        time_r=w - 347, time_t=22, time_s=37).items()})


def watch_html(raw: str, style: str) -> str:
    return (f'<div class="watch" style="{style}"><div class="crown"></div><div class="button"></div>'
            f'<div class="screen"><img src="{raw}" alt=""><div class="time">9:41</div></div></div>')


GEAR_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Inter"; src: url("{font}") format("woff2"); font-weight: 400 800; }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; background: {bg}; }}
body {{ position: relative; font-family: "Inter", sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }}
.gear {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.caption {{
  position: absolute; top: 0; left: 0; right: 0; height: 680px; box-sizing: border-box;
  padding: 104px 90px 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center;
}}
h1 {{ margin: 0; font-size: 124px; font-weight: 800; line-height: 1.04; letter-spacing: -0.04em; text-wrap: balance; }}
.highlight {{ color: {highlight}; white-space: nowrap; }}
p {{ margin: 36px 0 0; max-width: 1040px; font-size: 48px; font-weight: 500; line-height: 1.32; color: rgba(255,255,255,.9); text-wrap: balance; }}
.phone {{
  position: absolute; left: {phone_x}px; bottom: 120px; transform: translateX(-50%);
  padding: 16px; background: #1c1c21; border-radius: 150px;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.08), 0 50px 100px -30px rgba(0,0,0,.6);
}}
.phone img {{ display: block; height: 1964px; width: auto; border-radius: 134px; }}
.status {{ position: absolute; top: 16px; left: 16px; width: calc(100% - 32px); height: calc(100% - 32px); }}
{watch_css}
</style></head><body>
{gear}
<div class="caption"><h1>{headline}</h1><p>{subline}</p></div>
<div class="phone"><img src="{raw}" alt="">{status}</div>
{watch}
</body></html>
"""

WATCH_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Inter"; src: url("{font}") format("woff2"); font-weight: 400 800; }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; background: {bg}; }}
body {{ position: relative; font-family: "Inter", sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }}
.gear {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
h1 {{ position: absolute; top: 0; left: 0; right: 0; height: 92px; margin: 0; line-height: 96px; text-align: center;
      font-size: 31px; font-weight: 800; letter-spacing: -0.035em; }}
.highlight {{ color: {highlight}; white-space: nowrap; }}
{watch_css}
</style></head><body>
{gear}
<h1>{headline}</h1>
{watch}
</body></html>
"""

HEADER_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Inter"; src: url("{font}") format("woff2"); font-weight: 400 800; }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; background: {bg}; }}
body {{ position: relative; font-family: "Inter", sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }}
.gear {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.words {{ position: absolute; left: {safe_x}px; top: {safe_y}px; width: {safe_w}px; height: {safe_h}px;
          display: flex; align-items: center; justify-content: center; text-align: center; }}
h1 {{ margin: 0; font-size: 232px; font-weight: 800; line-height: 0.95; letter-spacing: -0.045em; }}
.highlight {{ color: {highlight}; }}
</style></head><body>
{gear}
<div class="words"><h1>{headline}</h1></div>
</body></html>
"""

# Round the words, never under them: the header is the words, at 92% of the
# safe band's height, as big as they go and still show whole everywhere.
HEADER_GEAR = [
    (560, 1220, 1.5, 0, lambda: plate("45")), (720, 380, 1.25, -18, dumbbell), (170, 640, 1.0, 0, kettlebell),
    (3300, 400, 1.35, 0, lambda: plate("25")), (3330, 1260, 1.25, 0, kettlebell), (3720, 760, 1.0, 14, dumbbell),
    (1920, 1840, 2.2, 0, track_lanes),
]


SEARCH_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Inter"; src: url("{font}") format("woff2"); font-weight: 400 800; }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; background: {bg}; }}
body {{ position: relative; font-family: "Inter", sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }}
.gear {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.words {{ position: absolute; left: {words_x}px; top: {words_y}px; width: {words_w}px; height: {words_h}px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }}
h1 {{ margin: 0; font-size: {headline_px}px; font-weight: 800; line-height: 1.0; letter-spacing: -0.045em; }}
.highlight {{ color: {highlight}; }}
p {{ margin: 48px 0 0; font-size: {subline_px}px; font-weight: 500; line-height: 1.3; color: rgba(255,255,255,.9); text-wrap: balance; }}
.phone {{ position: absolute; padding: 20px; background: #1c1c21; border-radius: 150px;
          box-shadow: inset 0 0 0 4px rgba(255,255,255,.08), 0 120px 220px -60px rgba(0,0,0,.6); }}
.phone img {{ display: block; height: {phone_h}px; width: auto; border-radius: 130px; }}
.phone .status {{ position: absolute; top: 20px; left: 20px; width: calc(100% - 40px); height: calc(100% - 40px); }}
{watch_css}
</style></head><body>
{gear}
{phones}
{watch}
<div class="words"><h1>{headline}</h1><p>{subline}</p></div>
</body></html>
"""

# (x, y, scale, rotation, drawing), scattered round the edges. Two thirds as
# strong as on the screenshots, here and in the header: the gear fills a far
# bigger canvas.
SEARCH_GEAR = [
    (240, 2250, 1.7, 0, lambda: plate("45")), (650, 250, 1.3, -18, dumbbell),
    (3580, 430, 1.45, 0, lambda: plate("25")), (3630, 2180, 1.4, 0, kettlebell),
    (1920, 2330, 2.0, 0, track_lanes), (1720, 230, 0.95, 0, kettlebell),
    (2300, 2150, 1.15, 0, lambda: plate("45")),
]
CREATIVE_GEAR_OPACITY = 0.67
# Two whole phones, 300 px in from the sides (8%, room for the card's
# rounded corners or a slight trim), the words between them, the watch in
# front of the right phone. At an iPhone card's width the 200 px headline
# shows at about 19 pt.
SEARCH_EDGE = 300
SEARCH_PHONE_H = 1800
SEARCH_PHONE_GAP = 100
SEARCH_HEADLINE_PX = 200
SEARCH_SUBLINE_PX = 66
SEARCH_WATCH_SCALE = 1.25


# On the cardio screenshot, the phone moves left to make room for the watch.
CARDIO_WATCH = "02-run.png"
CARDIO_PHONE_SHIFT = 110
CARDIO_WATCH_SCALE = 1.2
CARDIO_WATCH_AT = (744, 1880)
WATCH_SCALE = 0.82


def chrome() -> str:
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    found = sorted(glob.glob(os.path.expanduser(
        "~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell")))
    if not found:
        sys.exit("No headless Chrome: set CHROME, or run `npx playwright install chromium-headless-shell`.")
    return found[-1]


def clean_status_bar(shot: dict, work: str) -> str:
    """A copy of the raw screenshot with its status bar painted out."""
    image = Image.open(os.path.join(RAW, shot["raw"])).convert("RGB")
    if image.size != RAW_SIZE:
        sys.exit(f"{shot['raw']} is {image.size}; the status bar is placed for {RAW_SIZE}")
    if shot.get("statusBar") == "lock":
        # Each patch becomes a blur of the photo around it, feathered in.
        for left, top, right, bottom in LOCK_PATCHES:
            pad = 60
            box = (max(0, left - pad), max(0, top - pad), min(RAW_SIZE[0], right + pad), bottom + pad)
            blurred = image.crop(box).filter(ImageFilter.GaussianBlur(30))
            mask = Image.new("L", blurred.size, 0)
            ImageDraw.Draw(mask).rectangle((left - box[0], top - box[1], right - box[0], bottom - box[1]), fill=255)
            image.paste(blurred, box, mask.filter(ImageFilter.GaussianBlur(10)))
    else:
        # The app's own background, plain behind the status bar.
        ImageDraw.Draw(image).rectangle(STATUS_BAND, fill=image.getpixel((600, 20)))
    path = os.path.join(work, shot["raw"])
    image.save(path)
    return path


def clean_watch_clock(name: str, work: str) -> str:
    """A copy of a watch original with its clock painted out, to draw 9:41 over."""
    image = Image.open(os.path.join(WATCH_RAW, name)).convert("RGB")
    if image.size != WATCH_RAW_SIZE:
        sys.exit(f"{name} is {image.size}; the clock is placed for {WATCH_RAW_SIZE}")
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = WATCH_CLOCK
    for y in range(top, bottom):
        draw.line((left, y, right - 1, y), fill=image.getpixel((left - 7, y)))
    path = os.path.join(work, "watch-" + name)
    image.save(path)
    return path


def headline_html(shot: dict, highlight: bool) -> str:
    text = html.escape(shot["headline"])
    if highlight:
        phrase = html.escape(shot["highlight"])
        if phrase not in text:
            sys.exit(f"{shot['out']}: \"{shot['highlight']}\" isn't in its headline")
        text = text.replace(phrase, f'<span class="highlight">{phrase}</span>', 1)
    return text.replace("\n", "<br>")


def screenshot(page: str, out: str, size: tuple, browser: str, scale: int = 1) -> str:
    """Renders the page to out at exactly size, with no alpha channel."""
    width, height = size
    flags = [] if "headless-shell" in browser else ["--headless=new"]
    subprocess.run(
        [browser, *flags, "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files",
         f"--force-device-scale-factor={scale}", f"--window-size={width},{height}",
         "--virtual-time-budget=4000", f"--screenshot={out}", "file://" + page],
        check=True, capture_output=True,
    )
    image = Image.open(out).convert("RGB")
    # Small pages are drawn at twice the size and brought down, for crisper text.
    if scale != 1:
        image = image.resize((width, height), Image.LANCZOS)
    if image.size != size:
        sys.exit(f"{os.path.basename(out)} came out {image.size}, not {size}")
    image.save(out, optimize=True)
    return out


def render(shot: dict, index: int, plain: bool, browser: str, work: str) -> str:
    raw = "file://" + clean_status_bar(shot, work)
    lock = shot.get("statusBar") == "lock"
    fields = dict(
        font="file://" + os.path.abspath(FONT), width=WIDTH, height=HEIGHT, raw=raw,
        status=STATUS_BAR.format(time="" if lock else STATUS_TIME),
        headline=headline_html(shot, not plain), subline=html.escape(shot["subline"]),
    )
    if plain:
        page_html = PLAIN_PAGE.format(**fields)
    else:
        watch, phone_x = "", WIDTH / 2
        if shot.get("watch"):
            phone_x -= CARDIO_PHONE_SHIFT
            left, top = CARDIO_WATCH_AT
            watch = watch_html("file://" + clean_watch_clock(CARDIO_WATCH, work), f"left:{left}px;top:{top}px")
        page_html = GEAR_PAGE.format(
            **fields, bg=ACCENT[shot["accent"]], highlight=HIGHLIGHT, phone_x=f"{phone_x:.0f}",
            gear=gear_svg(index, (WIDTH, HEIGHT), PHONE_GEAR), watch=watch,
            watch_css=watch_css(CARDIO_WATCH_SCALE) if watch else "")
    page = os.path.join(work, shot["out"] + ".html")
    with open(page, "w") as f:
        f.write(page_html)
    out = screenshot(page, os.path.join(OUT, shot["out"]), (WIDTH, HEIGHT), browser)
    os.makedirs(MEDIUM_OUT, exist_ok=True)
    Image.open(out).resize(MEDIUM_SIZE, Image.LANCZOS).save(os.path.join(MEDIUM_OUT, shot["out"]), optimize=True)
    return out


def render_watch(shot: dict, index: int, plain: bool, browser: str, work: str) -> str:
    out = os.path.join(WATCH_OUT, shot["out"])
    if plain:
        # The bare screen, scaled up to the size Apple takes.
        Image.open(os.path.join(WATCH_RAW, shot["raw"])).convert("RGB").resize(WATCH_SIZE, Image.LANCZOS).save(out, optimize=True)
        return out
    width, height = WATCH_SIZE
    case_width = (WATCH_RAW_SIZE[0] + 22) * WATCH_SCALE
    page_html = WATCH_PAGE.format(
        font="file://" + os.path.abspath(FONT), width=width, height=height, bg=ACCENT[shot["accent"]],
        highlight=HIGHLIGHT, headline=headline_html(shot, True), watch_css=watch_css(WATCH_SCALE),
        gear=gear_svg(index, WATCH_SIZE, WATCH_GEAR, scale=0.27),
        watch=watch_html("file://" + clean_watch_clock(shot["raw"], work), f"left:{(width - case_width) / 2:.1f}px;top:96px"),
    )
    page = os.path.join(work, "watch-" + shot["out"] + ".html")
    with open(page, "w") as f:
        f.write(page_html)
    return screenshot(page, out, WATCH_SIZE, browser, scale=2)


def render_search(search: dict, phones: dict, browser: str, work: str) -> str:
    """A phone at each side, centred top to bottom, the words between them,
    the watch in front of the right phone."""
    width, height = SEARCH_SIZE
    frame_w = SEARCH_PHONE_H * RAW_SIZE[0] / RAW_SIZE[1] + 40
    frame_h = SEARCH_PHONE_H + 40
    top = (height - frame_h) / 2
    left_x, right_x = SEARCH_EDGE, width - SEARCH_EDGE - frame_w
    words_x = left_x + frame_w + SEARCH_PHONE_GAP
    words_w = right_x - SEARCH_PHONE_GAP - words_x

    def phone(out: str, left: float) -> str:
        shot = phones[out]
        raw = "file://" + clean_status_bar(shot, work)
        lock = shot.get("statusBar") == "lock"
        return (f'<div class="phone" style="left:{left:.0f}px;top:{top:.0f}px"><img src="{raw}" alt="">'
                f'{STATUS_BAR.format(time="" if lock else STATUS_TIME)}</div>')

    left_phone, right_phone = search["phones"]
    page_html = SEARCH_PAGE.format(
        font="file://" + os.path.abspath(FONT), width=width, height=height, bg=ACCENT[search["accent"]],
        highlight=HIGHLIGHT, words_x=f"{words_x:.0f}", words_y=f"{top:.0f}", words_w=f"{words_w:.0f}",
        words_h=f"{frame_h:.0f}", headline_px=SEARCH_HEADLINE_PX, subline_px=SEARCH_SUBLINE_PX,
        phone_h=SEARCH_PHONE_H, watch_css=watch_css(SEARCH_WATCH_SCALE),
        gear=creative_gear(SEARCH_GEAR, SEARCH_SIZE),
        phones=phone(left_phone, left_x) + phone(right_phone, right_x),
        watch=watch_html("file://" + clean_watch_clock(search["watch"], work),
                         f"left:{right_x - 190:.0f}px;top:{top + frame_h - 660:.0f}px"),
        headline=headline_html(search, True), subline=html.escape(search["subline"]),
    )
    page = os.path.join(work, "search.html")
    with open(page, "w") as f:
        f.write(page_html)
    os.makedirs(CREATIVE_OUT, exist_ok=True)
    return screenshot(page, os.path.join(CREATIVE_OUT, search["out"]), SEARCH_SIZE, browser)


def creative_gear(gear: list, size: tuple) -> str:
    width, height = size
    return (f'<svg class="gear" viewBox="0 0 {width} {height}" aria-hidden="true">' + "".join(
        f'<g transform="translate({x} {y}) rotate({rotation}) scale({scale})" fill="{GEAR}" opacity="{CREATIVE_GEAR_OPACITY}">{draw()}</g>'
        for x, y, scale, rotation, draw in gear) + "</svg>")


def render_header(header: dict, browser: str, work: str) -> str:
    """The words in the header template's safe band, gear round them."""
    width, height = HEADER_SIZE
    safe_x, safe_y, safe_x2, safe_y2 = HEADER_SAFE
    page_html = HEADER_PAGE.format(
        font="file://" + os.path.abspath(FONT), width=width, height=height, bg=ACCENT[header["accent"]],
        highlight=HIGHLIGHT, safe_x=safe_x, safe_y=safe_y, safe_w=safe_x2 - safe_x, safe_h=safe_y2 - safe_y,
        gear=creative_gear(HEADER_GEAR, HEADER_SIZE), headline=headline_html(header, True),
    )
    page = os.path.join(work, "header.html")
    with open(page, "w") as f:
        f.write(page_html)
    os.makedirs(CREATIVE_OUT, exist_ok=True)
    return screenshot(page, os.path.join(CREATIVE_OUT, header["out"]), HEADER_SIZE, browser)


def main() -> None:
    args = sys.argv[1:]
    plain = "--plain" in args
    wanted = [a for a in args if a != "--plain"]
    with open(os.path.join(HERE, "captions.json")) as f:
        captions = json.load(f)
    # Each keeps its place in the full set, which says which gear is on its edges.
    phones = [(i, s) for i, s in enumerate(captions["iphone"])
              if not wanted or any(s["out"].startswith(w) for w in wanted)]
    watches = list(enumerate(captions["watch"])) if not wanted or "watch" in wanted else []
    # The header and search images are new with this style; --plain leaves them be.
    creative = not plain and (not wanted or "header" in wanted)
    os.makedirs(OUT, exist_ok=True)
    browser = chrome()
    with tempfile.TemporaryDirectory() as work:
        for index, shot in phones:
            print(render(shot, index, plain, browser, work))
        for index, shot in watches:
            print(render_watch(shot, index, plain, browser, work))
        if creative:
            by_out = {shot["out"]: shot for shot in captions["iphone"]}
            print(render_header(captions["header"], browser, work))
            print(render_search(captions["search"], by_out, browser, work))


if __name__ == "__main__":
    main()
