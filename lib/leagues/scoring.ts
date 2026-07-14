// Pure league scoring + standings. All inputs come from the get_league_week RPC
// (via userSyncService) and getFriends; nothing here touches the network, so the
// node jest environment covers it.
import { Friend } from '@/types';
import { gapToAhead, rankByValue } from '@/lib/gamification/leaderboardInsights';
import { weekStart } from '@/lib/utils/utils';
import {
  LeagueMemberAggregates,
  LeagueStanding,
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

export function scoreMember(agg: LeagueMemberAggregates): ScoreBreakdown {
  // Defensive sort — the RPC orders by gain desc, but caps must not depend on it.
  const prs = [...agg.prs].sort((a, b) => b.gain_pct - a.gain_pct);

  const activeDayPoints =
    Math.min(agg.active_days, SCORING.activeDayCap) * SCORING.pointsPerActiveDay;
  const prPoints = Math.min(prs.length, SCORING.prCap) * SCORING.pointsPerPR;
  const gainPoints = prs
    .slice(0, SCORING.gainBonusLifts)
    .reduce(
      (sum, pr) =>
        sum + Math.round(SCORING.gainBonusPerPct * Math.min(Math.max(pr.gain_pct, 0), SCORING.gainPctCap)),
      0,
    );
  const goalBonus = agg.active_days >= SCORING.goalBonusDays ? SCORING.goalBonus : 0;

  return {
    activeDayPoints,
    prPoints,
    gainPoints,
    goalBonus,
    total: activeDayPoints + prPoints + gainPoints + goalBonus,
    activeDays: agg.active_days,
    prCount: prs.length,
    bestGainPct: prs.length ? prs[0].gain_pct : null,
  };
}

export interface LeagueStandings {
  /** Members who trained this week, sorted by points desc, ranked. */
  active: LeagueStanding[];
  /** The viewer's friends with no session this week (footer row, unranked). */
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

  const standings: LeagueStanding[] = active.map(({ row, breakdown }, index) => ({
    userId: row.user_id,
    username: row.username,
    profilePictureUrl: row.profile_picture_url,
    isFriend: row.is_friend,
    rank: ranks[row.user_id],
    points: breakdown.total,
    breakdown,
    gapToAhead: gapToAhead(active, index, entry => entry.breakdown.total),
  }));

  let me = standings.find(s => s.userId === myUserId) ?? null;
  if (!me) {
    const mine = scored.find(({ row }) => row.user_id === myUserId);
    if (mine) {
      me = {
        userId: mine.row.user_id,
        username: mine.row.username,
        profilePictureUrl: mine.row.profile_picture_url,
        isFriend: false,
        rank: null,
        points: mine.breakdown.total,
        breakdown: mine.breakdown,
        gapToAhead: null,
      };
    }
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
