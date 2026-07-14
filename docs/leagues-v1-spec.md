# Leagues v1 — "This Week" friends league

Spec for the first shippable slice of the rivalry initiative: a weekly, friends-only
league scored on **recent effort and personal progress**, replacing the stale
all-time friends leaderboard as the competitive surface. Seasons, campaigns, and
promotion tiers are explicitly v2+ (see Non-goals).

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

- **Your friends are the league.** Cohort = the viewer + their `friends` rows
  (the table is bidirectional; no join/lobby mechanics, no league entity).
- Scoring resets every Monday. There is no carryover, promotion, or season
  aggregation in v1.

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

**2. League view (`LeagueBoard`)** — modal following the structural patterns of
`components/profile/LeaderboardModal.tsx` (bottom-pinned You bar, gap-to-next,
`SegmentedTabs`), but a new component under `components/home/league/`.

- **Ranked list of active members only** (≥1 session this week), sorted by
  points desc, ties share rank (`rankByValue` semantics). With typical friend
  counts (≤10) the full list shows; there is **no last-place styling** — no
  arrows-down, no red, the bottom row renders identically to the middle.
- **Resting row**: members with 0 sessions this week collapse into a single
  footer row ("Resting this week: Sam, Priya") — visible, not ranked, not
  shamed. This is what kills the stale feel: inactive friends stop occupying
  board positions.
- **Per-row**: avatar, username, points, and a compact breakdown strip
  (days • PRs • best gain %) so scores are legible, not a black box.
- **You bar** (bottom-pinned): rank, points, gap-to-ahead in points.
- **Personal panel** below the board: your points breakdown by source and a
  week-over-week comparison ("last week: 87 pts, 3 days"), the competence
  feedback the research says must accompany rank.
- **Tabs**: `This week` (default) | `All-time` — the all-time tab embeds the
  existing friends leaderboard content so "who's strongest ever" stays
  answerable but stops being the default lens.
- **Empty/edge states**: 0 friends → invite CTA (reuse friend-search flow);
  <2 active members → board renders with a "Challenge your crew" nudge row
  instead of a competition frame.

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
  `⚔️ {username} just passed you in the weekly league` /
  `{points} pts vs your {theirPoints}. {daysLeft} days left this week.`
- Delivery reuses the existing direct-token path in `notificationService`
  (`getFriendPushTokens`-style lookup filtered to the overtaken user ids +
  `sendPushNotifications`, exactly as `notifyFriendsOfPR` does after its RPC).
- **Rate limit**: max one overtake push per (pair, day), guarded client-side via
  a storage key (`league_overtake_sent:{friendId}:{dateKey}`) under
  `STORAGE_KEYS`. No pushes on Monday before the first session (everyone is 0).
- Deep link: tapping opens Home with the league view presented (same param
  pattern as `/(tabs)?feed=1`, e.g. `/(tabs)?league=1`).
- Weekly kickoff/wrap-up notifications are deferred to v2 (they want the season
  layer to say anything meaningful).

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
  new_lifts int          -- exercises lifted in-window with no prior history
) language sql stable as $$
  with members as (
    select p_user_id as user_id
    union
    select friend_id from friends where user_id = p_user_id
  ),
  -- per member+exercise: best in window vs best before window, from user_lifts
  ...
$$;
```

Implementation notes:

- Members CTE = self + `friends.friend_id where user_id = p_user_id` (the table
  is bidirectional, one direction suffices).
- `prs` compares `max(estimated_1rm)` in `[p_week_start, p_week_end)` vs before
  `p_week_start` per `(user_id, exercise_id)` over append-only `user_lifts`,
  keeps rows where a prior best exists and is beaten, orders by `gain_pct`
  desc, limits 8 per member (scoring caps use ≤4, the extras feed the breakdown
  UI). `active_days` counts distinct `date(created_at)` from `user_workouts`.
- Grant execute to `anon` like the existing RPCs; everything is keyed off the
  passed `p_user_id` (no auth in this app — trust-the-client, same posture as
  `get_friend_leaderboard`). Standings are spoofable; acceptable at friends
  scale, disqualifying for anything global/prized — do not reuse this for a
  public board.
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
                // buildStandings(rows, myUserId, now): { active: LeagueStanding[],
                //   resting: LeagueMember[], me: LeagueStanding | null }
                // detectOvertakes(before: LeagueStanding[], after: LeagueStanding[],
                //   myUserId): string[]   // user_ids I just passed
```

- `buildStandings` sorts by points with `rankByValue` tie semantics
  (`lib/gamification/leaderboardInsights.ts`), splits active vs resting, and
  computes gap-to-ahead via `gapToAhead`.
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
- `LeagueBoard.tsx` — the modal view (tabs, ranked list, resting row, You bar,
  personal panel). Reuses `SegmentedTabs`, `Divider`, `EmptyState`, Themed
  `<Text variant tone>` per `docs/ui-conventions.md`; the All-time tab hosts the
  existing friends leaderboard content.
- Wiring in `app/(tabs)/index.tsx`: card placement where the leaderboard entry
  sits today, `?league=1` param handling mirroring `?feed=1`.
- Post-workout hook: after `syncWorkout` succeeds, fire the standings re-fetch +
  `detectOvertakes` + push, fire-and-forget (same posture as PR notifications).

## Tests (`__tests__/leagueScoring.test.ts`)

Pure-function coverage, node env:

- `scoreMember`: caps (5 active days → 40 pts; 6 PRs → 4 counted; gain bonus
  top-2 only, 10% clamp), goal bonus at exactly 3 days, zero week, first-time
  exercises score 0.
- `buildStandings`: tie ranks, active/resting split, me-not-in-friends edge,
  empty league.
- `detectOvertakes`: pass one friend, pass multiple in one workout, no
  self-notify, no notify when already ahead, Monday zero-state.
- Week bounds: session at Sunday 23:59 vs Monday 00:00 local.

## Rollout

- Gate the Home card behind a single module-level flag (`LEAGUE_ENABLED` in
  `lib/leagues/types.ts`) so the branch can merge dark if needed — no flag
  infra exists in main, keep it a constant.
- Ship order within this branch: migration → `lib/leagues` + tests → service
  wrappers → board UI → card + wiring → overtake push.
- Watch one full Monday–Sunday cycle with real friends before building v2
  (seasons, rotating campaign formats, collective squad goal, kickoff/wrap-up
  notifications, percentile-delta scoring refinement).

## Open questions (Connor)

1. **Point values** — the table above is a first guess; tune in `SCORING`.
2. **Does the Home card fully replace the leaderboard card**, or sit alongside
   it for a release? Spec assumes replace (all-time lives inside the league
   view).
3. **Overtake push copy/emoji** — current draft is ⚔️; matches the rivalry
   framing but says nothing about who it's from being a friend vs rando (fine
   while leagues are friends-only).
4. **Should `new_lifts` earn a token 5 pts (capped)** to reward exploration, or
   stay 0 to keep the anti-gaming stance? Spec says 0.
