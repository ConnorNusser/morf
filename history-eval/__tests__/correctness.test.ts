/**
 * OBJECTIVE GATE for the history-page improvement loop.
 *
 * Asserts the real derivation functions the history page depends on against
 * hand-computed goldens, and that every scenario derives finite, non-crashing
 * values. A candidate change must keep this green before it is ever judged.
 *
 * Node-testable surface today = the exported lib functions. Inline useMemo
 * derivations (streak, getImprovement, sparkline) are not yet extracted; raising
 * that assertable ceiling is the loop's natural first improvement.
 */
import { calculateWorkoutStats } from '@/lib/utils/utils';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { calculateRecapStats } from '@/lib/workout/recapStats';
import { buildPRDays } from '@/components/history/prSessions';
import { dayKeyOf } from '@/components/history/liftSeries';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';
import { SCENARIOS, scenarioByKey, REFERENCE_NOW, daysAgo } from '../fixtures';
import { WORKOUT_STATS_GOLDENS, ONE_RM_GOLDENS, PR_DAY_GOLDENS, TREND_GOLDENS } from '../goldens';
import { ExerciseWithMax, ExerciseHistoryEntry } from '@/types';

// calculateRecapStats reads storage/profile — mock them per-fixture (see below).
const mockGetWorkoutHistory = jest.fn();
const mockGetCustomExercises = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/storage/storage', () => ({
  storageService: {
    getWorkoutHistory: (...a: any[]) => mockGetWorkoutHistory(...a),
    getCustomExercises: (...a: any[]) => mockGetCustomExercises(...a),
  },
}));
jest.mock('@/lib/services/userService', () => ({
  userService: {
    getUserProfileOrDefault: async () => ({ weightUnitPreference: 'lbs' }),
  },
}));

/** Sum calculateWorkoutStats over every workout in a scenario (what the page aggregates). */
const fixtureStats = (key: string) => {
  const { workouts } = scenarioByKey(key);
  return workouts.reduce(
    (acc, w) => {
      const s = calculateWorkoutStats(w.exercises);
      acc.totalSets += s.totalSets;
      acc.totalVolumeLbs += s.totalVolumeLbs;
      return acc;
    },
    { totalSets: 0, totalVolumeLbs: 0 }
  );
};

describe('correctness gate — workout stats vs goldens', () => {
  for (const [key, golden] of Object.entries(WORKOUT_STATS_GOLDENS)) {
    it(`${key}: sets & volume match hand-computed golden`, () => {
      const got = fixtureStats(key);
      expect(got.totalSets).toBe(golden.totalSets);
      expect(got.totalVolumeLbs).toBe(golden.totalVolumeLbs);
    });
  }
});

describe('correctness gate — 1RM formula stability', () => {
  for (const g of ONE_RM_GOLDENS) {
    it(`estimate(${g.weight}, ${g.reps}) = ${g.expected}`, () => {
      expect(OneRMCalculator.estimate(g.weight, g.reps)).toBe(g.expected);
    });
  }

  it('is monotonic in reps at fixed weight (more reps ⇒ ≥ estimate)', () => {
    for (let r = 2; r <= 12; r++) {
      expect(OneRMCalculator.estimate(200, r)).toBeGreaterThanOrEqual(
        OneRMCalculator.estimate(200, r - 1)
      );
    }
  });
});

describe('no-crash / no-NaN gate — every scenario derives finite values', () => {
  for (const s of SCENARIOS) {
    it(`${s.key}: ${s.description}`, () => {
      let sets = 0;
      let vol = 0;
      expect(() => {
        for (const w of s.workouts) {
          const st = calculateWorkoutStats(w.exercises);
          sets += st.totalSets;
          vol += st.totalVolumeLbs;
        }
      }).not.toThrow();
      expect(Number.isFinite(sets)).toBe(true);
      expect(Number.isFinite(vol)).toBe(true);
      expect(vol).toBeGreaterThanOrEqual(0);
      expect(sets).toBeGreaterThanOrEqual(0);
    });
  }

  it('empty scenario yields zeroed, finite stats (cold-start safety)', () => {
    const got = fixtureStats('empty');
    expect(got).toEqual({ totalSets: 0, totalVolumeLbs: 0 });
  });
});

/**
 * Build ExerciseWithMax[] from a scenario the way loadExerciseStats does: one history
 * entry per completed set (weight>0), dated to the workout. Only id + history feed
 * buildPRDays, so the other fields are inert placeholders.
 */
const fixtureExerciseStats = (key: string): ExerciseWithMax[] => {
  const byId = new Map<string, ExerciseHistoryEntry[]>();
  for (const w of scenarioByKey(key).workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.completedSets || []) {
        if (!set.weight || set.weight <= 0) continue;
        const list = byId.get(ex.id) ?? [];
        list.push({ weight: set.weight, reps: set.reps, date: new Date(w.createdAt), unit: set.unit || 'lbs' });
        byId.set(ex.id, list);
      }
    }
  }
  return [...byId.entries()].map(([id, history]) => ({
    id, name: id, maxWeight: 0, maxReps: 0, estimated1RM: 0, isCustom: false, history,
  }));
};

describe('correctness gate — PR days (new all-time best at time logged)', () => {
  for (const [key, golden] of Object.entries(PR_DAY_GOLDENS)) {
    it(`${key}: ${golden.exerciseId} has ${golden.prDayCount} PR day(s)`, () => {
      const prDays = buildPRDays(fixtureExerciseStats(key));
      expect(prDays.get(golden.exerciseId)?.size ?? 0).toBe(golden.prDayCount);
    });
  }

  it('dense: only the FIRST time the cyclic peak is reached is a PR, not the re-hits', () => {
    const prDays = buildPRDays(fixtureExerciseStats('dense')).get('bench-press-barbell');
    // fixture: mkWorkout(daysAgo(150 - i)); peak weight 155+19 first hit at i=19,
    // re-hit at i=39 (equal, not greater ⇒ no new record).
    expect(prDays?.has(dayKeyOf(daysAgo(150 - 19)))).toBe(true);
    expect(prDays?.has(dayKeyOf(daysAgo(150 - 39)))).toBe(false);
  });

  it('every scenario builds PR days without throwing (corrupt/empty safe)', () => {
    for (const sc of SCENARIOS) {
      expect(() => buildPRDays(fixtureExerciseStats(sc.key))).not.toThrow();
    }
  });
});

describe('correctness gate — calculateRecapStats (period + distribution)', () => {
  // jest.mock() is hoisted above imports, so the top-level import already sees mocks.
  it('single: counts exactly the in-week workout', async () => {
    mockGetWorkoutHistory.mockResolvedValue(scenarioByKey('single').workouts);
    const recap = await calculateRecapStats('week', REFERENCE_NOW);
    expect(recap.totalWorkouts).toBe(1);
  });

  it('muscle distribution percentages are sorted desc and sum to ~100', async () => {
    mockGetWorkoutHistory.mockResolvedValue(scenarioByKey('prHeavy').workouts);
    const recap = await calculateRecapStats('year', REFERENCE_NOW);
    const dist = recap.muscleGroupDistribution;
    if (dist.length > 0) {
      const pcts = dist.map((d: any) => d.percentage);
      expect(pcts).toEqual([...pcts].sort((a, b) => b - a)); // sorted desc
      const sum = pcts.reduce((a: number, b: number) => a + b, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2); // rounding slack
    }
  });

  it('empty history recaps without throwing and reports zero workouts', async () => {
    mockGetWorkoutHistory.mockResolvedValue([]);
    const recap = await calculateRecapStats('week', REFERENCE_NOW);
    expect(recap.totalWorkouts).toBe(0);
  });
});

describe('correctness gate — exercise trend (clock-free delta + sparkline)', () => {
  const historyOf = (key: string, exerciseId: string) =>
    fixtureExerciseStats(key).find(e => e.id === exerciseId)?.history ?? [];

  for (const [key, golden] of Object.entries(TREND_GOLDENS)) {
    it(`${key}: ${golden.exerciseId} delta ${golden.deltaDisplay} / sparkline len ${golden.sparkline.length}`, () => {
      const trend = computeExerciseTrend(historyOf(key, golden.exerciseId), 'lbs');
      expect(trend.deltaDisplay).toBe(golden.deltaDisplay);
      expect(trend.isPositive).toBe(golden.isPositive);
      expect(trend.sparkline).toEqual(golden.sparkline);
    });
  }

  it('sparse: e1RM variant (drives the "Improved" sort) also reports the sub-3-month gain', () => {
    const trend = computeExerciseTrend(historyOf('sparse', 'squat-barbell'), 'lbs', 'e1rm');
    expect(trend.isPositive).toBe(true);
    expect(trend.deltaDisplay).toBeGreaterThan(0);
    expect(trend.sparkline).toHaveLength(3);
  });

  it('every scenario derives a finite, non-crashing trend (corrupt/empty safe)', () => {
    for (const sc of SCENARIOS) {
      for (const ex of fixtureExerciseStats(sc.key)) {
        expect(() => {
          const t = computeExerciseTrend(ex.history, 'lbs');
          expect(Number.isFinite(t.deltaDisplay)).toBe(true);
          expect(t.sparkline.every(Number.isFinite)).toBe(true);
          expect(t.sparkline.length === 0 || t.sparkline.length >= 2).toBe(true);
        }).not.toThrow();
      }
    }
  });
});
