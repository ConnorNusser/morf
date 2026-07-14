# Leagues v1 — "This Week" league

Spec for the first shippable slice of the rivalry initiative: a weekly league of
**all recently-active users**, scored on recent effort and personal progress,
replacing the stale all-time leaderboard as the competitive surface. Seasons,
campaigns, promotion tiers, and cohort partitioning are explicitly v2+ (see
Non-goals).

Scope decision (2026-07-13): at current scale (~210 users, ~5–7 weekly actives,
7 users with any friend) a friends-only league renders an empty state for 97%
of users, and there aren't enough actives to fill random cohorts. So v1 is one
global board of everyone active this week — it's automatically populated for
every user, needs no partitioning math, and friends get badged within it.
Friend-aware cohorts / stranger-fill ("ghost challengers") become relevant only
past ~30+ weekly actives; revisit then.

## Why (one paragraph of context)

The current boards sort on lifetime-best 1RM (`user_best_lifts` is a max-ever
view), so a friend who peaked a year ago permanently outranks one improving now,
and rank movement is suppressed entirely on the friends scope. Research on
competitive fitness/habit loops (Duolingo leagues, Strava challenges, WHOOP
teams, Stanford WWW'17 walking-competition study, leaderboard-design literature)
converges on: time-boxed windows, effort + relative-progress scoring normalized
to each user's own baseline, modest attainable targets, no last-place shaming,
and competence feedback alongside rank. Hevy — the closest lifting comparable —
has exactly our stale all-time-board failure mode and no challenge system, so
this is a differentiation opening. Full cited findings live in the research
report from 2026-07-13 (see PR description).

## Product spec

### Week semantics

- A league week is **Monday–Sunday in the viewer's local time**, the same
  boundary as `weekStart` in `lib/utils/utils.ts` (used by `weeklyGoal.ts` and
  `streak.ts`). The client computes `[weekStart, weekStart + 7d)` and passes
  both bounds to the backend; all members are measured in the viewer's window.
- Consequence: two friends in different timezones can see slightly different
  boards near the boundary. Accepted for v1 — standings converge within hours
  and there are no cross-viewer rewards to reconcile.

### The league

- **Everyone active this week is the league.** Cohort = the viewer + every user
  with ≥1 `user_workouts` row in the window (no league entity, no join/lobby
  mechanics, no partitioning). Friends are badged in the list, not separated.
- The RPC caps membership at the top 100 by sessions as a payload guard —
  irrelevant at current scale, prevents surprise later.
- Scoring resets every Monday. There is no carryover, promotion, or season
  aggregation in v1.

### Iconography & tone

- **No emojis anywhere** — not in UI copy, not in push notification copy.
- **No Ionicons on league surfaces.** The icon language is the existing pixel
  achievement emblems (`assets/achievements/*.png` via
  `lib/gamification/achievementEmblems.ts` / `emblemFor`) — they're already the
  most distinctive art in the app and they make the league read as part of the
  gamification world rather than another settings-grade list. Immediate uses:
  `trophy` for the reigning champion marker, `sword` for the rival line,
  `flame` for active-day dots in breakdowns.
- If a spot needs an emblem that doesn't exist (e.g. a crown or laurel for
  multi-week champions), generate it through the established pixel pipeline
  (Gemini → ImageMagick, same style as the existing set) rather than reaching
  for any icon font. v1 should need zero or near-zero new art.
- Tone: the league is a game, and copy can be playful ("Set the pace", "N days
  left") — but flat and dry per the app voice, never exclamation-mark hype.

### Surfaces

**1. Home card (`LeagueCard`)** — replaces the current leaderboard entry point
on Home as the primary competitive touchpoint (the old LeaderboardModal remains
reachable from inside the league view).

- Shows: your rank among *active* members ("2nd of 5"), your points, and the
  nearest-rival line — gap to the person directly ahead ("14 pts behind Alex"),
  or your lead over the person behind when you're #1 ("8 pts ahead of Sam").
- One-line personal competence cue under the rank (e.g. "3 active days · 1 PR")
  so the card reads as progress even when losing.
- Tap → League view.

**2. League view (`LeagueBoard`)** — modal under `components/home/league/`.

> **Amendment (2026-07-13):** the default lens is the **Week Story** — the
> week's raw events (every session and PR, from `get_league_events`, migration
> 012) replayed chronologically through the scoring rules by
> `lib/leagues/story.ts`, so each moment carries the points it earned, goal
> bonuses land as their own beat, and *sole* lead changes are called out on the
> event that caused them. A one-line standings strip sits pinned above the
> story; tapping it (or the events RPC being unavailable) opens the ranked
> ladder described below.

- **Ranked list of active users only** (≥1 session this week), sorted by
  points desc, ties share rank (`rankByValue` semantics). At current scale the
  full list shows; there is **no last-place styling** — no arrows-down, no red,
  the bottom row renders identically to the middle. Inactive users simply
  aren't on the board — that's what kills the stale feel.
- **Resting friends row**: the viewer's friends with 0 sessions this week
  collapse into a single footer row ("Resting this week: Sam, Priya") —
  visible, not ranked, not shamed. Strangers with 0 sessions don't appear at
  all.
- **Per-row**: avatar, username, points, a friend badge when the row is one of
  the viewer's friends, and a compact breakdown strip (days • PRs • best
  gain %) so scores are legible, not a black box.
- **Reigning champion**: last week's winner carries the pixel `trophy` emblem
  next to their name all week (board + a "Last week: {username}" line in the
  header). Winning has to be visible to be worth chasing.
- **You bar** (bottom-pinned): rank, points, gap-to-ahead in points.
- **Personal panel** below the board: your points breakdown by source and a
  week-over-week comparison ("last week: 87 pts, 3 days"), the competence
  feedback the research says must accompany rank.
- **Tabs**: `This week` (default) | `All-time` — the all-time tab embeds the
  existing leaderboard content (global/country/friends scopes) so "who's
  strongest ever" stays answerable but stops being the default lens.
- **Empty/edge states**: <2 active users app-wide (viewer included) → board
  renders the viewer's own week + a "Set the pace" nudge instead of a
  competition frame. A friend-invite CTA sits in the board footer regardless —
  growing the graph is the point of the rivalry direction.

### Scoring

All scoring is computed **client-side in a pure function** from raw aggregates
returned by one RPC (see Backend). Constants live in a single `SCORING` object —
Connor tunes values there; everything below is a starting point.

| Source | Points | Cap | Rationale |
| --- | --- | --- | --- |
| Active day (≥1 session that day) | 10 | 4 days → 40 | Effort floor; capped at the weekly-goal default so it's attainable and two-a-days don't grind points (Strava: modest targets drive participation) |
| Exercise PR (new best e1RM on an exercise you'd lifted before this week) | 15 | 4 PRs → 60 | Inherently baseline-relative — a PR is personal, so a weaker friend earns these as easily as a stronger one (the WHOOP handicap principle) |
| Gain bonus per PR: `round(2 × min(gainPct, 10))` | ≤20 | top 2 gains → 40 | Rewards magnitude of progress, capped at +10% per lift so novice jumps and dirty e1RM outliers can't run away with the week |
| Goal-week bonus (active days ≥ 3) | 15 | once | Consistency capstone; 3 not 4 so a busy-week friend can still cash it |

- Realistic winning week ≈ 120–155 pts; a 3-day no-PR week ≈ 45 pts — close
  enough that consistency alone keeps you in the race, which is the point.
- **PR definition**: for user *u*, exercise *e*: `weekBest = max(estimated_1rm)`
  within the window, `priorBest = max(estimated_1rm)` before `weekStart`. PR iff
  `priorBest` exists and `weekBest > priorBest`. `gainPct = (weekBest − priorBest) / priorBest × 100`.
- **First-time exercises score 0** (no `priorBest`) — otherwise logging five new
  machines is free points. Shown in the breakdown as "new lifts" for flavor only.
- Only exercises that reach `user_lifts` count (catalog/rankable lifts — custom
  exercises don't sync), which also bounds the SQL.
- Volume and duration deliberately don't score in v1: both are grindable and
  favor whoever has the most gym time rather than progress.

### Notifications (rivalry loop)

One notification type in v1: **overtake**.

- After the finisher's `syncWorkout` completes, their client re-fetches league
  standings; any friend whose rank they just passed gets a push:
  `{username} just passed you in the weekly league` /
  `{points} pts to your {theirPoints}. {daysLeft} days left this week.`
  (No emoji — see Iconography & tone.)
- **Friends only.** The board contains strangers, but overtake pushes fire only
  between friends — pushing "X passed you" to a stranger is spam, and the token
  path we're reusing is friend-scoped anyway. Strangers experience the league
  passively (board position), friends get the rivalry loop.
- Delivery reuses the existing direct-token path in `notificationService`
  (`getFriendPushTokens`-style lookup filtered to the overtaken friend ids +
  `sendPushNotifications`, exactly as `notifyFriendsOfPR` does after its RPC).
- **Rate limit**: max one overtake push per (pair, day), guarded client-side via
  a storage key (`league_overtake_sent:{friendId}:{dateKey}`) under
  `STORAGE_KEYS`. No pushes on Monday before the first session (everyone is 0).
- Deep link: tapping opens Home with the league view presented (same param
  pattern as `/(tabs)?feed=1`, e.g. `/(tabs)?league=1`).
- Weekly kickoff/wrap-up notifications are deferred to v2 (they want the season
  layer to say anything meaningful).

### League achievements

League finishes feed the existing achievements system so wins accumulate into
permanent trophies. New defs in `lib/gamification/leagueAchievements.ts`
(same `Achievement` shape, merged at the call sites alongside
`computeNicheAchievements`):

| id | title | condition | rarity | emblem |
| --- | --- | --- | --- | --- |
| `league-first` | Contender | finish a league week with ≥1 active day | common | `sword` |
| `league-podium` | On the Board | finish top 3 | common | `bronzetrophy` |
| `league-win-1` | Champion | win a weekly league | rare | `trophy` |
| `league-win-3` | Back for More | 3 weekly wins | epic | `ornatetrophy` |
| `league-win-10` | Dynasty | 10 weekly wins | legendary | `cape` |
| `league-streak-3` | Undisputed | win 3 consecutive weeks | epic | `partyhat` |

- **Wins only count with ≥3 active participants** — you can't be champion of a
  league of one (or of you plus one inactive friend). Podiums require ≥4.
- Emblem mapping reuses existing pixel assets — zero new art for v1. If a
  dedicated crown/laurel gets generated later, remap `league-win-*` then.
- **Architecture wrinkle (deliberate exception):** every other achievement is a
  pure function of local history, but a league finish depends on *other users'*
  server data, so it can't be recomputed locally. When the client first loads
  the league surface after a week closes, it fetches the previous week's
  standings from the RPC, derives the user's final `{weekStart, rank, points,
  activeParticipants}`, and appends it to a local `LeagueWeekResult[]` under a
  new `STORAGE_KEYS` entry (`league_week_results`). Achievements compute from
  that stored array. One snapshot per week, written once, never mutated —
  append-only like `user_lifts`, so the no-drifting-counters spirit survives.
- Missed weeks (app not opened for a while): backfill up to 4 prior weeks on
  the same load — the RPC recomputes any window from append-only history.

## Backend

### Migration `supabase/migrations/011_league_week.sql`

One RPC returning **raw per-member aggregates** (no scoring in SQL — scoring
stays in `lib/` where it's testable and tunable without a migration):

```sql
create or replace function get_league_week(
  p_user_id uuid,
  p_week_start timestamptz,
  p_week_end timestamptz
)
returns table (
  user_id uuid,
  username text,
  profile_picture_url text,
  sessions int,          -- user_workouts rows in window
  active_days int,       -- distinct calendar days (UTC date of created_at) in window
  prs jsonb,             -- [{exercise_id, week_best, prior_best, gain_pct}] for PR'd exercises, gain desc, limit 8
  new_lifts int,         -- exercises lifted in-window with no prior history
  is_friend boolean      -- row user is a friend of p_user_id (drives badge + push scoping)
) language sql stable as $$
  with members as (
    select p_user_id as user_id
    union
    select user_id from user_workouts
    where created_at >= p_week_start and created_at < p_week_end
    group by user_id
    order by count(*) desc
    limit 100
  ),
  -- per member+exercise: best in window vs best before window, from user_lifts
  ...
$$;
```

Implementation notes:

- Members CTE = self + every user with a `user_workouts` row in the window
  (top 100 by session count as a payload guard). `is_friend` is a left join
  against `friends where user_id = p_user_id` — the table is bidirectional,
  one direction suffices.
- `prs` compares `max(estimated_1rm)` in `[p_week_start, p_week_end)` vs before
  `p_week_start` per `(user_id, exercise_id)` over append-only `user_lifts`,
  keeps rows where a prior best exists and is beaten, orders by `gain_pct`
  desc, limits 8 per member (scoring caps use ≤4, the extras feed the breakdown
  UI). `active_days` counts distinct `date(created_at)` from `user_workouts`.
- Grant execute to `anon` like the existing RPCs; everything is keyed off the
  passed `p_user_id` (no auth in this app — trust-the-client, same posture as
  `get_friend_leaderboard`). Standings are spoofable — same posture as the
  existing global boards, acceptable while nothing is prized. Revisit before
  attaching any reward to a league finish.
- No local Supabase CLI workflow — apply manually against the project, and
  sanity-check the query plan on `user_lifts` (it has ~5k-row fetches today;
  the per-exercise max aggregation should use the existing composite index or
  we add one in the same migration).

### Day-boundary caveat

`active_days` groups by the UTC date of `created_at`, while the client's week
bounds are local. A late-evening session near midnight can land on the "wrong"
day server-side. v1 accepts this (worst case: two sessions merge into one
active day). If it annoys in practice, v2 passes the viewer's UTC offset into
the RPC.

## Client architecture

New domain module `lib/leagues/` (pure, node-testable — the repo convention):

```
lib/leagues/
  types.ts      // LeagueMemberAggregates (mirrors RPC row), LeagueStanding,
                // ScoreBreakdown, SCORING constants
  scoring.ts    // scoreMember(agg: LeagueMemberAggregates): ScoreBreakdown
                // buildStandings(rows, friends, myUserId, now): {
                //   active: LeagueStanding[], restingFriends: Friend[],
                //   me: LeagueStanding | null }
                // detectOvertakes(before: LeagueStanding[], after: LeagueStanding[],
                //   myUserId): string[]   // friend user_ids I just passed
  results.ts    // LeagueWeekResult, resultFromStandings(standings, myUserId, weekStart),
                // weeksNeedingSnapshot(stored, now)  — drives the close-of-week
                // snapshot + ≤4-week backfill; persistence via storageService
```

- `buildStandings` sorts by points with `rankByValue` tie semantics
  (`lib/gamification/leaderboardInsights.ts`) and computes gap-to-ahead via
  `gapToAhead`. `restingFriends` = the viewer's friends (from the existing
  `userSyncService.getFriends()`) absent from the active rows — the RPC only
  returns users who trained this week.
- Week bounds come from the existing `weekStart` util; all functions take
  `now: Date` injected (clock-injectable like `weeklyGoal.ts`).

Service layer:

- `userSyncService.getLeagueWeek(weekStart: Date, weekEnd: Date)` — thin RPC
  wrapper returning `LeagueMemberAggregates[]`, `[]` when `supabase` is null
  (backend-optional convention).
- `notificationService.notifyOvertaken(friendIds: string[], myPoints, ...)` —
  direct-token push modeled on the token half of `notifyFriendsOfPR`.

UI (`components/home/league/`):

- `LeagueCard.tsx` — Home card (rank, points, rival gap line, competence cue).
- `LeagueBoard.tsx` — the modal view (tabs, ranked list with friend badges,
  resting-friends row, You bar, personal panel). Reuses `SegmentedTabs`,
  `Divider`, `EmptyState`, Themed `<Text variant tone>` per
  `docs/ui-conventions.md`; the All-time tab hosts the existing leaderboard
  content.
- Wiring in `app/(tabs)/index.tsx`: card placement where the leaderboard entry
  sits today, `?league=1` param handling mirroring `?feed=1`.
- Post-workout hook: after `syncWorkout` succeeds, fire the standings re-fetch +
  `detectOvertakes` + push, fire-and-forget (same posture as PR notifications).

## Tests (`__tests__/leagueScoring.test.ts`)

Pure-function coverage, node env:

- `scoreMember`: caps (5 active days → 40 pts; 6 PRs → 4 counted; gain bonus
  top-2 only, 10% clamp), goal bonus at exactly 3 days, zero week, first-time
  exercises score 0.
- `buildStandings`: tie ranks, resting-friends derivation (friend absent from
  active rows), stranger vs friend badge flag, empty league, viewer inactive
  (self is always in the RPC rows, so `me` is non-null with 0 points but is
  excluded from the ranked actives).
- `detectOvertakes`: pass one friend, pass multiple in one workout, strangers
  passed → not returned, no self-notify, no notify when already ahead, Monday
  zero-state.
- Week bounds: session at Sunday 23:59 vs Monday 00:00 local.
- `leagueAchievements` + `results`: win requires ≥3 active participants and
  rank 1; podium requires ≥4; consecutive-win streak across stored results with
  a gap week breaking it; `weeksNeedingSnapshot` backfill cap at 4; snapshot
  idempotence (same week never recorded twice).

## Rollout

- Gate the Home card behind a single module-level flag (`LEAGUE_ENABLED` in
  `lib/leagues/types.ts`) so the branch can merge dark if needed — no flag
  infra exists in main, keep it a constant.
- Ship order within this branch: migration → `lib/leagues` + tests → service
  wrappers → board UI → card + wiring → overtake push → week snapshots +
  league achievements.
- Watch one full Monday–Sunday cycle with real friends before building v2
  (seasons, rotating campaign formats, collective squad goal, kickoff/wrap-up
  notifications, percentile-delta scoring refinement).

## Open questions (Connor)

1. **Point values** — the table above is a first guess; tune in `SCORING`.
2. **Does the Home card fully replace the leaderboard card**, or sit alongside
   it for a release? Spec assumes replace (all-time lives inside the league
   view).
3. **Overtake push copy** — "{username} just passed you in the weekly league";
   pushes are friend-only so the sender is always someone you know.
4. **Should `new_lifts` earn a token 5 pts (capped)** to reward exploration, or
   stay 0 to keep the anti-gaming stance? Spec says 0.
