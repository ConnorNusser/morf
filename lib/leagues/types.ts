// Weekly league domain types + tunable scoring constants.
// Spec: docs/leagues-v1-spec.md. Everything here is pure data — no RN, no network.

/** Kill switch for the Home league surface (no flag infra in main; keep a constant). */
export const LEAGUE_ENABLED = true;

// All point values in one place. These are product-tuning knobs, not derived
// numbers — change them here and nowhere else.
export const SCORING = {
  /** Points per distinct day trained this week. */
  pointsPerActiveDay: 10,
  /** Days that score — attainable for most of the board, two-a-days don't grind. */
  activeDayCap: 4,
  /** Points per exercise PR'd this week (prior best required — new lifts score 0). */
  pointsPerPR: 15,
  /** PRs that score in a week. */
  prCap: 4,
  /** Gain bonus: points per % of e1RM improvement on a PR'd lift… */
  gainBonusPerPct: 2,
  /** …clamped per lift (novice jumps / dirty e1RM outliers can't run away)… */
  gainPctCap: 10,
  /** …on the top-N gaining lifts only. */
  gainBonusLifts: 2,
  /** Consistency capstone for hitting goalBonusDays distinct days. */
  goalBonus: 15,
  goalBonusDays: 3,
  /** A win only counts as a "league win" with this many active participants. */
  minParticipantsForWin: 3,
  /** A top-3 finish only counts as a podium with this many active participants. */
  minParticipantsForPodium: 4,
} as const;

/** One PR'd exercise inside a member's weekly aggregates (RPC orders by gain desc). */
export interface LeaguePrAggregate {
  exercise_id: string;
  week_best: number; // best e1RM (lbs) inside the week window
  prior_best: number; // best e1RM (lbs) before the window
  gain_pct: number; // (week_best - prior_best) / prior_best * 100
}

/** One row of get_league_week — raw server aggregates, unscored. */
export interface LeagueMemberAggregates {
  user_id: string;
  username: string;
  profile_picture_url: string | null;
  sessions: number;
  active_days: number;
  prs: LeaguePrAggregate[];
  new_lifts: number;
  is_friend: boolean;
}

export interface ScoreBreakdown {
  activeDayPoints: number;
  prPoints: number;
  gainPoints: number;
  goalBonus: number;
  total: number;
  /** Uncapped inputs, for display ("5 days · 2 PRs"). */
  activeDays: number;
  prCount: number;
  bestGainPct: number | null;
}

export interface LeagueStanding {
  userId: string;
  username: string;
  profilePictureUrl: string | null;
  isFriend: boolean;
  /** 1-based, SQL rank() tie semantics; null when not on the active board. */
  rank: number | null;
  points: number;
  breakdown: ScoreBreakdown;
  /** PR'd lifts, gain desc — feeds the per-row point receipt. */
  prs: LeaguePrAggregate[];
  /** Points to the member directly ahead; null for #1 or unranked. */
  gapToAhead: number | null;
}
