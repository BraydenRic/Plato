import {
  APPEARANCE_LABELS,
  APPEARANCE_PREFS,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME_ID,
  FIGURE_BODY,
  FIGURE_SEAM,
  PALETTES,
  THEMES,
  THEME_LIST,
  isAppearancePref,
  isThemeId,
  resolveTheme,
  type Mode,
  type ResolvedTheme,
  type Theme,
} from "../theme";

const MODES: Mode[] = ["dark", "light"];

/**
 * Invariants for the accent themes.
 *
 * These aren't testing that violet is violet — they're guarding the rules a new
 * theme has to obey to be safe to ship, because every one of them is a mistake
 * you cannot see until the app is on a phone: a label that vanishes into its own
 * button, an icon name that doesn't exist in app.json, a colour the native Live
 * Activity widget silently refuses to parse.
 */

// ── Contrast ─────────────────────────────────────────────────────────────────

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1:1 (identical) to 21:1 (black on white). */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ── Perceptual distance ──────────────────────────────────────────────────────

/**
 * CIE76 ΔE — roughly "how different do these look".
 *
 * Contrast ratio is the wrong tool for telling two *hues* apart: it only
 * compares luminance, so the orange accent scores 1.01 against the amber PR
 * marker despite being obviously a different colour. ΔE works in Lab space and
 * answers the question actually being asked.
 */
function lab(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16)));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string): number {
  const [la, aa, ba] = lab(a);
  const [lb, ab, bb] = lab(b);
  return Math.hypot(la - lb, aa - ab, ba - bb);
}

describe("the colour maths", () => {
  // Verifies the helpers before they are used to judge the palette below.
  it("scores black on white at the maximum contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("scores a colour against itself as no contrast at all", () => {
    expect(contrast("#8b5cf6", "#8b5cf6")).toBeCloseTo(1, 5);
  });

  it("scores a colour against itself as zero perceptual distance", () => {
    expect(deltaE("#8b5cf6", "#8b5cf6")).toBeCloseTo(0, 5);
  });

  it("separates hues that contrast ratio cannot tell apart", () => {
    // The exact pair that motivated using ΔE: the amber accent against the
    // danger red. Identical luminance, so contrast calls them the same colour
    // — while orange and red are plainly distinguishable.
    expect(contrast("#f97316", "#f87171")).toBeLessThan(1.05);
    expect(deltaE("#f97316", "#f87171")).toBeGreaterThan(30);
  });
});

// ── Palette shape ────────────────────────────────────────────────────────────

describe("the theme registry", () => {
  it("keys every theme by its own id, so lookups can't cross-wire", () => {
    for (const [key, theme] of Object.entries(THEMES)) {
      expect(theme.id).toBe(key);
    }
  });

  it("lists every registered theme in the picker", () => {
    expect(THEME_LIST.map((t) => t.id).sort()).toEqual(Object.keys(THEMES).sort());
  });

  it("offers a real choice rather than a token second option", () => {
    expect(THEME_LIST.length).toBeGreaterThanOrEqual(4);
  });

  it("defaults to a theme that exists", () => {
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it("keeps violet the default, so an existing install looks unchanged", () => {
    expect(DEFAULT_THEME_ID).toBe("violet");
  });

  it("gives every theme a distinct accent and label", () => {
    for (const mode of MODES) {
      expect(new Set(THEME_LIST.map((t) => t[mode].accent)).size).toBe(THEME_LIST.length);
    }
    expect(new Set(THEME_LIST.map((t) => t.label)).size).toBe(THEME_LIST.length);
  });
});

/**
 * Every accent rule, run against both palettes.
 *
 * Light mode is where these earn their keep. A dark-mode accent set is not a
 * light-mode one — `accentText` is deliberately lifted to glow on near-black and
 * lands around 1.7:1 on white, and Graphite's white accent disappears entirely —
 * so each rule below is a mistake that light mode could reintroduce silently.
 */
describe.each(MODES)("every theme in %s mode", (mode) => {
  const P = PALETTES[mode];
  const themes = THEME_LIST.map((t): [string, ResolvedTheme] => [t.label, resolveTheme(t, mode)]);

  it.each(themes)("%s keeps its accent text readable wherever it lands", (_label, theme) => {
    // Links, active tabs and volume figures are ordinary text, so this one
    // holds the full 4.5:1 small-text bar — and it holds on cards too, not just
    // the page, because that is where most of this text actually sits.
    for (const surface of [P.bg, P.surface, P.surfaceRaised]) {
      expect(contrast(theme.accentText, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(themes)("%s keeps its button label off the accent it sits on", (_label, theme) => {
    // 3:1 (the WCAG bar for large text and UI components), not 4.5:1. White
    // on violet-500 is 4.2:1 and that is the accent already shipping, so a
    // stricter gate here would fail the live App Store build rather than
    // catch a bug. What it does catch is the real mistake: leaving white on
    // an accent bright enough to swallow it, which is why cyan and amber
    // carry dark labels.
    expect(contrast(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(3);
  });

  it.each(themes)("%s stays clear of the semantic colours", (_label, theme) => {
    // success/danger/amber carry fixed meanings. An accent that lands on top
    // of one makes "delete" and "primary" look like the same control — the
    // exact trap a rose accent fell into at ΔE 19 from the danger red, and the
    // reason light mode's danger is red-900 rather than the red-700 that first
    // looked right and sat ΔE 12 from Crimson.
    for (const semantic of [P.success, P.danger, P.amber]) {
      expect(deltaE(theme.accent, semantic)).toBeGreaterThan(30);
    }
  });

  it.each(themes)("%s is visibly its own colour next to the others", (_label, theme) => {
    // Two near-identical swatches in the picker is a choice that isn't one.
    for (const other of THEME_LIST) {
      if (other.id === theme.id) continue;
      expect(deltaE(theme.accent, other[mode].accent)).toBeGreaterThan(30);
    }
  });

  it.each(themes)("%s washes its soft tint rather than filling it", (_label, theme) => {
    // accentSoft backs chips and selected rows with text on top, so it has to
    // stay translucent — a solid fill there buries the label.
    expect(theme.accentSoft).toMatch(/^rgba\(\d+,\d+,\d+,0?\.\d+\)$/);
  });
});

describe.each(MODES)("the muscle map in %s mode", (mode) => {
  const body = FIGURE_BODY[mode];
  const themes = THEME_LIST.map((t): [string, ResolvedTheme] => [t.label, resolveTheme(t, mode)]);

  it.each(themes)("%s can draw two levels of itself at once", (_label, theme) => {
    // Graphite shipped with both tokens set to white, so the two groups came
    // out identical and the diagram said nothing — this is that bug, pinned.
    //
    // A lower bar than visibility below, deliberately: cyan has run at 28 in
    // dark mode since launch and reads fine, because failing here only blurs
    // *which* of two clearly-visible groups you're looking at.
    expect(deltaE(theme.figure.primary, theme.figure.secondary)).toBeGreaterThan(25);
  });

  it.each(themes)("%s keeps both tones off the body they sit on", (_label, theme) => {
    // The stricter of the two bars, because failing this one means not seeing a
    // worked muscle at all. 25 was too generous: Graphite's light secondary
    // cleared it at ΔE 29 and was still reported as hard to pick out on a
    // phone, so the bar moved to where that value would have failed.
    //
    // The body follows the mode, so this is a different comparison in each — a
    // tone tuned to be pale against dark grey is exactly the one that vanishes
    // against light grey.
    expect(deltaE(theme.figure.primary, body)).toBeGreaterThan(32);
    expect(deltaE(theme.figure.secondary, body)).toBeGreaterThan(32);
  });

  it("keeps the silhouette readable against the card without shouting", () => {
    // Matched across modes on purpose: the figure should read with the same
    // weight either way, rather than as a dark slab dropped on a white card.
    const onCard = contrast(body, PALETTES[mode].surface);
    expect(onCard).toBeGreaterThanOrEqual(1.3);
    expect(onCard).toBeLessThan(3);
  });

  it("keeps the seam behind the muscles rather than beside them", () => {
    // It stands for the layer *under* the shapes, so it reads as a seam only
    // while it is darker than the fill — in both modes.
    expect(luminance(FIGURE_SEAM[mode])).toBeLessThan(luminance(body));
  });
});

describe.each(MODES)("the muscle map legend in %s mode", (mode) => {
  /*
   * The legend swatches are drawn on the card, not on the figure — which is how
   * Graphite shipped a white "Primary" dot onto a white card in light mode. They
   * now sit on a ring of the body colour, so what has to hold is that the ring
   * is discernible on the card and the tone is discernible on the ring. Testing
   * the tone against the card directly was the check that never existed.
   */
  const body = FIGURE_BODY[mode];
  const themes = THEME_LIST.map((t): [string, ResolvedTheme] => [t.label, resolveTheme(t, mode)]);

  it("shows the ring against the card", () => {
    expect(contrast(body, PALETTES[mode].surface)).toBeGreaterThanOrEqual(1.3);
  });

  it.each(themes)("%s shows both swatches against that ring", (_label, theme) => {
    expect(deltaE(theme.figure.primary, body)).toBeGreaterThan(32);
    expect(deltaE(theme.figure.secondary, body)).toBeGreaterThan(32);
  });
});

describe("the Live Activity tint", () => {
  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s gives the widget a plain hex tint",
    (_label, theme) => {
      // The native widget parses hex only; an rgba() string makes the progress
      // bar fall back to a default colour with no error anywhere.
      expect(theme.activityTint).toMatch(/^#[0-9a-f]{6}$/i);
      // Always the *dark* accent. The widget's colours are frozen when the
      // activity starts, so it cannot follow an in-app toggle without
      // restarting and re-animating the Dynamic Island — and it renders on the
      // lock screen, not on the app's page.
      expect(theme.activityTint).toBe(theme.dark.accent);
    }
  );
});

describe("the two palettes", () => {
  it("gives both modes the same set of tokens", () => {
    // A token present in one and missing in the other is a screen that renders
    // `undefined` as a colour in exactly one mode.
    expect(Object.keys(PALETTES.light).sort()).toEqual(Object.keys(PALETTES.dark).sort());
  });

  it.each(["text", "textSecondary", "textTertiary", "success", "danger", "amber"] as const)(
    "reads %s at least as clearly in light as in dark",
    (tone) => {
      // Not an absolute bar: the shipped dark palette runs textTertiary at
      // 3.5:1 on surfaceRaised, so a flat 4.5 here would fail the live build
      // rather than catch anything. The real rule is that the new mode is never
      // the worse one — capped at 4.5 so a already-passing pair doesn't have to
      // chase dark's 11:1.
      for (const surface of ["bg", "surface", "surfaceRaised"] as const) {
        const light = contrast(PALETTES.light[tone], PALETTES.light[surface]);
        const dark = contrast(PALETTES.dark[tone], PALETTES.dark[surface]);
        expect(light).toBeGreaterThanOrEqual(Math.min(dark, 4.5));
      }
    }
  );

  it("keeps light actually light and dark actually dark", () => {
    // Cheap, but it is the one thing every other test here takes for granted.
    expect(luminance(PALETTES.light.bg)).toBeGreaterThan(0.5);
    expect(luminance(PALETTES.dark.bg)).toBeLessThan(0.1);
  });

  it("keeps the light page back from full white", () => {
    // This shipped at #fafafa (0.96) and read as glare on a phone. A page is
    // nearly all background, so its luminance is most of what the eye actually
    // receives — the upper bound is the whole point of the band, and the lower
    // one stops a later "let's calm it down" landing in mid-grey.
    const L = luminance(PALETTES.light.bg);
    expect(L).toBeGreaterThan(0.7);
    expect(L).toBeLessThan(0.9);
  });
});

describe("resolveTheme", () => {
  it.each(MODES)("flattens to the %s accent set", (mode) => {
    const theme = resolveTheme(THEMES.violet, mode);
    expect(theme.accent).toBe(THEMES.violet[mode].accent);
    expect(theme.accentText).toBe(THEMES.violet[mode].accentText);
  });

  it("keeps the mode-independent fields", () => {
    const theme = resolveTheme(THEMES.graphite, "light");
    expect(theme.id).toBe("graphite");
    expect(theme.label).toBe("Graphite");
    expect(theme.iconName).toBeNull();
    expect(theme.activityTint).toBe(THEMES.graphite.activityTint);
  });

  it("takes the figure from the mode too", () => {
    // Graphite is the case that matters: its figure tones invert with the body,
    // so reading the wrong mode's pair here paints white muscles onto a light
    // grey figure.
    expect(resolveTheme(THEMES.graphite, "light").figure).toEqual(THEMES.graphite.light.figure);
    expect(resolveTheme(THEMES.graphite, "dark").figure).toEqual(THEMES.graphite.dark.figure);
  });

  it("leaves no nested accent sets on the result", () => {
    // The flattened shape is what components consume; a stray `dark` key would
    // mean a call site could read the wrong mode's colour and still typecheck.
    const theme = resolveTheme(THEMES.violet, "light");
    expect(theme).not.toHaveProperty("dark");
    expect(theme).not.toHaveProperty("light");
  });

  it("flips Graphite rather than leaving it invisible", () => {
    // The one theme whose accent genuinely has to change: its signal is
    // "maximum contrast with the page", so a white accent on a white page is
    // not a dimmer version of the idea, it is nothing at all.
    expect(contrast(resolveTheme(THEMES.graphite, "light").accent, PALETTES.light.bg)).toBeGreaterThan(4.5);
    expect(contrast(resolveTheme(THEMES.graphite, "dark").accent, PALETTES.dark.bg)).toBeGreaterThan(4.5);
  });
});

describe("the appearance preference", () => {
  it("defaults to dark, so an update doesn't turn the app white", () => {
    // Plato has been dark-only on the App Store since 1.0. Defaulting to
    // "system" would hand every existing user on a light phone a white app they
    // never asked for, as the result of an update they didn't opt into.
    expect(DEFAULT_APPEARANCE).toBe("dark");
  });

  it("offers exactly the three the picker draws", () => {
    expect([...APPEARANCE_PREFS]).toEqual(["light", "dark", "system"]);
    expect(Object.keys(APPEARANCE_LABELS).sort()).toEqual([...APPEARANCE_PREFS].sort());
  });

  it.each([...APPEARANCE_PREFS])("accepts %p", (pref) => {
    expect(isAppearancePref(pref)).toBe(true);
  });

  it.each([["Light"], ["auto"], [""], ["system "]])("rejects %p", (raw) => {
    expect(isAppearancePref(raw)).toBe(false);
  });

  it.each([[null], [undefined], [7], [{}]])("rejects the non-string %p", (raw) => {
    expect(isAppearancePref(raw)).toBe(false);
  });

  it("is not fooled by inherited Object properties", () => {
    // Same trap as isThemeId: a stored "constructor" must not read as a valid
    // stored preference.
    expect(isAppearancePref("constructor")).toBe(false);
    expect(isAppearancePref("toString")).toBe(false);
  });
});

describe("the app icon mapping", () => {
  it("points exactly one theme at the icon already in the bundle", () => {
    // More than one and two themes would share an icon; none and a fresh
    // install could never get back to the icon it shipped with.
    expect(THEME_LIST.filter((t) => t.iconName === null)).toHaveLength(1);
  });

  it("gives every other theme its own alternate", () => {
    const names = THEME_LIST.map((t) => t.iconName).filter((n): n is string => n !== null);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names alternates exactly as app.json registers them", () => {
    // The plugin matches on this string at runtime; a mismatch throws on the
    // native side long after the build has shipped.
    const appJson = require("../../../app.json");
    const entry = appJson.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === "expo-alternate-app-icons"
    );
    const registered: string[] = entry[1].map((i: { name: string }) => i.name);

    for (const theme of THEME_LIST) {
      if (theme.iconName) expect(registered).toContain(theme.iconName);
    }
    // And nothing registered is left stranded without a theme to select it.
    expect(registered.sort()).toEqual(
      THEME_LIST.map((t) => t.iconName)
        .filter(Boolean)
        .sort()
    );
  });
});

describe("isThemeId", () => {
  it("accepts every real id", () => {
    for (const theme of THEME_LIST) expect(isThemeId(theme.id)).toBe(true);
  });

  it.each([["purple"], [""], ["VIOLET"]])("rejects %p", (raw) => {
    expect(isThemeId(raw)).toBe(false);
  });

  it.each([[null], [undefined], [7], [{}]])("rejects the non-string %p", (raw) => {
    expect(isThemeId(raw)).toBe(false);
  });

  it("is not fooled by inherited Object properties", () => {
    // `value in THEMES` walks the prototype chain, so a stored "constructor"
    // would otherwise pass and index to a function.
    expect(isThemeId("constructor")).toBe(false);
    expect(isThemeId("toString")).toBe(false);
  });
});

describe("the Live Activity logo", () => {
  /**
   * The widget resolves this name against its own compiled asset catalog. A
   * theme whose file is missing doesn't error anywhere — the pill just draws no
   * logo, during a workout, on the lock screen, which is about the least
   * visible place a mistake could hide.
   */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { activityImage } = require("@/lib/live-activity");

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s has the image it asks the widget for",
    (_label, theme) => {
      const name = activityImage(theme);
      const file = path.join(__dirname, "../../../assets/liveActivity", `${name}.png`);
      expect(fs.existsSync(file)).toBe(true);
    }
  );

  it("gives every theme its own image", () => {
    const names = THEME_LIST.map((t) => activityImage(t));
    expect(new Set(names).size).toBe(THEME_LIST.length);
  });
});
