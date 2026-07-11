import { Platform } from "react-native";

// Plato design language — shared with plato-web.
// Dark zinc surfaces, violet accent, tabular numerals for logged numbers.
export const Palette = {
  bg: "#09090b",
  surface: "#131316",
  surfaceRaised: "#1c1c21",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#fafafa",
  textSecondary: "#a1a1aa",
  textTertiary: "#71717a",
  accent: "#8b5cf6",
  accentSoft: "rgba(139,92,246,0.16)",
  accentText: "#c4b5fd",
  success: "#34d399",
  successSoft: "rgba(52,211,153,0.14)",
  danger: "#f87171",
  dangerSoft: "rgba(248,113,113,0.12)",
  amber: "#fbbf24",
} as const;

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
