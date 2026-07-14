# League visual — iteration judge spec

The ratchet for improving `components/home/league/` one pass at a time. A pass
lands only if it **wins a pairwise comparison against the previous pass** on
this rubric, rendered from the same fixture data (the loop script's mocked
week). Ties or losses get reverted. This replaces style-conformance judging —
conformance polishes, it never improves.

## Fixtures (hold constant across passes)

- The loop script's mocked 4-member week (leader with 2 PRs, you at #2 with
  1 PR + chase, a mid pack, a minimal week).
- Two captures per pass: board closed-state screenshot + a screen recording of
  open → expand you → expand leader → collapse (Playwright video).
- The automated contrast audit table (see below).

## Rubric — score each 1–5, compare pass N vs N-1

1. **Snap.** Every transition ≤ 250ms or a spring with visible overshoot;
   nothing eases longer than 800ms; interaction feedback lands within one
   frame of the tap. Motion must explain causality (points count *because*
   the row arrived; the bar sweeps *because* the gap exists). Dead time or
   floaty easing loses.
2. **Contrast.** The audit reports every text node's WCAG ratio against its
   effective background. Hard floor: nothing readable-on-purpose below
   4.5:1; deliberately-faint metadata may sit at 3:1+ but never below.
   A pass that lowers the worst-offender ratio loses automatically.
3. **Focus.** Squint test on the screenshot: exactly one glowing/hero moment
   per viewport; the eye path is rank → name → points with no detours.
4. **Character, earned.** At least one detail a template wouldn't have (chase
   bar, count-up, aura) — and zero flair that doesn't carry information.
   Decoration without meaning loses the dimension outright.
5. **Minimalism & space.** Every element must justify itself; a pass that
   removes an element without losing information wins ties. Useful content
   per viewport-height must not decrease across passes — space usage should
   improve over time (Connor, 2026-07-14).

## Loop mechanics

1. Make ONE coherent change-set (motion pass, contrast pass, hierarchy pass —
   not all at once).
2. `node <scratchpad>/league-loop.js` → screenshot + video + contrast table.
3. Judge pairwise vs the previous pass's artifacts on the five dimensions.
4. Win → commit with the scores in the message. Lose → revert, write down why
   in this file under Learnings.
5. Never change the fixtures and the rubric in the same pass.

## Learnings

- 2026-07-14 (pass 6, staff-crit): judge the EDGE-CASE screenshot, not the rich
  fixture — a no-PR week collapsed points/lbs/bar into one number three times
  and the rich mock never showed it. Sub-lines must never re-encode the metric
  column beside them. Affordances must be visible before the tap (caret).
  Surface boxes imply tappability — flat unless interactive. An element that
  exists only in an edge case (empty gold channel) should become that state's
  call to action, not silently vanish.

- 2026-07-14 (pass 5): gauges are measurements, not objects — an underdamped
  spring on the rank ring (damping ratio 0.73) overshoots and swings back,
  reading as error ("swooping"). Springs are for spatial movement only; data
  sweeps get one emphasized-decelerate timing curve. A progress bar must earn
  its pixels: share-of-leader alone duplicated the points column; width ×
  composition (volume vs PR split) made it the densest element on the row.

- 2026-07-13: style-conformance judging ("matches the house style") converges
  on a tasteful list and stalls — judge *improvement*, not conformance.
- 2026-07-14: `ink.hairline` (8% text) is invisible as a row divider on the
  league background; `docs/flat-contrast.md` already said faint page elements
  need 12–18% — use `ink.ghost`+.
- 2026-07-14 (pass 1, 3–0–2 vs baseline): the `faint` tone (30%) measures
  2.4:1 — below even the metadata floor. League surfaces use `muted`+ for
  metadata and `secondary`+ for anything informational (ranks!). Remaining
  known offender: TierBadge's internal 12px tier letter at 2.7:1 — app-wide
  component, fix belongs in components/TierBadge.tsx, not here.
- The contrast auditor needs the occlusion filter (elementFromPoint) or the
  home screen behind the modal pollutes the table.
- 2026-07-14 (pass 2, 4-0-1): reanimated `Keyframe` entrances break flow layout
  on react-native-web (siblings overlap) — use shared-value wrappers
  (FadeSlideIn) for anything the loop must render. Redesign pass: WHOOP hero
  (ring + numeral) + Spotify chart rows beat decorated-list layouts on
  focus/character/space simultaneously — data-forward structure IS the flair.
- 2026-07-14 (pass 3, 4-0-1): count-up "funk" was width reflow — reserve the
  numeral's final width with an invisible ghost and animate an absolute
  overlay. Expand snap needs a measured-height Collapse (animated height
  pushes siblings smoothly); {cond && <View>} always snaps. On-card (surface)
  text needs one ink step brighter than on-background text — muted drops to
  3.2 on surface. TierBadge letters now lighten toward white (fixed app-wide).
