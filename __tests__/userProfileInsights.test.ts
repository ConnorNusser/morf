import {
  buildLiftComparison,
  catalogExerciseName,
  liftHistoryToProgress,
  overallStanding,
  percentileTrend,
  summarizeAchievementShowcase,
  summarizeLifts,
  withContributionWeights,
} from '@/lib/gamification/userProfileInsights';
import { achievementMeta } from '@/lib/gamification/achievementMeta';
import { rarityRank } from '@/lib/gamification/rarity';
import { buildRewardSnapshot } from '@/lib/gamification/sessionRewards';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { EXERCISE_CATALOG, getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { MAIN_LIFTS, UserPercentileData } from '@/types';

const lift = (exercise_id: string, estimated_1rm: number) => ({
  exercise_id,
  estimated_1rm,
  recorded_at: '2026-01-01T00:00:00Z',
});

const ALL_ACHIEVEMENT_IDS = buildRewardSnapshot([], { unit: 'lbs', overall: 0, bodyWeightLbs: 0 })
  .achievements.map(a => a.id);

describe('summarizeAchievementShowcase', () => {
  it('returns zeros for no workouts', () => {
    expect(summarizeAchievementShowcase([])).toEqual({ totalPRs: 0, totalAchievements: 0, rarest: [] });
  });

  it('sums pr_count and tolerates null / empty feed_data', () => {
    const result = summarizeAchievementShowcase([
      { feed_data: { pr_count: 2 } },
      { feed_data: null },
      { feed_data: {} },
      { feed_data: { pr_count: 3 } },
    ]);
    expect(result.totalPRs).toBe(5);
    expect(result.totalAchievements).toBe(0);
  });

  it('dedupes ids across workouts and drops unknown ids from the showcase only', () => {
    const known = ALL_ACHIEVEMENT_IDS[0];
    const result = summarizeAchievementShowcase([
      { feed_data: { achievement_ids: [known, 'not-a-real-achievement'] } },
      { feed_data: { achievement_ids: [known] } },
    ]);
    // Unknown ids still count as earned; they just have nothing to render.
    expect(result.totalAchievements).toBe(2);
    expect(result.rarest.map(m => m.id)).toEqual([known]);
  });

  it('keeps at most six, rarest first', () => {
    const result = summarizeAchievementShowcase([{ feed_data: { achievement_ids: ALL_ACHIEVEMENT_IDS } }]);
    expect(result.totalAchievements).toBe(ALL_ACHIEVEMENT_IDS.length);
    expect(result.rarest).toHaveLength(Math.min(6, ALL_ACHIEVEMENT_IDS.length));
    const ranks = result.rarest.map(m => rarityRank(m.rarity));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    const maxRank = Math.max(...ALL_ACHIEVEMENT_IDS.map(id => rarityRank(achievementMeta(id)!.rarity)));
    expect(ranks[0]).toBe(maxRank);
  });
});

describe('withContributionWeights', () => {
  it('returns [] when there are no contributions', () => {
    expect(withContributionWeights(undefined, [lift('a', 100)])).toEqual([]);
  });

  it('keeps a server weight, fills a missing one from lifts, else undefined', () => {
    const result = withContributionWeights(
      [
        { exercise_id: 'a', name: 'A', percentile: 50, weight: 200 },
        { exercise_id: 'b', name: 'B', percentile: 40 },
        { exercise_id: 'c', name: 'C', percentile: 30 },
      ],
      [lift('a', 111), lift('b', 150)],
    );
    expect(result.map(c => c.weight)).toEqual([200, 150, undefined]);
    expect(result[1]).toMatchObject({ exercise_id: 'b', name: 'B', percentile: 40 });
  });
});

describe('buildLiftComparison', () => {
  const base = {
    currentUserId: 'me',
    userId: 'them',
    myUserData: { weight: { value: 180, unit: 'lbs' as const }, gender: 'male' as const },
    userData: { weight: { value: 180, unit: 'lbs' as const }, gender: 'male' as const },
  };

  it('is null without a viewer, on your own profile, or when either side has no lifts', () => {
    const lifts = [lift(MAIN_LIFTS.SQUAT, 300)];
    expect(buildLiftComparison({ ...base, currentUserId: null, myLifts: lifts, lifts, comparisonMode: 'weight' })).toBeNull();
    expect(buildLiftComparison({ ...base, userId: 'me', myLifts: lifts, lifts, comparisonMode: 'weight' })).toBeNull();
    expect(buildLiftComparison({ ...base, myLifts: [], lifts, comparisonMode: 'weight' })).toBeNull();
    expect(buildLiftComparison({ ...base, myLifts: lifts, lifts: [], comparisonMode: 'weight' })).toBeNull();
  });

  it('is null when no exercises are shared', () => {
    expect(buildLiftComparison({
      ...base,
      myLifts: [lift(MAIN_LIFTS.SQUAT, 300)],
      lifts: [lift(MAIN_LIFTS.DEADLIFT, 400)],
      comparisonMode: 'weight',
    })).toBeNull();
  });

  it('compares shared exercises by rounded 1RM, sorted by their value, and tallies wins/ties', () => {
    const result = buildLiftComparison({
      ...base,
      myLifts: [lift(MAIN_LIFTS.SQUAT, 300.4), lift(MAIN_LIFTS.BENCH_PRESS, 200), lift(MAIN_LIFTS.DEADLIFT, 405), lift('only-mine', 50)],
      lifts: [lift(MAIN_LIFTS.SQUAT, 250), lift(MAIN_LIFTS.BENCH_PRESS, 225), lift(MAIN_LIFTS.DEADLIFT, 405.2), lift('only-theirs', 50)],
      comparisonMode: 'weight',
    })!;
    expect(result.comparisons.map(c => c.exerciseId)).toEqual([
      MAIN_LIFTS.DEADLIFT,
      MAIN_LIFTS.SQUAT,
      MAIN_LIFTS.BENCH_PRESS,
    ]);
    const [deadlift, squat, bench] = result.comparisons;
    expect(deadlift).toMatchObject({ myValue: 405, theirValue: 405, iWin: false, isTie: true });
    expect(squat).toMatchObject({ myValue: 300, theirValue: 250, iWin: true, isTie: false });
    expect(bench).toMatchObject({ myValue: 200, theirValue: 225, iWin: false, isTie: false });
    expect(squat.name).toBe(getCatalogExercise(MAIN_LIFTS.SQUAT)!.name);
    expect(result).toMatchObject({ myWins: 1, theirWins: 1, ties: 1 });
  });

  it('falls back to the raw id for a shared exercise missing from the catalog', () => {
    const result = buildLiftComparison({
      ...base,
      myLifts: [lift('mystery-lift', 100)],
      lifts: [lift('mystery-lift', 90)],
      comparisonMode: 'weight',
    })!;
    expect(result.comparisons[0].name).toBe('mystery-lift');
  });

  it('percentile mode keeps only featured lifts and reports percentiles as the values', () => {
    const result = buildLiftComparison({
      ...base,
      myLifts: [lift(MAIN_LIFTS.SQUAT, 315), lift('mystery-lift', 100)],
      lifts: [lift(MAIN_LIFTS.SQUAT, 225), lift('mystery-lift', 90)],
      comparisonMode: 'percentile',
    })!;
    expect(result.comparisons).toHaveLength(1);
    const [squat] = result.comparisons;
    expect(squat.exerciseId).toBe(MAIN_LIFTS.SQUAT);
    expect(squat.myValue).toBe(squat.myPercentile);
    expect(squat.theirValue).toBe(squat.theirPercentile);
    expect(squat.myWeight).toBe(315);
    expect(squat.myPercentile).toBeGreaterThan(squat.theirPercentile);
    expect(squat.iWin).toBe(true);
  });

  it('percentile mode is null when a body weight is missing or nothing shared is featured', () => {
    const lifts = [lift(MAIN_LIFTS.SQUAT, 315)];
    expect(buildLiftComparison({ ...base, userData: null, myLifts: lifts, lifts, comparisonMode: 'percentile' })).toBeNull();
    expect(buildLiftComparison({
      ...base,
      myLifts: [lift('mystery-lift', 100)],
      lifts: [lift('mystery-lift', 90)],
      comparisonMode: 'percentile',
    })).toBeNull();
  });
});

describe('summarizeLifts', () => {
  it('returns zeros for no lifts', () => {
    expect(summarizeLifts([])).toEqual({
      benchMax: 0,
      squatMax: 0,
      deadliftMax: 0,
      big3Total: 0,
      thousandPoundProgress: 0,
      totalVolume: 0,
      otherLifts: [],
    });
  });

  it('rounds the Big 3, totals them, and reports progress to 1000', () => {
    const result = summarizeLifts([
      lift(MAIN_LIFTS.BENCH_PRESS, 224.6),
      lift(MAIN_LIFTS.SQUAT, 315.2),
      lift(MAIN_LIFTS.DEADLIFT, 405),
    ]);
    expect(result).toMatchObject({ benchMax: 225, squatMax: 315, deadliftMax: 405, big3Total: 945, thousandPoundProgress: 95 });
    expect(result.totalVolume).toBeCloseTo(944.8);
    expect(result.otherLifts).toEqual([]);
  });

  it('caps progress at 100', () => {
    const result = summarizeLifts([
      lift(MAIN_LIFTS.BENCH_PRESS, 400),
      lift(MAIN_LIFTS.SQUAT, 500),
      lift(MAIN_LIFTS.DEADLIFT, 600),
    ]);
    expect(result.thousandPoundProgress).toBe(100);
  });

  it('otherLifts excludes the Big 3 and non-catalog ids, heaviest first, max five', () => {
    const big3: string[] = [MAIN_LIFTS.BENCH_PRESS, MAIN_LIFTS.SQUAT, MAIN_LIFTS.DEADLIFT];
    const catalogIds = EXERCISE_CATALOG.map(e => e.id).filter(id => !big3.includes(id)).slice(0, 6);
    expect(catalogIds).toHaveLength(6);
    const result = summarizeLifts([
      lift(MAIN_LIFTS.BENCH_PRESS, 999),
      lift('not-in-catalog', 998),
      ...catalogIds.map((id, i) => lift(id, 100 + i)),
    ]);
    expect(result.otherLifts.map(l => l.exercise_id)).toEqual([...catalogIds].reverse().slice(0, 5));
  });
});

describe('catalogExerciseName', () => {
  it('uses the catalog name, else the id', () => {
    expect(catalogExerciseName(MAIN_LIFTS.SQUAT)).toBe(getCatalogExercise(MAIN_LIFTS.SQUAT)!.name);
    expect(catalogExerciseName('mystery-lift')).toBe('mystery-lift');
  });
});

describe('overallStanding', () => {
  const data = (overrides: Partial<UserPercentileData>): UserPercentileData => ({
    user_id: 'u',
    overall_percentile: 60,
    strength_level: '',
    muscle_groups: {} as UserPercentileData['muscle_groups'],
    top_contributions: [],
    ...overrides,
  });

  it('is empty without percentile data', () => {
    expect(overallStanding(null)).toEqual({ overallPercentile: null, overallTier: undefined, tierColor: undefined });
  });

  it('prefers the stored strength_level over the percentile-derived tier', () => {
    const stored = getStrengthTier(95);
    const result = overallStanding(data({ overall_percentile: 10, strength_level: stored }));
    expect(result.overallPercentile).toBe(10);
    expect(result.overallTier).toBe(stored);
    expect(result.tierColor).toBe(getTierColor(stored));
  });

  it('derives the tier from the percentile when strength_level is absent', () => {
    const result = overallStanding(data({ strength_level: undefined as unknown as string }));
    expect(result.overallTier).toBe(getStrengthTier(60));
  });
});

describe('percentileTrend', () => {
  it('is flat with fewer than two entries', () => {
    expect(percentileTrend(undefined)).toEqual({ sparkHistory: [], sparkDelta: 0, sparkSince: '' });
    const one = [{ percentile: 50, date: '2026-03-15' }];
    expect(percentileTrend(one)).toEqual({ sparkHistory: one, sparkDelta: 0, sparkSince: '' });
  });

  it('reports the rounded net change and the starting month', () => {
    const result = percentileTrend([
      { percentile: 40.2, date: '2026-03-15' },
      { percentile: 55, date: '2026-04-15' },
      { percentile: 47.9, date: '2026-05-15' },
    ]);
    expect(result.sparkDelta).toBe(8);
    expect(result.sparkSince).toBe('Mar');
  });

  it('only looks at the last 30 entries', () => {
    const history = Array.from({ length: 35 }, (_, i) => ({ percentile: i, date: '2026-03-15' }));
    const result = percentileTrend(history);
    expect(result.sparkHistory).toHaveLength(30);
    expect(result.sparkHistory[0].percentile).toBe(5);
    expect(result.sparkDelta).toBe(29);
  });
});

describe('liftHistoryToProgress', () => {
  it('maps each lift row to a chart point for that exercise', () => {
    const recorded = new Date('2026-02-01T00:00:00Z');
    expect(liftHistoryToProgress('squat', [{ estimated_1rm: 300, recorded_at: recorded }])).toEqual([
      { workoutId: 'squat', personalRecord: 300, lastUpdated: recorded, percentileRanking: 0, strengthLevel: '' },
    ]);
  });
});
