// Weekly league domain types + tunable scoring constants.
// Spec: docs/leagues-v1-spec.md. Everything here is pure data — no RN, no network.

/** Kill switch for the Home league surface (no flag infra in main; keep a constant). */
export const LEAGUE_ENABLED = true;

// Real-value scoring: points ARE the week. One point per pound lifted; a PR is
// worth the PR'd lift's e1RM × prMultiplier — serious lifters PR rarely, so a
// 600 lb pull pays 30,000. These are product-tuning knobs, not derived numbers.
export const SCORING = {
  /** Points per pound of weekly volume (Σ weight×reps). */
  pointsPerLb: 1,
  /** PR payout: week-best e1RM (lbs) × this. */
  prMultiplier: 50,
  /** A win only counts as a "league win" with this many active participants. */
  minParticipantsForWin: 3,
  /** A top-3 finish only counts as a podium with this many active participants. */
  minParticipantsForPodium: 4,
} as const;

/** One of a member's best lifts this week (RPC orders by week_best desc, ≤6). */
export interface LeagueTopLift {
  exercise_id: string;
  week_best: number; // best e1RM (lbs) inside the week window
  prior_best: number | null; // best e1RM before the window (null = first time)
  gain_pct: number | null;
  strength_tier: string | null; // stored tier of the lift row, when known
  is_pr: boolean; // beat the pre-week best, or first time the lift was ever logged
}

/** One row of get_league_week — raw server aggregates, unscored. */
export interface LeagueMemberAggregates {
  user_id: string;
  username: string;
  profile_picture_url: string | null;
  sessions: number;
  active_days: number;
  /** Σ weight×reps for the week — user_workouts.total_volume is always lbs. */
  volume_lbs: number;
  top_lifts: LeagueTopLift[];
  is_friend: boolean;
}

export interface ScoreBreakdown {
  volumePoints: number;
  prPoints: number;
  total: number;
  volumeLbs: number;
  activeDays: number;
  prCount: number;
}

export interface LeagueStanding {
  userId: string;
  sessions: number;
  username: string;
  profilePictureUrl: string | null;
  isFriend: boolean;
  /** 1-based, SQL rank() tie semantics; null when not on the active board. */
  rank: number | null;
  points: number;
  breakdown: ScoreBreakdown;
  /** Best lifts this week, week_best desc — feeds the per-row recap. */
  topLifts: LeagueTopLift[];
  /** Points to the member directly ahead; null for #1 or unranked. */
  gapToAhead: number | null;
}
