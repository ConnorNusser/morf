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
import { SCENARIOS, scenarioByKey, REFERENCE_NOW } from '../fixtures';
import { WORKOUT_STATS_GOLDENS, ONE_RM_GOLDENS } from '../goldens';

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
