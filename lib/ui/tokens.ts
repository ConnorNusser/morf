import { Theme } from "./theme";

// The app's shared formatting tokens. Every screen pulls emphasis, spacing,
// and shape from here instead of inventing per-file values, so the tabs read
// as one system. Typography roles live next door in lib/ui/typography.ts.

/**
 * Ink: the text-emphasis ramp. One base color (theme text) at five named
 * strengths replaces the ad-hoc `colors.text + "50"` hex suffixes that had
 * drifted into ~20 distinct opacities across the home and history trees.
 *
 * primary   — headline + body copy (full strength)
 * secondary — supporting labels that still need to be read
 * muted     — de-emphasized values, inactive controls, icon chrome
 * faint     — placeholders, fine print, disabled text
 * ghost     — watermark-level: oversized glyphs, empty-state icons
 * hairline  — 1px rules and dividers drawn in text color
 */
export const ALPHA = {
  secondary: "99", // 60%
  muted: "66", // 40%
  faint: "4D", // 30%
  ghost: "26", // 15%
  hairline: "14", // 8%
} as const;

export type AlphaStep = keyof typeof ALPHA;
export type InkTone = "primary" | AlphaStep;

export const withAlpha = (color: string, step: AlphaStep): string =>
  color + ALPHA[step];

export const inkColor = (theme: Theme, tone: InkTone): string =>
  tone === "primary" ? theme.colors.text : withAlpha(theme.colors.text, tone);

export interface Ink {
  primary: string;
  secondary: string;
  muted: string;
  faint: string;
  ghost: string;
  hairline: string;
}

export const inkRamp = (theme: Theme): Ink => ({
  primary: theme.colors.text,
  secondary: withAlpha(theme.colors.text, "secondary"),
  muted: withAlpha(theme.colors.text, "muted"),
  faint: withAlpha(theme.colors.text, "faint"),
  ghost: withAlpha(theme.colors.text, "ghost"),
  hairline: withAlpha(theme.colors.text, "hairline"),
});

/**
 * A 12% wash of an accent color — the one background treatment for tier
 * badges, delta pills, and other tinted chips.
 */
export const tint = (color: string): string => color + "1F";

/** Spacing scale. Margins, paddings, and gaps snap to these. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  /** Vertical rhythm between page sections. */
  section: 24,
} as const;

/** Shape roles. Corner radii come from the element's role, not taste. */
export const radius = {
  /** Micro badges: tier tags, delta pills, COUNT chips. */
  badge: 6,
  /** Interactive controls: search bars, chips, small buttons. */
  control: 10,
  /** Cards and standalone surfaces. */
  card: 12,
  /** Fully-rounded CTAs. */
  pill: 999,
} as const;

/** The horizontal gutter every tab screen shares. */
export const screenGutter = 20;

/** Bottom over-scroll under the floating tab bar, shared by tab ScrollViews. */
export const scrollBottom = 120;

/**
 * Interior padding for the few deliberate "hero panel" surfaces (History hub,
 * Career section). Everything else uses space.lg — this is the one named
 * exception, not an invitation.
 */
export const panelPad = 18;

/** Letter-spacing roles. Everything else is default tracking. */
export const track = {
  /** Uppercase micro-labels (SectionLabel grammar). */
  caps: 1,
  /** Large display numbers (statHero and up). */
  display: -0.5,
} as const;

/** Semantic accents shared across tabs (theme-independent by design). */
export const trend = {
  up: "#00C85C",
  down: "#FF6B6B",
} as const;

/** Destructive actions (delete, discard). */
export const danger = "#FF3B30";
