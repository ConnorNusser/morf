import {
  bestByUser,
  cutoffDateISO,
  gapToAhead,
  groupByTierBand,
  liftMovement,
  percentileAsOf,
  rankByValue,
} from '@/lib/gamification/leaderboardInsights';
import { StrengthTier } from '@/lib/data/strengthStandards';

describe('bestByUser', () => {
  it('keeps the max 1RM per user', () => {
    expect(
      bestByUser([
        { user_id: 'a', estimated_1rm: 200 },
        { user_id: 'a', estimated_1rm: 225 },
        { user_id: 'b', estimated_1rm: 180 },
        { user_id: 'a', estimated_1rm: 210 },
      ]),
    ).toEqual({ a: 225, b: 180 });
  });

  it('returns empty for no rows', () => {
    expect(bestByUser([])).toEqual({});
  });
});

describe('rankByValue', () => {
  it('ranks descending, 1-based', () => {
    expect(rankByValue({ a: 100, b: 300, c: 200 })).toEqual({ b: 1, c: 2, a: 3 });
  });

  it('gives ties the same rank and skips the next (SQL rank semantics)', () => {
    expect(rankByValue({ a: 300, b: 300, c: 200 })).toEqual({ a: 1, b: 1, c: 3 });
  });
});

describe('liftMovement', () => {
  const oldRows = [
    { user_id: 'a', estimated_1rm: 200 }, // old rank 2
    { user_id: 'b', estimated_1rm: 250 }, // old rank 1
    { user_id: 'b', estimated_1rm: 240 },
  ];

  it('computes 1RM delta and rank movement', () => {
    const movement = liftMovement(
      [
        { userId: 'a', oneRm: 260, rank: 1 }, // passed b
        { userId: 'b', oneRm: 255, rank: 2 },
      ],
      oldRows,
    );
    expect(movement.a).toEqual({ rmDelta: 60, rankDelta: 1 });
    expect(movement.b).toEqual({ rmDelta: 5, rankDelta: -1 });
  });

  it('returns nulls for users with no lift before the cutoff', () => {
    const movement = liftMovement([{ userId: 'new', oneRm: 150, rank: 3 }], oldRows);
    expect(movement.new).toEqual({ rmDelta: null, rankDelta: null });
  });

  it('null rank delta when the entry has no current rank', () => {
    const movement = liftMovement([{ userId: 'a', oneRm: 210 }], oldRows);
    expect(movement.a).toEqual({ rmDelta: 10, rankDelta: null });
  });
});

describe('percentileAsOf', () => {
  const history = [
    { percentile: 40, date: '2026-01-10' },
    { percentile: 48, date: '2026-03-01' },
    { percentile: 55, date: '2026-06-20' },
  ];

  it('returns the latest snapshot on or before the cutoff', () => {
    expect(percentileAsOf(history, '2026-04-11')).toBe(48);
    expect(percentileAsOf(history, '2026-03-01')).toBe(48);
  });

  it('returns null when all snapshots are after the cutoff', () => {
    expect(percentileAsOf(history, '2026-01-01')).toBeNull();
  });

  it('handles missing or empty history', () => {
    expect(percentileAsOf(undefined, '2026-04-11')).toBeNull();
    expect(percentileAsOf([], '2026-04-11')).toBeNull();
  });

  it('is order-independent', () => {
    expect(percentileAsOf([...history].reverse(), '2026-04-11')).toBe(48);
  });
});

describe('gapToAhead', () => {
  const board = [{ v: 300 }, { v: 280 }, { v: 240 }];

  it('returns the gap to the entry above', () => {
    expect(gapToAhead(board, 1, e => e.v)).toBe(20);
    expect(gapToAhead(board, 2, e => e.v)).toBe(40);
  });

  it('returns null for the leader and out-of-range indexes', () => {
    expect(gapToAhead(board, 0, e => e.v)).toBeNull();
    expect(gapToAhead(board, 3, e => e.v)).toBeNull();
    expect(gapToAhead(board, -1, e => e.v)).toBeNull();
  });
});

describe('groupByTierBand', () => {
  const tierOf = (e: { tier?: string }) => e.tier as StrengthTier | undefined;

  it('groups consecutive entries by base tier', () => {
    const bands = groupByTierBand(
      [{ tier: 'S+' }, { tier: 'S-' }, { tier: 'A' }, { tier: 'A-' }, { tier: 'B+' }],
      tierOf,
    );
    expect(bands.map(b => ({ tier: b.tier, size: b.entries.length, start: b.startIndex }))).toEqual([
      { tier: 'S', size: 2, start: 0 },
      { tier: 'A', size: 2, start: 2 },
      { tier: 'B', size: 1, start: 4 },
    ]);
  });

  it('puts untiered entries into a null band without crashing', () => {
    const bands = groupByTierBand([{ tier: 'A' }, {}, {}], tierOf);
    expect(bands.map(b => b.tier)).toEqual(['A', null]);
    expect(bands[1].entries).toHaveLength(2);
  });

  it('an out-of-order tier starts a new band rather than re-sorting', () => {
    const bands = groupByTierBand([{ tier: 'A' }, { tier: 'S' }, { tier: 'A' }], tierOf);
    expect(bands.map(b => b.tier)).toEqual(['A', 'S', 'A']);
  });
});

describe('cutoffDateISO', () => {
  it('returns the ISO date N days back', () => {
    expect(cutoffDateISO(new Date('2026-07-10T12:00:00Z'), 90)).toBe('2026-04-11');
  });
});
