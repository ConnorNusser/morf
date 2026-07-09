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
| Per-session rewards | `sessionRewards.ts` (`buildRewardSnapshot` before/after → `computeSessionRewards` diff) |
| Surprise bonuses | `sessionBonuses.ts` (variable-reward callouts from the snapshot diff — must be true facts, never invented) |
| Goal gradient | `nextUnlocks.ts` (`computeNextUnlocks` — nearest visible locked achievements, ≥40% progress only) |
| Muscle / heatmap | `muscleMastery.ts`, `trainingHeatmap.ts` |
| Profile icons | `profileIcons.ts` (unlocks gated by achievements) |

## Conventions

- **Add an achievement** by extending the matching `compute…Achievements` function *and* registering copy/rarity in `achievementMeta.ts` (+ an emblem in `achievementEmblems.ts` if it has one). An achievement with no meta renders blank.
- **Session rewards are diff-based**: snapshot state before a workout and after, then `computeSessionRewards(before, after)` surfaces what changed (new PRs, unlocks) — used by `WorkoutLaunchContext` for the post-workout celebration.
- **Tiers are percentile-driven**, not XP-driven — `getTierBandProgress(percentile)` maps a strength percentile to a tier band. Percentiles come from `lib/services` sync / `strengthStandards.ts`, not from this directory.
- Weights are lbs internally in the compute functions (`computeStrengthFeats` takes `prsLbs`); convert for display at the edge.

## Tests

Root `__tests__/achievementAttribution.test.ts` and `__tests__/oneRmEstimate.test.ts` exercise this layer. Because everything is pure, prefer a unit test over manual verification — `npx jest achievementAttribution` after changing achievement logic.
