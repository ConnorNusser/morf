// The app's single type scale. Roles, smallest to largest:
export const type = {
  meta: 14, // floor: micro-labels, fine print, secondary row text
  body: 16,
  emphasis: 18, // inline stat values, emphasized numbers
  title: 20, // card titles, button labels
  heading: 22,
  statHero: 26,
  screenTitle: 30,
  hero: 30, // the one headline number on a screen (Career percentile)
  header: 38,
} as const;

export const lineHeightFor = (size: number): number => Math.round(size * 1.35);
