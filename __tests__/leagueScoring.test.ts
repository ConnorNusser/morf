import {
  buildStandings,
  detectOvertakes,
  leagueWinner,
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
import { LeagueMemberAggregates, SCORING } from '@/lib/leagues/types';
import { computeLeagueAchievements } from '@/lib/gamification/leagueAchievements';
import { Friend } from '@/types';

const member = (overrides: Partial<LeagueMemberAggregates>): LeagueMemberAggregates => ({
  user_id: 'u1',
  username: 'user1',
  profile_picture_url: null,
  sessions: 0,
  active_days: 0,
  volume_lbs: 0,
  prs: [],
  new_lifts: 0,
  is_friend: false,
  ...overrides,
});

const pr = (gain_pct: number, exercise_id = `e${gain_pct}`) => ({
  exercise_id,
  week_best: 100 + gain_pct,
  prior_best: 100,
  gain_pct,
});

const friend = (id: string, username = id): Friend =>
  ({ id: `f-${id}`, user: { id, username } as Friend['user'], created_at: new Date(0) }) as Friend;

// A standings input where points are driven purely by volume: each "day" is
// 10,000 lbs → 10 pts, so ladder expectations stay easy to eyeball.
const boardOf = (days: Record<string, number>, friends: string[] = []) =>
  Object.entries(days).map(([id, activeDays]) =>
    member({
      user_id: id,
      username: id,
      sessions: activeDays,
      active_days: activeDays,
      volume_lbs: activeDays * 10 * SCORING.lbsPerPoint,
      is_friend: friends.includes(id),
    }),
  );

describe('scoreMember', () => {
  it('volume points scale with lbs and cap out', () => {
    const b = scoreMember(member({ volume_lbs: 12_400 }));
    expect(b.volumePoints).toBe(12);
    expect(b.volumeLbs).toBe(12_400); // uncapped for display
    expect(scoreMember(member({ volume_lbs: 999_999 })).volumePoints).toBe(SCORING.volumePointsCap);
  });

  it('caps PR count and gain bonus lifts, clamps gain %', () => {
    const b = scoreMember(member({ prs: [pr(25), pr(8), pr(4), pr(3), pr(2), pr(1)] }));
    expect(b.prPoints).toBe(SCORING.prCap * SCORING.pointsPerPR);
    // top-2 gains: 25 → clamped to 10 (20 pts) + 8 (16 pts)
    expect(b.gainPoints).toBe(20 + 16);
    expect(b.prCount).toBe(6);
    expect(b.bestGainPct).toBe(25);
  });

  it('gain caps use the largest gains regardless of RPC order', () => {
    const shuffled = scoreMember(member({ prs: [pr(1), pr(9), pr(25)] }));
    expect(shuffled.gainPoints).toBe(20 + 18);
  });

  it('goal bonus lands at exactly the day threshold', () => {
    expect(scoreMember(member({ active_days: 2 })).goalBonus).toBe(0);
    expect(scoreMember(member({ active_days: SCORING.goalBonusDays })).goalBonus).toBe(
      SCORING.goalBonus,
    );
  });

  it('a zero week scores zero', () => {
    expect(scoreMember(member({})).total).toBe(0);
  });

  it('negative gain never subtracts', () => {
    const b = scoreMember(member({ prs: [{ ...pr(5), gain_pct: -3 }] }));
    expect(b.gainPoints).toBe(0);
  });
});

describe('buildStandings', () => {
  it('ranks actives with shared-rank ties and computes gaps', () => {
    const rows = boardOf({ me: 3, a: 3, b: 1 });
    const { active } = buildStandings(rows, [], 'me');
    expect(active.map(s => s.rank)).toEqual([1, 1, 3]);
    expect(active[2].gapToAhead).toBe(20 + SCORING.goalBonus);
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

  it('flags friends vs strangers on rows', () => {
    const rows = boardOf({ alex: 1, rando: 1 }, ['alex']);
    const { active } = buildStandings(rows, [friend('alex')], 'me');
    expect(active.find(s => s.userId === 'alex')!.isFriend).toBe(true);
    expect(active.find(s => s.userId === 'rando')!.isFriend).toBe(false);
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

  it('three consecutive wins unlock Undisputed', () => {
    const achievements = computeLeagueAchievements([
      win('2026-06-22'),
      win('2026-06-29'),
      win('2026-07-06'),
    ]);
    expect(achievements.find(a => a.id === 'league-streak-3')!.unlocked).toBe(true);
  });
});
