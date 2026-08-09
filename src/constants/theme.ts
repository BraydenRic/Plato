import { Platform } from "react-native";

// Plato design language — shared with plato-web.
// Zinc surfaces, one themeable accent, tabular numerals for logged numbers.
//
// The neutral chrome still doesn't follow the *accent*: picking Cobalt tints no
// surface. A neutral shell earns its calm by staying put and one confident
// colour does the signalling; tinting the surfaces too would drag every screen
// toward a wash and make the contrast ratios a per-theme gamble.
//
// What it does follow is light/dark, which is a different axis — two fixed
// palettes rather than seven generated ones, so every ratio below is a value
// someone chose and a test checks.
export type Mode = "light" | "dark";

export interface PaletteColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  amber: string;
}

/**
 * Light mode is not the dark palette inverted.
 *
 * Two things had to be re-derived rather than flipped:
 *
 *  - **Elevation reverses.** In dark, higher means lighter (bg → surface →
 *    surfaceRaised climbs out of black). On white there is no headroom above the
 *    page, so a card floats by being *purer* white than the page behind it and a
 *    text field recedes into grey. `surfaceRaised` is therefore darker than
 *    `surface` here and lighter than it there — the token means "one step
 *    further from the page", not "lighter".
 *  - **The semantics move a long way.** Emerald, red-400 and amber-400 are all
 *    picked to glow on near-black and every one of them fails on white — the
 *    amber marker lands at 1.8:1. Their light values are darkened until they
 *    read as text, then pushed until they clear ΔE 30 from all seven accents,
 *    which is what dragged `danger` down to red-900: at red-700 it sat ΔE 12
 *    from the Crimson accent, close enough that a delete button and a primary
 *    button were the same colour.
 */
export const PALETTES: Record<Mode, PaletteColors> = {
  dark: {
    bg: "#09090b",
    surface: "#131316",
    surfaceRaised: "#1c1c21",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    text: "#fafafa",
    textSecondary: "#a1a1aa",
    textTertiary: "#71717a",
    success: "#34d399",
    successSoft: "rgba(52,211,153,0.14)",
    danger: "#f87171",
    dangerSoft: "rgba(248,113,113,0.12)",
    amber: "#fbbf24",
  },
  light: {
    // Deliberately not white. The first cut ran #fafafa/#ffffff and read as
    // glare on a phone — a page is nearly all background, so its luminance is
    // most of what the eye actually receives, and 96% of full white across six
    // inches of screen is a lamp. Dropping the page to 83% keeps it
    // unambiguously light while giving the content something to sit against.
    bg: "#ebebee",
    surface: "#f7f7f9",
    surfaceRaised: "#e0e0e4",
    // A touch stronger than dark's, because the surfaces they separate are now
    // closer together than #09090b and #131316 were.
    border: "rgba(0,0,0,0.12)",
    borderStrong: "rgba(0,0,0,0.18)",
    text: "#18181b",
    textSecondary: "#4b4b53",
    textTertiary: "#65656d",
    success: "#046a4d",
    successSoft: "rgba(4,106,77,0.12)",
    danger: "#7f1d1d",
    dangerSoft: "rgba(127,29,29,0.10)",
    amber: "#8a5405",
  },
};

// ── Themes ────────────────────────────────────────────────────────────────────

export type ThemeId =
  | "violet"
  | "cobalt"
  | "cyan"
  | "amber"
  | "crimson"
  | "magenta"
  | "graphite";

/** The accent tokens, in one mode. */
export interface AccentSet {
  /** Filled buttons, active tab, chart strokes, progress fills. */
  accent: string;
  /** Low-alpha wash behind chips, badges and selected rows. */
  accentSoft: string;
  /** Accent-coloured text and icons, lifted so it stays legible on `bg`. */
  accentText: string;
  /** Label colour on top of a filled `accent` surface. */
  onAccent: string;
  /**
   * The muscle map's two tones — primary muscles and secondary ones.
   *
   * These answer to FIGURE_BODY rather than to the page, which is why they are
   * not simply `accent` and `accentText`: on a light body the secondary tone
   * has to go *deeper* to stay visible, where on a dark one it goes paler.
   * Graphite is why they can't be derived at all — its accent and accentText
   * are the same colour on purpose, so a diagram drawing both groups from those
   * tokens painted them identically.
   */
  figure: { primary: string; secondary: string };
}

/**
 * The muscle map's unworked body, and the seam between its muscles.
 *
 * The highlighter library takes this as `defaultFill` and applies it to every
 * path that has no colour of its own, so the figure does follow the mode — an
 * earlier comment here claimed the library baked its grey into the SVG paths
 * and that the figure had to stay dark. That was wrong: there is no fill in the
 * asset data, and `#3f3f3f` is only the prop's default value.
 *
 * Both modes hold the silhouette at ~1.77:1 against the card it sits on, so it
 * reads with the same weight either way rather than as a slab on white. The
 * seam sits a hair darker than the fill in both, because it stands for the
 * layer behind the shapes.
 */
export const FIGURE_BODY: Record<Mode, string> = { dark: "#3f3f3f", light: "#bcbcc2" };
export const FIGURE_SEAM: Record<Mode, string> = { dark: "#37373c", light: "#adadb4" };

export interface Theme {
  id: ThemeId;
  /** Shown in the Profile picker. */
  label: string;
  /**
   * Accents per mode. Six of the seven carry the same `accent` across both —
   * violet-500 reads as violet on white as readily as on black, and keeping it
   * put means the brand doesn't shift under you when the lights change. What
   * has to move is `accentText`, which is deliberately *lifted* for dark mode
   * and so lands around 1.7:1 on white; and Graphite's `accent`, whose whole
   * signal is "maximum contrast with the page" and which is therefore white in
   * one mode and near-black in the other.
   */
  dark: AccentSet;
  light: AccentSet;
  /**
   * The Live Activity widget parses plain hex only — no rgba — so the accent is
   * repeated here as a flat string rather than derived at the call site. Always
   * the dark accent: the widget lives on the lock screen, and its colours are
   * frozen when the activity starts, so it could not follow an in-app toggle
   * without restarting and re-animating the Dynamic Island.
   */
  activityTint: string;
  /**
   * Name registered with the expo-alternate-app-icons plugin, or null for the
   * default icon that ships in the bundle. Keep in sync with app.json.
   */
  iconName: string | null;
}

/** A theme flattened to one mode — the shape components actually consume. */
export interface ResolvedTheme extends AccentSet {
  id: ThemeId;
  label: string;
  activityTint: string;
  iconName: string | null;
}

export function resolveTheme(theme: Theme, mode: Mode): ResolvedTheme {
  const { dark: _dark, light: _light, ...rest } = theme;
  return { ...rest, ...theme[mode] };
}

/**
 * Seven accents that read as deliberate rather than decorative.
 *
 * Two rules held every one of them:
 *
 * 1. `onAccent` is dark wherever the accent is too bright to carry white text.
 *    Cyan and amber wash white out badly (2.4:1 and 2.7:1), so they flip and
 *    their filled buttons read dark-on-colour. The other three keep white at
 *    3.5–4.2:1, which is under the 4.5:1 bar for body text but is the standard
 *    treatment for a filled control at this weight, and it is what the shipped
 *    violet already does — holding the line at 4.5 there would mean recolouring
 *    the brand accent that is live on the App Store.
 * 2. No accent may collide with a semantic. `success` is emerald, `danger` red,
 *    `amber` (the PR/streak marker) yellow. Separation is measured as CIE ΔE,
 *    not WCAG contrast — contrast compares luminance, and the orange accent
 *    against the danger red scores 1.01 there despite being plainly a different
 *    colour (they simply share a luminance). That check
 *    is what ruled out teal (ΔE 24 from the success green) in favour of cyan,
 *    and rose (ΔE 19 from the danger red) in favour of magenta: a delete button
 *    and a primary button must never look like the same control.
 */
export const THEMES: Record<ThemeId, Theme> = {
  violet: {
    id: "violet",
    label: "Violet",
    dark: {
      accent: "#8b5cf6",
      accentSoft: "rgba(139,92,246,0.16)",
      accentText: "#c4b5fd",
      onAccent: "#ffffff",
      figure: { primary: "#8b5cf6", secondary: "#c4b5fd" },
    },
    light: {
      accent: "#8b5cf6",
      accentSoft: "rgba(139,92,246,0.16)",
      // violet-700. The dark tone (violet-300) is 1.7:1 on white.
      accentText: "#6d28d9",
      onAccent: "#ffffff",
      figure: { primary: "#8b5cf6", secondary: "#4c1d95" },
    },
    activityTint: "#8b5cf6",
    iconName: "Violet",
  },
  cobalt: {
    id: "cobalt",
    label: "Cobalt",
    dark: {
      accent: "#3b82f6",
      accentSoft: "rgba(59,130,246,0.16)",
      accentText: "#93c5fd",
      onAccent: "#ffffff",
      figure: { primary: "#3b82f6", secondary: "#93c5fd" },
    },
    light: {
      accent: "#3b82f6",
      accentSoft: "rgba(59,130,246,0.16)",
      accentText: "#1d4ed8",
      onAccent: "#ffffff",
      figure: { primary: "#3b82f6", secondary: "#1e3a8a" },
    },
    activityTint: "#3b82f6",
    iconName: "Cobalt",
  },
  cyan: {
    id: "cyan",
    label: "Cyan",
    dark: {
      accent: "#06b6d4",
      accentSoft: "rgba(6,182,212,0.16)",
      accentText: "#67e8f9",
      // White on cyan-500 lands near 2.4:1. Near-black clears 5.5:1.
      onAccent: "#083344",
      figure: { primary: "#06b6d4", secondary: "#a5f3fc" },
    },
    light: {
      accent: "#06b6d4",
      accentSoft: "rgba(6,182,212,0.16)",
      accentText: "#155e75",
      onAccent: "#083344",
      figure: { primary: "#06b6d4", secondary: "#164e63" },
    },
    activityTint: "#06b6d4",
    iconName: "Cyan",
  },
  amber: {
    id: "amber",
    label: "Amber",
    dark: {
      accent: "#f97316",
      accentSoft: "rgba(249,115,22,0.16)",
      accentText: "#fdba74",
      // Same story as cyan — white on orange-500 is a washout.
      onAccent: "#2a1206",
      figure: { primary: "#f97316", secondary: "#fdba74" },
    },
    light: {
      accent: "#f97316",
      accentSoft: "rgba(249,115,22,0.16)",
      accentText: "#9a3412",
      onAccent: "#2a1206",
      figure: { primary: "#f97316", secondary: "#7c2d12" },
    },
    activityTint: "#f97316",
    iconName: "Amber",
  },
  crimson: {
    id: "crimson",
    label: "Crimson",
    // The one accent that shares a hue family with a semantic, so it is picked
    // to sit as far from it as a red can: red-600 against a `danger` that is
    // red-400 in dark and red-900 in light — ΔE 30.9 and 38.7. Rose-500 managed
    // only 19.4 and was dropped for it. The two also never appear as the same
    // kind of surface: destructive controls are a soft tint with red text,
    // primary ones a solid fill. It carries white at 4.83:1, better than violet.
    dark: {
      accent: "#dc2626",
      accentSoft: "rgba(220,38,38,0.16)",
      accentText: "#fca5a5",
      onAccent: "#ffffff",
      figure: { primary: "#dc2626", secondary: "#fca5a5" },
    },
    light: {
      accent: "#dc2626",
      accentSoft: "rgba(220,38,38,0.16)",
      accentText: "#b91c1c",
      onAccent: "#ffffff",
      figure: { primary: "#dc2626", secondary: "#6b1010" },
    },
    activityTint: "#dc2626",
    iconName: "Crimson",
  },
  magenta: {
    id: "magenta",
    label: "Magenta",
    dark: {
      accent: "#ec4899",
      accentSoft: "rgba(236,72,153,0.16)",
      accentText: "#f9a8d4",
      onAccent: "#ffffff",
      figure: { primary: "#ec4899", secondary: "#f9a8d4" },
    },
    light: {
      accent: "#ec4899",
      accentSoft: "rgba(236,72,153,0.16)",
      accentText: "#be185d",
      onAccent: "#ffffff",
      figure: { primary: "#ec4899", secondary: "#831843" },
    },
    activityTint: "#ec4899",
    iconName: "Magenta",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    // No hue at all: the signal comes from contrast, the way a filled white
    // button reads as primary on a black page. Inactive chrome is already
    // textTertiary, so plain white still reads unmistakably as "active" — and
    // in light mode the same argument runs in reverse, so it flips to near-black
    // rather than keeping a white that would vanish into the page.
    dark: {
      accent: "#fafafa",
      accentSoft: "rgba(250,250,250,0.10)",
      accentText: "#fafafa",
      onAccent: "#09090b",
      figure: { primary: "#fafafa", secondary: "#a1a1aa" },
    },
    light: {
      accent: "#18181b",
      accentSoft: "rgba(24,24,27,0.10)",
      accentText: "#18181b",
      onAccent: "#fafafa",
      figure: { primary: "#18181b", secondary: "#71717a" },
    },
    activityTint: "#fafafa",
    // #fafafa is the white glyph already shipping in the bundle, so this theme
    // owns the default icon and switching to it clears the alternate rather
    // than setting a duplicate.
    iconName: null,
  },
};

export const THEME_LIST: readonly Theme[] = [
  THEMES.violet,
  THEMES.cobalt,
  THEMES.cyan,
  THEMES.amber,
  THEMES.crimson,
  THEMES.magenta,
  THEMES.graphite,
];

export const DEFAULT_THEME_ID: ThemeId = "violet";

export function isThemeId(value: unknown): value is ThemeId {
  // hasOwnProperty, not `in` — `in` walks the prototype chain, so a stale or
  // corrupted stored value of "constructor" would pass and then index THEMES to
  // a function instead of a palette.
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(THEMES, value);
}

// ── Appearance ───────────────────────────────────────────────────────────────

/**
 * What the user picked, which is not the same as which palette renders:
 * "system" resolves to one of the other two at runtime.
 */
export type AppearancePref = "light" | "dark" | "system";

export const APPEARANCE_PREFS: readonly AppearancePref[] = ["light", "dark", "system"];

/** Shown in the Profile control, in the order above. */
export const APPEARANCE_LABELS: Record<AppearancePref, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Dark, not "system".
 *
 * Following the phone would be the more fashionable default, but this app has
 * been dark-only on the App Store since 1.0 — so shipping "system" would hand
 * every existing user on a light phone a white app they never asked for, as the
 * *result of an update*. Light mode is a thing you go and turn on.
 */
export const DEFAULT_APPEARANCE: AppearancePref = "dark";

export function isAppearancePref(value: unknown): value is AppearancePref {
  return typeof value === "string" && (APPEARANCE_PREFS as readonly string[]).includes(value);
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    rounded: "normal",
    mono: "monospace",
  },
});

export const MaxContentWidth = 800;

/**
 * Dynamic Type ceilings for the handful of places text shares a fixed row with
 * something else and has nowhere to wrap. Everything else — headings, body
 * copy, buttons, empty states, card content — scales without a cap, so the app
 * still grows with the reader's chosen text size.
 */
export const FontScaleCap = {
  /** Keypad bar: Back/Done/Next have to stay on one row above the keyboard. */
  keypad: 1.4,
  /** Set grid: weights and reps must stay readable inside narrow columns. */
  grid: 1.5,
} as const;

/**
 * Past this scale the tab bar's labels clip mid-word, so the bar drops to
 * icons only — full-size tap targets, nothing cut off. Matches how iOS itself
 * sheds tab titles at accessibility text sizes.
 */
export const TabLabelMaxFontScale = 1.5;
