# UI consistency audit — home / history / workout

2026-07-06, on `refactor/ui-consistency`. Four-dimension audit (type, spacing,
buttons, over-engineering) of the three tabs and everything they render.
Ranked by user-visible impact; each finding carries the decision Phase 2 applies.
Ground truth: History is the most-designed, most-converged tree — where screens
disagree, History's grammar wins unless noted.

## Headline findings

1. **The workout tab is a different app.** Zero token imports: 172 raw
   `fontSize` literals (incl. sub-14px: 10, 11, 12, 12.5, 13), 123 raw
   alpha-suffix colors, 43 no-op `backgroundColor:'transparent'`, radii
   6/8/9/10/12/14/16/19/20/22/24 all present. Its screen title is 18px where
   home/history use 30px. → Full token migration (Phase 2e).
2. **Three screens, three frames.** Gutters: history 20 / home 20+24 header /
   workout 12–20 depending on block. Top treatment: SafeAreaView (history,
   workout) vs `insets.top - 2` fudge (home). Section rhythm: 24 (history) vs
   12-gap-plus-child-margins (home) vs 22 (workout). → One frame:
   SafeAreaView top, `screenGutter`, sections carry no external margin, parent
   applies `space.section`; `scrollBottom` token (120).
3. **~50 interactive treatments, 4 needed.** Canonical set:
   - **C1 primary pill CTA** — `radius.pill`, semiBold label. Two sanctioned
     fills: *hero-ink* (StartButton, workout Quick-start — `colors.text` fill)
     and *primary* (modal/inline CTAs). Canonical impl: re-cut `Button.tsx`.
   - **C2 secondary bordered** — 1px border, surface/transparent fill,
     `radius.card`, incl. tappable choice/stat cards.
   - **C3 quiet row** — NavRow, hairline list rows w/ chevron, inline text
     buttons (See all / Cancel / dismiss).
   - **C4 chip** — `Chip.tsx` (already canonical; gets minHeight + hitSlop).
   Plus one utility: **IconButton** re-cut with built-in ≥44pt hit area,
   replacing ~12 hand-rolled icon touchables. Exceptions (named, not styles):
   NumberPad keys, EditableWorkout grid cells, SegmentedTabs, tab bar, day-dial
   pickers (unify the two copies), workout lbs/kg thumb segment.
4. **Dead code, verified:** `StrengthHistoryCard.tsx` (268 lines, zero refs),
   `history/HistoryHero.tsx` + `history/WorkoutCard.tsx` (only comment refs);
   `Card.variant` ignored by its implementation but passed at ~25 sites;
   23 dead style keys in OverallStrengthModal (+1 in RoutineProgressModal);
   dead props on ProgressBar (4), Chip (size/disabled), Button (ghost/subtle),
   IconButton (variant/size/iconSize), DashboardHeader (3 unused stat fields).

## Type (Phase 2a decisions)

- **Semantic roles, one treatment each** (History majority): screen title =
  `screenTitle`/bold; section label = `SectionLabel`; modal title =
  `title`/semiBold; row label = `body`/semiBold; inline stat = `emphasis`/bold
  with `meta`/**muted** unit suffix; stat label = `meta`/**faint** (StatStrip);
  timestamps = `meta`/secondary, never uppercase (caps are SectionLabel-only).
- Home nudges: OverallStatsCard's 16px eyebrow → SectionLabel;
  PowerliftingTotal total medium → bold (matches sibling stat block);
  WeeklyOverview's hand-rolled stat row → StatStrip; WeeklyGoalCard count and
  workout timer digits gain the stat weight.
- Workout title: keep the compact centered nav-bar layout (personality), but
  tokenize as `title`/semiBold. *Flagged for Connor: optionally adopt the
  big-left-title grammar later.*
- letterSpacing tokens: `track.caps` (1, lives in SectionLabel) and
  `track.display` (−0.5 for statHero+); delete the per-file 0.3/0.4/0.5/1.5/2.
  DashboardHeader's −1 on the 30px title aligns to −0.5.
- Multi-line paragraphs use `lineHeightFor(type.x)`; single-line lineHeight
  overrides get deleted.
- Floor rule: nothing under 14. Snap map 10–13→meta, 15→body, 17→emphasis,
  24–28→statHero. NumberPad's 36 readout stays a named exception.

## Spacing (Phase 2b decisions)

- Frame per #2 above. DashboardHeader's +4 header inset kept as an optical
  alignment — named, not incidental.
- Card interiors: `space.lg` (16). New named token `panelPad` (18) for the
  three deliberate hero panels (history hub, Career section) — snapping those
  would visibly hurt the two best-composed surfaces.
- Border taxonomy: **hairline** for passive surfaces/separators, **1px** for
  tappable controls. Fix ExerciseCard's 1px row separator; workout tree
  follows.
- List rows: 16 vertical. Named exception: EditableWorkout's dense entry grid
  (8) — equalizing to 16 would balloon the editor.
- Gaps: chips/icon-to-label = `space.sm` (8); value-to-unit = `space.xs`.
- Retire `lib/ui/styles.ts` `gap` module (two spacing systems); `layout.flex1`
  stays.
- TodayCard's `marginTop: -12` hack (cancels Card's default pad) → fix at the
  source.

## Buttons & tap targets (Phase 2c decisions)

- `Button.tsx` → canonical C1/C2: primary = pill + sanctioned fill, secondary =
  card radius + border; sizes from the type scale (meta/body/emphasis); kill
  ghost/subtle; drop `currentTheme.borderRadius` and hex-suffix alphas.
- `IconButton.tsx` → collapse API (icon/onPress/iconColor/style), radii →
  `radius.control`, built-in hitSlop to ≥44pt; adopt at ~12 hand-rolled sites
  (TodayCard pager, WorkoutDetailModal header, MonthlyTrends close/page,
  ExerciseHistoryModal ✕, workout mic/send/adjust/steppers, modal closes).
- `Chip.tsx`: minHeight/hitSlop for ≥44 effective; migrate LiftDisplayFilter,
  NumberPad increment chips, PlanBuilder questionChips, RoutineProgress
  clearChip onto it.
- Modal close grammar: ✕ icon top-right everywhere ("Done" text and
  logo-variants retire).
- Tokens gain semantic colors: `trend.up` `#00C85C`, `trend.down` `#FF6B6B`
  (history-tree majority; replaces 4 competing green/red pairs), `danger`
  `#FF3B30`.
- Worst tap targets fixed in the primitives + call sites listed in the audit
  (search-clear ✕s, RoutineEditor steppers, EditableWorkout done-toggle,
  SegmentedTabs, LiftDisplayFilter expander).

## Over-engineering (Phase 2d decisions)

- Delete: StrengthHistoryCard, HistoryHero, history/WorkoutCard;
  OverallStrengthModal's 23 dead keys; RoutineProgressModal.deloadButton;
  `Card.variant` + call-site props (+ vestigial `overflow:'hidden'`); dead
  props per #4 above; the 44 in-surface `backgroundColor:'transparent'` no-ops.
- `Spacer` height becomes optional (or inline it); DashboardHeader's
  HeaderStats interface shrinks to what it reads.
- Out of scope, noted: feed tree + profile tree carry the same debt; Themed
  View is now a pass-through alias (retire eventually).

## Commit plan

2a type (home/history nudges + tokens) → 2b spacing → 2c buttons/primitives →
2d dead code → 2e workout-tree migration (uses the final primitives) → verify:
tsc/eslint/jest + before/after renders of all three tabs.
