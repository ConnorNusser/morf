// The app's single type scale, anchored to the two reference screens: the
// Career section (profile tab) and the Routines/workout page. Every screen
// maps its text to one of these roles instead of inventing sizes, so the
// tabs read as one system.
//
// Roles, smallest to largest:
export const type = {
  /** The floor: micro-labels, fine print, and secondary row text. */
  meta: 15,
  /** Primary row and paragraph text. */
  body: 18,
  /** Inline stat values and emphasized numbers. */
  emphasis: 19,
  /** Card titles and button labels. */
  title: 20,
  /** Section headings. */
  heading: 24,
  /** Big per-card stat number. */
  statHero: 38,
  /** Tab screen title. */
  screenTitle: 41,
  /** The one headline number on a screen (Career percentile). */
  hero: 43,
} as const;

/** Comfortable line height for a given role size (multi-line text). */
export const lineHeightFor = (size: number): number => Math.round(size * 1.35);
