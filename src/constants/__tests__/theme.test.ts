import {
  DEFAULT_THEME_ID,
  Palette,
  THEMES,
  THEME_LIST,
  isThemeId,
  type Theme,
} from "../theme";

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
    expect(new Set(THEME_LIST.map((t) => t.accent)).size).toBe(THEME_LIST.length);
    expect(new Set(THEME_LIST.map((t) => t.label)).size).toBe(THEME_LIST.length);
  });
});

describe("every theme", () => {
  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s keeps its accent text readable on the app background",
    (_label, theme) => {
      // Links, active tabs and volume figures are ordinary text, so this one
      // holds the full 4.5:1 small-text bar. Every theme clears 10:1.
      expect(contrast(theme.accentText, Palette.bg)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s keeps its button label off the accent it sits on",
    (_label, theme) => {
      // 3:1 (the WCAG bar for large text and UI components), not 4.5:1. White
      // on violet-500 is 4.2:1 and that is the accent already shipping, so a
      // stricter gate here would fail the live App Store build rather than
      // catch a bug. What it does catch is the real mistake: leaving white on
      // an accent bright enough to swallow it, which is why cyan and amber
      // carry dark labels.
      expect(contrast(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(3);
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s stays clear of the semantic colours",
    (_label, theme) => {
      // success/danger/amber carry fixed meanings. An accent that lands on top
      // of one makes "delete" and "primary" look like the same control — the
      // exact trap a rose accent fell into at ΔE 19 from the danger red.
      for (const semantic of [Palette.success, Palette.danger, Palette.amber]) {
        expect(deltaE(theme.accent, semantic)).toBeGreaterThan(30);
      }
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s is visibly its own colour next to the others",
    (_label, theme) => {
      // Two near-identical swatches in the picker is a choice that isn't one.
      for (const other of THEME_LIST) {
        if (other.id === theme.id) continue;
        expect(deltaE(theme.accent, other.accent)).toBeGreaterThan(30);
      }
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s can draw two levels of itself at once",
    (_label, theme) => {
      // The muscle map paints primary muscles in `accent` and secondary ones in
      // `accentMuted`. Graphite shipped with both tokens set to white, so the
      // two groups came out identical and the diagram said nothing — this is
      // that bug, pinned.
      expect(deltaE(theme.accent, theme.accentMuted)).toBeGreaterThan(25);
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s keeps its muted tone off the muscle map's own body grey",
    (_label, theme) => {
      // Secondary muscles have to read as highlighted against the unworked
      // body, or dialling the tone down far enough to differ from the primary
      // just loses it into the figure instead.
      expect(deltaE(theme.accentMuted, "#3f3f3f")).toBeGreaterThan(25);
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s gives the Live Activity a plain hex tint",
    (_label, theme) => {
      // The native widget parses hex only; an rgba() string makes the progress
      // bar fall back to a default colour with no error anywhere.
      expect(theme.activityTint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.activityTint).toBe(theme.accent);
    }
  );

  it.each(THEME_LIST.map((t): [string, Theme] => [t.label, t]))(
    "%s washes its soft tint rather than filling it",
    (_label, theme) => {
      // accentSoft backs chips and selected rows with text on top, so it has to
      // stay translucent — a solid fill there buries the label.
      expect(theme.accentSoft).toMatch(/^rgba\(\d+,\d+,\d+,0?\.\d+\)$/);
    }
  );
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
