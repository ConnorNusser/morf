# Flat design — contrast & selection determination

We dropped the "contrast card" (the shared `Card` surface fill + border) so content
sits flat on the page. This is the determination of **how to work with contrast now**,
what the flatten broke, and the status of each fix. It's the reference for any new UI.

## The key fact about our theme

`background #121215` is only marginally darker than `surface #1C1C1F` (~10/channel).
So the old "raised card" look leaned on the **border**, not the fill. Two consequences:

1. Losing the border (not the fill) is the real regression — a flat card with no
   border has almost no separation from the page.
2. Because `background` is *darker* than `surface`, **light overlays read well** and
   **`border`-colored or low-alpha elements disappear**. So the fix for a faint element
   is almost always "use `text + 'alpha'`", not "use `border`".

## The strategy (three tiers)

1. **Display cards** → flat. No fill/border/shadow; content separated by spacing and
   section labels. Full-width (no card horizontal padding). This is the shared `Card`.
2. **Interactive / selectable / grouping surfaces** → keep contrast. A selectable
   option, picker item, or toggle row gets a subtle `surface` fill + a full-alpha
   `border`; the **selected** one gets a `primary` ring (2px) + a faint `primary` tint
   (`primary + '14'`). Inputs, sheets, and modals keep `surface` (a flat modal merges
   into its backdrop). Buttons keep their affordance.
3. **Inner elements that used the surface as a backdrop** (heatmap cells, progress
   tracks, dividers, skeleton shimmer, thin separators) → give them contrast against
   `background` directly: `text + '12'`–`'18'` for faint fills/tracks, a `surface` fill
   for "empty" grid cells, never `border` or low-alpha black.

## What broke, and status

**Selection (fixed):**
- Theme picker (`ThemeEvolutionSection`) — options had no boundary; only the selected
  one kept a border. Now each option = `surface` + border, current = `primary` ring +
  tint. ✅
- `LiftDisplayPreferences` rows — shown = `primary` tint + `primary` border, hidden =
  `surface` + border. ✅
- `WeeklyGoalCard` goal pills — unselected got a `surface` fill (were transparent). ✅
- Equipment/lift/weight-unit filters, Career tabs/rarity chips — kept their inline
  `surface` fills; never broke. ✅ (no change)

**Inner elements (fixed):**
- Career heatmap empty cells (profile + modal) — were `border`@~0.5 (invisible); now a
  `surface` fill so empty days read as subtle squares. ✅
- `CareerSection` progress tracks + dividers — `border` → `text + '12'`/`'15'`. ✅
- `SkeletonCard` shimmer — `border`@0.3 → `text + '18'`. ✅
- Invisible black separators (`OverallStrengthModal`, `StrengthRadarCard`,
  `UserProfileModal`) — `#00000010` → `rgba(255,255,255,0.08)`. ✅

**Consistency (fixed):**
- Profile "Set Username" CTA + home "View Leaderboards" — flattened to match. ✅

## Deliberate decisions / not-done

- **Settings-section grouping** (profile) relies on each section's own header +
  spacing rather than group boxes — the flat, iOS-settings-style choice. Left as-is.
- **Still-boxed display cards not yet flattened:** History Sessions-feed recap cards,
  `CareerModal` stat tiles / PR / muscle cards, `ExercisesSection` /
  `CustomExercisesSection` inner list. These are internally consistent within their own
  screen and, for the dense stat grids, the boxes aid separation. Flatten them only if
  we want the whole app uniformly flat — a follow-up pass, not a contrast bug.

## Rule of thumb for new UI

Flat by default. If an element is **selectable**, give it `surface` + border and a
`primary` ring when active. If it's a **faint indicator on the page** (track, divider,
empty cell, shimmer), color it with `text + 'alpha'`, not `border`.
