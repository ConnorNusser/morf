import {
  buildStandings,
  detectOvertakes,
  leagueWinner,
  prPoints,
  scoreMember,
  weekBounds,
} from '@/lib/leagues/scoring';
import {
  isPodium,
  isWin,
  LeagueWeekResult,
  longestWinStreak,
  mergeResult,
  resultFromStandings,
  weeksNeedingSnapshot,
} from '@/lib/leagues/results';
import { LeagueMemberAggregates, LeagueTopLift, SCORING } from '@/lib/leagues/types';
import { computeLeagueAchievements, upForGrabs } from '@/lib/gamification/leagueAchievements';
import { Friend } from '@/types';

const member = (overrides: Partial<LeagueMemberAggregates>): LeagueMemberAggregates => ({
  user_id: 'u1',
  username: 'user1',
  profile_picture_url: null,
  sessions: 0,
  active_days: 0,
  volume_lbs: 0,
  top_lifts: [],
  is_friend: false,
  ...overrides,
});

const lift = (week_best: number, is_pr: boolean, exercise_id = `e${week_best}`): LeagueTopLift => ({
  exercise_id,
  week_best,
  prior_best: is_pr ? week_best - 10 : null,
  gain_pct: is_pr ? 3.0 : null,
  strength_tier: 'B',
  is_pr,
});

const friend = (id: string, username = id): Friend =>
  ({ id: `f-${id}`, user: { id, username } as Friend['user'], created_at: new Date(0) }) as Friend;

// A standings input where points are driven purely by volume: each "day" is
// 10,000 lbs → 10,000 pts, so ladder expectations stay easy to eyeball.
const boardOf = (days: Record<string, number>, friends: string[] = []) =>
  Object.entries(days).map(([id, activeDays]) =>
    member({
      user_id: id,
      username: id,
      sessions: activeDays,
      active_days: activeDays,
      volume_lbs: activeDays * 10_000,
      is_friend: friends.includes(id),
    }),
  );

describe('scoreMember', () => {
  it('a pound is a point', () => {
    const b = scoreMember(member({ volume_lbs: 312_400 }));
    expect(b.volumePoints).toBe(312_400);
    expect(b.total).toBe(312_400);
    expect(scoreMember(member({ volume_lbs: -5 })).volumePoints).toBe(0);
  });

  it('a PR pays its e1RM × the multiplier', () => {
    expect(prPoints(lift(600, true))).toBe(600 * SCORING.prMultiplier);
    expect(prPoints(lift(600, false))).toBe(0);
    const b = scoreMember(member({ top_lifts: [lift(600, true), lift(405, true), lift(500, false)] }));
    expect(b.prPoints).toBe((600 + 405) * SCORING.prMultiplier);
    expect(b.prCount).toBe(2);
  });

  it('volume and PRs stack into the total', () => {
    const b = scoreMember(member({ volume_lbs: 27_800, top_lifts: [lift(405, true)] }));
    expect(b.total).toBe(27_800 + 405 * SCORING.prMultiplier);
  });

  it('a zero week scores zero', () => {
    expect(scoreMember(member({})).total).toBe(0);
  });
});

describe('buildStandings', () => {
  it('ranks actives with shared-rank ties and computes gaps', () => {
    const rows = boardOf({ me: 3, a: 3, b: 1 });
    const { active } = buildStandings(rows, [], 'me');
    expect(active.map(s => s.rank)).toEqual([1, 1, 3]);
    expect(active[2].gapToAhead).toBe(20_000);
  });

  it('excludes zero-session users from the board but keeps me non-null', () => {
    const rows = [...boardOf({ a: 2 }), member({ user_id: 'me', username: 'me' })];
    const { active, me } = buildStandings(rows, [], 'me');
    expect(active.map(s => s.userId)).toEqual(['a']);
    expect(me).not.toBeNull();
    expect(me!.rank).toBeNull();
    expect(me!.points).toBe(0);
  });

  it('derives resting friends from absence on the active board', () => {
    const rows = boardOf({ me: 2, alex: 1 }, ['alex']);
    const { restingFriends } = buildStandings(rows, [friend('alex'), friend('sam')], 'me');
    expect(restingFriends.map(f => f.user.id)).toEqual(['sam']);
  });

  it('sorts each member top lifts by week best', () => {
    const rows = [member({ user_id: 'me', sessions: 1, top_lifts: [lift(225, false), lift(405, true)] })];
    const { active } = buildStandings(rows, [], 'me');
    expect(active[0].topLifts.map(l => l.week_best)).toEqual([405, 225]);
  });

  it('handles an empty league', () => {
    const { active, me, restingFriends } = buildStandings([], [], 'me');
    expect(active).toEqual([]);
    expect(me).toBeNull();
    expect(restingFriends).toEqual([]);
  });
});

describe('leagueWinner', () => {
  it('requires a real field', () => {
    expect(leagueWinner(buildStandings(boardOf({ me: 2, a: 1 }), [], 'me'))).toBeNull();
    const winner = leagueWinner(buildStandings(boardOf({ me: 3, a: 2, b: 1 }), [], 'me'));
    expect(winner!.userId).toBe('me');
  });
});

describe('detectOvertakes', () => {
  const standingsFor = (days: Record<string, number>, friends: string[]) =>
    buildStandings(boardOf(days, friends), [], 'me');

  it('returns a friend I passed, not strangers', () => {
    const before = standingsFor({ me: 1, alex: 2, rando: 2 }, ['alex']);
    const after = standingsFor({ me: 3, alex: 2, rando: 2 }, ['alex']);
    expect(detectOvertakes(before, after, 'me')).toEqual(['alex']);
  });

  it('returns multiple friends passed in one jump', () => {
    const before = standingsFor({ me: 1, alex: 2, sam: 3 }, ['alex', 'sam']);
    const after = standingsFor({ me: 4, alex: 2, sam: 3 }, ['alex', 'sam']);
    expect(detectOvertakes(before, after, 'me').sort()).toEqual(['alex', 'sam']);
  });

  it('does not notify when I was already ahead', () => {
    const before = standingsFor({ me: 3, alex: 1 }, ['alex']);
    const after = standingsFor({ me: 4, alex: 1 }, ['alex']);
    expect(detectOvertakes(before, after, 'me')).toEqual([]);
  });

  it('first session of the week can overtake', () => {
    const before = standingsFor({ alex: 1 }, ['alex']);
    const after = standingsFor({ me: 2, alex: 1 }, ['alex']);
    expect(detectOvertakes(before, after, 'me')).toEqual(['alex']);
  });

  it('Monday zero-state produces nothing', () => {
    const empty = buildStandings([], [], 'me');
    expect(detectOvertakes(empty, empty, 'me')).toEqual([]);
  });
});

describe('weekBounds', () => {
  it('spans local Monday to next Monday', () => {
    const { start, end } = weekBounds(new Date(2026, 6, 8, 13, 0)); // Wed Jul 8 2026
    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('Sunday 23:59 and next Monday 00:00 land in different weeks', () => {
    const sunday = weekBounds(new Date(2026, 6, 12, 23, 59));
    const monday = weekBounds(new Date(2026, 6, 13, 0, 0));
    expect(monday.start.getTime() - sunday.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('results', () => {
  const result = (weekStartKey: string, rank: number, activeParticipants = 4): LeagueWeekResult => ({
    weekStartKey,
    rank,
    points: 100,
    activeParticipants,
  });

  it('resultFromStandings records active weeks only', () => {
    const monday = new Date(2026, 6, 6);
    const active = buildStandings(boardOf({ me: 2, a: 1 }), [], 'me');
    expect(resultFromStandings(active, monday)).toEqual({
      weekStartKey: '2026-07-06',
      rank: 1,
      points: expect.any(Number),
      activeParticipants: 2,
    });
    const idle = buildStandings([member({ user_id: 'me' }), ...boardOf({ a: 1 })], [], 'me');
    expect(resultFromStandings(idle, monday)).toBeNull();
  });

  it('win needs ≥3 participants, podium needs ≥4', () => {
    expect(isWin(result('2026-07-06', 1, 2))).toBe(false);
    expect(isWin(result('2026-07-06', 1, 3))).toBe(true);
    expect(isPodium(result('2026-07-06', 3, 3))).toBe(false);
    expect(isPodium(result('2026-07-06', 3, 4))).toBe(true);
  });

  it('mergeResult is idempotent and sorted', () => {
    const stored = [result('2026-07-06', 2)];
    const twice = mergeResult(mergeResult(stored, result('2026-06-29', 1)), result('2026-06-29', 3));
    expect(twice.map(r => r.weekStartKey)).toEqual(['2026-06-29', '2026-07-06']);
    expect(twice.find(r => r.weekStartKey === '2026-06-29')!.rank).toBe(1);
  });

  it('weeksNeedingSnapshot backfills only missing closed weeks, capped', () => {
    const now = new Date(2026, 6, 8); // week of Mon Jul 6
    const missing = weeksNeedingSnapshot(['2026-06-29'], now);
    expect(missing.map(d => d.getDate())).toEqual([8, 15, 22]); // Jun 8, 15, 22 — not Jun 29, never Jul 6
    expect(weeksNeedingSnapshot(['2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'], now)).toEqual([]);
  });

  it('longestWinStreak requires consecutive calendar weeks', () => {
    const wins = [result('2026-06-08', 1), result('2026-06-15', 1), result('2026-06-29', 1)];
    expect(longestWinStreak(wins)).toBe(2); // gap week (Jun 22) breaks the run
    expect(longestWinStreak([result('2026-06-08', 1, 2)])).toBe(0); // uncounted win (2 participants)
  });
});

describe('computeLeagueAchievements', () => {
  const win = (key: string): LeagueWeekResult => ({ weekStartKey: key, rank: 1, points: 120, activeParticipants: 4 });

  it('empty results leave everything locked at zero progress', () => {
    for (const a of computeLeagueAchievements([])) {
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBe(0);
    }
  });

  it('a counted win unlocks Champion but not Dynasty', () => {
    const achievements = computeLeagueAchievements([win('2026-07-06')]);
    const byId = Object.fromEntries(achievements.map(a => [a.id, a]));
    expect(byId['league-first'].unlocked).toBe(true);
    expect(byId['league-podium'].unlocked).toBe(true);
    expect(byId['league-win-1'].unlocked).toBe(true);
    expect(byId['league-win-3'].unlocked).toBe(false);
    expect(byId['league-win-10'].progress).toBeCloseTo(0.1);
  });

  it('upForGrabs targets the week you are actually playing for', () => {
    const NOW = new Date(2026, 6, 15); // week of Mon Jul 13
    // Never finished a week → Contender.
    expect(upForGrabs([], 2, 4, NOW)?.id).toBe('league-first');
    // Holding #1 with a real field and no wins → Champion.
    expect(upForGrabs([win('2026-07-06')] .map(r => ({ ...r, rank: 2 })), 1, 3, NOW)?.id).toBe('league-win-1');
    // Two straight wins and holding #1 → Undisputed beats the win ladder.
    expect(upForGrabs([win('2026-06-29'), win('2026-07-06')], 1, 3, NOW)?.id).toBe('league-streak-3');
    // Top-3 with a 4-field and no podiums yet → On the Board.
    expect(upForGrabs([{ weekStartKey: '2026-07-06', rank: 5, points: 10, activeParticipants: 5 }], 3, 4, NOW)?.id).toBe('league-podium');
  });

  it('three consecutive wins unlock Undisputed', () => {
    const achievements = computeLeagueAchievements([
      win('2026-06-22'),
      win('2026-06-29'),
      win('2026-07-06'),
    ]);
    expect(achievements.find(a => a.id === 'league-streak-3')!.unlocked).toBe(true);
  });
});
