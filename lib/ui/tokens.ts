import { Theme } from "./theme";

// Shared formatting tokens. Typography roles live in lib/ui/typography.ts.

// Ink: text-emphasis ramp — one base color (theme text) at named strengths.
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

// 12% wash of an accent color — for tier badges, delta pills, tinted chips.
export const tint = (color: string): string => color + "1F";

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  section: 24,
} as const;

// Shape roles. Corner radii come from the element's role.
export const radius = {
  badge: 6, // micro badges: tier tags, delta pills, COUNT chips
  control: 10, // search bars, chips, small buttons
  card: 12,
  pill: 999,
} as const;

// Horizontal gutter shared by every tab screen.
export const screenGutter = 20;

// Bottom over-scroll under the floating tab bar.
export const scrollBottom = 120;

// Interior padding for "hero panel" surfaces (History hub, Career); everything
// else uses space.lg — the one named exception.
export const panelPad = 18;

export const track = {
  caps: 1, // uppercase micro-labels (SectionLabel)
  display: -0.5, // large display numbers (statHero and up)
} as const;

// Semantic accents, theme-independent by design.
export const trend = {
  up: "#00C85C",
  down: "#FF6B6B",
} as const;

export const danger = "#FF3B30";
