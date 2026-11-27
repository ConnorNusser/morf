# Spec: a reward hit after every workout

**Goal:** every logged workout ends with at least one clear "you got better" moment, delivered fast, felt (haptics and motion), and honest (earned from real data).

**Status:** proposal. Builds on what already exists: `sessionRewards.ts` (a diff of the snapshot before and after the workout), the `xp.ts` ledger, `WorkoutCompleteScreen`, letter ranks (`ranks.ts`), strength tiers, the league, and haptics (`playHapticFeedback`).

---

## 1. Problem

Today the reward is lumpy. A workout with a PR, an achievement or a level-up gets a celebration. A normal workout, which is most of them, gets a recap and an XP bar. Rewards that arrive unpredictably keep people coming back, but only if every session also gets a reliable small win. Right now the baseline session has no win of its own.

## 2. Principles

1. **A guaranteed win.** Every completed session (3 or more working sets) produces at least one "win card." The winner is the best available item from the hierarchy in §3.
2. **Honest.** Each win is computed from real history. No fake "great job" when nothing changed.
3. **Fast, then deep.** The first win appears within about 1 second of finishing, before the summary. Details come after.
4. **Felt, not read.** Each reward has a haptic signature and a motion beat. Text is secondary.
5. **Variable on top of fixed.** The guaranteed win is predictable. On top of it, about 20–30% of sessions roll a bonus (§5).
6. **One visual system.** All rewards use the existing language: letter grades, the strength card, `SoftBar`, flat rows. No new palettes.

## 3. The win hierarchy

Pick the highest-ranked win the session earned and show it first, as the hero. Show up to 2 more below it.

| Rank | Win | Source | Example copy |
|---|---|---|---|
| 1 | Strength tier up | percentile crossed a band (`computeSessionRewards`) | "C- → C" |
| 2 | Level rank up | `isRankUp` | "Ranked up to E+" |
| 3 | PR (e1RM) | `newPRs` | "Deadlift 259 → 271 lb" |
| 4 | Rep PR / volume PR on a lift | **new**: best reps at a weight, or best session volume for the lift | "8 reps at 225, a new best" |
| 5 | Achievement unlocked | `newAchievements` | existing tile |
| 6 | Percentile moved | **new**: overall percentile change (≥0.1) | "+0.4 percentile · 6.6 to C" |
| 7 | Weekly goal progress / hit | `weeklyGoal.ts` | "3 of 4 this week · one to go" |
| 8 | Streak kept | `streak.ts` | "2-week streak · ×1.05 XP" |
| 9 | Session record | **new**: most sets / longest / heaviest session this month | "Biggest session this month" |
| 10 | Floor (always available) | XP gained + level progress | "+65 XP · 75 to Lv 5" |

Rule: rank 10 always exists, so no session ends with nothing.

## 4. The end-of-workout sequence (about 4 s, skippable)

1. **0.0 s: Impact.** The hero win card scales in, with the haptic for its rank (§6).
2. **0.6 s: Count-up.** The XP number counts up and `SoftBar` sweeps the level progress. If it crosses a level, the bar wraps with a second haptic.
3. **1.4 s: Secondary wins.** Up to 2 flat rows slide in, each with a light tick.
4. **2.0 s: Strength line.** The History-style strength card replays from the pre-workout percentile (already supported by `animateFrom`).
5. **2.5 s: Next goal.** One line naming the nearest goal ("7 percentile to C", "1 session to hit your week"). This line is what brings people back.
6. Tapping anywhere skips straight to the static summary.

## 5. Variable bonus (the "loot")

After a session there is a 25% chance of one bonus. It's weighted, with a pity timer that guarantees one at least every 4 sessions:

- **XP surge:** ×1.5 XP on this session, shown as a second count-up.
- **Lucky lift:** the next session's first PR earns double XP (shown on the Home card until it's used).
- **Rank shard:** +25% progress toward the next level rank.

Bonuses are deterministic per workout id (seeded), so they don't change if the history replays. Add them to the `xp.ts` ledger as their own rows to keep "no stored counters".

## 6. Haptics and motion

| Moment | Haptic | Motion |
|---|---|---|
| Tier up / rank up | `success` and a second `heavy` at +120 ms | badge scales 0.6→1.08→1, 400 ms spring |
| PR | `success` | number rolls up, row slides in |
| Achievement | `medium` | tile flips in |
| Percentile moved / goal / streak | `light` | row slide |
| XP count-up end | `selection` | bar settles |
| Level wrap | `heavy` | bar empties and refills |

Respect Reduce Motion: keep haptics, skip scale and roll animations.

## 7. Between sessions (anticipation)

- **Home:** the strength card shows a soft "next" hint (§4.5). The level pill shows a small dot when a bonus from §5 is waiting.
- **Notifications** (`retentionNotificationService`): at most one a day, and only with a real number in it. For example: "You're 3 sets from your weekly goal," or "Deadlift PR window: you've added 12 lb in 3 weeks."
- **League:** an overtake notification if someone passes you, which already exists in `overtakeWatch.ts`.

## 8. Measurement

- **Primary:** D7 and D30 retention, and sessions per active user per week.
- **Secondary:** the share of sessions with a reward rank of 9 or better (target ≥ 60%), how often people skip the sequence, and share-card taps.
- Ship behind a flag (`FEATURE_FLAGS.rewardSequence`) so the variable bonus can be A/B tested separately from the guaranteed win.

## 9. Build plan

1. **Pure logic:** add `lib/gamification/sessionWins.ts`, `rankSessionWins(before, after) → Win[]`. It covers ranks 4, 6 and 9 as new detectors, reuses the existing diff for the rest, and has unit tests (domain logic).
2. **UI:** a `WinCard` and `WinRow` in the current flat style. Re-order `WorkoutCompleteScreen` to follow the §4 sequence.
3. **Bonus:** seeded rolls in `xp.ts` (ledger rows), plus the "Lucky lift" state on Home.
4. **Haptics map** in one helper (`lib/ui/rewardHaptics.ts`) so every reward uses the §6 table.
5. **Next-goal line:** a shared helper, used on the complete screen and on the Home card.

## 10. Out of scope

Real-money rewards, streak freezes for purchase, leaderboards for strangers beyond the league, and any reward that isn't tied to logged training.
