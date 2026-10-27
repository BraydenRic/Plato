#!/usr/bin/env python3
"""
Builds the App Store's iPhone screenshots: each raw screenshot in raw-1.2.0/,
in a slim frame under its caption from captions.json, at 1290 x 2796. That is
a size Apple takes for the 6.9-inch display, which it scales down for every
smaller iPhone, so it's the only set to upload, whatever phone took the raws.

    python3 store/screenshots/render.py          # every screenshot
    python3 store/screenshots/render.py 01 07    # just these

Each screenshot's own status bar (the time it was taken, the carrier, the
battery left) is painted out and a clean one drawn in its place: 9:41, full
signal, Wi-Fi and battery, as Apple shows its own. On the lock screen, where
the bar sits on a photo, the old one is blended into the sky around it and
the time left off, as a lock screen's status bar has none.

Change the words in captions.json and run it again; a "\n" in a headline
breaks the line there, for a phrase that mustn't split. Needs a headless Chrome:
CHROME=/path/to/chrome, or Playwright's chrome-headless-shell, which is
looked for in ~/.cache/ms-playwright. Pillow takes the alpha channel out
afterwards, since Apple refuses screenshots that have one.
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
# The site's copy of Inter: the closest match to the app's San Francisco
# that can be served to Chrome here, set heavy and tight as the app's titles.
FONT = os.path.join(HERE, "..", "..", "site", "fonts", "inter.woff2")
WIDTH, HEIGHT = 1290, 2796

# Where an iPhone with a Dynamic Island draws its status bar, in a 1179 x 2556
# screenshot: the band it sits in, and on the lock screen the patches to blend
# away: the carrier, then the icons, leaving the swipe-down line under them.
RAW_SIZE = (1179, 2556)
STATUS_BAND = (0, 40, 1179, 150)
LOCK_PATCHES = [(90, 50, 340, 130), (830, 50, 1095, 120)]

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

PAGE = """<!doctype html>
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


def render(shot: dict, browser: str, work: str) -> str:
    page = os.path.join(work, shot["out"] + ".html")
    lock = shot.get("statusBar") == "lock"
    with open(page, "w") as f:
        f.write(PAGE.format(
            font="file://" + os.path.abspath(FONT),
            raw="file://" + clean_status_bar(shot, work),
            status=STATUS_BAR.format(time="" if lock else STATUS_TIME),
            headline=html.escape(shot["headline"]).replace("\n", "<br>"),
            subline=html.escape(shot["subline"]),
            width=WIDTH,
            height=HEIGHT,
        ))
    out = os.path.join(OUT, shot["out"])
    flags = [] if "headless-shell" in browser else ["--headless=new"]
    subprocess.run(
        [browser, *flags, "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files",
         "--force-device-scale-factor=1", f"--window-size={WIDTH},{HEIGHT}",
         "--virtual-time-budget=4000", f"--screenshot={out}", "file://" + page],
        check=True, capture_output=True,
    )
    image = Image.open(out)
    if image.size != (WIDTH, HEIGHT):
        sys.exit(f"{shot['out']} came out {image.size}, not {WIDTH} x {HEIGHT}")
    image.convert("RGB").save(out, optimize=True)
    return out


def main() -> None:
    with open(os.path.join(HERE, "captions.json")) as f:
        shots = json.load(f)
    wanted = sys.argv[1:]
    if wanted:
        shots = [s for s in shots if any(s["out"].startswith(w) for w in wanted)]
    os.makedirs(OUT, exist_ok=True)
    browser = chrome()
    with tempfile.TemporaryDirectory() as work:
        for shot in shots:
            print(render(shot, browser, work))


if __name__ == "__main__":
    main()
