#!/usr/bin/env python3
"""
Builds the App Store's iPhone screenshots: each raw screenshot in raw-1.2.0/,
in a slim frame under its caption from captions.json, at 1290 x 2796. That is
a size Apple takes for the 6.9-inch display, which it scales down for every
smaller iPhone, so it's the only set to upload, whatever phone took the raws.

    python3 store/screenshots/render.py          # every screenshot
    python3 store/screenshots/render.py 01 07    # just these

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

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw-1.2.0")
OUT = os.path.join(HERE, "1.2.0")
# The site's copy of Inter: the closest match to the app's San Francisco
# that can be served to Chrome here, set heavy and tight as the app's titles.
FONT = os.path.join(HERE, "..", "..", "site", "fonts", "inter.woff2")
WIDTH, HEIGHT = 1290, 2796

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
</style></head><body>
<div class="caption"><h1>{headline}</h1><p>{subline}</p></div>
<div class="phone"><img src="{raw}" alt=""></div>
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


def render(shot: dict, browser: str, work: str) -> str:
    page = os.path.join(work, shot["out"] + ".html")
    with open(page, "w") as f:
        f.write(PAGE.format(
            font="file://" + os.path.abspath(FONT),
            raw="file://" + os.path.join(RAW, shot["raw"]),
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
