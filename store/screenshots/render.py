#!/usr/bin/env python3
"""
Builds the App Store screenshots from the raw ones, with the words in
captions.json:

- iPhone: each raw screenshot in raw-1.2.0/, framed under its caption, at
  1290 x 2796, into 1.2.0/. That is a size Apple takes for the 6.9-inch
  display, which it scales down for every smaller iPhone, so it's the only set
  to upload, whatever phone took the raws.
- Apple Watch: each screenshot in watch/originals-42mm/, drawn in a watch
  under its caption, at 416 x 496, into watch/. A 42 mm Series 10 or 11 takes
  374 x 446, which App Store Connect refuses; 416 x 496 is the same shape.

    python3 store/screenshots/render.py           # everything
    python3 store/screenshots/render.py 01 07     # just these iPhone ones
    python3 store/screenshots/render.py watch     # just the watch set
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
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw-1.2.0")
OUT = os.path.join(HERE, "1.2.0")
WATCH_RAW = os.path.join(HERE, "watch", "originals-42mm")
WATCH_OUT = os.path.join(HERE, "watch")
# The site's copy of Inter: the closest match to the app's San Francisco
# that can be served to Chrome here, set heavy and tight as the app's titles.
FONT = os.path.join(HERE, "..", "..", "site", "fonts", "inter.woff2")
WIDTH, HEIGHT = 1290, 2796
WATCH_SIZE = (416, 496)

# Tailwind's 800 of each of the app's accents (theme.ts uses the 500s): deep
# enough that white text clears 7:1 on every one. Graphite is zinc.
ACCENT = {
    "violet": "#5b21b6", "cobalt": "#1e40af", "cyan": "#155e75", "amber": "#9a3412",
    "crimson": "#991b1b", "magenta": "#9d174d", "graphite": "#27272a",
}
# theme.ts's personal-best amber, for the highlighted words.
HIGHLIGHT = "#fbbf24"
GEAR = "rgba(255,255,255,.15)"
GEAR_TEXT = "rgba(255,255,255,.24)"

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
# show them in.


def dumbbell() -> str:
    # Head, collar, handle, collar, head: 340 wide, a head in each margin.
    parts = [(-170, 90, 200, 26), (-80, 22, 124, 8), (-58, 116, 36, 10), (58, 22, 124, 8), (80, 90, 200, 26)]
    return "".join(f'<rect x="{x}" y="{-h / 2}" width="{w}" height="{h}" rx="{r}"/>' for x, w, h, r in parts)


def plate(pounds: str) -> str:
    r = 170
    return (f'<path fill-rule="evenodd" d="M{-r} 0a{r} {r} 0 1 0 {2 * r} 0a{r} {r} 0 1 0 {-2 * r} 0z'
            f'M-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0z"/>'
            f'<circle r="{r * 0.8:.0f}" fill="none" stroke="{GEAR}" stroke-width="10"/>'
            f'<circle r="54" fill="none" stroke="{GEAR}" stroke-width="10"/>'
            f'<text y="{-r * 0.47:.0f}" text-anchor="middle" dominant-baseline="middle" font-family="Inter" '
            f'font-weight="800" font-size="{r * 0.3:.0f}" fill="{GEAR_TEXT}">{pounds}</text>'
            f'<text y="{r * 0.5:.0f}" text-anchor="middle" dominant-baseline="middle" font-family="Inter" '
            f'font-weight="700" font-size="{r * 0.17:.0f}" letter-spacing="4" fill="{GEAR_TEXT}">LB</text>')


def barbell_end() -> str:
    # The bar comes in from the left, behind the phone; two 45s, a 25 and a 10
    # sit just left of the join, and the collar and bare sleeve cross it.
    shapes = ['<rect x="-1500" y="-14" width="1400" height="28" rx="6"/>']
    x = -150
    for w, h in [(46, 460), (46, 460), (38, 340), (30, 240)]:
        shapes.append(f'<rect x="{x}" y="{-h / 2}" width="{w}" height="{h}" rx="12"/>')
        x += w + 6
    shapes.append(f'<rect x="{x}" y="-40" width="26" height="80" rx="6"/>')
    shapes.append(f'<rect x="{x + 26}" y="-24" width="190" height="48" rx="10"/>')
    return "".join(shapes)


def kettlebell() -> str:
    return (f'<path d="M-78 -40 C -78 -190, 78 -190, 78 -40" fill="none" stroke="{GEAR}" stroke-width="36" stroke-linecap="round"/>'
            '<path d="M-128 40 a128 128 0 1 1 256 0 a128 128 0 0 1 -40 92 h-176 a128 128 0 0 1 -40 -92z"/>')


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
    return screenshot(page, os.path.join(OUT, shot["out"]), (WIDTH, HEIGHT), browser)


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
    os.makedirs(OUT, exist_ok=True)
    browser = chrome()
    with tempfile.TemporaryDirectory() as work:
        for index, shot in phones:
            print(render(shot, index, plain, browser, work))
        for index, shot in watches:
            print(render_watch(shot, index, plain, browser, work))


if __name__ == "__main__":
    main()
