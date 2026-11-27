# lib/gamification — XP, tiers, achievements, PRs

The reward layer. **Everything here is a pure function of workout history** (`GeneratedWorkout[]`) plus the user's strength percentile. There are **no stored counters** to keep in sync — recompute from history, don't persist derived state. This is why the whole directory is node-testable.

## The pipeline

```
history (GeneratedWorkout[])
   │
   ├─ computeCareerStats(...)        → CareerStats   (lifetime totals, heaviest sets)   ← foundation
   ├─ computeMainLiftPRs(...)        → LiftPR[]       (per main lift)
   ├─ computeBehavioralSignals(...)  → BehavioralSignals (streaks, timing, habits)
   │
   └─ achievements are derived from the above:
        computeAchievements(stats, overallPercentile)   → Achievement[]  (core categories)
        computeStrengthFeats(prsLbs)                     → Achievement[]  (total-club tiers)
        computeStrengthMilestones(prs, bodyWeight)       → Achievement[]  (bodyweight ratios)
        computeNicheAchievements(signals)                → Achievement[]  (behavioral)
```

`Achievement` categories: `consistency | volume | strength | milestone | special`. Merge the four `compute…Achievements` outputs to get the full set; `unlockedIds()` / `newlyUnlocked(list, seenIds)` diff against what the user has already seen (seen-ids are persisted, the achievements themselves are not).

## Files by concern

| Concern | Files |
| --- | --- |
| Lifetime stats | `careerStats.ts` (`computeCareerStats`, `formatCompact`, `volumeComparison`), `careerData.ts` |
| PRs | `personalRecords.ts` (`computeMainLiftPRs → LiftPR[]`) |
| Achievements | `achievements.ts` (core), `strengthFeats.ts`, `strengthMilestones.ts`, `nicheAchievements.ts`, `behavioralSignals.ts` |
| Achievement presentation | `achievementMeta.ts` (`achievementMeta(id)`), `achievementEmblems.ts` (`emblemFor(id)`), `rarity.ts` |
| Tiers | `tierTimeline.ts` (`computeTierTimeline`, `getTierBandProgress(percentile)`) |
| Per-session rewards | `sessionRewards.ts` (`buildRewardSnapshot` before/after → `computeSessionRewards` diff; includes `xpGained`, `leveledUp`, `regionTierUps`) |
| XP / level | `xp.ts` (`computeXpLedger(history, ctx)` — retroactive, rules in `XP_RULES`), `levelCurve.ts` (`levelForXp`; next level costs 150 + 40·(L−1); `title` = rank name), `ranks.ts` (competitive ladder, 9 metal tiers: Bronze 1–9, Silver 10–19, Gold, Platinum, Emerald, Diamond 50–59, then Master 60–69, Grandmaster 70–79, Challenger 80+. The six lower tiers split into divisions III/II/I starting at tier min, +3, +6 (Bronze 3/3/3, others 3/3/4); master tiers have none. `rankForLevel` → `Rank` (`name` "Gold II", `tier`, `division`), `tierForLevel`, `nextRank`/`nextTier`, `rankStep`/`rankStepCount` (divisions, or levels on master tiers), `isRankUp` (division or tier change) vs `isTierUp` (metal change only), per-tier gradients blended across the tier via `rankGradientForLevel`/`rankAccentForLevel`/`rankShineForLevel`; rendered by `components/gamification/RankEmblem.tsx`, whose silhouette upgrades per tier with 1–3 division chevrons) |
| Level presentation | `levelDisplay.ts` (pill/breakdown copy, `xpBarSweep`, `decideLevelIntro` one-time intro gate; seen flag + `lastSeenLevel` in storage) |
| Body graph | `bodyGraph.ts` (`computeBodyGraph` → 16 `RegionState`s: strength tier from rankable primary lifts, set-weighted; sets/week volume for every region; `findLaggingRegion`). Regions + exercise map live in `lib/data/bodyRegions.ts` / `exerciseRegions.ts` |
| Body graph presentation | `bodyGraphDisplay.ts` (`regionFill`, `formatNextTierLine`, `setsBar`, `laggingLine`, `formatTierUp`, `trainRegionRequest`); `careerData.ts` `loadBodyGraphData()` is the light loader behind `hooks/useBodyGraph`. UI: `components/gamification/BodyGraph.tsx` (+ `bodyGraphPaths.ts`), `MuscleDetailSheet.tsx`, `MuscleTierUpRow.tsx`, `components/home/LaggingMuscleCard.tsx` |
| Heatmap | `trainingHeatmap.ts` |
| Profile icons | `profileIcons.ts` (unlocks gated by achievements) |

## Conventions

- **Add an achievement** by extending the matching `compute…Achievements` function *and* registering copy/rarity in `achievementMeta.ts` (+ an emblem in `achievementEmblems.ts` if it has one). An achievement with no meta renders blank.
- **Session rewards are diff-based**: snapshot state before a workout and after, then `computeSessionRewards(before, after)` surfaces what changed (new PRs, unlocks) — used by `WorkoutLaunchContext` for the post-workout celebration.
- **Level is XP-driven, tier is percentile-driven** — two separate meters. XP only goes up; tier-up XP uses the fixed main-lift set so the dashboard's hidden-lift filter never changes XP.
- **New catalog exercise → add it to `lib/data/exerciseRegions.ts`**; `__tests__/bodyGraph.test.ts` fails if any catalog id is missing or its primary regions don't roll up to its muscle groups.
- **Tiers are percentile-driven**, not XP-driven — `getTierBandProgress(percentile)` maps a strength percentile to a tier band. Percentiles come from `lib/services` sync / `strengthStandards.ts`, not from this directory.
- Weights are lbs internally in the compute functions (`computeStrengthFeats` takes `prsLbs`); convert for display at the edge.

## Tests

Root `__tests__/achievementAttribution.test.ts` and `__tests__/oneRmEstimate.test.ts` exercise this layer. Because everything is pure, prefer a unit test over manual verification — `npx jest achievementAttribution` after changing achievement logic.
