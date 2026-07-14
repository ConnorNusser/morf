// Pure league scoring + standings. All inputs come from the get_league_week RPC
// (via userSyncService) and getFriends; nothing here touches the network, so the
// node jest environment covers it.
import { Friend } from '@/types';
import { gapToAhead, rankByValue } from '@/lib/gamification/leaderboardInsights';
import { weekStart } from '@/lib/utils/utils';
import {
  LeagueMemberAggregates,
  LeagueStanding,
  LeagueTopLift,
  SCORING,
  ScoreBreakdown,
} from './types';

/** The viewer's local Monday–Sunday window, RPC-ready. */
export function weekBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = weekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/** What a single PR pays: the PR'd lift's week-best e1RM × the multiplier. */
export function prPoints(lift: LeagueTopLift): number {
  return lift.is_pr ? Math.round(Math.max(lift.week_best, 0) * SCORING.prMultiplier) : 0;
}

export function scoreMember(agg: LeagueMemberAggregates): ScoreBreakdown {
  const volumePoints = Math.round(Math.max(agg.volume_lbs, 0) * SCORING.pointsPerLb);
  const prs = agg.top_lifts.filter(lift => lift.is_pr);
  const totalPrPoints = prs.reduce((sum, lift) => sum + prPoints(lift), 0);

  return {
    volumePoints,
    prPoints: totalPrPoints,
    total: volumePoints + totalPrPoints,
    volumeLbs: Math.max(agg.volume_lbs, 0),
    activeDays: agg.active_days,
    prCount: prs.length,
  };
}

export interface LeagueStandings {
  /** Members who trained this week, sorted by points desc, ranked. */
  active: LeagueStanding[];
  /** The viewer's friends with no session this week (footer, unranked). */
  restingFriends: Friend[];
  /** The viewer — always present when their row is in the RPC result. */
  me: LeagueStanding | null;
}

export function buildStandings(
  rows: LeagueMemberAggregates[],
  friends: Friend[],
  myUserId: string,
): LeagueStandings {
  const scored = rows.map(row => ({ row, breakdown: scoreMember(row) }));

  const active = scored
    .filter(({ row }) => row.sessions > 0)
    .sort((a, b) => b.breakdown.total - a.breakdown.total);
  const ranks = rankByValue(
    Object.fromEntries(active.map(({ row, breakdown }) => [row.user_id, breakdown.total])),
  );

  const toStanding = (
    row: LeagueMemberAggregates,
    breakdown: ScoreBreakdown,
    rank: number | null,
    gap: number | null,
  ): LeagueStanding => ({
    userId: row.user_id,
    username: row.username,
    profilePictureUrl: row.profile_picture_url,
    isFriend: row.is_friend,
    rank,
    points: breakdown.total,
    breakdown,
    topLifts: [...row.top_lifts].sort((a, b) => b.week_best - a.week_best),
    gapToAhead: gap,
  });

  const standings: LeagueStanding[] = active.map(({ row, breakdown }, index) =>
    toStanding(
      row,
      breakdown,
      ranks[row.user_id],
      gapToAhead(active, index, entry => entry.breakdown.total),
    ),
  );

  let me = standings.find(s => s.userId === myUserId) ?? null;
  if (!me) {
    const mine = scored.find(({ row }) => row.user_id === myUserId);
    if (mine) me = toStanding(mine.row, mine.breakdown, null, null);
  }

  const activeIds = new Set(standings.map(s => s.userId));
  const restingFriends = friends.filter(f => !activeIds.has(f.user.id));

  return { active: standings, restingFriends, me };
}

/** The week's champion, only when the win would count (≥ minParticipantsForWin). */
export function leagueWinner(standings: LeagueStandings): LeagueStanding | null {
  if (standings.active.length < SCORING.minParticipantsForWin) return null;
  return standings.active[0] ?? null;
}

/**
 * Friend user_ids the viewer moved ahead of between two standings snapshots —
 * they were ranked ahead before and are ranked behind now. Strangers are
 * excluded (overtake pushes are friend-only).
 */
export function detectOvertakes(
  before: LeagueStandings,
  after: LeagueStandings,
  myUserId: string,
): string[] {
  const myAfter = after.active.find(s => s.userId === myUserId);
  if (!myAfter || myAfter.rank == null) return [];
  const myBeforeRank =
    before.active.find(s => s.userId === myUserId)?.rank ?? Number.POSITIVE_INFINITY;

  return after.active
    .filter(s => {
      if (s.userId === myUserId || !s.isFriend || s.rank == null) return false;
      if (s.rank <= myAfter.rank!) return false; // not behind me now
      const theirBeforeRank = before.active.find(b => b.userId === s.userId)?.rank;
      return theirBeforeRank != null && theirBeforeRank < myBeforeRank; // was ahead of me
    })
    .map(s => s.userId);
}
