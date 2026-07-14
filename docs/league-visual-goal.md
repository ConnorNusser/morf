# League board — visual goal ("un-AI" spec)

The judge spec for iterating on `components/home/league/`. The failure mode we're
designing away from: the generic dark-dashboard look — rainbow stat bars, uniform
rounded rows, centered template headers, floating ALL-CAPS labels. Morf's board
should be recognizably Morf at a squint.

## Rules (score a candidate against these)

1. **One neon stroke.** Theme `primary` is the only saturated accent on the
   screen. Gold (`TIER_COLORS.S`) appears only on PR/champion moments. Nothing
   else gets a hue. A screenshot with 3+ accent colors fails.
2. **Flat.** Rows sit on the page — no card fills, borders, or gradient washes.
   The one exception is selection semantics per `docs/flat-contrast.md`: the
   viewer's own row may carry a `primary` tint + rule. Separation comes from
   spacing and hairlines (`ink.hairline`), never boxes.
3. **Product-native motifs.** Day pips echo the home "THIS WEEK" dot row; section
   headings use `SectionLabel`; pixel emblems are the only illustration; hex is
   the badge shape if a badge is ever needed. If an element could be screenshotted
   into any fitness app unchanged, it's wrong.
4. **Editorial hierarchy.** The rank digit column carries the ladder; exactly one
   oversized moment per screen (the leader). Everything else stays quiet. Uniform
   visual weight across rows fails.
5. **Receipts stay.** Every point remains traceable (tap → itemized receipt,
   legend prices every action) — legibility was fought for; don't trade it back.
6. **Tokens only.** Type/tones/spacing/radius from `docs/ui-conventions.md`; no
   raw alphas, no one-off sizes.

## Loop

Metro (worktree) serves web on :8081. `node <scratchpad>/league-loop.js` mocks
identity + `get_league_week` with a rich week and screenshots the board in ~10s.
Edit → run → look → repeat. Screens land in `<scratchpad>/shots/2-board.png`.
