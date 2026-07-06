// The app's single type scale, anchored to the two reference screens: the
// Career section (profile tab) and the Routines/workout page. Every screen
// maps its text to one of these roles instead of inventing sizes, so the
// tabs read as one system.
//
// Roles, smallest to largest:
export const type = {
  /** The floor: micro-labels, fine print, and secondary row text. */
  meta: 13,
  /** Primary row and paragraph text. */
  body: 15,
  /** Inline stat values and emphasized numbers. */
  emphasis: 16,
  /** Card titles and button labels. */
  title: 17,
  /** Section headings. */
  heading: 20,
  /** Big per-card stat number. */
  statHero: 32,
  /** Tab screen title. */
  screenTitle: 34,
  /** The one headline number on a screen (Career percentile). */
  hero: 36,
} as const;

/** Comfortable line height for a given role size (multi-line text). */
export const lineHeightFor = (size: number): number => Math.round(size * 1.35);
