import { Platform } from "react-native";

// Plato design language — shared with plato-web.
// Dark zinc surfaces, one themeable accent, tabular numerals for logged numbers.
//
// The chrome below is deliberately *not* themeable. Only the accent changes with
// the user's theme (see `THEMES`), which is how the apps this borrows from work:
// a neutral shell earns its calm by staying put, and one confident colour does
// the signalling. Tinting the surfaces too would drag every screen toward a
// wash and make the contrast ratios a per-theme gamble.
export const Palette = {
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
} as const;

// ── Themes ────────────────────────────────────────────────────────────────────

export type ThemeId = "violet" | "cobalt" | "cyan" | "amber" | "magenta" | "graphite";

export interface Theme {
  id: ThemeId;
  /** Shown in the Profile picker. */
  label: string;
  /** Filled buttons, active tab, chart strokes, progress fills. */
  accent: string;
  /** Low-alpha wash behind chips, badges and selected rows. */
  accentSoft: string;
  /** Accent-coloured text and icons, lifted so it stays legible on `bg`. */
  accentText: string;
  /** Label colour on top of a filled `accent` surface. */
  onAccent: string;
  /**
   * The Live Activity widget parses plain hex only — no rgba — so the accent is
   * repeated here as a flat string rather than derived at the call site.
   */
  activityTint: string;
  /**
   * Name registered with the expo-alternate-app-icons plugin, or null for the
   * default icon that ships in the bundle. Keep in sync with app.json.
   */
  iconName: string | null;
}

/**
 * Six accents that read as deliberate rather than decorative.
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
    accent: "#8b5cf6",
    accentSoft: "rgba(139,92,246,0.16)",
    accentText: "#c4b5fd",
    onAccent: "#ffffff",
    activityTint: "#8b5cf6",
    iconName: "Violet",
  },
  cobalt: {
    id: "cobalt",
    label: "Cobalt",
    accent: "#3b82f6",
    accentSoft: "rgba(59,130,246,0.16)",
    accentText: "#93c5fd",
    onAccent: "#ffffff",
    activityTint: "#3b82f6",
    iconName: "Cobalt",
  },
  cyan: {
    id: "cyan",
    label: "Cyan",
    accent: "#06b6d4",
    accentSoft: "rgba(6,182,212,0.16)",
    accentText: "#67e8f9",
    // White on cyan-500 lands near 2.4:1. Near-black clears 5.5:1.
    onAccent: "#083344",
    activityTint: "#06b6d4",
    iconName: "Cyan",
  },
  amber: {
    id: "amber",
    label: "Amber",
    accent: "#f97316",
    accentSoft: "rgba(249,115,22,0.16)",
    accentText: "#fdba74",
    // Same story as cyan — white on orange-500 is a washout.
    onAccent: "#2a1206",
    activityTint: "#f97316",
    iconName: "Amber",
  },
  magenta: {
    id: "magenta",
    label: "Magenta",
    accent: "#ec4899",
    accentSoft: "rgba(236,72,153,0.16)",
    accentText: "#f9a8d4",
    onAccent: "#ffffff",
    activityTint: "#ec4899",
    iconName: "Magenta",
  },
  graphite: {
    id: "graphite",
    label: "Graphite",
    // No hue at all: the signal comes from contrast, the way a filled white
    // button reads as primary on a black page. Inactive chrome is already
    // textTertiary, so plain white still reads unmistakably as "active".
    accent: "#fafafa",
    accentSoft: "rgba(250,250,250,0.10)",
    accentText: "#fafafa",
    onAccent: "#09090b",
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
